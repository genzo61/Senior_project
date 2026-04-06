package com.garson.backend.dto.analytics;

import lombok.Data;

@Data
public class CustomerInteractionEventRequest {
    private String eventType;
    private String sessionId;
    private String tableNo;
    private Integer quantity;
    private String metadata;
}
