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
    set_lang, tr, CURRENT_LANG, LANG,
    QR_ENABLED, DEFAULT_TABLE_NO
)
from services.api_client import APIClient
from services import llm_service
from workers.table_checker import TableChecker
from workers.tts_worker import TTSManager
from workers.stt_worker import STTManager
from core.robot_controller import RobotController

# ── Global Application Instance ───────────────────────
api_client = APIClient()
tts_manager = TTSManager()
stt_manager = STTManager()

def _on_status(msg):
    try: eel.updateStatus(msg)()
    except: pass

def _on_voice_done(cart_or_bool):
    try: eel.voiceOrderDone(cart_or_bool)()
    except: pass

def _on_order_complete(success, msg_or_total):
    try: eel.orderComplete(success, msg_or_total)()
    except: pass

app = RobotController(
    api_client=api_client,
    tts_manager=tts_manager,
    stt_manager=stt_manager,
    llm_service=llm_service,
    on_status_cb=_on_status,
    on_voice_done_cb=_on_voice_done,
    on_order_complete_cb=_on_order_complete
)

# ══════════════════════════════════════════════════════
# EEL EXPOSED FONKSİYONLAR  (JS → Python)
# ══════════════════════════════════════════════════════

@eel.expose
def set_language(lang_code):
    """Dili ayarla ve hoş geldin mesajı söyle."""
    set_lang(lang_code)
    print(f"LANGUAGE SET TO: {lang_code}")
    app.tts.speak(tr("bot_welcome"))
    return True

@eel.expose
def get_translations():
    """Aktif dilin tüm çevirilerini döndür."""
    from config import CURRENT_LANG, LANG
    return LANG.get(CURRENT_LANG, {})

@eel.expose
def get_menu():
    """Menüyü döndür (cache'li)."""
    menu = app.api.get_menu()
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
    return app.get_cart()

@eel.expose
def add_to_cart(name, price, product_id, quantity=1):
    """Sepete ürün ekle."""
    return app.add_to_cart(name, price, product_id, quantity)

@eel.expose
def update_cart_item(name, new_qty):
    """Sepetteki ürün miktarını güncelle."""
    return app.update_cart_item(name, new_qty)

@eel.expose
def remove_from_cart(name):
    """Sepetten ürün sil."""
    return app.remove_from_cart(name)

@eel.expose
def start_voice_order():
    """Sesli sipariş başlat."""
    return app.start_voice_order()

@eel.expose
def checkout(final_msg=""):
    """Siparişi tamamla."""
    app.checkout(final_msg)
    # The RobotController calls eel.orderComplete through the callback
    return False 

@eel.expose
def get_table_no():
    return app.get_table_number()


# ── QR & Table Checker Callback'leri ──────────────────

def _on_qr_found(table_no):
    if app.set_table_number(table_no):
        app.tts.speak(tr("table_detected").format(masa_no=table_no))
        try: eel.tableChanged(table_no)()
        except: pass


def _on_table_calling(table_id):
    """Masa çağrısı geldiğinde tetiklenir."""
    # Robotu çağıran masaya otomatik odaklan
    if app.set_table_number(table_id):
        try: eel.tableChanged(table_id)()
        except: pass
            
    # Sesli bildirim
    msg = f"Table {table_id} is calling you!" if CURRENT_LANG == "EN" else f"Masa {table_id} sizi çağırıyor!"
    app.tts.speak(msg)
    
    # Ekrana pop-up at
    try: eel.tableCalling(table_id, msg)()
    except: pass


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

    # QR Scanner (kamera yoksa config.json -> "qr_enabled": false yap)
    qr = None
    if QR_ENABLED:
        try:
            from workers.qr_worker import QRScanner
            qr = QRScanner(on_qr_found=_on_qr_found)
            qr.start()
            print("📷 QR okuyucu aktif.")
        except Exception as e:
            print(f"⚠️ QR okuyucu başlatılamadı: {e}")
    else:
        print("ℹ️ QR okuyucu config ile devre dışı (qr_enabled=false).")

    # Table Checker
    tc = TableChecker(api_client=api_client, on_table_calling=_on_table_calling)
    tc.start()

    # QR kapalıyken sipariş akışının kilitlenmemesi için varsayılan masa
    if DEFAULT_TABLE_NO and app.get_table_number() is None:
        if app.set_table_number(DEFAULT_TABLE_NO):
            print(f"ℹ️ Varsayılan masa atandı: {DEFAULT_TABLE_NO}")

    print("🚀 Garson Robot başlatılıyor...")
    print("   Web UI: http://localhost:8686")

    # ── Platform algılama ─────────────────────────────
    import platform
    is_pi = platform.system() == "Linux" and ("aarch64" in platform.machine() or "arm" in platform.machine())

    if is_pi:
        # ── Raspberry Pi 5 + 13.3" Dokunmatik Ekran (1920x1080) ──
        print("   📟 Raspberry Pi algılandı — Kiosk modu aktif")
        for mode in ["chrome", "chromium", "default"]:
            try:
                eel.start(
                    "index.html",
                    size=(1920, 1080),
                    port=8686,
                    mode=mode,
                    cmdline_args=[
                        "--kiosk",                    # Tam ekran, adres çubuğu yok
                        "--touch-events=enabled",     # Dokunmatik destek
                        "--disable-pinch",            # Pinch-to-zoom kapat (kiosk)
                        "--noerrdialogs",             # Hata diyaloglarını gizle
                        "--disable-infobars",         # Bilgi çubuklarını gizle
                        "--disable-translate",        # Çeviri pop-up kapat
                        "--overscroll-history-navigation=disabled",  # Swipe geri gitme kapat
                        "--check-for-update-interval=31536000",      # Güncelleme pop-up kapat
                    ],
                    block=True,
                )
                break
            except EnvironmentError:
                print(f"⚠️ {mode} bulunamadı, sonraki mod deneniyor...")
                continue
            except (SystemExit, KeyboardInterrupt):
                break
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

    if qr:
        qr.stop()
    tc.stop()
    app.shutdown()
    print("Garson Robot kapatıldı.")


if __name__ == "__main__":
    main()
