package com.garson.backend.automation;

import com.garson.backend.alerts.CriticalErrorAlertService;
import com.garson.backend.dto.report.RestockSuggestionsResponseDto;
import com.garson.backend.notification.NotificationService;
import com.garson.backend.service.ReportsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RestockSuggestionScheduler {

    private final AutomationProperties automationProperties;
    private final ReportsService reportsService;
    private final AutomationMessageFormatter formatter;
    private final NotificationService notificationService;
    private final CriticalErrorAlertService criticalErrorAlertService;

    @Scheduled(cron = "${automation.restock-suggestion-cron:0 15 23 * * *}", zone = "${app.timezone:Europe/Istanbul}")
    public void runRestockSuggestionReport() {
        if (!automationProperties.isEnabled()) {
            return;
        }

        try {
            int days = Math.max(1, automationProperties.getRestockSuggestionDays());
            RestockSuggestionsResponseDto report = reportsService.getRestockSuggestions(days);
            notificationService.sendMessage(
                    "Garson Robot - Restock Onerisi",
                    formatter.formatRestockSuggestions(report));
        } catch (Exception ex) {
            log.warn("Restock suggestion scheduler failed: {}", ex.getMessage());
            criticalErrorAlertService.notifyCriticalError("Restock onerisi hatasi", ex.getMessage());
        }
    }
}
