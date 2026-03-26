package com.garson.backend.dto.report;

import java.util.List;

public class RestockSuggestionsResponseDto {

    private int days;
    private List<RestockSuggestionItemDto> items;

    public RestockSuggestionsResponseDto() {
    }

    public RestockSuggestionsResponseDto(int days, List<RestockSuggestionItemDto> items) {
        this.days = days;
        this.items = items;
    }

    public int getDays() {
        return days;
    }

    public void setDays(int days) {
        this.days = days;
    }

    public List<RestockSuggestionItemDto> getItems() {
        return items;
    }

    public void setItems(List<RestockSuggestionItemDto> items) {
        this.items = items;
    }
}
