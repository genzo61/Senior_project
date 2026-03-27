package com.garson.backend.service.chat.retrieval;

import com.garson.backend.model.Product;

import java.util.List;

public interface KnowledgeIndexBuilder {
    List<KnowledgeDocument> build(List<Product> products);
}
