package com.garson.backend.dto.product;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductUpsertRequest {
    private String name;
    private Double price;
    private Integer stock;
    private String category;
    private String description;

    @JsonAlias({ "tagsText" })
    private JsonNode tags;
}
