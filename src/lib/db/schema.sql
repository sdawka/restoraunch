-- Restoraunch D1 Database Schema

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    cost_per_unit REAL DEFAULT 0,
    low_stock_threshold REAL DEFAULT 0,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    photo_url TEXT,
    total_cost REAL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Purchase items table
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    inventory_item_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Recipes table (links menu items to inventory items)
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    inventory_item_id INTEGER NOT NULL,
    quantity_per_serving REAL NOT NULL,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    UNIQUE (menu_item_id, inventory_item_id)
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    sale_date TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Variance logs table
CREATE TABLE IF NOT EXISTS variance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_item_id INTEGER NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    expected_usage REAL NOT NULL,
    actual_usage REAL NOT NULL,
    variance_pct REAL NOT NULL,
    explanation TEXT,
    explanation_type TEXT,
    resolved INTEGER DEFAULT 0,
    location_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Inventory adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_item_id INTEGER NOT NULL,
    quantity_change REAL NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_location ON menu_items(location_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_variance_logs_resolved ON variance_logs(resolved);
