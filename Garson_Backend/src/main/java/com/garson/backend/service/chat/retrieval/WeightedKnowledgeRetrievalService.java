package com.garson.backend.service.chat.retrieval;

import com.garson.backend.service.chat.ChatTextNormalizer;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class WeightedKnowledgeRetrievalService implements KnowledgeRetrievalService {

    @Override
    public List<RetrievedKnowledge> retrieve(String query, List<KnowledgeDocument> documents, int limit) {
        if (documents == null || documents.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 5 : limit, 20));
        String normalizedQuery = ChatTextNormalizer.normalize(query);
        if (normalizedQuery.isBlank()) {
            return documents.stream()
                    .limit(safeLimit)
                    .map(doc -> new RetrievedKnowledge(doc, 0.0))
                    .toList();
        }

        Set<String> queryTokens = ChatTextNormalizer.tokens(normalizedQuery);
        List<RetrievedKnowledge> scored = new ArrayList<>();
        for (KnowledgeDocument document : documents) {
            double score = scoreDocument(normalizedQuery, queryTokens, document);
            scored.add(new RetrievedKnowledge(document, score));
        }

        List<RetrievedKnowledge> topMatches = scored.stream()
                .sorted(Comparator.comparingDouble(RetrievedKnowledge::score).reversed())
                .filter(item -> item.score() > 0.11)
                .limit(safeLimit)
                .toList();

        if (!topMatches.isEmpty()) {
            return topMatches;
        }

        return scored.stream()
                .sorted(Comparator.comparingDouble(RetrievedKnowledge::score).reversed())
                .limit(safeLimit)
                .toList();
    }

    private double scoreDocument(String normalizedQuery, Set<String> queryTokens, KnowledgeDocument document) {
        String title = ChatTextNormalizer.normalize(document.title());
        String content = ChatTextNormalizer.normalize(document.content());
        String category = ChatTextNormalizer.normalize(metadataString(document.metadata(), "category"));
        Set<String> titleTokens = ChatTextNormalizer.tokens(title);
        Set<String> contentTokens = ChatTextNormalizer.tokens(content);

        double score = 0.0;

        if (title.contains(normalizedQuery) || normalizedQuery.contains(title)) {
            score += 0.58;
        }
        score += overlapRatio(queryTokens, titleTokens) * 0.34;
        score += overlapRatio(queryTokens, contentTokens) * 0.16;

        if (!category.isBlank() && normalizedQuery.contains(category)) {
            score += 0.24;
        }

        List<String> tags = metadataTags(document.metadata());
        if (!tags.isEmpty()) {
            String joinedTags = ChatTextNormalizer.normalize(String.join(" ", tags));
            Set<String> tagTokens = ChatTextNormalizer.tokens(joinedTags);
            score += overlapRatio(queryTokens, tagTokens) * 0.18;
        }

        score += typoBonus(queryTokens, titleTokens);
        return Math.min(1.0, score);
    }

    private double overlapRatio(Set<String> queryTokens, Set<String> documentTokens) {
        if (queryTokens.isEmpty() || documentTokens.isEmpty()) {
            return 0.0;
        }
        long overlap = queryTokens.stream().filter(documentTokens::contains).count();
        return (double) overlap / (double) queryTokens.size();
    }

    private double typoBonus(Set<String> queryTokens, Set<String> titleTokens) {
        if (queryTokens.isEmpty() || titleTokens.isEmpty()) {
            return 0.0;
        }
        double bonus = 0.0;
        for (String token : queryTokens) {
            if (token.length() < 4 || titleTokens.contains(token)) {
                continue;
            }
            int distance = titleTokens.stream()
                    .mapToInt(titleToken -> ChatTextNormalizer.levenshtein(token, titleToken))
                    .min()
                    .orElse(10);
            if (distance <= 1) {
                bonus += 0.07;
            }
        }
        return bonus;
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
                    .toList();
        }
        return List.of();
    }

    private String metadataString(Map<String, Object> metadata, String key) {
        if (metadata == null || key == null) {
            return "";
        }
        Object raw = metadata.get(key);
        return raw == null ? "" : String.valueOf(raw);
    }
}
