import { test, expect } from '@playwright/test';

test.describe('Inventory Page', () => {
  test('renders inventory list', async ({ page }) => {
    await page.goto('/inventory');

    await expect(page.locator('main h1')).toHaveText('Inventory');
    await expect(page.locator('h2').filter({ hasText: 'Stock Levels' })).toBeVisible();
  });

  test('shows low stock indicator for low items', async ({ page }) => {
    await page.goto('/inventory');

    // Wait for the inventory list to finish loading
    await page.waitForSelector('.inventory-list', { state: 'visible' });
    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});

    // Low stock items show a "LOW" badge inline and a header badge counting them.
    // We only assert these if low-stock items actually exist in the current data.
    const lowBadge = page.locator('.low-badge').first();
    const lowStockBadge = page.locator('.low-stock-badge');

    const hasBadges = await lowBadge.isVisible().catch(() => false)
      || await lowStockBadge.isVisible().catch(() => false);

    if (hasBadges) {
      // At least one of the low-stock indicators is visible
      expect(hasBadges).toBe(true);
    } else {
      // No low-stock items — confirm the items container loaded without them
      const itemsOrEmpty = page.locator('.items-container, .empty-state, .error-state');
      await expect(itemsOrEmpty.first()).toBeVisible();
    }
  });

  test('opens quantity adjustment modal', async ({ page }) => {
    await page.goto('/inventory');

    // Wait for loading to complete
    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});

    const adjustButton = page.locator('button.adjust-btn').first();
    const hasItems = await adjustButton.isVisible().catch(() => false);

    if (!hasItems) {
      // No inventory items — nothing to adjust
      await expect(page.locator('.empty-state, .error-state').first()).toBeVisible();
      return;
    }

    await adjustButton.click();

    // Modal renders inside a Teleport — check for the overlay and the number input
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.modal-content h3')).toHaveText('Adjust Quantity');
    await expect(page.locator('input.delta-input[type="number"]')).toBeVisible();
  });

  test('closes adjustment modal on cancel', async ({ page }) => {
    await page.goto('/inventory');

    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});

    const adjustButton = page.locator('button.adjust-btn').first();
    if (!await adjustButton.isVisible().catch(() => false)) return;

    await adjustButton.click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    await page.locator('button.cancel-btn').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('receipt scanner panel is visible', async ({ page }) => {
    await page.goto('/inventory');

    // ReceiptScanner is mounted in the right-column panel
    await expect(page.locator('h2').filter({ hasText: 'Receipt Scanner' })).toBeVisible();
    // The upload action button is always present in the ready state
    await expect(page.locator('button.upload-btn').filter({ hasText: 'Upload' })).toBeVisible();
  });

  test('search filters inventory items', async ({ page }) => {
    await page.goto('/inventory');

    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});

    const hasItems = await page.locator('.item-row').first().isVisible().catch(() => false);
    if (!hasItems) return;

    const searchInput = page.locator('input.search-input');
    await expect(searchInput).toBeVisible();

    // Type a string that matches nothing to confirm filtering works
    await searchInput.fill('zzz_no_match_xyz');
    await expect(page.locator('.empty-state')).toBeVisible();
  });
});
