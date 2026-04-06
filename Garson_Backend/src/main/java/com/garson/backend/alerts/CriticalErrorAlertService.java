package com.garson.backend.alerts;

import com.garson.backend.automation.AutomationProperties;
import com.garson.backend.config.AppProperties;
import com.garson.backend.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class CriticalErrorAlertService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss");

    private final NotificationService notificationService;
    private final AutomationProperties automationProperties;
    private final AppProperties appProperties;

    public void notifyCriticalError(String message, String details) {
        if (!automationProperties.isEnabled()) {
            return;
        }

        String title = "Garson Robot - Kritik Hata";
        String text = """
                Mesaj: %s
                Detay: %s
                Zaman: %s
                """.formatted(safe(message), safe(details), nowFormatted());

        CompletableFuture.runAsync(() -> {
            try {
                notificationService.sendMessage(title, text);
            } catch (Exception ex) {
                log.warn("Critical error alert delivery failed: {}", ex.getMessage());
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
