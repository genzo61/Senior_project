ALTER TABLE IF EXISTS order_items
    ADD COLUMN IF NOT EXISTS special_note TEXT;

ALTER TABLE IF EXISTS product
    ADD COLUMN IF NOT EXISTS category VARCHAR(120);

ALTER TABLE IF EXISTS product
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE IF EXISTS product
    ADD COLUMN IF NOT EXISTS tags TEXT;

-- Compatibility guard in case a legacy DB used plural table naming.
ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS category VARCHAR(120);

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS tags TEXT;
