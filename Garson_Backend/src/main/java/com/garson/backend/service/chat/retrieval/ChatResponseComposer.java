package com.garson.backend.service.chat.retrieval;

import com.garson.backend.service.chat.intent.ChatIntent;

import java.util.List;
import java.util.Optional;

public interface ChatResponseComposer {
    Optional<ComposedChatAnswer> compose(
            ChatIntent intent,
            String customerMessage,
            List<RetrievedKnowledge> retrievedDocuments);
}
