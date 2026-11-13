import assert from 'assert';
import {
  formatPaymentMode,
  extractClientPayments,
  getLatestClientPayment,
  summarizeClientPayments,
} from '../src/utils/clientPayments.js';

console.log('Testing Client Payments & History Engine...\n');

// 1. formatPaymentMode()
console.log('1. formatPaymentMode()');
{
  assert.strictEqual(formatPaymentMode('upi'), 'UPI');
  assert.strictEqual(formatPaymentMode('cash'), 'Cash');
  assert.strictEqual(formatPaymentMode('bank'), 'Bank Transfer');
  assert.strictEqual(formatPaymentMode('neft'), 'Bank Transfer');
  assert.strictEqual(formatPaymentMode('cheque'), 'Cheque');
  assert.strictEqual(formatPaymentMode('card'), 'Card');
  console.log('   ✓ Payment mode formatting passed');
}

// 2. extractClientPayments()
console.log('2. extractClientPayments()');
{
  const bills = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-11-01',
      totalAmount: 5000,
      payments: [
        { id: 'p1', amount: 2000, date: '2026-11-02', mode: 'cash', note: 'Advance' },
        { id: 'p2', amount: 1500, date: '2026-11-05', mode: 'upi', note: 'Part 2' }
      ]
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-002',
      invoiceDate: '2026-11-08',
      totalAmount: 3000,
      payments: [
        { id: 'p3', amount: 3000, date: '2026-11-10', mode: 'bank', note: 'Full settlement' }
      ]
    },
    {
      id: 'inv-3',
      invoiceNumber: 'INV-003',
      status: 'cancelled',
      totalAmount: 1000,
      payments: [{ id: 'p4', amount: 1000, date: '2026-11-09' }]
    }
  ];

  const payments = extractClientPayments(bills);
  assert.strictEqual(payments.length, 3); // Cancelled bill payments excluded

  // Newest first: p3 (Nov 10), then p2 (Nov 5), then p1 (Nov 2)
  assert.strictEqual(payments[0].id, 'p3');
  assert.strictEqual(payments[0].amount, 3000);
  assert.strictEqual(payments[0].mode, 'Bank Transfer');
  assert.strictEqual(payments[0].balanceAfter, 0);

  assert.strictEqual(payments[1].id, 'p2');
  assert.strictEqual(payments[1].amount, 1500);
  assert.strictEqual(payments[1].mode, 'UPI');
  assert.strictEqual(payments[1].balanceAfter, 1500); // 5000 - 2000 - 1500 = 1500

  assert.strictEqual(payments[2].id, 'p1');
  assert.strictEqual(payments[2].amount, 2000);
  assert.strictEqual(payments[2].balanceAfter, 3000); // 5000 - 2000 = 3000

  console.log('   ✓ Payment extraction, running balance & date sorting passed');
}

// 3. getLatestClientPayment()
console.log('3. getLatestClientPayment()');
{
  const bills = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-11-01',
      totalAmount: 4000,
      payments: [
        { id: 'p1', amount: 1000, date: '2026-11-03', mode: 'upi' },
        { id: 'p2', amount: 2000, date: '2026-11-09', mode: 'cash' }
      ]
    }
  ];

  const latest = getLatestClientPayment(bills);
  assert.ok(latest);
  assert.strictEqual(latest.id, 'p2');
  assert.strictEqual(latest.amount, 2000);
  assert.strictEqual(latest.date, '2026-11-09');
  assert.strictEqual(latest.mode, 'Cash');

  assert.strictEqual(getLatestClientPayment([]), null);
  console.log('   ✓ Latest payment retrieval passed');
}

// 4. summarizeClientPayments()
console.log('4. summarizeClientPayments()');
{
  const payments = [
    { amount: 1000, mode: 'UPI' },
    { amount: 2000, mode: 'Cash' },
    { amount: 1500, mode: 'UPI' }
  ];

  const summary = summarizeClientPayments(payments);
  assert.strictEqual(summary.count, 3);
  assert.strictEqual(summary.totalReceived, 4500);
  assert.strictEqual(summary.byMode['UPI'], 2500);
  assert.strictEqual(summary.byMode['Cash'], 2000);
  console.log('   ✓ Summary breakdown by mode passed');
}

console.log('\nAll Client Payments & History tests passed successfully!');
