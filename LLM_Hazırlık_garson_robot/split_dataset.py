import json
import random
import os

# -----------------------------------------------------------------------------
# AYARLAR
# -----------------------------------------------------------------------------

# Ana kaynak dosyamız (bir önceki script'in çıktısı)
ANA_DOSYA = "final_dataset.jsonl"

# Çıktı dosyalarımızın isimleri
TRAIN_DOSYASI = "train_dataset.jsonl"
VALIDATION_DOSYASI = "validation_dataset.jsonl"
TEST_DOSYASI = "test_dataset.jsonl"

# Bölme oranları
# %90 Eğitim, %5 Doğrulama, %5 Test
TRAIN_ORANI = 0.90
VALIDATION_ORANI = 0.05
#TEST_ORANI = 0.05 

# Karıştırma için rastgelelik kilidi (Her seferinde aynı sonucu almak için)
RASTGELE_SEED = 42

# -----------------------------------------------------------------------------
# ANA SCRIPT
# -----------------------------------------------------------------------------

def main():
    print(f"Veri Seti Bölücü Başlatıldı...")
    print(f"Kaynak dosya: {ANA_DOSYA}")

    # 1. Adım: Ana dosyayı oku ve tüm satırları belleğe al
    if not os.path.exists(ANA_DOSYA):
        print(f"HATA: '{ANA_DOSYA}' bulunamadı. Önce 'veri_hazirla.py' script'ini çalıştırdığından emin ol.")
        return

    try:
        with open(ANA_DOSYA, 'r', encoding='utf-8') as f:
            # Her satırı okuyup, geçerli bir JSON objesi olarak listeye ekle
            tum_veriler = [json.loads(satir) for satir in f if satir.strip()]
        
        print(f"Toplam {len(tum_veriler)} adet veri satırı başarıyla okundu.")

    except json.JSONDecodeError as e:
        print(f"HATA: Dosya okunurken bir JSON hatası oluştu: {e}")
        print("Lütfen 'final_dataset.jsonl' dosyasının formatını kontrol et.")
        return
    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu (okuma): {e}")
        return

    # 2. Adım: Veri setini karıştır
    # Bu, verilerin sırasının (örn: tüm sosyal veriler başta) bir önemi kalmamasını sağlar.
    print(f"Veri seti {RASTGELE_SEED} seed'i ile karıştırılıyor...")
    random.seed(RASTGELE_SEED)
    random.shuffle(tum_veriler)

    # 3. Adım: Veriyi oranlara göre böl
    toplam_veri_sayisi = len(tum_veriler)
    train_son_index = int(toplam_veri_sayisi * TRAIN_ORANI)
    validation_son_index = int(toplam_veri_sayisi * (TRAIN_ORANI + VALIDATION_ORANI))

    train_seti = tum_veriler[:train_son_index]
    validation_seti = tum_veriler[train_son_index:validation_son_index]
    test_seti = tum_veriler[validation_son_index:] # Geriye kalan her şey test seti

    print("\nVeri seti bölündü:")
    print(f"  Eğitim (Train)    : {len(train_seti)} satır (%{TRAIN_ORANI * 100})")
    print(f"  Doğrulama (Valid) : {len(validation_seti)} satır (~%{VALIDATION_ORANI * 100})")
    print(f"  Test (Test)       : {len(test_seti)} satır (~%{100 - (TRAIN_ORANI + VALIDATION_ORANI) * 100})")

    # 4. Adım: Yeni dosyaları yaz
    print("\nDosyalar yazılıyor...")
    
    try:
        # Helper fonksiyon
        def dosya_yaz(dosya_adi, veri_seti):
            with open(dosya_adi, 'w', encoding='utf-8') as f:
                for satir in veri_seti:
                    json_str = json.dumps(satir, ensure_ascii=False)
                    f.write(json_str + "\n")
            print(f"-> '{dosya_adi}' başarıyla oluşturuldu.")

        # Dosyaları yaz
        dosya_yaz(TRAIN_DOSYASI, train_seti)
        dosya_yaz(VALIDATION_DOSYASI, validation_seti)
        dosya_yaz(TEST_DOSYASI, test_seti)
        
        print("\n-------------------------------------------------")
        print("BAŞARILI! Veri seti 3 parçaya bölündü.")
        print("-------------------------------------------------")

    except IOError as e:
        print(f"HATA: Çıktı dosyaları yazılamadı: {e}")
    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu (yazma): {e}")

# Script'i çalıştır
if __name__ == "__main__":
    main()

