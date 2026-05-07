# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Inventory Flow >> inventory list loads and displays items
- Location: tests/e2e-browser/user-journey.spec.ts:97:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.items-container, .empty-state, .error-state, .inventory-list').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.items-container, .empty-state, .error-state, .inventory-list').first()

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
          - /url: https://many-sunbird-48.accounts.dev/sign-up#/?redirect_url=http%3A%2F%2Flocalhost%3A4321%2Finventory
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
  4   |   WelcomePage,
  5   |   InventoryPage,
  6   |   MenuPage,
  7   |   SalesPage,
  8   |   InsightsPage,
  9   |   ModelPage,
  10  | } from './pages';
  11  | import { clearOnboardingState, markAsOnboarded, setupAuthenticatedSession } from './utils/test-helpers';
  12  | 
  13  | test.describe('User Journey', () => {
  14  |   test.describe('Onboarding Flow', () => {
  15  |     test('fresh user sees tour prompt on dashboard', async ({ page }) => {
  16  |       await clearOnboardingState(page);
  17  |       const dashboard = new DashboardPage(page);
  18  |       await dashboard.goto();
  19  | 
  20  |       await expect(dashboard.tourPrompt).toBeVisible();
  21  |       await expect(dashboard.takeTourButton).toBeVisible();
  22  |       await expect(dashboard.dismissButton).toBeVisible();
  23  |     });
  24  | 
  25  |     test('clicking take tour navigates to welcome page', async ({ page }) => {
  26  |       await clearOnboardingState(page);
  27  |       const dashboard = new DashboardPage(page);
  28  |       await dashboard.goto();
  29  | 
  30  |       await dashboard.takeTour();
  31  | 
  32  |       await expect(page).toHaveURL(/\/welcome/);
  33  |       const welcome = new WelcomePage(page);
  34  |       await expect(welcome.welcomeTitle).toBeVisible();
  35  |     });
  36  | 
  37  |     test('welcome page shows basic features expanded, advanced collapsed', async ({ page }) => {
  38  |       const welcome = new WelcomePage(page);
  39  |       await welcome.goto();
  40  | 
  41  |       await expect(welcome.basicFeatures).toBeVisible();
  42  |       await expect(welcome.advancedGrid).not.toBeVisible();
  43  |     });
  44  | 
  45  |     test('can toggle advanced features section', async ({ page }) => {
  46  |       const welcome = new WelcomePage(page);
  47  |       await welcome.goto();
  48  | 
  49  |       await expect(welcome.advancedGrid).not.toBeVisible();
  50  |       await welcome.toggleAdvancedSection();
  51  |       await expect(welcome.advancedGrid).toBeVisible();
  52  |       await welcome.toggleAdvancedSection();
  53  |       await expect(welcome.advancedGrid).not.toBeVisible();
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
> 104 |       await expect(itemsOrEmpty.first()).toBeVisible();
      |                                          ^ Error: expect(locator).toBeVisible() failed
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
```