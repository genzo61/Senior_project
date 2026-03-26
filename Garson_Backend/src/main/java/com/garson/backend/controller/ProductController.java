package com.garson.backend.controller;

import com.garson.backend.dto.product.ProductResponse;
import com.garson.backend.dto.product.ProductTagUtils;
import com.garson.backend.dto.product.ProductUpsertRequest;
import com.garson.backend.model.Product;
import com.garson.backend.repository.ProductRepository;
import com.garson.backend.service.N8nWebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository productRepository;
    private final N8nWebhookService n8nWebhookService;

    @GetMapping
    public List<ProductResponse> getAllProducts() {
        return productRepository.findAll().stream().map(ProductResponse::fromEntity).toList();
    }

    @PostMapping
    public ProductResponse addProduct(@RequestBody ProductUpsertRequest request) {
        Product product = new Product();
        product.setName(request.getName());
        product.setPrice(request.getPrice());
        product.setStock(request.getStock());
        product.setCategory(request.getCategory());
        product.setDescription(request.getDescription());
        product.setTags(ProductTagUtils.toTagStorage(request));

        return ProductResponse.fromEntity(productRepository.save(product));
    }

    @PutMapping("/{id}/stock")
    public ResponseEntity<ProductResponse> updateStock(@PathVariable(name = "id") Long id,
                                                       @RequestParam(name = "quantity") Integer quantity) {
        Optional<Product> opt = productRepository.findById(id);
        if (opt.isPresent()) {
            Product p = opt.get();
            p.setStock(quantity);
            Product updatedProduct = productRepository.save(p);
            n8nWebhookService.notifyLowStockIfNeeded(updatedProduct);
            return ResponseEntity.ok(ProductResponse.fromEntity(updatedProduct));
        }
        return ResponseEntity.notFound().build();
    }
}
