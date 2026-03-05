package com.garson.backend.controller;

import com.garson.backend.model.Order;
import com.garson.backend.model.Product;
import com.garson.backend.model.RestaurantTable;
import com.garson.backend.model.TableStatus;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.repository.RestaurantTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import com.garson.backend.model.OrderStatus;
import com.garson.backend.model.OrderItem;
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
    private final RestaurantTableRepository tableRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    @Transactional
    public ResponseEntity<Order> createOrder(@RequestBody Order orderInput) {

        // Setup bi-directional relationship and populate prices
        if (orderInput.getItems() != null) {
            orderInput.getItems().forEach(item -> {
                item.setOrder(orderInput);
                // Try to find the product price if not provided
                if (item.getPrice() == null && item.getProductName() != null) {
                    productRepository.findByNameIgnoreCase(item.getProductName())
                            .ifPresent(p -> item.setPrice(p.getPrice()));
                }
            });
        }

        // 3. Setup bi-directional relationship
        orderInput.getItems().forEach(item -> item.setOrder(orderInput));

        // 4. Defaults
        orderInput.setStatus(OrderStatus.NEW.name());
        orderInput.setCreatedAt(Instant.now());
        orderInput.setUpdatedAt(Instant.now());

        Order savedOrder = orderRepository.saveAndFlush(orderInput);

        // 2. Set Table Status to OCCUPIED
        if (savedOrder.getTableNo() != null) {
            try {
                Long tableId = Long.parseLong(savedOrder.getTableNo());
                tableRepository.findById(tableId).ifPresent((RestaurantTable table) -> {
                    if (table.getStatus() == TableStatus.EMPTY || table.getStatus() == TableStatus.CALLING_ROBOT) {
                        table.setStatus(TableStatus.OCCUPIED);
                        tableRepository.save(table);
                        // Notify table status change via WebSocket
                        messagingTemplate.convertAndSend("/topic/tables", tableRepository.findAll());
                    }
                });
            } catch (NumberFormatException e) {
                // Ignore invalid table strings
            }
        }

        // 2. Broadcast to "/topic/orders" for React Kitchen Display System (KDS)
        messagingTemplate.convertAndSend("/topic/orders", savedOrder);

        return new ResponseEntity<>(savedOrder, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        List<Order> activeOrders = orderRepository.findAll().stream()
                .filter(o -> !"PAID".equals(o.getStatus()))
                .toList();
        return ResponseEntity.ok(activeOrders);
    }

    @GetMapping("/table/{tableNo}")
    public ResponseEntity<List<Order>> getOrdersByTable(@PathVariable("tableNo") String tableNo) {
        List<Order> activeOrders = orderRepository.findAll().stream()
                .filter(o -> tableNo.equals(o.getTableNo()) && !"PAID".equals(o.getStatus()))
                .toList();
        return ResponseEntity.ok(activeOrders);
    }

    @GetMapping("/paid")
    public ResponseEntity<List<Order>> getPaidOrders() {
        List<Order> paidOrders = orderRepository.findAll().stream()
                .filter(o -> "PAID".equals(o.getStatus()))
                .toList();
        return ResponseEntity.ok(paidOrders);
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
        String currentStatus = order.getStatus();

        // Allowed transitions: NEW -> READY, READY -> DELIVERED
        if ("NEW".equals(currentStatus) && newStatus != OrderStatus.READY) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("NEW orders can only transition to READY");
        }
        if ("READY".equals(currentStatus) && newStatus != OrderStatus.DELIVERED) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("READY orders can only transition to DELIVERED");
        }
        if ("DELIVERED".equals(currentStatus)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("DELIVERED orders cannot be changed");
        }
        if (currentStatus != null && currentStatus.equals(newStatus.name())) {
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

        order.setStatus(newStatus.name());

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
            if (item.getProductName() == null)
                continue;

            Product p = productRepository.findByNameIgnoreCase(item.getProductName())
                    .orElseThrow(() -> new IllegalStateException("Product not found: " + item.getProductName()));

            int currentStock = (p.getStock() != null) ? p.getStock() : 0;
            if (currentStock < item.getQuantity()) {
                throw new IllegalStateException("Insufficient stock for: " + item.getProductName() +
                        " (Available: " + currentStock + ")");
            }

            // 2. Perform deduction
            p.setStock(currentStock - item.getQuantity());
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
