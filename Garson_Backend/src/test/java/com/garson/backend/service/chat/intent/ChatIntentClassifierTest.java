package com.garson.backend.service.chat.intent;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatIntentClassifierTest {

    private final ChatIntentClassifier classifier = new ChatIntentClassifier();

    @Test
    void shouldDetectOrderCreate() {
        ChatIntentDecision decision = classifier.classify("1 kola 2 lahmacun");
        assertEquals(ChatIntent.ORDER_CREATE, decision.intent());
    }

    @Test
    void shouldDetectRecommendationForAcisizQuestion() {
        ChatIntentDecision decision = classifier.classify("aci olmayan ne var");
        assertEquals(ChatIntent.RECOMMENDATION, decision.intent());
    }

    @Test
    void shouldDetectStockQuery() {
        ChatIntentDecision decision = classifier.classify("lahmacun stokta var mi");
        assertEquals(ChatIntent.STOCK_QUERY, decision.intent());
    }

    @Test
    void shouldDetectOrderStatus() {
        ChatIntentDecision decision = classifier.classify("siparisim nerede kaldi");
        assertEquals(ChatIntent.ORDER_STATUS, decision.intent());
    }

    @Test
    void shouldDetectProductInfo() {
        ChatIntentDecision decision = classifier.classify("lahmacunun icinde ne var");
        assertEquals(ChatIntent.PRODUCT_INFO, decision.intent());
    }
}
