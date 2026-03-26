package com.garson.backend.dto.report;

public class ProductCountDto {

    private String name;
    private long count;

    public ProductCountDto() {
    }

    public ProductCountDto(String name, long count) {
        this.name = name;
        this.count = count;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public long getCount() {
        return count;
    }

    public void setCount(long count) {
        this.count = count;
    }
}
