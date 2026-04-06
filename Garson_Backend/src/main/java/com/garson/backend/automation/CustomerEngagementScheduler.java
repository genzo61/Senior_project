package com.garson.backend.automation;

import com.garson.backend.alerts.CriticalErrorAlertService;
import com.garson.backend.config.AppProperties;
import com.garson.backend.dto.report.CustomerEngagementResponseDto;
import com.garson.backend.notification.NotificationService;
import com.garson.backend.service.ReportsService;
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
public class CustomerEngagementScheduler {

    private final AutomationProperties automationProperties;
    private final AppProperties appProperties;
    private final ReportsService reportsService;
    private final AutomationMessageFormatter formatter;
    private final NotificationService notificationService;
    private final CriticalErrorAlertService criticalErrorAlertService;

    @Scheduled(cron = "${automation.customer-engagement-cron:0 10 23 * * *}", zone = "${app.timezone:Europe/Istanbul}")
    public void runCustomerEngagement() {
        if (!automationProperties.isEnabled()) {
            return;
        }

        try {
            LocalDate date = ZonedDateTime.now(resolveZone()).toLocalDate();
            CustomerEngagementResponseDto report = reportsService.getCustomerEngagement(date);
            notificationService.sendMessage(
                    "Garson Robot - Musteri Etkilesim Raporu",
                    formatter.formatCustomerEngagement(report));
        } catch (Exception ex) {
            log.warn("Customer engagement scheduler failed: {}", ex.getMessage());
            criticalErrorAlertService.notifyCriticalError("Musteri etkilesim raporu hatasi", ex.getMessage());
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
