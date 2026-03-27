package com.garson.backend.service.chat;

import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class ChatSessionStateService {

    private final ConcurrentMap<String, SessionState> sessionStates = new ConcurrentHashMap<>();

    public void saveLastOrder(String sessionId, Integer tableNumber, Long orderId) {
        if (sessionId == null || sessionId.isBlank() || orderId == null) {
            return;
        }
        sessionStates.put(sessionId.trim(), new SessionState(tableNumber, orderId));
    }

    public Optional<SessionState> getSessionState(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(sessionStates.get(sessionId.trim()));
    }

    public static final class SessionState {
        private final Integer tableNumber;
        private final Long lastOrderId;

        public SessionState(Integer tableNumber, Long lastOrderId) {
            this.tableNumber = tableNumber;
            this.lastOrderId = lastOrderId;
        }

        public Integer tableNumber() {
            return tableNumber;
        }

        public Long lastOrderId() {
            return lastOrderId;
        }
    }
}
