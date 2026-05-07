import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ModelPage extends BasePage {
  readonly pageTitle: Locator;
  readonly scenarioBuilder: Locator;
  readonly calculateButton: Locator;
  readonly resultsSection: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.scenarioBuilder = page.locator('.scenario-builder, [class*="scenario"]');
    this.calculateButton = page.locator('button:has-text("Calculate"), button:has-text("Model")');
    this.resultsSection = page.locator('.results, .scenario-results');
  }

  async goto(): Promise<void> { await this.navigateTo('/model'); }
  async waitForModelLoad(): Promise<void> { await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {}); }
  async hasScenarioBuilder(): Promise<boolean> { return this.scenarioBuilder.isVisible().catch(() => false); }
}
