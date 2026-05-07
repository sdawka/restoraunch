# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Menu Flow >> menu list loads
- Location: tests/e2e-browser/user-journey.spec.ts:146:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- alert [ref=e4]
```

# Test source

```ts
  54  |     });
  55  | 
  56  |     test('get started returns to dashboard without tour prompt', async ({ page }) => {
  57  |       await clearOnboardingState(page);
  58  |       const welcome = new WelcomePage(page);
  59  |       await welcome.goto();
  60  |       await welcome.clickGetStarted();
  61  | 
  62  |       await expect(page).toHaveURL('/');
  63  |       const dashboard = new DashboardPage(page);
  64  |       await expect(dashboard.tourPrompt).not.toBeVisible();
  65  |     });
  66  | 
  67  |     test('dismissing tour prompt hides it permanently', async ({ page }) => {
  68  |       await clearOnboardingState(page);
  69  |       const dashboard = new DashboardPage(page);
  70  |       await dashboard.goto();
  71  | 
  72  |       await dashboard.dismissTour();
  73  |       await expect(dashboard.tourPrompt).not.toBeVisible();
  74  | 
  75  |       // Reload and verify still hidden
  76  |       await dashboard.goto();
  77  |       await expect(dashboard.tourPrompt).not.toBeVisible();
  78  |     });
  79  |   });
  80  | 
  81  |   test.describe('Inventory Flow', () => {
  82  |     test.beforeEach(async ({ page }) => {
  83  |       await setupAuthenticatedSession(page);
  84  |       await markAsOnboarded(page);
  85  |     });
  86  | 
  87  |     test('can navigate to inventory page', async ({ page }) => {
  88  |       const dashboard = new DashboardPage(page);
  89  |       await dashboard.goto();
  90  |       await dashboard.clickNavItem('Inventory');
  91  | 
  92  |       await expect(page).toHaveURL(/\/inventory/);
  93  |       const inventory = new InventoryPage(page);
  94  |       await expect(inventory.pageTitle).toHaveText('Inventory');
  95  |     });
  96  | 
  97  |     test('inventory list loads and displays items', async ({ page }) => {
  98  |       const inventory = new InventoryPage(page);
  99  |       await inventory.goto();
  100 |       await inventory.waitForInventoryLoad();
  101 | 
  102 |       // Should have items container, empty state, or error state
  103 |       const itemsOrEmpty = page.locator('.items-container, .empty-state, .error-state, .inventory-list');
  104 |       await expect(itemsOrEmpty.first()).toBeVisible();
  105 |     });
  106 | 
  107 |     test('receipt scanner section is visible', async ({ page }) => {
  108 |       const inventory = new InventoryPage(page);
  109 |       await inventory.goto();
  110 | 
  111 |       await expect(inventory.receiptScanner).toBeVisible();
  112 |     });
  113 | 
  114 |     test('can open adjustment modal', async ({ page }) => {
  115 |       const inventory = new InventoryPage(page);
  116 |       await inventory.goto();
  117 |       await inventory.waitForInventoryLoad();
  118 | 
  119 |       const hasItems = await inventory.getItemCount() > 0;
  120 |       if (!hasItems) {
  121 |         test.skip();
  122 |         return;
  123 |       }
  124 | 
  125 |       await inventory.adjustButton.first().click();
  126 |       await expect(inventory.modal).toBeVisible();
  127 |     });
  128 |   });
  129 | 
  130 |   test.describe('Menu Flow', () => {
  131 |     test.beforeEach(async ({ page }) => {
  132 |       await setupAuthenticatedSession(page);
  133 |       await markAsOnboarded(page);
  134 |     });
  135 | 
  136 |     test('can navigate to menu page', async ({ page }) => {
  137 |       const dashboard = new DashboardPage(page);
  138 |       await dashboard.goto();
  139 |       await dashboard.clickNavItem('Menu');
  140 | 
  141 |       await expect(page).toHaveURL(/\/menu/);
  142 |       const menu = new MenuPage(page);
  143 |       await expect(menu.pageTitle).toContainText(/Menu/i);
  144 |     });
  145 | 
  146 |     test('menu list loads', async ({ page }) => {
  147 |       const menu = new MenuPage(page);
  148 |       await menu.goto();
  149 |       await menu.waitForMenuLoad();
  150 | 
  151 |       // Should have menu items or empty state
  152 |       const hasItems = await menu.getMenuItemCount() > 0;
  153 |       const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
> 154 |       expect(hasItems || hasEmptyState).toBe(true);
      |                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  155 |     });
  156 | 
  157 |     test('menu items show cost information', async ({ page }) => {
  158 |       const menu = new MenuPage(page);
  159 |       await menu.goto();
  160 |       await menu.waitForMenuLoad();
  161 | 
  162 |       const hasItems = await menu.getMenuItemCount() > 0;
  163 |       if (!hasItems) {
  164 |         test.skip();
  165 |         return;
  166 |       }
  167 | 
  168 |       // Should display cost/margin information
  169 |       const hasCost = await menu.hasIngredientCost();
  170 |       expect(hasCost).toBe(true);
  171 |     });
  172 |   });
  173 | 
  174 |   test.describe('Sales Flow', () => {
  175 |     test.beforeEach(async ({ page }) => {
  176 |       await setupAuthenticatedSession(page);
  177 |       await markAsOnboarded(page);
  178 |     });
  179 | 
  180 |     test('can navigate to sales page', async ({ page }) => {
  181 |       const dashboard = new DashboardPage(page);
  182 |       await dashboard.goto();
  183 |       await dashboard.clickNavItem('Sales');
  184 | 
  185 |       await expect(page).toHaveURL(/\/sales/);
  186 |       const sales = new SalesPage(page);
  187 |       await expect(sales.pageTitle).toContainText(/Sales/i);
  188 |     });
  189 | 
  190 |     test('sales page loads', async ({ page }) => {
  191 |       const sales = new SalesPage(page);
  192 |       await sales.goto();
  193 |       await sales.waitForSalesLoad();
  194 | 
  195 |       // Page should load without error
  196 |       await expect(sales.pageTitle).toBeVisible();
  197 |     });
  198 | 
  199 |     test('import button is visible', async ({ page }) => {
  200 |       const sales = new SalesPage(page);
  201 |       await sales.goto();
  202 |       await sales.waitForSalesLoad();
  203 | 
  204 |       await expect(sales.importButton).toBeVisible();
  205 |     });
  206 |   });
  207 | 
  208 |   test.describe('Insights Flow', () => {
  209 |     test.beforeEach(async ({ page }) => {
  210 |       await setupAuthenticatedSession(page);
  211 |       await markAsOnboarded(page);
  212 |     });
  213 | 
  214 |     test('can navigate to insights page', async ({ page }) => {
  215 |       const dashboard = new DashboardPage(page);
  216 |       await dashboard.goto();
  217 |       await dashboard.clickNavItem('Insights');
  218 | 
  219 |       await expect(page).toHaveURL(/\/insights/);
  220 |       const insights = new InsightsPage(page);
  221 |       await insights.waitForInsightsLoad();
  222 |       await expect(insights.pageTitle).toBeVisible();
  223 |     });
  224 | 
  225 |     test('insights page loads variance section', async ({ page }) => {
  226 |       const insights = new InsightsPage(page);
  227 |       await insights.goto();
  228 |       await insights.waitForInsightsLoad();
  229 | 
  230 |       // Should have variance container (component rendered)
  231 |       const hasContainer = await page.locator('.variance-container').isVisible().catch(() => false);
  232 |       expect(hasContainer).toBe(true);
  233 |     });
  234 |   });
  235 | 
  236 |   test.describe('Scenario Modeling Flow', () => {
  237 |     test.beforeEach(async ({ page }) => {
  238 |       await setupAuthenticatedSession(page);
  239 |       await markAsOnboarded(page);
  240 |     });
  241 | 
  242 |     test('can navigate to model page', async ({ page }) => {
  243 |       const model = new ModelPage(page);
  244 |       await model.goto();
  245 | 
  246 |       await expect(page).toHaveURL(/\/model/);
  247 |     });
  248 | 
  249 |     test('scenario builder loads', async ({ page }) => {
  250 |       const model = new ModelPage(page);
  251 |       await model.goto();
  252 |       await model.waitForModelLoad();
  253 | 
  254 |       const hasBuilder = await model.hasScenarioBuilder();
```