package com.garson.backend.alerts;

import com.garson.backend.automation.AutomationProperties;
import com.garson.backend.config.AppProperties;
import com.garson.backend.model.Product;
import com.garson.backend.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class LowStockAlertService {

    private static final String CHANNEL = "low-stock";
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm");

    private final NotificationService notificationService;
    private final AlertDeduplicationService deduplicationService;
    private final AutomationProperties automationProperties;
    private final AppProperties appProperties;

    public void notifyIfNeeded(Product product, String triggerSource) {
        if (!automationProperties.isEnabled()) {
            return;
        }
        if (product == null || product.getId() == null) {
            return;
        }

        int stock = product.getStock() == null ? 0 : product.getStock();
        int threshold = Math.max(0, automationProperties.getLowStockThresholdDefault());
        String dedupKey = "product:" + product.getId();

        if (stock > threshold) {
            deduplicationService.reset(CHANNEL, dedupKey);
            return;
        }

        Duration cooldown = Duration.ofMinutes(Math.max(1L, automationProperties.getLowStockAlertCooldownMinutes()));
        boolean shouldSend = deduplicationService.shouldSend(CHANNEL, dedupKey, cooldown);
        if (!shouldSend) {
            return;
        }

        String title = "Garson Robot - Dusuk Stok Alarmi";
        String message = """
                Urun: %s
                Kalan stok: %d
                Esik: %d
                Tetikleyici: %s
                Zaman: %s
                """.formatted(
                safe(product.getName()),
                stock,
                threshold,
                safe(triggerSource),
                nowFormatted());

        CompletableFuture.runAsync(() -> {
            try {
                notificationService.sendMessage(title, message);
            } catch (Exception ex) {
                log.warn("Low-stock notification failed for productId={}: {}", product.getId(), ex.getMessage());
            }
        });
    }

    private String nowFormatted() {
        ZoneId zoneId = resolveZoneId();
        return ZonedDateTime.now(zoneId).format(DATE_TIME_FORMATTER);
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
