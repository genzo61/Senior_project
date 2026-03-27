package com.garson.backend.service.chat.retrieval;

import java.util.Collections;
import java.util.Map;

public class KnowledgeDocument {
    private final String id;
    private final String type;
    private final String title;
    private final String content;
    private final Map<String, Object> metadata;

    public KnowledgeDocument(
            String id,
            String type,
            String title,
            String content,
            Map<String, Object> metadata) {
        this.id = id;
        this.type = type;
        this.title = title;
        this.content = content;
        this.metadata = metadata == null ? Collections.emptyMap() : Collections.unmodifiableMap(metadata);
    }

    public String id() {
        return id;
    }

    public String type() {
        return type;
    }

    public String title() {
        return title;
    }

    public String content() {
        return content;
    }

    public Map<String, Object> metadata() {
        return metadata;
    }
}
