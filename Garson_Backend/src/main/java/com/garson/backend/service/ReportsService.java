package com.garson.backend.service;

import com.garson.backend.analytics.CustomerInteractionMetrics;
import com.garson.backend.analytics.CustomerInteractionService;
import com.garson.backend.analytics.CustomerInteractionType;
import com.garson.backend.config.AppProperties;
import com.garson.backend.dto.report.CustomerEngagementResponseDto;
import com.garson.backend.dto.report.DailySummaryResponseDto;
import com.garson.backend.dto.report.ProductCountDto;
import com.garson.backend.dto.report.RestockSuggestionItemDto;
import com.garson.backend.dto.report.RestockSuggestionsResponseDto;
import com.garson.backend.dto.report.SalesAnalysisResponseDto;
import com.garson.backend.model.Order;
import com.garson.backend.model.OrderItem;
import com.garson.backend.model.Product;
import com.garson.backend.repository.OrderRepository;
import com.garson.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportsService {

    private static final int TOP_LIMIT = 3;
    private static final List<String> STOCK_CONSUMING_STATUSES = List.of("READY", "DELIVERED", "PAID");

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final CustomerInteractionService customerInteractionService;
    private final AppProperties appProperties;

    public DailySummaryResponseDto getDailySummary(LocalDate date) {
        List<Order> dailyOrders = findOrdersByDate(date);
        Map<String, Long> productCounts = calculateProductCounts(dailyOrders);

        return new DailySummaryResponseDto(
                date,
                dailyOrders.size(),
                calculateTotalRevenue(dailyOrders),
                topProducts(productCounts),
                leastProducts(productCounts),
                averagePrepMinutes(dailyOrders));
    }

    public SalesAnalysisResponseDto getSalesAnalysis(LocalDate date) {
        List<Order> dailyOrders = findOrdersByDate(date);
        Map<String, Long> productCounts = calculateProductCounts(dailyOrders);
        List<ProductCountDto> topProducts = topProducts(productCounts);
        ProductCountDto leastProduct = leastProduct(productCounts);
        ProductCountDto topProduct = topProducts.isEmpty() ? new ProductCountDto("", 0) : topProducts.get(0);

        return new SalesAnalysisResponseDto(
                date,
                topProduct.getName(),
                topProduct.getCount(),
                productCounts.values().stream().mapToLong(Long::longValue).sum(),
                calculateTotalRevenue(dailyOrders),
                topProducts,
                leastProduct);
    }

    public CustomerEngagementResponseDto getCustomerEngagement(LocalDate date) {
        List<Order> dailyOrders = findOrdersByDate(date);
        CustomerInteractionMetrics interactionMetrics = customerInteractionService.getMetrics(date);
        long totalItemsSold = totalItemsSold(dailyOrders);
        long totalOrders = dailyOrders.size();
        long uniqueTables = dailyOrders.stream()
                .map(Order::getTableNo)
                .map(this::safeTrim)
                .filter(tableNo -> !tableNo.isEmpty())
                .distinct()
                .count();

        double avgItemsPerOrder = totalOrders == 0
                ? 0.0
                : BigDecimal.valueOf((double) totalItemsSold / totalOrders).setScale(2, RoundingMode.HALF_UP).doubleValue();

        return new CustomerEngagementResponseDto(
                date,
                totalOrders,
                uniqueTables,
                totalItemsSold,
                avgItemsPerOrder,
                interactionMetrics.count(CustomerInteractionType.CHAT_OPENED),
                interactionMetrics.count(CustomerInteractionType.AI_SUGGESTION_SHOWN),
                interactionMetrics.count(CustomerInteractionType.ADDED_TO_CART),
                interactionMetrics.count(CustomerInteractionType.CHECKOUT_STARTED),
                interactionMetrics.count(CustomerInteractionType.ORDERS_CREATED));
    }

    public RestockSuggestionsResponseDto getRestockSuggestions(int days) {
        int safeDays = Math.max(1, days);
        LocalDate endDate = LocalDate.now(resolveZoneId());
        LocalDate startDate = endDate.minusDays(safeDays - 1L);

        Map<String, Long> soldCounts = calculateProductCounts(
                orderRepository.findAllWithItems().stream()
                        .filter(order -> isBetweenDates(resolveOrderDate(order), startDate, endDate))
                        .filter(this::isStockConsumingOrder)
                        .toList());

        List<RestockSuggestionItemDto> items = new ArrayList<>();
        for (Product product : productRepository.findAll()) {
            String normalizedName = normalizedName(product.getName());
            long soldInWindow = soldCounts.getOrDefault(normalizedName, 0L);
            int currentStock = product.getStock() == null ? 0 : product.getStock();
            int targetStock = (int) Math.ceil(((double) soldInWindow / safeDays) * safeDays);
            int suggestedAdd = Math.max(0, targetStock - currentStock);

            if (suggestedAdd > 0) {
                items.add(new RestockSuggestionItemDto(
                        safeTrim(product.getName()),
                        currentStock,
                        suggestedAdd));
            }
        }

        items.sort(Comparator
                .comparingInt(RestockSuggestionItemDto::getSuggestedAdd).reversed()
                .thenComparing(RestockSuggestionItemDto::getName, String.CASE_INSENSITIVE_ORDER));

        return new RestockSuggestionsResponseDto(safeDays, items);
    }

    private List<Order> findOrdersByDate(LocalDate date) {
        return orderRepository.findAllWithItems().stream()
                .filter(order -> date.equals(resolveOrderDate(order)))
                .toList();
    }

    private LocalDate resolveOrderDate(Order order) {
        if (order == null) {
            return LocalDate.MIN;
        }
        if (order.getOrderTime() != null) {
            return order.getOrderTime().toLocalDate();
        }
        Instant createdAt = order.getCreatedAt();
        if (createdAt != null) {
            return LocalDateTime.ofInstant(createdAt, resolveZoneId()).toLocalDate();
        }
        return LocalDate.MIN;
    }

    private boolean isBetweenDates(LocalDate value, LocalDate startDate, LocalDate endDate) {
        return value != null
                && (value.isEqual(startDate) || value.isAfter(startDate))
                && (value.isEqual(endDate) || value.isBefore(endDate));
    }

    private boolean isStockConsumingOrder(Order order) {
        return STOCK_CONSUMING_STATUSES.contains(safeTrim(order.getStatus()).toUpperCase());
    }

    private Map<String, Long> calculateProductCounts(List<Order> orders) {
        Map<String, Long> counts = new HashMap<>();
        for (Order order : orders) {
            if (order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                if (item == null) {
                    continue;
                }
                String normalizedName = normalizedName(item.getProductName());
                if (normalizedName.isEmpty()) {
                    continue;
                }
                Integer itemQuantity = item.getQuantity();
                long quantity = (itemQuantity == null || itemQuantity < 1) ? 1L : itemQuantity.longValue();
                Long currentCount = counts.get(normalizedName);
                long nextCount = (currentCount == null ? 0L : currentCount.longValue()) + quantity;
                counts.put(normalizedName, nextCount);
            }
        }
        return counts;
    }

    private List<ProductCountDto> topProducts(Map<String, Long> counts) {
        return counts.entrySet().stream()
                .map(entry -> new ProductCountDto(displayName(entry.getKey()), entry.getValue()))
                .sorted(Comparator
                        .comparingLong(ProductCountDto::getCount).reversed()
                        .thenComparing(ProductCountDto::getName, String.CASE_INSENSITIVE_ORDER))
                .limit(TOP_LIMIT)
                .toList();
    }

    private List<ProductCountDto> leastProducts(Map<String, Long> counts) {
        Optional<Long> min = counts.values().stream().min(Long::compareTo);
        if (min.isEmpty()) {
            return List.of();
        }

        long minCount = min.get();
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue() == minCount)
                .map(entry -> new ProductCountDto(displayName(entry.getKey()), entry.getValue()))
                .sorted(Comparator.comparing(ProductCountDto::getName, String.CASE_INSENSITIVE_ORDER))
                .limit(TOP_LIMIT)
                .toList();
    }

    private ProductCountDto leastProduct(Map<String, Long> counts) {
        return counts.entrySet().stream()
                .map(entry -> new ProductCountDto(displayName(entry.getKey()), entry.getValue()))
                .min(Comparator
                        .comparingLong(ProductCountDto::getCount)
                        .thenComparing(ProductCountDto::getName, String.CASE_INSENSITIVE_ORDER))
                .orElse(new ProductCountDto("", 0));
    }

    private long totalItemsSold(List<Order> orders) {
        return orders.stream()
                .filter(order -> order.getItems() != null)
                .flatMap(order -> order.getItems().stream())
                .filter(item -> item != null && item.getProductName() != null && !safeTrim(item.getProductName()).isEmpty())
                .mapToLong(item -> item.getQuantity() == null || item.getQuantity() < 1 ? 1L : item.getQuantity())
                .sum();
    }

    private BigDecimal calculateTotalRevenue(List<Order> orders) {
        BigDecimal total = BigDecimal.ZERO;
        for (Order order : orders) {
            if (order.getItems() == null) {
                continue;
            }
            for (OrderItem item : order.getItems()) {
                if (item == null) {
                    continue;
                }
                long quantity = item.getQuantity() == null || item.getQuantity() < 1 ? 1L : item.getQuantity();
                double price = item.getPrice() == null ? 0.0 : item.getPrice();
                total = total.add(BigDecimal.valueOf(price).multiply(BigDecimal.valueOf(quantity)));
            }
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private double averagePrepMinutes(List<Order> orders) {
        double average = orders.stream()
                .filter(order -> !"NEW".equalsIgnoreCase(safeTrim(order.getStatus())))
                .map(this::prepMinutes)
                .flatMapToDouble(OptionalDouble::stream)
                .average()
                .orElse(0.0);

        return BigDecimal.valueOf(average).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private OptionalDouble prepMinutes(Order order) {
        Instant createdAt = order.getCreatedAt();
        Instant updatedAt = order.getUpdatedAt();
        if (createdAt == null || updatedAt == null) {
            return OptionalDouble.empty();
        }

        long seconds = Duration.between(createdAt, updatedAt).getSeconds();
        if (seconds < 0) {
            return OptionalDouble.empty();
        }
        return OptionalDouble.of(seconds / 60.0);
    }

    private String normalizedName(String value) {
        return safeTrim(value).toLowerCase().replaceAll("\\s+", " ");
    }

    private String displayName(String normalizedName) {
        if (normalizedName == null || normalizedName.isEmpty()) {
            return "";
        }
        return Character.toUpperCase(normalizedName.charAt(0)) + normalizedName.substring(1);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private ZoneId resolveZoneId() {
        String timezone = safeTrim(appProperties.getTimezone());
        try {
            return ZoneId.of(timezone.isEmpty() ? "Europe/Istanbul" : timezone);
        } catch (Exception ex) {
            return ZoneId.of("Europe/Istanbul");
        }
    }
}
