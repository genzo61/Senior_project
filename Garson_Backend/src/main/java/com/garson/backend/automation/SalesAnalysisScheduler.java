package com.garson.backend.automation;

import com.garson.backend.alerts.CriticalErrorAlertService;
import com.garson.backend.analytics.SalesAnalyticsService;
import com.garson.backend.config.AppProperties;
import com.garson.backend.dto.report.SalesAnalysisResponseDto;
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
public class SalesAnalysisScheduler {

    private final AutomationProperties automationProperties;
    private final AppProperties appProperties;
    private final SalesAnalyticsService salesAnalyticsService;
    private final AutomationMessageFormatter formatter;
    private final NotificationService notificationService;
    private final CriticalErrorAlertService criticalErrorAlertService;

    @Scheduled(cron = "${automation.sales-analysis-cron:0 5 23 * * *}", zone = "${app.timezone:Europe/Istanbul}")
    public void runSalesAnalysis() {
        if (!automationProperties.isEnabled()) {
            return;
        }

        try {
            LocalDate date = ZonedDateTime.now(resolveZone()).toLocalDate();
            SalesAnalysisResponseDto report = salesAnalyticsService.getSalesAnalysis(date);
            notificationService.sendMessage(
                    "Garson Robot - Satis Analizi",
                    formatter.formatSalesAnalysis(report));
        } catch (Exception ex) {
            log.warn("Sales analysis scheduler failed: {}", ex.getMessage());
            criticalErrorAlertService.notifyCriticalError("Satis analizi hatasi", ex.getMessage());
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
