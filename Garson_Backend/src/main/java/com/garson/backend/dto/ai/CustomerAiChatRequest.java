package com.garson.backend.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerAiChatRequest {
    private Long tableId;
    private String message;
    private List<CustomerAiCartContextItem> cart = new ArrayList<>();
}
