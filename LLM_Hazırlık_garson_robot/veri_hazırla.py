import json
import csv
import random
import os
import re

# -----------------------------------------------------------------------------
# ADIM 1: TEMEL AYARLAR
# -----------------------------------------------------------------------------

# Modelimize öğreteceğimiz temel kişilik. Bu, her veri satırına eklenecek.
# Modelinize Türkçe hitap edeceğiz.
SISTEM_PROMPT = ("Sen 'RobotKafe' isimli bir kafede çalışan 'karakuli' adında, "
                 "kibar, yardımsever ve profesyonel bir garson robotsun. "
                 "Müşteri taleplerine göre JSON formatında eylem çıktıları üretirsin.")

# Çıktı dosyamızın adı
CIKTI_DOSYASI = "final_dataset.jsonl"

# Hangi dosyaları kullanacağız
INTENTS_ENG_DOSYASI = "intents_english.json"
TRAIN_DATA_DOSYASI = "train_data.csv"
ITEMS_DOSYASI = "items.csv" # Veya "Balaji Fast Food Sales.csv", hangisi menünse
CONVERSATION_DOSYASI = "Conversation.csv"

# -----------------------------------------------------------------------------
# ADIM 2: YARDIMCI FONKSİYON
# -----------------------------------------------------------------------------

# Oluşturduğumuz her veri satırını JSONL formatında dosyaya yazan fonksiyon
def dosyaya_yaz(veri_listesi, dosya_yazici):
    for veri in veri_listesi:
        # Alpaca/Unsloth formatı: instruction, input, output
        # Bizim senaryomuzda "input" (girdi) daha mantıklı, 
        # "instruction" (talimat) zaten sistem prompt'u oldu.
        # Formatı Tech With Tim videosuna uygun tutalım:
        formatlanmis_veri = {
            "instruction": veri["instruction"],
            "input": veri["input"],
            "output": veri["output"]
        }
        json_str = json.dumps(formatlanmis_veri, ensure_ascii=False)
        dosya_yazici.write(json_str + "\n")

# -----------------------------------------------------------------------------
# ADIM 3: VERİ İŞLEME FONKSİYONLARI
# -----------------------------------------------------------------------------

# Kategori 1: Sosyal Etkileşimler (Selam, Veda, Teşekkür)
# Bu fonksiyon, modelin "kişiliğini" oluşturur.
def islem_sosyal_veriler(dosya_adi):
    print(f"[İşlem 1/4] Sosyal veriler işleniyor ({dosya_adi})...")
    veriler = []
    
    # Hata kontrolü
    if not os.path.exists(dosya_adi):
        print(f"UYARI: '{dosya_adi}' bulunamadı. Bu adım atlanıyor.")
        return []

    with open(dosya_adi, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for intent in data.get("intents", []):
        tag = intent.get("tag")
        
        # Sadece sosyal etkileşimleri alıyoruz
        if tag in ["greeting", "goodbye", "thanks"]:
            patterns = intent.get("patterns", [])
            responses = intent.get("responses", [])
            
            # Her bir "kalıp" (müşteri sözü) için...
            for pattern in patterns:
                # ...rastgele bir "cevap" (robot sözü) seç.
                output_text = random.choice(responses)
                
                # Türkçe'ye çevirelim (Daha iyi bir model için)
                if tag == "greeting":
                    output_text = "Merhaba efendim, hoş geldiniz! Size nasıl yardımcı olabilirim?"
                elif tag == "goodbye":
                    output_text = "Görüşmek üzere efendim, yine bekleriz."
                elif tag == "thanks":
                    output_text = "Rica ederim, her zaman!"

                veriler.append({
                    "instruction": SISTEM_PROMPT,
                    "input": pattern,
                    "output": output_text # Sadece metin cevap
                })
                
    print(f"-> {len(veriler)} adet sosyal etkileşim eklendi.")
    return veriler

# Kategori 2: Eylemler (Sipariş İptali, Bilgi İsteme)
# Bu fonksiyon, modele JSON ile "eylem" üretmeyi öğretir.
def islem_eylem_verileri(dosya_adi):
    print(f"[İşlem 2/4] Eylem verileri işleniyor ({dosya_adi})...")
    veriler = []

    if not os.path.exists(dosya_adi):
        print(f"UYARI: '{dosya_adi}' bulunamadı. Bu adım atlanıyor.")
        return []

    with open(dosya_adi, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader) # Başlığı atla
        
        for row in reader:
            if not row: continue # Boş satırları atla
            
            input_text = row[0]
            intent = row[1] # örn: "cancel_catering", "information_allergens"
            
            # Modelin üreteceği kibar cevabı ve JSON eylemini oluşturuyoruz
            # Burası çok önemli. Modeline JSON üretmeyi burada öğretiyorsun.
            
            kibar_cevap = ""
            if intent == "cancel_catering":
                kibar_cevap = "Anlıyorum, catering siparişinizi iptal etmek istiyorsunuz. İlgili birime iletiyorum."
            elif intent == "change_catering":
                kibar_cevap = "Sipariş değişikliği talebinizi aldım, ilgili birime iletiyorum."
            elif intent == "information_allergens":
                kibar_cevap = "Elbette, alerjen bilgisi için menümüzü RAG sisteminden kontrol ediyorum."
            elif intent == "human_agent":
                kibar_cevap = "Size yardımcı olamadığım için üzgünüm. Hemen bir insan yetkiliye bağlıyorum."
            else:
                kibar_cevap = "Talebinizi anladım ve işleme alıyorum."

            output_json = {
                "eylem": intent,
                "cevap": kibar_cevap
            }
            
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": input_text,
                "output": json.dumps(output_json, ensure_ascii=False) # Çıktı olarak JSON metni
            })

    print(f"-> {len(veriler)} adet karmaşık eylem eklendi.")
    return veriler

# Kategori 3: Sentetik Siparişler (En Önemlisi)
# Bu fonksiyon, modelin "garson" olmasını sağlar. Menüden ürün alır ve sipariş senaryoları üretir.
def islem_sentetik_siparisler(menu_dosyasi):
    print(f"[İşlem 3/4] Sentetik siparişler üretiliyor ({menu_dosyasi})...")
    veriler = []
    
    if not os.path.exists(menu_dosyasi):
        print(f"UYARI: '{menu_dosyasi}' bulunamadı. Bu adım atlanıyor.")
        return []

    # 1. Menü dosyasını (items.csv) oku ve ürün listesi çıkar
    urunler = []
    with open(menu_dosyasi, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        try:
            # Sütun adlarını bul (dosyadan dosyaya değişebilir)
            item_index = header.index("item_name")
        except ValueError:
            print(f"HATA: '{menu_dosyasi}' içinde 'item_name' sütunu bulunamadı.")
            return []
            
        for row in reader:
            if row:
                urun_adi = row[item_index].strip()
                # 'Cappuccino' gibi temiz isimleri al
                if urun_adi and len(urun_adi) > 2:
                    urunler.append(urun_adi)
    
    # Tekrar edenleri kaldır
    urunler = list(set(urunler))
    print(f"-> Menüden {len(urunler)} adet eşsiz ürün bulundu (örn: {random.choice(urunler)})")

    # 2. Sipariş kalıplarını (template) tanımla
    siparis_kaliplari = [
        "Bana bir {}", "Bir {} alabilir miyim?", "{} istiyorum lütfen.", "Bir adet {} alacağım.",
        "Masaya bir {} yollar mısınız?", "Menüden {} alalım.", "{} var mı?", "Sanırım bir {} içeceğim.",
        "Bana bir {}, bir de {} lütfen.", "İki {}, bir {} alalım."
    ]
    
    # 3. Sentetik veri üret
    # Her kalıbı 20 kez farklı ürünlerle dener (20 * 10 = 200)
    for kalip in siparis_kaliplari:
        for _ in range(20):
            # Kalıbın kaç ürün gerektirdiğini bul (örn: "{}" sayısı)
            gerekli_urun_sayisi = kalip.count("{}")
            
            # Gerekli sayıda rastgele ürün seç
            secilen_urunler = random.sample(urunler, gerekli_urun_sayisi)
            
            # Kalıbı doldur
            input_text = kalip.format(*secilen_urunler)
            
            # Çıktı JSON'ını oluştur
            output_json = {
                "eylem": "siparis_ver",
                "urunler": secilen_urunler,
                "cevap": f"Elbette efendim, {', '.join(secilen_urunler)} siparişiniz hemen hazırlanıyor."
            }
            
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": input_text,
                "output": json.dumps(output_json, ensure_ascii=False)
            })
            
    print(f"-> {len(veriler)} adet sentetik sipariş verisi üretildi.")
    return veriler

# Kategori 4: Konu Dışı Sohbet (Reddetme)
# Bu fonksiyon, modelin "gevezelik" yapmamasını, garson rolünde kalmasını sağlar.
def islem_konu_disi(dosya_adi):
    print(f"[İşlem 4/4] Konu dışı veriler işleniyor ({dosya_adi})...")
    veriler = []

    if not os.path.exists(dosya_adi):
        print(f"UYARI: '{dosya_adi}' bulunamadı. Bu adım atlanıyor.")
        return []

    # Conversation.csv'den konu dışı soruları alacağız
    with open(dosya_adi, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        konu_disi_sorular = []
        for row in reader:
            if not row: continue
            
            soru = row[1].lower()
            # Hava durumu, okul, filmler gibi garsonla ilgili olmayan konular
            if "weather" in soru or "school" in soru or "movie" in soru or "ugly day" in soru:
                konu_disi_sorular.append(row[1]) # Orijinal soruyu al
    
    # Tekrar edenleri kaldır ve rastgele 50 tane seç
    konu_disi_sorular = list(set(konu_disi_sorular))
    random.shuffle(konu_disi_sorular)
    
    kibar_reddetme_cevaplari = [
        {"eylem": "konu_disi", "cevap": "Özür dilerim efendim, ben bir garson robotum ve sadece menü ve siparişler hakkında yardımcı olabiliyorum."},
        {"eylem": "konu_disi", "cevap": "Bu konu hakkında bilgim yok, ancak menümüzden bir şey arzu ederseniz yardımcı olabilirim."},
        {"eylem": "konu_disi", "cevap": "Anlıyorum, size bir kahve ikram etmemi ister misiniz?"}
    ]

    for soru in konu_disi_sorular[:100]: # En fazla 100 tane alalım
        veriler.append({
            "instruction": SISTEM_PROMPT,
            "input": soru,
            "output": json.dumps(random.choice(kibar_reddetme_cevaplari), ensure_ascii=False)
        })

    print(f"-> {len(veriler)} adet konu dışı veri (reddetme) eklendi.")
    return veriler


# -----------------------------------------------------------------------------
# ADIM 4: ANA SCRIPT'İ ÇALIŞTIR
# -----------------------------------------------------------------------------
def main():
    print("Süper Veri Seti Oluşturucu Başlatıldı...")
    
    # Tüm verileri toplayacağımız ana liste
    tum_veriler = []

    # 1. Sosyal verileri işle
    tum_veriler.extend(islem_sosyal_veriler(INTENTS_ENG_DOSYASI))
    
    # 2. Eylem verilerini işle
    tum_veriler.extend(islem_eylem_verileri(TRAIN_DATA_DOSYASI))
    
    # 3. Sentetik siparişleri üret
    tum_veriler.extend(islem_sentetik_siparisler(ITEMS_DOSYASI))
    
    # 4. Konu dışı verileri işle
    tum_veriler.extend(islem_konu_disi(CONVERSATION_DOSYASI))

    # Tüm veriyi karıştır, böylece model sırayla öğrenmez
    random.shuffle(tum_veriler)
    
    # Her şeyi dosyaya yaz
    try:
        with open(CIKTI_DOSYASI, 'w', encoding='utf-8') as f:
            dosyaya_yaz(tum_veriler, f)
            
        print("\n-------------------------------------------------")
        print(f"BAŞARILI! Toplam {len(tum_veriler)} adet veri satırı oluşturuldu.")
        print(f"Dosyanız hazır: {CIKTI_DOSYASI}")
        print("-------------------------------------------------")
        
    except IOError as e:
        print(f"HATA: Çıktı dosyası yazılamadı: {e}")
    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu: {e}")

# Script'i çalıştır
if __name__ == "__main__":
    main()


