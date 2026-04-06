package com.garson.backend.analytics;

import java.util.EnumMap;
import java.util.Map;

public class CustomerInteractionMetrics {

    private final Map<CustomerInteractionType, Long> counts;

    public CustomerInteractionMetrics() {
        this.counts = new EnumMap<>(CustomerInteractionType.class);
        for (CustomerInteractionType value : CustomerInteractionType.values()) {
            counts.put(value, 0L);
        }
    }

    public void increment(CustomerInteractionType type, long amount) {
        if (type == null || amount <= 0) {
            return;
        }
        counts.put(type, counts.getOrDefault(type, 0L) + amount);
    }

    public long count(CustomerInteractionType type) {
        return counts.getOrDefault(type, 0L);
    }
}
