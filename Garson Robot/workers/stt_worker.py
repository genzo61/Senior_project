"""
Garson Robot — STT Worker
Mikrofon ile ses tanıma (Google Speech Recognition).
"""
import threading
import speech_recognition as sr
from config import tr


class STTManager:
    def __init__(self):
        self._stt_lock = threading.Lock()
        self._recognizer = sr.Recognizer()
        self._recognizer.pause_threshold = 2.0

    def listen(self, on_status=None, on_result=None):
        """
        Mikrofonu aç, ses dinle, metni döndür.
        on_status: callable(str)  — durum güncellemesi
        on_result: callable(str)  — sonuç metni
        Senkron çalışır — thread içinden çağrılmalı.
        """
        from config import CURRENT_LANG, LANG
        lang_code = LANG.get(CURRENT_LANG, {}).get("speech_lang", "tr-TR")
        
        if not self._stt_lock.acquire(blocking=False):
            print("⚠️ STT zaten çalışıyor, atlanıyor.")
            return ""

        try:
            with sr.Microphone() as source:
                self._recognizer.adjust_for_ambient_noise(source, duration=0.5)
                if on_status:
                    on_status(tr("listening"))
                audio = self._recognizer.listen(source, timeout=8, phrase_time_limit=15)
                if on_status:
                    on_status(tr("processing"))
                text = self._recognizer.recognize_google(audio, language=lang_code)
                if on_result:
                    on_result(text)
                return text
        except sr.WaitTimeoutError:
            if on_status:
                on_status(tr("no_voice"))
            return ""
        except sr.UnknownValueError:
            if on_status:
                on_status(tr("no_voice"))
            return ""
        except Exception as e:
            print(f"❌ STT Hatası: {e}")
            if on_status:
                on_status(tr("no_voice"))
            return ""
        finally:
            self._stt_lock.release()

    def listen_async(self, on_status=None, on_result=None):
        """listen() fonksiyonunu arka plan thread'inde çalıştır."""
        t = threading.Thread(target=self.listen, args=(on_status, on_result), daemon=True)
        t.start()
        return t
