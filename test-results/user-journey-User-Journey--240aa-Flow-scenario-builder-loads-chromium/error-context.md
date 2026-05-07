# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Scenario Modeling Flow >> scenario builder loads
- Location: tests/e2e-browser/user-journey.spec.ts:249:5

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
> 255 |       expect(hasBuilder).toBe(true);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  256 |     });
  257 |   });
  258 | });
  259 | 
```