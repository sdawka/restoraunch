import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly nav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.locator('nav.nav-container');
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async clickNavItem(label: string): Promise<void> {
    // Wait for nav link to be visible (Vue hydration), then click with force for overlay bypass
    const link = this.nav.locator(`a:has-text("${label}")`);
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.click({ force: true });
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
