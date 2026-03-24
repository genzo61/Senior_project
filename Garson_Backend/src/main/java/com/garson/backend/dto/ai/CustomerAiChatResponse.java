package com.garson.backend.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomerAiChatResponse {
    private String intent;
    private String assistantMessage;
    private List<CustomerAiItemDraft> items = new ArrayList<>();
    private List<CustomerAiSuggestedProduct> suggestedProducts = new ArrayList<>();

    public static CustomerAiChatResponse clarification(String message) {
        return new CustomerAiChatResponse("clarification", message, new ArrayList<>(), new ArrayList<>());
    }

    public static CustomerAiChatResponse unsupported(String message) {
        return new CustomerAiChatResponse("unsupported", message, new ArrayList<>(), new ArrayList<>());
    }
}
