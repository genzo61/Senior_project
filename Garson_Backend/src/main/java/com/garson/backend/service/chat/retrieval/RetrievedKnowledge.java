package com.garson.backend.service.chat.retrieval;

public class RetrievedKnowledge {
    private final KnowledgeDocument document;
    private final double score;

    public RetrievedKnowledge(KnowledgeDocument document, double score) {
        this.document = document;
        this.score = score;
    }

    public KnowledgeDocument document() {
        return document;
    }

    public double score() {
        return score;
    }
}
