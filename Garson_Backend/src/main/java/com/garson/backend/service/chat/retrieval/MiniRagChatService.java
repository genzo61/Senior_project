package com.garson.backend.service.chat.retrieval;

import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.service.chat.ChatTextNormalizer;
import com.garson.backend.service.chat.intent.ChatIntent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MiniRagChatService {

    private final ProductRepository productRepository;
    private final KnowledgeIndexBuilder knowledgeIndexBuilder;
    private final KnowledgeRetrievalService knowledgeRetrievalService;
    private final ChatResponseComposer chatResponseComposer;

    public ChatMessageResponse answerKnowledgeIntent(ChatIntent intent, String customerMessage) {
        List<Product> products = productRepository.findAll();
        if (products.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent(intent.name())
                    .reply("Menu su anda bos oldugu icin bu soruya yanit veremiyorum.")
                    .build();
        }

        List<KnowledgeDocument> index = knowledgeIndexBuilder.build(products);
        List<RetrievedKnowledge> hits = knowledgeRetrievalService.retrieve(customerMessage, index, 6);
        log.info("Chat retrieval hit count intent={} hits={}", intent, hits.size());

        if (intent == ChatIntent.STOCK_QUERY) {
            return handleStockQuery(intent, customerMessage, hits);
        }

        if (intent == ChatIntent.PRODUCT_INFO) {
            return handleProductInfo(intent, customerMessage, hits);
        }

        if (intent == ChatIntent.MENU_QUESTION) {
            return handleMenuQuestion(intent, customerMessage, hits);
        }

        if (intent == ChatIntent.RECOMMENDATION) {
            return handleRecommendation(intent, customerMessage, hits, index);
        }

        return ChatMessageResponse.builder()
                .intent(intent.name())
                .reply("Bu soruya su an yardimci olamiyorum.")
                .build();
    }

    private ChatMessageResponse handleStockQuery(ChatIntent intent, String customerMessage, List<RetrievedKnowledge> hits) {
        RetrievedKnowledge top = topHit(hits);
        if (top == null || top.score() < 0.12) {
            return ChatMessageResponse.builder()
                    .intent(intent.name())
                    .reply("Hangi urunun stok bilgisini istediginizi netlestirebilir misiniz?")
                    .clarificationNeeded(true)
                    .options(topTitles(hits, 4))
                    .build();
        }

        String name = metadataString(top.document().metadata(), "name");
        int stock = metadataInt(top.document().metadata(), "stock");
        boolean stockAvailable = metadataBool(top.document().metadata(), "stockAvailable");
        String reply = stockAvailable
                ? "%s su anda stokta var (%d adet).".formatted(name, stock)
                : "%s su anda stokta yok.".formatted(name);

        return ChatMessageResponse.builder()
                .intent(intent.name())
                .reply(reply)
                .suggestions(topTitles(hits, 3))
                .build();
    }

    private ChatMessageResponse handleProductInfo(ChatIntent intent, String customerMessage, List<RetrievedKnowledge> hits) {
        RetrievedKnowledge top = topHit(hits);
        if (top == null || top.score() < 0.14) {
            return ChatMessageResponse.builder()
                    .intent(intent.name())
                    .reply("Hangi urunle ilgili bilgi istediginizi netlestirebilir misiniz?")
                    .clarificationNeeded(true)
                    .options(topTitles(hits, 4))
                    .build();
        }

        List<String> fallbackSuggestions = topTitles(hits, 4);
        String description = metadataString(top.document().metadata(), "description");
        String category = metadataString(top.document().metadata(), "category");
        String name = metadataString(top.document().metadata(), "name");
        boolean stockAvailable = metadataBool(top.document().metadata(), "stockAvailable");
        double price = metadataDouble(top.document().metadata(), "price");

        String deterministicReply = description.isBlank()
                ? "%s icin detayli aciklama bilgisi su an mevcut degil. Kategori: %s, fiyat: %.2f TL, stok: %s."
                .formatted(name, category, price, stockAvailable ? "var" : "yok")
                : "%s: %s Kategori: %s, fiyat: %.2f TL, stok: %s."
                .formatted(name, description, category, price, stockAvailable ? "var" : "yok");

        return chatResponseComposer.compose(intent, customerMessage, hits)
                .map(answer -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(answer.reply())
                        .suggestions(answer.suggestions().isEmpty() ? fallbackSuggestions : answer.suggestions())
                        .build())
                .orElseGet(() -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(deterministicReply)
                        .suggestions(fallbackSuggestions)
                        .build());
    }

    private ChatMessageResponse handleMenuQuestion(ChatIntent intent, String customerMessage, List<RetrievedKnowledge> hits) {
        List<String> inStockSuggestions = hits.stream()
                .filter(hit -> metadataBool(hit.document().metadata(), "stockAvailable"))
                .map(hit -> metadataString(hit.document().metadata(), "name"))
                .distinct()
                .limit(6)
                .toList();

        if (inStockSuggestions.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent(intent.name())
                    .reply("Bu kriter icin stokta urun bulamadim.")
                    .build();
        }

        String deterministicReply = "Su an menude one cikan secenekler: " + String.join(", ", inStockSuggestions) + ".";

        return chatResponseComposer.compose(intent, customerMessage, hits)
                .map(answer -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(answer.reply())
                        .suggestions(answer.suggestions().isEmpty() ? inStockSuggestions : answer.suggestions())
                        .build())
                .orElseGet(() -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(deterministicReply)
                        .suggestions(inStockSuggestions)
                        .build());
    }

    private ChatMessageResponse handleRecommendation(
            ChatIntent intent,
            String customerMessage,
            List<RetrievedKnowledge> hits,
            List<KnowledgeDocument> index) {
        String normalizedMessage = ChatTextNormalizer.normalize(customerMessage);
        List<KnowledgeDocument> source = hits.isEmpty()
                ? index
                : hits.stream().map(RetrievedKnowledge::document).toList();

        List<String> recommended = source.stream()
                .filter(doc -> metadataBool(doc.metadata(), "stockAvailable"))
                .filter(doc -> matchesRecommendationHint(normalizedMessage, doc))
                .map(doc -> metadataString(doc.metadata(), "name"))
                .distinct()
                .limit(4)
                .toList();

        if (recommended.isEmpty()) {
            recommended = source.stream()
                    .filter(doc -> metadataBool(doc.metadata(), "stockAvailable"))
                    .map(doc -> metadataString(doc.metadata(), "name"))
                    .distinct()
                    .limit(4)
                    .toList();
        }

        if (recommended.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent(intent.name())
                    .reply("Su an onerilecek stokta urun bulamadim.")
                    .build();
        }

        final List<String> finalRecommended = recommended;
        String deterministicReply = "Su an stokta olan ve isteginize uygun onerilerim: " + String.join(", ", finalRecommended) + ".";
        return chatResponseComposer.compose(intent, customerMessage, hits)
                .map(answer -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(answer.reply())
                        .suggestions(answer.suggestions().isEmpty() ? finalRecommended : answer.suggestions())
                        .build())
                .orElseGet(() -> ChatMessageResponse.builder()
                        .intent(intent.name())
                        .reply(deterministicReply)
                        .suggestions(finalRecommended)
                        .build());
    }

    private boolean matchesRecommendationHint(String normalizedMessage, KnowledgeDocument document) {
        String category = ChatTextNormalizer.normalize(metadataString(document.metadata(), "category"));
        String description = ChatTextNormalizer.normalize(metadataString(document.metadata(), "description"));
        String tags = ChatTextNormalizer.normalize(String.join(" ", metadataTags(document.metadata())));
        String title = ChatTextNormalizer.normalize(document.title());

        if (normalizedMessage.contains("acisiz")) {
            return tags.contains("acisiz") || description.contains("acisiz");
        }
        if (normalizedMessage.contains("hafif")) {
            return tags.contains("hafif")
                    || description.contains("hafif")
                    || category.contains("salata")
                    || category.contains("corba");
        }
        if (normalizedMessage.contains("tatli")) {
            return category.contains("tatli");
        }
        if (normalizedMessage.contains("icecek")) {
            return category.contains("icecek");
        }
        return title.contains(normalizedMessage) || category.contains(normalizedMessage) || tags.contains(normalizedMessage);
    }

    private List<String> metadataTags(Map<String, Object> metadata) {
        if (metadata == null) {
            return List.of();
        }
        Object raw = metadata.get("tags");
        if (raw instanceof List<?>) {
            List<?> list = (List<?>) raw;
            return list.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .collect(Collectors.toCollection(ArrayList::new));
        }
        return List.of();
    }

    private RetrievedKnowledge topHit(List<RetrievedKnowledge> hits) {
        if (hits == null || hits.isEmpty()) {
            return null;
        }
        return hits.stream().max(Comparator.comparingDouble(RetrievedKnowledge::score)).orElse(null);
    }

    private List<String> topTitles(List<RetrievedKnowledge> hits, int limit) {
        if (hits == null || hits.isEmpty()) {
            return List.of();
        }
        return hits.stream()
                .map(hit -> metadataString(hit.document().metadata(), "name"))
                .filter(name -> !name.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .limit(limit)
                .toList();
    }

    private String metadataString(Map<String, Object> metadata, String key) {
        if (metadata == null || key == null) {
            return "";
        }
        Object raw = metadata.get(key);
        return raw == null ? "" : String.valueOf(raw);
    }

    private int metadataInt(Map<String, Object> metadata, String key) {
        if (metadata == null || key == null) {
            return 0;
        }
        Object raw = metadata.get(key);
        if (raw instanceof Number) {
            Number number = (Number) raw;
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (Exception ex) {
            return 0;
        }
    }

    private double metadataDouble(Map<String, Object> metadata, String key) {
        if (metadata == null || key == null) {
            return 0.0;
        }
        Object raw = metadata.get(key);
        if (raw instanceof Number) {
            Number number = (Number) raw;
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(raw));
        } catch (Exception ex) {
            return 0.0;
        }
    }

    private boolean metadataBool(Map<String, Object> metadata, String key) {
        if (metadata == null || key == null) {
            return false;
        }
        Object raw = metadata.get(key);
        if (raw instanceof Boolean) {
            Boolean value = (Boolean) raw;
            return value;
        }
        return "true".equalsIgnoreCase(String.valueOf(raw));
    }
}
