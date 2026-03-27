package com.garson.backend.service.chat.order;

import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Order;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.service.chat.ChatSessionStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatOrderStatusServiceTest {

    @Mock
    private OrderRepository orderRepository;

    private ChatOrderStatusService service;

    @BeforeEach
    void setUp() {
        service = new ChatOrderStatusService(orderRepository, new ChatSessionStateService());
    }

    @Test
    void shouldReturnOrderStatusForTable() {
        Order order = new Order();
        order.setId(77L);
        order.setStatus("READY");
        order.setTableNo("4");
        order.setCreatedAt(Instant.now());

        when(orderRepository.findByTableNo("4")).thenReturn(List.of(order));

        ChatMessageRequest request = new ChatMessageRequest();
        request.setTableNumber(4);
        request.setCustomerMessage("siparisim nerede kaldi");

        ChatMessageResponse response = service.handleOrderStatus(request);

        assertEquals("ORDER_STATUS", response.getIntent());
        assertTrue(response.getReply().toLowerCase().contains("hazir"));
    }
}
