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

                // Deduct stock
                Optional<Product> optProduct = productRepository.findByNameIgnoreCase(item.getProductName());
                if (optProduct.isPresent()) {
                    Product p = optProduct.get();
                    int newStock = p.getStock() - item.getQuantity();
                    p.setStock(Math.max(newStock, 0));
                    productRepository.saveAndFlush(p);
                }
            });
        }

        // 1. Save to Database
        Order savedOrder = orderRepository.saveAndFlush(orderInput);

        // 2. Broadcast to "/topic/orders" for React Kitchen Display System (KDS)
        messagingTemplate.convertAndSend("/topic/orders", savedOrder);
        // Let frontend know to update stocks too
        List<Product> allProducts = productRepository.findAll();
        messagingTemplate.convertAndSend("/topic/products", allProducts);

        return new ResponseEntity<>(savedOrder, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<Order>> getAllOrders() {
        return ResponseEntity.ok(orderRepository.findAll());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        if (orderRepository.existsById(id)) {
            orderRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
