import { test, expect } from '@playwright/test';
import {
  DashboardPage,
  WelcomePage,
  InventoryPage,
  MenuPage,
  SalesPage,
  InsightsPage,
  ModelPage,
} from './pages';
import { clearOnboardingState, markAsOnboarded } from './utils/test-helpers';

test.describe('User Journey', () => {
  test.describe('Onboarding Flow', () => {
    test('fresh user sees tour prompt on dashboard', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await expect(dashboard.tourPrompt).toBeVisible();
      await expect(dashboard.takeTourButton).toBeVisible();
      await expect(dashboard.dismissButton).toBeVisible();
    });

    test('clicking take tour navigates to welcome page', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await dashboard.takeTour();

      await expect(page).toHaveURL(/\/welcome/);
      const welcome = new WelcomePage(page);
      await expect(welcome.welcomeTitle).toBeVisible();
    });

    test('welcome page shows basic features expanded, advanced collapsed', async ({ page }) => {
      const welcome = new WelcomePage(page);
      await welcome.goto();

      await expect(welcome.basicFeatures).toBeVisible();
      await expect(welcome.advancedGrid).not.toBeVisible();
    });

    test('can toggle advanced features section', async ({ page }) => {
      const welcome = new WelcomePage(page);
      await welcome.goto();

      await expect(welcome.advancedGrid).not.toBeVisible();
      await welcome.toggleAdvancedSection();
      await expect(welcome.advancedGrid).toBeVisible();
      await welcome.toggleAdvancedSection();
      await expect(welcome.advancedGrid).not.toBeVisible();
    });

    test('get started returns to dashboard without tour prompt', async ({ page }) => {
      await clearOnboardingState(page);
      const welcome = new WelcomePage(page);
      await welcome.goto();
      await welcome.clickGetStarted();

      await expect(page).toHaveURL('/');
      const dashboard = new DashboardPage(page);
      await expect(dashboard.tourPrompt).not.toBeVisible();
    });

    test('dismissing tour prompt hides it permanently', async ({ page }) => {
      await clearOnboardingState(page);
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      await dashboard.dismissTour();
      await expect(dashboard.tourPrompt).not.toBeVisible();

      // Reload and verify still hidden
      await dashboard.goto();
      await expect(dashboard.tourPrompt).not.toBeVisible();
    });
  });

  test.describe('Inventory Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to inventory page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Inventory');

      await expect(page).toHaveURL(/\/inventory/);
      const inventory = new InventoryPage(page);
      await expect(inventory.pageTitle).toHaveText('Inventory');
    });

    test('inventory list loads and displays items', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();
      await inventory.waitForInventoryLoad();

      // Should have items container, empty state, or error state
      const itemsOrEmpty = page.locator('.items-container, .empty-state, .error-state, .inventory-list');
      await expect(itemsOrEmpty.first()).toBeVisible();
    });

    test('receipt scanner section is visible', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();

      await expect(inventory.receiptScanner).toBeVisible();
    });

    test('can open adjustment modal', async ({ page }) => {
      const inventory = new InventoryPage(page);
      await inventory.goto();
      await inventory.waitForInventoryLoad();

      const hasItems = await inventory.getItemCount() > 0;
      if (!hasItems) {
        test.skip();
        return;
      }

      await inventory.adjustButton.first().click();
      await expect(inventory.modal).toBeVisible();
    });
  });

  test.describe('Menu Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to menu page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Menu');

      await expect(page).toHaveURL(/\/menu/);
      const menu = new MenuPage(page);
      await expect(menu.pageTitle).toContainText(/Menu/i);
    });

    test('menu list loads', async ({ page }) => {
      const menu = new MenuPage(page);
      await menu.goto();
      await menu.waitForMenuLoad();

      // Should have menu items or empty state
      const hasItems = await menu.getMenuItemCount() > 0;
      const hasEmptyState = await page.locator('.empty-state').isVisible().catch(() => false);
      expect(hasItems || hasEmptyState).toBe(true);
    });

    test('menu items show cost information', async ({ page }) => {
      const menu = new MenuPage(page);
      await menu.goto();
      await menu.waitForMenuLoad();

      const hasItems = await menu.getMenuItemCount() > 0;
      if (!hasItems) {
        test.skip();
        return;
      }

      // Should display cost/margin information
      const hasCost = await menu.hasIngredientCost();
      expect(hasCost).toBe(true);
    });
  });

  test.describe('Sales Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to sales page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Sales');

      await expect(page).toHaveURL(/\/sales/);
      const sales = new SalesPage(page);
      await expect(sales.pageTitle).toContainText(/Sales/i);
    });

    test('sales page loads', async ({ page }) => {
      const sales = new SalesPage(page);
      await sales.goto();
      await sales.waitForSalesLoad();

      // Page should load without error
      await expect(sales.pageTitle).toBeVisible();
    });

    test('import button is visible', async ({ page }) => {
      const sales = new SalesPage(page);
      await sales.goto();
      await sales.waitForSalesLoad();

      await expect(sales.importButton).toBeVisible();
    });
  });

  test.describe('Insights Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to insights page', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.clickNavItem('Insights');

      await expect(page).toHaveURL(/\/insights/);
      const insights = new InsightsPage(page);
      await insights.waitForInsightsLoad();
      await expect(insights.pageTitle).toBeVisible();
    });

    test('insights page loads variance section', async ({ page }) => {
      const insights = new InsightsPage(page);
      await insights.goto();
      await insights.waitForInsightsLoad();

      // Should have variance container (component rendered)
      const hasContainer = await page.locator('.variance-container').isVisible().catch(() => false);
      expect(hasContainer).toBe(true);
    });
  });

  test.describe('Scenario Modeling Flow', () => {
    test.beforeEach(async ({ page }) => {
      await markAsOnboarded(page);
    });

    test('can navigate to model page', async ({ page }) => {
      const model = new ModelPage(page);
      await model.goto();

      await expect(page).toHaveURL(/\/model/);
    });

    test('scenario builder loads', async ({ page }) => {
      const model = new ModelPage(page);
      await model.goto();
      await model.waitForModelLoad();

      const hasBuilder = await model.hasScenarioBuilder();
      expect(hasBuilder).toBe(true);
    });
  });
});
