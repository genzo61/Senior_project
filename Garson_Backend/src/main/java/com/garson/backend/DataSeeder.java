package com.garson.backend;

import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner initDatabase(ProductRepository repository) {
        return args -> {
            if (repository.count() <= 8) {
                List<Product> items = List.of(
                        buildProduct("Hamburger", 250.0, 50),
                        buildProduct("Pizza", 320.0, 20),
                        buildProduct("Lahmacun", 75.0, 100),
                        buildProduct("Patates Kizartmasi", 60.0, 150),
                        buildProduct("Coban Salata", 55.0, 80),
                        buildProduct("Tiramisu", 110.0, 40),
                        buildProduct("Sutlac", 70.0, 50),
                        buildProduct("Kola", 50.0, 200),
                        buildProduct("Ayran", 30.0, 150),
                        buildProduct("Su", 15.0, 500),
                        buildProduct("Cay", 25.0, 300),
                        buildProduct("Kahve", 80.0, 100));

                for (Product item : items) {
                    if (repository.findByNameIgnoreCase(item.getName()).isEmpty()) {
                        repository.save(item);
                    }
                }
            }

            repository.findAll().forEach(product -> {
                boolean changed = applyDefaultMetadataIfMissing(product);
                if (changed) {
                    repository.save(product);
                }
            });
        };
    }

    private Product buildProduct(String name, Double price, Integer stock) {
        Product product = new Product(name, price, stock);
        applyDefaultMetadataIfMissing(product);
        return product;
    }

    private boolean applyDefaultMetadataIfMissing(Product product) {
        String normalizedName = normalize(product.getName());

        String category = inferCategory(normalizedName);
        String description = inferDescription(product.getName(), category);
        String tags = inferTags(normalizedName);

        boolean changed = false;

        if (isBlank(product.getCategory())) {
            product.setCategory(category);
            changed = true;
        }

        if (isBlank(product.getDescription())) {
            product.setDescription(description);
            changed = true;
        }

        if (isBlank(product.getTags())) {
            product.setTags(tags);
            changed = true;
        }

        return changed;
    }

    private String inferCategory(String normalizedName) {
        if (containsAny(normalizedName, "kola", "ayran", "su", "cay", "kahve")) {
            return "Icecek";
        }
        if (containsAny(normalizedName, "sutlac", "tiramisu")) {
            return "Tatli";
        }
        if (containsAny(normalizedName, "salata")) {
            return "Salata";
        }
        if (containsAny(normalizedName, "patates")) {
            return "Atistirmalik";
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
        return name + " mutfagin mevcut menusu icinde servis edilir.";
    }

    private String inferTags(String normalizedName) {
        StringBuilder tags = new StringBuilder("popular");
        if (containsAny(normalizedName, "sutlac", "tiramisu")) {
            tags.append(",sutlu tatli");
        }
        if (containsAny(normalizedName, "kola", "ayran", "su", "cay", "kahve", "salata")) {
            tags.append(",acisiz");
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
}
