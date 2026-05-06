# Restoraunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Frontend tasks:** Use `frontend-design:frontend-design` skill for all UI implementation.
>
> **Parallel execution:** Tasks within the same phase can run in parallel. Wait for phase completion before starting the next phase.

**Goal:** Build a mobile-friendly restaurant inventory management app that connects purchases, menu recipes, and sales to calculate real profit margins and detect anomalies.

**Architecture:** Astro 6 server-rendered with Vue islands for interactivity. D1 (SQLite) for relational data, R2 for image storage, OpenRouter for AI vision. API routes in Cloudflare Workers.

**Tech Stack:** Astro 6, Vue 3, Cloudflare Workers/D1/R2, OpenRouter (Claude), Tailwind v4 with OKLCH

---

## File Structure

```
restoraunch/
├── astro.config.mjs
├── wrangler.jsonc
├── package.json
├── tailwind.config.ts
├── src/
│   ├── env.d.ts                    # Cloudflare bindings types
│   ├── styles/
│   │   └── global.css              # OKLCH theme, Tailwind imports
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.sql          # D1 schema
│   │   │   ├── seed.sql            # Test data
│   │   │   └── queries.ts          # Typed query helpers
│   │   ├── ai/
│   │   │   ├── service.ts          # AIService interface + OpenRouter impl
│   │   │   └── prompts.ts          # Receipt/POS parsing prompts
│   │   ├── inventory/
│   │   │   └── service.ts          # Inventory business logic
│   │   ├── menu/
│   │   │   └── service.ts          # Menu + recipe logic, margin calc
│   │   ├── sales/
│   │   │   └── service.ts          # Sales import, profit calc
│   │   ├── variance/
│   │   │   └── service.ts          # Variance calculation + anomaly detection
│   │   └── scenarios/
│   │       └── service.ts          # What-if modeling
│   ├── components/
│   │   ├── Nav.vue                 # Bottom tab navigation
│   │   ├── ScanButton.vue          # Floating receipt scan FAB
│   │   ├── ReceiptScanner.vue      # Camera + upload + review flow
│   │   ├── InventoryList.vue       # Stock levels with adjustment
│   │   ├── MenuEditor.vue          # Menu items + recipe builder
│   │   ├── SalesImport.vue         # POS photo/CSV import
│   │   ├── VarianceList.vue        # Anomaly flags with explain flow
│   │   ├── ScenarioBuilder.vue     # What-if form + results
│   │   └── DashboardCards.vue      # Summary metrics
│   ├── layouts/
│   │   └── AppLayout.astro         # Shell with nav, scan button
│   └── pages/
│       ├── index.astro             # Dashboard
│       ├── inventory.astro
│       ├── menu.astro
│       ├── sales.astro
│       ├── insights.astro
│       ├── model.astro
│       └── api/
│           ├── receipts/
│           │   ├── scan.ts         # POST: upload + AI parse
│           │   └── confirm.ts      # POST: apply parsed items
│           ├── sales/
│           │   └── import.ts       # POST: POS import
│           ├── inventory/
│           │   ├── index.ts        # GET: list
│           │   └── [id].ts         # PUT: adjust
│           ├── menu/
│           │   └── index.ts        # GET/POST: menu items
│           ├── variance/
│           │   ├── calculate.ts    # GET: run analysis
│           │   └── [id]/
│           │       └── explain.ts  # POST: add explanation
│           └── scenarios/
│               └── model.ts        # POST: what-if calc
├── public/
│   ├── manifest.json               # PWA manifest
│   └── sw.js                       # Service worker (basic)
└── tests/
    ├── lib/
    │   ├── inventory.test.ts
    │   ├── menu.test.ts
    │   ├── sales.test.ts
    │   ├── variance.test.ts
    │   └── scenarios.test.ts
    └── api/
        └── integration.test.ts
```

---

## Phase 1: Foundation (Serial)

### Task 1: Scaffold Astro 6 + Cloudflare Project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json`
- Create: `src/env.d.ts`

- [ ] **Step 1: Initialize project**

```bash
npm create astro@latest restoraunch -- --template minimal --install --git
cd restoraunch
```

- [ ] **Step 2: Add Cloudflare adapter and dependencies**

```bash
npx astro add cloudflare vue tailwind
npm install @cloudflare/workers-types drizzle-orm better-sqlite3
npm install -D vitest @testing-library/vue happy-dom
```

- [ ] **Step 3: Configure astro.config.mjs**

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [vue(), tailwind()],
});
```

- [ ] **Step 4: Configure wrangler.jsonc**

```jsonc
{
  "name": "restoraunch",
  "compatibility_date": "2024-12-01",
  "main": "dist/_worker.js",
  "assets": {
    "directory": "dist",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "restoraunch-db",
      "database_id": "local"
    }
  ],
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "restoraunch-images"
    }
  ],
  "vars": {
    "OPENROUTER_API_KEY": ""
  }
}
```

- [ ] **Step 5: Add Cloudflare bindings types in src/env.d.ts**

```typescript
/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  OPENROUTER_API_KEY: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
    };
  }
}
```

- [ ] **Step 6: Verify project runs**

```bash
npm run dev
```

Expected: Dev server starts at localhost:4321

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro 6 + Cloudflare project"
```

---

### Task 2: Setup Tailwind with OKLCH Theme

**Files:**
- Create: `src/styles/global.css`
- Create: `tailwind.config.ts`

- [ ] **Step 1: Create OKLCH theme in tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        warm: {
          50: 'oklch(0.98 0.01 60)',
          100: 'oklch(0.95 0.02 60)',
          200: 'oklch(0.90 0.03 60)',
          300: 'oklch(0.85 0.05 60)',
          400: 'oklch(0.70 0.08 60)',
          500: 'oklch(0.55 0.10 60)',
          600: 'oklch(0.45 0.10 60)',
          700: 'oklch(0.35 0.08 60)',
          800: 'oklch(0.25 0.05 60)',
          900: 'oklch(0.15 0.03 60)',
        },
        accent: {
          success: 'oklch(0.65 0.15 140)',
          warning: 'oklch(0.75 0.15 85)',
          error: 'oklch(0.60 0.20 25)',
          info: 'oklch(0.65 0.12 230)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Create global.css**

```css
@import 'tailwindcss';

@layer base {
  html {
    font-family: system-ui, sans-serif;
    background: oklch(0.98 0.01 60);
    color: oklch(0.20 0.02 60);
  }

  body {
    min-height: 100dvh;
  }
}

@layer components {
  .card {
    @apply bg-white rounded-xl p-4 shadow-sm border border-warm-100;
  }

  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-warm-600 text-white hover:bg-warm-700;
  }

  .btn-secondary {
    @apply bg-warm-100 text-warm-700 hover:bg-warm-200;
  }

  .input {
    @apply w-full px-3 py-2 rounded-lg border border-warm-200 bg-white
           focus:outline-none focus:ring-2 focus:ring-warm-400;
  }
}
```

- [ ] **Step 3: Import in layout (create placeholder)**

Create `src/layouts/AppLayout.astro`:

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title} | Restoraunch</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Verify styles work**

Update `src/pages/index.astro`:

```astro
---
import AppLayout from '../layouts/AppLayout.astro';
---

<AppLayout title="Dashboard">
  <main class="p-4">
    <h1 class="text-2xl font-bold text-warm-800">Restoraunch</h1>
    <p class="text-warm-600 mt-2">Restaurant inventory management</p>
    <button class="btn btn-primary mt-4">Test Button</button>
  </main>
</AppLayout>
```

Run: `npm run dev`
Expected: Warm-toned page with styled button

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind with OKLCH warm theme"
```

---

### Task 3: Create D1 Database Schema

**Files:**
- Create: `src/lib/db/schema.sql`
- Create: `src/lib/db/seed.sql`
- Create: `src/lib/db/queries.ts`

- [ ] **Step 1: Write schema.sql**

```sql
-- Locations (multi-location ready, single for v1)
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  cost_per_unit REAL DEFAULT 0,
  low_stock_threshold REAL DEFAULT 10,
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Purchases (receipt records)
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER,
  photo_url TEXT,
  total_cost REAL NOT NULL,
  purchase_date TEXT NOT NULL,
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Purchase line items
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  is_active INTEGER DEFAULT 1,
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Recipes (menu item -> inventory item mapping)
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  quantity_per_serving REAL NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  UNIQUE(menu_item_id, inventory_item_id)
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  sale_date TEXT NOT NULL,
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Variance logs
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
  location_id INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Inventory adjustments (for audit trail)
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL,
  quantity_change REAL NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
```

- [ ] **Step 2: Write seed.sql**

```sql
-- Default location
INSERT INTO locations (name) VALUES ('Main Restaurant');

-- Sample suppliers
INSERT INTO suppliers (name, contact) VALUES 
  ('Sysco', 'sysco@example.com'),
  ('US Foods', 'usfoods@example.com'),
  ('Local Farm Co', 'farm@example.com');

-- Sample inventory items
INSERT INTO inventory_items (name, unit, quantity, cost_per_unit, low_stock_threshold) VALUES 
  ('Eggs (large)', 'each', 120, 0.25, 24),
  ('Flour (all-purpose)', 'lb', 50, 0.50, 10),
  ('Beef Patties', 'each', 80, 2.50, 20),
  ('Burger Buns', 'each', 60, 0.40, 15),
  ('Cheddar Cheese', 'lb', 15, 6.00, 5),
  ('Lettuce', 'head', 10, 2.00, 3),
  ('Tomatoes', 'lb', 12, 3.00, 4),
  ('Avocado', 'each', 20, 1.50, 5),
  ('Bread (sliced)', 'loaf', 8, 3.50, 3),
  ('Butter', 'lb', 10, 4.00, 3);

-- Sample menu items
INSERT INTO menu_items (name, price) VALUES 
  ('Classic Burger', 12.00),
  ('Cheeseburger', 13.50),
  ('Avocado Toast', 14.00),
  ('Scrambled Eggs', 9.00);

-- Sample recipes
INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES 
  -- Classic Burger: 1 patty, 1 bun, 0.1 lb lettuce, 0.15 lb tomato
  (1, 3, 1), (1, 4, 1), (1, 6, 0.1), (1, 7, 0.15),
  -- Cheeseburger: same + 0.125 lb cheese
  (2, 3, 1), (2, 4, 1), (2, 5, 0.125), (2, 6, 0.1), (2, 7, 0.15),
  -- Avocado Toast: 2 slices bread (0.1 loaf), 0.5 avocado, 2 eggs
  (3, 9, 0.1), (3, 8, 0.5), (3, 1, 2),
  -- Scrambled Eggs: 3 eggs, 0.05 lb butter
  (4, 1, 3), (4, 10, 0.05);
```

- [ ] **Step 3: Create typed query helpers in queries.ts**

```typescript
import type { D1Database } from '@cloudflare/workers-types';

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  cost_per_unit: number;
  low_stock_threshold: number;
  location_id: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  is_active: number;
  location_id: number;
  created_at: string;
}

export interface Recipe {
  id: number;
  menu_item_id: number;
  inventory_item_id: number;
  quantity_per_serving: number;
}

export interface Sale {
  id: number;
  menu_item_id: number;
  quantity: number;
  sale_date: string;
  location_id: number;
  created_at: string;
}

export interface VarianceLog {
  id: number;
  inventory_item_id: number;
  period_start: string;
  period_end: string;
  expected_usage: number;
  actual_usage: number;
  variance_pct: number;
  explanation: string | null;
  explanation_type: string | null;
  resolved: number;
  location_id: number;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  location_id: number;
  created_at: string;
}

export async function getInventoryItems(db: D1Database, locationId = 1): Promise<InventoryItem[]> {
  const result = await db
    .prepare('SELECT * FROM inventory_items WHERE location_id = ? ORDER BY name')
    .bind(locationId)
    .all<InventoryItem>();
  return result.results;
}

export async function getMenuItems(db: D1Database, locationId = 1): Promise<MenuItem[]> {
  const result = await db
    .prepare('SELECT * FROM menu_items WHERE location_id = ? AND is_active = 1 ORDER BY name')
    .bind(locationId)
    .all<MenuItem>();
  return result.results;
}

export async function getRecipesForMenuItem(db: D1Database, menuItemId: number): Promise<(Recipe & { item_name: string; unit: string; cost_per_unit: number })[]> {
  const result = await db
    .prepare(`
      SELECT r.*, i.name as item_name, i.unit, i.cost_per_unit
      FROM recipes r
      JOIN inventory_items i ON r.inventory_item_id = i.id
      WHERE r.menu_item_id = ?
    `)
    .bind(menuItemId)
    .all();
  return result.results as (Recipe & { item_name: string; unit: string; cost_per_unit: number })[];
}

export async function getSuppliers(db: D1Database, locationId = 1): Promise<Supplier[]> {
  const result = await db
    .prepare('SELECT * FROM suppliers WHERE location_id = ? ORDER BY name')
    .bind(locationId)
    .all<Supplier>();
  return result.results;
}
```

- [ ] **Step 4: Create and seed local D1 database**

```bash
npx wrangler d1 create restoraunch-db
npx wrangler d1 execute restoraunch-db --local --file=src/lib/db/schema.sql
npx wrangler d1 execute restoraunch-db --local --file=src/lib/db/seed.sql
```

- [ ] **Step 5: Verify database works**

```bash
npx wrangler d1 execute restoraunch-db --local --command="SELECT * FROM inventory_items"
```

Expected: 10 inventory items listed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add D1 schema with inventory, menu, sales, variance tables"
```

---

### Task 4: Create AI Service Abstraction

**Files:**
- Create: `src/lib/ai/service.ts`
- Create: `src/lib/ai/prompts.ts`
- Create: `tests/lib/ai.test.ts`

- [ ] **Step 1: Write the test for AI service interface**

Create `tests/lib/ai.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAIService, type ParsedReceipt, type ParsedSales } from '../src/lib/ai/service';

describe('AIService', () => {
  it('parseReceipt returns structured receipt data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              supplier: 'Sysco',
              items: [
                { name: 'Eggs Large 30ct', quantity: 2, unit: 'case', unitCost: 45.00 },
              ],
              total: 90.00,
              date: '2026-05-06',
            }),
          },
        }],
      }),
    });

    const service = createAIService('test-key', mockFetch);
    const result = await service.parseReceipt('https://example.com/receipt.jpg');

    expect(result.supplier).toBe('Sysco');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Eggs Large 30ct');
  });

  it('parsePOSScreen returns structured sales data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              sales: [
                { menuItem: 'Classic Burger', quantity: 15 },
                { menuItem: 'Cheeseburger', quantity: 8 },
              ],
              date: '2026-05-06',
            }),
          },
        }],
      }),
    });

    const service = createAIService('test-key', mockFetch);
    const result = await service.parsePOSScreen('https://example.com/pos.jpg');

    expect(result.sales).toHaveLength(2);
    expect(result.sales[0].menuItem).toBe('Classic Burger');
    expect(result.sales[0].quantity).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/ai.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Create prompts.ts**

```typescript
export const RECEIPT_PARSE_PROMPT = `You are analyzing a receipt image from a restaurant supply purchase.

Extract the following information and return it as JSON:
{
  "supplier": "Name of the supplier/vendor",
  "items": [
    {
      "name": "Product name as shown on receipt",
      "quantity": 1,
      "unit": "each|case|lb|oz|gal|etc",
      "unitCost": 0.00
    }
  ],
  "total": 0.00,
  "date": "YYYY-MM-DD"
}

Rules:
- Extract ALL line items from the receipt
- Use the exact product names as printed
- Calculate unit cost from total if only totals shown
- Date should be ISO format
- Return ONLY valid JSON, no explanation`;

export const POS_PARSE_PROMPT = `You are analyzing a POS (Point of Sale) screen image showing sales data.

Extract the following information and return it as JSON:
{
  "sales": [
    {
      "menuItem": "Name of menu item",
      "quantity": 1
    }
  ],
  "date": "YYYY-MM-DD"
}

Rules:
- Extract ALL menu items with their quantities sold
- Use the exact menu item names as shown
- Date should be ISO format
- Return ONLY valid JSON, no explanation`;

export const ITEM_MATCH_PROMPT = `Match this receipt item to the most likely inventory item.

Receipt item: "{receiptItem}"

Inventory items:
{inventoryList}

Return JSON with the best match:
{
  "matchedId": 1,
  "confidence": 0.95,
  "reason": "Brief explanation"
}

If no good match exists, return:
{
  "matchedId": null,
  "confidence": 0,
  "reason": "No matching item found"
}

Return ONLY valid JSON.`;
```

- [ ] **Step 4: Create service.ts**

```typescript
import { RECEIPT_PARSE_PROMPT, POS_PARSE_PROMPT, ITEM_MATCH_PROMPT } from './prompts';

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface ParsedReceipt {
  supplier: string;
  items: ParsedReceiptItem[];
  total: number;
  date: string;
}

export interface ParsedSalesItem {
  menuItem: string;
  quantity: number;
}

export interface ParsedSales {
  sales: ParsedSalesItem[];
  date: string;
}

export interface ItemMatch {
  matchedId: number | null;
  confidence: number;
  reason: string;
}

export interface InventoryItemForMatch {
  id: number;
  name: string;
  unit: string;
}

export interface AIService {
  parseReceipt(imageUrl: string): Promise<ParsedReceipt>;
  parsePOSScreen(imageUrl: string): Promise<ParsedSales>;
  matchInventoryItem(receiptItem: string, existing: InventoryItemForMatch[]): Promise<ItemMatch>;
}

type FetchFn = typeof fetch;

export function createAIService(apiKey: string, fetchFn: FetchFn = fetch): AIService {
  async function callVision(imageUrl: string, prompt: string): Promise<string> {
    const response = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }

  async function callText(prompt: string): Promise<string> {
    const response = await fetchFn('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }

  return {
    async parseReceipt(imageUrl: string): Promise<ParsedReceipt> {
      const content = await callVision(imageUrl, RECEIPT_PARSE_PROMPT);
      return JSON.parse(content) as ParsedReceipt;
    },

    async parsePOSScreen(imageUrl: string): Promise<ParsedSales> {
      const content = await callVision(imageUrl, POS_PARSE_PROMPT);
      return JSON.parse(content) as ParsedSales;
    },

    async matchInventoryItem(receiptItem: string, existing: InventoryItemForMatch[]): Promise<ItemMatch> {
      const inventoryList = existing.map(i => `- ID ${i.id}: ${i.name} (${i.unit})`).join('\n');
      const prompt = ITEM_MATCH_PROMPT
        .replace('{receiptItem}', receiptItem)
        .replace('{inventoryList}', inventoryList);
      const content = await callText(prompt);
      return JSON.parse(content) as ItemMatch;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/lib/ai.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add AI service with OpenRouter for receipt/POS parsing"
```

---

## Phase 2: Core Services (Parallel)

> Tasks 5, 6, and 7 can run in parallel.

### Task 5: Inventory Service

**Files:**
- Create: `src/lib/inventory/service.ts`
- Create: `tests/lib/inventory.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInventoryService } from '../../src/lib/inventory/service';

describe('InventoryService', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn(),
    first: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAll returns inventory items with low stock flag', async () => {
    mockDb.all.mockResolvedValue({
      results: [
        { id: 1, name: 'Eggs', quantity: 20, low_stock_threshold: 24 },
        { id: 2, name: 'Flour', quantity: 50, low_stock_threshold: 10 },
      ],
    });

    const service = createInventoryService(mockDb as any);
    const items = await service.getAll();

    expect(items).toHaveLength(2);
    expect(items[0].isLowStock).toBe(true);
    expect(items[1].isLowStock).toBe(false);
  });

  it('adjustQuantity updates quantity and logs adjustment', async () => {
    mockDb.first.mockResolvedValue({ id: 1, quantity: 100 });
    mockDb.run.mockResolvedValue({ success: true });

    const service = createInventoryService(mockDb as any);
    await service.adjustQuantity(1, -10, 'Used for staff meal');

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_items')
    );
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO inventory_adjustments')
    );
  });

  it('addFromPurchase increases quantity and updates cost', async () => {
    mockDb.first.mockResolvedValue({ id: 1, quantity: 100, cost_per_unit: 0.20 });
    mockDb.run.mockResolvedValue({ success: true });

    const service = createInventoryService(mockDb as any);
    await service.addFromPurchase(1, 50, 0.25);

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE inventory_items')
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/inventory.test.ts
```

Expected: FAIL - module not found

- [ ] **Step 3: Implement service**

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { InventoryItem } from '../db/queries';

export interface InventoryItemWithStatus extends InventoryItem {
  isLowStock: boolean;
}

export interface InventoryService {
  getAll(locationId?: number): Promise<InventoryItemWithStatus[]>;
  getById(id: number): Promise<InventoryItem | null>;
  adjustQuantity(id: number, delta: number, reason?: string): Promise<void>;
  addFromPurchase(id: number, quantity: number, unitCost: number): Promise<void>;
  create(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
}

export function createInventoryService(db: D1Database): InventoryService {
  return {
    async getAll(locationId = 1): Promise<InventoryItemWithStatus[]> {
      const result = await db
        .prepare('SELECT * FROM inventory_items WHERE location_id = ? ORDER BY name')
        .bind(locationId)
        .all<InventoryItem>();

      return result.results.map(item => ({
        ...item,
        isLowStock: item.quantity <= item.low_stock_threshold,
      }));
    },

    async getById(id: number): Promise<InventoryItem | null> {
      const result = await db
        .prepare('SELECT * FROM inventory_items WHERE id = ?')
        .bind(id)
        .first<InventoryItem>();
      return result;
    },

    async adjustQuantity(id: number, delta: number, reason?: string): Promise<void> {
      await db
        .prepare('UPDATE inventory_items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(delta, id)
        .run();

      await db
        .prepare('INSERT INTO inventory_adjustments (inventory_item_id, quantity_change, reason) VALUES (?, ?, ?)')
        .bind(id, delta, reason || null)
        .run();
    },

    async addFromPurchase(id: number, quantity: number, unitCost: number): Promise<void> {
      const item = await db
        .prepare('SELECT quantity, cost_per_unit FROM inventory_items WHERE id = ?')
        .bind(id)
        .first<{ quantity: number; cost_per_unit: number }>();

      if (!item) throw new Error(`Inventory item ${id} not found`);

      const totalOldValue = item.quantity * item.cost_per_unit;
      const totalNewValue = quantity * unitCost;
      const newQuantity = item.quantity + quantity;
      const newCostPerUnit = newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : unitCost;

      await db
        .prepare('UPDATE inventory_items SET quantity = ?, cost_per_unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(newQuantity, newCostPerUnit, id)
        .run();
    },

    async create(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
      const result = await db
        .prepare(`
          INSERT INTO inventory_items (name, unit, quantity, cost_per_unit, low_stock_threshold, location_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(item.name, item.unit, item.quantity, item.cost_per_unit, item.low_stock_threshold, item.location_id)
        .run();
      return result.meta.last_row_id;
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/inventory.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add inventory service with quantity adjustment and purchase tracking"
```

---

### Task 6: Menu Service with Margin Calculation

**Files:**
- Create: `src/lib/menu/service.ts`
- Create: `tests/lib/menu.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMenuService } from '../../src/lib/menu/service';

describe('MenuService', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn(),
    first: vi.fn(),
    run: vi.fn(),
    batch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMenuItemWithCost calculates ingredient cost and margin', async () => {
    mockDb.first.mockResolvedValue({ id: 1, name: 'Burger', price: 12.00 });
    mockDb.all.mockResolvedValue({
      results: [
        { inventory_item_id: 1, quantity_per_serving: 1, cost_per_unit: 2.50 },
        { inventory_item_id: 2, quantity_per_serving: 1, cost_per_unit: 0.40 },
      ],
    });

    const service = createMenuService(mockDb as any);
    const item = await service.getMenuItemWithCost(1);

    expect(item.ingredientCost).toBe(2.90);
    expect(item.margin).toBe(9.10);
    expect(item.marginPercent).toBeCloseTo(75.83, 1);
  });

  it('getAllWithCosts returns all items with calculated margins', async () => {
    mockDb.all
      .mockResolvedValueOnce({
        results: [
          { id: 1, name: 'Burger', price: 12.00 },
          { id: 2, name: 'Toast', price: 14.00 },
        ],
      })
      .mockResolvedValueOnce({
        results: [{ inventory_item_id: 1, quantity_per_serving: 1, cost_per_unit: 2.50 }],
      })
      .mockResolvedValueOnce({
        results: [{ inventory_item_id: 2, quantity_per_serving: 0.5, cost_per_unit: 1.50 }],
      });

    const service = createMenuService(mockDb as any);
    const items = await service.getAllWithCosts();

    expect(items).toHaveLength(2);
    expect(items[0].ingredientCost).toBe(2.50);
    expect(items[1].ingredientCost).toBe(0.75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/menu.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement service**

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { MenuItem, Recipe } from '../db/queries';

export interface MenuItemWithCost extends MenuItem {
  ingredientCost: number;
  margin: number;
  marginPercent: number;
}

export interface RecipeIngredient {
  inventoryItemId: number;
  inventoryItemName: string;
  unit: string;
  quantityPerServing: number;
  costPerUnit: number;
}

export interface MenuService {
  getAll(locationId?: number): Promise<MenuItem[]>;
  getMenuItemWithCost(id: number): Promise<MenuItemWithCost>;
  getAllWithCosts(locationId?: number): Promise<MenuItemWithCost[]>;
  getRecipeIngredients(menuItemId: number): Promise<RecipeIngredient[]>;
  create(item: { name: string; price: number; locationId?: number }): Promise<number>;
  setRecipe(menuItemId: number, ingredients: { inventoryItemId: number; quantityPerServing: number }[]): Promise<void>;
}

export function createMenuService(db: D1Database): MenuService {
  async function calculateIngredientCost(menuItemId: number): Promise<number> {
    const result = await db
      .prepare(`
        SELECT r.quantity_per_serving, i.cost_per_unit
        FROM recipes r
        JOIN inventory_items i ON r.inventory_item_id = i.id
        WHERE r.menu_item_id = ?
      `)
      .bind(menuItemId)
      .all<{ quantity_per_serving: number; cost_per_unit: number }>();

    return result.results.reduce((sum, row) => sum + row.quantity_per_serving * row.cost_per_unit, 0);
  }

  return {
    async getAll(locationId = 1): Promise<MenuItem[]> {
      const result = await db
        .prepare('SELECT * FROM menu_items WHERE location_id = ? AND is_active = 1 ORDER BY name')
        .bind(locationId)
        .all<MenuItem>();
      return result.results;
    },

    async getMenuItemWithCost(id: number): Promise<MenuItemWithCost> {
      const item = await db
        .prepare('SELECT * FROM menu_items WHERE id = ?')
        .bind(id)
        .first<MenuItem>();

      if (!item) throw new Error(`Menu item ${id} not found`);

      const ingredientCost = await calculateIngredientCost(id);
      const margin = item.price - ingredientCost;
      const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;

      return { ...item, ingredientCost, margin, marginPercent };
    },

    async getAllWithCosts(locationId = 1): Promise<MenuItemWithCost[]> {
      const items = await this.getAll(locationId);
      return Promise.all(items.map(async item => {
        const ingredientCost = await calculateIngredientCost(item.id);
        const margin = item.price - ingredientCost;
        const marginPercent = item.price > 0 ? (margin / item.price) * 100 : 0;
        return { ...item, ingredientCost, margin, marginPercent };
      }));
    },

    async getRecipeIngredients(menuItemId: number): Promise<RecipeIngredient[]> {
      const result = await db
        .prepare(`
          SELECT r.inventory_item_id, i.name, i.unit, r.quantity_per_serving, i.cost_per_unit
          FROM recipes r
          JOIN inventory_items i ON r.inventory_item_id = i.id
          WHERE r.menu_item_id = ?
        `)
        .bind(menuItemId)
        .all<{ inventory_item_id: number; name: string; unit: string; quantity_per_serving: number; cost_per_unit: number }>();

      return result.results.map(row => ({
        inventoryItemId: row.inventory_item_id,
        inventoryItemName: row.name,
        unit: row.unit,
        quantityPerServing: row.quantity_per_serving,
        costPerUnit: row.cost_per_unit,
      }));
    },

    async create(item: { name: string; price: number; locationId?: number }): Promise<number> {
      const result = await db
        .prepare('INSERT INTO menu_items (name, price, location_id) VALUES (?, ?, ?)')
        .bind(item.name, item.price, item.locationId || 1)
        .run();
      return result.meta.last_row_id;
    },

    async setRecipe(menuItemId: number, ingredients: { inventoryItemId: number; quantityPerServing: number }[]): Promise<void> {
      await db.prepare('DELETE FROM recipes WHERE menu_item_id = ?').bind(menuItemId).run();

      for (const ing of ingredients) {
        await db
          .prepare('INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_per_serving) VALUES (?, ?, ?)')
          .bind(menuItemId, ing.inventoryItemId, ing.quantityPerServing)
          .run();
      }
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/menu.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add menu service with recipe management and margin calculation"
```

---

### Task 7: Sales Service

**Files:**
- Create: `src/lib/sales/service.ts`
- Create: `tests/lib/sales.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSalesService } from '../../src/lib/sales/service';

describe('SalesService', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn(),
    first: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordSale inserts sale record', async () => {
    mockDb.run.mockResolvedValue({ success: true, meta: { last_row_id: 1 } });

    const service = createSalesService(mockDb as any);
    const id = await service.recordSale({ menuItemId: 1, quantity: 5, saleDate: '2026-05-06' });

    expect(id).toBe(1);
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sales'));
  });

  it('getSalesWithProfit calculates profit per sale', async () => {
    mockDb.all.mockResolvedValue({
      results: [
        { menu_item_id: 1, menu_item_name: 'Burger', quantity: 10, price: 12.00 },
      ],
    });

    const mockMenuService = {
      getMenuItemWithCost: vi.fn().mockResolvedValue({
        ingredientCost: 2.90,
        margin: 9.10,
      }),
    };

    const service = createSalesService(mockDb as any);
    const sales = await service.getSalesWithProfit('2026-05-06', '2026-05-06', mockMenuService as any);

    expect(sales[0].totalRevenue).toBe(120.00);
    expect(sales[0].totalCost).toBe(29.00);
    expect(sales[0].totalProfit).toBe(91.00);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/sales.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement service**

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { Sale } from '../db/queries';
import type { MenuService } from '../menu/service';

export interface SaleWithProfit {
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface DailySummary {
  date: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  itemCount: number;
}

export interface SalesService {
  recordSale(sale: { menuItemId: number; quantity: number; saleDate: string; locationId?: number }): Promise<number>;
  recordBatch(sales: { menuItemId: number; quantity: number; saleDate: string }[], locationId?: number): Promise<void>;
  getSalesWithProfit(startDate: string, endDate: string, menuService: MenuService, locationId?: number): Promise<SaleWithProfit[]>;
  getDailySummary(startDate: string, endDate: string, menuService: MenuService, locationId?: number): Promise<DailySummary[]>;
}

export function createSalesService(db: D1Database): SalesService {
  return {
    async recordSale(sale): Promise<number> {
      const result = await db
        .prepare('INSERT INTO sales (menu_item_id, quantity, sale_date, location_id) VALUES (?, ?, ?, ?)')
        .bind(sale.menuItemId, sale.quantity, sale.saleDate, sale.locationId || 1)
        .run();
      return result.meta.last_row_id;
    },

    async recordBatch(sales, locationId = 1): Promise<void> {
      for (const sale of sales) {
        await db
          .prepare('INSERT INTO sales (menu_item_id, quantity, sale_date, location_id) VALUES (?, ?, ?, ?)')
          .bind(sale.menuItemId, sale.quantity, sale.saleDate, locationId)
          .run();
      }
    },

    async getSalesWithProfit(startDate, endDate, menuService, locationId = 1): Promise<SaleWithProfit[]> {
      const result = await db
        .prepare(`
          SELECT s.menu_item_id, m.name as menu_item_name, SUM(s.quantity) as quantity, m.price
          FROM sales s
          JOIN menu_items m ON s.menu_item_id = m.id
          WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.location_id = ?
          GROUP BY s.menu_item_id
          ORDER BY SUM(s.quantity) DESC
        `)
        .bind(startDate, endDate, locationId)
        .all<{ menu_item_id: number; menu_item_name: string; quantity: number; price: number }>();

      return Promise.all(result.results.map(async row => {
        const itemWithCost = await menuService.getMenuItemWithCost(row.menu_item_id);
        const totalRevenue = row.quantity * row.price;
        const totalCost = row.quantity * itemWithCost.ingredientCost;
        return {
          menuItemId: row.menu_item_id,
          menuItemName: row.menu_item_name,
          quantity: row.quantity,
          unitPrice: row.price,
          totalRevenue,
          totalCost,
          totalProfit: totalRevenue - totalCost,
        };
      }));
    },

    async getDailySummary(startDate, endDate, menuService, locationId = 1): Promise<DailySummary[]> {
      const result = await db
        .prepare(`
          SELECT s.sale_date, s.menu_item_id, SUM(s.quantity) as quantity, m.price
          FROM sales s
          JOIN menu_items m ON s.menu_item_id = m.id
          WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.location_id = ?
          GROUP BY s.sale_date, s.menu_item_id
          ORDER BY s.sale_date
        `)
        .bind(startDate, endDate, locationId)
        .all<{ sale_date: string; menu_item_id: number; quantity: number; price: number }>();

      const byDate = new Map<string, { revenue: number; cost: number; count: number }>();

      for (const row of result.results) {
        const itemWithCost = await menuService.getMenuItemWithCost(row.menu_item_id);
        const revenue = row.quantity * row.price;
        const cost = row.quantity * itemWithCost.ingredientCost;

        const existing = byDate.get(row.sale_date) || { revenue: 0, cost: 0, count: 0 };
        byDate.set(row.sale_date, {
          revenue: existing.revenue + revenue,
          cost: existing.cost + cost,
          count: existing.count + row.quantity,
        });
      }

      return Array.from(byDate.entries()).map(([date, data]) => ({
        date,
        totalRevenue: data.revenue,
        totalCost: data.cost,
        totalProfit: data.revenue - data.cost,
        itemCount: data.count,
      }));
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/sales.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add sales service with profit calculation"
```

---

## Phase 3: Intelligence Layer (Serial)

### Task 8: Variance Detection Service

**Files:**
- Create: `src/lib/variance/service.ts`
- Create: `tests/lib/variance.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVarianceService } from '../../src/lib/variance/service';

describe('VarianceService', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn(),
    first: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateVariance detects anomaly when variance exceeds threshold', async () => {
    const mockInventoryService = {
      getAll: vi.fn().mockResolvedValue([
        { id: 1, name: 'Eggs', quantity: 80, cost_per_unit: 0.25 },
      ]),
    };

    const mockMenuService = {
      getRecipeIngredients: vi.fn().mockResolvedValue([
        { inventoryItemId: 1, quantityPerServing: 3 },
      ]),
    };

    mockDb.all.mockResolvedValue({
      results: [{ menu_item_id: 1, total_quantity: 10 }],
    });

    mockDb.first
      .mockResolvedValueOnce({ quantity: 100 })
      .mockResolvedValueOnce({ total_purchased: 0 });

    const service = createVarianceService(mockDb as any);
    const results = await service.calculateVariance(
      '2026-05-01',
      '2026-05-06',
      mockInventoryService as any,
      mockMenuService as any
    );

    expect(results[0].inventoryItemId).toBe(1);
    expect(results[0].expectedUsage).toBe(30);
    expect(results[0].actualUsage).toBe(20);
    expect(results[0].isAnomaly).toBe(true);
  });

  it('explainVariance updates variance log with explanation', async () => {
    mockDb.run.mockResolvedValue({ success: true });

    const service = createVarianceService(mockDb as any);
    await service.explainVariance(1, 'waste', 'Eggs spoiled over weekend');

    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE variance_logs')
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/variance.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement service**

```typescript
import type { D1Database } from '@cloudflare/workers-types';
import type { InventoryService } from '../inventory/service';
import type { MenuService } from '../menu/service';
import type { VarianceLog } from '../db/queries';

export interface VarianceResult {
  inventoryItemId: number;
  inventoryItemName: string;
  expectedUsage: number;
  actualUsage: number;
  variancePct: number;
  isAnomaly: boolean;
}

export interface VarianceLogWithItem extends VarianceLog {
  inventoryItemName: string;
}

export const EXPLANATION_TYPES = [
  'waste',
  'staff_meals',
  'overportioning',
  'comped',
  'recipe_inaccurate',
  'theft',
  'miscount',
  'other',
] as const;

export type ExplanationType = typeof EXPLANATION_TYPES[number];

export interface VarianceService {
  calculateVariance(
    startDate: string,
    endDate: string,
    inventoryService: InventoryService,
    menuService: MenuService,
    threshold?: number,
    locationId?: number
  ): Promise<VarianceResult[]>;
  saveVarianceLogs(results: VarianceResult[], startDate: string, endDate: string, locationId?: number): Promise<void>;
  getUnresolvedAnomalies(locationId?: number): Promise<VarianceLogWithItem[]>;
  explainVariance(id: number, explanationType: ExplanationType, explanation: string): Promise<void>;
  getRecipeInaccuracyCount(inventoryItemId: number, days?: number): Promise<number>;
}

export function createVarianceService(db: D1Database): VarianceService {
  return {
    async calculateVariance(startDate, endDate, inventoryService, menuService, threshold = 10, locationId = 1): Promise<VarianceResult[]> {
      const inventoryItems = await inventoryService.getAll(locationId);
      const results: VarianceResult[] = [];

      for (const item of inventoryItems) {
        const salesResult = await db
          .prepare(`
            SELECT s.menu_item_id, SUM(s.quantity) as total_quantity
            FROM sales s
            WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.location_id = ?
            GROUP BY s.menu_item_id
          `)
          .bind(startDate, endDate, locationId)
          .all<{ menu_item_id: number; total_quantity: number }>();

        let expectedUsage = 0;
        for (const sale of salesResult.results) {
          const recipe = await menuService.getRecipeIngredients(sale.menu_item_id);
          const ingredient = recipe.find(r => r.inventoryItemId === item.id);
          if (ingredient) {
            expectedUsage += ingredient.quantityPerServing * sale.total_quantity;
          }
        }

        const startSnapshot = await db
          .prepare(`
            SELECT quantity FROM inventory_items WHERE id = ?
          `)
          .bind(item.id)
          .first<{ quantity: number }>();

        const purchaseResult = await db
          .prepare(`
            SELECT COALESCE(SUM(pi.quantity), 0) as total_purchased
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE pi.inventory_item_id = ? AND p.purchase_date >= ? AND p.purchase_date <= ?
          `)
          .bind(item.id, startDate, endDate)
          .first<{ total_purchased: number }>();

        const startQuantity = startSnapshot?.quantity || 0;
        const purchased = purchaseResult?.total_purchased || 0;
        const endQuantity = item.quantity;
        const actualUsage = startQuantity + purchased - endQuantity;

        const variancePct = expectedUsage > 0 ? Math.abs((actualUsage - expectedUsage) / expectedUsage) * 100 : 0;
        const isAnomaly = variancePct > threshold;

        if (expectedUsage > 0 || actualUsage > 0) {
          results.push({
            inventoryItemId: item.id,
            inventoryItemName: item.name,
            expectedUsage,
            actualUsage,
            variancePct,
            isAnomaly,
          });
        }
      }

      return results;
    },

    async saveVarianceLogs(results, startDate, endDate, locationId = 1): Promise<void> {
      for (const result of results.filter(r => r.isAnomaly)) {
        await db
          .prepare(`
            INSERT INTO variance_logs (inventory_item_id, period_start, period_end, expected_usage, actual_usage, variance_pct, location_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(result.inventoryItemId, startDate, endDate, result.expectedUsage, result.actualUsage, result.variancePct, locationId)
          .run();
      }
    },

    async getUnresolvedAnomalies(locationId = 1): Promise<VarianceLogWithItem[]> {
      const result = await db
        .prepare(`
          SELECT v.*, i.name as inventory_item_name
          FROM variance_logs v
          JOIN inventory_items i ON v.inventory_item_id = i.id
          WHERE v.resolved = 0 AND v.location_id = ?
          ORDER BY v.created_at DESC
        `)
        .bind(locationId)
        .all();
      return result.results as VarianceLogWithItem[];
    },

    async explainVariance(id, explanationType, explanation): Promise<void> {
      await db
        .prepare('UPDATE variance_logs SET explanation = ?, explanation_type = ?, resolved = 1 WHERE id = ?')
        .bind(explanation, explanationType, id)
        .run();
    },

    async getRecipeInaccuracyCount(inventoryItemId, days = 30): Promise<number> {
      const result = await db
        .prepare(`
          SELECT COUNT(*) as count
          FROM variance_logs
          WHERE inventory_item_id = ?
            AND explanation_type = 'recipe_inaccurate'
            AND created_at >= datetime('now', '-' || ? || ' days')
        `)
        .bind(inventoryItemId, days)
        .first<{ count: number }>();
      return result?.count || 0;
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/variance.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add variance detection with anomaly flagging and explanation workflow"
```

---

### Task 9: Scenario Modeling Service

**Files:**
- Create: `src/lib/scenarios/service.ts`
- Create: `tests/lib/scenarios.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createScenarioService } from '../../src/lib/scenarios/service';

describe('ScenarioService', () => {
  it('modelNewMenuItem calculates projected profit', async () => {
    const mockMenuService = {
      getRecipeIngredients: vi.fn().mockResolvedValue([
        { inventoryItemId: 1, quantityPerServing: 2, costPerUnit: 0.25 },
        { inventoryItemId: 2, quantityPerServing: 0.5, costPerUnit: 1.50 },
      ]),
    };

    const service = createScenarioService();
    const result = service.modelNewMenuItem({
      price: 14.00,
      recipe: [
        { inventoryItemId: 1, quantityPerServing: 2, costPerUnit: 0.25 },
        { inventoryItemId: 2, quantityPerServing: 0.5, costPerUnit: 1.50 },
      ],
      estimatedDailySales: 15,
    });

    expect(result.ingredientCost).toBe(1.25);
    expect(result.marginPerItem).toBe(12.75);
    expect(result.marginPercent).toBeCloseTo(91.07, 1);
    expect(result.dailyProfit).toBe(191.25);
  });

  it('modelPriceChange calculates margin impact', () => {
    const service = createScenarioService();
    const result = service.modelPriceChange({
      currentPrice: 12.00,
      newPrice: 14.00,
      ingredientCost: 3.00,
      averageDailySales: 20,
    });

    expect(result.currentMargin).toBe(9.00);
    expect(result.newMargin).toBe(11.00);
    expect(result.dailyProfitChange).toBe(40.00);
  });

  it('modelSupplierSwitch calculates menu-wide impact', () => {
    const service = createScenarioService();
    const result = service.modelSupplierSwitch({
      inventoryItemId: 1,
      currentCostPerUnit: 0.25,
      newCostPerUnit: 0.20,
      affectedMenuItems: [
        { menuItemId: 1, quantityUsed: 3, dailySales: 15, price: 12.00 },
        { menuItemId: 2, quantityUsed: 2, dailySales: 10, price: 10.00 },
      ],
    });

    expect(result.dailySavings).toBe(3.25);
    expect(result.monthlySavings).toBeCloseTo(97.5, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/scenarios.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement service**

```typescript
export interface NewMenuItemInput {
  price: number;
  recipe: { inventoryItemId: number; quantityPerServing: number; costPerUnit: number }[];
  estimatedDailySales: number;
}

export interface NewMenuItemResult {
  ingredientCost: number;
  marginPerItem: number;
  marginPercent: number;
  dailyRevenue: number;
  dailyCost: number;
  dailyProfit: number;
  monthlyProfit: number;
}

export interface PriceChangeInput {
  currentPrice: number;
  newPrice: number;
  ingredientCost: number;
  averageDailySales: number;
}

export interface PriceChangeResult {
  currentMargin: number;
  newMargin: number;
  currentMarginPercent: number;
  newMarginPercent: number;
  dailyProfitChange: number;
  monthlyProfitChange: number;
}

export interface SupplierSwitchInput {
  inventoryItemId: number;
  currentCostPerUnit: number;
  newCostPerUnit: number;
  affectedMenuItems: {
    menuItemId: number;
    quantityUsed: number;
    dailySales: number;
    price: number;
  }[];
}

export interface SupplierSwitchResult {
  costDifference: number;
  dailySavings: number;
  monthlySavings: number;
  affectedItems: {
    menuItemId: number;
    oldIngredientCost: number;
    newIngredientCost: number;
    marginChange: number;
  }[];
}

export interface VolumeChangeInput {
  menuItemId: number;
  currentDailySales: number;
  newDailySales: number;
  price: number;
  ingredientCost: number;
}

export interface VolumeChangeResult {
  revenueChange: number;
  profitChange: number;
  inventoryImpact: number;
}

export interface ScenarioService {
  modelNewMenuItem(input: NewMenuItemInput): NewMenuItemResult;
  modelPriceChange(input: PriceChangeInput): PriceChangeResult;
  modelSupplierSwitch(input: SupplierSwitchInput): SupplierSwitchResult;
  modelVolumeChange(input: VolumeChangeInput): VolumeChangeResult;
}

export function createScenarioService(): ScenarioService {
  return {
    modelNewMenuItem(input): NewMenuItemResult {
      const ingredientCost = input.recipe.reduce(
        (sum, r) => sum + r.quantityPerServing * r.costPerUnit,
        0
      );
      const marginPerItem = input.price - ingredientCost;
      const marginPercent = (marginPerItem / input.price) * 100;
      const dailyRevenue = input.price * input.estimatedDailySales;
      const dailyCost = ingredientCost * input.estimatedDailySales;
      const dailyProfit = marginPerItem * input.estimatedDailySales;

      return {
        ingredientCost,
        marginPerItem,
        marginPercent,
        dailyRevenue,
        dailyCost,
        dailyProfit,
        monthlyProfit: dailyProfit * 30,
      };
    },

    modelPriceChange(input): PriceChangeResult {
      const currentMargin = input.currentPrice - input.ingredientCost;
      const newMargin = input.newPrice - input.ingredientCost;
      const dailyProfitChange = (newMargin - currentMargin) * input.averageDailySales;

      return {
        currentMargin,
        newMargin,
        currentMarginPercent: (currentMargin / input.currentPrice) * 100,
        newMarginPercent: (newMargin / input.newPrice) * 100,
        dailyProfitChange,
        monthlyProfitChange: dailyProfitChange * 30,
      };
    },

    modelSupplierSwitch(input): SupplierSwitchResult {
      const costDifference = input.newCostPerUnit - input.currentCostPerUnit;
      let dailySavings = 0;
      const affectedItems = input.affectedMenuItems.map(item => {
        const oldIngredientCost = item.quantityUsed * input.currentCostPerUnit;
        const newIngredientCost = item.quantityUsed * input.newCostPerUnit;
        const marginChange = (oldIngredientCost - newIngredientCost) * item.dailySales;
        dailySavings += marginChange;
        return {
          menuItemId: item.menuItemId,
          oldIngredientCost,
          newIngredientCost,
          marginChange,
        };
      });

      return {
        costDifference,
        dailySavings,
        monthlySavings: dailySavings * 30,
        affectedItems,
      };
    },

    modelVolumeChange(input): VolumeChangeResult {
      const margin = input.price - input.ingredientCost;
      const volumeDelta = input.newDailySales - input.currentDailySales;
      return {
        revenueChange: input.price * volumeDelta,
        profitChange: margin * volumeDelta,
        inventoryImpact: volumeDelta,
      };
    },
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/scenarios.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scenario modeling for menu items, pricing, and supplier changes"
```

---

## Phase 4: API Routes (Parallel)

> Tasks 10-14 can run in parallel.

### Task 10: Inventory API Routes

**Files:**
- Create: `src/pages/api/inventory/index.ts`
- Create: `src/pages/api/inventory/[id].ts`

- [ ] **Step 1: Create GET /api/inventory**

```typescript
import type { APIRoute } from 'astro';
import { createInventoryService } from '../../../lib/inventory/service';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const service = createInventoryService(db);
  const items = await service.getAll();

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create PUT /api/inventory/[id]**

```typescript
import type { APIRoute } from 'astro';
import { createInventoryService } from '../../../lib/inventory/service';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const service = createInventoryService(db);
  const id = parseInt(params.id!, 10);
  const body = await request.json() as { delta: number; reason?: string };

  await service.adjustQuantity(id, body.delta, body.reason);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 3: Verify routes work**

```bash
npm run dev
# In another terminal:
curl http://localhost:4321/api/inventory
```

Expected: JSON array of inventory items

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add inventory API routes"
```

---

### Task 11: Receipt Scanning API Routes

**Files:**
- Create: `src/pages/api/receipts/scan.ts`
- Create: `src/pages/api/receipts/confirm.ts`

- [ ] **Step 1: Create POST /api/receipts/scan**

```typescript
import type { APIRoute } from 'astro';
import { createAIService } from '../../../lib/ai/service';
import { getInventoryItems } from '../../../lib/db/queries';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const formData = await request.formData();
  const file = formData.get('image') as File;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const key = `receipts/${Date.now()}-${file.name}`;
  await env.IMAGES.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const imageUrl = `${new URL(request.url).origin}/images/${key}`;

  const aiService = createAIService(env.OPENROUTER_API_KEY);
  const parsed = await aiService.parseReceipt(imageUrl);

  const inventoryItems = await getInventoryItems(env.DB);
  const itemsWithMatches = await Promise.all(
    parsed.items.map(async item => {
      const match = await aiService.matchInventoryItem(
        item.name,
        inventoryItems.map(i => ({ id: i.id, name: i.name, unit: i.unit }))
      );
      return {
        ...item,
        matchedInventoryItemId: match.matchedId,
        matchConfidence: match.confidence,
        matchReason: match.reason,
      };
    })
  );

  return new Response(JSON.stringify({
    photoUrl: imageUrl,
    supplier: parsed.supplier,
    items: itemsWithMatches,
    total: parsed.total,
    date: parsed.date,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create POST /api/receipts/confirm**

```typescript
import type { APIRoute } from 'astro';
import { createInventoryService } from '../../../lib/inventory/service';

interface ConfirmItem {
  inventoryItemId: number;
  quantity: number;
  unitCost: number;
}

interface ConfirmBody {
  supplierId: number;
  photoUrl: string;
  items: ConfirmItem[];
  total: number;
  purchaseDate: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const body = await request.json() as ConfirmBody;
  const inventoryService = createInventoryService(db);

  const purchaseResult = await db
    .prepare(`
      INSERT INTO purchases (supplier_id, photo_url, total_cost, purchase_date)
      VALUES (?, ?, ?, ?)
    `)
    .bind(body.supplierId, body.photoUrl, body.total, body.purchaseDate)
    .run();

  const purchaseId = purchaseResult.meta.last_row_id;

  for (const item of body.items) {
    await db
      .prepare(`
        INSERT INTO purchase_items (purchase_id, inventory_item_id, quantity, unit_cost)
        VALUES (?, ?, ?, ?)
      `)
      .bind(purchaseId, item.inventoryItemId, item.quantity, item.unitCost)
      .run();

    await inventoryService.addFromPurchase(item.inventoryItemId, item.quantity, item.unitCost);
  }

  return new Response(JSON.stringify({ success: true, purchaseId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add receipt scanning API with AI parsing and inventory update"
```

---

### Task 12: Menu API Routes

**Files:**
- Create: `src/pages/api/menu/index.ts`

- [ ] **Step 1: Create GET and POST /api/menu**

```typescript
import type { APIRoute } from 'astro';
import { createMenuService } from '../../../lib/menu/service';

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const service = createMenuService(db);
  const items = await service.getAllWithCosts();

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const service = createMenuService(db);
  const body = await request.json() as {
    name: string;
    price: number;
    recipe: { inventoryItemId: number; quantityPerServing: number }[];
  };

  const id = await service.create({ name: body.name, price: body.price });
  await service.setRecipe(id, body.recipe);

  const item = await service.getMenuItemWithCost(id);

  return new Response(JSON.stringify(item), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add menu API routes with recipe and margin support"
```

---

### Task 13: Sales Import API

**Files:**
- Create: `src/pages/api/sales/import.ts`

- [ ] **Step 1: Create POST /api/sales/import**

```typescript
import type { APIRoute } from 'astro';
import { createAIService } from '../../../lib/ai/service';
import { createSalesService } from '../../../lib/sales/service';
import { getMenuItems } from '../../../lib/db/queries';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const csv = formData.get('csv') as File | null;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const key = `pos/${Date.now()}-${file.name}`;
      await env.IMAGES.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      const imageUrl = `${new URL(request.url).origin}/images/${key}`;
      const aiService = createAIService(env.OPENROUTER_API_KEY);
      const parsed = await aiService.parsePOSScreen(imageUrl);

      const menuItems = await getMenuItems(env.DB);
      const salesService = createSalesService(env.DB);

      const matchedSales = parsed.sales.map(sale => {
        const match = menuItems.find(m =>
          m.name.toLowerCase() === sale.menuItem.toLowerCase()
        );
        return {
          menuItemId: match?.id || 0,
          menuItemName: sale.menuItem,
          quantity: sale.quantity,
          matched: !!match,
        };
      });

      const validSales = matchedSales.filter(s => s.matched);
      await salesService.recordBatch(
        validSales.map(s => ({
          menuItemId: s.menuItemId,
          quantity: s.quantity,
          saleDate: parsed.date,
        }))
      );

      return new Response(JSON.stringify({
        imported: validSales.length,
        unmatched: matchedSales.filter(s => !s.matched),
        date: parsed.date,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (csv) {
      const text = await csv.text();
      const lines = text.trim().split('\n').slice(1);
      const salesService = createSalesService(env.DB);
      const menuItems = await getMenuItems(env.DB);

      let imported = 0;
      for (const line of lines) {
        const [menuItemName, quantityStr, date] = line.split(',').map(s => s.trim());
        const menuItem = menuItems.find(m => m.name.toLowerCase() === menuItemName.toLowerCase());
        if (menuItem) {
          await salesService.recordSale({
            menuItemId: menuItem.id,
            quantity: parseInt(quantityStr, 10),
            saleDate: date,
          });
          imported++;
        }
      }

      return new Response(JSON.stringify({ imported }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'No valid file provided' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add sales import API with POS image and CSV support"
```

---

### Task 14: Variance and Scenario APIs

**Files:**
- Create: `src/pages/api/variance/calculate.ts`
- Create: `src/pages/api/variance/[id]/explain.ts`
- Create: `src/pages/api/scenarios/model.ts`

- [ ] **Step 1: Create GET /api/variance/calculate**

```typescript
import type { APIRoute } from 'astro';
import { createVarianceService } from '../../../lib/variance/service';
import { createInventoryService } from '../../../lib/inventory/service';
import { createMenuService } from '../../../lib/menu/service';

export const GET: APIRoute = async ({ url, locals }) => {
  const db = locals.runtime.env.DB;
  const startDate = url.searchParams.get('start') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = url.searchParams.get('end') || new Date().toISOString().split('T')[0];

  const varianceService = createVarianceService(db);
  const inventoryService = createInventoryService(db);
  const menuService = createMenuService(db);

  const results = await varianceService.calculateVariance(
    startDate,
    endDate,
    inventoryService,
    menuService
  );

  await varianceService.saveVarianceLogs(results, startDate, endDate);

  const unresolvedAnomalies = await varianceService.getUnresolvedAnomalies();

  return new Response(JSON.stringify({
    period: { start: startDate, end: endDate },
    results,
    unresolvedCount: unresolvedAnomalies.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create POST /api/variance/[id]/explain**

```typescript
import type { APIRoute } from 'astro';
import { createVarianceService, type ExplanationType } from '../../../../lib/variance/service';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const db = locals.runtime.env.DB;
  const id = parseInt(params.id!, 10);
  const body = await request.json() as { type: ExplanationType; explanation: string };

  const service = createVarianceService(db);
  await service.explainVariance(id, body.type, body.explanation);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 3: Create POST /api/scenarios/model**

```typescript
import type { APIRoute } from 'astro';
import { createScenarioService } from '../../../lib/scenarios/service';
import { createMenuService } from '../../../lib/menu/service';
import { createInventoryService } from '../../../lib/inventory/service';

type ScenarioType = 'new_menu_item' | 'price_change' | 'supplier_switch' | 'volume_change';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const body = await request.json() as { type: ScenarioType; params: Record<string, unknown> };
  const scenarioService = createScenarioService();
  const menuService = createMenuService(db);
  const inventoryService = createInventoryService(db);

  let result: unknown;

  switch (body.type) {
    case 'new_menu_item': {
      const p = body.params as {
        name: string;
        price: number;
        recipe: { inventoryItemId: number; quantityPerServing: number }[];
        estimatedDailySales: number;
      };
      const inventory = await inventoryService.getAll();
      const recipeWithCosts = p.recipe.map(r => {
        const item = inventory.find(i => i.id === r.inventoryItemId);
        return {
          ...r,
          costPerUnit: item?.cost_per_unit || 0,
        };
      });
      result = scenarioService.modelNewMenuItem({
        price: p.price,
        recipe: recipeWithCosts,
        estimatedDailySales: p.estimatedDailySales,
      });
      break;
    }
    case 'price_change': {
      const p = body.params as {
        menuItemId: number;
        newPrice: number;
        averageDailySales: number;
      };
      const item = await menuService.getMenuItemWithCost(p.menuItemId);
      result = scenarioService.modelPriceChange({
        currentPrice: item.price,
        newPrice: p.newPrice,
        ingredientCost: item.ingredientCost,
        averageDailySales: p.averageDailySales,
      });
      break;
    }
    case 'supplier_switch': {
      const p = body.params as {
        inventoryItemId: number;
        newCostPerUnit: number;
        affectedMenuItems: { menuItemId: number; dailySales: number }[];
      };
      const inventory = await inventoryService.getAll();
      const item = inventory.find(i => i.id === p.inventoryItemId);
      const affected = await Promise.all(
        p.affectedMenuItems.map(async am => {
          const menuItem = await menuService.getMenuItemWithCost(am.menuItemId);
          const recipe = await menuService.getRecipeIngredients(am.menuItemId);
          const ingredient = recipe.find(r => r.inventoryItemId === p.inventoryItemId);
          return {
            menuItemId: am.menuItemId,
            quantityUsed: ingredient?.quantityPerServing || 0,
            dailySales: am.dailySales,
            price: menuItem.price,
          };
        })
      );
      result = scenarioService.modelSupplierSwitch({
        inventoryItemId: p.inventoryItemId,
        currentCostPerUnit: item?.cost_per_unit || 0,
        newCostPerUnit: p.newCostPerUnit,
        affectedMenuItems: affected,
      });
      break;
    }
    case 'volume_change': {
      const p = body.params as {
        menuItemId: number;
        currentDailySales: number;
        newDailySales: number;
      };
      const item = await menuService.getMenuItemWithCost(p.menuItemId);
      result = scenarioService.modelVolumeChange({
        menuItemId: p.menuItemId,
        currentDailySales: p.currentDailySales,
        newDailySales: p.newDailySales,
        price: item.price,
        ingredientCost: item.ingredientCost,
      });
      break;
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add variance calculation and scenario modeling APIs"
```

---

## Phase 5: Frontend Components (Parallel)

> **IMPORTANT:** Use `frontend-design:frontend-design` skill for all tasks in this phase.

> Tasks 15-20 can run in parallel.

### Task 15: App Layout with Navigation

**Skill:** `frontend-design:frontend-design`

**Files:**
- Modify: `src/layouts/AppLayout.astro`
- Create: `src/components/Nav.vue`
- Create: `src/components/ScanButton.vue`

**Requirements:**
- Bottom tab navigation with 5 tabs (Dashboard, Inventory, Menu, Sales, Insights)
- Model page accessible from Insights or as a tab
- Floating action button for "Scan Receipt"
- Warm minimal aesthetic with OKLCH colors
- Mobile-first, works on all screen sizes

---

### Task 16: Dashboard Page

**Skill:** `frontend-design:frontend-design`

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/components/DashboardCards.vue`

**Requirements:**
- Today's summary cards: total sales, total cost, gross profit, margin %
- Low stock alerts section
- Unresolved anomalies count with link to Insights
- Recent sales activity
- Warm minimal design

---

### Task 17: Inventory Page with Receipt Scanner

**Skill:** `frontend-design:frontend-design`

**Files:**
- Create: `src/pages/inventory.astro`
- Create: `src/components/InventoryList.vue`
- Create: `src/components/ReceiptScanner.vue`

**Requirements:**
- List of inventory items with quantity, unit, cost, low stock indicator
- Manual quantity adjustment with reason field
- Receipt scanner: camera capture or file upload
- Review parsed items before confirming
- Match inventory items or create new ones

---

### Task 18: Menu Page with Recipe Builder

**Skill:** `frontend-design:frontend-design`

**Files:**
- Create: `src/pages/menu.astro`
- Create: `src/components/MenuEditor.vue`

**Requirements:**
- List of menu items with price, ingredient cost, margin, margin %
- Add new menu item form
- Recipe builder: select inventory items, set quantities
- Live cost/margin calculation as recipe changes

---

### Task 19: Sales Page with Import

**Skill:** `frontend-design:frontend-design`

**Files:**
- Create: `src/pages/sales.astro`
- Create: `src/components/SalesImport.vue`

**Requirements:**
- Date range selector
- Sales breakdown by menu item with profit
- Daily summary chart (simple bar or list)
- Import button: POS screenshot or CSV upload
- Review imported sales before confirming

---

### Task 20: Insights Page with Variance and Scenarios

**Skill:** `frontend-design:frontend-design`

**Files:**
- Create: `src/pages/insights.astro`
- Create: `src/components/VarianceList.vue`
- Create: `src/pages/model.astro`
- Create: `src/components/ScenarioBuilder.vue`

**Requirements for Insights:**
- Variance calculation trigger button
- List of anomalies with explain workflow
- Quick-select explanation types as chips
- "How this works" collapsible explainer

**Requirements for Model:**
- Scenario type selector (new item, price change, supplier, volume)
- Dynamic form based on scenario type
- Results display with projected impact
- Clear, educational UI

---

## Phase 6: PWA Setup (Serial)

### Task 21: PWA Manifest and Service Worker

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/layouts/AppLayout.astro`

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "Restoraunch",
  "short_name": "Restoraunch",
  "description": "Restaurant inventory and profit management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf9f7",
  "theme_color": "#8b7355",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Create basic service worker**

```javascript
const CACHE_NAME = 'restoraunch-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
```

- [ ] **Step 3: Register service worker in layout**

Add to `src/layouts/AppLayout.astro` head:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#8b7355" />
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

- [ ] **Step 4: Create placeholder icons**

```bash
# Create simple placeholder icons (replace with real ones later)
echo "TODO: Add proper icons" > public/icon-192.png
echo "TODO: Add proper icons" > public/icon-512.png
```

- [ ] **Step 5: Create offline page**

Create `public/offline.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Restoraunch</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #faf9f7;
      color: #3d3429;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { margin-bottom: 0.5rem; }
    p { color: #6b5d4d; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're offline</h1>
    <p>Check your connection and try again.</p>
  </div>
</body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest and basic service worker"
```

---

## Phase 7: Integration Testing

### Task 22: End-to-End Verification

**Files:**
- Create: `tests/e2e/flows.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('Restoraunch E2E Flows', () => {
  const BASE_URL = 'http://localhost:4321';

  describe('Inventory Flow', () => {
    it('lists inventory items', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory`);
      expect(res.ok).toBe(true);
      const items = await res.json();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('adjusts inventory quantity', async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: -5, reason: 'Test adjustment' }),
      });
      expect(res.ok).toBe(true);
    });
  });

  describe('Menu Flow', () => {
    it('lists menu items with costs', async () => {
      const res = await fetch(`${BASE_URL}/api/menu`);
      expect(res.ok).toBe(true);
      const items = await res.json();
      expect(items[0]).toHaveProperty('ingredientCost');
      expect(items[0]).toHaveProperty('marginPercent');
    });

    it('creates menu item with recipe', async () => {
      const res = await fetch(`${BASE_URL}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Item',
          price: 10.00,
          recipe: [{ inventoryItemId: 1, quantityPerServing: 2 }],
        }),
      });
      expect(res.status).toBe(201);
      const item = await res.json();
      expect(item.ingredientCost).toBeGreaterThan(0);
    });
  });

  describe('Variance Flow', () => {
    it('calculates variance', async () => {
      const res = await fetch(`${BASE_URL}/api/variance/calculate`);
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('period');
    });
  });

  describe('Scenario Flow', () => {
    it('models new menu item', async () => {
      const res = await fetch(`${BASE_URL}/api/scenarios/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_menu_item',
          params: {
            name: 'Test Dish',
            price: 15.00,
            recipe: [{ inventoryItemId: 1, quantityPerServing: 3 }],
            estimatedDailySales: 10,
          },
        }),
      });
      expect(res.ok).toBe(true);
      const result = await res.json();
      expect(result).toHaveProperty('dailyProfit');
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm run dev &
sleep 5
npx vitest run tests/e2e/flows.test.ts
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: add e2e integration tests for core flows"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] Receipt scanning: Upload test receipt, verify AI extraction, confirm inventory update
- [ ] Menu creation: Add menu item with recipe, verify cost/margin calculation
- [ ] Sales import: Upload POS screenshot, verify sales recorded
- [ ] Variance detection: Create known variance, run calculation, verify flag
- [ ] Scenario modeling: Add hypothetical menu item, verify margin projection
- [ ] Mobile: Test on phone — receipt scanning, navigation, readability
- [ ] PWA: Install on home screen, verify offline page works

---

## Notes

- All frontend tasks (15-20) should use the `frontend-design:frontend-design` skill
- Tasks within the same phase can run in parallel
- OPENROUTER_API_KEY must be set in wrangler.jsonc or .dev.vars for AI features to work
- D1 and R2 bindings are configured for local development via wrangler
