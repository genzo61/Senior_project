"""
Garson Robot — Eel Backend (Ana Giriş Noktası)
Web UI ile Python arasındaki köprü.
"""
import sys
import os
import threading

# Windows konsolunda emoji/unicode hatasını önle (cp1254 → utf-8)
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import eel
import ollama

# Proje kök dizinine geç (modüllerin doğru bulunması için)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from config import (
    CONFIG, MODEL_NAME, IMG_FOLDER, BASE_DIR,
    set_lang, tr, CURRENT_LANG, LANG
)
from services import api_client
from services import llm_service
from workers import tts_worker, stt_worker
from workers.qr_worker import QRScanner
from workers.table_checker import TableChecker

# ── Durum ─────────────────────────────────────────────
_cart = {}          # {ad: {fiyat, adet, id}}
_table_no = None    # Varsayılan masa yok, QR okutulunca veya config'den alınacak
_is_listening = False


# ══════════════════════════════════════════════════════
# EEL EXPOSED FONKSİYONLAR  (JS → Python)
# ══════════════════════════════════════════════════════

@eel.expose
def set_language(lang_code):
    """Dili ayarla ve hoş geldin mesajı söyle."""
    set_lang(lang_code)
    print(f"LANGUAGE SET TO: {lang_code}")
    tts_worker.speak(tr("bot_welcome"))
    return True


@eel.expose
def get_translations():
    """Aktif dilin tüm çevirilerini döndür."""
    from config import CURRENT_LANG, LANG
    return LANG.get(CURRENT_LANG, {})


@eel.expose
def get_menu():
    """Menüyü döndür (cache'li)."""
    menu = api_client.get_menu()
    result = []
    for u in menu:
        img_path = os.path.join(IMG_FOLDER, f"{u[1]}.png")
        has_img = os.path.exists(img_path)
        result.append({
            "id": u[0],
            "name": u[1],
            "price": u[2],
            "stock": u[3],
            "hasImage": has_img,
            "imageName": f"{u[1]}.png" if has_img else None,
        })
    return result


@eel.expose
def get_cart():
    """Sepeti döndür."""
    return {
        "items": _cart,
        "total": sum(v["fiyat"] * v["adet"] for v in _cart.values()),
        "tableNo": _table_no,
    }


@eel.expose
def add_to_cart(name, price, product_id, quantity=1):
    """Sepete ürün ekle."""
    if not _table_no:
        tts_worker.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
        return {"success": False, "reason": "no_table"}

    info = api_client.find_product(name)
    stock = info[3] if info else 0
    current_qty = _cart.get(name, {}).get("adet", 0)

    if current_qty + quantity > stock:
        tts_worker.speak(f"{name} {tr('no_stock')}")
        return {"success": False, "reason": "no_stock"}

    if name in _cart:
        _cart[name]["adet"] += quantity
    else:
        _cart[name] = {"fiyat": price, "adet": quantity, "id": product_id}

    return {"success": True, "cart": get_cart()}


@eel.expose
def update_cart_item(name, new_qty):
    """Sepetteki ürün miktarını güncelle."""
    if name not in _cart:
        return get_cart()
    if new_qty <= 0:
        del _cart[name]
    else:
        info = api_client.find_product(name)
        stock = info[3] if info else 0
        if new_qty > stock:
            return get_cart()
        _cart[name]["adet"] = new_qty
    return get_cart()


@eel.expose
def remove_from_cart(name):
    """Sepetten ürün sil."""
    if name in _cart:
        del _cart[name]
    return get_cart()


@eel.expose
def start_voice_order():
    """Sesli sipariş başlat."""
    if not _table_no:
        tts_worker.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
        try:
            eel.voiceOrderDone(False)()
        except Exception:
            pass
        return {"status": "no_table"}

    global _is_listening
    if _is_listening:
        return {"status": "already_listening"}
    _is_listening = True

    def _on_status(msg):
        try:
            eel.updateStatus(msg)()
        except Exception:
            pass

    def _on_result(text):
        global _is_listening
        _is_listening = False
        if not text:
            try:
                eel.updateStatus(tr("no_voice"))()
                eel.voiceOrderDone(None)()
            except Exception:
                pass
            return

        try:
            eel.updateStatus(tr("detected") + f" {text}")()
        except Exception:
            pass

        # LLM ile analiz et
        menu = api_client.get_menu()
        result = llm_service.analyze(text, menu)
        _process_llm_result(result)

    stt_worker.listen_async(on_status=_on_status, on_result=_on_result)
    return {"status": "started"}


def _process_llm_result(result):
    """LLM sonucunu uygula: sepete ekle/çıkar, konuş."""
    if result.get("bitir"):
        checkout()
        return

    speech_parts = []
    urunler = result.get("urunler", [])

    for u in urunler:
        try:
            ad = u["ad"].replace("'", "").strip()
            adet = int(u.get("adet", 1))
            islem = u.get("islem", "ekle")

            info = api_client.find_product(ad)
            if info:
                if islem == "cikar":
                    if ad in _cart:
                        new_qty = _cart[ad]["adet"] - adet
                        if new_qty <= 0:
                            del _cart[ad]
                        else:
                            _cart[ad]["adet"] = new_qty
                else:
                    add_to_cart(info[1], info[2], info[0], adet)
                    speech_parts.append(f"{adet} {info[1]} {tr('added')}")
            else:
                print(f"{ad} bulunamadı")
        except Exception as e:
            print(f"Ürün işleme hatası: {e}")

    # Konuşma metni oluştur
    no_items = len(urunler) == 0
    final_msg = ""

    if speech_parts:
        final_msg = ". ".join(speech_parts) + ". "

    if not result.get("bitir") and not no_items:
        anything_else = tr("anything_else")
        final_msg += anything_else if anything_else != "anything_else" else "Başka bir şey ister misiniz?"
    elif no_items and not result.get("bitir"):
        not_understood = tr("not_understood")
        final_msg = not_understood if not_understood != "not_understood" else "Tam anlayamadım, tekrar eder misiniz?"

    if final_msg:
        tts_worker.speak(final_msg)

    # UI'a bildir
    try:
        eel.voiceOrderDone(get_cart())()
    except Exception:
        pass

    # Anlaşılmadıysa tekrar dinle
    if no_items and not result.get("bitir"):
        wait_ms = max(3.0, len(final_msg) * 0.075)
        threading.Timer(wait_ms, start_voice_order).start()


@eel.expose
def checkout(final_msg=""):
    """Siparişi tamamla."""
    if not _cart:
        tts_worker.speak(tr("cart_empty"))
        try:
            eel.orderComplete(False, "empty")()
        except Exception:
            pass
        return False # Added return False as per user's snippet implication

    if not _table_no:
        tts_worker.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
        try:
            eel.orderComplete(False, "no_table")()
        except Exception:
            pass
        return False

    success, total = api_client.submit_order(_table_no, _cart)

    if success:
        if final_msg:
            tts_worker.speak(final_msg)
        else:
            tts_worker.speak(
                tr("order_received").format(tutar=f"{total:.2f}", currency=tr("currency"))
            )

    _cart.clear()

    try:
        eel.orderComplete(success, f"{total:.2f}")()
    except Exception:
        pass


@eel.expose
def get_table_no():
    return _table_no


# ── QR & Table Checker Callback'leri ──────────────────

def _on_qr_found(table_no):
    global _table_no
    if _table_no != table_no:
        _table_no = table_no
        tts_worker.speak(tr("table_detected").format(masa_no=table_no))
        try:
            eel.tableChanged(table_no)()
        except Exception:
            pass


def _on_table_calling(table_id):
    """Masa çağrısı geldiğinde tetiklenir."""
    global _table_no
    
    # Robotu çağıran masaya otomatik odaklan
    if _table_no != table_id:
        _table_no = table_id
        try:
            eel.tableChanged(table_id)()
        except Exception:
            pass
            
    # Sesli bildirim
    msg = f"Table {table_id} is calling you!" if CURRENT_LANG == "EN" else f"Masa {table_id} sizi çağırıyor!"
    tts_worker.speak(msg)
    
    # Ekrana pop-up at
    try:
        eel.tableCalling(table_id, msg)()
    except Exception:
        pass


# ══════════════════════════════════════════════════════
# ANA GİRİŞ
# ══════════════════════════════════════════════════════

def main():
    # Eel başlat
    eel.init(os.path.join(BASE_DIR, "web"))

    # ── Ürün görsellerini /img/ yolundan sun ──────────
    import bottle
    @bottle.route("/img/<filepath:path>")
    def serve_image(filepath):
        return bottle.static_file(filepath, root=IMG_FOLDER)

    # Ollama ısınma (arka planda)
    threading.Thread(
        target=lambda: ollama.chat(model=MODEL_NAME, messages=[{"role": "user", "content": "init"}]),
        daemon=True,
    ).start()

    # QR Scanner
    qr = QRScanner(on_qr_found=_on_qr_found)
    qr.start()

    # Table Checker
    tc = TableChecker(on_table_calling=_on_table_calling)
    tc.start()

    print("🚀 Garson Robot başlatılıyor...")
    print("   Web UI: http://localhost:8686")

    # ── Platform algılama ─────────────────────────────
    import platform
    is_pi = platform.system() == "Linux" and ("aarch64" in platform.machine() or "arm" in platform.machine())

    if is_pi:
        # ── Raspberry Pi 5 + 13.3" Dokunmatik Ekran (1920x1080) ──
        print("   📟 Raspberry Pi algılandı — Kiosk modu aktif")
        try:
            eel.start(
                "index.html",
                size=(1920, 1080),
                port=8686,
                mode="chrome",      # Pi'de Chromium = "chrome"
                cmdline_args=[
                    "--kiosk",                    # Tam ekran, adres çubuğu yok
                    "--touch-events=enabled",     # Dokunmatik destek
                    "--disable-pinch",            # Pinch-to-zoom kapat (kiosk)
                    "--noerrdialogs",             # Hata diyaloglarını gizle
                    "--disable-infobars",         # Bilgi çubuklarını gizle
                    "--disable-translate",         # Çeviri pop-up kapat
                    "--overscroll-history-navigation=disabled",  # Swipe geri gitme kapat
                    "--check-for-update-interval=31536000",      # Güncelleme pop-up kapat
                ],
                block=True,
            )
        except (SystemExit, KeyboardInterrupt):
            pass
    else:
        # ── Masaüstü (Windows/Mac) — Geliştirme modu ─────
        for mode in ["edge", "chrome", "default"]:
            try:
                eel.start(
                    "index.html",
                    size=(1400, 900),
                    port=8686,
                    mode=mode,
                    block=True,
                )
                break
            except EnvironmentError:
                print(f"⚠️ {mode} bulunamadı, sonraki deniyor...")
                continue
            except (SystemExit, KeyboardInterrupt):
                break

    qr.stop()
    tc.stop()
    tts_worker.stop()
    print("Garson Robot kapatıldı.")


if __name__ == "__main__":
    main()
