package com.garson.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.garson.backend.dto.ai.CustomerAiChatRequest;
import com.garson.backend.dto.ai.CustomerAiChatResponse;
import com.garson.backend.dto.ai.CustomerAiIntent;
import com.garson.backend.dto.ai.CustomerAiItemDraft;
import com.garson.backend.dto.ai.CustomerAiSuggestedProduct;
import com.garson.backend.dto.ai.OllamaCustomerAiDraft;
import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerAiService {

    private static final Pattern QUANTITY_ALIAS_PATTERN = Pattern.compile(
            "(?:^|\\s)(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(?:\\s+adet|\\s+tane)?\\s+%s(?:\\s|$)");

    private static final Map<String, Integer> NUMBER_WORDS = Map.of(
            "bir", 1,
            "iki", 2,
            "uc", 3,
            "dort", 4,
            "bes", 5,
            "alti", 6,
            "yedi", 7,
            "sekiz", 8,
            "dokuz", 9,
            "on", 10);

    private static final List<NoteRule> NOTE_RULES = List.of(
            new NoteRule("acili", "Acili olsun"),
            new NoteRule("sogansiz", "Sogansiz"),
            new NoteRule("sekersiz", "Sekersiz"),
            new NoteRule("az tuzlu", "Az tuzlu"),
            new NoteRule("tuzsuz", "Tuzsuz"));

    private static final List<String> CART_KEYWORDS = List.of("ekle", "olsun", "isterim", "istiyorum", "alalim");
    private static final List<String> MENU_KEYWORDS = List.of("oner", "ne var", "hafif", "yanina", "acisiz", "tatli", "tavuk");

    private final ProductRepository productRepository;
    private final OllamaClient ollamaClient;
    private final ObjectMapper objectMapper;

    public CustomerAiChatResponse handleCustomerChat(CustomerAiChatRequest request) {
        if (request == null) {
            return CustomerAiChatResponse.clarification("Mesaj bos. Lutfen siparisinizi yazin.");
        }

        String message = request.getMessage() == null ? "" : request.getMessage().trim();
        if (message.isEmpty()) {
            return CustomerAiChatResponse.clarification("Tam olarak hangi urunu istediginizi yazar misiniz?");
        }

        List<Product> products = productRepository.findAll();
        if (products.isEmpty()) {
            return CustomerAiChatResponse.unsupported("Menu su anda bos oldugu icin yardimci olamiyorum.");
        }

        String systemPrompt = buildSystemPrompt(products);
        String userPrompt = buildUserPrompt(request, message);

        Optional<OllamaCustomerAiDraft> llmDraft = ollamaClient.chatJsonOnly(systemPrompt, userPrompt)
                .flatMap(this::parseDraftSafely);

        if (llmDraft.isPresent()) {
            CustomerAiChatResponse sanitized = sanitizeDraft(llmDraft.get(), message, products);
            if (sanitized != null) {
                return sanitized;
            }
        }

        return fallbackResponse(message, products);
    }

    private Optional<OllamaCustomerAiDraft> parseDraftSafely(String rawJson) {
        String cleaned = cleanupPotentialJson(rawJson);
        try {
            return Optional.of(objectMapper.readValue(cleaned, OllamaCustomerAiDraft.class));
        } catch (JsonProcessingException ex) {
            log.warn("Could not parse Ollama JSON payload: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private CustomerAiChatResponse sanitizeDraft(OllamaCustomerAiDraft draft, String message, List<Product> products) {
        CustomerAiIntent intent = CustomerAiIntent.fromRaw(draft.getIntent());

        if (intent == CustomerAiIntent.CART_UPDATE) {
            List<CustomerAiItemDraft> sanitizedItems = sanitizeItems(draft.getItems(), message, products);
            if (sanitizedItems.isEmpty()) {
                return CustomerAiChatResponse.clarification(
                        "Menude eslesen bir urun bulamadim. Urun adini netlestirebilir misiniz?");
            }

            String assistantMessage = isBlank(draft.getAssistantMessage())
                    ? buildCartMessage(sanitizedItems)
                    : draft.getAssistantMessage();

            return new CustomerAiChatResponse(
                    CustomerAiIntent.CART_UPDATE.value(),
                    assistantMessage,
                    sanitizedItems,
                    Collections.emptyList());
        }

        if (intent == CustomerAiIntent.MENU_ASSISTANT) {
            List<CustomerAiSuggestedProduct> suggestions = sanitizeSuggestions(draft.getSuggestedProducts(), products);
            if (suggestions.isEmpty()) {
                suggestions = inferSuggestionsFromMessage(message, products);
            }

            String assistantMessage = isBlank(draft.getAssistantMessage())
                    ? "Menuye gore uygun secenekleri paylastim."
                    : draft.getAssistantMessage();

            return new CustomerAiChatResponse(
                    CustomerAiIntent.MENU_ASSISTANT.value(),
                    assistantMessage,
                    Collections.emptyList(),
                    suggestions);
        }

        if (intent == CustomerAiIntent.UNSUPPORTED) {
            return CustomerAiChatResponse.unsupported(
                    isBlank(draft.getAssistantMessage())
                            ? "Bu konuda yardimci olamiyorum."
                            : draft.getAssistantMessage());
        }

        return CustomerAiChatResponse.clarification(
                isBlank(draft.getAssistantMessage())
                        ? "Tam olarak hangi urunu istediginizi netlestirebilir misiniz?"
                        : draft.getAssistantMessage());
    }

    private CustomerAiChatResponse fallbackResponse(String message, List<Product> products) {
        String normalizedMessage = normalize(message);

        List<CustomerAiItemDraft> cartItems = inferCartItemsFromMessage(normalizedMessage, products);
        if (!cartItems.isEmpty() || containsAny(normalizedMessage, CART_KEYWORDS)) {
            if (cartItems.isEmpty()) {
                return CustomerAiChatResponse.clarification("Mesajinizda menude eslesen bir urun bulamadim.");
            }

            return new CustomerAiChatResponse(
                    CustomerAiIntent.CART_UPDATE.value(),
                    buildCartMessage(cartItems),
                    cartItems,
                    Collections.emptyList());
        }

        List<CustomerAiSuggestedProduct> suggestions = inferSuggestionsFromMessage(message, products);
        if (!suggestions.isEmpty() || containsAny(normalizedMessage, MENU_KEYWORDS)) {
            String suggestionText = suggestions.stream()
                    .map(CustomerAiSuggestedProduct::getProductName)
                    .collect(Collectors.joining(", "));
            String assistantMessage = suggestions.isEmpty()
                    ? "Menuye gore uygun secenek bulamadim."
                    : "Menuye gore su secenekleri oneririm: " + suggestionText + ".";

            return new CustomerAiChatResponse(
                    CustomerAiIntent.MENU_ASSISTANT.value(),
                    assistantMessage,
                    Collections.emptyList(),
                    suggestions);
        }

        return CustomerAiChatResponse.clarification("Tam olarak hangi urunu istediginizi netlestirebilir misiniz?");
    }

    private List<CustomerAiItemDraft> sanitizeItems(List<CustomerAiItemDraft> rawItems, String message, List<Product> products) {
        if (rawItems == null || rawItems.isEmpty()) {
            return inferCartItemsFromMessage(normalize(message), products);
        }

        Map<String, CustomerAiItemDraft> merged = new LinkedHashMap<>();
        for (CustomerAiItemDraft rawItem : rawItems) {
            Product matched = resolveProduct(rawItem.getProductId(), rawItem.getProductName(), products);
            if (matched == null || !isInStock(matched)) {
                continue;
            }

            int quantity = clampQuantity(rawItem.getQuantity());
            String specialNote = safeTrim(rawItem.getSpecialNote());
            if (specialNote.isEmpty()) {
                specialNote = inferNoteForProduct(normalize(message), matched);
            }

            String key = matched.getId() + "|" + specialNote;
            CustomerAiItemDraft existing = merged.get(key);
            if (existing == null) {
                merged.put(key, new CustomerAiItemDraft(matched.getId(), matched.getName(), quantity, specialNote));
            } else {
                existing.setQuantity(existing.getQuantity() + quantity);
            }
        }

        return new ArrayList<>(merged.values());
    }

    private List<CustomerAiItemDraft> inferCartItemsFromMessage(String normalizedMessage, List<Product> products) {
        Map<String, CustomerAiItemDraft> merged = new LinkedHashMap<>();

        for (Product product : products) {
            if (!isInStock(product)) {
                continue;
            }

            List<String> aliases = aliasesForProduct(product.getName());
            String matchedAlias = aliases.stream().filter(alias -> containsAlias(normalizedMessage, alias)).findFirst().orElse(null);
            if (matchedAlias == null) {
                continue;
            }

            int quantity = inferQuantity(normalizedMessage, matchedAlias);
            String note = inferNoteForProduct(normalizedMessage, product);

            String key = product.getId() + "|" + note;
            CustomerAiItemDraft existing = merged.get(key);
            if (existing == null) {
                merged.put(key, new CustomerAiItemDraft(product.getId(), product.getName(), quantity, note));
            } else {
                existing.setQuantity(existing.getQuantity() + quantity);
            }
        }

        return new ArrayList<>(merged.values());
    }

    private List<CustomerAiSuggestedProduct> sanitizeSuggestions(List<CustomerAiSuggestedProduct> raw, List<Product> products) {
        if (raw == null || raw.isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, Product> byId = products.stream().collect(Collectors.toMap(Product::getId, p -> p, (a, b) -> a));
        List<CustomerAiSuggestedProduct> out = new ArrayList<>();

        for (CustomerAiSuggestedProduct item : raw) {
            Product resolved = null;
            if (item.getProductId() != null) {
                resolved = byId.get(item.getProductId());
            }
            if (resolved == null && !isBlank(item.getProductName())) {
                resolved = resolveProduct(null, item.getProductName(), products);
            }
            if (resolved != null && isInStock(resolved)) {
                out.add(new CustomerAiSuggestedProduct(resolved.getId(), resolved.getName()));
            }
        }

        return out.stream().distinct().limit(4).toList();
    }

    private List<CustomerAiSuggestedProduct> inferSuggestionsFromMessage(String message, List<Product> products) {
        String normalized = normalize(message);
        List<Product> inStock = products.stream().filter(this::isInStock).toList();

        List<Product> selected;
        if (normalized.contains("sutlu") || normalized.contains("tatli")) {
            selected = inStock.stream()
                    .filter(p -> hasTag(p, "sutlu tatli") || "tatli".equalsIgnoreCase(safeTrim(p.getCategory())))
                    .limit(4)
                    .toList();
        } else if (normalized.contains("hafif")) {
            selected = inStock.stream()
                    .filter(p -> List.of("salata", "icecek", "tatli").contains(safeTrim(p.getCategory()).toLowerCase(Locale.ROOT)))
                    .limit(4)
                    .toList();
        } else if (normalized.contains("tavuk")) {
            selected = inStock.stream()
                    .filter(p -> normalize(p.getName()).contains("tavuk"))
                    .limit(4)
                    .toList();
        } else if (normalized.contains("acisiz")) {
            selected = inStock.stream()
                    .filter(p -> hasTag(p, "acisiz"))
                    .limit(4)
                    .toList();
        } else {
            selected = inStock.stream()
                    .sorted(Comparator.comparing(Product::getName))
                    .limit(4)
                    .toList();
        }

        return selected.stream()
                .map(p -> new CustomerAiSuggestedProduct(p.getId(), p.getName()))
                .toList();
    }

    private Product resolveProduct(Long productId, String productName, List<Product> products) {
        if (productId != null) {
            Product byId = products.stream().filter(p -> p.getId().equals(productId)).findFirst().orElse(null);
            if (byId != null) {
                return byId;
            }
        }

        if (isBlank(productName)) {
            return null;
        }

        String normalizedName = normalize(productName);

        Product exact = products.stream()
                .filter(p -> normalize(p.getName()).equals(normalizedName))
                .findFirst()
                .orElse(null);
        if (exact != null) {
            return exact;
        }

        return products.stream()
                .filter(p -> aliasesForProduct(p.getName()).stream().anyMatch(alias -> containsAlias(normalizedName, alias)))
                .findFirst()
                .orElse(null);
    }

    private String buildSystemPrompt(List<Product> products) {
        String productsJson;
        try {
            List<Map<String, Object>> productList = products.stream().map(this::toPromptProduct).toList();
            productsJson = objectMapper.writeValueAsString(productList);
        } catch (JsonProcessingException ex) {
            productsJson = "[]";
        }

        return "You are a restaurant customer assistant.\n"
                + "You MUST return only valid JSON.\n"
                + "Never create products outside MENU.\n"
                + "Never invent stock or prices.\n"
                + "Never finalize an order.\n"
                + "You only return assistant draft output.\n\n"
                + "Allowed intents: menu_assistant, cart_update, clarification, unsupported\n\n"
                + "JSON schema:\n"
                + "{\n"
                + "  \"intent\": \"menu_assistant|cart_update|clarification|unsupported\",\n"
                + "  \"assistantMessage\": \"string\",\n"
                + "  \"items\": [\n"
                + "    {\n"
                + "      \"productId\": 1,\n"
                + "      \"productName\": \"string\",\n"
                + "      \"quantity\": 1,\n"
                + "      \"specialNote\": \"string\"\n"
                + "    }\n"
                + "  ],\n"
                + "  \"suggestedProducts\": [\n"
                + "    {\n"
                + "      \"productId\": 1,\n"
                + "      \"productName\": \"string\"\n"
                + "    }\n"
                + "  ]\n"
                + "}\n\n"
                + "Rule: \"acili patates\" -> real menu product match + specialNote, not a new product.\n"
                + "MENU:\n"
                + productsJson;
    }

    private String buildUserPrompt(CustomerAiChatRequest request, String message) {
        String cartJson;
        try {
            cartJson = objectMapper.writeValueAsString(request.getCart() == null ? List.of() : request.getCart());
        } catch (JsonProcessingException ex) {
            cartJson = "[]";
        }

        return String.format(
                "tableId: %s%ncustomerMessage: %s%ncurrentCart: %s%nReturn JSON only.",
                String.valueOf(request.getTableId()),
                message,
                cartJson);
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
        if (isBlank(tags)) {
            return List.of();
        }

        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private boolean hasTag(Product product, String requiredTag) {
        String normalizedRequired = normalize(requiredTag);
        return parseTags(product.getTags()).stream().anyMatch(tag -> normalize(tag).equals(normalizedRequired));
    }

    private int inferQuantity(String normalizedMessage, String alias) {
        Pattern pattern = Pattern.compile(String.format(QUANTITY_ALIAS_PATTERN.pattern(), Pattern.quote(alias)));
        Matcher matcher = pattern.matcher(normalizedMessage);
        if (matcher.find()) {
            String token = matcher.group(1);
            if (token == null) {
                return 1;
            }
            if (token.matches("\\d+")) {
                return clampQuantity(Integer.parseInt(token));
            }
            return clampQuantity(NUMBER_WORDS.getOrDefault(token, 1));
        }
        return 1;
    }

    private String inferNoteForProduct(String normalizedMessage, Product product) {
        List<String> aliases = aliasesForProduct(product.getName());
        List<String> clauses = splitClauses(normalizedMessage);

        for (String clause : clauses) {
            boolean aliasInClause = aliases.stream().anyMatch(alias -> containsAlias(clause, alias));
            if (!aliasInClause) {
                continue;
            }

            List<String> notes = NOTE_RULES.stream()
                    .filter(rule -> containsAlias(clause, rule.key()))
                    .map(NoteRule::value)
                    .distinct()
                    .toList();

            if (!notes.isEmpty()) {
                return String.join(", ", notes);
            }
        }

        return "";
    }

    private List<String> splitClauses(String normalizedMessage) {
        return Arrays.stream(normalizedMessage.split("\\s+ve\\s+|,|\\s+ile\\s+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private List<String> aliasesForProduct(String productName) {
        String normalizedName = normalize(productName);
        List<String> aliases = new ArrayList<>();
        aliases.add(normalizedName);

        for (String token : normalizedName.split(" ")) {
            if (token.length() >= 3 || "su".equals(token)) {
                aliases.add(token);
            }
        }

        if (normalizedName.contains("hamburger")) {
            aliases.add("burger");
        }
        if (normalizedName.contains("patates")) {
            aliases.add("fries");
        }

        return aliases.stream().distinct().toList();
    }

    private boolean containsAlias(String normalizedText, String alias) {
        Pattern pattern = Pattern.compile("(^|\\s)" + Pattern.quote(alias) + "(\\s|$)");
        return pattern.matcher(normalizedText).find();
    }

    private boolean containsAny(String normalizedMessage, List<String> keys) {
        return keys.stream().anyMatch(key -> normalizedMessage.contains(normalize(key)));
    }

    private String buildCartMessage(List<CustomerAiItemDraft> items) {
        String joinedItems = items.stream()
                .map(item -> item.getQuantity() + " x " + item.getProductName())
                .collect(Collectors.joining(", "));

        String notes = items.stream()
                .filter(item -> !isBlank(item.getSpecialNote()))
                .map(item -> item.getProductName() + " notu: " + item.getSpecialNote())
                .collect(Collectors.joining("; "));

        if (notes.isBlank()) {
            return joinedItems + " sepete eklenebilir.";
        }

        return joinedItems + " sepete eklenebilir. " + notes;
    }

    private boolean isInStock(Product product) {
        return product.getStock() == null || product.getStock() > 0;
    }

    private int clampQuantity(Integer quantity) {
        int safe = quantity == null ? 1 : quantity;
        if (safe < 1) {
            return 1;
        }
        return Math.min(safe, 99);
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

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return safeTrim(value).isEmpty();
    }

    private static final class NoteRule {
        private final String key;
        private final String value;

        private NoteRule(String key, String value) {
            this.key = key;
            this.value = value;
        }

        private String key() {
            return key;
        }

        private String value() {
            return value;
        }
    }

    private String cleanupPotentialJson(String raw) {
        if (raw == null) {
            return "";
        }

        String cleaned = raw.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.substring(7).trim();
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.substring(3).trim();
        }
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
        }

        int firstBrace = cleaned.indexOf('{');
        int lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        return cleaned;
    }
}
