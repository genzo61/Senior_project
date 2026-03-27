package com.garson.backend.service.chat.retrieval;

import java.util.List;

public interface KnowledgeRetrievalService {
    List<RetrievedKnowledge> retrieve(String query, List<KnowledgeDocument> documents, int limit);
}
