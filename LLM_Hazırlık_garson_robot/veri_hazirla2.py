import json
import csv
import random
import os
import re

# -----------------------------------------------------------------------------
# ADIM 1: TEMEL AYARLAR
# -----------------------------------------------------------------------------

# Modelimizin kişiliği ('karakuli')
SISTEM_PROMPT = ("Sen 'RoboKafe' isimli bir kafede çalışan 'karakuli' adında, "
                 "kibar, yardımsever ve profesyonel bir garson robotsun. "
                 "Müşteri taleplerine göre JSON formatında eylem çıktıları üretirsin.")

# Çıktı dosyamızın adı
CIKTI_DOSYASI = "final_dataset.jsonl"

# GEREKLİ OLAN TEK DOSYA:
ITEMS_DOSYASI = "items.csv" # Sentetik siparişler için

# KULLANILMAYANLAR (TÜM SORUNLARIN KAYNAĞI):
# train_data.csv (İngilizce Eylemler)
# Conversation.csv (İngilizce Konu Dışı)
# intents_english.json (İngilizce Sosyal)

# -----------------------------------------------------------------------------
# ADIM 2: YARDIMCI FONKSİYON
# -----------------------------------------------------------------------------

def dosyaya_yaz(veri_listesi, dosya_yazici):
    for veri in veri_listesi:
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

# --- FONKSİYON 1: TÜRKÇE TEMEL VERİLER (SOSYAL + KONU DIŞI + EYLEM) ---
# Bu fonksiyon, o 3 bozuk dosyanın (Conversation, Intents, Train_Data)
# tamamının işini TEK BAŞINA ve %100 TÜRKÇE olarak yapar.
def islem_turkce_temel_veriler():
    """
    Modelin kafa karışıklığını gidermek için küçük, temiz ve 
    %100 Türkçe sosyal, konu dışı VE temel eylem verileri oluşturur.
    """
    print("[İşlem 1/2] Temiz Türkçe temel veriler (Sosyal, Konu Dışı, Eylem) üretiliyor...")
    veriler = []
    
    # 1. Sosyal: Selamlama (Düz Metin Çıktı)
    selamlamalar = ["merhaba", "selam", "iyi günler", "kolay gelsin", "merhabalar"]
    selam_cevaplari = [
        "Merhaba efendim, hoş geldiniz! Size nasıl yardımcı olabilirim?",
        "Merhaba, hoş geldiniz. Buyurun lütfen."
    ]
    for soru in selamlamalar:
        for _ in range(50): # Sayıyı biraz artıralım (50 veri)
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": soru,
                "output": random.choice(selam_cevaplari) # Düz metin
            })
            
    # 2. Sosyal: Vedalaşma (Düz Metin Çıktı)
    vedalar = ["görüşürüz", "hoşçakal", "iyi akşamlar", "gitmem lazım"]
    veda_cevaplari = [
        "Görüşmek üzere efendim, yine bekleriz.",
        "İyi günler dilerim."
    ]
    for soru in vedalar:
        for _ in range(10): # (40 veri)
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": soru,
                "output": random.choice(veda_cevaplari) # Düz metin
            })

    # 3. Sosyal: Teşekkür (Düz Metin Çıktı)
    tesekkurler = ["teşekkürler", "teşekkür ederim", "sağ ol", "eline sağlık"]
    tesekkur_cevaplari = [
        "Rica ederim efendim, afiyet olsun.",
        "Rica ederim, her zaman."
    ]
    for soru in tesekkurler:
        for _ in range(50): # (200 veri)
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": soru,
                "output": random.choice(tesekkur_cevaplari) # Düz metin
            })

    # 4. Konu Dışı (JSON Çıktısı - ZORUNLU)
    konu_disi_sorular = [
        "hava bugün nasıl ya", "nasılsın", "maç kaç kaç bitti", "nerelisin",
        "sen robot musun", "adın ne", "ne iş yapıyorsun", "okula gidiyor musun",
        "hangi takımlısın", "en sevdiğin yemek ne"
    ]
    konu_disi_cevap = {
        "eylem": "konu_disi",
        "cevap": "Efendim, ben bir garson robotum ve sadece menü ve siparişler hakkında yardımcı olabiliyorum."
    }
    for soru in konu_disi_sorular:
        for _ in range(50): # (500 veri)
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": soru,
                "output": json.dumps(konu_disi_cevap, ensure_ascii=False) # JSON
            })

    # 5. Temel Eylemler (JSON Çıktısı - ZORUNLU)
    # (train_data.csv'deki 30.000 İngilizce çöp yerine)
    eylemler = [
        # Sipariş İptali
        ("siparişimi iptal etmek istiyorum", {"eylem": "siparis_iptal", "cevap": "Sipariş iptal talebinizi anladım, ilgili birime iletiyorum."}),
        ("o siparişi iptal et lütfen", {"eylem": "siparis_iptal", "cevap": "Sipariş iptal talebinizi anladım, ilgili birime iletiyorum."}),
        # Alerjen Bilgisi
        ("alerjen bilgisi alabilir miyim", {"eylem": "bilgi_alerjen", "cevap": "Elbette, alerjen bilgisi için RAG sistemimi kontrol ediyorum."}),
        ("bu üründe ne var", {"eylem": "bilgi_alerjen", "cevap": "Elbette, alerjen bilgisi için RAG sistemimi kontrol ediyorum."}),
        # Menü Bilgisi (RAG'ı tetikleyecek)
        ("menüde ne var", {"eylem": "bilgi_menu", "cevap": "Elbette, menü bilgisi için RAG sistemimi kontrol ediyorum."}),
        ("fiyatları öğrenebilir miyim", {"eylem": "bilgi_menu", "cevap": "Elbette, menü bilgisi için RAG sistemimi kontrol ediyorum."}),
        # İnsan Çağırma
        ("bir insanla konuşmak istiyorum", {"eylem": "insan_cagir", "cevap": "Size yardımcı olamadığım için üzgünüm. Hemen bir insan yetkiliye haber veriyorum."}),
        ("senden bir bok olmaz, müdürünü çağır", {"eylem": "insan_cagir", "cevap": "Anlıyorum. Hemen bir insan yetkiliye haber veriyorum."})
    ]
    
    for soru, cevap_json in eylemler:
        for _ in range(50): # (8 * 50 = 400 veri)
            veriler.append({
                "instruction": SISTEM_PROMPT,
                "input": soru,
                "output": json.dumps(cevap_json, ensure_ascii=False) # JSON
            })
            
    print(f"-> {len(veriler)} adet temiz Türkçe veri (sosyal + konu dışı + eylem) eklendi.")
    return veriler

# --- FONKSİYON 2: SENTETİK SİPARİŞLER (Gerekli) ---
def islem_sentetik_siparisler(menu_dosyasi):
    print(f"[İşlem 2/2] Sentetik siparişler üretiliyor ({menu_dosyasi})...")
    veriler = []
    
    if not os.path.exists(menu_dosyasi):
        print(f"UYARI: '{menu_dosyasi}' bulunamadı. Bu adım atlanıyor.")
        return []

    urunler = []
    with open(menu_dosyasi, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
            # Sütun adını tam olarak al (başındaki/sonundaki boşlukları temizle)
            header = [h.strip() for h in header]
            item_index = header.index("item_name")
        except StopIteration:
            print(f"HATA: '{menu_dosyasi}' boş.")
            return []
        except ValueError:
            print(f"HATA: '{menu_dosyasi}' içinde 'item_name' sütunu bulunamadı.")
            return []
            
        for row in reader:
            if row:
                urun_adi = row[item_index].strip()
                if urun_adi and len(urun_adi) > 2:
                    urunler.append(urun_adi)
    
    urunler = list(set(urunler))
    if not urunler:
        print("HATA: Menüden hiç ürün okunamadı.")
        return []
        
    print(f"-> Menüden {len(urunler)} adet eşsiz ürün bulundu (örn: {random.choice(urunler)})")

    # Sipariş kalıplarını TÜRKÇELEŞTİRDİK
    siparis_kaliplari = [
        "Bana bir {}", "Bir {} alabilir miyim?", "{} istiyorum lütfen.", "Bir adet {} alacağım.",
        "Masaya bir {} yollar mısınız?", "Menüden {} alalım.", "{} var mı?",
        "Sanırım bir {} içeceğim.", "{} alayım.",
        "Bana bir {}, bir de {} lütfen.", "İki {}, bir {} alalım."
    ]
    
    # Çok fazla sentetik veriye gerek yok, 500-1000 arası yeterli
    toplam_sentetik_veri = 0
    while toplam_sentetik_veri < 1000:
        kalip = random.choice(siparis_kaliplari)
        try:
            gerekli_urun_sayisi = kalip.count("{}")
            secilen_urunler = random.sample(urunler, gerekli_urun_sayisi)
            input_text = kalip.format(*secilen_urunler)
            
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
            toplam_sentetik_veri += 1
        except ValueError:
            continue 
        except Exception as e:
            print(f"Sentetik veri üretirken hata: {e}")
            
    print(f"-> {len(veriler)} adet sentetik sipariş verisi üretildi.")
    return veriler

# -----------------------------------------------------------------------------
# ADIM 4: ANA SCRIPT'İ ÇALIŞTIR
# -----------------------------------------------------------------------------
def main():
    print("Süper Veri Seti Oluşturucu (v3 - FİNAL TÜRKÇE) Başlatıldı...")
    tum_veriler = []

    # 1. TEMİZ TÜRKÇE VERİLERİ (SOSYAL, OOD, EYLEM) EKLE
    tum_veriler.extend(islem_turkce_temel_veriler())
    
    # 2. SENTETİK SİPARİŞ VERİLERİNİ (TÜRKÇE) EKLE
    tum_veriler.extend(islem_sentetik_siparisler(ITEMS_DOSYASI))
    
    # Kapatılan (İngilizce Çöp) fonksiyonlar:
    # tum_veriler.extend(islem_eylem_verileri(TRAIN_DATA_DOSYASI))
    # tum_veriler.extend(islem_sosyal_veriler(INTENTS_ENG_DOSYASI))
    # tum_veriler.extend(islem_konu_disi(CONVERSATION_DOSYASI))

    random.shuffle(tum_veriler)
    
    try:
        with open(CIKTI_DOSYASI, 'w', encoding='utf-8') as f:
            dosyaya_yaz(tum_veriler, f)
            
        print("\n-------------------------------------------------")
        print(f"BAŞARILI! Toplam {len(tum_veriler)} adet veri satırı oluşturuldu.")
        print(f"Dosyanız hazır: {CIKTI_DOSYASI}")
        print("-------------------------------------------------")
        
    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu: {e}")

if __name__ == "__main__":
    main()


