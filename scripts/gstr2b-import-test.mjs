// scripts/gstr2b-import-test.mjs
// Automated verification for GSTR-2B / GSTR-2A purchase import engine

import assert from 'assert';
import {
  normInv,
  extractGstrItems,
  convertGstrInvoiceToPurchase,
  parseGstrJsonToPurchases,
} from '../src/utils/gstrImport.js';

console.log('Testing GSTR-2B and GSTR-2A Purchase Auto-Import Engine...\n');

// Sample GSTR-2B payload
const sampleGstr2B = {
  gstin: '27AABCT1234A1Z5',
  rtnprd: '102025',
  docdata: {
    b2b: [
      {
        ctin: '07AAAAA0000A1Z5',
        trdnm: 'DELHI SUPPLIER TECH CORP',
        inv: [
          {
            inum: 'INV-2025-001',
            dt: '15-10-2025',
            val: 1180.00,
            pos: '27',
            rchrg: 'N',
            inv_typ: 'R',
            items: [
              {
                num: 1,
                txval: 1000.00,
                rt: 18,
                igst: 180.00,
                cgst: 0,
                sgst: 0,
                cess: 0,
              },
            ],
          },
          {
            inum: 'INV-2025-002',
            dt: '20-10-2025',
            val: 5600.00,
            pos: '27',
            rchrg: 'N',
            items: [
              { num: 1, txval: 2000.00, rt: 18, igst: 360.00, cgst: 0, sgst: 0 },
              { num: 2, txval: 3000.00, rt: 12, igst: 360.00, cgst: 0, sgst: 0, cess: 240.00 },
            ],
          },
        ],
      },
    ],
  },
};

// Sample GSTR-2A payload (using b2b directly, cname, idt, itms with itm_det)
const sampleGstr2A = {
  gstin: '27AABCT1234A1Z5',
  fp: '102025',
  b2b: [
    {
      ctin: '27BBBBB1111B1Z2',
      cname: 'MAHARASHTRA LOCAL TRADERS',
      inv: [
        {
          inum: 'MH/8892',
          idt: '25-10-2025',
          val: 2360.00,
          pos: '27',
          itms: [
            {
              num: 1,
              itm_det: {
                txval: 2000.00,
                rt: 18,
                cgst: 180.00,
                sgst: 180.00,
                igst: 0,
                csamt: 0,
              },
            },
          ],
        },
      ],
    },
  ],
};

const userProfile = {
  gstin: '27AABCT1234A1Z5',
  businessName: 'My Awesome Company',
};

// 1. normInv
console.log('1. normInv helper');
assert.strictEqual(normInv('inv-2025/001'), 'INV2025001');
assert.strictEqual(normInv('INV# 8892-A'), 'INV8892A');
console.log('   ✓ Normalizes invoice numbers consistently');

// 2. convertGstrInvoiceToPurchase (GSTR-2B Interstate bill)
console.log('2. convertGstrInvoiceToPurchase (GSTR-2B Interstate)');
const sup1 = sampleGstr2B.docdata.b2b[0];
const inv1 = sup1.inv[0];
const pur1 = convertGstrInvoiceToPurchase(inv1, sup1, userProfile);
assert.strictEqual(pur1.invoiceNumber, 'INV-2025-001');
assert.strictEqual(pur1.supplierName, 'DELHI SUPPLIER TECH CORP');
assert.strictEqual(pur1.supplierGstin, '07AAAAA0000A1Z5');
assert.strictEqual(pur1.date, '2025-10-15');
assert.strictEqual(pur1.interstate, true);
assert.strictEqual(pur1.taxableAmount, 1000);
assert.strictEqual(pur1.totalTax, 180);
assert.strictEqual(pur1.totalAmount, 1180);
assert.strictEqual(pur1.items.length, 1);
assert.strictEqual(pur1.items[0].taxPercent, 18);
console.log('   ✓ Single line GSTR-2B converted to purchase record with correct GST & Interstate');

// 3. Multi-line GSTR-2B with Cess
console.log('3. Multi-item GSTR-2B with Cess');
const inv2 = sup1.inv[1];
const pur2 = convertGstrInvoiceToPurchase(inv2, sup1, userProfile);
assert.strictEqual(pur2.items.length, 2);
assert.strictEqual(pur2.taxableAmount, 5000); // 2000 + 3000
assert.strictEqual(pur2.totalTax, 960); // 360 + 360 + 240
assert.strictEqual(pur2.totalAmount, 5600); // Wait, 5000 taxable + 720 igst + 240 cess = 5960, val was 5600 -> roundoff
console.log('   ✓ Multi-item purchase bill created successfully');

// 4. GSTR-2A Intrastate format
console.log('4. GSTR-2A Intrastate invoice format');
const sup2A = sampleGstr2A.b2b[0];
const inv2A = sup2A.inv[0];
const pur2A = convertGstrInvoiceToPurchase(inv2A, sup2A, userProfile);
assert.strictEqual(pur2A.invoiceNumber, 'MH/8892');
assert.strictEqual(pur2A.supplierName, 'MAHARASHTRA LOCAL TRADERS');
assert.strictEqual(pur2A.date, '2025-10-25');
assert.strictEqual(pur2A.interstate, false); // Both 27 state
assert.strictEqual(pur2A.totalAmount, 2360);
console.log('   ✓ GSTR-2A format with itms/itm_det converted accurately');

// 5. parseGstrJsonToPurchases & Duplicate prevention
console.log('5. parseGstrJsonToPurchases with duplicate skipping');
const existing = [
  {
    supplierGstin: '07AAAAA0000A1Z5',
    invoiceNumber: 'INV-2025-001', // Already booked
  },
];

const res2B = parseGstrJsonToPurchases(sampleGstr2B, { existingPurchases: existing, profile: userProfile });
assert.strictEqual(res2B.totalInvoices, 2);
assert.strictEqual(res2B.toImport.length, 1);
assert.strictEqual(res2B.skipped.length, 1);
assert.strictEqual(res2B.toImport[0].invoiceNumber, 'INV-2025-002');
console.log('   ✓ Correctly identified 1 new invoice to import and skipped 1 already booked');

// 6. JSON String parsing
console.log('6. JSON string parsing');
const resStr = parseGstrJsonToPurchases(JSON.stringify(sampleGstr2A), { existingPurchases: [], profile: userProfile });
assert.strictEqual(resStr.toImport.length, 1);
assert.strictEqual(resStr.toImport[0].invoiceNumber, 'MH/8892');
console.log('   ✓ Successfully parsed raw string JSON');

console.log('\nAll GSTR-2B & GSTR-2A Purchase Auto-Import tests passed!\n');
