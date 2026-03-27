package com.garson.backend.service.chat;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

public final class ChatTextNormalizer {

    private ChatTextNormalizer() {
    }

    public static String normalize(String value) {
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

    public static Set<String> tokens(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(normalizedText.split(" "))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    public static int levenshtein(String left, String right) {
        String a = left == null ? "" : left;
        String b = right == null ? "" : right;

        if (a.equals(b)) {
            return 0;
        }
        if (a.isEmpty()) {
            return b.length();
        }
        if (b.isEmpty()) {
            return a.length();
        }

        int[] costs = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            costs[j] = j;
        }

        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int northwest = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int north = costs[j];
                int west = costs[j - 1];
                int substitutionCost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                costs[j] = Math.min(Math.min(north + 1, west + 1), northwest + substitutionCost);
                northwest = north;
            }
        }

        return costs[b.length()];
    }
}
