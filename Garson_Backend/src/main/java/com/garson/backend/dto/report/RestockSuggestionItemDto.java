package com.garson.backend.dto.report;

public class RestockSuggestionItemDto {

    private String name;
    private int currentStock;
    private int suggestedAdd;

    public RestockSuggestionItemDto() {
    }

    public RestockSuggestionItemDto(String name, int currentStock, int suggestedAdd) {
        this.name = name;
        this.currentStock = currentStock;
        this.suggestedAdd = suggestedAdd;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getCurrentStock() {
        return currentStock;
    }

    public void setCurrentStock(int currentStock) {
        this.currentStock = currentStock;
    }

    public int getSuggestedAdd() {
        return suggestedAdd;
    }

    public void setSuggestedAdd(int suggestedAdd) {
        this.suggestedAdd = suggestedAdd;
    }
}
