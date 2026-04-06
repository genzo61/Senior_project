package com.garson.backend.controller;

import com.garson.backend.analytics.CustomerInteractionService;
import com.garson.backend.analytics.CustomerInteractionType;
import com.garson.backend.dto.ai.CustomerAiChatRequest;
import com.garson.backend.dto.ai.CustomerAiChatResponse;
import com.garson.backend.service.CustomerAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = { org.springframework.web.bind.annotation.RequestMethod.POST,
        org.springframework.web.bind.annotation.RequestMethod.OPTIONS })
public class CustomerAiController {

    private final CustomerAiService customerAiService;
    private final CustomerInteractionService customerInteractionService;

    @PostMapping("/customer-chat")
    public ResponseEntity<CustomerAiChatResponse> customerChat(@RequestBody CustomerAiChatRequest request) {
        CustomerAiChatResponse response = customerAiService.handleCustomerChat(request);

        if (response.getSuggestedProducts() != null && !response.getSuggestedProducts().isEmpty()) {
            customerInteractionService.track(
                    CustomerInteractionType.AI_SUGGESTION_SHOWN,
                    null,
                    request == null || request.getTableId() == null ? null : String.valueOf(request.getTableId()),
                    response.getSuggestedProducts().size(),
                    "source=customer-ai");
        }

        if ("cart_update".equalsIgnoreCase(response.getIntent())
                && response.getItems() != null
                && !response.getItems().isEmpty()) {
            customerInteractionService.track(
                    CustomerInteractionType.ADDED_TO_CART,
                    null,
                    request == null || request.getTableId() == null ? null : String.valueOf(request.getTableId()),
                    response.getItems().size(),
                    "source=customer-ai");
        }

        return ResponseEntity.ok(response);
    }
}
