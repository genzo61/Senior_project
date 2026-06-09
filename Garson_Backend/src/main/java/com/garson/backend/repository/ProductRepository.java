package com.garson.backend.repository;

import com.garson.backend.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByNameIgnoreCase(String name);

    @Query(value = """
            select *
            from product
            where lower(translate(name, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu'))
                  like '%' || lower(translate(:query, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu')) || '%'
            order by
                case
                    when lower(translate(name, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu'))
                         = lower(translate(:query, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu')) then 0
                    when lower(translate(name, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu'))
                         like lower(translate(:query, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu')) || '%' then 1
                    else 2
                end,
                char_length(name)
            limit 5
            """, nativeQuery = true)
    List<Product> searchByNormalizedName(@Param("query") String query);
}
