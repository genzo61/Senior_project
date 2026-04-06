package com.garson.backend.event;

public record OrderCreatedEvent(Long orderId, String tableNo, String source) {
}
