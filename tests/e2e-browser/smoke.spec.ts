import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Restoraunch/);
});

test('navigation works', async ({ page }) => {
  await page.goto('/');

  // Check bottom nav exists
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();

  // Navigate to inventory
  await page.click('text=Inventory');
  await expect(page).toHaveURL(/inventory/);
});
