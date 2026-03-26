package com.garson.backend.dto.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class DailySummaryResponseDto {

    private LocalDate date;
    private long totalOrders;
    private BigDecimal totalRevenue;
    private List<ProductCountDto> topProducts;
    private List<ProductCountDto> leastProducts;
    private double avgPrepMinutes;

    public DailySummaryResponseDto() {
    }

    public DailySummaryResponseDto(LocalDate date,
                                   long totalOrders,
                                   BigDecimal totalRevenue,
                                   List<ProductCountDto> topProducts,
                                   List<ProductCountDto> leastProducts,
                                   double avgPrepMinutes) {
        this.date = date;
        this.totalOrders = totalOrders;
        this.totalRevenue = totalRevenue;
        this.topProducts = topProducts;
        this.leastProducts = leastProducts;
        this.avgPrepMinutes = avgPrepMinutes;
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

    public BigDecimal getTotalRevenue() {
        return totalRevenue;
    }

    public void setTotalRevenue(BigDecimal totalRevenue) {
        this.totalRevenue = totalRevenue;
    }

    public List<ProductCountDto> getTopProducts() {
        return topProducts;
    }

    public void setTopProducts(List<ProductCountDto> topProducts) {
        this.topProducts = topProducts;
    }

    public List<ProductCountDto> getLeastProducts() {
        return leastProducts;
    }

    public void setLeastProducts(List<ProductCountDto> leastProducts) {
        this.leastProducts = leastProducts;
    }

    public double getAvgPrepMinutes() {
        return avgPrepMinutes;
    }

    public void setAvgPrepMinutes(double avgPrepMinutes) {
        this.avgPrepMinutes = avgPrepMinutes;
    }
}
