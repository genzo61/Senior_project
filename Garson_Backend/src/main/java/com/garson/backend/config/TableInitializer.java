package com.garson.backend.config;

import com.garson.backend.model.RestaurantTable;
import com.garson.backend.model.TableStatus;
import com.garson.backend.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TableInitializer implements CommandLineRunner {

    private final RestaurantTableRepository tableRepository;

    @Override
    public void run(String... args) throws Exception {
        if (tableRepository.count() == 0) {
            System.out.println("Initializing 10 default tables...");
            for (long i = 1; i <= 10; i++) {
                RestaurantTable table = new RestaurantTable();
                table.setId(i);
                table.setStatus(TableStatus.EMPTY);
                tableRepository.save(table);
            }
            System.out.println("Default tables initialized.");
        }
    }
}
