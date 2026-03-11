import threading
from config import tr, LANG, CURRENT_LANG

class RobotController:
    """
    Kullanıcı arayüzü, sepet ve iş mantığını yöneten ana sınıf.
    """
    def __init__(self, api_client, tts_manager, stt_manager, llm_service, on_status_cb=None, on_voice_done_cb=None, on_order_complete_cb=None):
        self.api = api_client
        self.tts = tts_manager
        self.stt = stt_manager
        self.llm = llm_service
        
        # UI Callbacks
        self.on_status_cb = on_status_cb
        self.on_voice_done_cb = on_voice_done_cb
        self.on_order_complete_cb = on_order_complete_cb

        # State Variables
        self._cart = {}          # {ad: {"fiyat": float, "adet": int, "id": int}}
        self._table_no = None    
        self._is_listening = False
        self._speech_timer = None

    def get_cart(self):
        return {
            "items": self._cart,
            "total": sum(v["fiyat"] * v["adet"] for v in self._cart.values()),
            "tableNo": self._table_no,
        }

    def set_table_number(self, table_no):
        """Masa numarasını güncelle, değişirse true döndür."""
        if self._table_no != table_no:
            self._table_no = table_no
            return True
        return False

    def get_table_number(self):
        return self._table_no

    def add_to_cart(self, name, price, product_id, quantity=1):
        """Sepete ürün ekle."""
        if not self._table_no:
            self.tts.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
            return {"success": False, "reason": "no_table"}

        info = self.api.find_product(name)
        stock = info[3] if info else 0
        current_qty = self._cart.get(name, {}).get("adet", 0)

        if current_qty + quantity > stock:
            # Önbellek eski kalmış olabilir, veritabanından taze menü çekip tekrar stok kontrolü yap
            info = self.api.find_product(name, force=True)
            stock = info[3] if info else 0
            if current_qty + quantity > stock:
                self.tts.speak(f"{name} {tr('no_stock') if 'no_stock' in LANG[CURRENT_LANG] else 'stokta kalmadı'}")
                return {"success": False, "reason": "no_stock"}

        if name in self._cart:
            self._cart[name]["adet"] += quantity
        else:
            self._cart[name] = {"fiyat": price, "adet": quantity, "id": product_id}

        return {"success": True, "cart": self.get_cart()}

    def update_cart_item(self, name, new_qty):
        """Sepetteki ürün miktarını güncelle."""
        if name not in self._cart:
            return self.get_cart()
        if new_qty <= 0:
            del self._cart[name]
        else:
            info = self.api.find_product(name)
            stock = info[3] if info else 0
            if new_qty > stock:
                return self.get_cart()
            self._cart[name]["adet"] = new_qty
        return self.get_cart()

    def remove_from_cart(self, name):
        """Sepetten ürün sil."""
        if name in self._cart:
            del self._cart[name]
        return self.get_cart()

    def checkout(self, final_msg=""):
        """Siparişi tamamla."""
        if not self._cart:
            self.tts.speak(tr("cart_empty"))
            if self.on_order_complete_cb:
                self.on_order_complete_cb(False, "empty")
            return False

        if not self._table_no:
            self.tts.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
            if self.on_order_complete_cb:
                self.on_order_complete_cb(False, "no_table")
            return False

        success, total = self.api.submit_order(self._table_no, self._cart)

        if success:
            if final_msg:
                self.tts.speak(final_msg)
            else:
                self.tts.speak(tr("order_received").format(tutar=f"{total:.2f}", currency=tr("currency")))

        self._cart.clear()

        if self.on_order_complete_cb:
            self.on_order_complete_cb(success, f"{total:.2f}")
            
        return success

    def start_voice_order(self):
        """Sesli sipariş başlat (STT)."""
        if not self._table_no:
            self.tts.speak(tr("qr_scan_prompt") if "qr_scan_prompt" in LANG[CURRENT_LANG] else "Önce masadaki karekodu okutmalısınız.")
            if self.on_voice_done_cb:
                self.on_voice_done_cb(False)
            return {"status": "no_table"}

        if self._is_listening:
            return {"status": "already_listening"}
            
        self._is_listening = True

        def _on_result(text):
            self._is_listening = False
            if not text:
                if self.on_status_cb:
                    self.on_status_cb(tr("no_voice"))
                if self.on_voice_done_cb:
                    self.on_voice_done_cb(None)
                return

            if self.on_status_cb:
                self.on_status_cb(tr("detected") + f" {text}")

            # LLM Analizi
            menu = self.api.get_menu()
            result = self.llm.analyze(text, menu)
            self._process_llm_result(result)

        self.stt.listen_async(on_status=self.on_status_cb, on_result=_on_result)
        return {"status": "started"}

    def _process_llm_result(self, result):
        """LLM sonucunu uygula: sepete ekle/çıkar, konuş."""
        if result.get("bitir"):
            self.checkout()
            return

        speech_parts = []
        urunler = result.get("urunler", [])

        for u in urunler:
            try:
                ad = u["ad"].replace("'", "").strip()
                adet = int(u.get("adet", 1))
                islem = u.get("islem", "ekle")

                info = self.api.find_product(ad)
                if info:
                    if islem == "cikar":
                        if ad in self._cart:
                            new_qty = self._cart[ad]["adet"] - adet
                            if new_qty <= 0:
                                del self._cart[ad]
                            else:
                                self._cart[ad]["adet"] = new_qty
                    else:
                        # self.add_to_cart contains the stock check and TTS warning
                        res = self.add_to_cart(info[1], info[2], info[0], adet)
                        if res.get("success"):
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
            self.tts.speak(final_msg)

        # UI'a bildir
        if self.on_voice_done_cb:
            self.on_voice_done_cb(self.get_cart())

        # Anlaşılmadıysa tekrar dinle
        if no_items and not result.get("bitir"):
            wait_ms = max(3.0, len(final_msg) * 0.075)
            self._speech_timer = threading.Timer(wait_ms, self.start_voice_order)
            self._speech_timer.start()

    def shutdown(self):
        """Uygulama kapanırken temizlik."""
        if self._speech_timer:
            self._speech_timer.cancel()
        self.tts.stop()
