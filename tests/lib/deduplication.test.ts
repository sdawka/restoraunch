import { describe, it, expect } from 'vitest';
import { deduplicateItems } from '../../src/lib/ai/deduplication';
import type { ParsedReceiptItem } from '../../src/lib/ai/service';

function item(name: string, quantity: number, unitPrice: number): ParsedReceiptItem {
  return { name, quantity, unit: 'lb', unitPrice, totalPrice: quantity * unitPrice };
}

describe('deduplicateItems', () => {
  it('returns empty array unchanged', () => {
    const result = deduplicateItems([]);
    expect(result.items).toHaveLength(0);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('returns single item unchanged', () => {
    const items = [item('Chicken Breast', 10, 4.99)];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('removes exact duplicates', () => {
    const items = [
      item('Chicken Breast', 10, 4.99),
      item('Chicken Breast', 10, 4.99),
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.items[0].name).toBe('Chicken Breast');
  });

  it('removes fuzzy duplicates with OCR variance', () => {
    const items = [
      item('Chicken Breast', 10, 4.99),
      item('Chickin Breast', 10, 4.99), // realistic OCR error
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
    // Keeps the longer/clearer name
    expect(result.items[0].name).toBe('Chicken Breast');
  });

  it('keeps items with different quantities', () => {
    const items = [
      item('Chicken Breast', 10, 4.99),
      item('Chicken Breast', 5, 4.99),
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('keeps items with different prices', () => {
    const items = [
      item('Chicken Breast', 10, 4.99),
      item('Chicken Breast', 10, 5.99),
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it('handles multiple duplicates', () => {
    const items = [
      item('Chicken Breast', 10, 4.99),
      item('Olive Oil', 2, 25.00),
      item('Chicken Breast', 10, 4.99), // dup of first
      item('Olive Oil', 2, 25.00), // dup of second
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(2);
  });

  it('is case insensitive for name matching', () => {
    const items = [
      item('CHICKEN BREAST', 10, 4.99),
      item('chicken breast', 10, 4.99),
    ];
    const result = deduplicateItems(items);
    expect(result.items).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });
});
