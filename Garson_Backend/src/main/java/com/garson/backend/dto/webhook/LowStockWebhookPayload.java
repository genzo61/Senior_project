package com.garson.backend.dto.webhook;

public class LowStockWebhookPayload {

    private Long productId;
    private String productName;
    private int quantity;
    private int threshold;

    public LowStockWebhookPayload() {
    }

    public LowStockWebhookPayload(Long productId, String productName, int quantity, int threshold) {
        this.productId = productId;
        this.productName = productName;
        this.quantity = quantity;
        this.threshold = threshold;
    }

    public Long getProductId() {
        return productId;
    }

    public void setProductId(Long productId) {
        this.productId = productId;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public int getThreshold() {
        return threshold;
    }

    public void setThreshold(int threshold) {
        this.threshold = threshold;
    }
}
