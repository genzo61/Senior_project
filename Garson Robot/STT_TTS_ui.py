import sys
import sqlite3
import threading
import os
import re
import json
import time
import subprocess
import socket
import random
import queue
import threading
import uuid
import json

# Gerekli Kütüphaneler
import speech_recognition as sr
import pygame
import ollama
import cv2
from pyzbar.pyzbar import decode

# Fix for qtawesome picking up wrong Qt binding (e.g. PyQt5 instead of PyQt6)
os.environ["QT_API"] = "pyqt6"

try:
    import qtawesome as qta
except ImportError:
    print("qtawesome not found! run: pip install qtawesome")
    qta = None 

from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QGridLayout, QPushButton, QLabel, 
                             QListWidget, QListWidgetItem, QFrame, QScrollArea,
                             QSizePolicy, QGraphicsDropShadowEffect, QSpacerItem, 
                             QGraphicsOpacityEffect, QStackedWidget, QDialog, QLineEdit, QComboBox)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize, QPropertyAnimation, QEasingCurve, QRect, QPoint
from PyQt6.QtGui import QIcon, QFont, QColor, QPixmap, QImage, QPainter, QPainterPath, QLinearGradient, QBrush, QPen

# --- AYARLAR ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Dinamik Ayarları Yükle
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
try:
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        CONFIG = json.load(f)
except Exception as e:
    print(f"Config yüklenemedi: {e}")
    CONFIG = {}

DB_FILE = os.path.join(BASE_DIR, CONFIG.get("db_name", "restoran.db"))
MODEL_NAME = CONFIG.get("llm_model", "llama3.2:3b")
IMG_KLASORU = os.path.join(BASE_DIR, CONFIG.get("image_folder", "img"))
API_URL = CONFIG.get("api_url", "http://localhost:8085/api/orders")
API_BASE_URL = CONFIG.get("api_base_url", "http://localhost:8085")
SES_DOSYASI = "gecici_ses.mp3" 

MUTFAK_IP = CONFIG.get("mutfak_ip", "127.0.0.1")
MUTFAK_PORT = CONFIG.get("mutfak_port", 65432)

try: pygame.mixer.init(frequency=24000)
except: pass

# --------------------------------------------------
# DİL YÖNETİCİSİ (LANGUAGE MANAGER)
# --------------------------------------------------
LOCALES_FILE = os.path.join(BASE_DIR, "locales.json")
try:
    with open(LOCALES_FILE, "r", encoding="utf-8") as f:
        LANG = json.load(f)
except Exception as e:
    print(f"Dil dosyası yüklenemedi: {e}")
    LANG = {"TR": {}, "EN": {}}

CURRENT_LANG = "TR"

def tr(key):
    return LANG[CURRENT_LANG].get(key, key)

# --------------------------------------------------
# LLM & LOGIC
# --------------------------------------------------
def llm_ile_analiz_et(metin, menu_listesi):
    menu_isimleri = ", ".join([str(urun[1]) for urun in menu_listesi if urun[1] is not None])
    print(f"\n📝 ALGILANAN SES ({CURRENT_LANG}): {metin}")
    metin_lower = metin.lower()
    
    import datetime
    su_an = datetime.datetime.now()
    saat_bilgisi = su_an.strftime("%H:%M")
    zaman_anahtari = "morning" if 6 <= su_an.hour < 11 else "noon" if 11 <= su_an.hour < 22 else "night"
    zaman_mesaji = tr(zaman_anahtari)

    # Prompt dosyasını oku
    prompt_file = os.path.join(BASE_DIR, "prompts", f"prompt_{CURRENT_LANG.lower()}.txt")
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            sys_prompt_template = f.read()
    else:
        sys_prompt_template = "Müşteri: {metin}" # Fallback
        
    sys_prompt = sys_prompt_template.format(
        saat_bilgisi=saat_bilgisi,
        zaman_mesaji=zaman_mesaji,
        menu_isimleri=menu_isimleri,
        metin=metin
    )

    try:
        response = ollama.chat(
            model=MODEL_NAME, 
            messages=[{'role': 'user', 'content': sys_prompt}],
            format='json',
            options={'temperature': CONFIG.get("llm_temperature", 0.0)}
        )
        
        # Parse output from the Strict Parser model
        raw_content = response['message']['content'].strip()
        # In case the model wraps the response in markdown blocks
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.startswith("```"):
            raw_content = raw_content[3:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
            
        data = json.loads(raw_content.strip())
        intent = data.get("intent", "none")
        items = data.get("items", [])
        
        # Map back to old expected format
        mapped_data = {
            "urunler": [],
            "bitir": (intent == "checkout"),
            "mesaj": "" # Dynamically generated downstream
        }
        
        for item in items:
            mapped_data["urunler"].append({
                "ad": item.get("name", ""),
                "adet": item.get("quantity", 1),
                "islem": "cikar" if intent == "remove" else "ekle"
            })
            
        # Fallback to keyword matching if LLM failed to catch checkout
        finish = LANG[CURRENT_LANG].get("finish_words", [])
        if not mapped_data["bitir"] and any(k in metin_lower for k in finish):
            mapped_data["bitir"] = True
            mapped_data["urunler"] = []
            
        return mapped_data

    except Exception as e:
        print(f"❌ LLM HATASI: {e}")
        return {"urunler": [], "bitir": False, "mesaj": ""}

class QRScannerThread(QThread):
    qr_bulundu = pyqtSignal(str)

    def __init__(self):
        super().__init__()
        self.calisiyor = True

    def run(self):
        try:
            cap = cv2.VideoCapture(CONFIG.get("camera_id", 0))
            if not cap.isOpened():
                print("⚠️ Kamera açılamadı, QR okuyucu devre dışı.")
                return
            
            while self.calisiyor:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.5)
                    continue
                
                decoded_objects = decode(frame)
                for obj in decoded_objects:
                    data = obj.data.decode('utf-8')
                    if "TABLE:" in data.upper():
                        masa_no = data.upper().split("TABLE:")[1].strip()
                        self.qr_bulundu.emit(masa_no)
                        time.sleep(5)
                    elif data.isdigit() and len(data) <= 2:
                        self.qr_bulundu.emit(data.zfill(2))
                        time.sleep(5)
                        
                time.sleep(0.2)
                
            cap.release()
        except Exception as e:
            print(f"❌ QR Tarayıcı Hatası: {e}")

    def stop(self):
        self.calisiyor = False
        self.quit()
        self.wait()

class SpeechManager(QThread):
    def __init__(self):
        super().__init__()
        self.queue = queue.Queue()
        self.calisiyor = True
        self._lock = threading.Lock()

    def run(self):
        while self.calisiyor:
            try:
                metin = self.queue.get(timeout=1)
                self._konus_fiziksel(metin)
                self.queue.task_done()
            except queue.Empty:
                continue

    def stop(self):
        self.calisiyor = False
        self.wait()

    def add_to_queue(self, metin):
        self.queue.put(metin)

    def _konus_fiziksel(self, metin):
        try:
            print(f"🔊 Robot ({CURRENT_LANG}): {metin}")
            
            # Stop current music if busy
            if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                try: pygame.mixer.music.unload() 
                except: pass

            # Clean old speech files
            for dosya in os.listdir(BASE_DIR):
                if dosya.startswith("konusma_") and dosya.endswith(".mp3"):
                    try: os.remove(os.path.join(BASE_DIR, dosya))
                    except: pass

            dosya_ismi = os.path.join(BASE_DIR, f"konusma_{int(time.time())}_{random.randint(100,999)}.mp3")
            voice = tr("voice")
            
            komut = f'edge-tts --voice {voice} --text "{metin}" --write-media "{dosya_ismi}" --rate=+25%'
            subprocess.run(komut, shell=True, check=True)
            
            time.sleep(0.2)
            if os.path.exists(dosya_ismi):
                pygame.mixer.music.load(dosya_ismi)
                pygame.mixer.music.play()
                # Wait until audio finishes or timeout
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
        except Exception as e:
            print(f"❌ SES HATASI: {e}")

_speech_manager = None

def robot_konus(metin):
    global _speech_manager
    if _speech_manager is None:
        _speech_manager = SpeechManager()
        _speech_manager.start()
    _speech_manager.add_to_queue(metin)


class Veritabani:
    def __init__(self):
        # Artık lokal SQLite yerine REST API kullanılacak. Tablo oluşturmaya gerek yok.
        pass

    def baglan(self): pass
    def kapat(self): pass
    
    def tablo_olustur(self):
        pass

    def menu_getir(self):
        # Backend'den menüyü çek
        import requests
        cache_file = os.path.join(BASE_DIR, "menu_cache.json")
        
        try:
            res = requests.get(f"{API_BASE_URL}/api/products", timeout=3)
            if res.status_code == 200:
                data = res.json()
                # Save to cache
                try:
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=4)
                except: pass
                
                # Arayüzün beklediği format: [(id, ad, fiyat, stok), ...]
                return [(item['id'], item['name'], item['price'], item['stock']) for item in data]
        except Exception as e:
            print(f"Menü backendden alınamadı: {e}")
            
        # Fallback to cache if exists
        if os.path.exists(cache_file):
            print("📦 Menü yerel cache'den yükleniyor...")
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return [(item['id'], item['name'], item['price'], item['stock']) for item in data]
            except: pass
            
        return []

    def stok_ve_fiyat_bilgisi_akilli(self, urun_adi):
        menu = self.menu_getir()
        for u in menu:
            if u[1].lower() == urun_adi.lower(): return u
        
        # Kelime bazlı arama
        kelimeler = urun_adi.split()
        for u in menu:
            for kelime in kelimeler:
                if len(kelime) > 2 and kelime.lower() in u[1].lower():
                    return u
        return None

    def stogu_dus(self, urun_id, adet):
        import requests
        # Arayüzdeki ürün bilgisini alarak güncel stoğu hesaplayıp PUT isteği at
        # STT_TTS_ui sınıfındaki 'sepet' üzerinden alınan bilgiyle stok düşme işi Backend üzerinden yönetilmeli
        # Bu fonksiyon geçici olarak kullanımsız bırakılabilir çünkü sipariş tamamlandığında Backend (Java) siparişleri alıyor.
        # Java'da sipariş eklendiğinde OrderService'in stokları kendisinin düşmesi daha mantıklı. (Sonraki adım)
        pass

class SesWorker(QThread):
    sonuc_sinyali = pyqtSignal(str); durum_sinyali = pyqtSignal(str)
    def run(self):
        r = sr.Recognizer(); r.pause_threshold = 2.0
        lang_code = tr("speech_lang")
        try:
            with sr.Microphone() as source:
                r.adjust_for_ambient_noise(source, duration=0.5)
                self.durum_sinyali.emit(tr("listening"))
                # phrase_time_limit'i 5 saniyeden 15 saniyeye çıkarıyoruz, timeout'u 8 saniye yapıyoruz.
                # Böylece müşteri düşünürken veya uzun sipariş verirken kesilmemiş olur.
                audio = r.listen(source, timeout=8, phrase_time_limit=15)
                self.durum_sinyali.emit(tr("processing"))
                text = r.recognize_google(audio, language=lang_code)
                self.sonuc_sinyali.emit(text)
        except:
            self.durum_sinyali.emit(tr("no_voice")); self.sonuc_sinyali.emit("") 

class LLMWorker(QThread):
    islem_bitti_sinyali = pyqtSignal(dict)
    def __init__(self, metin, menu): super().__init__(); self.metin=metin; self.menu=menu
    def run(self): self.islem_bitti_sinyali.emit(llm_ile_analiz_et(self.metin, self.menu))

# --------------------------------------------------
# WIDGETS
# --------------------------------------------------

class SidebarButton(QPushButton):
    def __init__(self, icon_name, text_key, parent=None):
        super().__init__(parent)
        self.text_key = text_key
        self.setFixedSize(60, 60)
        self.update_text() # Set tooltip
        if qta:
            self.setIcon(qta.icon(icon_name, color='white'))
            self.setIconSize(QSize(28, 28))
        else: self.setText(tr(text_key)[:1])
        
        self.setStyleSheet("""
            QPushButton { background-color: transparent; border: none; border-radius: 15px; }
            QPushButton:hover { background-color: rgba(255, 255, 255, 0.2); }
            QPushButton:pressed { background-color: rgba(255, 255, 255, 0.4); }
        """)

    def update_text(self):
        self.setToolTip(tr(self.text_key))

class ImpressiveUrunKarti(QWidget):
    tiklandi = pyqtSignal(str, float, int) 
    def __init__(self, ad, fiyat, stok, urun_id):
        super().__init__()
        self.ad = ad; self.fiyat = fiyat; self.id = urun_id; self.stok = stok
        self.setFixedSize(220, 320)
        self.container = QFrame(self); self.container.setGeometry(10, 10, 200, 300)
        self.container.setStyleSheet("QFrame { background-color: white; border-radius: 25px; }")
        shadow = QGraphicsDropShadowEffect(self); shadow.setBlurRadius(20); shadow.setColor(QColor(0, 0, 0, 40)); shadow.setOffset(0, 5)
        self.container.setGraphicsEffect(shadow)
        layout = QVBoxLayout(self.container); layout.setContentsMargins(0, 0, 0, 0); layout.setSpacing(0)
        self.img_label = QLabel()
        self.img_label.setFixedSize(200, 180)
        self.img_label.setStyleSheet("border-top-left-radius: 25px; border-top-right-radius: 25px;")
        self.img_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        resim_yolu = os.path.join(IMG_KLASORU, f"{ad}.png")
        if os.path.exists(resim_yolu):
            pixmap = QPixmap(resim_yolu)
            self.img_label.setPixmap(pixmap.scaled(200, 180, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
        else:
            self.img_label.setText(ad[:2].upper())
            self.img_label.setStyleSheet("QLabel { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #ff9ff3, stop:1 #feca57); color: white; font-size: 40px; font-weight: bold; border-top-left-radius: 25px; border-top-right-radius: 25px; }")
        layout.addWidget(self.img_label)
        info_widget = QWidget()
        info_lay = QVBoxLayout(info_widget); info_lay.setContentsMargins(15, 10, 15, 20)
        self.lbl_ad = QLabel(ad); self.lbl_ad.setStyleSheet("font-size: 18px; font-weight: 800; color: #341f97; font-family: 'Segoe UI';"); self.lbl_ad.setWordWrap(True); self.lbl_ad.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.lbl_fiyat = QLabel(f"{fiyat} {tr('currency')}"); self.lbl_fiyat.setStyleSheet("font-size: 16px; font-weight: bold; color: #ff6b6b;"); self.lbl_fiyat.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_lay.addWidget(self.lbl_ad); info_lay.addWidget(self.lbl_fiyat); layout.addWidget(info_widget)
        self.fab = QPushButton(self); self.fab.setGeometry(160, 150, 50, 50)
        if qta: self.fab.setIcon(qta.icon('fa5s.plus', color='white')); self.fab.setIconSize(QSize(20, 20))
        else: self.fab.setText("+")
        if stok > 0:
            self.fab.setCursor(Qt.CursorShape.PointingHandCursor); self.fab.setStyleSheet("QPushButton { background-color: #ff6b6b; border-radius: 25px; border: 4px solid white; color: white; font-weight: bold; font-size: 20px; } QPushButton:hover { background-color: #ee5253; } QPushButton:pressed { background-color: #d63031; }")
            self.fab.clicked.connect(self.animate_click)
        else:
            self.fab.hide(); lbl_tukendi = QLabel(tr("no_stock"), self.img_label); lbl_tukendi.setGeometry(0, 70, 200, 40); lbl_tukendi.setAlignment(Qt.AlignmentFlag.AlignCenter); lbl_tukendi.setStyleSheet("background-color: rgba(0,0,0,0.6); color: white; font-weight: bold; font-size: 18px;")
    
    def update_lang(self):
         self.lbl_fiyat.setText(f"{self.fiyat} {tr('currency')}")

    def animate_click(self):
        self.anim = QPropertyAnimation(self.fab, b"geometry"); start = self.fab.geometry(); self.anim.setDuration(100); self.anim.setStartValue(start); self.anim.setEndValue(QRect(start.x()+5, start.y()+5, start.width()-10, start.height()-10)); self.anim.setEasingCurve(QEasingCurve.Type.OutQuad); self.anim.finished.connect(lambda: self.fab.setGeometry(start)); self.anim.start(); self.tiklandi.emit(self.ad, self.fiyat, self.id)

class ReceiptCartItem(QWidget):
    sil_sinyali = pyqtSignal(str); adet_degisti_sinyali = pyqtSignal(str, int) 
    def __init__(self, ad, fiyat, adet):
        super().__init__()
        self.ad = ad; self.fiyat = fiyat; self.adet = adet
        layout = QHBoxLayout(self); layout.setContentsMargins(5, 5, 5, 10)
        self.icon_lbl = QLabel(); self.icon_lbl.setFixedSize(40, 40); self.icon_lbl.setStyleSheet("background-color: #f1f2f6; border-radius: 10px; color: #576574; font-weight: bold; font-size: 16px;"); self.icon_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter); self.icon_lbl.setText(f"{adet}x"); layout.addWidget(self.icon_lbl)
        text_lay = QVBoxLayout(); lbl_name = QLabel(ad); lbl_name.setStyleSheet("font-weight: bold; color: #2d3436; font-size: 14px;")
        self.lbl_price = QLabel(f"{fiyat * adet} {tr('currency')}"); self.lbl_price.setStyleSheet("color: #ff6b6b; font-weight: bold;")
        text_lay.addWidget(lbl_name); text_lay.addWidget(self.lbl_price); layout.addLayout(text_lay); layout.addStretch()
        btn_minus = QPushButton("-"); btn_minus.setFixedSize(30, 30); btn_minus.setCursor(Qt.CursorShape.PointingHandCursor); btn_minus.setStyleSheet("background-color: #fff; border: 1px solid #dcdde1; border-radius: 15px; color: #7f8c8d; font-weight: bold;"); btn_minus.clicked.connect(self.azalt); layout.addWidget(btn_minus)
        btn_plus = QPushButton("+"); btn_plus.setFixedSize(30, 30); btn_plus.setCursor(Qt.CursorShape.PointingHandCursor); btn_plus.setStyleSheet("background-color: #5f27cd; border-radius: 15px; color: white; font-weight: bold;"); btn_plus.clicked.connect(self.arttir); layout.addWidget(btn_plus)
    def azalt(self):
        if self.adet > 1: self.adet_degisti_sinyali.emit(self.ad, self.adet - 1)
        else: self.sil_sinyali.emit(self.ad)
    def arttir(self): self.adet_degisti_sinyali.emit(self.ad, self.adet + 1)

class OrderReviewModal(QDialog):
    def __init__(self, items, table_id, parent=None):
        super().__init__(parent)
        self.items = items # list of dict: {"name": ad, "qty": adet, "id": id}
        self.table_id = table_id
        self.setWindowTitle(tr("review_title") if tr("review_title") != "review_title" else "Sipariş Onayı")
        self.setFixedSize(500, 600)
        self.setStyleSheet("background-color: #f8f9fa; border-radius: 15px;")
        
        layout = QVBoxLayout(self)
        
        title = QLabel(tr("review_header") if tr("review_header") != "review_header" else "Siparişinizi Kontrol Edin")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: #2d3436; margin-bottom: 10px;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Table ID Section
        table_lay = QHBoxLayout()
        table_lay.addWidget(QLabel(tr("table_no")))
        self.table_input = QLineEdit(str(table_id))
        self.table_input.setStyleSheet("padding: 8px; border: 1px solid #dcdde1; border-radius: 8px; font-size: 18px; font-weight: bold;")
        self.table_input.textChanged.connect(self.validate_input)
        table_lay.addWidget(self.table_input)
        layout.addLayout(table_lay)
        
        # Items List
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: none; background: white; border-radius: 10px;")
        self.scroll_content = QWidget()
        self.items_layout = QVBoxLayout(self.scroll_content)
        self.items_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        scroll.setWidget(self.scroll_content)
        layout.addWidget(scroll)
        
        self.update_items_ui()
        
        # Buttons
        btn_lay = QHBoxLayout()
        btn_cancel = QPushButton(tr("cancel") if tr("cancel") != "cancel" else "İptal")
        btn_cancel.setStyleSheet("background-color: #dfe6e9; color: #2d3436; padding: 15px; border-radius: 10px; font-weight: bold;")
        btn_cancel.clicked.connect(self.reject)
        
        btn_lay.addWidget(btn_cancel)
        self.btn_send = QPushButton(tr("send_order") if tr("send_order") != "send_order" else "Gönder")
        self.btn_send.setStyleSheet("QPushButton { background-color: #5f27cd; color: white; padding: 15px; border-radius: 10px; font-weight: bold; font-size: 18px; } QPushButton:disabled { background-color: #dfe6e9; color: #b2bec3; }")
        self.btn_send.clicked.connect(self.accept)
        btn_lay.addWidget(self.btn_send)
        layout.addLayout(btn_lay)

    def validate_input(self):
        text = self.table_input.text()
        is_valid = text.isdigit() and int(text) > 0
        self.btn_send.setEnabled(is_valid)
        if is_valid:
            self.table_input.setStyleSheet("padding: 8px; border: 2px solid #5f27cd; border-radius: 8px; font-size: 18px; font-weight: bold;")
        else:
            self.table_input.setStyleSheet("padding: 8px; border: 2px solid #ff6b6b; border-radius: 8px; font-size: 18px; font-weight: bold;")

    def update_items_ui(self):
        # Clear existing
        while self.items_layout.count():
            child = self.items_layout.takeAt(0)
            if child.widget(): child.widget().deleteLater()
            
        for idx, item in enumerate(self.items):
            item_frame = QFrame()
            item_frame.setStyleSheet("background-color: #ffffff; border: 1px solid #eee; border-radius: 10px; margin-bottom: 5px;")
            item_lay = QHBoxLayout(item_frame)
            
            name_lbl = QLabel(item['name'])
            name_lbl.setStyleSheet("font-weight: bold; font-size: 16px; color: #2d3436;")
            item_lay.addWidget(name_lbl, stretch=1)
            
            # Qty Controls
            btn_min = QPushButton("-")
            btn_min.setFixedSize(40, 40)
            btn_min.setStyleSheet("background-color: #f1f2f6; border-radius: 20px; font-weight: bold;")
            btn_min.clicked.connect(lambda ch, i=idx: self.change_qty(i, -1))
            
            qty_lbl = QLabel(str(item['qty']))
            qty_lbl.setFixedWidth(30)
            qty_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            qty_lbl.setStyleSheet("font-weight: bold; font-size: 16px;")
            
            btn_plus = QPushButton("+")
            btn_plus.setFixedSize(40, 40)
            btn_plus.setStyleSheet("background-color: #f1f2f6; border-radius: 20px; font-weight: bold;")
            btn_plus.clicked.connect(lambda ch, i=idx: self.change_qty(i, 1))
            
            btn_del = QPushButton("X")
            btn_del.setFixedSize(40, 40)
            btn_del.setStyleSheet("background-color: #fab1a0; color: #d63031; border-radius: 20px; font-weight: bold;")
            btn_del.clicked.connect(lambda ch, i=idx: self.remove_item(i))
            
            item_lay.addWidget(btn_min)
            item_lay.addWidget(qty_lbl)
            item_lay.addWidget(btn_plus)
            item_lay.addWidget(btn_del)
            
            self.items_layout.addWidget(item_frame)

    def change_qty(self, idx, delta):
        new_qty = self.items[idx]['qty'] + delta
        if new_qty >= 1:
            self.items[idx]['qty'] = new_qty
            self.update_items_ui()

    def remove_item(self, idx):
        self.items.pop(idx)
        self.update_items_ui()
        if not self.items:
            self.reject()

    def get_order_data(self):
        return {
            "tableId": int(self.table_input.text()) if self.table_input.text().isdigit() else self.table_id,
            "items": [{"name": i['name'], "qty": i['qty']} for i in self.items],
            "language": CURRENT_LANG.lower()
        }

class HomeWidget(QWidget):
# ... (HomeWidget code remains same, showing for context)
    lang_selected = pyqtSignal(str) # "TR" or "EN"

    def __init__(self):
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setSpacing(50)

        # Logo
        logo = QLabel("GARSON ROBOT")
        logo.setStyleSheet("font-size: 60px; font-weight: 900; color: #222f3e; letter-spacing: 5px;")
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(logo)

        # Lang Cards Container
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(40)
        cards_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # TR Card
        self.btn_tr = self.create_lang_card("TÜRKÇE", "Devam Et", "#ff6b6b")
        self.btn_tr.clicked.connect(lambda: self.lang_selected.emit("TR"))
        
        # EN Card
        self.btn_en = self.create_lang_card("ENGLISH", "Continue", "#5da7e6")
        self.btn_en.clicked.connect(lambda: self.lang_selected.emit("EN"))

        cards_layout.addWidget(self.btn_tr)
        cards_layout.addWidget(self.btn_en)
        layout.addLayout(cards_layout)

    def create_lang_card(self, title, sub, color):
        btn = QPushButton()
        btn.setFixedSize(300, 200)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.setStyleSheet(f"""
            QPushButton {{
                background-color: white;
                border-radius: 30px;
                border: 2px solid {color};
            }}
            QPushButton:hover {{
                background-color: {color};
                color: white;
            }}
        """)
        
        # Layout inside button (Need to set layout on button which is a widget)
        lay = QVBoxLayout(btn)
        lbl_t = QLabel(title)
        lbl_t.setStyleSheet(f"font-size: 32px; font-weight: bold; color: {color}; background: transparent;")
        lbl_t.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        lbl_s = QLabel(sub)
        lbl_s.setStyleSheet("font-size: 18px; color: #576574; background: transparent;")
        lbl_s.setAlignment(Qt.AlignmentFlag.AlignCenter)

        # Hover effect hack via StyleSheet change isn't enough for child labels color change easily
        # keeping it simple
        
        lay.addWidget(lbl_t)
        lay.addWidget(lbl_s)
        return btn

class RestoranUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.db = Veritabani()
        self.sepet = {} 
        self.setWindowTitle("Garson Robot - V4 Multi-Lang")
        self.setGeometry(50, 50, 1400, 900)
        
        # Background
        palette = self.palette()
        grad = QLinearGradient(0, 0, 1400, 900)
        grad.setColorAt(0.0, QColor("#e0eafc")); grad.setColorAt(1.0, QColor("#cfdef3"))
        brush = QBrush(grad); palette.setBrush(self.backgroundRole(), brush); self.setPalette(palette)
        
        # Stacked Widget (Home vs App)
        self.central_stack = QStackedWidget()
        self.setCentralWidget(self.central_stack)

        # 1. Home Screen
        self.home_screen = HomeWidget()
        self.home_screen.lang_selected.connect(self.set_language)
        self.central_stack.addWidget(self.home_screen)

        # 2. Main App Screen
        self.app_widget = QWidget()
        self.app_ui_setup(self.app_widget)
        self.central_stack.addWidget(self.app_widget)
        
        # Masa Yönetimi
        self.aktif_masa_no = "05" # Varsayilan
        
        # QR Okuyucuyu Başlat
        self.qr_thread = QRScannerThread()
        self.qr_thread.qr_bulundu.connect(self.masa_numarasini_guncelle)
        # Polling
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self.poll_order_status)
        self.polling_order_id = None
        self.polling_error_count = 0

        # Offline Queue Timer
        self._flush_running = False
        self._flush_lock = threading.Lock()
        self.offline_timer = QTimer()
        self.offline_timer.timeout.connect(self.flush_offline_queue)
        self.offline_timer.start(5000)

        # Init
        threading.Thread(target=lambda: ollama.chat(model=MODEL_NAME, messages=[{'role':'user','content':'init'}]), daemon=True).start()

    def closeEvent(self, event):
        if hasattr(self, 'qr_thread'):
            self.qr_thread.stop()
        if hasattr(self, 'status_timer'):
            self.status_timer.stop()
        super().closeEvent(event)

    def set_language(self, lang_code):
        global CURRENT_LANG
        CURRENT_LANG = lang_code
        print(f"LANGUAGE SET TO: {CURRENT_LANG}")
        
        # Update UI Texts
        self.update_ui_texts()
        
        # Switch View
        self.central_stack.setCurrentWidget(self.app_widget)
        
        # Welcome Speech
        robot_konus(tr("bot_welcome"))
        
        # Auto start mic
        QTimer.singleShot(2500, self.sesli_baslat)

    def masa_numarasini_guncelle(self, masa_no):
        if self.aktif_masa_no != masa_no:
            self.aktif_masa_no = masa_no
            self.table_lbl.setText(f"{tr('table_no').split(':')[0]}: {masa_no}")
            
            # Sesli bildirim
            msg = tr("table_detected").format(masa_no=masa_no)
            robot_konus(msg)

    def app_ui_setup(self, parent):
        main_layout = QHBoxLayout(parent)
        main_layout.setContentsMargins(10, 10, 10, 10); main_layout.setSpacing(15)

        # Sidebar
        sidebar = QFrame(); sidebar.setFixedWidth(80); sidebar.setStyleSheet("background-color: #222f3e; border-radius: 20px;")
        side_lay = QVBoxLayout(sidebar); side_lay.setContentsMargins(10, 30, 10, 30); side_lay.setSpacing(20)
        
        self.home_btn = SidebarButton('fa5s.home', "home")
        self.home_btn.clicked.connect(lambda: self.central_stack.setCurrentWidget(self.home_screen)) # Go back home
        
        self.menu_btn = SidebarButton('fa5s.utensils', "menu"); self.menu_btn.setStyleSheet("background-color: #ff6b6b; border-radius: 15px;")
        self.settings_btn = SidebarButton('fa5s.cog', "settings")
        side_lay.addWidget(self.home_btn); side_lay.addWidget(self.menu_btn); side_lay.addStretch(); side_lay.addWidget(self.settings_btn)
        main_layout.addWidget(sidebar)

        # Content
        content_area = QVBoxLayout()
        header = QHBoxLayout()
        self.title_lbl = QLabel(tr("header_title")); self.title_lbl.setStyleSheet("font-size: 36px; font-weight: 900; color: #222f3e; letter-spacing: 1px;")
        self.sub_lbl = QLabel(tr("header_sub")); self.sub_lbl.setStyleSheet("font-size: 18px; color: #8395a7;")
        header_text = QVBoxLayout(); header_text.addWidget(self.title_lbl); header_text.addWidget(self.sub_lbl); header.addLayout(header_text); header.addStretch()
        self.lbl_durum = QLabel(tr("status_ready")); self.lbl_durum.setStyleSheet("background-color: white; padding: 10px 20px; border-radius: 20px; color: #576574; font-weight: bold;")
        header.addWidget(self.lbl_durum); content_area.addLayout(header)

        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        grid_container = QWidget(); grid_container.setStyleSheet("background: transparent;")
        self.grid = QGridLayout(grid_container); self.grid.setSpacing(15); self.grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        scroll.setWidget(grid_container); content_area.addWidget(scroll); main_layout.addLayout(content_area, stretch=1)

        # Cart
        cart_panel = QFrame(); cart_panel.setFixedWidth(380); cart_panel.setStyleSheet("QFrame { background-color: white; border-radius: 20px; border: 1px solid #dcdde1; }")
        shadow = QGraphicsDropShadowEffect(); shadow.setBlurRadius(40); shadow.setColor(QColor(0,0,0,30)); shadow.setOffset(-10, 0); cart_panel.setGraphicsEffect(shadow)
        cart_lay = QVBoxLayout(cart_panel); cart_lay.setContentsMargins(20, 30, 20, 30)
        
        self.cart_title = QLabel(tr("cart_title")); self.cart_title.setStyleSheet("font-size: 24px; font-weight: 800; color: #222f3e;")
        cart_head = QHBoxLayout(); 
        if qta: cart_head.addWidget(QLabel(pixmap=qta.icon('fa5s.receipt', color='#ff6b6b').pixmap(30,30)))
        cart_head.addWidget(self.cart_title); cart_head.addStretch(); cart_lay.addLayout(cart_head)
        
        self.table_lbl = QLabel(tr("table_no"), styleSheet="color: #8395a7; font-weight: bold; margin-bottom: 10px;"); cart_lay.addWidget(self.table_lbl)
        line = QFrame(); line.setFrameShape(QFrame.Shape.HLine); line.setStyleSheet("color: #dcdde1; border: 1px dashed #dcdde1;"); cart_lay.addWidget(line)
        self.liste_widget = QListWidget(); self.liste_widget.setStyleSheet("background: transparent; border: none; outline: none;"); self.liste_widget.setVerticalScrollMode(QListWidget.ScrollMode.ScrollPerPixel); cart_lay.addWidget(self.liste_widget)
        self.lbl_toplam = QLabel(f"0.00 {tr('currency')}"); self.lbl_toplam.setAlignment(Qt.AlignmentFlag.AlignRight); self.lbl_toplam.setStyleSheet("font-size: 32px; font-weight: 900; color: #222f3e;"); cart_lay.addWidget(self.lbl_toplam)
        
        btn_area = QVBoxLayout()
        self.btn_mic = QPushButton(tr("voice_btn")); 
        if qta: self.btn_mic.setIcon(qta.icon('fa5s.microphone', color='white'))
        self.btn_mic.setStyleSheet("QPushButton { background-color: #5f27cd; color: white; border-radius: 12px; font-size: 16px; font-weight: bold; padding: 15px; } QPushButton:hover { background-color: #341f97; }")
        self.btn_mic.clicked.connect(self.sesli_baslat); btn_area.addWidget(self.btn_mic)
        
        self.btn_ok = QPushButton(tr("pay_btn"))
        if qta: self.btn_ok.setIcon(qta.icon('fa5s.credit-card', color='white'))
        self.btn_ok.setStyleSheet("QPushButton { background-color: #ff6b6b; color: white; border-radius: 12px; font-size: 18px; font-weight: bold; padding: 15px; } QPushButton:hover { background-color: #ee5253; }")
        self.btn_ok.clicked.connect(self.siparisi_tamamla); btn_area.addWidget(self.btn_ok)
        cart_lay.addLayout(btn_area)
        
        main_layout.addWidget(cart_panel)
        self.menuyu_yukle()

    def update_ui_texts(self):
        self.home_btn.update_text()
        self.menu_btn.update_text()
        self.settings_btn.update_text()
        self.title_lbl.setText(tr("header_title"))
        self.sub_lbl.setText(tr("header_sub"))
        self.lbl_durum.setText(tr("status_ready"))
        self.cart_title.setText(tr("cart_title"))
        self.table_lbl.setText(f"{tr('table_no').split(':')[0]}: {self.aktif_masa_no}")
        self.btn_mic.setText(tr("voice_btn"))
        self.btn_ok.setText(tr("pay_btn"))
        self.lbl_toplam.setText(self.lbl_toplam.text().replace("TL", tr('currency')).replace("TRY", tr('currency')))
        
        # Reload products to update currency labels
        self.menuyu_yukle()

    def menuyu_yukle(self):
        urunler = self.db.menu_getir()
        
        if not urunler:
            print("⚠️ Menü boş, 10 saniye sonra tekrar denenecek...")
            QTimer.singleShot(10000, self.menuyu_yukle)
            return

        while self.grid.layout().count():
            item = self.grid.layout().takeAt(0)
            if item.widget(): item.widget().deleteLater()
            
        r, c = 0, 0; COL_COUNT = 3 
        for u in urunler:
            kart = ImpressiveUrunKarti(u[1], u[2], u[3], u[0])
            kart.tiklandi.connect(lambda ad, fiyat, id: self.sepete_urun_ekle(ad, fiyat, id, 1))
            self.grid.addWidget(kart, r, c); c += 1
            if c >= COL_COUNT: c = 0; r += 1

    def sepete_urun_ekle(self, ad, fiyat, id, adet=1):
        bilgi = self.db.stok_ve_fiyat_bilgisi_akilli(ad)
        stok = bilgi[2] if bilgi else 0
        mevcut_adet = self.sepet.get(ad, {}).get('adet', 0)
        if mevcut_adet + adet > stok: robot_konus(f"{ad} {tr('no_stock')}"); return
        if ad in self.sepet: self.sepet[ad]['adet'] += adet
        else: self.sepet[ad] = {'fiyat': fiyat, 'adet': adet, 'id': id}
        self.sepeti_guncelle_ui()

    def sepete_urun_guncelle(self, ad, yeni_adet):
        if ad in self.sepet:
            bilgi = self.db.stok_ve_fiyat_bilgisi_akilli(ad)
            stok = bilgi[2] if bilgi else 0
            if yeni_adet > stok: self.sepeti_guncelle_ui(); return
            self.sepet[ad]['adet'] = yeni_adet; self.sepeti_guncelle_ui()

    def sepetten_urun_sil(self, ad):
        if ad in self.sepet: del self.sepet[ad]; self.sepeti_guncelle_ui()

    def sepeti_guncelle_ui(self):
        self.liste_widget.clear(); toplam = 0
        for ad, veri in self.sepet.items():
            toplam += veri['fiyat'] * veri['adet']
            item_widget = ReceiptCartItem(ad, veri['fiyat'], veri['adet'])
            item_widget.adet_degisti_sinyali.connect(self.sepete_urun_guncelle)
            item_widget.sil_sinyali.connect(self.sepetten_urun_sil)
            list_item = QListWidgetItem(); list_item.setSizeHint(item_widget.sizeHint())
            self.liste_widget.addItem(list_item); self.liste_widget.setItemWidget(list_item, item_widget)
        self.lbl_toplam.setText(f"{toplam:.2f} {tr('currency')}")

    def sesli_baslat(self):
        self.btn_mic.setEnabled(False); self.btn_mic.setText(tr("listening")); self.btn_mic.setStyleSheet("background-color: #ff9ff3; color: white; border-radius: 12px; font-weight: bold;")
        self.worker = SesWorker()
        self.worker.sonuc_sinyali.connect(self.sesi_isle); self.worker.durum_sinyali.connect(self.lbl_durum.setText)
        self.worker.start()

    def sesi_isle(self, metin):
        self.btn_mic.setEnabled(True); self.btn_mic.setText(tr("voice_btn")); self.btn_mic.setStyleSheet("background-color: #5f27cd; color: white; border-radius: 12px; font-weight: bold;")
        if not metin: return
        self.lbl_durum.setText(tr("detected") + f" {metin}")
        self.llm_w = LLMWorker(metin, self.db.menu_getir())
        self.llm_w.islem_bitti_sinyali.connect(self.llm_sonucunu_uygula); self.llm_w.start()

    def llm_sonucunu_uygula(self, s):
        if s.get("bitir"): 
            self.siparisi_tamamla(s.get("mesaj", ""))
            return
        konusma = []
        
        urunler = s.get("urunler", [])

        # Sadece LLM'in ürettiği insan dostu mesajı oku, eğer o yoksa varsayılan metinleri oku
        for u in urunler:
            try:
                ad = u['ad'].replace("'", "").strip()
                adet = int(u.get('adet', 1))
                # Fallback dictionary key
                islem = u.get('islem', 'ekle')
                
                bilgi = self.db.stok_ve_fiyat_bilgisi_akilli(ad)
                if bilgi:
                    if islem == 'cikar': 
                        if ad in self.sepet:
                             y = self.sepet[ad]['adet'] - adet
                             if y<=0: self.sepetten_urun_sil(ad)
                             else: self.sepete_urun_guncelle(ad, y)
                    else: 
                        # bilgi tuple yapısı: (id, ad, fiyat, stok)
                        self.sepete_urun_ekle(bilgi[1], bilgi[2], bilgi[0], adet)
                        konusma.append(f"{adet} {bilgi[1]} {tr('added')}")
                else: 
                     print(f"{ad} bulunamadı")
            except Exception as e: 
                 print(f"Ürün işleme hatası: {e}")

        # Yeni Strict Parser yapısında mesaj LLM'den gelmiyor, Python'da dinamik oluşturuyoruz
        hic_urun_eklenmedi = (len(urunler) == 0)
        final_mesaj = ""
        
        if konusma:
             final_mesaj = ". ".join(konusma) + ". "
             
        if not s.get("bitir") and not hic_urun_eklenmedi:
             final_mesaj += tr("anything_else") if tr("anything_else") != "anything_else" else "Başka bir şey ister misiniz?"
        elif hic_urun_eklenmedi and not s.get("bitir"):
             final_mesaj = tr("not_understood") if tr("not_understood") != "not_understood" else "Tam anlayamadım, siparişinizi tekrar eder misiniz?"

        if final_mesaj:
            robot_konus(final_mesaj)
             
        hic_urun_eklenmedi = (len(urunler) == 0)
            
        # Kararsızlık durumu: Ürün yoksa ve bitir demediyse hızlıca tekrar dinle
        if hic_urun_eklenmedi and not s.get("bitir"):
            # Kelime sayısına göre dinamik bekleme süresi oluştur (yaklaşık saniyede 15 harf + Edge TTS gecikmesi)
            bekleme = max(3000, len(final_mesaj) * 75)
            QTimer.singleShot(int(bekleme), self.sesli_baslat)

    def siparisi_tamamla(self, final_msg=""):
        if not self.sepet:
            robot_konus(tr("cart_empty"))
            return

        # Review Modal logic
        review_items = []
        for ad, veri in self.sepet.items():
            review_items.append({"name": ad, "qty": veri['adet'], "id": veri['id']})
            
        modal = OrderReviewModal(review_items, int(self.aktif_masa_no) if self.aktif_masa_no.isdigit() else 1, self)
        if modal.exec() == QDialog.DialogCode.Accepted:
            order_data = modal.get_order_data()
            self.send_to_backend(order_data)
        else:
            print("Sipariş iptal edildi veya modal kapatıldı.")

    def send_to_backend(self, order_data):
        import requests
        try:
            print("BACKEND'E GİDEN (POST /api/orders):", order_data)
            response = requests.post(API_URL, json=order_data, timeout=5)
            if response.status_code in [200, 201]:
                data = response.json()
                self.polling_order_id = data.get("id")
                print(f"✅ Sipariş başarıyla iletildi. ID: {self.polling_order_id}")
                
                # Feedback
                robot_konus(tr("order_received_short"))
                self.lbl_durum.setText(tr("status_waiting"))
                
                # Start Polling
                self.poll_order_status() # Immediate check
                self.status_timer.start(2000)
                
                # Clear UI
                self.sepet.clear()
                self.sepeti_guncelle_ui()
                self.central_stack.setCurrentWidget(self.home_screen)
            else:
                print(f"⚠️ Backend Hatası: {response.status_code} - {response.text}")
                robot_konus("Sipariş gönderilirken bir hata oluştu.")
        except Exception as e:
            print(f"❌ Bağlantı Hatası, kuyruğa alınıyor: {e}")
            order_data["localId"] = str(uuid.uuid4())
            self.save_to_offline_queue(order_data)
            robot_konus(tr("offline_queued"))
            
            # Clear UI anyway
            self.sepet.clear()
            self.sepeti_guncelle_ui()
            self.central_stack.setCurrentWidget(self.home_screen)

    def save_to_offline_queue(self, order_data):
        file_path = os.path.join(BASE_DIR, "pending_orders.json")
        try:
            queue = []
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    queue = json.load(f)
            queue.append(order_data)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(queue, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"Kuyruğa yazma hatası: {e}")

    def flush_offline_queue(self):
        # UI'ı dondurmamak için ayrı thread'de çalıştır
        with self._flush_lock:
            if self._flush_running: return
            self._flush_running = True
        
        threading.Thread(target=self._flush_task, daemon=True).start()

    def _flush_task(self):
        file_path = os.path.join(BASE_DIR, "pending_orders.json")
        if not os.path.exists(file_path): 
            with self._flush_lock: self._flush_running = False
            return
        
        import requests
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content: 
                    with self._flush_lock: self._flush_running = False
                    return
                try:
                    queue = json.loads(content)
                except json.JSONDecodeError:
                    print("⚠️ Bozuk JSON dosyası tespit edildi.")
                    os.replace(file_path, file_path + ".bad")
                    with self._flush_lock: self._flush_running = False
                    return
            
            if not isinstance(queue, list) or not queue:
                with self._flush_lock: self._flush_running = False
                return
            
            print(f"🔄 Kuyruk temizleniyor... ({len(queue)} sipariş)")
            any_success = False
            remaining = []
            
            for order in queue:
                # Ensure localId is mapped to clientOrderId for backend idempotency
                if "localId" in order:
                    order["clientOrderId"] = order["localId"]
                
                try:
                    res = requests.post(API_URL, json=order, timeout=5)
                    if res.status_code in [200, 201]:
                        print(f"✅ Kuyruktaki sipariş gönderildi: {order.get('localId')}")
                        any_success = True
                        # Her başarılı gönderimden sonra dosyayı güncelle (Atomic)
                        # Bu döngü bitmeden güncelliyoruz ki crash durumunda duplicate azalsın
                        current_remaining = queue[queue.index(order)+1:] + remaining
                        self._atomic_write_queue(current_remaining)
                    else:
                        remaining.append(order)
                        self._atomic_write_queue(remaining)
                except Exception as e:
                    print(f"Kuyruk gönderim hatası: {e}")
                    remaining.append(order)
            
            if any_success:
                robot_konus(tr("offline_flush_success"))
                
        except Exception as e:
            print(f"Kuyruk flush hatası: {e}")
        finally:
            with self._flush_lock:
                self._flush_running = False

    def _atomic_write_queue(self, queue_data):
        file_path = os.path.join(BASE_DIR, "pending_orders.json")
        temp_path = file_path + ".tmp"
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(queue_data, f, ensure_ascii=False, indent=4)
            os.replace(temp_path, file_path)
        except Exception as e:
            print(f"Atomik yazma hatası: {e}")

    def poll_order_status(self):
        if not self.polling_order_id:
            self.status_timer.stop()
            return
            
        import requests
        try:
            url = f"{API_BASE_URL}/api/orders/{self.polling_order_id}"
            res = requests.get(url, timeout=3)
            if res.status_code == 200:
                order = res.json()
                status = order.get("status")
                print(f"Sipariş #{self.polling_order_id} Durumu: {status}")
                
                if status == "READY":
                    self.status_timer.stop()
                    self.polling_error_count = 0
                    table_id = order.get("tableId")
                    # EXACT FORMAT AS REQUESTED
                    print(f"DELIVER tableId={table_id} orderId={self.polling_order_id}")
                    
                    msg = tr("order_ready_msg") if tr("order_ready_msg") != "order_ready_msg" else "Siparişiniz hazır! Hemen getiriyorum."
                    robot_konus(msg)
                    self.lbl_durum.setText(tr("status_ready"))
                    self.polling_order_id = None
            elif res.status_code == 404:
                print("Sipariş bulunamadı, polling durduruluyor.")
                self.status_timer.stop()
                self.lbl_durum.setText(tr("status_ready"))
                self.polling_order_id = None
                self.polling_error_count = 0
            else:
                self.polling_error_count += 1
        except Exception as e:
            self.polling_error_count += 1
            print(f"Polling Hatası ({self.polling_error_count}/5): {e}")

        if self.polling_error_count >= 5:
             print("❌ Üst üste 5 polling hatası alındı. Timer durduruluyor.")
             self.status_timer.stop()
             self.polling_error_count = 0
             robot_konus("Sunucu bağlantısı koptu, sipariş durumunuzu takip edemiyorum.")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    font = QFont("Segoe UI", 10); app.setFont(font)
    win = RestoranUI(); win.show(); sys.exit(app.exec())