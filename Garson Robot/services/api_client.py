"""
Garson Robot — API Client
Backend (Spring Boot) ile iletişim + menü cache.
"""
import time
import requests
from config import API_PRODUCTS_URL, API_ORDERS_URL, API_TABLES_URL

# ── Menü Cache ────────────────────────────────────────
_menu_cache = []
_menu_cache_ts = 0
CACHE_TTL = 30  # saniye


def get_menu(force=False):
    """
    Backend'den menüyü çeker, CACHE_TTL süresince cache kullanır.
    Dönen format: [(id, ad, fiyat, stok), ...]
    """
    global _menu_cache, _menu_cache_ts
    now = time.time()
    if not force and _menu_cache and (now - _menu_cache_ts) < CACHE_TTL:
        return _menu_cache
    try:
        res = requests.get(API_PRODUCTS_URL, timeout=3)
        if res.status_code == 200:
            data = res.json()
            _menu_cache = [(item.get("id"), item.get("name", "Bilinmeyen"), item.get("price", 0.0), item.get("stock", 0)) for item in data]
            _menu_cache_ts = now
    except Exception as e:
        print(f"Menü backendden alınamadı: {e} | URL: {API_PRODUCTS_URL}")
    return _menu_cache


def find_product(name):
    """
    İsme göre ürün bul. Önce tam eşleşme, sonra kelime bazlı.
    Dönen: (id, ad, fiyat, stok) veya None
    """
    menu = get_menu()
    # Tam eşleşme
    for u in menu:
        if u[1].lower() == name.lower():
            return u
    # Kelime bazlı
    for word in name.split():
        if len(word) > 2:
            for u in menu:
                if word.lower() in u[1].lower():
                    return u
    return None


def submit_order(table_no, cart):
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
        res = requests.post(API_ORDERS_URL, json=payload, timeout=3)
        if res.status_code in [200, 201]:
            print("✅ Sipariş başarıyla iletildi.")
            return True, total
        else:
            print(f"⚠️ Backend Hatası: {res.status_code} - {res.text}")
            return False, total
    except Exception as e:
        print(f"❌ Bağlantı Hatası: {e}")
        return False, total


def get_calling_tables():
    """CALLING_ROBOT durumundaki masaları döndür."""
    try:
        res = requests.get(API_TABLES_URL, timeout=3)
        if res.status_code == 200:
            tables = res.json()
            return [str(t.get("id")) for t in tables if t.get("status") == "CALLING_ROBOT"]
    except:
        pass
    return []
