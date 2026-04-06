package com.garson.backend.model;

import com.garson.backend.analytics.CustomerInteractionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "customer_interaction_events")
@Data
@NoArgsConstructor
public class CustomerInteractionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 80)
    private CustomerInteractionType eventType;

    @Column(name = "session_id", length = 120)
    private String sessionId;

    @Column(name = "table_no", length = 64)
    private String tableNo;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "metadata", length = 2048)
    private String metadata;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
