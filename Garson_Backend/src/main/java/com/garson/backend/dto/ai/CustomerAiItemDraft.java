package com.garson.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerAiItemDraft {
    @JsonAlias({ "product_id" })
    private Long productId;

    @JsonAlias({ "product_name" })
    private String productName;

    private Integer quantity;

    @JsonAlias({ "special_note" })
    private String specialNote;
}
