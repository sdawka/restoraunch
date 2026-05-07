-- Add owner to locations
ALTER TABLE locations ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Add audit fields to inventory_items
ALTER TABLE inventory_items ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN updated_by TEXT REFERENCES users(id);

-- Add audit field to sales
ALTER TABLE sales ADD COLUMN created_by TEXT REFERENCES users(id);

-- Add audit field to variance_logs
ALTER TABLE variance_logs ADD COLUMN resolved_by TEXT REFERENCES users(id);
