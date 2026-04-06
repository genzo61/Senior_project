package com.garson.backend.analytics;

import com.garson.backend.event.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderCreatedAnalyticsListener {

    private final CustomerInteractionService customerInteractionService;

    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        if (event == null) {
            return;
        }
        try {
            customerInteractionService.track(
                    CustomerInteractionType.ORDERS_CREATED,
                    null,
                    event.tableNo(),
                    1,
                    "source=" + (event.source() == null ? "" : event.source()));
        } catch (Exception ex) {
            log.warn("Order-created analytics tracking failed: {}", ex.getMessage());
        }
    }
}
