package com.garson.backend.controller;

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

    @PostMapping("/customer-chat")
    public ResponseEntity<CustomerAiChatResponse> customerChat(@RequestBody CustomerAiChatRequest request) {
        return ResponseEntity.ok(customerAiService.handleCustomerChat(request));
    }
}
