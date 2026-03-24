package com.garson.backend.dto.product;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Arrays;
import java.util.List;
import java.util.stream.StreamSupport;
import java.util.stream.Collectors;

public final class ProductTagUtils {

    private ProductTagUtils() {
    }

    public static String toTagStorage(ProductUpsertRequest request) {
        JsonNode tagsNode = request.getTags();
        if (tagsNode != null && tagsNode.isArray()) {
            List<String> values = StreamSupport.stream(tagsNode.spliterator(), false)
                    .map(JsonNode::asText)
                    .map(String::trim)
                    .filter(v -> !v.isEmpty())
                    .toList();
            return toTagStorage(values);
        }

        if (tagsNode == null || tagsNode.isNull()) {
            return null;
        }

        if (!tagsNode.isTextual()) {
            return null;
        }

        String raw = tagsNode.asText();
        if (raw.isBlank()) {
            return null;
        }

        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.joining(","));
    }

    public static String toTagStorage(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }

        return tags.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.joining(","));
    }
}
