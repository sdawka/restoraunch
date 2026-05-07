import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class InsightsPage extends BasePage {
  readonly pageTitle: Locator;
  readonly varianceSection: Locator;
  readonly varianceList: Locator;
  readonly calculateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1.header-title, h1:has-text("Variance")');
    this.varianceSection = page.locator('section:has-text("Variance"), .variance-section');
    this.varianceList = page.locator('.variance-container, .variance-list');
    this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Analyze")');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/insights');
    await this.page.waitForLoadState('networkidle');
  }
  async waitForInsightsLoad(): Promise<void> {
    await this.page.waitForSelector('.variance-container', { state: 'visible', timeout: 15000 });
  }
  async hasVarianceResults(): Promise<boolean> {
    await this.varianceList.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    return this.varianceList.isVisible().catch(() => false);
  }
}
