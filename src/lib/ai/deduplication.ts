import type { ParsedReceiptItem } from './service';

export interface DeduplicationResult {
  items: ParsedReceiptItem[];
  duplicatesRemoved: number;
}

export function deduplicateItems(items: ParsedReceiptItem[]): DeduplicationResult {
  if (items.length <= 1) {
    return { items, duplicatesRemoved: 0 };
  }

  const seen = new Map<string, ParsedReceiptItem>();
  let duplicatesRemoved = 0;

  for (const item of items) {
    const key = generateItemKey(item);
    const existing = seen.get(key);

    if (existing) {
      // Keep the one with the longer/cleaner name
      if (item.name.length > existing.name.length) {
        seen.set(key, item);
      }
      duplicatesRemoved++;
    } else {
      // Check for fuzzy match
      const fuzzyMatch = findFuzzyMatch(item, Array.from(seen.values()));
      if (fuzzyMatch) {
        // Keep the clearer version
        if (item.name.length > fuzzyMatch.name.length) {
          const fuzzyKey = generateItemKey(fuzzyMatch);
          seen.delete(fuzzyKey);
          seen.set(key, item);
        }
        duplicatesRemoved++;
      } else {
        seen.set(key, item);
      }
    }
  }

  return { items: Array.from(seen.values()), duplicatesRemoved };
}

function generateItemKey(item: ParsedReceiptItem): string {
  const normalizedName = item.name.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${normalizedName}|${item.quantity}|${item.unitPrice.toFixed(2)}`;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function findFuzzyMatch(
  item: ParsedReceiptItem,
  candidates: ParsedReceiptItem[],
  threshold = 0.65
): ParsedReceiptItem | null {
  for (const candidate of candidates) {
    // Must have same quantity and price to be considered a duplicate
    if (candidate.quantity !== item.quantity) continue;
    if (Math.abs(candidate.unitPrice - item.unitPrice) > 0.01) continue;

    // Check name similarity
    if (similarity(candidate.name, item.name) >= threshold) {
      return candidate;
    }
  }
  return null;
}
