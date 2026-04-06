CREATE TABLE IF NOT EXISTS alert_deduplication (
    id BIGSERIAL PRIMARY KEY,
    channel VARCHAR(120) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_alert_deduplication_channel_entity UNIQUE (channel, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_alert_deduplication_last_sent_at
    ON alert_deduplication (last_sent_at);

CREATE TABLE IF NOT EXISTS customer_interaction_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    session_id VARCHAR(120),
    table_no VARCHAR(64),
    quantity INTEGER NOT NULL DEFAULT 1,
    metadata TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_interaction_occurred_at
    ON customer_interaction_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_customer_interaction_event_type
    ON customer_interaction_events (event_type);
