// scripts/cash-paid-test.mjs
// Verification for Issue #184: Purchase & Sales Paid status affecting Cash Book

import assert from 'assert';
import { markPurchasePaid, markPurchaseUnpaid } from '../src/utils/purchasePayments.js';
import { markPaidPatch, markUnpaidPatch } from '../src/utils.js';
import { linkedCashLines } from '../src/utils/cashBook.js';

console.log('Testing Issue #184: Paid Status reflection in Cash Book...\n');

// 1. Purchase Bill marked as Paid with Cash
console.log('1. Purchase Bill marked as Paid with Cash');
const samplePurchase = {
  id: 'pur_101',
  invoiceNumber: 'BILL/2026/01',
  supplierName: 'ABC Materials',
  totalAmount: 5000,
  date: '2026-11-12',
};

const paidPurchase = markPurchasePaid(samplePurchase, '2026-11-12', new Date(), 'cash');
assert.strictEqual(paidPurchase.paymentStatus, 'Paid');
assert.strictEqual(paidPurchase.payments.length, 1);
assert.strictEqual(paidPurchase.payments[0].mode, 'cash');
assert.strictEqual(paidPurchase.payments[0].amount, 5000);

const purchaseCashLines = linkedCashLines({ purchases: [paidPurchase] });
assert.strictEqual(purchaseCashLines.length, 1);
assert.strictEqual(purchaseCashLines[0].type, 'out');
assert.strictEqual(purchaseCashLines[0].amount, 5000);
assert.strictEqual(purchaseCashLines[0].name, 'ABC Materials');
console.log('   ✓ Purchase bill marked Paid in Cash correctly generates Money Out in Cash Book');

// 2. Purchase Bill with Bank Transfer does NOT affect Cash Book
console.log('2. Purchase Bill with Bank Transfer does NOT affect Cash Book');
const bankPurchase = markPurchasePaid(samplePurchase, '2026-11-12', new Date(), 'bank-transfer');
assert.strictEqual(bankPurchase.payments[0].mode, 'bank-transfer');
const bankCashLines = linkedCashLines({ purchases: [bankPurchase] });
assert.strictEqual(bankCashLines.length, 0);
console.log('   ✓ Purchase bill paid via Bank Transfer is excluded from Cash Book');

// 3. Sales Invoice marked as Paid with Cash
console.log('3. Sales Invoice marked as Paid with Cash');
const sampleInvoice = {
  id: 'inv_201',
  invoiceNumber: 'INV-001',
  clientName: 'Rahul Traders',
  totalAmount: 12000,
  invoiceDate: '2026-11-12',
  payments: [],
};

const paidInvoice = { ...sampleInvoice, ...markPaidPatch(sampleInvoice, 'Marked paid', 'cash') };
assert.strictEqual(paidInvoice.paidAmount, 12000);
assert.strictEqual(paidInvoice.payments.length, 1);
assert.strictEqual(paidInvoice.payments[0].mode, 'cash');

const salesCashLines = linkedCashLines({ bills: [paidInvoice] });
assert.strictEqual(salesCashLines.length, 1);
assert.strictEqual(salesCashLines[0].type, 'in');
assert.strictEqual(salesCashLines[0].amount, 12000);
assert.strictEqual(salesCashLines[0].name, 'Rahul Traders');
console.log('   ✓ Sales invoice marked Paid in Cash correctly generates Money In in Cash Book');

// 4. Marking Unpaid cleanly removes payment and Cash Book line
console.log('4. Marking Unpaid cleanly removes payment and Cash Book line');
const unpaidPurchase = markPurchaseUnpaid(paidPurchase);
assert.strictEqual(unpaidPurchase.paymentStatus, 'Unpaid');
assert.strictEqual(linkedCashLines({ purchases: [unpaidPurchase] }).length, 0);

const unpaidInvoice = { ...paidInvoice, ...markUnpaidPatch(paidInvoice) };
assert.strictEqual(unpaidInvoice.paidAmount, 0);
assert.strictEqual(linkedCashLines({ bills: [unpaidInvoice] }).length, 0);
console.log('   ✓ Marking Unpaid removes entries from Cash Book');

console.log('\nAll Issue #184 tests passed successfully!\n');
