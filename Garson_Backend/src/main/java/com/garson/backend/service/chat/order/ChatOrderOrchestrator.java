package com.garson.backend.service.chat.order;

import com.garson.backend.dto.chat.ChatMessageRequest;
import com.garson.backend.dto.chat.ChatMessageResponse;
import com.garson.backend.model.Order;
import com.garson.backend.model.OrderItem;
import com.garson.backend.model.OrderStatus;
import com.garson.backend.model.Product;
import com.garson.backend.model.TableStatus;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.repository.RestaurantTableRepository;
import com.garson.backend.service.N8nWebhookService;
import com.garson.backend.service.chat.ChatTextNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatOrderOrchestrator {

    private static final Pattern QUANTITY_CHUNK_PATTERN = Pattern.compile(
            "(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\\s+([a-z0-9\\s]+?)(?=\\s+(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\\s+|$)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(^|\\s)(\\d+|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)(\\s|$)");

    private static final Map<String, Integer> NUMBER_WORDS = Map.of(
            "bir", 1, "iki", 2, "uc", 3, "dort", 4, "bes", 5,
            "alti", 6, "yedi", 7, "sekiz", 8, "dokuz", 9, "on", 10);

    private static final List<String> ORDER_CONTROL_WORDS = List.of(
            "ekle", "ekler misin", "getir", "gonder", "ver", "lutfen", "sepete", "at", "olsun", "isterim", "istiyorum");

    private static final List<NoteRule> NOTE_RULES = List.of(
            new NoteRule("acili", "Acili olsun"),
            new NoteRule("acisiz", "Acisiz"),
            new NoteRule("sogansiz", "Sogansiz"),
            new NoteRule("sekersiz", "Sekersiz"),
            new NoteRule("az tuzlu", "Az tuzlu"),
            new NoteRule("tuzsuz", "Tuzsuz"));

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final RestaurantTableRepository tableRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final N8nWebhookService n8nWebhookService;

    @Transactional
    public ChatMessageResponse handleOrderCreate(ChatMessageRequest request) {
        if (request == null) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Siparis olusturmam icin masa numarasina ihtiyacim var.")
                    .clarificationNeeded(true)
                    .build();
        }

        Integer tableNumber = request.getTableNumber();
        if (tableNumber == null) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Siparis olusturmam icin masa numarasina ihtiyacim var.")
                    .clarificationNeeded(true)
                    .build();
        }

        String normalizedMessage = ChatTextNormalizer.normalize(request.getCustomerMessage());
        List<Product> products = productRepository.findAll();
        if (products.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Menu su an bos oldugu icin siparis olusturamiyorum.")
                    .build();
        }

        List<OrderCandidate> candidates = extractOrderCandidates(normalizedMessage);
        if (candidates.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Hangi urunleri istediginizi daha net yazar misiniz? Ornek: 1 ayran 2 lahmacun")
                    .clarificationNeeded(true)
                    .build();
        }

        LinkedHashMap<Long, FinalOrderItem> finalItems = new LinkedHashMap<>();
        List<String> unknownRequests = new ArrayList<>();
        List<String> outOfStockItems = new ArrayList<>();
        LinkedHashSet<String> clarificationOptions = new LinkedHashSet<>();

        for (OrderCandidate candidate : candidates) {
            ProductMatch match = findBestMatch(candidate.productQuery(), products);
            if (match.type() == MatchType.AMBIGUOUS) {
                clarificationOptions.addAll(match.options());
                continue;
            }
            if (match.type() == MatchType.NOT_FOUND || match.product() == null) {
                unknownRequests.add(candidate.productQuery());
                continue;
            }

            Product product = match.product();
            if (!isInStock(product)) {
                outOfStockItems.add(product.getName());
                continue;
            }

            FinalOrderItem existing = finalItems.get(product.getId());
            if (existing == null) {
                finalItems.put(product.getId(), new FinalOrderItem(product, candidate.quantity(), candidate.specialNote()));
            } else {
                existing.quantity = clampQuantity(existing.quantity + candidate.quantity());
                if (existing.specialNote.isBlank() && !candidate.specialNote().isBlank()) {
                    existing.specialNote = candidate.specialNote();
                }
            }
        }

        if (!unknownRequests.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Menude bulunamayan urun var: " + String.join(", ", unknownRequests) + ". Lutfen menudeki urun adini yazin.")
                    .clarificationNeeded(true)
                    .options(suggestClosestProducts(unknownRequests.get(0), products))
                    .build();
        }

        if (!outOfStockItems.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Su urunler su an stokta yok: " + String.join(", ", outOfStockItems) + ". Baska urun secmek ister misiniz?")
                    .clarificationNeeded(true)
                    .options(topInStockProducts(products, 4))
                    .build();
        }

        if (!clarificationOptions.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Hangi urunu istediginizi netlestirebilir misiniz?")
                    .clarificationNeeded(true)
                    .options(clarificationOptions.stream().limit(5).toList())
                    .build();
        }

        if (finalItems.isEmpty()) {
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Siparis olusturmak icin net bir urun bulamadim.")
                    .clarificationNeeded(true)
                    .options(topInStockProducts(products, 4))
                    .build();
        }

        try {
            Order savedOrder = persistOrder(String.valueOf(tableNumber), finalItems.values().stream().toList());
            String summary = finalItems.values().stream()
                    .map(item -> item.quantity + " x " + item.product.getName())
                    .collect(Collectors.joining(", "));
            log.info("Chat order created table={} orderId={} itemCount={}", tableNumber, savedOrder.getId(), finalItems.size());
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Siparisiniz olusturuldu: " + summary + ".")
                    .action("ORDER_CREATED")
                    .orderId(savedOrder.getId())
                    .suggestions(topInStockProducts(products, 3))
                    .build();
        } catch (Exception ex) {
            n8nWebhookService.notifyCriticalError("Chat order create failed", ex.getMessage());
            log.warn("Chat order create failed: {}", ex.getMessage());
            return ChatMessageResponse.builder()
                    .intent("ORDER_CREATE")
                    .reply("Siparis olusturulurken bir hata oldu. Lutfen tekrar deneyin.")
                    .build();
        }
    }

    private Order persistOrder(String tableNo, List<FinalOrderItem> items) {
        Order order = new Order();
        order.setTableNo(tableNo);
        order.setStatus(OrderStatus.NEW.name());
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());

        for (FinalOrderItem item : items) {
            OrderItem orderItem = new OrderItem();
            orderItem.setProductName(item.product.getName());
            orderItem.setQuantity(item.quantity);
            orderItem.setPrice(item.product.getPrice() == null ? 0.0 : item.product.getPrice());
            orderItem.setSpecialNote(item.specialNote);
            order.addItem(orderItem);
        }

        Order saved = orderRepository.saveAndFlush(order);
        updateTableStatusIfPresent(tableNo);
        messagingTemplate.convertAndSend("/topic/orders", saved);
        return saved;
    }

    private void updateTableStatusIfPresent(String tableNo) {
        try {
            Long tableId = Long.parseLong(tableNo);
            tableRepository.findById(tableId).ifPresent(table -> {
                if (table.getStatus() == TableStatus.EMPTY || table.getStatus() == TableStatus.CALLING_ROBOT) {
                    table.setStatus(TableStatus.OCCUPIED);
                    tableRepository.save(table);
                    messagingTemplate.convertAndSend("/topic/tables", tableRepository.findAll());
                }
            });
        } catch (NumberFormatException ignore) {
            // Non numeric table numbers are supported by order model, but table state update is skipped.
        }
    }

    private List<OrderCandidate> extractOrderCandidates(String normalizedMessage) {
        if (normalizedMessage == null || normalizedMessage.isBlank()) {
            return List.of();
        }

        String globalNote = extractSpecialNote(normalizedMessage);
        String sanitized = stripControlWords(normalizedMessage);

        List<OrderCandidate> candidates = new ArrayList<>();
        Matcher matcher = QUANTITY_CHUNK_PATTERN.matcher(sanitized);
        while (matcher.find()) {
            String quantityToken = safeTrim(matcher.group(1));
            String rawChunk = safeTrim(matcher.group(2));
            int quantity = parseQuantity(quantityToken);
            String productQuery = removeNumberTokens(rawChunk);
            if (!productQuery.isBlank()) {
                String note = extractSpecialNote(rawChunk);
                candidates.add(new OrderCandidate(productQuery, quantity, note.isBlank() ? globalNote : note));
            }
        }

        if (!candidates.isEmpty()) {
            return candidates;
        }

        List<String> clauses = Arrays.stream(sanitized.split("\\s+ve\\s+|,|\\s+ile\\s+"))
                .map(this::safeTrim)
                .filter(part -> !part.isBlank())
                .toList();

        for (String clause : clauses) {
            int quantity = inferQuantity(clause);
            String withoutNumbers = removeNumberTokens(clause);
            if (withoutNumbers.isBlank()) {
                continue;
            }
            String note = extractSpecialNote(clause);
            candidates.add(new OrderCandidate(withoutNumbers, quantity, note.isBlank() ? globalNote : note));
        }

        return candidates;
    }

    private ProductMatch findBestMatch(String productQuery, List<Product> products) {
        String normalizedQuery = ChatTextNormalizer.normalize(productQuery);
        if (normalizedQuery.isBlank()) {
            return ProductMatch.notFound();
        }

        Set<String> queryTokens = ChatTextNormalizer.tokens(normalizedQuery).stream()
                .filter(token -> token.length() >= 2)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (queryTokens.isEmpty()) {
            return ProductMatch.notFound();
        }

        List<ScoredProduct> scored = new ArrayList<>();
        for (Product product : products) {
            String normalizedName = ChatTextNormalizer.normalize(product.getName());
            Set<String> nameTokens = ChatTextNormalizer.tokens(normalizedName);

            double score = 0.0;
            if (normalizedName.equals(normalizedQuery)) {
                score += 1.15;
            }
            if (normalizedName.contains(normalizedQuery) || normalizedQuery.contains(normalizedName)) {
                score += 0.70;
            }
            score += overlapRatio(queryTokens, nameTokens) * 0.46;
            score += typoBonus(queryTokens, nameTokens);

            String category = ChatTextNormalizer.normalize(product.getCategory());
            if (!category.isBlank() && normalizedQuery.contains(category)) {
                score += 0.14;
            }
            scored.add(new ScoredProduct(product, Math.min(1.3, score)));
        }

        scored.sort(Comparator.comparingDouble(ScoredProduct::score).reversed());
        if (scored.isEmpty() || scored.get(0).score() < 0.28) {
            return ProductMatch.notFound();
        }

        ScoredProduct top = scored.get(0);
        ScoredProduct second = scored.size() > 1 ? scored.get(1) : null;
        if (second != null && top.score() - second.score() < 0.16 && second.score() > 0.24) {
            List<String> options = scored.stream()
                    .limit(4)
                    .map(item -> item.product().getName())
                    .toList();
            return ProductMatch.ambiguous(options);
        }

        return ProductMatch.matched(top.product());
    }

    private double overlapRatio(Set<String> queryTokens, Set<String> nameTokens) {
        if (queryTokens.isEmpty() || nameTokens.isEmpty()) {
            return 0.0;
        }
        long overlap = queryTokens.stream().filter(nameTokens::contains).count();
        return (double) overlap / (double) queryTokens.size();
    }

    private double typoBonus(Set<String> queryTokens, Set<String> nameTokens) {
        double bonus = 0.0;
        for (String queryToken : queryTokens) {
            if (queryToken.length() < 4 || nameTokens.contains(queryToken)) {
                continue;
            }
            int minDistance = nameTokens.stream()
                    .mapToInt(nameToken -> ChatTextNormalizer.levenshtein(queryToken, nameToken))
                    .min()
                    .orElse(10);
            if (minDistance <= 1) {
                bonus += 0.08;
            }
        }
        return bonus;
    }

    private List<String> suggestClosestProducts(String unknownQuery, List<Product> products) {
        String normalizedUnknown = ChatTextNormalizer.normalize(unknownQuery);
        return products.stream()
                .sorted(Comparator.comparingInt(p ->
                        ChatTextNormalizer.levenshtein(normalizedUnknown, ChatTextNormalizer.normalize(p.getName()))))
                .map(Product::getName)
                .distinct()
                .limit(4)
                .toList();
    }

    private List<String> topInStockProducts(List<Product> products, int limit) {
        return products.stream()
                .filter(this::isInStock)
                .map(Product::getName)
                .distinct()
                .limit(Math.max(1, limit))
                .toList();
    }

    private boolean isInStock(Product product) {
        return product != null && (product.getStock() == null || product.getStock() > 0);
    }

    private int inferQuantity(String text) {
        Matcher matcher = NUMBER_PATTERN.matcher(" " + text + " ");
        if (!matcher.find()) {
            return 1;
        }
        return parseQuantity(safeTrim(matcher.group(2)));
    }

    private int parseQuantity(String token) {
        if (token == null || token.isBlank()) {
            return 1;
        }
        String normalized = ChatTextNormalizer.normalize(token);
        if (normalized.matches("\\d+")) {
            try {
                return clampQuantity(Integer.parseInt(normalized));
            } catch (NumberFormatException ex) {
                return 1;
            }
        }
        return clampQuantity(NUMBER_WORDS.getOrDefault(normalized, 1));
    }

    private int clampQuantity(int value) {
        if (value < 1) {
            return 1;
        }
        return Math.min(value, 99);
    }

    private String stripControlWords(String normalizedMessage) {
        String cleaned = " " + normalizedMessage + " ";
        for (String word : ORDER_CONTROL_WORDS) {
            cleaned = cleaned.replace(" " + ChatTextNormalizer.normalize(word) + " ", " ");
        }
        return cleaned.replaceAll("\\s+", " ").trim();
    }

    private String removeNumberTokens(String rawChunk) {
        List<String> tokens = ChatTextNormalizer.tokens(ChatTextNormalizer.normalize(rawChunk)).stream()
                .filter(token -> !NUMBER_WORDS.containsKey(token))
                .filter(token -> !token.matches("\\d+"))
                .toList();
        return String.join(" ", tokens).trim();
    }

    private String extractSpecialNote(String text) {
        String normalized = ChatTextNormalizer.normalize(text);
        List<String> notes = NOTE_RULES.stream()
                .filter(rule -> normalized.contains(rule.key()))
                .map(NoteRule::value)
                .distinct()
                .toList();
        return String.join(", ", notes);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class OrderCandidate {
        private final String productQuery;
        private final int quantity;
        private final String specialNote;

        private OrderCandidate(String productQuery, int quantity, String specialNote) {
            this.productQuery = productQuery;
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

    private static final class ScoredProduct {
        private final Product product;
        private final double score;

        private ScoredProduct(Product product, double score) {
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

    private static final class ProductMatch {
        private final MatchType type;
        private final Product product;
        private final List<String> options;

        private ProductMatch(MatchType type, Product product, List<String> options) {
            this.type = type;
            this.product = product;
            this.options = options == null ? List.of() : options;
        }

        private MatchType type() {
            return type;
        }

        private Product product() {
            return product;
        }

        private List<String> options() {
            return options;
        }

        private static ProductMatch matched(Product product) {
            return new ProductMatch(MatchType.MATCHED, product, List.of());
        }

        private static ProductMatch ambiguous(List<String> options) {
            return new ProductMatch(MatchType.AMBIGUOUS, null, options == null ? List.of() : options);
        }

        private static ProductMatch notFound() {
            return new ProductMatch(MatchType.NOT_FOUND, null, List.of());
        }
    }

    private enum MatchType {
        MATCHED,
        AMBIGUOUS,
        NOT_FOUND
    }

    private static final class FinalOrderItem {
        private final Product product;
        private int quantity;
        private String specialNote;

        private FinalOrderItem(Product product, int quantity, String specialNote) {
            this.product = product;
            this.quantity = quantity;
            this.specialNote = specialNote == null ? "" : specialNote;
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
}
