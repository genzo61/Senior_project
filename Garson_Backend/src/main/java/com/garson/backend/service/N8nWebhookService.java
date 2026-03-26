package com.garson.backend.service;

import com.garson.backend.dto.webhook.CriticalErrorWebhookPayload;
import com.garson.backend.dto.webhook.LowStockWebhookPayload;
import com.garson.backend.model.Product;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class N8nWebhookService {

    private final RestTemplateBuilder restTemplateBuilder;

    @Value("${n8n.low-stock-webhook-url:}")
    private String lowStockWebhookUrl;

    @Value("${n8n.critical-error-webhook-url:}")
    private String criticalErrorWebhookUrl;

    @Value("${low-stock-threshold-default:5}")
    private int lowStockThresholdDefault;

    private final ConcurrentMap<Long, Boolean> lowStockAlertState = new ConcurrentHashMap<>();

    public int getLowStockThresholdDefault() {
        return lowStockThresholdDefault;
    }

    public void notifyLowStockIfNeeded(Product product) {
        if (product == null || product.getId() == null) {
            return;
        }

        int quantity = product.getStock() == null ? 0 : product.getStock();
        int threshold = Math.max(0, lowStockThresholdDefault);
        Long productId = product.getId();

        if (quantity > threshold) {
            lowStockAlertState.remove(productId);
            return;
        }

        Boolean alreadySent = lowStockAlertState.putIfAbsent(productId, Boolean.TRUE);
        if (alreadySent != null) {
            return;
        }

        LowStockWebhookPayload payload = new LowStockWebhookPayload(
                productId,
                safeTrim(product.getName()),
                quantity,
                threshold);

        sendAsync(lowStockWebhookUrl, payload, "low-stock");
    }

    public void notifyCriticalError(String message, String details) {
        CriticalErrorWebhookPayload payload = new CriticalErrorWebhookPayload(
                "backend",
                "ERROR",
                safeTrim(message),
                safeTrim(details),
                OffsetDateTime.now());

        sendAsync(criticalErrorWebhookUrl, payload, "critical-error");
    }

    private void sendAsync(String url, Object payload, String channelName) {
        if (safeTrim(url).isEmpty()) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Object> request = new HttpEntity<>(payload, headers);
                buildRestTemplate().postForEntity(url, request, Map.class);
            } catch (Exception ex) {
                log.warn("n8n {} webhook failed: {}", channelName, ex.getMessage());
            }
        });
    }

    private RestTemplate buildRestTemplate() {
        return restTemplateBuilder
                .connectTimeout(Duration.ofSeconds(3))
                .readTimeout(Duration.ofSeconds(3))
                .build();
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
