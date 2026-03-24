package com.garson.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "ollama")
public class OllamaProperties {
    private String baseUrl = "http://127.0.0.1:11434";
    private String model = "llama3.2:3b";
    private int timeoutMs = 8000;
    private double temperature = 0.0;
}
