# Restoraunch: Restaurant Inventory & Profit Modeling App

## Context

Restaurant operators currently track inventory only at aggregate level for tax purposes. There's no connection between what's purchased (receipts), what's sold (POS), and what's in the menu (recipes in people's heads). This makes it impossible to know true profit per item, spot waste/theft, or model the impact of menu changes.

Restoraunch closes this loop: scan receipts → define recipes → import sales → calculate real margins and flag anomalies.

## Users

- **Owners/Operators**: Strategic view — profitability, scenario modeling, supplier comparison
- **Kitchen Managers/Staff**: Operational view — inventory levels, what's running low, quick input

Both share the same access level (no permissions complexity). User accounts exist for audit trails.

## Core Features

### 1. Receipt Scanning (Inventory In)
- Take photo of receipt
- AI extracts: line items, quantities, costs, supplier
- Smart matching to existing inventory items ("EGGS LRG 30CT" → "Eggs (large)")
- User reviews and confirms before inventory updates

### 2. Menu & Recipe Builder
- Define menu items with selling price
- Attach recipe: list of inventory items with quantities per serving
- System calculates ingredient cost and margin per item
- Recipes can be rough — system refines based on actual consumption

### 3. POS Integration (Sales In)
- **Photo of POS screen**: AI extracts sales data (most flexible, works with any POS)
- **CSV upload**: Universal fallback for bulk import
- Abstracted interface designed to support direct API integrations later (TouchBistro, Square, etc.)

### 4. Variance Detection & Anomalies
- **Calculation**: Expected usage (sales × recipes) vs Actual usage (inventory delta + purchases)
- **Period**: Daily by default, can run weekly summary
- **Threshold**: Flag when variance exceeds configurable % (default: 10%)
- **Explanation workflow**: Quick-select reasons (waste, staff meals, overportioning, comped, recipe inaccurate, theft, miscount, custom note)
- **Learning**: If "recipe inaccurate" selected repeatedly, prompt to update recipe
- **UI includes explainer**: Users understand what variance means and how it's calculated

### 5. Scenario Modeling
- **New menu item**: Define recipe + price + estimated sales → projected margin
- **Price change**: Adjust price → see margin impact
- **Supplier switch**: Compare costs → see menu-wide effect
- **Volume change**: "What if X drops 20%?" → revenue/inventory impact

### 6. Insights (Partially Stubbed)
- Dashboard: Today's sales, costs, margin, anomalies flagged, low stock
- Trends over time
- **Stubbed for v2**: Market intelligence, demand suggestions, customer polls

## Data Model

| Entity | Purpose |
|--------|---------|
| `inventory_items` | What you stock — name, current quantity, unit, cost per unit |
| `purchases` | Receipt records — links to items, cost, supplier, date, photo URL |
| `menu_items` | What you sell — name, price |
| `recipes` | Join table: menu item → inventory item with quantity per serving |
| `sales` | From POS — menu item, quantity, timestamp |
| `variance_logs` | Expected vs actual, explanation, resolved status |
| `suppliers` | Name, contact, for cost comparison |
| `locations` | (Multi-location ready, single location for v1) |

## Technical Architecture

### Stack
- **Astro 6**: Server-rendered pages, Vue islands for interactivity
- **Cloudflare Workers**: API routes, edge deployment
- **D1 (SQLite)**: All relational data
- **R2**: Receipt/POS image storage
- **OpenRouter**: AI vision (Claude) for image parsing, wrapped in abstraction layer for future provider swap
- **Tailwind v4**: OKLCH color system for theming, mobile-first

### Key API Routes
```
POST /api/receipts/scan      → upload image, AI extract, return parsed items
POST /api/receipts/confirm   → confirm parsed items, update inventory
POST /api/sales/import       → upload POS data (image, CSV, or API)
GET  /api/inventory          → current stock levels
PUT  /api/inventory/:id      → adjust quantity, add explanation
GET  /api/menu               → menu items with recipes and margins
POST /api/menu               → create menu item with recipe
GET  /api/variance/calculate → run variance analysis for period
POST /api/variance/:id/explain → add explanation to anomaly
POST /api/scenarios/model    → run what-if calculation
```

### AI Service Abstraction
```typescript
interface AIService {
  parseReceipt(imageUrl: string): Promise<ParsedReceipt>
  parsePOSScreen(imageUrl: string): Promise<ParsedSales>
  matchInventoryItem(text: string, existing: InventoryItem[]): Promise<InventoryItem | null>
}
```
Initial implementation: direct OpenRouter calls. Can swap to Cloudflare AI Gateway or Workers AI later.

## Screens

1. **Dashboard**: Today's snapshot — sales, costs, margin, anomaly alerts, low stock warnings
2. **Inventory**: Current stock, add via receipt photo, manual adjustments, supplier info
3. **Menu**: Items with recipes, cost per item, margin %, edit recipes
4. **Sales**: Import from POS, daily/weekly view, profit per item breakdown
5. **Insights**: Variance analysis, anomaly flags needing explanation, trends (+ stubbed market intelligence)
6. **Model**: What-if scenario builder

**Mobile**: Bottom tab navigation (5 tabs — Dashboard/Insights combined), floating "Scan Receipt" button.

## Visual Design

- **Style**: Warm and minimal — approachable, not clinical
- **Colors**: OKLCH color system for consistent theming and future theme support
- **Mobile-first**: Works in kitchen (quick input), back office (analysis), on-the-go (checking numbers)

## PWA Features

- Installable on home screen
- Offline viewing of last-synced data
- Camera access for receipt scanning
- Push notifications for anomaly alerts (stubbed)

## Verification Plan

1. **Receipt scanning**: Upload test receipt photo, verify AI extraction, confirm inventory update
2. **Menu creation**: Add menu item with recipe, verify cost calculation
3. **Sales import**: Upload POS screenshot, verify sales recorded
4. **Variance detection**: Create known variance (adjust inventory manually), run calculation, verify flag
5. **Scenario modeling**: Add hypothetical menu item, verify margin projection
6. **Mobile**: Test on phone — receipt scanning, navigation, readability

## Out of Scope for v1

- Multi-location UI (data model ready, UI deferred)
- TouchBistro API integration (photo/CSV import only)
- Market intelligence and demand suggestions (UI stubbed)
- Customer polls
- Push notifications
- Granular permissions
