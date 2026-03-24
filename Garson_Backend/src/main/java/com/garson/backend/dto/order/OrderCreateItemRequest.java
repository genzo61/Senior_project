package com.garson.backend.dto.order;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreateItemRequest {
    @JsonAlias({ "product_name" })
    private String productName;

    @JsonAlias({ "product_id" })
    private Long productId;

    private Integer quantity;
    private Double price;

    @JsonAlias({ "special_note" })
    private String specialNote;
}
