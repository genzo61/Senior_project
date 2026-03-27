package com.garson.backend.service.chat.retrieval;

import com.garson.backend.model.Product;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ProductKnowledgeIndexBuilder implements KnowledgeIndexBuilder {

    @Override
    public List<KnowledgeDocument> build(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return List.of();
        }

        return products.stream().map(this::toDocument).toList();
    }

    private KnowledgeDocument toDocument(Product product) {
        String title = safe(product.getName(), "Urun");
        String category = safe(product.getCategory(), "Belirtilmemis");
        String description = safe(product.getDescription(), "");
        String tags = safe(product.getTags(), "");
        Integer stock = product.getStock() == null ? 0 : product.getStock();
        boolean inStock = stock > 0;

        String content = String.format(
                Locale.ROOT,
                "%s | kategori: %s | aciklama: %s | etiketler: %s | stok: %s | fiyat: %s",
                title,
                category,
                description.isBlank() ? "Bu bilgi mevcut degil" : description,
                tags.isBlank() ? "-" : tags,
                inStock ? "var (" + stock + ")" : "yok (0)",
                String.valueOf(product.getPrice() == null ? 0.0 : product.getPrice()));

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("productId", product.getId());
        metadata.put("name", title);
        metadata.put("category", category);
        metadata.put("description", description);
        metadata.put("price", product.getPrice() == null ? 0.0 : product.getPrice());
        metadata.put("stock", stock);
        metadata.put("stockAvailable", inStock);
        metadata.put("tags", parseTags(tags));

        return new KnowledgeDocument(
                "product-" + product.getId(),
                "PRODUCT",
                title,
                content,
                metadata);
    }

    private List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private String safe(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return value.trim();
    }
}
