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


# Pygame mixer init
try:
    pygame.mixer.init(frequency=24000)
except Exception:
    pass

_tts_queue = queue.Queue()
_tts_thread = None


def _tts_loop():
    """Arka planda TTS kuyruğunu dinle ve sırayla seslendir."""
    while True:
        text, lang = _tts_queue.get()
        if text is None:
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
            for f in os.listdir(BASE_DIR):
                if f.startswith("konusma_") and f.endswith(".mp3"):
                    try:
                        os.remove(os.path.join(BASE_DIR, f))
                    except Exception:
                        pass

            filename = os.path.join(BASE_DIR, f"konusma_{int(time.time())}_{random.randint(100, 999)}.mp3")

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
                    if not pygame.mixer.music.get_busy():
                        break
                    time.sleep(0.1)
        except Exception as e:
            print(f"❌ SES HATASI: {e}")
        finally:
            _tts_queue.task_done()


def speak(text):
    """TTS kuyruğuna metin ekle. Thread-safe."""
    global _tts_thread
    from config import CURRENT_LANG
    if _tts_thread is None or not _tts_thread.is_alive():
        _tts_thread = threading.Thread(target=_tts_loop, daemon=True)
        _tts_thread.start()
    _tts_queue.put((text, CURRENT_LANG))


def stop():
    """TTS kuyruğunu temizle ve durdur."""
    while not _tts_queue.empty():
        try:
            _tts_queue.get_nowait()
            _tts_queue.task_done()
        except queue.Empty:
            break
    if pygame.mixer.get_init() and pygame.mixer.music.get_busy():
        pygame.mixer.music.stop()
