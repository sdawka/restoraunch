import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';
import { WelcomePage } from './pages/welcome.page';
import { InventoryPage } from './pages/inventory.page';
import { MenuPage } from './pages/menu.page';
import { SalesPage } from './pages/sales.page';
import { InsightsPage } from './pages/insights.page';
import { ModelPage } from './pages/model.page';
import { clearOnboardingState, markAsOnboarded, waitForLoadingComplete } from './utils/test-helpers';

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
});
