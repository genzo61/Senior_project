package com.garson.backend.service.chat.retrieval;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.garson.backend.policy.chat.ChatPromptPolicy;
import com.garson.backend.service.OllamaClient;
import com.garson.backend.service.chat.intent.ChatIntent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class OllamaBackedChatResponseComposer implements ChatResponseComposer {

    private final OllamaClient ollamaClient;
    private final ObjectMapper objectMapper;
    private final ChatPromptPolicy chatPromptPolicy;

    @Value("${chat.llm.enabled:true}")
    private boolean llmEnabled;

    @Override
    public Optional<ComposedChatAnswer> compose(
            ChatIntent intent,
            String customerMessage,
            List<RetrievedKnowledge> retrievedDocuments) {
        if (!llmEnabled || retrievedDocuments == null || retrievedDocuments.isEmpty()) {
            return Optional.empty();
        }

        String systemPrompt = chatPromptPolicy.buildSystemPrompt(intent);
        String userPrompt = chatPromptPolicy.buildUserPrompt(customerMessage, retrievedDocuments);

        try {
            Optional<String> raw = ollamaClient.chatJsonOnly(systemPrompt, userPrompt);
            if (raw.isEmpty()) {
                return Optional.empty();
            }

            ComposerPayload payload = objectMapper.readValue(raw.get(), ComposerPayload.class);
            if (payload.reply == null || payload.reply.isBlank()) {
                return Optional.empty();
            }

            Set<String> allowedTitles = retrievedDocuments.stream()
                    .map(item -> item.document().title())
                    .collect(LinkedHashSet::new, Set::add, Set::addAll);

            List<String> sanitizedSuggestions = payload.suggestions == null
                    ? List.of()
                    : payload.suggestions.stream()
                    .filter(allowedTitles::contains)
                    .distinct()
                    .limit(4)
                    .toList();

            return Optional.of(new ComposedChatAnswer(payload.reply.trim(), sanitizedSuggestions));
        } catch (Exception ex) {
            log.warn("LLM compose failed, falling back to retrieval-only response: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class ComposerPayload {
        public String reply;
        public List<String> suggestions;
    }
}
