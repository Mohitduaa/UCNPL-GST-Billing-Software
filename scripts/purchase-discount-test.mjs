// scripts/purchase-discount-test.mjs
// Test suite for Issue #171: Purchase Invoice Discount (per item as % or ₹)

import assert from 'assert';
import { purchaseLineTax, purchaseTotals } from '../src/utils/purchaseOrders.js';

console.log('Testing Purchase Invoice Discount functionality...\n');

// 1. Line tax calculation with percentage discount
console.log('1. Line tax calculation with percentage discount (10% on ₹1,000 @ 18% GST)');
const item1 = {
  name: 'Cement Bags',
  quantity: 10,
  rate: 100,
  discount: 10,
  discountType: 'percent',
  taxPercent: 18,
};

const line1 = purchaseLineTax(item1);
assert.strictEqual(line1.gross, 1000, 'Gross should be 10 x 100 = 1000');
assert.strictEqual(line1.discount, 100, 'Discount should be 10% of 1000 = 100');
assert.strictEqual(line1.amount, 900, 'Taxable amount should be 1000 - 100 = 900');
assert.strictEqual(line1.tax, 162, 'Tax should be 18% of 900 = 162');
assert.strictEqual(line1.total, 1062, 'Total should be 900 + 162 = 1062');
console.log('   ✓ Percentage discount correctly reduces taxable value and GST');

// 2. Line tax calculation with fixed ₹ discount
console.log('2. Line tax calculation with fixed ₹ discount (Flat ₹150 off on ₹1,000 @ 12% GST)');
const item2 = {
  name: 'Steel Rods',
  quantity: 2,
  rate: 500,
  discount: 150,
  discountType: 'fixed',
  taxPercent: 12,
};

const line2 = purchaseLineTax(item2);
assert.strictEqual(line2.gross, 1000, 'Gross should be 2 x 500 = 1000');
assert.strictEqual(line2.discount, 150, 'Discount should be 150');
assert.strictEqual(line2.amount, 850, 'Taxable amount should be 1000 - 150 = 850');
assert.strictEqual(line2.tax, 102, 'Tax should be 12% of 850 = 102');
assert.strictEqual(line2.total, 952, 'Total should be 850 + 102 = 952');
console.log('   ✓ Fixed ₹ discount correctly reduces taxable value and GST');

// 3. Discount clamping (discount cannot exceed gross)
console.log('3. Discount clamping when discount > line gross');
const item3 = {
  name: 'Small Nut',
  quantity: 1,
  rate: 50,
  discount: 100, // Exceeds line gross
  discountType: 'fixed',
  taxPercent: 18,
};

const line3 = purchaseLineTax(item3);
assert.strictEqual(line3.discount, 50, 'Discount should be clamped to gross (50)');
assert.strictEqual(line3.amount, 0, 'Taxable amount should be 0');
assert.strictEqual(line3.tax, 0, 'Tax should be 0');
assert.strictEqual(line3.total, 0, 'Total should be 0');
console.log('   ✓ Discount correctly clamped to gross amount');

// 4. Document-level purchaseTotals with discounts
console.log('4. Document purchaseTotals aggregation with discounts');
const items = [item1, item2];
const totals = purchaseTotals(items, true);

assert.strictEqual(totals.subtotal, 2000, 'Subtotal should be 1000 + 1000 = 2000');
assert.strictEqual(totals.discount, 250, 'Total discount should be 100 + 150 = 250');
assert.strictEqual(totals.taxable, 1750, 'Total taxable should be 900 + 850 = 1750');
assert.strictEqual(totals.tax, 264, 'Total tax should be 162 + 102 = 264');
assert.strictEqual(totals.total, 2014, 'Total before round-off should be 1750 + 264 = 2014');
assert.strictEqual(totals.finalTotal, 2014, 'Final total should be 2014');
console.log('   ✓ Document totals aggregated correctly with subtotal, discount, taxable, and tax');

// 5. Effective unit purchase price calculation for inventory
console.log('5. Effective unit purchase price for stock value');
function effectiveUnitCost(item) {
  const qty = Number(item.quantity) || 1;
  const line = purchaseLineTax(item);
  return qty > 0 ? line.amount / qty : Number(item.rate) || 0;
}

const unitCost1 = effectiveUnitCost(item1);
assert.strictEqual(unitCost1, 90, 'Effective unit cost of 10 items for ₹900 taxable = ₹90/item');
console.log('   ✓ Effective unit cost reflects post-discount purchase price');

console.log('\nAll Purchase Invoice Discount tests passed successfully!\n');
