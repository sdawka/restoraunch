import { Page } from '@playwright/test';

export async function clearOnboardingState(page: Page): Promise<void> {
  // Navigate to page first to get localStorage context
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('restoraunch_onboarded');
    // Clear all coach mark keys
    Object.keys(localStorage)
      .filter((key) => key.startsWith('coach_seen_'))
      .forEach((key) => localStorage.removeItem(key));
  });
}

export async function markAsOnboarded(page: Page): Promise<void> {
  // Navigate to page first to get localStorage context
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('restoraunch_onboarded', 'true');
  });
}

export async function waitForLoadingComplete(page: Page): Promise<void> {
  await page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {});
  await page.waitForSelector('.loading-shimmer', { state: 'detached' }).catch(() => {});
}
