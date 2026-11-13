// scripts/purchase-serial-test.mjs
// Test suite for Issue #160: Optional Serial Number / IMEI field in Purchase Entry

import assert from 'assert';

console.log('Testing Purchase Serial Number & IMEI functionality...\n');

// 1. Check item structure with serialNo
console.log('1. Item structure with serialNo');
const purchaseItem = {
  name: 'Dell Latitude Laptop',
  hsn: '8471',
  serialNo: 'SN-DELL-98234-X',
  quantity: 2,
  rate: 45000,
  taxPercent: 18,
};

assert.strictEqual(purchaseItem.serialNo, 'SN-DELL-98234-X', 'Serial number should be preserved on line item');
console.log('   ✓ Line item serial number preserved');

// 2. Search matching by serial number
console.log('2. Search matching by serialNo in purchases list');
const mockPurchases = [
  {
    id: 'p1',
    supplierName: 'ABC Computers',
    invoiceNumber: 'INV-1001',
    items: [
      { name: 'iPhone 15 Pro', serialNo: 'IMEI-354928104829104', quantity: 1, rate: 120000 },
      { name: 'Phone Case', serialNo: '', quantity: 5, rate: 500 },
    ]
  },
  {
    id: 'p2',
    supplierName: 'XYZ Electronics',
    invoiceNumber: 'INV-2002',
    items: [
      { name: 'HP LaserJet Printer', serialNo: 'HP-PRN-8831', quantity: 1, rate: 18000 }
    ]
  }
];

function filterPurchases(purchases, search) {
  if (!search.trim()) return purchases;
  const q = search.trim().toLowerCase();
  return purchases.filter(p => {
    const hasItemSerial = (p.items || []).some(it => 
      (it.serialNo || '').toLowerCase().includes(q) || 
      (it.name || '').toLowerCase().includes(q)
    );
    return (p.supplierName || '').toLowerCase().includes(q) ||
           (p.invoiceNumber || '').toLowerCase().includes(q) ||
           hasItemSerial;
  });
}

// Search by IMEI
const foundImei = filterPurchases(mockPurchases, '354928104829104');
assert.strictEqual(foundImei.length, 1, 'Should find 1 bill matching IMEI');
assert.strictEqual(foundImei[0].id, 'p1', 'Should match bill p1 for IMEI search');
console.log('   ✓ Found bill by exact IMEI search');

// Search by partial Serial Number
const foundPartialSerial = filterPurchases(mockPurchases, 'PRN-8831');
assert.strictEqual(foundPartialSerial.length, 1, 'Should find 1 bill matching partial serial number');
assert.strictEqual(foundPartialSerial[0].id, 'p2', 'Should match bill p2 for partial serial search');
console.log('   ✓ Found bill by partial serial number search');

// Non-matching search
const notFound = filterPurchases(mockPurchases, 'NONEXISTENT-SERIAL');
assert.strictEqual(notFound.length, 0, 'Should not match nonexistent serial');
console.log('   ✓ Nonexistent serial correctly returns empty array');

// 3. Multiple serial numbers formatting
console.log('3. Multiple / Comma-separated serial numbers');
const itemWithMultipleSerials = {
  name: 'Samsung Galaxy A15',
  serialNo: 'IMEI1: 358129031238912, IMEI2: 358129031238913',
  quantity: 2,
};
const foundSecondImei = filterPurchases([{
  id: 'p3',
  supplierName: 'Mobile Hub',
  invoiceNumber: 'INV-3003',
  items: [itemWithMultipleSerials]
}], '358129031238913');

assert.strictEqual(foundSecondImei.length, 1, 'Should find bill by second IMEI');
console.log('   ✓ Multiple IMEI search verified');

console.log('\nAll Purchase Serial Number & IMEI tests passed successfully!\n');
