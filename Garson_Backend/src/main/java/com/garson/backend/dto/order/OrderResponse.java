package com.garson.backend.dto.order;

import com.garson.backend.model.Order;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private Long id;
    private String tableNo;
    private LocalDateTime orderTime;
    private String status;
    private LocalDateTime paidAt;
    private String paymentMethod;
    private Instant createdAt;
    private Instant updatedAt;
    private List<OrderItemResponse> items;

    public static OrderResponse fromEntity(Order order) {
        List<OrderItemResponse> itemResponses = order.getItems() == null
                ? Collections.emptyList()
                : order.getItems().stream().map(OrderItemResponse::fromEntity).toList();

        return new OrderResponse(
                order.getId(),
                order.getTableNo(),
                order.getOrderTime(),
                order.getStatus(),
                order.getPaidAt(),
                order.getPaymentMethod(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                itemResponses);
    }
}
