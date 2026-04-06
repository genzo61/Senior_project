package com.garson.backend.service.chat.order;

import com.garson.backend.alerts.CriticalErrorAlertService;
import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Order;
import com.garson.backend.model.Product;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.repository.RestaurantTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class ChatOrderOrchestratorTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RestaurantTableRepository tableRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private CriticalErrorAlertService criticalErrorAlertService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private ChatOrderOrchestrator orchestrator;

    @BeforeEach
    void setUp() {
        orchestrator = new ChatOrderOrchestrator(
                productRepository,
                orderRepository,
                tableRepository,
                messagingTemplate,
                criticalErrorAlertService,
                eventPublisher);
    }

    @Test
    void shouldCreateOrderForDeterministicInput() {
        when(productRepository.findAll()).thenReturn(sampleProducts());
        when(tableRepository.findById(4L)).thenReturn(Optional.empty());
        when(orderRepository.saveAndFlush(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(101L);
            return Objects.requireNonNull(order);
        });

        ChatMessageRequest request = new ChatMessageRequest();
        request.setTableNumber(4);
        request.setSessionId("abc");
        request.setCustomerMessage("1 ayran 2 lahmacun");

        ChatMessageResponse response = orchestrator.handleOrderCreate(request);

        assertEquals("ORDER_CREATE", response.getIntent());
        assertEquals("ORDER_CREATED", response.getAction());
        assertEquals(101L, response.getOrderId());
        assertTrue(response.getReply().contains("Siparisiniz olusturuldu"));
    }

    @Test
    void shouldClarifyForAmbiguousGenericOrder() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        ChatMessageRequest request = new ChatMessageRequest();
        request.setTableNumber(4);
        request.setCustomerMessage("bir seyler getir");

        ChatMessageResponse response = orchestrator.handleOrderCreate(request);

        assertEquals("ORDER_CREATE", response.getIntent());
        assertTrue(response.isClarificationNeeded());
        verify(orderRepository, never()).saveAndFlush(any(Order.class));
    }

    @Test
    void shouldRejectUnknownProduct() {
        when(productRepository.findAll()).thenReturn(sampleProducts());

        ChatMessageRequest request = new ChatMessageRequest();
        request.setTableNumber(4);
        request.setCustomerMessage("1 sushi ekle");

        ChatMessageResponse response = orchestrator.handleOrderCreate(request);

        assertEquals("ORDER_CREATE", response.getIntent());
        assertTrue(response.isClarificationNeeded());
        assertNotNull(response.getOptions());
        verify(orderRepository, never()).saveAndFlush(any(Order.class));
    }

    private List<Product> sampleProducts() {
        return List.of(
                product(1L, "Ayran", "Icecek", 20),
                product(2L, "Lahmacun", "Ana Yemek", 12),
                product(3L, "Mercimek Corbasi", "Corba", 8),
                product(4L, "Ezogelin Corbasi", "Corba", 6));
    }

    private Product product(Long id, String name, String category, int stock) {
        Product product = new Product();
        product.setId(id);
        product.setName(name);
        product.setCategory(category);
        product.setStock(stock);
        product.setPrice(10.0);
        product.setDescription(name + " aciklama");
        return product;
    }
}
