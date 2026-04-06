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
                new SeedProduct("Pizza", 320.0, 20, "Pizza", "Ince hamur uzerinde gunluk malzemeler ile hazirlanir.",
                        "popular,sicak servis"),
                new SeedProduct("Margherita Pizza", 290.0, 24, "Pizza", "Domates sos, mozzarella ve feslegenli klasik pizza.",
                        "sicak servis"),
                new SeedProduct("Karisik Pizza", 345.0, 18, "Pizza", "Et, sebze ve peynir dengesiyle firindan cikar.",
                        "popular,sicak servis"),
                new SeedProduct("Lahmacun", 75.0, 100, "Kebap", "Ince hamur uzerinde baharatli ic harc ile firinlanir.",
                        "popular,sicak servis"),
                new SeedProduct("Adana Kebap", 290.0, 30, "Kebap", "Acili secenekleriyle izgara kozmopoliti.",
                        "sicak servis"),
                new SeedProduct("Tavuk Sis", 260.0, 36, "Kebap", "Marine edilmis tavuk sis, pilav ve sumakli sogan ile.",
                        "tavuk,sicak servis"),
                new SeedProduct("Izgara Kofte", 280.0, 34, "Kebap", "Klasik izgara kofte tabagi.",
                        "sicak servis"),
                new SeedProduct("Mercimek Corbasi", 95.0, 60, "Corba", "Gunun sicak baslangici icin mercimek corbasi.",
                        "acisiz,sicak servis"),
                new SeedProduct("Ezogelin Corbasi", 100.0, 50, "Corba", "Baharatli ve limonla servis edilen corba.",
                        "sicak servis"),
                new SeedProduct("Patates Kizartmasi", 60.0, 150, "Atistirmalik", "Citir patates kizartmasi.",
                        "popular"),
                new SeedProduct("Sogan Halkasi", 70.0, 80, "Atistirmalik", "Citir kaplamali sogan halkasi.",
                        "atistirmalik"),
                new SeedProduct("Coban Salata", 55.0, 80, "Salata", "Mevsim sebzeleri ile hazirlanmis ferah salata.",
                        "acisiz,vegan"),
                new SeedProduct("Sezar Salata", 135.0, 45, "Salata", "Kivircik, kruton ve parmesanla servis edilir.",
                        "acisiz"),
                new SeedProduct("Menemen", 135.0, 40, "Kahvaltilik", "Domates, biber ve yumurtali sicak kahvalti secenegi.",
                        "popular,sicak servis"),
                new SeedProduct("Kasarli Tost", 90.0, 55, "Kahvaltilik", "Kasar peynirli tost.",
                        "acisiz"),
                new SeedProduct("Tiramisu", 110.0, 40, "Tatli", "Maskarpone kremasi ile katmanli italyan tatlisi.",
                        "sutlu tatli,popular"),
                new SeedProduct("Sutlac", 70.0, 50, "Tatli", "Firinlanmis sutlu tatli secenegi.",
                        "sutlu tatli,acisiz"),
                new SeedProduct("Cheesecake", 120.0, 38, "Tatli", "Meyve soslu New York usulu cheesecake.",
                        "sutlu tatli"),
                new SeedProduct("Brownie", 105.0, 42, "Tatli", "Yumusak dokulu cikolatali brownie.",
                        "tatli"),
                new SeedProduct("Kola", 50.0, 200, "Icecek", "Soguk servis edilir.", "acisiz,popular"),
                new SeedProduct("Ayran", 30.0, 150, "Icecek", "Geleneksel soguk ayran.", "acisiz,popular"),
                new SeedProduct("Su", 15.0, 500, "Icecek", "Sise su.", "acisiz"),
                new SeedProduct("Cay", 25.0, 300, "Icecek", "Ince belli bardakta sicak cay.", "acisiz,sicak servis"),
                new SeedProduct("Kahve", 80.0, 100, "Icecek", "Demleme kahve secenegi.", "acisiz,sicak servis"),
                new SeedProduct("Limonata", 55.0, 90, "Icecek", "Taze limonla hazirlanmis ferah icecek.", "acisiz"));
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
        if (containsAny(normalizedName, "corba", "kebap", "pizza", "lahmacun")) {
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
