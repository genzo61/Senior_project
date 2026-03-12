"""
Garson Robot — QR Scanner Worker
Kamera ile QR kod okuma.
"""
import threading
import time
from config import CAMERA_ID, QR_DELAY

try:
    import cv2
except Exception:
    cv2 = None

try:
    from pyzbar.pyzbar import decode
except Exception:
    decode = None


class QRScanner:
    def __init__(self, on_qr_found=None):
        """
        on_qr_found: callable(str) — masa numarası bulunduğunda çağrılır
        """
        self.on_qr_found = on_qr_found
        self._running = False
        self._thread = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def _loop(self):
        try:
            if cv2 is None or decode is None:
                print("⚠️ QR bağımlılıkları (opencv/pyzbar) yok, QR okuyucu devre dışı.")
                return

            cap = cv2.VideoCapture(CAMERA_ID)
            if not cap.isOpened():
                print("⚠️ Kamera açılamadı, QR okuyucu devre dışı.")
                return

            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.5)
                    continue

                decoded_objects = decode(frame)
                for obj in decoded_objects:
                    data = obj.data.decode("utf-8")
                    if "TABLE:" in data.upper():
                        table_no = data.upper().split("TABLE:")[1].strip()
                        if self.on_qr_found:
                            self.on_qr_found(table_no)
                        time.sleep(QR_DELAY)
                    elif data.isdigit() and len(data) <= 2:
                        if self.on_qr_found:
                            self.on_qr_found(data.zfill(2))
                        time.sleep(QR_DELAY)

                time.sleep(0.2)

            cap.release()
        except Exception as e:
            print(f"❌ QR Tarayıcı Hatası: {e}")
