package com.garson.backend.event;

import com.garson.backend.model.Product;

public record ProductStockChangedEvent(Product product, String source) {
}
