// scripts/credit-note-deduction-test.mjs
// Test suite for Issue #186: Credit Note delivery charge deduction and Non-GST supply tax columns

import assert from 'assert';
import { computeInvoiceTotals, deliveryChargeLine } from '../src/utils.js';

console.log('Testing Credit Note delivery charge deduction and Non-GST supply...\n');

// 1. Issue #186 Example: Material returned Rs 1000, delivery charges Rs 100 -> Net Rs 900
console.log('1. Credit Note with delivery charge deducted (Goods ₹1000 - Delivery ₹100 = ₹900 net)');
const goodsLine = {
  name: 'Returned Item',
  quantity: 1,
  rate: 1000,
  taxPercent: 0,
};

const dlvDeduction = deliveryChargeLine([goodsLine], 100, true); // isDeduction = true
assert.strictEqual(dlvDeduction.isDeduction, true, 'Delivery line should have isDeduction = true');

const totals1 = computeInvoiceTotals({
  items: [goodsLine, dlvDeduction],
  showGST: true,
  invoiceType: 'credit-note',
  profile: { country: 'India', state: 'Delhi' },
  client: { state: 'Delhi' },
  details: { placeOfSupply: 'Delhi' },
});

assert.strictEqual(totals1.taxableAmount, 900, 'Taxable amount should be 1000 - 100 = 900');
assert.strictEqual(totals1.total, 900, 'Total Credit Note amount should be 900, not 1100');
console.log('   ✓ Net effect on customer account is correctly ₹900');

// 2. Delivery charge deduction with GST (18%)
console.log('2. Credit Note with delivery charge deducted with 18% GST');
const goodsLineGst = {
  name: 'Returned Shirt',
  quantity: 1,
  rate: 1000,
  taxPercent: 18,
};
const dlvDeductionGst = deliveryChargeLine([goodsLineGst], 100, true);

const totals2 = computeInvoiceTotals({
  items: [goodsLineGst, dlvDeductionGst],
  showGST: true,
  invoiceType: 'credit-note',
  profile: { country: 'India', state: 'Delhi' },
  client: { state: 'Delhi' },
  details: { placeOfSupply: 'Delhi' },
});

assert.strictEqual(totals2.taxableAmount, 900, 'Taxable amount should be 1000 - 100 = 900');
assert.strictEqual(totals2.totalTaxAmount, 162, 'Total GST (18% of 900) should be 162');
assert.strictEqual(totals2.total, 1062, 'Total Credit Note should be 900 + 162 = 1062');
console.log('   ✓ GST calculated correctly on post-deduction net amount (₹900)');

// 3. Normal invoice delivery charges (isDeduction = false or undefined)
console.log('3. Regular sales invoice with delivery charges added (+100)');
const dlvRegular = deliveryChargeLine([goodsLineGst], 100, false);
const totals3 = computeInvoiceTotals({
  items: [goodsLineGst, dlvRegular],
  showGST: true,
  invoiceType: 'tax-invoice',
  profile: { country: 'India', state: 'Delhi' },
  client: { state: 'Delhi' },
  details: { placeOfSupply: 'Delhi' },
});

assert.strictEqual(totals3.taxableAmount, 1100, 'Taxable amount should be 1000 + 100 = 1100');
assert.strictEqual(totals3.totalTaxAmount, 198, 'Total GST (18% of 1100) should be 198');
assert.strictEqual(totals3.total, 1298, 'Total invoice should be 1100 + 198 = 1298');
console.log('   ✓ Regular invoice adds delivery charges normally');

console.log('\nAll Credit Note deduction and Non-GST tests passed successfully!\n');
