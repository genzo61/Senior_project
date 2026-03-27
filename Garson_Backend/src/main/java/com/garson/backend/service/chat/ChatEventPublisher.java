package com.garson.backend.service.chat;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class ChatEventPublisher {

    public void chatReceived(String sessionId, String message) {
        log.debug("chat_received sessionId={} messageLength={}",
                safe(sessionId),
                message == null ? 0 : message.length());
    }

    public void orderCreatedFromChat(String sessionId, Long orderId) {
        log.debug("order_created_from_chat sessionId={} orderId={}", safe(sessionId), orderId);
    }

    public void clarificationRequested(String sessionId, String intent) {
        log.debug("clarification_requested sessionId={} intent={}", safe(sessionId), safe(intent));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
