import sys
import socket
import json
import threading
import sqlite3
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QTableWidget, QTableWidgetItem, QLabel, QHeaderView, 
                             QTabWidget, QHBoxLayout, QPushButton, QSpinBox, QMessageBox, QComboBox, QFrame)
from PyQt6.QtCore import pyqtSignal, QObject, Qt
from PyQt6.QtGui import QColor, QFont

# --- AYARLAR ---
HOST = '0.0.0.0'  
PORT = 65432
DB_FILE = "restoran.db" 

# --- VERİTABANI SINIFI ---
class MutfakDB:
    def baglan(self): return sqlite3.connect(DB_FILE)
    
    def tum_urunleri_getir(self):
        try:
            conn = self.baglan()
            cursor = conn.cursor()
            cursor.execute("SELECT id, ad, stok FROM menu ORDER BY ad ASC")
            data = cursor.fetchall()
            conn.close()
            return data
        except Exception as e:
            print(f"DB Bağlantı Hatası: {e}")
            return []

    def stok_ekle(self, urun_id, miktar):
        conn = self.baglan()
        cursor = conn.cursor()
        # Eğer stok NULL ise önce 0 yap, sonra ekle
        cursor.execute("UPDATE menu SET stok = COALESCE(stok, 0) + ? WHERE id = ?", (miktar, urun_id))
        conn.commit()
        conn.close()

class ServerSinyal(QObject):
    yeni_siparis = pyqtSignal(dict)

# --- ARAYÜZ ---
class MutfakUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.db = MutfakDB()
        self.setWindowTitle("👨‍🍳 Karakuli Mutfak & Stok Paneli")
        self.setGeometry(800, 100, 900, 600)
        
        self.setStyleSheet("""
            QMainWindow { background-color: #2d3436; color: white; }
            QTabWidget::pane { border: 1px solid #444; top: -1px; }
            QTabBar::tab { background: #636e72; color: white; padding: 12px 25px; margin-right: 2px; border-top-left-radius: 6px; border-top-right-radius: 6px; font-weight: bold; }
            QTabBar::tab:selected { background: #e17055; color: white; }
            QTableWidget { background-color: #353b48; color: white; gridline-color: #555; font-size: 15px; selection-background-color: #e17055; }
            QHeaderView::section { background-color: #2d3436; color: #dfe6e9; padding: 6px; font-weight: bold; font-size: 14px; border: none; }
            QLabel { color: white; font-weight: bold; font-size: 14px; }
            QPushButton { background-color: #0984e3; color: white; border-radius: 6px; padding: 10px; font-weight: bold; font-size: 14px; }
            QPushButton:hover { background-color: #74b9ff; }
            QComboBox { padding: 8px; font-size: 14px; background: #dfe6e9; color: #2d3436; border-radius: 4px; min-width: 200px; }
            QSpinBox { padding: 8px; font-size: 14px; background: #dfe6e9; color: #2d3436; border-radius: 4px; }
        """)

        self.sinyalci = ServerSinyal()
        self.sinyalci.yeni_siparis.connect(self.siparis_ekrana_bas)
        
        self.arayuz_kur()
        threading.Thread(target=self.server_baslat, daemon=True).start()

    def arayuz_kur(self):
        central = QWidget(); self.setCentralWidget(central)
        ana_layout = QVBoxLayout(central)

        self.tabs = QTabWidget()
        self.tab_siparis = QWidget()
        self.tab_stok = QWidget()
        
        self.tabs.addTab(self.tab_siparis, "🛎️ GELEN SİPARİŞLER")
        self.tabs.addTab(self.tab_stok, "📦 STOK YÖNETİMİ")
        ana_layout.addWidget(self.tabs)

        self.setup_siparis_tab()
        self.setup_stok_tab()

    def setup_siparis_tab(self):
        layout = QVBoxLayout(self.tab_siparis)
        lbl = QLabel("ANLIK SİPARİŞ AKIŞI")
        lbl.setStyleSheet("font-size: 20px; color: #fab1a0; margin-bottom: 10px;")
        layout.addWidget(lbl)
        
        self.tablo_siparis = QTableWidget()
        self.tablo_siparis.setColumnCount(3)
        self.tablo_siparis.setHorizontalHeaderLabels(["Masa", "Ürün", "Adet"])
        self.tablo_siparis.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.tablo_siparis)
        
        btn_temizle = QPushButton("🗑️ LİSTEYİ TEMİZLE")
        btn_temizle.setStyleSheet("background-color: #d63031;")
        btn_temizle.clicked.connect(lambda: self.tablo_siparis.setRowCount(0))
        layout.addWidget(btn_temizle)

    def setup_stok_tab(self):
        layout = QVBoxLayout(self.tab_stok)
        
        panel = QFrame(); panel.setStyleSheet("background-color: #353b48; border-radius: 10px; padding: 10px;")
        p_lay = QHBoxLayout(panel)
        
        self.combo_urunler = QComboBox()
        self.spin_miktar = QSpinBox()
        self.spin_miktar.setRange(-100, 1000)
        self.spin_miktar.setValue(10)
        self.spin_miktar.setSuffix(" Adet")
        
        btn_ekle = QPushButton("➕ STOK GÜNCELLE")
        btn_ekle.setStyleSheet("background-color: #00b894;")
        btn_ekle.clicked.connect(self.stok_guncelle)
        
        btn_yenile = QPushButton("🔄 YENİLE")
        btn_yenile.clicked.connect(self.stok_listesini_yukle)

        p_lay.addWidget(QLabel("Ürün:"))
        p_lay.addWidget(self.combo_urunler)
        p_lay.addWidget(QLabel("Miktar:"))
        p_lay.addWidget(self.spin_miktar)
        p_lay.addWidget(btn_ekle)
        p_lay.addWidget(btn_yenile)
        
        layout.addWidget(panel)

        self.tablo_stok = QTableWidget()
        self.tablo_stok.setColumnCount(3)
        self.tablo_stok.setHorizontalHeaderLabels(["ID", "Ürün Adı", "Mevcut Stok Durumu"])
        self.tablo_stok.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.tablo_stok.cellClicked.connect(self.satira_tiklandi)
        
        layout.addWidget(self.tablo_stok)
        self.stok_listesini_yukle()

    def satira_tiklandi(self, row, column):
        try:
            id_item = self.tablo_stok.item(row, 0)
            if not id_item: return
            tiklanan_id = int(id_item.text())
            for i in range(self.combo_urunler.count()):
                if self.combo_urunler.itemData(i) == tiklanan_id:
                    self.combo_urunler.setCurrentIndex(i)
                    break
        except Exception as e:
            print(f"Seçim hatası: {e}")

    # --- DÜZELTME BURADA YAPILDI ---
    def stok_listesini_yukle(self):
        self.tablo_stok.setRowCount(0)
        self.combo_urunler.clear()
        
        urunler = self.db.tum_urunleri_getir()
        
        for row_idx, (uid, ad, stok) in enumerate(urunler):
            # Eğer stok None (Boş) gelirse, 0 olarak kabul et
            if stok is None: 
                stok = 0
            
            self.tablo_stok.insertRow(row_idx)
            self.tablo_stok.setItem(row_idx, 0, QTableWidgetItem(str(uid)))
            self.tablo_stok.setItem(row_idx, 1, QTableWidgetItem(ad))
            
            item_stok = QTableWidgetItem(f"{stok} Adet")
            item_stok.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            item_stok.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
            
            if stok <= 10: 
                item_stok.setBackground(QColor("#c0392b"))
                item_stok.setForeground(QColor("white"))
                item_stok.setText(f"{stok} (KRİTİK!)")
            elif stok <= 30: 
                item_stok.setBackground(QColor("#f39c12"))
                item_stok.setForeground(QColor("black"))
            else: 
                item_stok.setBackground(QColor("#27ae60"))
                item_stok.setForeground(QColor("white"))
                
            self.tablo_stok.setItem(row_idx, 2, item_stok)
            self.combo_urunler.addItem(f"{ad} (Stok: {stok})", uid)

    def stok_guncelle(self):
        idx = self.combo_urunler.currentIndex()
        if idx == -1: return
        urun_id = self.combo_urunler.itemData(idx)
        miktar = self.spin_miktar.value()
        try:
            self.db.stok_ekle(urun_id, miktar)
            QMessageBox.information(self, "Stok Eklendi", f"Stok güncellendi!\nDeğişim: {miktar}")
            self.stok_listesini_yukle()
        except Exception as e:
            QMessageBox.critical(self, "Hata", str(e))

    def siparis_ekrana_bas(self, veri):
        masa = veri.get("masa", "Bilinmiyor")
        siparisler = veri.get("sepet", {})
        tutar = veri.get("tutar", "0")
        
        self.tablo_siparis.insertRow(0)
        baslik = QTableWidgetItem(f"--- YENİ SİPARİŞ ({tutar}) ---")
        baslik.setBackground(QColor("#e17055")); baslik.setForeground(QColor("white"))
        baslik.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.tablo_siparis.setItem(0, 1, baslik)
        
        for urun, detay in siparisler.items():
            self.tablo_siparis.insertRow(1)
            self.tablo_siparis.setItem(1, 0, QTableWidgetItem(str(masa)))
            self.tablo_siparis.setItem(1, 1, QTableWidgetItem(urun))
            self.tablo_siparis.setItem(1, 2, QTableWidgetItem(str(detay['adet'])))
        self.stok_listesini_yukle()

    def server_baslat(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, PORT))
                s.listen()
                while True:
                    conn, addr = s.accept()
                    with conn:
                        data = conn.recv(4096)
                        if data:
                            try:
                                veri = json.loads(data.decode('utf-8'))
                                self.sinyalci.yeni_siparis.emit(veri)
                            except: pass
            except Exception as e:
                print(f"Port hatası: {e}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    win = MutfakUI()
    win.show()
    sys.exit(app.exec())