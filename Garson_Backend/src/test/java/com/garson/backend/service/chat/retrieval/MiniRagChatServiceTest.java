package com.garson.backend.service.chat.retrieval;

import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.service.chat.intent.ChatIntent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MiniRagChatServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private KnowledgeIndexBuilder knowledgeIndexBuilder;

    @Mock
    private KnowledgeRetrievalService knowledgeRetrievalService;

    @Mock
    private ChatResponseComposer chatResponseComposer;

    private MiniRagChatService miniRagChatService;

    @BeforeEach
    void setUp() {
        miniRagChatService = new MiniRagChatService(
                productRepository,
                knowledgeIndexBuilder,
                knowledgeRetrievalService,
                chatResponseComposer);
    }

    @Test
    void shouldFallbackWhenLlmUnavailable() {
        Product lahmacun = new Product();
        lahmacun.setId(1L);
        lahmacun.setName("Lahmacun");
        lahmacun.setCategory("Ana Yemek");
        lahmacun.setDescription("Ince hamur ustunde kiymali harc");
        lahmacun.setPrice(95.0);
        lahmacun.setStock(10);
        lahmacun.setTags("acili");

        KnowledgeDocument document = new KnowledgeDocument(
                "product-1",
                "PRODUCT",
                "Lahmacun",
                "Lahmacun | kategori: Ana Yemek | aciklama: Ince hamur ustunde kiymali harc",
                Map.of(
                        "name", "Lahmacun",
                        "category", "Ana Yemek",
                        "description", "Ince hamur ustunde kiymali harc",
                        "price", 95.0,
                        "stock", 10,
                        "stockAvailable", true));

        when(productRepository.findAll()).thenReturn(List.of(lahmacun));
        when(knowledgeIndexBuilder.build(anyList())).thenReturn(List.of(document));
        when(knowledgeRetrievalService.retrieve(anyString(), anyList(), anyInt()))
                .thenReturn(List.of(new RetrievedKnowledge(document, 0.93)));
        when(chatResponseComposer.compose(any(), anyString(), anyList())).thenReturn(Optional.empty());

        ChatMessageResponse response = miniRagChatService.answerKnowledgeIntent(
                ChatIntent.PRODUCT_INFO,
                "lahmacunun icinde ne var");

        assertEquals("PRODUCT_INFO", response.getIntent());
        assertTrue(response.getReply().toLowerCase().contains("lahmacun"));
        assertFalse(response.getSuggestions().isEmpty());
    }

    @Test
    void shouldReturnStockQueryFromBackendData() {
        Product lahmacun = new Product();
        lahmacun.setId(1L);
        lahmacun.setName("Lahmacun");
        lahmacun.setCategory("Ana Yemek");
        lahmacun.setDescription("Ince hamur ustunde kiymali harc");
        lahmacun.setPrice(95.0);
        lahmacun.setStock(3);
        lahmacun.setTags("acili");

        KnowledgeDocument document = new KnowledgeDocument(
                "product-1",
                "PRODUCT",
                "Lahmacun",
                "Lahmacun | kategori: Ana Yemek",
                Map.of(
                        "name", "Lahmacun",
                        "category", "Ana Yemek",
                        "description", "Ince hamur ustunde kiymali harc",
                        "price", 95.0,
                        "stock", 3,
                        "stockAvailable", true));

        when(productRepository.findAll()).thenReturn(List.of(lahmacun));
        when(knowledgeIndexBuilder.build(anyList())).thenReturn(List.of(document));
        when(knowledgeRetrievalService.retrieve(anyString(), anyList(), anyInt()))
                .thenReturn(List.of(new RetrievedKnowledge(document, 0.91)));

        ChatMessageResponse response = miniRagChatService.answerKnowledgeIntent(
                ChatIntent.STOCK_QUERY,
                "lahmacun stokta var mi");

        assertEquals("STOCK_QUERY", response.getIntent());
        assertTrue(response.getReply().toLowerCase().contains("stokta var"));
    }
}
