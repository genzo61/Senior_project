package com.garson.backend.automation;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "automation")
public class AutomationProperties {
    private boolean enabled = true;
    private String dailySummaryCron = "0 0 23 * * *";
    private String salesAnalysisCron = "0 5 23 * * *";
    private String customerEngagementCron = "0 10 23 * * *";
    private String restockSuggestionCron = "0 15 23 * * *";
    private int lowStockThresholdDefault = 10;
    private long lowStockAlertCooldownMinutes = 120L;
    private int restockSuggestionDays = 3;
}
