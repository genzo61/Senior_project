package com.garson.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "restaurant_tables")
@Data
@NoArgsConstructor
public class RestaurantTable {

    @Id
    private Long id; // We will use manual ID assignment for table numbers (1 to 10)

    @Enumerated(EnumType.STRING)
    private TableStatus status = TableStatus.EMPTY;

    private Instant lastStatusChange = Instant.now();

    @PreUpdate
    public void preUpdate() {
        this.lastStatusChange = Instant.now();
    }
}
