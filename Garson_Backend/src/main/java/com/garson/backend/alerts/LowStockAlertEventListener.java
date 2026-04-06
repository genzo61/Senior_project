package com.garson.backend.alerts;

import com.garson.backend.event.ProductStockChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class LowStockAlertEventListener {

    private final LowStockAlertService lowStockAlertService;

    @EventListener
    public void onProductStockChanged(ProductStockChangedEvent event) {
        if (event == null) {
            return;
        }
        try {
            lowStockAlertService.notifyIfNeeded(event.product(), event.source());
        } catch (Exception ex) {
            log.warn("Low-stock event handling failed: {}", ex.getMessage());
        }
    }
}
