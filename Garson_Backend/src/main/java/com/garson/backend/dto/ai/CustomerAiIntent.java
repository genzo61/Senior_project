package com.garson.backend.dto.ai;

public enum CustomerAiIntent {
    MENU_ASSISTANT("menu_assistant"),
    CART_UPDATE("cart_update"),
    CLARIFICATION("clarification"),
    UNSUPPORTED("unsupported");

    private final String value;

    CustomerAiIntent(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static CustomerAiIntent fromRaw(String raw) {
        if (raw == null) {
            return CLARIFICATION;
        }

        String normalized = raw.trim().toLowerCase();
        for (CustomerAiIntent intent : values()) {
            if (intent.value.equals(normalized)) {
                return intent;
            }
        }

        return CLARIFICATION;
    }
}
