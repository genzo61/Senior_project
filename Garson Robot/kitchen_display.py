import sys
import socket
import json
import threading
import time
import sqlite3
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QGridLayout, QLabel, QPushButton, 
                             QScrollArea, QFrame, QGraphicsDropShadowEffect, QMessageBox,
                             QTabWidget, QTableWidget, QTableWidgetItem, QHeaderView, QComboBox, QSpinBox)
from PyQt6.QtCore import pyqtSignal, QObject, Qt, QTimer, QSize
from PyQt6.QtGui import QColor, QFont, QIcon

try:
    import winsound
except ImportError:
    winsound = None

# --- AYARLAR ---
HOST = '0.0.0.0'  
PORT = 65432
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Navigate up if needed, but assuming script is in 'Garson Robot' folder and DB is in parent or same
# The user's previous structure implies DB is in parent of 'Garson Robot' or inside it?
# Let's check where STT_TTS_ui.py looks: os.path.join(BASE_DIR, "restoran.db")
DB_FILE = os.path.join(BASE_DIR, "restoran.db")
# If not found there, try one level up (common issue)
if not os.path.exists(DB_FILE):
    DB_FILE = os.path.join(os.path.dirname(BASE_DIR), "restoran.db")

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
        try:
            conn = self.baglan()
            cursor = conn.cursor()
            # Eğer stok NULL ise önce 0 yap, sonra ekle
            cursor.execute("UPDATE menu SET stok = COALESCE(stok, 0) + ? WHERE id = ?", (miktar, urun_id))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Stok Hata: {e}")
            return False

class ServerWorker(QObject):
    yeni_siparis = pyqtSignal(dict)
    
    def baslat(self):
        threading.Thread(target=self._server_loop, daemon=True).start()

    def _server_loop(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, PORT))
                s.listen()
                print(f"Mutfak Server Dinliyor: {HOST}:{PORT}")
                while True:
                    conn, addr = s.accept()
                    with conn:
                        data = conn.recv(4096)
                        if data:
                            try:
                                veri = json.loads(data.decode('utf-8'))
                                # Timestamp ekle
                                veri['zaman'] = time.strftime("%H:%M")
                                self.yeni_siparis.emit(veri)
                            except Exception as e:
                                print(f"Veri hatası: {e}")
            except Exception as e:
                print(f"Server Hatası: {e}")

class OrderCard(QFrame):
    delete_signal = pyqtSignal(QWidget) # Kendini silmesi için sinyal

    def __init__(self, veri):
        super().__init__()
        self.setFixedSize(300, 400)
        self.setStyleSheet("""
            QFrame {
                background-color: #2d3436;
                border-radius: 15px;
                border: 2px solid #636e72;
            }
        """)
        
        # Gölge
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(20); shadow.setColor(QColor(0,0,0,100)); shadow.setOffset(0, 5)
        self.setGraphicsEffect(shadow)

        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # HEADER
        header = QHBoxLayout()
        masa_lbl = QLabel(f"MASA: {veri.get('masa', '05')}")
        masa_lbl.setStyleSheet("font-size: 20px; font-weight: bold; color: #fab1a0; border: none;")
        zaman_lbl = QLabel(veri.get('zaman', '--:--'))
        zaman_lbl.setStyleSheet("font-size: 16px; color: #b2bec3; border: none;")
        header.addWidget(masa_lbl); header.addStretch(); header.addWidget(zaman_lbl)
        layout.addLayout(header)

        # DIVIDER
        line = QFrame(); line.setFrameShape(QFrame.Shape.HLine); line.setStyleSheet("background-color: #636e72; max-height: 1px; border: none;")
        layout.addWidget(line)

        # ITEMS
        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setStyleSheet("background: transparent; border: none;")
        items_widget = QWidget(); items_layout = QVBoxLayout(items_widget); items_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        sepet = veri.get('sepet', {})
        for urun, detay in sepet.items():
            adet = detay.get('adet', 1)
            row = QHBoxLayout()
            lbl_adet = QLabel(f"{adet}x"); lbl_adet.setStyleSheet("font-weight: bold; color: #00cec9; font-size: 18px; border: none;")
            lbl_ad = QLabel(urun); lbl_ad.setStyleSheet("color: white; font-size: 16px; border: none;"); lbl_ad.setWordWrap(True)
            row.addWidget(lbl_adet); row.addWidget(lbl_ad, stretch=1); items_layout.addLayout(row)
        scroll.setWidget(items_widget); layout.addWidget(scroll)

        # FOOTER
        self.btn_hazir = QPushButton("HAZIR")
        self.btn_hazir.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_hazir.setStyleSheet("QPushButton { background-color: #00b894; color: white; font-weight: bold; font-size: 18px; border-radius: 10px; padding: 10px; border: none; } QPushButton:hover { background-color: #55efc4; }")
        self.btn_hazir.clicked.connect(self.hazir_basildi)
        layout.addWidget(self.btn_hazir)

    def hazir_basildi(self):
        self.btn_hazir.setText("GÖNDERİLDİ!"); self.btn_hazir.setStyleSheet("background-color: #636e72; color: #b2bec3;"); self.btn_hazir.setEnabled(False)
        QTimer.singleShot(1000, lambda: self.delete_signal.emit(self))

class StockTab(QWidget):
    def __init__(self, db):
        super().__init__()
        self.db = db
        layout = QVBoxLayout(self)
        
        # Controls
        ctrl_panel = QFrame(); ctrl_panel.setStyleSheet("background-color: #353b48; border-radius: 10px; padding: 10px;")
        h_lay = QHBoxLayout(ctrl_panel)
        
        self.combo = QComboBox(); self.combo.setStyleSheet("padding: 8px; font-size: 14px; background: #dfe6e9; color: #2d3436; border-radius: 4px; min-width: 200px;")
        self.spin = QSpinBox(); self.spin.setRange(-100, 1000); self.spin.setValue(10); self.spin.setStyleSheet("padding: 8px; font-size: 14px; background: #dfe6e9; color: #2d3436; border-radius: 4px;")
        
        btn_add = QPushButton("STOK GÜNCELLE"); btn_add.clicked.connect(self.update_stock)
        btn_add.setStyleSheet("background-color: #0984e3; color: white; border-radius: 6px; padding: 10px; font-weight: bold;")
        
        btn_refresh = QPushButton("YENİLE"); btn_refresh.clicked.connect(self.load_data)
        btn_refresh.setStyleSheet("background-color: #636e72; color: white; border-radius: 6px; padding: 10px; font-weight: bold;")

        h_lay.addWidget(QLabel("Ürün:", styleSheet="color:white; font-weight:bold;")); h_lay.addWidget(self.combo)
        h_lay.addWidget(QLabel("Miktar:", styleSheet="color:white; font-weight:bold;")); h_lay.addWidget(self.spin)
        h_lay.addWidget(btn_add); h_lay.addWidget(btn_refresh)
        layout.addWidget(ctrl_panel)

        # Table
        self.table = QTableWidget(); self.table.setColumnCount(3); self.table.setHorizontalHeaderLabels(["ID", "Ürün Adı", "Stok Durumu"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setStyleSheet("QTableWidget { background-color: #2d3436; color: white; gridline-color: #636e72; font-size: 14px; } QHeaderView::section { background-color: #353b48; color: white; padding: 5px; }")
        self.table.cellClicked.connect(self.on_click)
        layout.addWidget(self.table)
        
        self.load_data()

    def load_data(self):
        self.table.setRowCount(0); self.combo.clear()
        data = self.db.tum_urunleri_getir()
        for i, (uid, ad, stok) in enumerate(data):
            stok = stok if stok is not None else 0
            self.table.insertRow(i)
            self.table.setItem(i, 0, QTableWidgetItem(str(uid)))
            self.table.setItem(i, 1, QTableWidgetItem(ad))
            
            s_item = QTableWidgetItem(f"{stok}")
            s_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            if stok <= 10: s_item.setBackground(QColor("#c0392b")); s_item.setText(f"{stok} (KRİTİK)")
            elif stok <= 30: s_item.setBackground(QColor("#f39c12"))
            else: s_item.setBackground(QColor("#27ae60"))
            self.table.setItem(i, 2, s_item)
            
            self.combo.addItem(f"{ad} ({stok})", uid)

    def on_click(self, r, c):
        uid = int(self.table.item(r, 0).text())
        for i in range(self.combo.count()):
            if self.combo.itemData(i) == uid: self.combo.setCurrentIndex(i); break

    def update_stock(self):
        idx = self.combo.currentIndex()
        if idx == -1: return
        uid = self.combo.itemData(idx)
        val = self.spin.value()
        if self.db.stok_ekle(uid, val):
            QMessageBox.information(self, "Başarılı", "Stok güncellendi.")
            self.load_data()
        else:
            QMessageBox.critical(self, "Hata", "Güncelleme başarısız.")

class MutfakKDS(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("👨‍🍳 KDS - Karakuli Kitchen & Stock")
        self.setGeometry(100, 100, 1200, 800)
        self.setStyleSheet("QMainWindow { background-color: #1e272e; } QTabWidget::pane { border: none; } QTabBar::tab { background: #636e72; color: white; padding: 10px 20px; font-weight: bold; } QTabBar::tab:selected { background: #00b894; }")

        self.db = MutfakDB()

        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)

        # TAB 1: ORDERS
        self.tab_orders = QWidget()
        self.setup_orders_tab()
        self.tabs.addTab(self.tab_orders, "🛎️ SİPARİŞLER")

        # TAB 2: STOCK
        self.tab_stock = StockTab(self.db)
        self.tabs.addTab(self.tab_stock, "📦 STOK YÖNETİMİ")

        # Server
        self.server = ServerWorker()
        self.server.yeni_siparis.connect(self.siparis_geldi)
        self.server.baslat()
        self.siparis_sayisi = 0

    def setup_orders_tab(self):
        layout = QVBoxLayout(self.tab_orders)
        
        # Header
        top_bar = QHBoxLayout()
        title = QLabel("AKTİF SİPARİŞ AKIŞI")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: white;")
        top_bar.addWidget(title); top_bar.addStretch()
        layout.addLayout(top_bar)

        # Grid
        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        grid_widget = QWidget(); 
        self.grid = QGridLayout(grid_widget); self.grid.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft); self.grid.setSpacing(20)
        scroll.setWidget(grid_widget); layout.addWidget(scroll)

    def siparis_geldi(self, veri):
        if winsound: winsound.Beep(1000, 500)
        kart = OrderCard(veri)
        kart.delete_signal.connect(self.kart_sil)
        r = self.siparis_sayisi // 4; c = self.siparis_sayisi % 4
        self.grid.addWidget(kart, r, c)
        self.siparis_sayisi += 1

    def kart_sil(self, kart_widget):
        self.grid.removeWidget(kart_widget); kart_widget.deleteLater()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    font = QFont("Segoe UI", 10); app.setFont(font)
    win = MutfakKDS(); win.show(); sys.exit(app.exec())
