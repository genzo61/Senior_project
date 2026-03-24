package com.garson.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.garson.backend.config.OllamaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OllamaClient {

    private final OllamaProperties ollamaProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    public Optional<String> chatJsonOnly(String systemPrompt, String userPrompt) {
        String safeSystemPrompt = systemPrompt == null ? "" : systemPrompt;
        String safeUserPrompt = userPrompt == null ? "" : userPrompt;

        RestTemplate restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofMillis(ollamaProperties.getTimeoutMs()))
                .readTimeout(Duration.ofMillis(ollamaProperties.getTimeoutMs()))
                .build();

        String safeModel = (ollamaProperties.getModel() == null || ollamaProperties.getModel().isBlank())
                ? "llama3.2:3b"
                : ollamaProperties.getModel();

        Map<String, Object> requestBody = Map.of(
                "model", safeModel,
                "stream", false,
                "format", "json",
                "options", Map.of("temperature", ollamaProperties.getTemperature()),
                "messages", List.of(
                        Map.of("role", "system", "content", safeSystemPrompt),
                        Map.of("role", "user", "content", safeUserPrompt)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String baseUrl = ollamaProperties.getBaseUrl() == null || ollamaProperties.getBaseUrl().isBlank()
                ? "http://127.0.0.1:11434"
                : ollamaProperties.getBaseUrl();
        String endpoint = baseUrl.replaceAll("/$", "") + "/api/chat";

        try {
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                    endpoint,
                    new HttpEntity<>(requestBody, headers),
                    JsonNode.class);

            JsonNode body = response.getBody();
            if (body == null) {
                return Optional.empty();
            }

            JsonNode contentNode = body.path("message").path("content");
            if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
                return Optional.empty();
            }

            return Optional.of(contentNode.asText());
        } catch (RestClientException ex) {
            log.warn("Ollama request failed (endpoint={}, model={}): {}", endpoint, safeModel, ex.getMessage());
            return Optional.empty();
        } catch (Exception ex) {
            log.warn("Unexpected Ollama client failure (endpoint={}, model={}): {}", endpoint, safeModel, ex.getMessage());
            return Optional.empty();
        }
    }
}
