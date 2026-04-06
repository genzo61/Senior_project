package com.garson.backend.alerts;

import com.garson.backend.automation.AutomationProperties;
import com.garson.backend.config.AppProperties;
import com.garson.backend.model.Product;
import com.garson.backend.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LowStockAlertServiceTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private AlertDeduplicationService deduplicationService;

    private LowStockAlertService lowStockAlertService;

    @BeforeEach
    void setUp() {
        AutomationProperties automationProperties = new AutomationProperties();
        automationProperties.setEnabled(true);
        automationProperties.setLowStockThresholdDefault(10);
        automationProperties.setLowStockAlertCooldownMinutes(120L);

        AppProperties appProperties = new AppProperties();
        appProperties.setTimezone("Europe/Istanbul");

        lowStockAlertService = new LowStockAlertService(
                notificationService,
                deduplicationService,
                automationProperties,
                appProperties);
    }

    @Test
    void shouldResetDedupStateWhenStockRecovered() {
        Product product = new Product();
        product.setId(5L);
        product.setName("Ayran");
        product.setStock(20);

        lowStockAlertService.notifyIfNeeded(product, "manual");

        verify(deduplicationService).reset("low-stock", "product:5");
        verify(notificationService, never()).sendMessage(anyString(), anyString());
    }

    @Test
    void shouldSendNotificationWhenBelowThresholdAndAllowedByCooldown() {
        Product product = new Product();
        product.setId(7L);
        product.setName("Lahmacun");
        product.setStock(3);

        when(deduplicationService.shouldSend(eq("low-stock"), eq("product:7"), any(Duration.class))).thenReturn(true);

        lowStockAlertService.notifyIfNeeded(product, "order-ready");

        verify(deduplicationService).shouldSend(eq("low-stock"), eq("product:7"), any(Duration.class));
        verify(notificationService, org.mockito.Mockito.timeout(1000)).sendMessage(anyString(), anyString());
    }
}
