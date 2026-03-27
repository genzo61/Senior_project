package com.garson.backend.service.chat.intent;

public class ChatIntentDecision {
    private final ChatIntent intent;
    private final String reason;

    public static ChatIntentDecision of(ChatIntent intent, String reason) {
        return new ChatIntentDecision(intent, reason == null ? "" : reason);
    }

    public ChatIntentDecision(ChatIntent intent, String reason) {
        this.intent = intent;
        this.reason = reason == null ? "" : reason;
    }

    public ChatIntent intent() {
        return intent;
    }

    public String reason() {
        return reason;
    }
}
