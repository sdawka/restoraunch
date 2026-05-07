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
    await this.nav.locator(`a:has-text("${label}")`).click();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
