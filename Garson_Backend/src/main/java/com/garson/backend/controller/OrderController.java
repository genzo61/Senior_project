package com.garson.backend.controller;

import com.garson.backend.model.Order;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.model.Product;
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
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping
    @Transactional
    public ResponseEntity<Order> createOrder(@RequestBody Order orderInput) {

        // Setup bi-directional relationship manually because of JSON parsing
        if (orderInput.getItems() != null) {
            orderInput.getItems().forEach(item -> {
                item.setOrder(orderInput);
            });
        }

        // 1. Save to Database
        Order savedOrder = orderRepository.saveAndFlush(orderInput);

        // 2. Broadcast to "/topic/orders" for React Kitchen Display System (KDS)
        messagingTemplate.convertAndSend("/topic/orders", savedOrder);

        return new ResponseEntity<>(savedOrder, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderRepository.findAll());
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
