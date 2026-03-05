"""
Garson Robot — Table Status Checker
Backend'den masa çağrılarını periyodik kontrol eder.
"""
import threading
import time
from services.api_client import get_calling_tables


class TableChecker:
    def __init__(self, on_table_calling=None, interval=2):
        """
        on_table_calling: callable(str) — masa çağrısı geldiğinde çağrılır
        interval: kontrol aralığı (saniye)
        """
        self.on_table_calling = on_table_calling
        self.interval = interval
        self._running = False
        self._thread = None
        self._announced = set()

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
        while self._running:
            try:
                calling = set(get_calling_tables())
                for t_id in calling:
                    if t_id not in self._announced:
                        self._announced.add(t_id)
                        if self.on_table_calling:
                            self.on_table_calling(t_id)
                # Artık çağırmayı bırakmış masaları temizle
                self._announced.intersection_update(calling)
            except Exception:
                pass
            time.sleep(self.interval)
