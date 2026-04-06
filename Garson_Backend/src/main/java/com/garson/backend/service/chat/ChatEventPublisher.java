package com.garson.backend.service.chat;

import com.garson.backend.alerts.AlertDeduplicationService;
import com.garson.backend.analytics.CustomerInteractionService;
import com.garson.backend.analytics.CustomerInteractionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatEventPublisher {

    private static final String CHAT_OPENED_CHANNEL = "chat-opened";
    private static final Duration CHAT_OPENED_COOLDOWN = Duration.ofMinutes(30);

    private final CustomerInteractionService customerInteractionService;
    private final AlertDeduplicationService alertDeduplicationService;

    public void chatReceived(String sessionId, String message) {
        log.debug("chat_received sessionId={} messageLength={}",
                safe(sessionId),
                message == null ? 0 : message.length());

        if (sessionId == null || sessionId.isBlank()) {
            customerInteractionService.track(CustomerInteractionType.CHAT_OPENED, null, null, 1, "source=chat");
            return;
        }

        String dedupKey = "session:" + sessionId.trim();
        boolean shouldTrack = alertDeduplicationService.shouldSend(CHAT_OPENED_CHANNEL, dedupKey, CHAT_OPENED_COOLDOWN);
        if (shouldTrack) {
            customerInteractionService.track(CustomerInteractionType.CHAT_OPENED, sessionId, null, 1, "source=chat");
        }
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
