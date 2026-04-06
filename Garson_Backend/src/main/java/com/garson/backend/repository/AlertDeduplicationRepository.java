package com.garson.backend.repository;

import com.garson.backend.model.AlertDeduplicationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AlertDeduplicationRepository extends JpaRepository<AlertDeduplicationRecord, Long> {
    Optional<AlertDeduplicationRecord> findByChannelAndEntityKey(String channel, String entityKey);
    void deleteByChannelAndEntityKey(String channel, String entityKey);
}
