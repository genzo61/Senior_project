package com.garson.backend.repository;

import com.garson.backend.model.CustomerInteractionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface CustomerInteractionEventRepository extends JpaRepository<CustomerInteractionEvent, Long> {
    List<CustomerInteractionEvent> findByOccurredAtGreaterThanEqualAndOccurredAtLessThan(Instant startInclusive, Instant endExclusive);
}
