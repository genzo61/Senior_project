package com.garson.backend.dto.report;

import java.time.LocalDate;

public class CustomerEngagementResponseDto {

    private LocalDate date;
    private long totalOrders;
    private long uniqueTables;
    private long totalItemsSold;
    private double avgItemsPerOrder;
    private long chatOpened;
    private long aiSuggestionShown;
    private long addedToCart;
    private long checkoutStarted;
    private long ordersCreated;

    public CustomerEngagementResponseDto() {
    }

    public CustomerEngagementResponseDto(LocalDate date,
                                         long totalOrders,
                                         long uniqueTables,
                                         long totalItemsSold,
                                         double avgItemsPerOrder) {
        this(date, totalOrders, uniqueTables, totalItemsSold, avgItemsPerOrder, 0, 0, 0, 0, 0);
    }

    public CustomerEngagementResponseDto(LocalDate date,
                                         long totalOrders,
                                         long uniqueTables,
                                         long totalItemsSold,
                                         double avgItemsPerOrder,
                                         long chatOpened,
                                         long aiSuggestionShown,
                                         long addedToCart,
                                         long checkoutStarted,
                                         long ordersCreated) {
        this.date = date;
        this.totalOrders = totalOrders;
        this.uniqueTables = uniqueTables;
        this.totalItemsSold = totalItemsSold;
        this.avgItemsPerOrder = avgItemsPerOrder;
        this.chatOpened = chatOpened;
        this.aiSuggestionShown = aiSuggestionShown;
        this.addedToCart = addedToCart;
        this.checkoutStarted = checkoutStarted;
        this.ordersCreated = ordersCreated;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public long getTotalOrders() {
        return totalOrders;
    }

    public void setTotalOrders(long totalOrders) {
        this.totalOrders = totalOrders;
    }

    public long getUniqueTables() {
        return uniqueTables;
    }

    public void setUniqueTables(long uniqueTables) {
        this.uniqueTables = uniqueTables;
    }

    public long getTotalItemsSold() {
        return totalItemsSold;
    }

    public void setTotalItemsSold(long totalItemsSold) {
        this.totalItemsSold = totalItemsSold;
    }

    public double getAvgItemsPerOrder() {
        return avgItemsPerOrder;
    }

    public void setAvgItemsPerOrder(double avgItemsPerOrder) {
        this.avgItemsPerOrder = avgItemsPerOrder;
    }

    public long getChatOpened() {
        return chatOpened;
    }

    public void setChatOpened(long chatOpened) {
        this.chatOpened = chatOpened;
    }

    public long getAiSuggestionShown() {
        return aiSuggestionShown;
    }

    public void setAiSuggestionShown(long aiSuggestionShown) {
        this.aiSuggestionShown = aiSuggestionShown;
    }

    public long getAddedToCart() {
        return addedToCart;
    }

    public void setAddedToCart(long addedToCart) {
        this.addedToCart = addedToCart;
    }

    public long getCheckoutStarted() {
        return checkoutStarted;
    }

    public void setCheckoutStarted(long checkoutStarted) {
        this.checkoutStarted = checkoutStarted;
    }

    public long getOrdersCreated() {
        return ordersCreated;
    }

    public void setOrdersCreated(long ordersCreated) {
        this.ordersCreated = ordersCreated;
    }
}
