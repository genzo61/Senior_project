"""
Garson Robot — API Client
Backend (Spring Boot) ile iletişim + menü cache.
"""
import time
import requests
from config import API_PRODUCTS_URL, API_ORDERS_URL, API_TABLES_URL


class APIClient:
    def __init__(self, products_url=API_PRODUCTS_URL, orders_url=API_ORDERS_URL, tables_url=API_TABLES_URL, cache_ttl=30):
        self.products_url = products_url
        self.orders_url = orders_url
        self.tables_url = tables_url
        self.cache_ttl = cache_ttl
        
        self._menu_cache = []
        self._menu_cache_ts = 0

    def get_menu(self, force=False):
        """
        Backend'den menüyü çeker, CACHE_TTL süresince cache kullanır.
        Dönen format: [(id, ad, fiyat, stok), ...]
        """
        now = time.time()
        if not force and self._menu_cache and (now - self._menu_cache_ts) < self.cache_ttl:
            return self._menu_cache
            
        try:
            res = requests.get(self.products_url, timeout=3)
            if res.status_code == 200:
                data = res.json()
                self._menu_cache = [(item.get("id"), item.get("name", "Bilinmeyen"), float(item.get("price", 0.0)), int(item.get("stock", 0))) for item in data]
                self._menu_cache_ts = now
        except Exception as e:
            print(f"Menü backendden alınamadı: {e} | URL: {self.products_url}")
            
        return self._menu_cache

    def find_product(self, name, force=False):
        """
        İsme göre ürün bul. Önce tam eşleşme, sonra kelime bazlı.
        Dönen: (id, ad, fiyat, stok) veya None
        """
        menu = self.get_menu(force=force)
        search_name = name.strip().lower()
        
        # Tam eşleşme
        for u in menu:
            if u[1].strip().lower() == search_name:
                return u
                
        # Kelime bazlı (Kısmi Eşleşme)
        for u in menu:
            db_name = u[1].strip().lower()
            if search_name in db_name or db_name in search_name:
                return u
                
        # Tek kelime eşleşmesi
        for word in search_name.split():
            if len(word) > 2:
                for u in menu:
                    if word in u[1].strip().lower():
                        return u
        return None

    def submit_order(self, table_no, cart):
        """
        Siparişi backend'e gönder.
        cart: {ad: {fiyat: float, adet: int, id: int}, ...}
        """
        items = []
        total = 0
        for ad, veri in cart.items():
            total += veri["fiyat"] * veri["adet"]
            items.append({"productName": ad, "quantity": veri["adet"]})

        payload = {"tableNo": table_no, "items": items}
        print(f"BACKEND'E GİDEN (POST): {payload}")

        try:
            res = requests.post(self.orders_url, json=payload, timeout=3)
            if res.status_code in [200, 201]:
                print("✅ Sipariş başarıyla iletildi.")
                return True, total
            else:
                print(f"⚠️ Backend Hatası: {res.status_code} - {res.text}")
                return False, total
        except Exception as e:
            print(f"❌ Bağlantı Hatası: {e}")
            return False, total

    def get_calling_tables(self):
        """CALLING_ROBOT durumundaki masaları döndür."""
        try:
            res = requests.get(self.tables_url, timeout=3)
            if res.status_code == 200:
                tables = res.json()
                return [str(t.get("id")) for t in tables if t.get("status") == "CALLING_ROBOT"]
        except:
            pass
        return []
