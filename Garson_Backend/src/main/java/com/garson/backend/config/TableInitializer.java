package com.garson.backend.config;

import com.garson.backend.model.RestaurantTable;
import com.garson.backend.model.TableStatus;
import com.garson.backend.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TableInitializer implements CommandLineRunner {

    private final RestaurantTableRepository tableRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        normalizeLegacyOrders();

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

    private void normalizeLegacyOrders() {
        int fixedVersion = jdbcTemplate.update("UPDATE orders SET version = 0 WHERE version IS NULL");
        int fixedCreatedAt = jdbcTemplate.update("UPDATE orders SET created_at = NOW() WHERE created_at IS NULL");
        int fixedUpdatedAt = jdbcTemplate.update("UPDATE orders SET updated_at = NOW() WHERE updated_at IS NULL");

        if (fixedVersion + fixedCreatedAt + fixedUpdatedAt > 0) {
            System.out.println("Normalized legacy order rows. version=" + fixedVersion
                    + ", created_at=" + fixedCreatedAt
                    + ", updated_at=" + fixedUpdatedAt);
        }
    }
}
