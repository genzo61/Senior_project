package com.garson.backend.controller;

import com.garson.backend.dto.order.OrderCreateItemRequest;
import com.garson.backend.dto.order.OrderCreateRequest;
import com.garson.backend.dto.order.OrderResponse;
import com.garson.backend.model.Order;
import com.garson.backend.model.OrderItem;
import com.garson.backend.model.OrderStatus;
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
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;

import java.time.Instant;
import java.util.ArrayList;
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
    public ResponseEntity<?> createOrder(@RequestBody OrderCreateRequest request) {
        final Order orderInput;
        try {
            orderInput = mapCreateRequest(request);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }

        orderInput.setStatus(OrderStatus.NEW.name());
        orderInput.setCreatedAt(Instant.now());
        orderInput.setUpdatedAt(Instant.now());

        Order savedOrder = orderRepository.saveAndFlush(orderInput);

        if (savedOrder.getTableNo() != null) {
            try {
                Long tableId = Long.parseLong(savedOrder.getTableNo());
                tableRepository.findById(tableId).ifPresent((RestaurantTable table) -> {
                    if (table.getStatus() == TableStatus.EMPTY || table.getStatus() == TableStatus.CALLING_ROBOT) {
                        table.setStatus(TableStatus.OCCUPIED);
                        tableRepository.save(table);
                        messagingTemplate.convertAndSend("/topic/tables", tableRepository.findAll());
                    }
                });
            } catch (NumberFormatException e) {
                // Ignore invalid table strings
            }
        }

        messagingTemplate.convertAndSend("/topic/orders", savedOrder);

        return new ResponseEntity<>(OrderResponse.fromEntity(savedOrder), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getAllOrders() {
        List<OrderResponse> activeOrders = orderRepository.findAll().stream()
                .filter(o -> !"PAID".equals(o.getStatus()))
                .map(OrderResponse::fromEntity)
                .toList();
        return ResponseEntity.ok(activeOrders);
    }

    @GetMapping("/table/{tableNo}")
    public ResponseEntity<List<OrderResponse>> getOrdersByTable(@PathVariable("tableNo") String tableNo) {
        List<OrderResponse> activeOrders = orderRepository.findAll().stream()
                .filter(o -> tableNo.equals(o.getTableNo()) && !"PAID".equals(o.getStatus()))
                .map(OrderResponse::fromEntity)
                .toList();
        return ResponseEntity.ok(activeOrders);
    }

    @GetMapping("/paid")
    public ResponseEntity<List<OrderResponse>> getPaidOrders() {
        List<OrderResponse> paidOrders = orderRepository.findAll().stream()
                .filter(o -> "PAID".equals(o.getStatus()))
                .map(OrderResponse::fromEntity)
                .toList();
        return ResponseEntity.ok(paidOrders);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrderById(@PathVariable("id") Long id) {
        return orderRepository.findById(id)
                .map(OrderResponse::fromEntity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public ResponseEntity<?> updateStatus(@PathVariable("id") Long id,
            @RequestBody Map<String, String> statusMap) {
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

        String currentStatus = order.getStatus();

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
            return ResponseEntity.ok(OrderResponse.fromEntity(order));
        }

        if (newStatus == OrderStatus.READY) {
            try {
                deductStock(order);
            } catch (IllegalStateException e) {
                return ResponseEntity.badRequest().body(e.getMessage());
            } catch (Exception e) {
                return ResponseEntity.internalServerError().body("Stock deduction failed: " + e.getMessage());
            }
        }

        order.setStatus(newStatus.name());

        try {
            Order updatedOrder = orderRepository.saveAndFlush(order);
            messagingTemplate.convertAndSend("/topic/orders", updatedOrder);
            return ResponseEntity.ok(OrderResponse.fromEntity(updatedOrder));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Could not update order status: " + e.getMessage());
        }
    }

    private Order mapCreateRequest(OrderCreateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Order payload is required");
        }

        String tableNo = safeTrim(request.getTableNo());
        if (tableNo.isEmpty()) {
            throw new IllegalArgumentException("tableNo is required");
        }

        Order order = new Order();
        order.setTableNo(tableNo);
        order.setItems(new ArrayList<>());

        List<OrderCreateItemRequest> requestItems = request.getItems() == null ? List.of() : request.getItems();
        if (requestItems.isEmpty()) {
            throw new IllegalArgumentException("At least one order item is required");
        }

        int lineNo = 0;
        for (OrderCreateItemRequest itemRequest : requestItems) {
            lineNo++;
            if (itemRequest == null) {
                throw new IllegalArgumentException("Item at index " + lineNo + " is null");
            }

            OrderItem item = new OrderItem();

            Product linkedProduct = resolveProduct(itemRequest);
            String requestedProductName = safeTrim(itemRequest.getProductName());
            if (linkedProduct != null && !requestedProductName.isEmpty()
                    && !isSameProductName(linkedProduct.getName(), requestedProductName)) {
                throw new IllegalArgumentException("Item at index " + lineNo + " has mismatched productId/productName");
            }

            if (linkedProduct == null && !requestedProductName.isEmpty()) {
                throw new IllegalArgumentException("Item at index " + lineNo + " has unknown product: " + requestedProductName);
            }

            String productName = requestedProductName;
            if (productName.isEmpty() && linkedProduct != null) {
                productName = linkedProduct.getName();
            }

            if (productName.isEmpty()) {
                throw new IllegalArgumentException("Item at index " + lineNo + " requires productName or productId");
            }

            item.setProductName(productName);
            item.setQuantity(itemRequest.getQuantity() == null || itemRequest.getQuantity() <= 0 ? 1 : itemRequest.getQuantity());

            Double price = itemRequest.getPrice();
            if (price == null && linkedProduct != null) {
                price = linkedProduct.getPrice();
            }
            if (price == null && productName != null) {
                price = productRepository.findByNameIgnoreCase(productName).map(Product::getPrice).orElse(0.0);
            }
            item.setPrice(price);
            item.setSpecialNote(safeTrim(itemRequest.getSpecialNote()));

            order.addItem(item);
        }

        if (order.getItems().isEmpty()) {
            throw new IllegalArgumentException("At least one valid order item is required");
        }

        return order;
    }

    private Product resolveProduct(OrderCreateItemRequest itemRequest) {
        if (itemRequest.getProductId() != null) {
            Optional<Product> product = productRepository.findById(itemRequest.getProductId());
            if (product.isPresent()) {
                return product.get();
            }
        }

        String productName = safeTrim(itemRequest.getProductName());
        if (!productName.isEmpty()) {
            return productRepository.findByNameIgnoreCase(productName).orElse(null);
        }

        return null;
    }

    private boolean isSameProductName(String left, String right) {
        return canonical(left).equals(canonical(right));
    }

    private String canonical(String value) {
        return safeTrim(value).toLowerCase().replaceAll("\\s+", " ");
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private void deductStock(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }

        for (OrderItem item : order.getItems()) {
            if (item.getProductName() == null) {
                continue;
            }

            Product p = productRepository.findByNameIgnoreCase(item.getProductName())
                    .orElseThrow(() -> new IllegalStateException("Product not found: " + item.getProductName()));

            int currentStock = p.getStock() != null ? p.getStock() : 0;
            if (currentStock < item.getQuantity()) {
                throw new IllegalStateException("Insufficient stock for: " + item.getProductName() +
                        " (Available: " + currentStock + ")");
            }

            p.setStock(currentStock - item.getQuantity());
            productRepository.save(p);
        }

        productRepository.flush();
        messagingTemplate.convertAndSend("/topic/products", productRepository.findAll());
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
