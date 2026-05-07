package com.garson.backend.service.chat.intent;

import com.garson.backend.service.chat.ChatTextNormalizer;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class ChatIntentClassifier {

    private static final Pattern QUANTITY_PATTERN = Pattern.compile("(^|\\s)(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(\\s|$)");

    private static final List<String> ORDER_STATUS_KEYS = List.of(
            "siparisim", "siparis nerede", "hazir mi", "durumu", "durum", "ne zaman gelir", "kac dakika");
    private static final List<String> STOCK_KEYS = List.of(
            "stokta", "kaldi mi", "bitti mi", "mevcut mu", "var mi");
    private static final List<String> RECOMMENDATION_KEYS = List.of(
            "oner", "tavsiye", "bugun ne", "ne yesem", "hafif ne var", "acisiz ne var", "aci olmayan ne var", "hafif");
    private static final List<String> PRODUCT_INFO_KEYS = List.of(
            "icinde ne var", "icerik", "malzeme", "alerjen", "kalori", "aciklama", "fiyati ne");
    private static final List<String> MENU_KEYS = List.of(
            "menu", "neler var", "ne var", "kategori", "içecek", "tatlı", "çorba",
            "salata", "burger", "pizza", "kebap", "atıştırmalık", "kahvaltı", "makarna");
    private static final List<String> ORDER_ACTION_KEYS = List.of(
            "ekle", "getir", "ver", "istiyorum", "alabilir miyim", "olsun", "gonder");
    private static final List<String> SMALL_TALK_KEYS = List.of(
            "merhaba", "selam", "tesekkur", "sag ol", "nasilsin", "iyi aksamlar");
    private static final Set<String> ORDER_STOPWORDS = Set.of(
            "bir", "iki", "uc", "dort", "bes", "alti", "yedi", "sekiz", "dokuz", "on",
            "ve", "ile", "lutfen", "olsun", "ekle", "ver", "getir", "istiyorum", "gonder");

    public ChatIntentDecision classify(String message) {
        String normalized = ChatTextNormalizer.normalize(message);
        if (normalized.isBlank()) {
            return ChatIntentDecision.of(ChatIntent.FALLBACK, "blank_message");
        }

        if (containsAny(normalized, ORDER_STATUS_KEYS)) {
            return ChatIntentDecision.of(ChatIntent.ORDER_STATUS, "status_keywords");
        }

        if (containsAny(normalized, STOCK_KEYS) && containsProductLikeTokens(normalized)) {
            return ChatIntentDecision.of(ChatIntent.STOCK_QUERY, "stock_keywords");
        }

        if (containsAny(normalized, RECOMMENDATION_KEYS)) {
            return ChatIntentDecision.of(ChatIntent.RECOMMENDATION, "recommendation_keywords");
        }

        if (containsAny(normalized, PRODUCT_INFO_KEYS)) {
            return ChatIntentDecision.of(ChatIntent.PRODUCT_INFO, "product_info_keywords");
        }

        if (containsAny(normalized, List.of("ne var", "neler var", "menude", "menu"))) {
            return ChatIntentDecision.of(ChatIntent.MENU_QUESTION, "menu_keywords");
        }

        if (looksLikeOrder(normalized)) {
            return ChatIntentDecision.of(ChatIntent.ORDER_CREATE, "order_pattern");
        }

        if (containsAny(normalized, SMALL_TALK_KEYS)) {
            return ChatIntentDecision.of(ChatIntent.SMALL_TALK, "small_talk_keywords");
        }

        if (containsAny(normalized, MENU_KEYS)) {
            return ChatIntentDecision.of(ChatIntent.MENU_QUESTION, "menu_keyword_fallback");
        }

        return ChatIntentDecision.of(ChatIntent.FALLBACK, "no_rule_match");
    }

    private boolean looksLikeOrder(String normalized) {
        if (containsAny(normalized, ORDER_ACTION_KEYS) && !containsAny(normalized, PRODUCT_INFO_KEYS)) {
            return true;
        }

        if (!QUANTITY_PATTERN.matcher(" " + normalized + " ").find()) {
            return false;
        }

        return containsProductLikeTokens(normalized);
    }

    private boolean containsProductLikeTokens(String normalized) {
        return ChatTextNormalizer.tokens(normalized).stream()
                .filter(token -> token.length() >= 3)
                .anyMatch(token -> !ORDER_STOPWORDS.contains(token));
    }

    private boolean containsAny(String text, List<String> keywords) {
        return keywords.stream().anyMatch(key -> text.contains(ChatTextNormalizer.normalize(key)));
    }
}
