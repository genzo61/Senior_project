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

# Gerekli Kütüphaneler
import speech_recognition as sr
import pygame
import ollama

from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QGridLayout, QPushButton, QLabel, 
                             QListWidget, QListWidgetItem, QFrame, QScrollArea)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize
from PyQt6.QtGui import QIcon

# --- AYARLAR ---
DB_FILE = "restoran.db"
MODEL_NAME = "llama3.2:3b" 
IMG_KLASORU = "img"
# Ses dosyası her seferinde değişecek, buradaki isim önemsiz
SES_DOSYASI = "gecici_ses.mp3" 

# --- MUTFAK AYARLARI ---
MUTFAK_IP = '127.0.0.1' 
MUTFAK_PORT = 65432
# -----------------------

NEGATIF_KELIMELER = ["istemiyorum", "sil", "çıkar", "iptal", "vazgeçtim", "kalsın", "geri al"]
BITIRME_KELIMELERI = ["onay", "onaylı", "onayladı", "tamam", "hesap", "bitti", "gönder", "siparişi geç", "sipariş"]

# Ses motorunu bir kere başlat
try:
    pygame.mixer.init(frequency=24000)
except:
    pass

# --------------------------------------------------
# LLM ANALİZİ
# --------------------------------------------------
def llm_ile_analiz_et(metin, menu_listesi):
    menu_isimleri = ", ".join([str(urun[1]) for urun in menu_listesi if urun[1] is not None])
    print(f"\n📝 ALGILANAN SES: {metin}")
    
    metin_lower = metin.lower()
    
    # 1. Bitirme Kontrolü
    if any(k in metin_lower for k in BITIRME_KELIMELERI):
        return {"urunler": [], "bitir": True, "mesaj": "Siparişinizi onayladım."}

    # 2. İşlem Tipi Kontrolü (Python Patron)
    islem_tipi = "ekle"
    if any(k in metin_lower for k in NEGATIF_KELIMELER):
        islem_tipi = "cikar"

    print(f"⚙️ MANTIK MOTORU: İşlem -> {islem_tipi.upper()}")

    # 3. LLM (Sadece Ürün Bulucu İşçi)
    prompt = f"""
    Sen bir sipariş asistanısın.
    MENÜ: [{menu_isimleri}]
    GÖREV: Aşağıdaki cümleden ürün adını ve miktarını JSON ver.
    CÜMLE: "{metin}"
    JSON FORMATI:
    {{ "urunler": [ {{ "ad": "Ürün Adı", "adet": 1 }} ], "mesaj": "istenilen işleminiz yapıldı"}}
    """

    try:
        response = ollama.chat(
            model=MODEL_NAME, 
            messages=[{'role': 'user', 'content': prompt}],
            format='json',
            options={'temperature': 0.1}
        )
        data = json.loads(response['message']['content'])
        
        # İşlem tipini ekle
        if "urunler" in data:
            for urun in data["urunler"]:
                urun["islem"] = islem_tipi
        
        data["bitir"] = False
        return data

    except Exception as e:
        print(f"❌ LLM HATASI: {e}")
        return {"urunler": [], "bitir": False, "mesaj": "Anlaşılmadı."}

# --------------------------------------------------
# SES MOTORU (Hatasız Versiyon)
# --------------------------------------------------
def robot_konus(metin):
    def _konus_thread():
        try:
            print(f"🔊 Robot: {metin}")
            
            # Çalan varsa durdur
            if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
                pygame.mixer.music.stop()
                try: pygame.mixer.music.unload() 
                except: pass

            # Eski dosyaları temizle
            for dosya in os.listdir():
                if dosya.startswith("konusma_") and dosya.endswith(".mp3"):
                    try: os.remove(dosya)
                    except: pass

            # Benzersiz isim üret (Dosya kilit hatasını önler)
            dosya_ismi = f"konusma_{int(time.time())}_{random.randint(100,999)}.mp3"
            
            # Sesi oluştur
            komut = f'edge-tts --voice tr-TR-AhmetNeural --text "{metin}" --write-media {dosya_ismi} --rate=+30%'
            subprocess.run(komut, shell=True, check=True)
            
            time.sleep(0.2)
            
            # Oynat
            if os.path.exists(dosya_ismi):
                pygame.mixer.music.load(dosya_ismi)
                pygame.mixer.music.play()
            
        except Exception as e:
            print(f"❌ SES HATASI: {e}")
            
    threading.Thread(target=_konus_thread, daemon=True).start()

# --------------------------------------------------
# VERİTABANI
# --------------------------------------------------
class Veritabani:
    def baglan(self): self.conn = sqlite3.connect(DB_FILE); return self.conn.cursor()
    def kapat(self): self.conn.close()
    
    def menu_getir(self):
        cur = self.baglan(); cur.execute("SELECT id, ad, fiyat, COALESCE(stok, 0) as stok FROM menu")
        d = cur.fetchall(); self.kapat(); return d

    def stok_ve_fiyat_bilgisi_akilli(self, urun_adi):
        cur = self.baglan()
        # Tam eşleşme
        cur.execute("SELECT id, ad, stok, fiyat FROM menu WHERE LOWER(ad) = LOWER(?)", (urun_adi,))
        r = cur.fetchone()
        # Bulamazsa benzer ara
        if not r:
            kelimeler = urun_adi.split()
            for kelime in kelimeler:
                if len(kelime) > 2:
                    cur.execute("SELECT id, ad, stok, fiyat FROM menu WHERE LOWER(ad) LIKE LOWER(?)", (f"%{kelime}%",))
                    r = cur.fetchone()
                    if r: break
        self.kapat(); return r

    def stogu_dus(self, urun_id, adet):
        cur = self.baglan()
        cur.execute("UPDATE menu SET stok = stok - ? WHERE id=?", (adet, urun_id))
        self.conn.commit(); self.kapat()

# --------------------------------------------------
# WORKERLAR
# --------------------------------------------------
class SesWorker(QThread):
    sonuc_sinyali = pyqtSignal(str); durum_sinyali = pyqtSignal(str)
    def run(self):
        r = sr.Recognizer()
        r.pause_threshold = 2.5
        try:
            with sr.Microphone() as source:
                r.adjust_for_ambient_noise(source)
                self.durum_sinyali.emit("👂 Dinliyorum...")
                audio = r.listen(source, timeout=5)
                self.durum_sinyali.emit("🧠 İşleniyor...")
                text = r.recognize_google(audio, language="tr-TR")
                self.sonuc_sinyali.emit(text)
        except:
            self.durum_sinyali.emit("Ses yok."); self.sonuc_sinyali.emit("") 

class LLMWorker(QThread):
    islem_bitti_sinyali = pyqtSignal(dict)
    def __init__(self, metin, menu): super().__init__(); self.metin=metin; self.menu=menu
    def run(self): self.islem_bitti_sinyali.emit(llm_ile_analiz_et(self.metin, self.menu))

# --------------------------------------------------
# ARAYÜZ
# --------------------------------------------------
class RestoranUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.db = Veritabani(); self.sepet = {}
        self.setWindowTitle("Garson Robot"); self.setGeometry(100, 100, 1200, 800)
        self.setStyleSheet("background-color: #2c3e50; color: white;")
        
        # LLM'i ısıt
        threading.Thread(target=lambda: ollama.chat(model=MODEL_NAME, messages=[{'role':'user','content':'init'}]), daemon=True).start()
        
        self.arayuzu_kur()
        self.lbl_durum.setText("Sunum İçin Hazır. Butona Basınız.")
        robot_konus("Robokafeye hoş geldiniz.Ben Karakuli.Sizlere nasıl yardımcı olabilirim?")
        #QTimer.singleShot(2500, self.sesli_baslat)

    def arayuzu_kur(self):
        central = QWidget(); self.setCentralWidget(central); layout = QHBoxLayout(central)
        sol = QWidget(); sol_lay = QVBoxLayout(sol)
        sol_lay.addWidget(QLabel("🍔 MENÜ", styleSheet="color: #f1c40f; font: bold 28px;"))
        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setStyleSheet("border:none; background: transparent;")
        self.grid_w = QWidget(); self.grid = QGridLayout(self.grid_w); self.grid_w.setStyleSheet("background: transparent;")
        scroll.setWidget(self.grid_w); sol_lay.addWidget(scroll)

        sag = QFrame(); sag.setFixedWidth(400); sag.setStyleSheet("background: #34495e; border-radius: 20px;")
        sag_lay = QVBoxLayout(sag)
        sag_lay.addWidget(QLabel("🛒 SEPETİM", styleSheet="font: bold 22px;"))
        self.liste = QListWidget(); self.liste.setStyleSheet("background: #2c3e50; font: 16px;")
        sag_lay.addWidget(self.liste)
        self.lbl_toplam = QLabel("TOPLAM: 0 TL", styleSheet="color: #2ecc71; font: bold 24px;"); sag_lay.addWidget(self.lbl_toplam)
        self.lbl_durum = QLabel("Hazır"); self.lbl_durum.setAlignment(Qt.AlignmentFlag.AlignCenter); sag_lay.addWidget(self.lbl_durum)
        
        self.btn_mic = QPushButton("🎙️ DİNLEME AKTİF"); self.btn_mic.clicked.connect(self.sesli_baslat)
        sag_lay.addWidget(self.btn_mic)
        btn_ok = QPushButton("✅ SİPARİŞİ TAMAMLA"); btn_ok.setStyleSheet("background: #27ae60; font: bold 18px; border-radius:10px; padding: 10px")
        btn_ok.clicked.connect(self.siparisi_tamamla); sag_lay.addWidget(btn_ok)

        layout.addWidget(sol, 65); layout.addWidget(sag, 35)
        self.menuyu_yukle()

    def menuyu_yukle(self):
        for i in range(self.grid.count()): self.grid.itemAt(i).widget().deleteLater()
        urunler = self.db.menu_getir(); r, c = 0, 0
        for u in urunler:
            btn = QPushButton()
            resim = os.path.join(IMG_KLASORU, f"{u[1]}.png")
            if os.path.exists(resim): btn.setIcon(QIcon(resim)); btn.setIconSize(QSize(100, 100)); txt=f"\n{u[1]}\n{u[2]} TL"
            else: txt=f"{u[1]}\n\n{u[2]} TL"
            btn.setText(txt); btn.setFixedSize(180, 180)
            stok = u[3] if u[3] is not None else 0
            if stok>0:
                btn.setStyleSheet("background: #3e5871; border-radius: 15px; font-weight: bold;")
                btn.clicked.connect(lambda ch, a=u[1], f=u[2], i=u[0]: self.sepete_islem(a, f, i, 1, "ekle"))
            else: 
                btn.setText(f"{u[1]}\nBİTTİ"); btn.setEnabled(False)
                btn.setStyleSheet("background: #7f8c8d; border-radius: 15px; color: #2c3e50;")
            
            self.grid.addWidget(btn, r, c); c+=1; 
            if c>=3: c=0; r+=1

    def sepete_islem(self, ad, fiyat, id, adet, islem="ekle"):
        print(f"⚙️ SEPET: {ad} -> {islem}")
        if islem == "ekle":
            if ad in self.sepet: self.sepet[ad]['adet'] += adet
            else: self.sepet[ad] = {'fiyat': fiyat, 'adet': adet, 'id': id}
        elif islem == "cikar" and ad in self.sepet:
            self.sepet[ad]['adet'] -= adet
            if self.sepet[ad]['adet'] <= 0: del self.sepet[ad]
        self.sepeti_guncelle()

    def sepeti_guncelle(self):
        self.liste.clear(); toplam = 0
        for ad, d in self.sepet.items():
            t = d['fiyat'] * d['adet']; toplam += t
            self.liste.addItem(QListWidgetItem(f"{ad} x{d['adet']} ... {t} TL"))
        self.lbl_toplam.setText(f"TOPLAM: {toplam} TL")

    def sesli_baslat(self):
        self.btn_mic.setEnabled(False); self.btn_mic.setStyleSheet("background: #e74c3c; color: white;")
        self.worker = SesWorker()
        self.worker.sonuc_sinyali.connect(self.sesi_isle); self.worker.durum_sinyali.connect(self.lbl_durum.setText)
        self.worker.start()

    def sesi_isle(self, metin):
        if not metin: QTimer.singleShot(500, self.sesli_baslat); return
        self.lbl_durum.setText(f"Algılandı: {metin}")
        self.llm_w = LLMWorker(metin, self.db.menu_getir())
        self.llm_w.islem_bitti_sinyali.connect(self.llm_sonucunu_uygula); self.llm_w.start()

    # --- KRİTİK DÜZENLEME BURADA YAPILDI ---
    def llm_sonucunu_uygula(self, s):
        if s.get("bitir") == True: self.siparisi_tamamla(); return
        
        konusma_listesi = []
        urunler = s.get("urunler", [])

        if not urunler:
            # Anlaşılmadıysa tekrar dinle
            QTimer.singleShot(1000, self.sesli_baslat)
            return

        for u in urunler:
            try:
                # 1. İsmi temizle
                aranan = u['ad'].replace('"', '').replace("'", "").strip()
                # 2. Adedi tam sayı yap (Çökme sebebi buydu! int)
                istenen_adet = int(u.get('adet', 1)) 
                islem = u.get('islem', 'ekle')

                bilgi = self.db.stok_ve_fiyat_bilgisi_akilli(aranan)

                if bilgi:
                    # [id, ad, stok, fiyat]
                    db_stok = bilgi[2]
                    
                    if islem == 'cikar':
                        self.sepete_islem(bilgi[1], bilgi[3], bilgi[0], istenen_adet, "cikar")
                    else:
                        # EKLEME KONTROLÜ
                        if db_stok >= istenen_adet:
                            self.sepete_islem(bilgi[1], bilgi[3], bilgi[0], istenen_adet, "ekle")
                            konusma_listesi.append(f"{bilgi[1]} eklendi.")
                        else:
                            konusma_listesi.append(f"Maalesef {bilgi[1]} kalmadı efendim.")
                else:
                    # ÜRÜN BULUNAMADI
                    print(f"Menüde yok: {aranan}")
                    konusma_listesi.append(f"{aranan} menümüzde yok efendim.")

            except Exception as e:
                print(f"Ürün işlem hatası: {e}")

        # Robot konuşsun
        if konusma_listesi:
            robot_konus(" ".join(konusma_listesi))
        else:
            robot_konus(s.get("mesaj", "Tamamdır."))
            
        QTimer.singleShot(4000, self.sesli_baslat)

    def siparisi_tamamla(self):
        if not self.sepet: robot_konus("Sepet boş."); QTimer.singleShot(3000, self.sesli_baslat); return
        
        for k, v in self.sepet.items(): self.db.stogu_dus(v['id'], v['adet'])
        tutar = self.lbl_toplam.text().replace("TOPLAM: ", "")

        # MUTFAĞA GÖNDER
        try:
            payload = json.dumps({"sepet": self.sepet, "tutar": tutar})
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(2)
                s.connect((MUTFAK_IP, MUTFAK_PORT))
                s.sendall(payload.encode('utf-8'))
        except Exception as e:
            print(f"Mutfak hatası: {e}")

        robot_konus(f"Siparişleri mutfağa ilettim. Tutar {tutar}. Afiyet olsun!")
        self.sepet={}; self.sepeti_guncelle(); self.menuyu_yukle()
        QTimer.singleShot(8000, self.sesli_baslat)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    win = RestoranUI()
    win.show()
    sys.exit(app.exec())