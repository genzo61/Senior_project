package com.garson.backend.dto.report;

import java.time.LocalDate;

public class CustomerEngagementResponseDto {

    private LocalDate date;
    private long totalOrders;
    private long uniqueTables;
    private long totalItemsSold;
    private double avgItemsPerOrder;

    public CustomerEngagementResponseDto() {
    }

    public CustomerEngagementResponseDto(LocalDate date,
                                         long totalOrders,
                                         long uniqueTables,
                                         long totalItemsSold,
                                         double avgItemsPerOrder) {
        this.date = date;
        this.totalOrders = totalOrders;
        this.uniqueTables = uniqueTables;
        this.totalItemsSold = totalItemsSold;
        this.avgItemsPerOrder = avgItemsPerOrder;
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
}
