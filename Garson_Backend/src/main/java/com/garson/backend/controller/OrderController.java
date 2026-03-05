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
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = { RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PUT,
        RequestMethod.OPTIONS })
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

        // 1. Save to Database
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

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteOrder(@PathVariable("id") Long id) {
        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isPresent()) {
            Order order = orderOpt.get();

            // Deduct stock before deleting
            if (order.getItems() != null) {
                order.getItems().forEach(item -> {
                    if (item.getProductName() != null) {
                        Optional<Product> optProduct = productRepository
                                .findByNameIgnoreCase(item.getProductName());
                        if (optProduct.isPresent()) {
                            Product p = optProduct.get();
                            int currentStock = p.getStock() != null ? p.getStock() : 0;
                            int quantity = item.getQuantity() != null ? item.getQuantity() : 0;
                            int newStock = currentStock - quantity;
                            p.setStock(Math.max(newStock, 0));
                            productRepository.save(p);
                        }
                    }
                });
                // Explicitly un-bind items to avoid constraint violations during cascade delete
                order.getItems().clear();
                orderRepository.save(order);
            }

            orderRepository.delete(order);
            orderRepository.flush();
            productRepository.flush();

            // Let frontend know to update stocks
            List<Product> allProducts = productRepository.findAll();
            messagingTemplate.convertAndSend("/topic/products", allProducts);

            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
