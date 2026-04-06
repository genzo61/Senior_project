package com.garson.backend.controller;

import com.garson.backend.analytics.CustomerInteractionService;
import com.garson.backend.dto.analytics.CustomerInteractionEventRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = { RequestMethod.POST, RequestMethod.OPTIONS })
public class CustomerInteractionController {

    private final CustomerInteractionService customerInteractionService;

    @PostMapping("/customer-events")
    public ResponseEntity<Map<String, Object>> trackEvent(@RequestBody CustomerInteractionEventRequest request) {
        if (request == null || request.getEventType() == null || request.getEventType().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventType is required"));
        }

        customerInteractionService.trackByName(
                request.getEventType(),
                request.getSessionId(),
                request.getTableNo(),
                request.getQuantity(),
                request.getMetadata());

        return ResponseEntity.accepted().body(Map.of("status", "accepted"));
    }
}
