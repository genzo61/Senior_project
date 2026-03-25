package com.garson.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.garson.backend.model.Product;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ProductRagService {

    private static final int DEFAULT_LIMIT = 10;

    private final OllamaClient ollamaClient;
    private final ObjectMapper objectMapper;

    private final Map<Long, CachedEmbedding> embeddingCache = new ConcurrentHashMap<>();

    public List<Product> retrieveRelevantProducts(String query, List<Product> products, int limit) {
        if (products == null || products.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit <= 0 ? DEFAULT_LIMIT : limit, 20));
        String normalizedQuery = normalize(query);
        if (normalizedQuery.isBlank()) {
            return products.stream()
                    .filter(this::isInStock)
                    .sorted(Comparator.comparing(this::safeName, String.CASE_INSENSITIVE_ORDER))
                    .limit(safeLimit)
                    .toList();
        }

        double[] queryEmbedding = toPrimitive(ollamaClient.embedText(query).orElse(Collections.emptyList()));
        boolean hasEmbedding = queryEmbedding.length > 0;

        List<ScoredProduct> scored = new ArrayList<>();
        for (Product product : products) {
            if (!isInStock(product)) {
                continue;
            }

            String docText = buildProductDocument(product);
            double lexicalScore = lexicalScore(normalizedQuery, product, docText);

            double embeddingScore = 0.0;
            if (hasEmbedding) {
                double[] productEmbedding = getOrCreateProductEmbedding(product, docText);
                embeddingScore = cosineSimilarity(queryEmbedding, productEmbedding);
            }

            double finalScore = hasEmbedding
                    ? clamp((embeddingScore * 0.76) + (lexicalScore * 0.24), 0.0, 1.0)
                    : lexicalScore;

            scored.add(new ScoredProduct(product, finalScore, lexicalScore));
        }

        scored.sort(Comparator
                .comparingDouble(ScoredProduct::finalScore).reversed()
                .thenComparing(Comparator.comparingDouble(ScoredProduct::lexicalScore).reversed())
                .thenComparing(sp -> safeName(sp.product()), String.CASE_INSENSITIVE_ORDER));

        List<Product> top = scored.stream()
                .filter(score -> score.finalScore() > 0.08 || score.lexicalScore() > 0.10)
                .limit(safeLimit)
                .map(ScoredProduct::product)
                .toList();

        if (!top.isEmpty()) {
            return top;
        }

        return scored.stream()
                .limit(safeLimit)
                .map(ScoredProduct::product)
                .toList();
    }

    public String toPromptContextJson(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return "[]";
        }

        List<Map<String, Object>> rows = products.stream()
                .map(this::toPromptProduct)
                .toList();
        try {
            return objectMapper.writeValueAsString(rows);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    private Map<String, Object> toPromptProduct(Product product) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", product.getId());
        row.put("name", product.getName());
        row.put("category", product.getCategory());
        row.put("description", product.getDescription());
        row.put("price", product.getPrice());
        row.put("stock", product.getStock());
        row.put("tags", parseTags(product.getTags()));
        return row;
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    private String buildProductDocument(Product product) {
        return String.format(
                Locale.ROOT,
                "%s | kategori: %s | aciklama: %s | etiketler: %s | fiyat: %s",
                safeName(product),
                safe(product.getCategory()),
                safe(product.getDescription()),
                safe(product.getTags()),
                String.valueOf(product.getPrice()));
    }

    private double lexicalScore(String normalizedQuery, Product product, String docText) {
        Set<String> qTokens = tokens(normalizedQuery);
        if (qTokens.isEmpty()) {
            return 0.0;
        }

        String normalizedName = normalize(safeName(product));
        String normalizedCategory = normalize(safe(product.getCategory()));
        String normalizedDoc = normalize(docText);
        Set<String> dTokens = tokens(normalizedDoc);

        long overlapCount = qTokens.stream().filter(dTokens::contains).count();
        double overlap = (double) overlapCount / (double) qTokens.size();

        double phraseBoost = 0.0;
        if (normalizedName.contains(normalizedQuery) || normalizedQuery.contains(normalizedName)) {
            phraseBoost += 0.40;
        }

        if (!normalizedCategory.isBlank() && normalizedQuery.contains(normalizedCategory)) {
            phraseBoost += 0.32;
        }

        for (String token : qTokens) {
            if (token.length() >= 3 && normalizedName.contains(token)) {
                phraseBoost += 0.08;
            }
        }

        return clamp(overlap + phraseBoost, 0.0, 1.0);
    }

    private double[] getOrCreateProductEmbedding(Product product, String docText) {
        if (product == null || product.getId() == null) {
            return new double[0];
        }

        String signature = buildSignature(product, docText);
        CachedEmbedding cached = embeddingCache.get(product.getId());
        if (cached != null && cached.signature().equals(signature)) {
            return cached.embedding();
        }

        double[] embedding = toPrimitive(ollamaClient.embedText(docText).orElse(Collections.emptyList()));
        if (embedding.length == 0) {
            return embedding;
        }

        embeddingCache.put(product.getId(), new CachedEmbedding(signature, embedding));
        return embedding;
    }

    private String buildSignature(Product product, String docText) {
        return product.getId()
                + "|"
                + safeName(product)
                + "|"
                + safe(product.getCategory())
                + "|"
                + safe(product.getDescription())
                + "|"
                + safe(product.getTags())
                + "|"
                + String.valueOf(product.getPrice())
                + "|"
                + String.valueOf(product.getStock())
                + "|"
                + Integer.toHexString(docText.hashCode());
    }

    private double cosineSimilarity(double[] a, double[] b) {
        if (a == null || b == null || a.length == 0 || b.length == 0) {
            return 0.0;
        }

        int size = Math.min(a.length, b.length);
        double dot = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < size; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA <= 0.0 || normB <= 0.0) {
            return 0.0;
        }

        return clamp(dot / (Math.sqrt(normA) * Math.sqrt(normB)), -1.0, 1.0);
    }

    private double[] toPrimitive(List<Double> values) {
        if (values == null || values.isEmpty()) {
            return new double[0];
        }

        double[] out = new double[values.size()];
        for (int i = 0; i < values.size(); i++) {
            Double v = values.get(i);
            out[i] = v == null ? 0.0 : v;
        }
        return out;
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        return value.toLowerCase(Locale.ROOT)
                .replace('\u00e7', 'c')
                .replace('\u011f', 'g')
                .replace('\u0131', 'i')
                .replace('\u00f6', 'o')
                .replace('\u015f', 's')
                .replace('\u00fc', 'u')
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private Set<String> tokens(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) {
            return Set.of();
        }
        Set<String> out = new HashSet<>();
        for (String token : normalizedText.split(" ")) {
            if (!token.isBlank()) {
                out.add(token);
            }
        }
        return out;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeName(Product product) {
        if (product == null || product.getName() == null || product.getName().isBlank()) {
            return "Urun";
        }
        return product.getName().trim();
    }

    private boolean isInStock(Product product) {
        return product != null && (product.getStock() == null || product.getStock() > 0);
    }

    private double clamp(double value, double min, double max) {
        return Math.min(max, Math.max(min, value));
    }

    private static final class CachedEmbedding {
        private final String signature;
        private final double[] embedding;

        private CachedEmbedding(String signature, double[] embedding) {
            this.signature = signature;
            this.embedding = embedding;
        }

        private String signature() {
            return signature;
        }

        private double[] embedding() {
            return embedding;
        }
    }

    private static final class ScoredProduct {
        private final Product product;
        private final double finalScore;
        private final double lexicalScore;

        private ScoredProduct(Product product, double finalScore, double lexicalScore) {
            this.product = product;
            this.finalScore = finalScore;
            this.lexicalScore = lexicalScore;
        }

        private Product product() {
            return product;
        }

        private double finalScore() {
            return finalScore;
        }

        private double lexicalScore() {
            return lexicalScore;
        }
    }
}
