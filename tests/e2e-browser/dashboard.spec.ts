import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('renders summary cards', async ({ page }) => {
    await page.goto('/');

    // Check for metric cards (sales, cost, profit, margin)
    await expect(page.locator('text=Sales')).toBeVisible();
    await expect(page.locator('text=Profit')).toBeVisible();
  });

  test('shows low stock alerts section', async ({ page }) => {
    await page.goto('/');

    // Look for low stock section
    await expect(page.locator('text=/low stock/i')).toBeVisible();
  });

  test('navigates to inventory page', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Inventory');
    await expect(page).toHaveURL(/inventory/);
  });

  test('navigates to menu page', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Menu');
    await expect(page).toHaveURL(/menu/);
  });
});
