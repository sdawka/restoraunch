import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class InsightsPage extends BasePage {
  readonly pageTitle: Locator;
  readonly varianceSection: Locator;
  readonly varianceList: Locator;
  readonly calculateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.varianceSection = page.locator('section:has-text("Variance"), .variance-section');
    this.varianceList = page.locator('.variance-list');
    this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Analyze")');
  }

  async goto(): Promise<void> { await this.navigateTo('/insights'); }
  async waitForInsightsLoad(): Promise<void> { await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {}); }
  async hasVarianceResults(): Promise<boolean> { return this.varianceList.isVisible().catch(() => false); }
}
