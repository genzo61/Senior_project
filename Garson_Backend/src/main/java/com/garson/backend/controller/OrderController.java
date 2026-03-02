package com.garson.backend.controller;

import com.garson.backend.model.Order;
import com.garson.backend.model.OrderItem;
import com.garson.backend.model.OrderStatus;
import com.garson.backend.model.Product;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = { RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE,
        RequestMethod.PATCH, RequestMethod.OPTIONS })
public class OrderController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    @Transactional
    public ResponseEntity<?> createOrder(@RequestBody Order orderInput) {
        // 1. Check for Idempotency
        if (orderInput.getClientOrderId() != null && !orderInput.getClientOrderId().isEmpty()) {
            Optional<Order> existing = orderRepository.findByClientOrderId(orderInput.getClientOrderId());
            if (existing.isPresent()) {
                return ResponseEntity.ok(existing.get()); // Return existing with 200 OK
            }
        }

        // 2. Validation
        if (orderInput.getItems() == null || orderInput.getItems().isEmpty()) {
            return ResponseEntity.badRequest().body("Items cannot be empty");
        }
        for (OrderItem item : orderInput.getItems()) {
            if (item.getName() == null || item.getName().isEmpty()) {
                return ResponseEntity.badRequest().body("Item name cannot be empty");
            }
            if (item.getQty() == null || item.getQty() < 1) {
                return ResponseEntity.badRequest().body("Item quantity must be at least 1");
            }
        }

        // 3. Setup bi-directional relationship
        orderInput.getItems().forEach(item -> item.setOrder(orderInput));

        // 4. Defaults
        orderInput.setStatus(OrderStatus.NEW);
        orderInput.setCreatedAt(Instant.now());
        orderInput.setUpdatedAt(Instant.now());

        Order savedOrder = orderRepository.saveAndFlush(orderInput);
        messagingTemplate.convertAndSend("/topic/orders", savedOrder);

        return new ResponseEntity<>(savedOrder, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders(
            @RequestParam(value = "status", required = false) OrderStatus status) {
        if (status != null) {
            return ResponseEntity.ok(orderRepository.findByStatusOrderByCreatedAtDesc(status));
        }
        return ResponseEntity.ok(orderRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getOrderById(@PathVariable("id") Long id) {
        return orderRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable("id") Long id,
            @RequestBody Map<String, String> statusMap) {
        System.out.println("DEBUG: updateStatus called for ID: " + id + " with statusMap: " + statusMap);
        String statusStr = statusMap.get("status");
        if (statusStr == null) {
            return ResponseEntity.badRequest().body("Status is required");
        }

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Order order = orderOpt.get();
        OrderStatus newStatus;
        try {
            newStatus = OrderStatus.valueOf(statusStr);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid status: " + statusStr);
        }

        System.out.println("DEBUG: Transitioning order " + id + " from " + order.getStatus() + " to " + newStatus);

        // Status Transition Rules
        OrderStatus currentStatus = order.getStatus();

        // Allowed transitions: NEW -> READY, READY -> DELIVERED
        if (currentStatus == OrderStatus.NEW && newStatus != OrderStatus.READY) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("NEW orders can only transition to READY");
        }
        if (currentStatus == OrderStatus.READY && newStatus != OrderStatus.DELIVERED) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("READY orders can only transition to DELIVERED");
        }
        if (currentStatus == OrderStatus.DELIVERED) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("DELIVERED orders cannot be changed");
        }
        if (currentStatus == newStatus) {
            return ResponseEntity.ok(order); // No change needed
        }

        // Stock deduction logic if moving to READY
        if (newStatus == OrderStatus.READY) {
            try {
                System.out.println("DEBUG: Deducting stock for order " + id);
                deductStock(order);
            } catch (IllegalStateException e) {
                System.out.println("DEBUG: Stock deduction error: " + e.getMessage());
                return ResponseEntity.badRequest().body(e.getMessage());
            } catch (Exception e) {
                System.out.println("DEBUG: Unexpected stock error: " + e.getMessage());
                return ResponseEntity.internalServerError().body("Stock deduction failed: " + e.getMessage());
            }
        }

        order.setStatus(newStatus);

        try {
            System.out.println("DEBUG: Saving order " + id);
            Order updatedOrder = orderRepository.saveAndFlush(order);
            if (messagingTemplate != null) {
                messagingTemplate.convertAndSend("/topic/orders", updatedOrder);
            }
            System.out.println("DEBUG: Success updating order " + id);
            return ResponseEntity.ok(updatedOrder);
        } catch (Exception e) {
            System.out.println("DEBUG: Save error: " + e.getMessage());
            return ResponseEntity.internalServerError().body("Could not update order status: " + e.getMessage());
        }
    }

    private void deductStock(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty())
            return;

        // 1. Identify all products needed
        for (OrderItem item : order.getItems()) {
            if (item.getName() == null)
                continue;

            Product p = productRepository.findByNameIgnoreCase(item.getName())
                    .orElseThrow(() -> new IllegalStateException("Product not found: " + item.getName()));

            int currentStock = (p.getStock() != null) ? p.getStock() : 0;
            if (currentStock < item.getQty()) {
                throw new IllegalStateException("Insufficient stock for: " + item.getName() +
                        " (Available: " + currentStock + ")");
            }

            // 2. Perform deduction
            p.setStock(currentStock - item.getQty());
            productRepository.save(p);
        }

        productRepository.flush();

        try {
            if (messagingTemplate != null) {
                messagingTemplate.convertAndSend("/topic/products", productRepository.findAll());
            }
        } catch (Exception e) {
            System.err.println("Messaging error after stock deduction: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteOrder(@PathVariable("id") Long id) {
        if (orderRepository.existsById(id)) {
            orderRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
