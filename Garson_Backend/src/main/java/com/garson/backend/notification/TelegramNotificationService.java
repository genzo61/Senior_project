package com.garson.backend.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramNotificationService implements NotificationService {

    private final RestTemplateBuilder restTemplateBuilder;
    private final TelegramNotificationProperties properties;

    @Override
    public void sendMessage(String title, String message) {
        String token = safeTrim(properties.getBotToken());
        String chatId = safeTrim(properties.getChatId());
        if (token.isEmpty() || chatId.isEmpty()) {
            log.debug("Telegram notification skipped because bot token or chat id is missing");
            return;
        }

        String text = formatText(title, message);
        String url = "https://api.telegram.org/bot" + token + "/sendMessage";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> payload = Map.of(
                "chat_id", chatId,
                "text", text,
                "disable_web_page_preview", true);

        int retryLimit = Math.max(0, properties.getMaxRetries());
        long backoffMs = Math.max(0L, properties.getRetryBackoffMs());

        for (int attempt = 0; attempt <= retryLimit; attempt++) {
            try {
                HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
                buildRestTemplate().postForEntity(url, request, Map.class);
                return;
            } catch (Exception ex) {
                if (attempt == retryLimit) {
                    log.warn("Telegram notification failed after {} attempt(s): {}", attempt + 1, ex.getMessage());
                    return;
                }
                sleepQuietly(backoffMs);
            }
        }
    }

    private RestTemplate buildRestTemplate() {
        return restTemplateBuilder
                .connectTimeout(Duration.ofMillis(Math.max(1, properties.getConnectTimeoutMs())))
                .readTimeout(Duration.ofMillis(Math.max(1, properties.getReadTimeoutMs())))
                .build();
    }

    private String formatText(String title, String message) {
        String cleanTitle = safeTrim(title);
        String cleanMessage = safeTrim(message);
        if (cleanTitle.isEmpty()) {
            return cleanMessage;
        }
        if (cleanMessage.isEmpty()) {
            return cleanTitle;
        }
        return cleanTitle + "\n" + cleanMessage;
    }

    private void sleepQuietly(long millis) {
        if (millis <= 0L) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        }
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
