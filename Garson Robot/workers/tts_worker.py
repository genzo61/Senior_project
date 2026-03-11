"""
Garson Robot — TTS Worker
Edge-TTS ile metin-sesli konuşma. Kuyruk sistemi ile çakışma önlenir.
"""
import os
import time
import random
import subprocess
import threading
import queue
import pygame
from config import BASE_DIR, tr


class TTSManager:
    def __init__(self, base_dir=BASE_DIR):
        self.base_dir = base_dir
        self._tts_queue = queue.Queue()
        self._tts_thread = None
        self._running = False
        
        # Pygame mixer init
        try:
            pygame.mixer.init(frequency=24000)
        except Exception:
            pass

    def start(self):
        if not self._running:
            self._running = True
            self._tts_thread = threading.Thread(target=self._tts_loop, daemon=True)
            self._tts_thread.start()

    def _tts_loop(self):
        """Arka planda TTS kuyruğunu dinle ve sırayla seslendir."""
        while self._running:
            try:
                # 1 saniyelik timeout, kapatılabilmesi için
                item = self._tts_queue.get(timeout=1)
            except queue.Empty:
                continue

            text, lang = item
            if text is None:
                self._tts_queue.task_done()
                break
                
            try:
                print(f"🔊 Robot ({lang}): {text}")

                # Önceki sesi durdur
                if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
                    pygame.mixer.music.stop()
                    try:
                        pygame.mixer.music.unload()
                    except Exception:
                        pass

                # Eski dosyaları temizle
                for f in os.listdir(self.base_dir):
                    if f.startswith("konusma_") and f.endswith(".mp3"):
                        try:
                            os.remove(os.path.join(self.base_dir, f))
                        except Exception:
                            pass

                filename = os.path.join(self.base_dir, f"konusma_{int(time.time())}_{random.randint(100, 999)}.mp3")

                # Dildeki sesi seç
                from config import CURRENT_LANG, LANG
                voice = LANG.get(CURRENT_LANG, {}).get("voice", "tr-TR-AhmetNeural")

                cmd = f'edge-tts --voice {voice} --text "{text}" --write-media "{filename}" --rate=+25%'
                subprocess.run(cmd, shell=True, check=True, capture_output=True)

                time.sleep(0.2)
                if os.path.exists(filename):
                    pygame.mixer.music.load(filename)
                    pygame.mixer.music.play()
                    # Sesin bitmesini bekle (max 30 sn)
                    for _ in range(300):
                        if not pygame.mixer.music.get_busy() or not self._running:
                            break
                        time.sleep(0.1)
            except Exception as e:
                print(f"❌ SES HATASI: {e}")
            finally:
                self._tts_queue.task_done()

    def speak(self, text):
        """TTS kuyruğuna metin ekle. Thread-safe."""
        from config import CURRENT_LANG
        if not self._running:
            self.start()
        self._tts_queue.put((text, CURRENT_LANG))

    def stop(self):
        """TTS kuyruğunu temizle ve durdur."""
        self._running = False
        while not self._tts_queue.empty():
            try:
                self._tts_queue.get_nowait()
                self._tts_queue.task_done()
            except queue.Empty:
                break
        if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
            pygame.mixer.music.stop()
        if self._tts_thread and self._tts_thread.is_alive():
            # Send a poison pill just in case
            self._tts_queue.put((None, None))
            self._tts_thread.join(timeout=2)
