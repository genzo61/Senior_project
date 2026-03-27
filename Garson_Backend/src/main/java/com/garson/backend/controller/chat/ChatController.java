package com.garson.backend.controller.chat;

import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.service.chat.ChatOrchestratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", methods = {
        RequestMethod.POST,
        RequestMethod.OPTIONS
})
public class ChatController {

    private final ChatOrchestratorService chatOrchestratorService;

    @PostMapping("/message")
    public ResponseEntity<ChatMessageResponse> postMessage(@RequestBody ChatMessageRequest request) {
        return ResponseEntity.ok(chatOrchestratorService.handleMessage(request));
    }
}
