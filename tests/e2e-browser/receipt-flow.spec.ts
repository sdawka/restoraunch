import { test, expect, Page } from '@playwright/test';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createQAAuthHeader } from '../../src/lib/auth/qa-bypass';
import { QA_TEST_USERS } from '../qa/client';

const RECEIPT_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/receipts/IMG_2156.jpeg');

// Load QA bypass secret from .dev.vars
function loadQASecret(): string {
  const devVarsPath = resolve(process.cwd(), '.dev.vars');
  try {
    const content = readFileSync(devVarsPath, 'utf-8');
    for (const line of content.split('\n')) {
      const [key, ...valueParts] = line.split('=');
      if (key?.trim() === 'QA_AUTH_BYPASS_SECRET') {
        return valueParts.join('=').trim();
      }
    }
  } catch {
    // Fall through to error
  }
  throw new Error('QA_AUTH_BYPASS_SECRET not found in .dev.vars');
}

async function setupQAAuth(page: Page): Promise<void> {
  const secret = loadQASecret();
  const user = QA_TEST_USERS.admin;
  const authHeader = await createQAAuthHeader(
    {
      userId: user.userId,
      locationId: user.locationId,
      role: user.role,
    },
    secret,
    60
  );

  // Set extra HTTP headers for all requests in this context
  await page.setExtraHTTPHeaders({
    'X-QA-Auth': authHeader,
  });
}

test.describe('Receipt Scanner Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupQAAuth(page);
  });

  test('complete receipt scan and inventory update workflow', async ({ page }) => {
    // 1. Navigate to inventory page
    await page.goto('/inventory');
    await expect(page.locator('main h1')).toHaveText('Inventory');

    // Wait for inventory to load
    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});

    // Verify receipt scanner panel is visible
    await expect(page.locator('h2').filter({ hasText: 'Receipt Scanner' })).toBeVisible();
    await expect(page.locator('button.upload-btn')).toBeVisible();

    // Get initial item count for verification later
    const initialItemCount = await page.locator('.item-row').count();

    // 2. Upload a receipt image via file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(RECEIPT_FIXTURE_PATH);

    // 3. Wait for scanning to complete
    // First verify scanning state appears
    await expect(page.locator('.scanning-state')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.scanning-text')).toContainText('Analyzing receipt');

    // Wait for scanning to finish (transitions to reviewing or incomplete state)
    await page.waitForSelector('.scanning-state', { state: 'detached', timeout: 60000 });

    // 4. Verify items appear in review state
    // Handle both "reviewing" and "incomplete" states
    const isIncomplete = await page.locator('.incomplete-state').isVisible().catch(() => false);
    if (isIncomplete) {
      // Click "Continue Anyway" to proceed to review
      await page.locator('button.continue-btn').click();
    }

    // Now in review state - verify items are shown
    await expect(page.locator('.review-state')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.selection-controls')).toBeVisible();

    // Verify at least one item was extracted
    const itemCount = await page.locator('.review-items').locator('.item-row, [class*="receipt-item"]').count();
    expect(itemCount).toBeGreaterThan(0);

    // 5. Select items for confirmation
    // Items with high confidence are auto-selected, but let's ensure we have selections
    const selectedCount = page.locator('.selection-count');
    await expect(selectedCount).toBeVisible();

    // If no items selected, select all
    const selectionText = await selectedCount.textContent();
    if (selectionText?.includes('0 of')) {
      await page.locator('button.select-btn').filter({ hasText: 'All' }).click();
    }

    // Verify some items are now selected
    const updatedSelectionText = await selectedCount.textContent();
    expect(updatedSelectionText).not.toContain('0 of');

    // 6. Click confirm button
    const confirmButton = page.locator('button.confirm-btn');
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 7. Verify success state appears
    await expect(page.locator('.confirmed-state')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.success-text')).toHaveText('Inventory Updated!');
    await expect(page.locator('.success-subtext')).toContainText('items added to stock');

    // 8. Wait for scanner to reset and verify inventory was updated
    // Scanner auto-resets after 3 seconds
    await page.waitForSelector('.ready-state', { timeout: 10000 });
    await expect(page.locator('button.upload-btn')).toBeVisible();

    // Verify inventory list still shows items (inventory updated)
    await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});
    const finalItemCount = await page.locator('.item-row').count();

    // Stock quantities should have been updated for existing items,
    // or new items may have been added
    expect(finalItemCount).toBeGreaterThanOrEqual(initialItemCount);
  });

  test('can upload receipt and see scanned items', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.locator('h2').filter({ hasText: 'Receipt Scanner' })).toBeVisible();

    // Upload receipt
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(RECEIPT_FIXTURE_PATH);

    // Wait for scanning
    await expect(page.locator('.scanning-state')).toBeVisible({ timeout: 5000 });
    await page.waitForSelector('.scanning-state', { state: 'detached', timeout: 60000 });

    // Handle incomplete state if shown
    const isIncomplete = await page.locator('.incomplete-state').isVisible().catch(() => false);
    if (isIncomplete) {
      await page.locator('button.continue-btn').click();
    }

    // Verify review state shows extracted data
    await expect(page.locator('.review-state')).toBeVisible();
    await expect(page.locator('.receipt-meta')).toBeVisible();

    // Should show supplier and date
    const supplierOrSelect = page.locator('.supplier-select, .supplier-name');
    await expect(supplierOrSelect.first()).toBeVisible();
    await expect(page.locator('.receipt-date')).toBeVisible();
  });

  test('can cancel receipt scan with reset button', async ({ page }) => {
    await page.goto('/inventory');

    // Upload receipt
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(RECEIPT_FIXTURE_PATH);

    // Wait for scanning to start
    await expect(page.locator('.scanning-state')).toBeVisible({ timeout: 5000 });

    // Wait for it to complete
    await page.waitForSelector('.scanning-state', { state: 'detached', timeout: 60000 });

    // Handle incomplete state
    const isIncomplete = await page.locator('.incomplete-state').isVisible().catch(() => false);
    if (isIncomplete) {
      await page.locator('button.continue-btn').click();
    }

    // Now in review state - click reset
    const resetButton = page.locator('button.reset-btn');
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    // Verify scanner returns to ready state
    await expect(page.locator('.ready-state')).toBeVisible();
    await expect(page.locator('button.upload-btn')).toBeVisible();
  });

  test('select all / deselect all buttons work', async ({ page }) => {
    await page.goto('/inventory');

    // Upload receipt
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles(RECEIPT_FIXTURE_PATH);

    // Wait for scanning
    await page.waitForSelector('.scanning-state', { state: 'detached', timeout: 60000 });

    // Handle incomplete state
    const isIncomplete = await page.locator('.incomplete-state').isVisible().catch(() => false);
    if (isIncomplete) {
      await page.locator('button.continue-btn').click();
    }

    await expect(page.locator('.review-state')).toBeVisible();

    // Click "None" to deselect all
    await page.locator('button.select-btn').filter({ hasText: 'None' }).click();
    let selectionText = await page.locator('.selection-count').textContent();
    expect(selectionText).toContain('0 of');

    // Confirm button should be disabled with no selection
    await expect(page.locator('button.confirm-btn')).toBeDisabled();

    // Click "All" to select all
    await page.locator('button.select-btn').filter({ hasText: 'All' }).click();
    selectionText = await page.locator('.selection-count').textContent();
    expect(selectionText).not.toContain('0 of');

    // Confirm button should be enabled
    await expect(page.locator('button.confirm-btn')).toBeEnabled();
  });

  test('shows error state for invalid image', async ({ page }) => {
    await page.goto('/inventory');

    // Create a fake empty file that will fail scanning
    const emptyBuffer = Buffer.alloc(100);
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: 'fake-receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: emptyBuffer,
    });

    // Wait for scanning attempt
    await expect(page.locator('.scanning-state')).toBeVisible({ timeout: 5000 });

    // Should eventually show error state
    await page.waitForSelector('.scanning-state', { state: 'detached', timeout: 30000 });

    // Either error state or incomplete state (both are valid for bad input)
    const errorVisible = await page.locator('.error-state').isVisible().catch(() => false);
    const incompleteVisible = await page.locator('.incomplete-state').isVisible().catch(() => false);
    expect(errorVisible || incompleteVisible).toBe(true);

    if (errorVisible) {
      await expect(page.locator('.error-text')).toBeVisible();
      await expect(page.locator('.retry-btn')).toBeVisible();
    }
  });
});
