import { createAIService } from '../../../src/lib/ai/service.ts';
import * as fs from 'fs';
import * as path from 'path';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY not set');
  process.exit(1);
}

const groundTruth = JSON.parse(fs.readFileSync('./tests/fixtures/receipts/ground-truth.json', 'utf-8'));
const images = [
  './tests/fixtures/receipts/IMG_2156.jpeg',
  './tests/fixtures/receipts/IMG_2157.jpeg',
  './tests/fixtures/receipts/IMG_2158.jpeg',
];

const imageUrls = images.map(img => {
  const data = fs.readFileSync(img);
  return `data:image/jpeg;base64,${data.toString('base64')}`;
});

console.log('Testing tracked extraction against ground truth...\n');

const aiService = createAIService({ apiKey });
const result = await aiService.parseMultiPhotoReceiptTracked(imageUrls);

console.log('=== RESULTS vs GROUND TRUTH ===');
console.log(`Vendor:    ${result.vendor} (expected: ${groundTruth.vendor})`);
console.log(`Date:      ${result.date} (expected: ${groundTruth.date})`);
console.log(`Total:     $${result.extractedTotal} (expected: $${groundTruth.total})`);
console.log(`Items:     ${result.items.length} (expected: ~${groundTruth.expectedItemCount})`);
console.log(`Calc Total: $${result.calculatedTotal}`);
console.log(`Discrepancy: $${result.discrepancy}`);
console.log(`Cost:      $${result.totalCost.toFixed(6)}`);

const totalMatch = Math.abs((result.extractedTotal || 0) - groundTruth.total) < 1;
const vendorMatch = result.vendor.toLowerCase().includes('restaurant depot');

console.log('\n=== VALIDATION ===');
console.log(`Total matches: ${totalMatch ? '✓' : '✗'}`);
console.log(`Vendor matches: ${vendorMatch ? '✓' : '✗'}`);
console.log(`Valid (discrepancy < $1): ${result.discrepancy < 1 ? '✓' : '✗'}`);

if (totalMatch && vendorMatch && result.discrepancy < 1) {
  console.log('\n✓ ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('\n✗ SOME CHECKS FAILED');
  process.exit(1);
}
