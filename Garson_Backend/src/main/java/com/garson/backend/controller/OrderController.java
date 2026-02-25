package com.garson.backend.controller;

import com.garson.backend.model.Order;
import com.garson.backend.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Allow requests from any origin (Python UI, React KDS)
public class OrderController {

    private final OrderRepository orderRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody Order orderInput) {

        // Setup bi-directional relationship manually because of JSON parsing
        if (orderInput.getItems() != null) {
            orderInput.getItems().forEach(item -> item.setOrder(orderInput));
        }

        // 1. Save to Database
        Order savedOrder = orderRepository.save(orderInput);

        // 2. Broadcast to "/topic/orders" for React Kitchen Display System (KDS)
        messagingTemplate.convertAndSend("/topic/orders", savedOrder);

        return new ResponseEntity<>(savedOrder, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderRepository.findAll());
    }
}
