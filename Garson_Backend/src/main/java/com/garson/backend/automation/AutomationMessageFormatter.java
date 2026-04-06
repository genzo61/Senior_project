package com.garson.backend.automation;

import com.garson.backend.dto.report.CustomerEngagementResponseDto;
import com.garson.backend.dto.report.DailySummaryResponseDto;
import com.garson.backend.dto.report.ProductCountDto;
import com.garson.backend.dto.report.RestockSuggestionItemDto;
import com.garson.backend.dto.report.RestockSuggestionsResponseDto;
import com.garson.backend.dto.report.SalesAnalysisResponseDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class AutomationMessageFormatter {

    public String formatDailySummary(DailySummaryResponseDto report) {
        return """
                Tarih: %s
                Toplam siparis: %d
                Toplam ciro: %s TL
                Ortalama hazirlama suresi: %.1f dk
                En cok satanlar: %s
                En az satanlar: %s
                """.formatted(
                report.getDate(),
                report.getTotalOrders(),
                money(report.getTotalRevenue()),
                report.getAvgPrepMinutes(),
                productList(report.getTopProducts()),
                productList(report.getLeastProducts()));
    }

    public String formatSalesAnalysis(SalesAnalysisResponseDto report) {
        ProductCountDto leastProduct = report.getLeastProduct();
        return """
                Tarih: %s
                Top urun: %s (%d adet)
                Toplam satilan urun: %d
                Toplam ciro: %s TL
                Top 3 urun: %s
                En az satan urun: %s
                """.formatted(
                report.getDate(),
                safe(report.getTopProduct()),
                report.getTopProductCount(),
                report.getTotalItemsSold(),
                money(report.getTotalRevenue()),
                productList(report.getTopProducts()),
                leastProduct == null ? "-" : safe(leastProduct.getName()) + " (" + leastProduct.getCount() + ")");
    }

    public String formatCustomerEngagement(CustomerEngagementResponseDto report) {
        return """
                Tarih: %s
                Toplam siparis: %d
                Benzersiz masa: %d
                Toplam satilan urun: %d
                Siparis basina ortalama urun: %.2f
                chatOpened: %d
                aiSuggestionShown: %d
                addedToCart: %d
                checkoutStarted: %d
                ordersCreated: %d
                """.formatted(
                report.getDate(),
                report.getTotalOrders(),
                report.getUniqueTables(),
                report.getTotalItemsSold(),
                report.getAvgItemsPerOrder(),
                report.getChatOpened(),
                report.getAiSuggestionShown(),
                report.getAddedToCart(),
                report.getCheckoutStarted(),
                report.getOrdersCreated());
    }

    public String formatRestockSuggestions(RestockSuggestionsResponseDto report) {
        List<RestockSuggestionItemDto> items = report.getItems() == null ? List.of() : report.getItems();
        String lines = items.stream()
                .limit(10)
                .map(item -> safe(item.getName()) + " | stok=" + item.getCurrentStock() + " | onerilen ek=" + item.getSuggestedAdd())
                .collect(Collectors.joining("\n"));

        if (lines.isBlank()) {
            lines = "Bugun icin kritik restock onerisi yok.";
        }

        return """
                Gun sayisi: %d
                Oneriler:
                %s
                """.formatted(report.getDays(), lines);
    }

    private String productList(List<ProductCountDto> products) {
        if (products == null || products.isEmpty()) {
            return "-";
        }
        return products.stream()
                .map(item -> safe(item.getName()) + " (" + item.getCount() + ")")
                .collect(Collectors.joining(", "));
    }

    private String money(BigDecimal value) {
        return value == null ? "0.00" : value.toPlainString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
