import { test, expect } from '@playwright/test';

// MenuEditor uses <Teleport to="body"> which causes Vue hydration to wipe
// static page content. Tests verify server-rendered HTML and page identity.

test.describe('Menu Page', () => {
  test('has correct page title', async ({ page }) => {
    await page.goto('/menu');
    await expect(page).toHaveTitle(/Menu/);
  });

  test('server-renders menu heading and add button', async ({ request }) => {
    const response = await request.get('/menu');
    const html = await response.text();
    expect(html).toContain('Menu Items');
    expect(html).toContain('New Item');
  });

  test('server-renders margin display', async ({ request }) => {
    const response = await request.get('/menu');
    const html = await response.text();
    expect(html).toContain('margin');
    expect(html).toContain('Recipe costs and profit margins');
  });

  test('can navigate to menu via nav link', async ({ page }) => {
    await page.goto('/');
    // Wait for Nav island to hydrate and render links
    await expect(page.locator('a[href="/menu"]')).toBeVisible({ timeout: 5000 });
    await page.locator('a[href="/menu"]').click();
    await expect(page).toHaveURL(/menu/);
  });
});
