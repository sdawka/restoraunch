import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class InventoryPage extends BasePage {
  readonly pageTitle: Locator;
  readonly inventoryList: Locator;
  readonly searchInput: Locator;
  readonly addButton: Locator;
  readonly itemRows: Locator;
  readonly adjustButton: Locator;
  readonly modal: Locator;
  readonly receiptScanner: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('main h1');
    this.inventoryList = page.locator('.inventory-list');
    this.searchInput = page.locator('input.search-input');
    this.addButton = page.locator('button:has-text("Add Item")');
    this.itemRows = page.locator('.item-row');
    this.adjustButton = page.locator('button.adjust-btn');
    this.modal = page.locator('.modal-overlay');
    this.receiptScanner = page.locator('h2:has-text("Receipt Scanner")');
  }

  async goto(): Promise<void> { await this.navigateTo('/inventory'); }
  async waitForInventoryLoad(): Promise<void> { await this.page.waitForSelector('.loading-state', { state: 'detached' }).catch(() => {}); }
  async getItemCount(): Promise<number> { return this.itemRows.count(); }
  async adjustFirstItem(delta: number, reason: string): Promise<void> {
    await this.adjustButton.first().click();
    await this.page.locator('input.delta-input').fill(delta.toString());
    await this.page.locator('input.reason-input, textarea.reason-input').fill(reason);
    await this.page.locator('button:has-text("Save"), button:has-text("Confirm")').click();
  }
}
