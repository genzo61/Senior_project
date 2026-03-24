package com.garson.backend.dto.order;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreateRequest {
    @JsonAlias({ "table_no" })
    private String tableNo;

    private List<OrderCreateItemRequest> items = new ArrayList<>();
}
