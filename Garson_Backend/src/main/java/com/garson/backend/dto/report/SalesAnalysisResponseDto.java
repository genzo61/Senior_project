package com.garson.backend.dto.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class SalesAnalysisResponseDto {

    private LocalDate date;
    private String topProduct;
    private long topProductCount;
    private long totalItemsSold;
    private BigDecimal totalRevenue;
    private List<ProductCountDto> topProducts;
    private ProductCountDto leastProduct;

    public SalesAnalysisResponseDto() {
    }

    public SalesAnalysisResponseDto(LocalDate date,
                                    String topProduct,
                                    long topProductCount,
                                    long totalItemsSold,
                                    BigDecimal totalRevenue,
                                    List<ProductCountDto> topProducts,
                                    ProductCountDto leastProduct) {
        this.date = date;
        this.topProduct = topProduct;
        this.topProductCount = topProductCount;
        this.totalItemsSold = totalItemsSold;
        this.totalRevenue = totalRevenue;
        this.topProducts = topProducts;
        this.leastProduct = leastProduct;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getTopProduct() {
        return topProduct;
    }

    public void setTopProduct(String topProduct) {
        this.topProduct = topProduct;
    }

    public long getTopProductCount() {
        return topProductCount;
    }

    public void setTopProductCount(long topProductCount) {
        this.topProductCount = topProductCount;
    }

    public long getTotalItemsSold() {
        return totalItemsSold;
    }

    public void setTotalItemsSold(long totalItemsSold) {
        this.totalItemsSold = totalItemsSold;
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

    public ProductCountDto getLeastProduct() {
        return leastProduct;
    }

    public void setLeastProduct(ProductCountDto leastProduct) {
        this.leastProduct = leastProduct;
    }
}
