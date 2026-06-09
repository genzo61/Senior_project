package com.garson.backend;

import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner initDatabase(ProductRepository repository) {
        return args -> {
            for (SeedProduct seed : defaultCatalog()) {
                Optional<Product> existing = repository.findByNameIgnoreCase(seed.getName());
                if (existing.isPresent()) {
                    Product current = existing.get();
                    boolean changed = applySeedMetadata(current, seed);
                    changed = applyDefaultMetadataIfMissing(current, seed) || changed;
                    if (changed) {
                        repository.save(Objects.requireNonNull(current));
                    }
                    continue;
                }

                Product created = new Product(seed.getName(), seed.getPrice(), seed.getStock());
                created.setCategory(seed.getCategory());
                created.setDescription(seed.getDescription());
                created.setTags(seed.getTags());
                repository.save(created);
            }

            repository.findAll().forEach(product -> {
                boolean changed = applyDefaultMetadataIfMissing(product, null);
                if (changed) {
                    repository.save(Objects.requireNonNull(product));
                }
            });
        };
    }

    private List<SeedProduct> defaultCatalog() {
        return List.of(
                new SeedProduct("Hamburger", 250.0, 50, "Burger", "Izgara et, taze ekmek ve ozel sos ile servis edilir.",
                        "popular,sicak servis"),
                new SeedProduct("Cheeseburger", 275.0, 35, "Burger", "Eritilmis cheddar ile zenginlestirilmis burger secenegi.",
                        "popular,sicak servis"),
                new SeedProduct("Tavuk Burger", 230.0, 40, "Burger", "Citir tavuk fileto ile hazirlanan hafif burger.",
                        "tavuk,popular,sicak servis"),
                new SeedProduct("Double Cheeseburger", 335.0, 28, "Burger", "Cift kat et ve cheddar ile daha doyurucu burger secenegi.",
                        "popular,sicak servis"),
                new SeedProduct("BBQ Burger", 305.0, 26, "Burger", "Barbeku sos, karamelize sogan ve izgara et ile hazirlanir.",
                        "popular,sicak servis"),
                new SeedProduct("Mantarli Burger", 295.0, 24, "Burger", "Sotelenmis mantar ve ozel sos ile servis edilen burger.",
                        "sicak servis"),
                new SeedProduct("Pizza", 320.0, 20, "Pizza", "Ince hamur uzerinde gunluk malzemeler ile hazirlanir.",
                        "popular,sicak servis"),
                new SeedProduct("Margherita Pizza", 290.0, 24, "Pizza", "Domates sos, mozzarella ve feslegenli klasik pizza.",
                        "sicak servis"),
                new SeedProduct("Karisik Pizza", 345.0, 18, "Pizza", "Et, sebze ve peynir dengesiyle firindan cikar.",
                        "popular,sicak servis"),
                new SeedProduct("Pepperoni Pizza", 340.0, 22, "Pizza", "Bol pepperoni dilimleriyle firindan sicak servis edilir.",
                        "popular,sicak servis"),
                new SeedProduct("Dört Peynir Pizza", 330.0, 20, "Pizza", "Mozzarella, cheddar, parmesan ve beyaz peynir ile hazirlanir.",
                        "sicak servis"),
                new SeedProduct("Vejetaryen Pizza", 310.0, 18, "Pizza", "Mantar, biber, misir ve zeytin ile hafif pizza secenegi.",
                        "vegan,sicak servis"),
                new SeedProduct("Lahmacun", 75.0, 100, "Kebap", "Ince hamur uzerinde baharatli ic harc ile firinlanir.",
                        "popular,sicak servis"),
                new SeedProduct("Adana Kebap", 290.0, 30, "Kebap", "Acili secenekleriyle izgara kozmopoliti.",
                        "sicak servis"),
                new SeedProduct("Tavuk Sis", 260.0, 36, "Kebap", "Marine edilmis tavuk sis, pilav ve sumakli sogan ile.",
                        "tavuk,sicak servis"),
                new SeedProduct("Izgara Kofte", 280.0, 34, "Kebap", "Klasik izgara kofte tabagi.",
                        "sicak servis"),
                new SeedProduct("Urfa Kebap", 290.0, 28, "Kebap", "Daha yumusak baharat profiline sahip klasik kebap secenegi.",
                        "sicak servis"),
                new SeedProduct("Tavuk Döner", 220.0, 40, "Kebap", "Pilav veya ekmek yaninda servis edilen tavuk doner.",
                        "tavuk,popular,sicak servis"),
                new SeedProduct("Et Doner", 255.0, 32, "Kebap", "Yumusak dana doner dilimleriyle servis edilir.",
                        "popular,sicak servis"),
                new SeedProduct("İskender Kebap", 330.0, 20, "Kebap", "Tereyagli sos, pide ve yogurt esliginde servis edilir.",
                        "popular,sicak servis"),
                new SeedProduct("Mercimek Çorbasi", 95.0, 60, "Corba", "Gunun sicak baslangici icin mercimek corbasi.",
                        "acisiz,sicak servis"),
                new SeedProduct("Ezogelin Çorbasi", 100.0, 50, "Corba", "Baharatli ve limonla servis edilen corba.",
                        "sicak servis"),
                new SeedProduct("Domates Çorbasi", 92.0, 48, "Corba", "Kremali dokusuyla sicak servis edilen klasik domates corbasi.",
                        "acisiz,sicak servis"),
                new SeedProduct("Tavuk Suyu Çorbasi", 105.0, 42, "Corba", "Tel sehriye ile hazirlanan hafif ve sicak corba secenegi.",
                        "acisiz,sicak servis,tavuk"),
                new SeedProduct("Patates Kizartmasi", 60.0, 150, "Atistirmalik", "Citir patates kizartmasi.",
                        "popular"),
                new SeedProduct("Sogan Halkasi", 70.0, 80, "Atistirmalik", "Citir kaplamali sogan halkasi.",
                        "atistirmalik"),
                new SeedProduct("Mozzarella Sticks", 95.0, 65, "Atistirmalik", "Akiskan peynir dolgulu citir atistirmalik.",
                        "popular"),
                new SeedProduct("Tavuk Nugget", 110.0, 70, "Atistirmalik", "Citir pane kaplamali tavuk nugget tabagi.",
                        "tavuk,popular"),
                new SeedProduct("Sigara Boregi", 85.0, 75, "Atistirmalik", "Peynir dolgulu ince yufka boregi.",
                        "atistirmalik"),
                new SeedProduct("Coban Salata", 55.0, 80, "Salata", "Mevsim sebzeleri ile hazirlanmis ferah salata.",
                        "acisiz,vegan"),
                new SeedProduct("Sezar Salata", 135.0, 45, "Salata", "Kivircik, kruton ve parmesanla servis edilir.",
                        "acisiz"),
                new SeedProduct("Akdeniz Salata", 120.0, 52, "Salata", "Beyaz peynir, zeytin ve roka ile zenginlestirilmis salata.",
                        "acisiz"),
                new SeedProduct("Gavurdağı Salata", 125.0, 46, "Salata", "Nar eksili ve cevizli guney usulu salata.",
                        "acisiz,vegan"),
                new SeedProduct("Ton Balıklı Salata", 165.0, 34, "Salata", "Ton baligi ve yesilliklerle hazirlanan yuksek proteinli salata.",
                        "acisiz"),
                new SeedProduct("Menemen", 135.0, 40, "Kahvaltilik", "Domates, biber ve yumurtali sicak kahvalti secenegi.",
                        "popular,sicak servis"),
                new SeedProduct("Kasarli Tost", 90.0, 55, "Kahvaltilik", "Kasar peynirli tost.",
                        "acisiz"),
                new SeedProduct("Sucuklu Tost", 110.0, 42, "Kahvaltilik", "Sucuk ve kasar peyniri ile hazirlanan tost.",
                        "popular,sicak servis"),
                new SeedProduct("Karisik Tost", 120.0, 36, "Kahvaltilik", "Kasar, sucuk ve ek malzemelerle hazirlanan karisik tost.",
                        "popular,sicak servis"),
                new SeedProduct("Kavurmali Tost", 145.0, 24, "Kahvaltilik", "Kavurma ve erimis peynir ile hazirlanan doyurucu tost.",
                        "popular,sicak servis"),
                new SeedProduct("Sucuklu Yumurta", 145.0, 38, "Kahvaltilik", "Tavada sucuk ve yumurta ile hazirlanan kahvaltilik.",
                        "popular,sicak servis"),
                new SeedProduct("Serpme Kahvalti", 420.0, 18, "Kahvaltilik", "Peynir, recel, yumurta ve sicak urunlerle zengin kahvalti tabagi.",
                        "popular"),
                new SeedProduct("Pankek", 115.0, 30, "Kahvaltilik", "Bal, cikolata veya meyve ile servis edilen yumusak pankek.",
                        "popular"),
                new SeedProduct("Tiramisu", 110.0, 40, "Tatli", "Maskarpone kremasi ile katmanli italyan tatlisi.",
                        "sutlu tatli,popular"),
                new SeedProduct("Sutlac", 70.0, 50, "Tatli", "Firinlanmis sutlu tatli secenegi.",
                        "sutlu tatli,acisiz"),
                new SeedProduct("Cheesecake", 120.0, 38, "Tatli", "Meyve soslu New York usulu cheesecake.",
                        "sutlu tatli"),
                new SeedProduct("Brownie", 105.0, 42, "Tatli", "Yumusak dokulu cikolatali brownie.",
                        "tatli"),
                new SeedProduct("Künefe", 130.0, 30, "Tatli", "Antep peyniri ile sicak servis edilen serbetli tatli.",
                        "popular,sicak servis"),
                new SeedProduct("Baklava", 140.0, 36, "Tatli", "Kat kat hamur ve Antep fistikli klasik baklava.",
                        "popular"),
                new SeedProduct("Fistikli Baklava", 155.0, 26, "Tatli", "Bol Antep fistigi ile hazirlanan serbetli baklava.",
                        "popular"),
                new SeedProduct("Cevizli Baklava", 150.0, 24, "Tatli", "Ceviz dolgulu kat kat baklava dilimleri.",
                        "popular"),
                new SeedProduct("Profiterol", 115.0, 28, "Tatli", "Cikolata soslu ve krema dolgulu hafif tatli secenegi.",
                        "sutlu tatli"),
                new SeedProduct("San Sebastian Cheesecake", 150.0, 24, "Tatli", "Yanik yuzeyli kremsi cheesecake dilimi.",
                        "sutlu tatli,popular"),
                new SeedProduct("Kola", 50.0, 200, "Icecek", "Soguk servis edilir.", "acisiz,popular"),
                new SeedProduct("Ayran", 30.0, 150, "Icecek", "Geleneksel soguk ayran.", "acisiz,popular"),
                new SeedProduct("Su", 15.0, 500, "Icecek", "Sise su.", "acisiz"),
                new SeedProduct("Çay", 25.0, 300, "Icecek", "Ince belli bardakta sicak cay.", "acisiz,sicak servis"),
                new SeedProduct("Kahve", 80.0, 100, "Icecek", "Demleme kahve secenegi.", "acisiz,sicak servis"),
                new SeedProduct("Limonata", 55.0, 90, "Icecek", "Taze limonla hazirlanmis ferah icecek.", "acisiz"),
                new SeedProduct("Soda", 20.0, 180, "Icecek", "Serinletici sade maden suyu.", "acisiz"),
                new SeedProduct("Sade Soda", 20.0, 160, "Icecek", "Soguk servis edilen sade maden suyu.", "acisiz"),
                new SeedProduct("Limonlu Soda", 25.0, 140, "Icecek", "Limon aromasi ile ferahlatan soguk soda.", "acisiz"),
                new SeedProduct("Şalgam", 35.0, 95, "Icecek", "Adana usulu geleneksel salgam icecegi.", "acisiz"),
                new SeedProduct("Türk Kahvesi", 65.0, 120, "Icecek", "Kopuklu ve bol aromali Turk kahvesi.", "acisiz,sicak servis"),
                new SeedProduct("Portakal Suyu", 60.0, 85, "Icecek", "Taze sikim portakal suyu.", "acisiz"),
                new SeedProduct("Frappe", 95.0, 70, "Icecek", "Soguk kahve bazli ferah icecek.", "acisiz"),
                new SeedProduct("Napoliten Makarna", 185.0, 32, "Makarna", "Domates soslu ve feslegenli klasik makarna.",
                        "popular,sicak servis"),
                new SeedProduct("Penne Arabiata", 195.0, 28, "Makarna", "Domates sos ve hafif aci notalarla servis edilen penne.",
                        "sicak servis"),
                new SeedProduct("Fettuccine Alfredo", 215.0, 26, "Makarna", "Kremali parmesan sos ile hazirlanan fettuccine.",
                        "popular,sicak servis"),
                new SeedProduct("Mantarli Kremali Makarna", 225.0, 22, "Makarna", "Sotelenmis mantar ve kremali sos ile servis edilir.",
                        "sicak servis"));
    }

    private boolean applyDefaultMetadataIfMissing(Product product, SeedProduct seed) {
        String normalizedName = normalize(product.getName());
        String fallbackCategory = inferCategory(normalizedName);
        String fallbackDescription = inferDescription(product.getName(), fallbackCategory);
        String fallbackTags = inferTags(normalizedName);

        boolean changed = false;

        if (isBlank(product.getCategory())) {
            product.setCategory(seed != null && !isBlank(seed.getCategory()) ? seed.getCategory() : fallbackCategory);
            changed = true;
        }

        if (isBlank(product.getDescription())) {
            product.setDescription(seed != null && !isBlank(seed.getDescription()) ? seed.getDescription() : fallbackDescription);
            changed = true;
        }

        if (isBlank(product.getTags())) {
            product.setTags(seed != null && !isBlank(seed.getTags()) ? seed.getTags() : fallbackTags);
            changed = true;
        }

        return changed;
    }

    private boolean applySeedMetadata(Product product, SeedProduct seed) {
        if (seed == null) {
            return false;
        }

        boolean changed = false;

        if (!isBlank(seed.getCategory()) && !seed.getCategory().equals(product.getCategory())) {
            product.setCategory(seed.getCategory());
            changed = true;
        }

        if (!isBlank(seed.getDescription()) && !seed.getDescription().equals(product.getDescription())) {
            product.setDescription(seed.getDescription());
            changed = true;
        }

        if (!isBlank(seed.getTags()) && !seed.getTags().equals(product.getTags())) {
            product.setTags(seed.getTags());
            changed = true;
        }

        return changed;
    }

    private String inferCategory(String normalizedName) {
        if (containsAny(normalizedName, "kola", "ayran", "su", "cay", "kahve", "limonata")) {
            return "Icecek";
        }
        if (containsAny(normalizedName, "sutlac", "tiramisu", "cheesecake", "brownie")) {
            return "Tatli";
        }
        if (containsAny(normalizedName, "salata")) {
            return "Salata";
        }
        if (containsAny(normalizedName, "corba", "mercimek", "ezogelin")) {
            return "Corba";
        }
        if (containsAny(normalizedName, "omlet", "menemen", "tost", "simit")) {
            return "Kahvaltilik";
        }
        if (containsAny(normalizedName, "patates", "nugget", "halkasi")) {
            return "Atistirmalik";
        }
        if (containsAny(normalizedName, "hamburger", "burger")) {
            return "Burger";
        }
        if (containsAny(normalizedName, "pizza")) {
            return "Pizza";
        }
        if (containsAny(normalizedName, "lahmacun", "kebap", "doner", "kofte", "sis")) {
            return "Kebap";
        }
        if (containsAny(normalizedName, "makarna", "penne", "fettuccine", "alfredo", "arabiata", "napoliten")) {
            return "Makarna";
        }
        return "Ana Yemek";
    }

    private String inferDescription(String name, String category) {
        if ("Icecek".equals(category)) {
            return name + " siparisinize ferah bir eslikci olur.";
        }
        if ("Tatli".equals(category)) {
            return name + " yemek sonrasi tatli tercihi icin uygundur.";
        }
        if ("Corba".equals(category)) {
            return name + " gunun sicak baslangici icin idealdir.";
        }
        if ("Kahvaltilik".equals(category)) {
            return name + " kahvalti saati icin populer seceneklerden biridir.";
        }
        if ("Makarna".equals(category)) {
            return name + " gunluk soslarla hazirlanip sicak servis edilir.";
        }
        return name + " mutfagin mevcut menusu icinde servis edilir.";
    }

    private String inferTags(String normalizedName) {
        StringBuilder tags = new StringBuilder("popular");
        if (containsAny(normalizedName, "sutlac", "tiramisu", "cheesecake")) {
            tags.append(",sutlu tatli");
        }
        if (containsAny(normalizedName, "kola", "ayran", "su", "cay", "kahve", "salata", "limonata")) {
            tags.append(",acisiz");
        }
        if (containsAny(normalizedName, "tavuk")) {
            tags.append(",tavuk");
        }
        if (containsAny(normalizedName, "corba", "kebap", "pizza", "lahmacun", "makarna", "penne", "fettuccine")) {
            tags.append(",sicak servis");
        }
        return tags.toString();
    }

    private boolean containsAny(String text, String... keys) {
        for (String key : keys) {
            if (text.contains(key)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        return value.toLowerCase()
                .replace('\u00e7', 'c')
                .replace('\u011f', 'g')
                .replace('\u0131', 'i')
                .replace('\u00f6', 'o')
                .replace('\u015f', 's')
                .replace('\u00fc', 'u');
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static final class SeedProduct {
        private final String name;
        private final Double price;
        private final Integer stock;
        private final String category;
        private final String description;
        private final String tags;

        private SeedProduct(String name, Double price, Integer stock, String category, String description, String tags) {
            this.name = name;
            this.price = price;
            this.stock = stock;
            this.category = category;
            this.description = description;
            this.tags = tags;
        }

        private String getName() {
            return name;
        }

        private Double getPrice() {
            return price;
        }

        private Integer getStock() {
            return stock;
        }

        private String getCategory() {
            return category;
        }

        private String getDescription() {
            return description;
        }

        private String getTags() {
            return tags;
        }
    }
}
