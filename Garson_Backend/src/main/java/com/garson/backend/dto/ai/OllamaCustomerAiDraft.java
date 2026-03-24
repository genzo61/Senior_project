package com.garson.backend.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OllamaCustomerAiDraft {
    private String intent;
    private String assistantMessage;
    private List<CustomerAiItemDraft> items = new ArrayList<>();
    private List<CustomerAiSuggestedProduct> suggestedProducts = new ArrayList<>();
}
