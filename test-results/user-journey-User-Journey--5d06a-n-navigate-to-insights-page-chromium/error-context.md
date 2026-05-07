# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Insights Flow >> can navigate to insights page
- Location: tests/e2e-browser/user-journey.spec.ts:214:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/insights/
Received string:  "https://many-sunbird-48.accounts.dev/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finsights"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    3 × unexpected value "https://many-sunbird-48.accounts.dev/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finsights&__clerk_db_jwt=dvb_3DNOVCy2baFjJN0lsVe6elL89G2"
    6 × unexpected value "https://many-sunbird-48.accounts.dev/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finsights"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e9]:
        - heading "Sign in to Restoraunch" [level=1] [ref=e10]
        - paragraph [ref=e11]: Welcome back! Please sign in to continue
      - generic [ref=e12]:
        - generic [ref=e14]:
          - button "Sign in with Apple Apple" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]:
              - generic "Sign in with Apple" [ref=e18]
              - generic [ref=e19]: Apple
          - button "Sign in with Google Google" [ref=e20] [cursor=pointer]:
            - generic [ref=e21]:
              - generic "Sign in with Google" [ref=e23]
              - generic [ref=e24]: Google
        - paragraph [ref=e27]: or
        - generic [ref=e29]:
          - generic [ref=e30]:
            - generic [ref=e33]:
              - generic [ref=e35]: Email address
              - textbox "Email address" [ref=e36]:
                - /placeholder: Enter your email address
            - generic:
              - generic:
                - generic:
                  - generic:
                    - generic: Password
                  - generic:
                    - textbox "Password":
                      - /placeholder: Enter your password
                    - button "Show password":
                      - img
          - button "Continue" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]:
              - text: Continue
              - img [ref=e41]
    - generic [ref=e43]:
      - generic [ref=e44]:
        - generic [ref=e45]: Don’t have an account?
        - link "Sign up" [ref=e46] [cursor=pointer]:
          - /url: https://many-sunbird-48.accounts.dev/sign-up#/?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finsights
      - generic [ref=e48]:
        - generic [ref=e50]:
          - paragraph [ref=e51]: Secured by
          - link "Clerk logo" [ref=e52] [cursor=pointer]:
            - /url: https://go.clerk.com/components
            - img [ref=e53]
        - paragraph [ref=e58]: Development mode
  - alert [ref=e59]
```

# Test source

```ts
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
  154 |       expect(hasItems || hasEmptyState).toBe(true);
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
> 219 |       await expect(page).toHaveURL(/\/insights/);
      |                          ^ Error: expect(page).toHaveURL(expected) failed
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
  255 |       expect(hasBuilder).toBe(true);
  256 |     });
  257 |   });
  258 | });
  259 | 
```