package com.garson.backend.dto.chat;

import lombok.Data;

@Data
public class ChatMessageRequest {
    private String sessionId;
    private String customerMessage;
    private Integer tableNumber;
}
