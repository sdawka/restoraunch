-- Restoraunch Seed Data

-- Location
INSERT INTO locations (name) VALUES ('Main Restaurant');

-- Suppliers (location_id = 1)
INSERT INTO suppliers (name, contact, location_id) VALUES
    ('Sysco', 'orders@sysco.com', 1),
    ('US Foods', 'contact@usfoods.com', 1),
    ('Local Farm Co', 'info@localfarm.co', 1);

-- Inventory Items (location_id = 1)
INSERT INTO inventory_items (name, unit, quantity, cost_per_unit, low_stock_threshold, location_id) VALUES
    ('Eggs', 'dozen', 50, 3.50, 10, 1),
    ('Flour', 'lb', 100, 0.75, 20, 1),
    ('Beef Patties', 'unit', 200, 1.25, 50, 1),
    ('Burger Buns', 'unit', 150, 0.40, 40, 1),
    ('Cheddar Cheese', 'lb', 30, 5.00, 10, 1),
    ('Lettuce', 'head', 40, 1.50, 15, 1),
    ('Tomatoes', 'lb', 25, 2.00, 10, 1),
    ('Avocado', 'unit', 60, 1.75, 20, 1),
    ('Bread', 'loaf', 20, 3.00, 8, 1),
    ('Butter', 'lb', 15, 4.50, 5, 1);

-- Menu Items (location_id = 1)
INSERT INTO menu_items (name, price, is_active, location_id) VALUES
    ('Classic Burger', 12.99, 1, 1),
    ('Cheeseburger', 14.99, 1, 1),
    ('Avocado Toast', 9.99, 1, 1),
    ('Scrambled Eggs', 8.99, 1, 1);

-- Recipes (menu_item_id, inventory_item_id, quantity_per_serving)
-- Classic Burger (menu_item_id = 1): Beef Patty, Bun, Lettuce, Tomato
INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES
    (1, 3, 1),      -- Beef Patty: 1 unit
    (1, 4, 1),      -- Burger Bun: 1 unit
    (1, 6, 0.25),   -- Lettuce: 0.25 head
    (1, 7, 0.125);  -- Tomatoes: 0.125 lb

-- Cheeseburger (menu_item_id = 2): Beef Patty, Bun, Cheese, Lettuce, Tomato
INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES
    (2, 3, 1),      -- Beef Patty: 1 unit
    (2, 4, 1),      -- Burger Bun: 1 unit
    (2, 5, 0.125),  -- Cheddar Cheese: 0.125 lb (2 oz)
    (2, 6, 0.25),   -- Lettuce: 0.25 head
    (2, 7, 0.125);  -- Tomatoes: 0.125 lb

-- Avocado Toast (menu_item_id = 3): Bread, Avocado, Butter
INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES
    (3, 9, 0.125),  -- Bread: 0.125 loaf (1 slice)
    (3, 8, 0.5),    -- Avocado: 0.5 unit
    (3, 10, 0.0625); -- Butter: 0.0625 lb (1 oz)

-- Scrambled Eggs (menu_item_id = 4): Eggs, Butter
INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES
    (4, 1, 0.25),   -- Eggs: 0.25 dozen (3 eggs)
    (4, 10, 0.0625); -- Butter: 0.0625 lb (1 oz)
