import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class SalesPage extends BasePage {
  readonly pageTitle: Locator;
  readonly importButton: Locator;
  readonly salesList: Locator;
  readonly salesRows: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.importButton = page.locator('button:has-text("Import")');
    this.salesList = page.locator('.sales-list, .sales-table');
    this.salesRows = page.locator('.sale-row, tbody tr');
  }

  async goto(): Promise<void> { await this.navigateTo('/sales'); }
  async waitForSalesLoad(): Promise<void> { await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {}); }
  async getSalesCount(): Promise<number> { return this.salesRows.count(); }
}
