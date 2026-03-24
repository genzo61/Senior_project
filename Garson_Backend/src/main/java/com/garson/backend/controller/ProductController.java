package com.garson.backend.controller;

import com.garson.backend.model.Product;
import com.garson.backend.dto.product.ProductResponse;
import com.garson.backend.dto.product.ProductUpsertRequest;
import com.garson.backend.dto.product.ProductTagUtils;
import com.garson.backend.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*") // Frontend'den ve Robot'tan direkt erişime izin vermek için
public class ProductController {

    @Autowired
    private ProductRepository productRepository;

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
            return ResponseEntity.ok(ProductResponse.fromEntity(productRepository.save(p)));
        }
        return ResponseEntity.notFound().build();
    }
}
