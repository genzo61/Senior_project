package com.garson.backend.analytics;

import java.util.Arrays;
import java.util.Optional;

public enum CustomerInteractionType {
    CHAT_OPENED("chatOpened"),
    AI_SUGGESTION_SHOWN("aiSuggestionShown"),
    ADDED_TO_CART("addedToCart"),
    CHECKOUT_STARTED("checkoutStarted"),
    ORDERS_CREATED("ordersCreated");

    private final String externalName;

    CustomerInteractionType(String externalName) {
        this.externalName = externalName;
    }

    public String externalName() {
        return externalName;
    }

    public static Optional<CustomerInteractionType> fromValue(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        String normalized = raw.trim().toLowerCase().replace("-", "").replace("_", "");
        return Arrays.stream(values())
                .filter(value -> value.externalName.toLowerCase().replace("_", "").equals(normalized)
                        || value.name().toLowerCase().replace("_", "").equals(normalized))
                .findFirst();
    }
}
