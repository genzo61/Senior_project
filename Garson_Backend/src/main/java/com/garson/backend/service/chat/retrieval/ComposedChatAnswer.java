package com.garson.backend.service.chat.retrieval;

import java.util.List;

public class ComposedChatAnswer {
    private final String reply;
    private final List<String> suggestions;

    public ComposedChatAnswer(String reply, List<String> suggestions) {
        this.reply = reply;
        this.suggestions = suggestions == null ? List.of() : suggestions;
    }

    public String reply() {
        return reply;
    }

    public List<String> suggestions() {
        return suggestions;
    }
}
