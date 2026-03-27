package com.garson.backend.service.chat;

import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.service.chat.intent.ChatIntent;
import com.garson.backend.service.chat.intent.ChatIntentClassifier;
import com.garson.backend.service.chat.intent.ChatIntentDecision;
import com.garson.backend.service.chat.order.ChatOrderOrchestrator;
import com.garson.backend.service.chat.order.ChatOrderStatusService;
import com.garson.backend.service.chat.retrieval.MiniRagChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatOrchestratorService {

    private final ChatIntentClassifier chatIntentClassifier;
    private final ChatOrderOrchestrator chatOrderOrchestrator;
    private final MiniRagChatService miniRagChatService;
    private final ChatOrderStatusService chatOrderStatusService;
    private final ChatSessionStateService chatSessionStateService;
    private final ChatEventPublisher chatEventPublisher;

    public ChatMessageResponse handleMessage(ChatMessageRequest request) {
        String customerMessage = request == null || request.getCustomerMessage() == null
                ? ""
                : request.getCustomerMessage().trim();

        chatEventPublisher.chatReceived(request == null ? null : request.getSessionId(), customerMessage);

        if (customerMessage.isBlank()) {
            return buildClarificationResponse("Mesaj bos gorunuyor. Siparis veya menu sorusu yazabilirsiniz.");
        }

        ChatIntentDecision decision = chatIntentClassifier.classify(customerMessage);
        log.info("Chat intent detected intent={} reason={}", decision.intent(), decision.reason());

        ChatMessageResponse response = routeByIntent(decision.intent(), request);
        log.info("Chat pipeline selected intent={} clarificationNeeded={} orderId={}",
                decision.intent(),
                response.isClarificationNeeded(),
                response.getOrderId());

        if (response.isClarificationNeeded()) {
            chatEventPublisher.clarificationRequested(request == null ? null : request.getSessionId(), response.getIntent());
        } else if (response.getOrderId() != null) {
            chatSessionStateService.saveLastOrder(
                    request == null ? null : request.getSessionId(),
                    request == null ? null : request.getTableNumber(),
                    response.getOrderId());
            chatEventPublisher.orderCreatedFromChat(request == null ? null : request.getSessionId(), response.getOrderId());
        }

        return response;
    }

    private ChatMessageResponse routeByIntent(ChatIntent intent, ChatMessageRequest request) {
        if (intent == ChatIntent.ORDER_CREATE) {
            return chatOrderOrchestrator.handleOrderCreate(request);
        }

        if (intent == ChatIntent.ORDER_STATUS) {
            return chatOrderStatusService.handleOrderStatus(request);
        }

        if (intent == ChatIntent.MENU_QUESTION
                || intent == ChatIntent.PRODUCT_INFO
                || intent == ChatIntent.STOCK_QUERY
                || intent == ChatIntent.RECOMMENDATION) {
            String message = request == null ? "" : request.getCustomerMessage();
            return miniRagChatService.answerKnowledgeIntent(intent, message);
        }

        if (intent == ChatIntent.SMALL_TALK) {
            return ChatMessageResponse.builder()
                    .intent(ChatIntent.SMALL_TALK.name())
                    .reply("Buradayim. Siparis verebilir veya menu hakkinda soru sorabilirsiniz.")
                    .suggestions(List.of("Bugun ne onerirsin?", "Lahmacunun icinde ne var?", "1 ayran 1 lahmacun"))
                    .build();
        }

        return buildClarificationResponse("Ne istediginizi netlestirebilir misiniz? Ornek: '1 kola 2 lahmacun'.");
    }

    private ChatMessageResponse buildClarificationResponse(String reply) {
        return ChatMessageResponse.builder()
                .intent(ChatIntent.FALLBACK.name())
                .reply(reply)
                .clarificationNeeded(true)
                .build();
    }
}
