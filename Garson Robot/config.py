"""
Garson Robot — Config & Language Manager
Tüm ayarlar ve dil çeviri fonksiyonları burada.
"""
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Config ────────────────────────────────────────────
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
try:
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        CONFIG = json.load(f)
except Exception as e:
    print(f"Config yüklenemedi: {e}")
    CONFIG = {}

DB_FILE = os.path.join(BASE_DIR, CONFIG.get("db_name", "restoran.db"))
MODEL_NAME = CONFIG.get("llm_model", "llama3.2:3b")
IMG_FOLDER = os.path.join(BASE_DIR, CONFIG.get("image_folder", "img"))
API_BASE = CONFIG.get("api_url", "http://127.0.0.1:8085/api/orders").rsplit("/", 1)[0]
API_ORDERS_URL = CONFIG.get("api_url", "http://127.0.0.1:8085/api/orders")
API_PRODUCTS_URL = f"{API_BASE}/products"
API_TABLES_URL = f"{API_BASE}/tables"
CAMERA_ID = CONFIG.get("camera_id", 0)
QR_DELAY = CONFIG.get("qr_delay", 5)
QR_ENABLED = bool(CONFIG.get("qr_enabled", True))
DEFAULT_TABLE_NO = str(CONFIG.get("default_table_no", "")).strip()
LLM_TEMPERATURE = CONFIG.get("llm_temperature", 0.0)

# ── Language ──────────────────────────────────────────
LOCALES_FILE = os.path.join(BASE_DIR, "locales.json")
try:
    with open(LOCALES_FILE, "r", encoding="utf-8") as f:
        LANG = json.load(f)
except Exception as e:
    print(f"Dil dosyası yüklenemedi: {e}")
    LANG = {"TR": {}, "EN": {}}

CURRENT_LANG = "TR"


def set_lang(code: str):
    """Aktif dili değiştir."""
    global CURRENT_LANG
    CURRENT_LANG = code


def tr(key: str) -> str:
    """Aktif dildeki çeviriyi döndür."""
    return LANG.get(CURRENT_LANG, {}).get(key, key)
