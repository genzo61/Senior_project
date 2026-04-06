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
import java.util.ArrayList;
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

        RestTemplate restTemplate = buildRestTemplate();
        String endpoint = baseUrl() + "/api/chat";
        String model = chatModel();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "stream", false,
                "format", "json",
                "options", Map.of("temperature", ollamaProperties.getTemperature()),
                "messages", List.of(
                        Map.of("role", "system", "content", safeSystemPrompt),
                        Map.of("role", "user", "content", safeUserPrompt)));

        try {
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                    endpoint,
                    new HttpEntity<>(requestBody, jsonHeaders()),
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
            log.warn("Ollama chat request failed (endpoint={}, model={}): {}", endpoint, model, ex.getMessage());
            return Optional.empty();
        } catch (Exception ex) {
            log.warn("Unexpected Ollama chat failure (endpoint={}, model={}): {}", endpoint, model, ex.getMessage());
            return Optional.empty();
        }
    }

    public Optional<List<Double>> embedText(String text) {
        String safeText = text == null ? "" : text.trim();
        if (safeText.isEmpty()) {
            return Optional.empty();
        }

        RestTemplate restTemplate = buildRestTemplate();
        String model = embeddingModel();
        String base = baseUrl();

        Optional<List<Double>> embedResult = callEmbedEndpoint(restTemplate, base + "/api/embed", model, safeText);
        if (embedResult.isPresent()) {
            return embedResult;
        }

        return callLegacyEmbeddingsEndpoint(restTemplate, base + "/api/embeddings", model, safeText);
    }

    private Optional<List<Double>> callEmbedEndpoint(RestTemplate restTemplate, String endpoint, String model, String text) {
        Map<String, Object> request = Map.of(
                "model", model,
                "input", text);

        try {
            @SuppressWarnings("null")
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                    endpoint,
                    new HttpEntity<>(request, jsonHeaders()),
                    JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) {
                return Optional.empty();
            }

            JsonNode embeddingsNode = body.path("embeddings");
            if (embeddingsNode.isArray() && !embeddingsNode.isEmpty()) {
                JsonNode first = embeddingsNode.get(0);
                if (first != null && first.isArray()) {
                    return parseEmbeddingArray(first);
                }
                return parseEmbeddingArray(embeddingsNode);
            }

            return Optional.empty();
        } catch (RestClientException ex) {
            log.debug("Ollama /api/embed failed (model={}, endpoint={}): {}", model, endpoint, ex.getMessage());
            return Optional.empty();
        } catch (Exception ex) {
            log.debug("Unexpected /api/embed failure (model={}, endpoint={}): {}", model, endpoint, ex.getMessage());
            return Optional.empty();
        }
    }

    private Optional<List<Double>> callLegacyEmbeddingsEndpoint(
            RestTemplate restTemplate,
            String endpoint,
            String model,
            String text) {
        Map<String, Object> request = Map.of(
                "model", model,
                "prompt", text);

        try {
            @SuppressWarnings("null")
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                    endpoint,
                    new HttpEntity<>(request, jsonHeaders()),
                    JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) {
                return Optional.empty();
            }

            return parseEmbeddingArray(body.path("embedding"));
        } catch (RestClientException ex) {
            log.debug("Ollama /api/embeddings failed (model={}, endpoint={}): {}", model, endpoint, ex.getMessage());
            return Optional.empty();
        } catch (Exception ex) {
            log.debug("Unexpected /api/embeddings failure (model={}, endpoint={}): {}", model, endpoint, ex.getMessage());
            return Optional.empty();
        }
    }

    private Optional<List<Double>> parseEmbeddingArray(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) {
            return Optional.empty();
        }

        List<Double> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item == null || !item.isNumber()) {
                return Optional.empty();
            }
            values.add(item.asDouble());
        }

        return values.isEmpty() ? Optional.empty() : Optional.of(values);
    }

    private RestTemplate buildRestTemplate() {
        return restTemplateBuilder
                .connectTimeout(Duration.ofMillis(ollamaProperties.getTimeoutMs()))
                .readTimeout(Duration.ofMillis(ollamaProperties.getTimeoutMs()))
                .build();
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private String baseUrl() {
        String configured = ollamaProperties.getBaseUrl();
        if (configured == null || configured.isBlank()) {
            return "http://127.0.0.1:11434";
        }
        return configured.replaceAll("/$", "");
    }

    private String chatModel() {
        String configured = ollamaProperties.getModel();
        if (configured == null || configured.isBlank()) {
            return "llama3.2:3b";
        }
        return configured;
    }

    private String embeddingModel() {
        String configured = ollamaProperties.getEmbeddingModel();
        if (configured == null || configured.isBlank()) {
            return "nomic-embed-text";
        }
        return configured;
    }
}
