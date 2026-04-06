package com.garson.backend.service.chat.order;

import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Order;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.service.chat.ChatSessionStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatOrderStatusService {

    private final OrderRepository orderRepository;
    private final ChatSessionStateService chatSessionStateService;

    public ChatMessageResponse handleOrderStatus(ChatMessageRequest request) {
        if (request == null) {
            return clarification();
        }

        Optional<Order> bySession = findBySession(request.getSessionId());
        if (bySession.isPresent()) {
            Order order = bySession.get();
            return ChatMessageResponse.builder()
                    .intent("ORDER_STATUS")
                    .reply(formatStatusMessage(order))
                    .orderId(order.getId())
                    .build();
        }

        Integer tableNo = request.getTableNumber();
        if (tableNo == null) {
            tableNo = chatSessionStateService.getSessionState(request.getSessionId())
                    .map(ChatSessionStateService.SessionState::tableNumber)
                    .orElse(null);
        }

        if (tableNo == null) {
            return clarification();
        }

        List<Order> orders = orderRepository.findByTableNo(String.valueOf(tableNo));
        if (orders.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_STATUS")
                    .reply("Bu masa icin aktif bir siparis bulamadim.")
                    .build();
        }

        Order latest = orders.stream()
                .max(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(orders.get(0));

        return ChatMessageResponse.builder()
                .intent("ORDER_STATUS")
                .reply(formatStatusMessage(latest))
                .orderId(latest.getId())
                .build();
    }

    private Optional<Order> findBySession(String sessionId) {
        return chatSessionStateService.getSessionState(sessionId)
                .flatMap(state -> orderRepository.findById(Objects.requireNonNull(state.lastOrderId())));
    }

    private String formatStatusMessage(Order order) {
        String status = order.getStatus() == null ? "NEW" : order.getStatus().toUpperCase(Locale.ROOT);
        String humanStatus;
        switch (status) {
            case "READY":
                humanStatus = "hazir ve servise cikabilir";
                break;
            case "DELIVERED":
                humanStatus = "teslim edildi";
                break;
            case "PAID":
                humanStatus = "odeme tamamlandi";
                break;
            default:
                humanStatus = "hazirlaniyor";
                break;
        }
        return "Siparisinizin durumu: " + humanStatus + " (Siparis No: " + order.getId() + ").";
    }

    private ChatMessageResponse clarification() {
        return ChatMessageResponse.builder()
                .intent("ORDER_STATUS")
                .reply("Siparis durumunu kontrol etmem icin masa numarasini paylasir misiniz?")
                .clarificationNeeded(true)
                .build();
    }
}
