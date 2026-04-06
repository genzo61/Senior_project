package com.garson.backend.alerts;

import com.garson.backend.model.AlertDeduplicationRecord;
import com.garson.backend.repository.AlertDeduplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AlertDeduplicationService {

    private final AlertDeduplicationRepository repository;

    @Transactional
    public boolean shouldSend(String channel, String entityKey, Duration cooldown) {
        String safeChannel = safe(channel);
        String safeEntityKey = safe(entityKey);
        if (safeChannel.isEmpty() || safeEntityKey.isEmpty()) {
            return true;
        }

        Duration safeCooldown = cooldown == null ? Duration.ZERO : cooldown;
        Instant now = Instant.now();

        Optional<AlertDeduplicationRecord> optional = repository.findByChannelAndEntityKey(safeChannel, safeEntityKey);
        if (optional.isPresent()) {
            AlertDeduplicationRecord existing = optional.get();
            Instant lastSentAt = existing.getLastSentAt() == null ? Instant.EPOCH : existing.getLastSentAt();
            if (lastSentAt.plus(safeCooldown).isAfter(now)) {
                return false;
            }

            existing.setLastSentAt(now);
            existing.setUpdatedAt(now);
            repository.save(existing);
            return true;
        }

        AlertDeduplicationRecord newRecord = new AlertDeduplicationRecord();
        newRecord.setChannel(safeChannel);
        newRecord.setEntityKey(safeEntityKey);
        newRecord.setLastSentAt(now);
        newRecord.setCreatedAt(now);
        newRecord.setUpdatedAt(now);
        repository.save(newRecord);
        return true;
    }

    @Transactional
    public void reset(String channel, String entityKey) {
        String safeChannel = safe(channel);
        String safeEntityKey = safe(entityKey);
        if (safeChannel.isEmpty() || safeEntityKey.isEmpty()) {
            return;
        }
        repository.deleteByChannelAndEntityKey(safeChannel, safeEntityKey);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
