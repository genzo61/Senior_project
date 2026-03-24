package com.garson.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerAiCartContextItem {
    @JsonAlias({ "product_id" })
    private Long productId;

    private Integer quantity;

    @JsonAlias({ "special_note" })
    private String specialNote;
}
