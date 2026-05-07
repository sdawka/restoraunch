# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User Journey >> Onboarding Flow >> can toggle advanced features section
- Location: tests/e2e-browser/user-journey.spec.ts:45:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('[data-testid="advanced-grid"]')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid="advanced-grid"]')
    9 × locator resolved to <div data-v-43c1a4f5="" class="features-grid" data-testid="advanced-grid">…</div>
      - unexpected value "hidden"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: R
      - heading "Welcome to Restoraunch" [level=1] [ref=e6]
      - paragraph [ref=e7]: Track inventory, manage costs, and boost your restaurant's profitability
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "Core Features" [level=2] [ref=e11]
        - generic [ref=e12]:
          - button "Dashboard See today's sales, costs, and alerts at a glance" [ref=e13] [cursor=pointer]:
            - img [ref=e15]
            - generic [ref=e20]:
              - generic [ref=e21]: Dashboard
              - generic [ref=e22]: See today's sales, costs, and alerts at a glance
            - img [ref=e23]
          - button "Inventory Track ingredients and supplies with real-time stock levels" [ref=e25] [cursor=pointer]:
            - img [ref=e27]
            - generic [ref=e30]:
              - generic [ref=e31]: Inventory
              - generic [ref=e32]: Track ingredients and supplies with real-time stock levels
            - img [ref=e33]
          - button "Menu Create menu items with recipes and automatic cost calculation" [ref=e35] [cursor=pointer]:
            - img [ref=e37]
            - generic [ref=e41]:
              - generic [ref=e42]: Menu
              - generic [ref=e43]: Create menu items with recipes and automatic cost calculation
            - img [ref=e44]
          - button "Sales Import POS data or enter sales manually" [ref=e46] [cursor=pointer]:
            - img [ref=e48]
            - generic [ref=e50]:
              - generic [ref=e51]: Sales
              - generic [ref=e52]: Import POS data or enter sales manually
            - img [ref=e53]
      - button "Advanced Features" [active] [ref=e56] [cursor=pointer]:
        - generic [ref=e57]:
          - img [ref=e58]
          - text: Advanced Features
        - img [ref=e60]
      - button "Get Started" [ref=e63] [cursor=pointer]:
        - text: Get Started
        - img [ref=e64]
  - generic [ref=e68]:
    - button "Menu" [ref=e69]:
      - img [ref=e71]
      - generic: Menu
    - button "Inspect" [ref=e75]:
      - img [ref=e77]
      - generic: Inspect
    - button "Audit" [ref=e79]:
      - img [ref=e81]
      - generic: Audit
    - button "Settings" [ref=e84]:
      - img [ref=e86]
      - generic: Settings
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import {
  3   |   DashboardPage,
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
> 51  |       await expect(welcome.advancedGrid).toBeVisible();
      |                                          ^ Error: expect(locator).toBeVisible() failed
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
```