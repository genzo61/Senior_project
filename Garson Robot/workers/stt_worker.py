"""
Garson Robot — STT Worker
Mikrofon ile ses tanıma (Google Speech Recognition).
"""
import threading
import speech_recognition as sr
from config import tr


_stt_lock = threading.Lock()


def listen(on_status=None, on_result=None):
    """
    Mikrofonu aç, ses dinle, metni döndür.
    on_status: callable(str)  — durum güncellemesi
    on_result: callable(str)  — sonuç metni
    Senkron çalışır — thread içinden çağrılmalı.
    """
    from config import CURRENT_LANG, LANG
    lang_code = LANG.get(CURRENT_LANG, {}).get("speech_lang", "tr-TR")
    
    if not _stt_lock.acquire(blocking=False):
        print("⚠️ STT zaten çalışıyor, atlanıyor.")
        return ""

    try:
        r = sr.Recognizer()
        r.pause_threshold = 2.0
        with sr.Microphone() as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            if on_status:
                on_status(tr("listening"))
            audio = r.listen(source, timeout=8, phrase_time_limit=15)
            if on_status:
                on_status(tr("processing"))
            text = r.recognize_google(audio, language=lang_code)
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
        _stt_lock.release()


def listen_async(on_status=None, on_result=None):
    """listen() fonksiyonunu arka plan thread'inde çalıştır."""
    t = threading.Thread(target=listen, args=(on_status, on_result), daemon=True)
    t.start()
    return t
