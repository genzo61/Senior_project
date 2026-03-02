package com.garson.backend.repository;

import com.garson.backend.model.Order;
import com.garson.backend.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status);

    Optional<Order> findByClientOrderId(String clientOrderId);
}
