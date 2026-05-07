import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class MenuPage extends BasePage {
  readonly pageTitle: Locator;
  readonly menuList: Locator;
  readonly addButton: Locator;
  readonly menuItems: Locator;
  readonly modal: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1:has-text("Menu")');
    this.menuList = page.locator('.menu-list, .menu-grid');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("New")');
    this.menuItems = page.locator('.menu-item, .menu-card');
    this.modal = page.locator('.modal-overlay');
  }

  async goto(): Promise<void> { await this.navigateTo('/menu'); }
  async waitForMenuLoad(): Promise<void> { await this.page.waitForSelector('.loading-state, .loading-shimmer', { state: 'detached' }).catch(() => {}); }
  async getMenuItemCount(): Promise<number> { return this.menuItems.count(); }
  async hasIngredientCost(): Promise<boolean> { return this.page.locator('text=/\\$[0-9]+\\.?[0-9]*/').first().isVisible().catch(() => false); }
}
