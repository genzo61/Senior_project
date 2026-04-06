package com.garson.backend.analytics;

import com.garson.backend.config.AppProperties;
import com.garson.backend.model.CustomerInteractionEvent;
import com.garson.backend.repository.CustomerInteractionEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerInteractionService {

    private final CustomerInteractionEventRepository repository;
    private final AppProperties appProperties;

    public void trackByName(String eventType, String sessionId, String tableNo, Integer quantity, String metadata) {
        Optional<CustomerInteractionType> resolvedType = CustomerInteractionType.fromValue(eventType);
        if (resolvedType.isEmpty()) {
            log.debug("Unknown customer interaction event type: {}", eventType);
            return;
        }
        track(resolvedType.get(), sessionId, tableNo, quantity, metadata);
    }

    public void track(CustomerInteractionType type, String sessionId, String tableNo, Integer quantity, String metadata) {
        if (type == null) {
            return;
        }
        int safeQuantity = quantity == null || quantity < 1 ? 1 : quantity;
        CustomerInteractionEvent event = new CustomerInteractionEvent();
        event.setEventType(type);
        event.setSessionId(safe(sessionId));
        event.setTableNo(safe(tableNo));
        event.setQuantity(safeQuantity);
        event.setMetadata(safe(metadata));
        event.setOccurredAt(Instant.now());
        event.setCreatedAt(Instant.now());
        repository.save(event);
    }

    public CustomerInteractionMetrics getMetrics(LocalDate date) {
        LocalDate safeDate = date == null ? nowInZone().toLocalDate() : date;
        ZonedDateTime start = safeDate.atStartOfDay(resolveZoneId());
        ZonedDateTime end = start.plusDays(1);

        List<CustomerInteractionEvent> events = repository
                .findByOccurredAtGreaterThanEqualAndOccurredAtLessThan(start.toInstant(), end.toInstant());

        CustomerInteractionMetrics metrics = new CustomerInteractionMetrics();
        for (CustomerInteractionEvent event : events) {
            if (event == null || event.getEventType() == null) {
                continue;
            }
            int quantity = event.getQuantity() == null || event.getQuantity() < 1 ? 1 : event.getQuantity();
            metrics.increment(event.getEventType(), quantity);
        }
        return metrics;
    }

    private ZonedDateTime nowInZone() {
        return ZonedDateTime.now(resolveZoneId());
    }

    private ZoneId resolveZoneId() {
        String timezone = safe(appProperties.getTimezone());
        try {
            return ZoneId.of(timezone.isEmpty() ? "Europe/Istanbul" : timezone);
        } catch (Exception ex) {
            return ZoneId.of("Europe/Istanbul");
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
