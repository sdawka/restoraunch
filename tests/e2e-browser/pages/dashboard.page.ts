import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class DashboardPage extends BasePage {
  readonly tourPrompt: Locator;
  readonly takeTourButton: Locator;
  readonly dismissButton: Locator;
  readonly dashboardCards: Locator;

  constructor(page: Page) {
    super(page);
    this.tourPrompt = page.locator('[data-testid="tour-prompt"]');
    this.takeTourButton = page.locator('[data-testid="tour-take"]');
    this.dismissButton = page.locator('[data-testid="tour-dismiss"]');
    this.dashboardCards = page.locator('.dashboard-container');
  }

  async goto(): Promise<void> {
    await this.navigateTo('/');
  }

  async isTourPromptVisible(): Promise<boolean> {
    return this.tourPrompt.isVisible();
  }

  async takeTour(): Promise<void> {
    await this.takeTourButton.click({ force: true });
  }

  async dismissTour(): Promise<void> {
    await this.dismissButton.click({ force: true });
  }
}
