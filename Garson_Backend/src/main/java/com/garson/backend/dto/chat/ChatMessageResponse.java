package com.garson.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageResponse {
    private String intent;
    private String reply;
    private String action;
    @Builder.Default
    private List<String> suggestions = new ArrayList<>();
    private boolean clarificationNeeded;
    @Builder.Default
    private List<String> options = new ArrayList<>();
    private Long orderId;
}
