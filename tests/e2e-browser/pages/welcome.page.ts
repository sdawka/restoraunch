import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class WelcomePage extends BasePage {
  readonly welcomeTitle: Locator;
  readonly basicFeatures: Locator;
  readonly advancedFeatures: Locator;
  readonly toggleAdvanced: Locator;
  readonly advancedGrid: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeTitle = page.locator('h1:has-text("Welcome to Restoraunch")');
    this.basicFeatures = page.locator('[data-testid="basic-features"]');
    this.advancedFeatures = page.locator('[data-testid="advanced-features"]');
    this.toggleAdvanced = page.locator('[data-testid="toggle-advanced"]');
    this.advancedGrid = page.locator('[data-testid="advanced-grid"]');
    this.getStartedButton = page.locator('[data-testid="get-started"]');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/welcome');
  }

  async isAdvancedExpanded(): Promise<boolean> {
    return this.advancedGrid.isVisible();
  }

  async toggleAdvancedSection(): Promise<void> {
    await this.toggleAdvanced.click();
  }

  async clickGetStarted(): Promise<void> {
    await this.getStartedButton.click();
  }

  async clickFeature(featureId: string): Promise<void> {
    await this.page.locator(`[data-testid="feature-${featureId}"]`).click();
  }
}
