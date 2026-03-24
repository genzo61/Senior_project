package com.garson.backend.dto.order;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.garson.backend.model.OrderItem;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemResponse {
    private Long id;
    private String productName;
    private Integer quantity;
    private Double price;

    @JsonProperty("specialNote")
    private String specialNote;

    public static OrderItemResponse fromEntity(OrderItem item) {
        return new OrderItemResponse(
                item.getId(),
                item.getProductName(),
                item.getQuantity(),
                item.getPrice(),
                item.getSpecialNote() == null ? "" : item.getSpecialNote());
    }
}
