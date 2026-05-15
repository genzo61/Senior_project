package com.garson.backend.repository;

import com.garson.backend.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("select distinct o from Order o left join fetch o.items")
    List<Order> findAllWithItems();

    List<Order> findByTableNo(String tableNo);
}
