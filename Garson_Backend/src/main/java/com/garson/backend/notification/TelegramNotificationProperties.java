package com.garson.backend.notification;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "notification.telegram")
public class TelegramNotificationProperties {
    private String botToken = "";
    private String chatId = "";
    private int connectTimeoutMs = 3000;
    private int readTimeoutMs = 3000;
    private int maxRetries = 2;
    private long retryBackoffMs = 750L;
}
