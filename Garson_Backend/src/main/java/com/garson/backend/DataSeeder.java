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
                // If the user wants dynamic menu testing, we'll ensure these diverse items
                // exist without duplicates
                List<Product> items = List.of(
                        new Product("Hamburger", 250.0, 50),
                        new Product("Pizza", 320.0, 20),
                        new Product("Lahmacun", 75.0, 100),
                        new Product("Patates Kızartması", 60.0, 150),
                        new Product("Çoban Salata", 55.0, 80),
                        new Product("Tiramisu", 110.0, 40),
                        new Product("Sütlaç", 70.0, 50),
                        new Product("Kola", 50.0, 200),
                        new Product("Ayran", 30.0, 150),
                        new Product("Su", 15.0, 500),
                        new Product("Çay", 25.0, 300),
                        new Product("Kahve", 80.0, 100));

                for (Product item : items) {
                    if (repository.findByNameIgnoreCase(item.getName()).isEmpty()) {
                        repository.save(item);
                    }
                }
            }
        };
    }
}
