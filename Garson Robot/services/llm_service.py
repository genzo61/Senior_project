"""
Garson Robot — LLM Service
Ollama ile müşteri siparişini analiz eder.
"""
import os
import json
import datetime
import ollama
from config import BASE_DIR, MODEL_NAME, LLM_TEMPERATURE, CURRENT_LANG, LANG, tr


def analyze(text, menu_list):
    """
    Müşteri metnini LLM ile analiz edip sipariş verisine dönüştür.
    Dönen: {urunler: [{ad, adet, islem}], bitir: bool, mesaj: str}
    """
    from config import CURRENT_LANG  # fresh import for current state
    
    menu_names = ", ".join([str(u[1]) for u in menu_list if u[1] is not None])
    print(f"\n📝 ALGILANAN SES ({CURRENT_LANG}): {text}")
    text_lower = text.lower()

    now = datetime.datetime.now()
    time_str = now.strftime("%H:%M")
    time_key = "morning" if 6 <= now.hour < 11 else "noon" if 11 <= now.hour < 22 else "night"
    time_msg = tr(time_key)

    # Prompt dosyasını oku
    prompt_file = os.path.join(BASE_DIR, "prompts", f"prompt_{CURRENT_LANG.lower()}.txt")
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            sys_prompt_template = f.read()
    else:
        sys_prompt_template = "Müşteri: {metin}"

    sys_prompt = sys_prompt_template.format(
        saat_bilgisi=time_str,
        zaman_mesaji=time_msg,
        menu_isimleri=menu_names,
        metin=text,
    )

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": sys_prompt}],
            format="json",
            options={"temperature": LLM_TEMPERATURE},
        )

        raw = response["message"]["content"].strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

        data = json.loads(raw.strip())
        intent = data.get("intent", "none")
        items = data.get("items", [])

        mapped = {
            "urunler": [],
            "bitir": (intent == "checkout"),
            "mesaj": "",
        }

        for item in items:
            mapped["urunler"].append(
                {
                    "ad": item.get("name", ""),
                    "adet": item.get("quantity", 1),
                    "islem": "cikar" if intent == "remove" else "ekle",
                }
            )

        # Keyword fallback
        finish_words = LANG.get(CURRENT_LANG, {}).get("finish_words", [])
        if not mapped["bitir"] and any(k in text_lower for k in finish_words):
            mapped["bitir"] = True
            mapped["urunler"] = []

        return mapped

    except Exception as e:
        print(f"❌ LLM HATASI: {e}")
        return {"urunler": [], "bitir": False, "mesaj": ""}
