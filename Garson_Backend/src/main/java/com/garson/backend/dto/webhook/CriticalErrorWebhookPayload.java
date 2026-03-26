package com.garson.backend.dto.webhook;

import java.time.OffsetDateTime;

public class CriticalErrorWebhookPayload {

    private String source;
    private String level;
    private String message;
    private String details;
    private OffsetDateTime timestamp;

    public CriticalErrorWebhookPayload() {
    }

    public CriticalErrorWebhookPayload(String source,
                                       String level,
                                       String message,
                                       String details,
                                       OffsetDateTime timestamp) {
        this.source = source;
        this.level = level;
        this.message = message;
        this.details = details;
        this.timestamp = timestamp;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public OffsetDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(OffsetDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
