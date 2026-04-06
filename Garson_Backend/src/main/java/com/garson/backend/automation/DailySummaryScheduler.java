package com.garson.backend.automation;

import com.garson.backend.alerts.CriticalErrorAlertService;
import com.garson.backend.analytics.SalesAnalyticsService;
import com.garson.backend.config.AppProperties;
import com.garson.backend.dto.report.DailySummaryResponseDto;
import com.garson.backend.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailySummaryScheduler {

    private final AutomationProperties automationProperties;
    private final AppProperties appProperties;
    private final SalesAnalyticsService salesAnalyticsService;
    private final AutomationMessageFormatter formatter;
    private final NotificationService notificationService;
    private final CriticalErrorAlertService criticalErrorAlertService;

    @Scheduled(cron = "${automation.daily-summary-cron:0 0 23 * * *}", zone = "${app.timezone:Europe/Istanbul}")
    public void runDailySummary() {
        if (!automationProperties.isEnabled()) {
            return;
        }

        try {
            LocalDate date = ZonedDateTime.now(resolveZone()).toLocalDate();
            DailySummaryResponseDto report = salesAnalyticsService.getDailySummary(date);
            notificationService.sendMessage(
                    "Garson Robot - Gun Sonu Raporu",
                    formatter.formatDailySummary(report));
        } catch (Exception ex) {
            log.warn("Daily summary scheduler failed: {}", ex.getMessage());
            criticalErrorAlertService.notifyCriticalError("Gun sonu raporu hatasi", ex.getMessage());
        }
    }

    private ZoneId resolveZone() {
        try {
            return ZoneId.of(appProperties.getTimezone());
        } catch (Exception ex) {
            return ZoneId.of("Europe/Istanbul");
        }
    }
}
