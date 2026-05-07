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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerAiService {

    private static final Pattern QUANTITY_TOKEN_PATTERN = Pattern.compile("(^|\\s)(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(\\s|$)");
    private static final Pattern QUANTITY_CHUNK_PATTERN = Pattern.compile(
            "(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\\s+([a-z0-9\\s]+?)(?=\\s+(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\\s+|$)");

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
            new NoteRule("acisiz", "Acisiz"),
            new NoteRule("sogansiz", "Sogansiz"),
            new NoteRule("sekersiz", "Sekersiz"),
            new NoteRule("az tuzlu", "Az tuzlu"),
            new NoteRule("tuzsuz", "Tuzsuz"),
            new NoteRule("bol eksili", "Bol eksili"),
            new NoteRule("ketcapsiz", "Ketcapsiz"),
            new NoteRule("mayonezsiz", "Mayonezsiz"));

    private static final List<String> CART_KEYWORDS = List.of(
            "ekle",
            "ekler misin",
            "olsun",
            "alalim",
            "sepete at",
            "koy",
            "getir",
            "ver",
            "gonder");
    private static final List<String> MENU_KEYWORDS = List.of(
            "oner",
            "ne var",
            "neler var",
            "hangi",
            "listele",
            "listesi",
            "hafif",
            "yanina",
            "acisiz",
            "tatli",
            "tavuk",
            "vegan",
            "kahvalti",
            "çorba",
            "içecek",
            "salata",
            "burger",
            "pizza",
            "kebap",
            "atıştırmalık",
            "makarna",
            "kategori");
    private static final List<String> SMALL_TALK_KEYWORDS = List.of("merhaba", "selam", "nasilsin", "orada misin", "konusalim");
    private static final List<String> THANKS_KEYWORDS = List.of("tesekkur", "sagol", "eyvallah");
    private static final List<String> MENU_LISTING_KEYWORDS = List.of("ne var", "neler var", "hangi", "listesi", "listele", "menu");
    private static final Set<String> CART_STOPWORDS = Set.of(
            "ekle", "olsun", "olsunmu", "isterim", "istiyorum", "alalim", "almak", "sepete", "at", "koy",
            "bir", "adet", "tane", "lutfen", "ama", "ve", "ile", "de", "da", "icin", "bana",
            "guzel", "sey", "birsey", "karisik", "yap", "olurmu", "olsunlar");
    private static final double HIGH_CONFIDENCE_SCORE = 1.05;
    private static final double MEDIUM_CONFIDENCE_SCORE = 0.62;
    private static final double CONFIDENCE_GAP_THRESHOLD = 0.22;

    private final ProductRepository productRepository;
    private final OllamaClient ollamaClient;
    private final ProductRagService productRagService;
    private final ObjectMapper objectMapper;

    @Value("${customer.ai.debug:false}")
    private boolean debugLogging;

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

        String normalizedMessage = normalize(message);
        debugLog("AI request normalizedMessage='{}'", normalizedMessage);

        DeterministicDecision deterministic = evaluateDeterministicDecision(message, normalizedMessage, products);
        if (deterministic.response() != null) {
            debugLog("Deterministic response selected reason='{}' intent='{}'",
                    deterministic.reason(),
                    deterministic.response().getIntent());
            return deterministic.response();
        }

        List<Product> ragProducts = productRagService.retrieveRelevantProducts(message, products, 12);
        if (ragProducts.isEmpty()) {
            ragProducts = products.stream().filter(this::isInStock).limit(12).toList();
        }

        String systemPrompt = buildSystemPrompt(ragProducts);
        String userPrompt = buildUserPrompt(request, message);
        debugLog("Ollama prompt summary retrievedCount={} userPrompt='{}'", ragProducts.size(), truncate(normalize(userPrompt), 180));

        Optional<OllamaCustomerAiDraft> llmDraft = ollamaClient.chatJsonOnly(systemPrompt, userPrompt)
                .flatMap(this::parseDraftSafely);

        if (llmDraft.isPresent()) {
            CustomerAiChatResponse sanitized = sanitizeDraft(llmDraft.get(), message, products);
            if (sanitized != null) {
                debugLog("LLM sanitized response intent='{}' items={} suggestions={}",
                        sanitized.getIntent(),
                        sanitized.getItems() == null ? 0 : sanitized.getItems().size(),
                        sanitized.getSuggestedProducts() == null ? 0 : sanitized.getSuggestedProducts().size());
                return sanitized;
            }
        }

        CustomerAiChatResponse fallback = fallbackResponse(message, normalizedMessage, products);
        debugLog("Fallback response intent='{}'", fallback.getIntent());
        return fallback;
    }

    private DeterministicDecision evaluateDeterministicDecision(String message, String normalizedMessage, List<Product> products) {
        CustomerAiChatResponse directMenuResponse = maybeBuildDirectMenuResponse(normalizedMessage, products);
        if (directMenuResponse != null) {
            return DeterministicDecision.resolved(directMenuResponse, "direct_menu_listing");
        }

        if (containsAny(normalizedMessage, THANKS_KEYWORDS)) {
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.clarification("Rica ederim. Isterseniz yeni bir urun onerisi yapabilirim."),
                    "thanks");
        }

        boolean cartIntentHint = hasCartKeywordOrModifier(normalizedMessage)
                || hasQuantityBackedByProduct(normalizedMessage, products);
        boolean menuIntentHint = hasMenuIntentHint(normalizedMessage);

        if (cartIntentHint) {
            DeterministicDecision cartDecision = evaluateDeterministicCartUpdate(normalizedMessage, products);
            if (cartDecision.response() != null || !cartDecision.shouldCallLlm()) {
                return cartDecision;
            }
        }

        if (menuIntentHint) {
            List<CustomerAiSuggestedProduct> suggestions = inferSuggestionsFromMessage(message, products);
            if (!suggestions.isEmpty()) {
                return DeterministicDecision.resolved(
                        new CustomerAiChatResponse(
                                CustomerAiIntent.MENU_ASSISTANT.value(),
                                buildMenuAssistantMessage(normalizedMessage, suggestions),
                                Collections.emptyList(),
                                suggestions),
                        "menu_keyword_suggestions");
            }
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.clarification("Bu kategori icin su an stokta urun bulamadim."),
                    "menu_no_suggestions");
        }

        if (looksAmbiguous(normalizedMessage)) {
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.clarification("Tam olarak hangi urunu istediginizi netlestirebilir misiniz?"),
                    "ambiguous_message");
        }

        return DeterministicDecision.needLlm("needs_llm");
    }

    private DeterministicDecision evaluateDeterministicCartUpdate(String normalizedMessage, List<Product> products) {
        List<CartCandidate> candidates = extractCartCandidates(normalizedMessage);
        if (candidates.isEmpty()) {
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.clarification("Tam olarak hangi urunu eklemek istediginizi yazar misiniz?"),
                    "empty_product_query");
        }

        debugLog("Deterministic cart candidate count={} queries='{}'",
                candidates.size(),
                candidates.stream().map(CartCandidate::productQuery).collect(Collectors.joining(" | ")));

        LinkedHashMap<String, CustomerAiItemDraft> resolvedItems = new LinkedHashMap<>();
        LinkedHashSet<String> clarificationOptions = new LinkedHashSet<>();
        List<String> unresolvedQueries = new ArrayList<>();

        for (CartCandidate candidate : candidates) {
            ProductMatchResult match = findBestProductMatch(candidate.productQuery(), products);
            if (match.confidence() == MatchConfidence.HIGH && match.product() != null) {
                String note = safeTrim(candidate.specialNote());
                String key = match.product().getId() + "|" + note;
                CustomerAiItemDraft existing = resolvedItems.get(key);
                if (existing == null) {
                    resolvedItems.put(
                            key,
                            new CustomerAiItemDraft(
                                    match.product().getId(),
                                    match.product().getName(),
                                    clampQuantity(candidate.quantity()),
                                    note));
                } else {
                    existing.setQuantity(clampQuantity(existing.getQuantity() + candidate.quantity()));
                }
                continue;
            }

            unresolvedQueries.add(candidate.productQuery());
            clarificationOptions.addAll(match.alternativeProductNames());
        }

        if (!unresolvedQueries.isEmpty()) {
            String unresolvedText = unresolvedQueries.stream()
                    .map(this::safeTrim)
                    .filter(query -> !query.isBlank())
                    .distinct()
                    .limit(3)
                    .collect(Collectors.joining(", "));
            String options = clarificationOptions.isEmpty()
                    ? ""
                    : " Ornek secenekler: " + clarificationOptions.stream().limit(4).collect(Collectors.joining(", ")) + ".";
            if (resolvedItems.isEmpty()) {
                return DeterministicDecision.resolved(
                        CustomerAiChatResponse.unsupported("Mesajinizdaki urun menude bulunamadi. Lutfen menudeki urun adini yazar misiniz." + options),
                        "deterministic_no_resolved_item");
            }

            String clarificationMessage = unresolvedText.isBlank()
                    ? "Mesajdaki tum urunleri netlestiremedim. Lutfen urun adlarini tekrar yazar misiniz?"
                    : "Mesajdaki tum urunleri netlestiremedim: " + unresolvedText + ". Lutfen urun adlarini tekrar yazar misiniz?";
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.clarification(clarificationMessage + options),
                    "deterministic_partial_or_low_confidence");
        }

        if (resolvedItems.isEmpty()) {
            String options = clarificationOptions.isEmpty()
                    ? ""
                    : " Ornek secenekler: " + clarificationOptions.stream().limit(4).collect(Collectors.joining(", ")) + ".";
            return DeterministicDecision.resolved(
                    CustomerAiChatResponse.unsupported("Mesajinizdaki urun menude bulunamadi. Lutfen menudeki urun adini yazar misiniz." + options),
                    "deterministic_no_resolved_item");
        }

        List<CustomerAiItemDraft> items = new ArrayList<>(resolvedItems.values());
        return DeterministicDecision.resolved(
                new CustomerAiChatResponse(
                        CustomerAiIntent.CART_UPDATE.value(),
                        buildCartMessage(items),
                        items,
                        Collections.emptyList()),
                "deterministic_multi_item_match");
    }

    private Optional<OllamaCustomerAiDraft> parseDraftSafely(String rawJson) {
        String cleaned = cleanupPotentialJson(rawJson);
        if (cleaned.isBlank()) {
            return Optional.empty();
        }

        debugLog("Ollama raw cleaned='{}'", truncate(cleaned, 600));
        try {
            return Optional.of(objectMapper.readValue(cleaned, OllamaCustomerAiDraft.class));
        } catch (JsonProcessingException ex) {
            log.warn("Could not parse Ollama JSON payload: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private CustomerAiChatResponse sanitizeDraft(OllamaCustomerAiDraft draft, String message, List<Product> products) {
        if (draft == null) {
            return null;
        }

        CustomerAiIntent intent = CustomerAiIntent.fromRaw(draft.getIntent());
        String normalizedMessage = normalize(message);

        if (intent == CustomerAiIntent.CART_UPDATE) {
            List<CustomerAiItemDraft> sanitizedItems = sanitizeItems(draft.getItems(), normalizedMessage, products);
            if (sanitizedItems.isEmpty()) {
                return CustomerAiChatResponse.clarification(
                        "Menude net eslesen bir urun bulamadim. Lutfen urun adini netlestirir misiniz?");
            }

            String assistantMessage = safeTrim(draft.getAssistantMessage());
            if (assistantMessage.isEmpty()) {
                assistantMessage = buildCartMessage(sanitizedItems);
            }

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

            String assistantMessage = safeTrim(draft.getAssistantMessage());
            if (assistantMessage.isEmpty() || isGenericMenuMessage(assistantMessage)) {
                assistantMessage = buildMenuAssistantMessage(normalizedMessage, suggestions);
            }

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

    private CustomerAiChatResponse fallbackResponse(String message, String normalizedMessage, List<Product> products) {
        DeterministicDecision decision = evaluateDeterministicDecision(message, normalizedMessage, products);
        if (decision.response() != null) {
            return decision.response();
        }

        if (containsAny(normalizedMessage, SMALL_TALK_KEYWORDS)) {
            List<CustomerAiSuggestedProduct> suggestions = inferSuggestionsFromMessage(message, products);
            return new CustomerAiChatResponse(
                    CustomerAiIntent.MENU_ASSISTANT.value(),
                    suggestions.isEmpty()
                            ? "Menuye gore uygun secenek bulamadim. Isterseniz kategori belirtebilirsiniz."
                            : buildMenuAssistantMessage(normalizedMessage, suggestions),
                    Collections.emptyList(),
                    suggestions);
        }

        return CustomerAiChatResponse.clarification(buildClarificationMessage(products));
    }

    private List<CustomerAiItemDraft> sanitizeItems(List<CustomerAiItemDraft> rawItems, String normalizedMessage, List<Product> products) {
        Map<String, CustomerAiItemDraft> merged = new LinkedHashMap<>();
        String inferredNote = extractSpecialNote(normalizedMessage);

        if (rawItems != null) {
            for (CustomerAiItemDraft rawItem : rawItems) {
                Product matched = resolveProductStrict(rawItem.getProductId(), rawItem.getProductName(), products);
                if (matched == null || !isInStock(matched)) {
                    continue;
                }

                int quantity = clampQuantity(rawItem.getQuantity());
                String specialNote = safeTrim(rawItem.getSpecialNote());
                if (specialNote.isEmpty()) {
                    specialNote = inferredNote;
                }

                String key = matched.getId() + "|" + specialNote;
                CustomerAiItemDraft existing = merged.get(key);
                if (existing == null) {
                    merged.put(key, new CustomerAiItemDraft(matched.getId(), matched.getName(), quantity, specialNote));
                } else {
                    existing.setQuantity(clampQuantity(existing.getQuantity() + quantity));
                }
            }
        }

        if (!merged.isEmpty()) {
            return new ArrayList<>(merged.values());
        }

        List<CustomerAiItemDraft> inferred = inferItemsFromMessage(normalizedMessage, products);
        for (CustomerAiItemDraft item : inferred) {
            merged.put(item.getProductId() + "|" + item.getSpecialNote(), item);
        }

        return new ArrayList<>(merged.values());
    }

    private List<CustomerAiItemDraft> inferItemsFromMessage(String normalizedMessage, List<Product> products) {
        List<CartCandidate> candidates = extractCartCandidates(normalizedMessage);
        if (candidates.isEmpty()) {
            return List.of();
        }

        LinkedHashMap<String, CustomerAiItemDraft> merged = new LinkedHashMap<>();
        for (CartCandidate candidate : candidates) {
            ProductMatchResult match = findBestProductMatch(candidate.productQuery(), products);
            if (match.confidence() != MatchConfidence.HIGH || match.product() == null) {
                return List.of();
            }

            String note = safeTrim(candidate.specialNote());
            String key = match.product().getId() + "|" + note;
            CustomerAiItemDraft existing = merged.get(key);
            if (existing == null) {
                merged.put(
                        key,
                        new CustomerAiItemDraft(
                                match.product().getId(),
                                match.product().getName(),
                                clampQuantity(candidate.quantity()),
                                note));
            } else {
                existing.setQuantity(clampQuantity(existing.getQuantity() + candidate.quantity()));
            }
        }

        return new ArrayList<>(merged.values());
    }

    private List<CustomerAiSuggestedProduct> sanitizeSuggestions(List<CustomerAiSuggestedProduct> raw, List<Product> products) {
        if (raw == null || raw.isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, Product> byId = products.stream().collect(Collectors.toMap(Product::getId, p -> p, (a, b) -> a));
        LinkedHashMap<Long, CustomerAiSuggestedProduct> out = new LinkedHashMap<>();

        for (CustomerAiSuggestedProduct item : raw) {
            Product resolved = null;
            if (item.getProductId() != null) {
                resolved = byId.get(item.getProductId());
            }
            if (resolved == null && !isBlank(item.getProductName())) {
                ProductMatchResult match = findBestProductMatch(normalize(item.getProductName()), products);
                if (match.confidence() == MatchConfidence.HIGH) {
                    resolved = match.product();
                }
            }
            if (resolved != null && isInStock(resolved)) {
                out.put(resolved.getId(), new CustomerAiSuggestedProduct(resolved.getId(), resolved.getName()));
            }
        }

        return new ArrayList<>(out.values()).stream().limit(4).toList();
    }

    private List<CustomerAiSuggestedProduct> inferSuggestionsFromMessage(String message, List<Product> products) {
        String normalized = normalize(message);
        List<Product> inStock = products.stream().filter(this::isInStock).toList();

        List<Product> selected;
        String categoryFilter = detectCategoryFromMessage(normalized);
        if (!isBlank(categoryFilter)) {
            selected = inStock.stream()
                    .filter(p -> categoryFilter.equalsIgnoreCase(safeTrim(p.getCategory())))
                    .sorted(Comparator.comparing(Product::getName))
                    .limit(10)
                    .toList();
        } else if (normalized.contains("sutlu") || normalized.contains("tatli")) {
            selected = inStock.stream()
                    .filter(p -> hasTag(p, "sutlu tatli") || "tatli".equalsIgnoreCase(safeTrim(p.getCategory())))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("hafif")) {
            selected = inStock.stream()
                    .filter(p -> List.of("salata", "icecek", "tatli", "corba").contains(safeTrim(p.getCategory()).toLowerCase(Locale.ROOT)))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("tavuk")) {
            selected = inStock.stream()
                    .filter(p -> normalize(p.getName()).contains("tavuk"))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("acisiz")) {
            selected = inStock.stream()
                    .filter(p -> hasTag(p, "acisiz"))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("vegan")) {
            selected = inStock.stream()
                    .filter(p -> hasTag(p, "vegan"))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("kahvalti")) {
            selected = inStock.stream()
                    .filter(p -> "kahvaltilik".equalsIgnoreCase(safeTrim(p.getCategory())))
                    .limit(6)
                    .toList();
        } else if (normalized.contains("corba")) {
            selected = inStock.stream()
                    .filter(p -> "corba".equalsIgnoreCase(safeTrim(p.getCategory())))
                    .limit(6)
                    .toList();
        } else {
            selected = productRagService.retrieveRelevantProducts(message, inStock, 6);
            if (selected.isEmpty()) {
                selected = inStock.stream()
                        .sorted(Comparator.comparing(Product::getName))
                        .limit(6)
                        .toList();
            }
        }

        return selected.stream()
                .map(p -> new CustomerAiSuggestedProduct(p.getId(), p.getName()))
                .toList();
    }

    private Product resolveProductStrict(Long productId, String productName, List<Product> products) {
        if (productId != null) {
            Product byId = products.stream()
                    .filter(p -> p.getId().equals(productId) && isInStock(p))
                    .findFirst()
                    .orElse(null);
            if (byId != null) {
                return byId;
            }
        }

        if (isBlank(productName)) {
            return null;
        }

        ProductMatchResult match = findBestProductMatch(normalize(productName), products);
        if (match.confidence() == MatchConfidence.HIGH) {
            return match.product();
        }
        return null;
    }

    private ProductMatchResult findBestProductMatch(String normalizedProductQuery, List<Product> products) {
        String query = normalize(normalizedProductQuery);
        if (query.isBlank()) {
            return ProductMatchResult.none();
        }

        List<Product> inStock = products.stream().filter(this::isInStock).toList();
        if (inStock.isEmpty()) {
            return ProductMatchResult.none();
        }

        Map<String, Long> tokenFrequency = buildTokenFrequency(inStock);
        Map<String, Long> categoryFrequency = buildCategoryFrequency(inStock);
        List<ProductScore> scored = new ArrayList<>();

        for (Product product : inStock) {
            double score = scoreProductMatch(query, product, tokenFrequency, categoryFrequency);
            if (score > 0.0) {
                scored.add(new ProductScore(product, score));
            }
        }

        if (scored.isEmpty()) {
            return ProductMatchResult.none();
        }

        scored.sort(Comparator.comparingDouble(ProductScore::score).reversed()
                .thenComparing(ps -> ps.product().getName(), String.CASE_INSENSITIVE_ORDER));

        ProductScore top = scored.get(0);
        double secondScore = scored.size() > 1 ? scored.get(1).score() : 0.0;
        double gap = top.score() - secondScore;

        MatchConfidence confidence;
        if (top.score() >= HIGH_CONFIDENCE_SCORE && gap >= CONFIDENCE_GAP_THRESHOLD) {
            confidence = MatchConfidence.HIGH;
        } else if (top.score() >= MEDIUM_CONFIDENCE_SCORE) {
            confidence = MatchConfidence.MEDIUM;
        } else {
            confidence = MatchConfidence.LOW;
        }

        List<String> alternatives = scored.stream()
                .limit(3)
                .map(ps -> ps.product().getName())
                .toList();

        return new ProductMatchResult(top.product(), confidence, top.score(), secondScore, alternatives);
    }

    private Map<String, Long> buildTokenFrequency(List<Product> products) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (Product product : products) {
            Set<String> tokens = new LinkedHashSet<>(aliasesForProduct(product.getName()));
            for (String token : tokens) {
                out.put(token, out.getOrDefault(token, 0L) + 1L);
            }
        }
        return out;
    }

    private Map<String, Long> buildCategoryFrequency(List<Product> products) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (Product product : products) {
            String category = normalize(safeTrim(product.getCategory()));
            if (category.isBlank()) {
                continue;
            }
            out.put(category, out.getOrDefault(category, 0L) + 1L);
        }
        return out;
    }

    private double scoreProductMatch(
            String normalizedQuery,
            Product product,
            Map<String, Long> tokenFrequency,
            Map<String, Long> categoryFrequency) {
        String normalizedName = normalize(product.getName());
        List<String> aliases = aliasesForProduct(product.getName());
        Set<String> queryTokens = significantTokens(normalizedQuery);

        double score = 0.0;
        if (containsAlias(normalizedQuery, normalizedName)) {
            score += 1.1;
        }

        int aliasHits = 0;
        for (String alias : aliases) {
            if (!containsAlias(normalizedQuery, alias)) {
                continue;
            }
            aliasHits++;
            long frequency = tokenFrequency.getOrDefault(alias, 1L);
            score += frequency == 1L ? 0.42 : 0.18;
        }

        if (aliasHits == 0 && normalizedName.contains(normalizedQuery) && normalizedQuery.length() >= 4) {
            score += 0.48;
        }

        Set<String> nameTokens = significantTokens(normalizedName);
        int exactHits = 0;
        int prefixHits = 0;
        for (String q : queryTokens) {
            if (nameTokens.contains(q)) {
                exactHits++;
                continue;
            }
            boolean hasStemHit = nameTokens.stream()
                    .anyMatch(nameToken -> nameToken.startsWith(q) || q.startsWith(nameToken) || nameToken.contains(q));
            if (hasStemHit && q.length() >= 4) {
                prefixHits++;
            }
        }

        if (!queryTokens.isEmpty()) {
            score += ((double) exactHits / (double) queryTokens.size()) * 0.70;
            score += ((double) prefixHits / (double) queryTokens.size()) * 0.25;
        }

        String category = normalize(safeTrim(product.getCategory()));
        if (!category.isBlank() && containsAlias(normalizedQuery, category)) {
            long frequency = categoryFrequency.getOrDefault(category, 1L);
            score += frequency == 1L ? 0.38 : 0.12;
        }

        return score;
    }

    private String buildSystemPrompt(List<Product> retrievedProducts) {
        String productsJson = productRagService.toPromptContextJson(retrievedProducts);

        return "You are a strict restaurant customer assistant.\n"
                + "You MUST return only valid JSON and no markdown.\n"
                + "Use only products from RETRIEVED_MENU_CONTEXT.\n"
                + "Never invent stock or prices.\n"
                + "Never finalize an order.\n"
                + "If not sure, return intent=clarification.\n"
                + "specialNote MUST be separate from productName.\n"
                + "assistantMessage MUST be short and controlled.\n\n"
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
                + "RETRIEVED_MENU_CONTEXT:\n"
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

    private CartPreprocess preprocessCartMessage(String normalizedMessage) {
        int quantity = inferQuantity(normalizedMessage);
        String specialNote = extractSpecialNote(normalizedMessage);
        String withoutNotes = removeNoteTokens(normalizedMessage);
        String productQuery = stripControlTokens(withoutNotes);

        return new CartPreprocess(productQuery, quantity, specialNote);
    }

    private int inferQuantity(String normalizedMessage) {
        Matcher matcher = QUANTITY_TOKEN_PATTERN.matcher(" " + normalizedMessage + " ");
        if (!matcher.find()) {
            return 1;
        }

        String token = matcher.group(2);
        if (token == null || token.isBlank()) {
            return 1;
        }

        if (token.matches("\\d+")) {
            try {
                return clampQuantity(Integer.parseInt(token));
            } catch (NumberFormatException ex) {
                return 1;
            }
        }

        return clampQuantity(NUMBER_WORDS.getOrDefault(token, 1));
    }

    private int parseQuantity(String quantityToken) {
        if (quantityToken == null || quantityToken.isBlank()) {
            return 1;
        }

        String normalizedToken = normalize(quantityToken);
        if (normalizedToken.matches("\\d+")) {
            try {
                return clampQuantity(Integer.parseInt(normalizedToken));
            } catch (NumberFormatException ex) {
                return 1;
            }
        }

        return clampQuantity(NUMBER_WORDS.getOrDefault(normalizedToken, 1));
    }

    private String extractSpecialNote(String normalizedMessage) {
        List<String> notes = NOTE_RULES.stream()
                .filter(rule -> containsAlias(normalizedMessage, rule.key()))
                .map(NoteRule::value)
                .distinct()
                .toList();

        Matcher butMatcher = Pattern.compile("\\bama\\s+(.+)$").matcher(normalizedMessage);
        if (butMatcher.find()) {
            String tail = safeTrim(butMatcher.group(1));
            if (!tail.isEmpty() && tail.length() <= 45) {
                notes = new ArrayList<>(notes);
                notes.add(toSentenceCase(tail));
            }
        }

        return String.join(", ", notes);
    }

    private String removeNoteTokens(String normalizedMessage) {
        String cleaned = " " + normalizedMessage + " ";
        for (NoteRule rule : NOTE_RULES) {
            cleaned = cleaned.replace(" " + rule.key() + " ", " ");
        }
        return cleaned.replaceAll("\\s+", " ").trim();
    }

    private String stripControlTokens(String normalizedText) {
        String cleaned = " " + normalizedText + " ";
        List<String> phraseRemovals = List.of("sepete at", "ekler misin", "ne onerirsin", "ne var", "neler var");
        for (String phrase : phraseRemovals) {
            cleaned = cleaned.replace(" " + phrase + " ", " ");
        }

        List<String> tokens = Arrays.stream(cleaned.trim().split(" "))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .filter(token -> !CART_STOPWORDS.contains(token))
                .filter(token -> !NUMBER_WORDS.containsKey(token))
                .filter(token -> !token.matches("\\d+"))
                .toList();

        return String.join(" ", tokens).trim();
    }

    private List<String> splitClauses(String normalizedMessage) {
        return Arrays.stream(normalizedMessage.split("\\s+ve\\s+|,|\\s+ile\\s+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private List<CartCandidate> extractCartCandidates(String normalizedMessage) {
        if (normalizedMessage == null || normalizedMessage.isBlank()) {
            return List.of();
        }

        String globalNote = extractSpecialNote(normalizedMessage);
        String withoutNotes = removeNoteTokens(normalizedMessage);
        List<CartCandidate> candidates = new ArrayList<>();

        Matcher quantityChunkMatcher = QUANTITY_CHUNK_PATTERN.matcher(withoutNotes);
        while (quantityChunkMatcher.find()) {
            String quantityToken = safeTrim(quantityChunkMatcher.group(1));
            String rawChunk = safeTrim(quantityChunkMatcher.group(2));
            String productQuery = stripControlTokens(rawChunk);
            if (productQuery.isBlank()) {
                continue;
            }

            int quantity = parseQuantity(quantityToken);
            String clauseNote = extractSpecialNote(rawChunk);
            String effectiveNote = clauseNote.isBlank() ? globalNote : clauseNote;
            candidates.add(new CartCandidate(productQuery, quantity, effectiveNote));
        }

        if (!candidates.isEmpty()) {
            return mergeCartCandidates(candidates);
        }

        List<String> clauses = splitClauses(withoutNotes);
        for (String clause : clauses) {
            int quantity = inferQuantity(clause);
            String productQuery = stripControlTokens(clause);
            if (productQuery.isBlank()) {
                continue;
            }
            String clauseNote = extractSpecialNote(clause);
            String effectiveNote = clauseNote.isBlank() ? globalNote : clauseNote;
            candidates.add(new CartCandidate(productQuery, quantity, effectiveNote));
        }

        if (!candidates.isEmpty()) {
            return mergeCartCandidates(candidates);
        }

        CartPreprocess fallback = preprocessCartMessage(normalizedMessage);
        if (fallback.productQuery().isBlank()) {
            return List.of();
        }
        return List.of(new CartCandidate(fallback.productQuery(), fallback.quantity(), fallback.specialNote()));
    }

    private List<CartCandidate> mergeCartCandidates(List<CartCandidate> rawCandidates) {
        LinkedHashMap<String, CartCandidate> merged = new LinkedHashMap<>();
        for (CartCandidate candidate : rawCandidates) {
            String note = safeTrim(candidate.specialNote());
            String key = candidate.productQuery() + "|" + note;
            CartCandidate existing = merged.get(key);
            if (existing == null) {
                merged.put(key, new CartCandidate(candidate.productQuery(), clampQuantity(candidate.quantity()), note));
            } else {
                merged.put(
                        key,
                        new CartCandidate(
                                existing.productQuery(),
                                clampQuantity(existing.quantity() + candidate.quantity()),
                                note));
            }
        }
        return new ArrayList<>(merged.values());
    }

    private List<String> aliasesForProduct(String productName) {
        String normalizedName = normalize(productName);
        Set<String> aliases = new LinkedHashSet<>();
        if (!normalizedName.isBlank()) {
            aliases.add(normalizedName);
        }

        for (String token : normalizedName.split(" ")) {
            if (token.length() >= 3 || "su".equals(token)) {
                aliases.add(token);
            }
        }

        if (normalizedName.contains("hamburger") || normalizedName.contains("burger")) {
            aliases.add("burger");
        }
        if (normalizedName.contains("patates")) {
            aliases.add("patates");
            aliases.add("fries");
        }
        if (normalizedName.contains("kahve")) {
            aliases.add("coffee");
        }

        return new ArrayList<>(aliases);
    }

    private boolean containsAlias(String normalizedText, String alias) {
        if (isBlank(normalizedText) || isBlank(alias)) {
            return false;
        }
        Pattern pattern = Pattern.compile("(^|\\s)" + Pattern.quote(alias) + "(\\s|$)");
        return pattern.matcher(normalizedText).find();
    }

    private boolean containsAny(String normalizedMessage, List<String> keys) {
        return keys.stream().anyMatch(key -> normalizedMessage.contains(normalize(key)));
    }

    private Set<String> significantTokens(String normalizedText) {
        if (normalizedText == null || normalizedText.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(normalizedText.split(" "))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .filter(token -> token.length() >= 3 || "su".equals(token))
                .filter(token -> !CART_STOPWORDS.contains(token))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean hasCartKeywordOrModifier(String normalizedMessage) {
        if (containsAny(normalizedMessage, CART_KEYWORDS)) {
            return true;
        }
        return NOTE_RULES.stream().anyMatch(rule -> containsAlias(normalizedMessage, rule.key()));
    }

    private boolean hasQuantityBackedByProduct(String normalizedMessage, List<Product> products) {
        if (!QUANTITY_TOKEN_PATTERN.matcher(" " + normalizedMessage + " ").find()) {
            return false;
        }
        List<CartCandidate> candidates = extractCartCandidates(normalizedMessage);
        if (candidates.isEmpty()) {
            return false;
        }
        return candidates.stream()
                .map(candidate -> findBestProductMatch(candidate.productQuery(), products))
                .anyMatch(match -> match.confidence() != MatchConfidence.LOW);
    }

    private boolean hasMenuIntentHint(String normalizedMessage) {
        return containsAny(normalizedMessage, MENU_KEYWORDS)
                || containsAny(normalizedMessage, MENU_LISTING_KEYWORDS)
                || containsAny(normalizedMessage, SMALL_TALK_KEYWORDS);
    }

    private boolean looksAmbiguous(String normalizedMessage) {
        return containsAlias(normalizedMessage, "karisik")
                || containsAlias(normalizedMessage, "guzel")
                || containsAlias(normalizedMessage, "bir sey")
                || normalizedMessage.length() < 3;
    }

    private CustomerAiChatResponse maybeBuildDirectMenuResponse(String normalizedMessage, List<Product> products) {
        boolean quantityLooksLikeOrder = hasQuantityBackedByProduct(normalizedMessage, products);
        if (containsAny(normalizedMessage, CART_KEYWORDS) || quantityLooksLikeOrder) {
            return null;
        }

        String categoryFilter = detectCategoryFromMessage(normalizedMessage);
        boolean listingIntent = containsAny(normalizedMessage, MENU_LISTING_KEYWORDS);

        if (isBlank(categoryFilter) && !listingIntent) {
            return null;
        }

        List<CustomerAiSuggestedProduct> suggestions = inferSuggestionsFromMessage(normalizedMessage, products);
        if (suggestions.isEmpty()) {
            return CustomerAiChatResponse.clarification("Bu kategori icin su an stokta urun bulamadim.");
        }

        return new CustomerAiChatResponse(
                CustomerAiIntent.MENU_ASSISTANT.value(),
                buildMenuAssistantMessage(normalizedMessage, suggestions),
                Collections.emptyList(),
                suggestions);
    }

    private String detectCategoryFromMessage(String normalizedMessage) {
        if (containsAny(normalizedMessage, List.of("icecek", "kola", "ayran", "kahve", "cay", "limonata"))) {
            return "Icecek";
        }
        if (containsAny(normalizedMessage, List.of("tatli", "sutlu", "dessert", "cheesecake", "brownie"))) {
            return "Tatli";
        }
        if (containsAny(normalizedMessage, List.of("salata", "vegan"))) {
            return "Salata";
        }
        if (containsAny(normalizedMessage, List.of("corba", "mercimek", "ezogelin"))) {
            return "Corba";
        }
        if (containsAny(normalizedMessage, List.of("kahvalti", "menemen", "tost", "simit"))) {
            return "Kahvaltilik";
        }
        if (containsAny(normalizedMessage, List.of("atistirmalik", "patates", "halkasi", "nugget"))) {
            return "Atistirmalik";
        }
        if (containsAny(normalizedMessage, List.of("burger", "hamburger"))) {
            return "Burger";
        }
        if (containsAny(normalizedMessage, List.of("pizza"))) {
            return "Pizza";
        }
        if (containsAny(normalizedMessage, List.of("kebap", "lahmacun", "doner", "kofte", "sis"))) {
            return "Kebap";
        }
        if (containsAny(normalizedMessage, List.of("makarna", "penne", "fettuccine", "alfredo", "arabiata", "napoliten"))) {
            return "Makarna";
        }
        return "";
    }

    private String buildMenuAssistantMessage(String normalizedMessage, List<CustomerAiSuggestedProduct> suggestions) {
        String itemText = suggestions.stream()
                .map(CustomerAiSuggestedProduct::getProductName)
                .collect(Collectors.joining(", "));

        String categoryFilter = detectCategoryFromMessage(normalizedMessage);
        if (!isBlank(categoryFilter)) {
            return categoryFilter + " kategorisinde su urunler var: " + itemText + ". Isterseniz istediginizi sepete ekleyebilirim.";
        }

        if (containsAny(normalizedMessage, SMALL_TALK_KEYWORDS)) {
            return "Buradayim. Su urunlerle baslayabiliriz: " + itemText + ".";
        }

        return "Su an menude onerebilecegim secenekler: " + itemText + ".";
    }

    private boolean isGenericMenuMessage(String text) {
        String normalizedText = normalize(text);
        return normalizedText.contains("menuye gore uygun secenekleri paylastim")
                || normalizedText.contains("menuye gore uygun secenek bulamadim")
                || normalizedText.contains("menuye gore su secenekleri oneririm");
    }

    private String buildClarificationMessage(List<Product> products) {
        String exampleNames = products.stream()
                .filter(this::isInStock)
                .map(Product::getName)
                .limit(2)
                .collect(Collectors.joining(", "));

        if (exampleNames.isBlank()) {
            return "Mesajinizi tam anlayamadim. Urun adi veya kategori belirtebilir misiniz?";
        }

        return "Mesajinizi tam anlayamadim. Ornek: \"2 kola ekle\", \"hafif bir sey oner\" veya \""
                + exampleNames
                + " var mi?\"";
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

    private String toSentenceCase(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1);
    }

    private void debugLog(String template, Object... args) {
        if (!debugLogging) {
            return;
        }
        log.info("[customer-ai-debug] " + template, args);
    }

    private String truncate(String text, int limit) {
        if (text == null || text.length() <= limit) {
            return text;
        }
        return text.substring(0, limit) + "...";
    }

    private static final class ProductScore {
        private final Product product;
        private final double score;

        private ProductScore(Product product, double score) {
            this.product = product;
            this.score = score;
        }

        private Product product() {
            return product;
        }

        private double score() {
            return score;
        }
    }

    private enum MatchConfidence {
        HIGH, MEDIUM, LOW
    }

    private static final class ProductMatchResult {
        private final Product product;
        private final MatchConfidence confidence;
        private final double topScore;
        private final double secondScore;
        private final List<String> alternativeProductNames;

        private ProductMatchResult(
                Product product,
                MatchConfidence confidence,
                double topScore,
                double secondScore,
                List<String> alternativeProductNames) {
            this.product = product;
            this.confidence = confidence;
            this.topScore = topScore;
            this.secondScore = secondScore;
            this.alternativeProductNames = alternativeProductNames == null ? List.of() : alternativeProductNames;
        }

        private static ProductMatchResult none() {
            return new ProductMatchResult(null, MatchConfidence.LOW, 0.0, 0.0, List.of());
        }

        private Product product() {
            return product;
        }

        private MatchConfidence confidence() {
            return confidence;
        }

        private List<String> alternativeProductNames() {
            return alternativeProductNames;
        }

        @SuppressWarnings("unused")
        private double topScore() {
            return topScore;
        }

        @SuppressWarnings("unused")
        private double secondScore() {
            return secondScore;
        }
    }

    private static final class CartPreprocess {
        private final String productQuery;
        private final int quantity;
        private final String specialNote;

        private CartPreprocess(String productQuery, int quantity, String specialNote) {
            this.productQuery = productQuery == null ? "" : productQuery;
            this.quantity = quantity;
            this.specialNote = specialNote == null ? "" : specialNote;
        }

        private String productQuery() {
            return productQuery;
        }

        private int quantity() {
            return quantity;
        }

        private String specialNote() {
            return specialNote;
        }
    }

    private static final class CartCandidate {
        private final String productQuery;
        private final int quantity;
        private final String specialNote;

        private CartCandidate(String productQuery, int quantity, String specialNote) {
            this.productQuery = productQuery == null ? "" : productQuery;
            this.quantity = quantity;
            this.specialNote = specialNote == null ? "" : specialNote;
        }

        private String productQuery() {
            return productQuery;
        }

        private int quantity() {
            return quantity;
        }

        private String specialNote() {
            return specialNote;
        }
    }

    private static final class DeterministicDecision {
        private final CustomerAiChatResponse response;
        private final boolean shouldCallLlm;
        private final String reason;

        private DeterministicDecision(CustomerAiChatResponse response, boolean shouldCallLlm, String reason) {
            this.response = response;
            this.shouldCallLlm = shouldCallLlm;
            this.reason = reason == null ? "" : reason;
        }

        private static DeterministicDecision resolved(CustomerAiChatResponse response, String reason) {
            return new DeterministicDecision(response, false, reason);
        }

        private static DeterministicDecision needLlm(String reason) {
            return new DeterministicDecision(null, true, reason);
        }

        private CustomerAiChatResponse response() {
            return response;
        }

        private boolean shouldCallLlm() {
            return shouldCallLlm;
        }

        private String reason() {
            return reason;
        }
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
