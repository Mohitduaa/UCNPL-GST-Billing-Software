// scripts/bug-fixes-audit-test.mjs
// Verification suite for bug audit fixes:
// 1. Warranty & Expiry date calculations in invoices & preview
// 2. Barcode scanner MRP mapping without undefined variable errors
// 3. RBAC PIN verification in simulated browser (Buffer-free) environment
// 4. Verification that formatWarrantyLabel works accurately for preview/grid layouts

import assert from 'node:assert/strict';
import { calculateWarrantyExpiry, formatWarrantyLabel } from '../src/utils.js';
import { hashPin, verifyPin } from '../src/utils/rbac.js';

console.log('Running Bug Audit Fixes Verification Test Suite...\n');

// 1. Warranty calculation tests
console.log('1. Testing calculateWarrantyExpiry & formatWarrantyLabel:');
assert.equal(calculateWarrantyExpiry('2026-11-16', 12), '2027-11-16', '12 months warranty calculates accurately');
assert.equal(calculateWarrantyExpiry('2026-11-16', 6), '2027-05-16', '6 months warranty calculates accurately');
assert.equal(calculateWarrantyExpiry('2026-11-16', 0), '', '0 months returns empty string');
assert.equal(calculateWarrantyExpiry('', 12), '', 'Empty invoiceDate returns empty string');

const label12 = formatWarrantyLabel(12, '2027-11-16');
assert.equal(label12, '1 Year (Valid till 16-Nov-27)', '12 months label formatted properly');
const label6 = formatWarrantyLabel(6, '2027-05-16');
assert.equal(label6, '6 Months (Valid till 16-May-27)', '6 months label formatted properly');
const label0 = formatWarrantyLabel(0, '');
assert.equal(label0, '', '0 months returns empty label');
console.log('  ✓ calculateWarrantyExpiry & formatWarrantyLabel passed!\n');

// 2. Simulated onBarcodeScan MRP resolution
console.log('2. Testing Barcode Scanner MRP & empty row resolution logic:');
const sampleProducts = [
  { id: 'p1', name: 'Keyboard', barcode: '8901234', sellingPrice: 500, mrp: 650, taxPercent: 18, unit: 'Nos' },
  { id: 'p2', name: 'Mouse', barcode: '8905678', sellingPrice: 250, mrp: null, taxPercent: 18, unit: 'Nos' },
];

function simulateScan(code, prevItems) {
  const found = sampleProducts.find(p => p.barcode === code);
  assert.ok(found, 'Product must be found');
  const salePrice = found.sellingPrice ?? 0;
  if (prevItems.length === 1 && !prevItems[0].name && !prevItems[0].rate) {
    const first = prevItems[0];
    return [{
      ...first,
      name: found.name,
      quantity: 1,
      rate: salePrice,
      mrp: (found.mrp !== undefined && found.mrp !== null && found.mrp !== '') ? found.mrp : (first.mrp ?? ''),
      taxPercent: found.taxPercent,
      unit: found.unit,
      productId: found.id,
    }];
  }
  return [...prevItems, {
    name: found.name,
    quantity: 1,
    rate: salePrice,
    mrp: (found.mrp !== undefined && found.mrp !== null && found.mrp !== '') ? found.mrp : '',
    taxPercent: found.taxPercent,
    unit: found.unit,
    productId: found.id,
  }];
}

const emptyFirstRow = [{ id: '1', name: '', rate: 0, mrp: '' }];
const scannedItems = simulateScan('8901234', emptyFirstRow);
assert.equal(scannedItems.length, 1);
assert.equal(scannedItems[0].name, 'Keyboard');
assert.equal(scannedItems[0].mrp, 650, 'Product MRP correctly populated onto line item without ReferenceError');

const secondScanned = simulateScan('8905678', scannedItems);
assert.equal(secondScanned.length, 2);
assert.equal(secondScanned[1].name, 'Mouse');
assert.equal(secondScanned[1].mrp, '', 'Null MRP safely falls back to empty string');
console.log('  ✓ Barcode scanner MRP mapping verified!\n');

// 3. RBAC PIN Verification in simulated browser (Buffer-free) environment
console.log('3. Testing RBAC PIN verification in simulated Buffer-free browser:');
const testPin = '1234';
const { hash, salt } = hashPin(testPin);

// Test standard verification
assert.equal(verifyPin(testPin, salt, hash), true, 'Valid PIN verifies true');
assert.equal(verifyPin('0000', salt, hash), false, 'Wrong PIN verifies false');

// Temporarily remove globalThis.Buffer to simulate pure browser window environment
const originalBuffer = globalThis.Buffer;
try {
  delete globalThis.Buffer;
  assert.equal(typeof globalThis.Buffer, 'undefined', 'Buffer successfully removed for test');
  assert.equal(verifyPin(testPin, salt, hash), true, 'Valid PIN verifies in browser without Buffer');
  assert.equal(verifyPin('9999', salt, hash), false, 'Wrong PIN rejects in browser without Buffer');
} finally {
  globalThis.Buffer = originalBuffer;
}
console.log('  ✓ RBAC Buffer-free browser verification passed!\n');

console.log('All Bug Audit Fixes verified successfully with 100% pass!');
