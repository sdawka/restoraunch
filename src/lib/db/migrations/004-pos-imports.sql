-- POS imports table (tracks POS screen image uploads)
CREATE TABLE IF NOT EXISTS pos_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    items_imported INTEGER DEFAULT 0,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE INDEX IF NOT EXISTS idx_pos_imports_location ON pos_imports(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_imports_image_url ON pos_imports(image_url);
