// Test suite for Issue #189:
// 1. MRP support in products & invoices
// 2. Real-time Live Invoice Margin / Profit tracking
// 3. Banking section in Cash Book (Cash in hand vs Bank & UPI funds)

import { bulkRowToProduct } from '../src/utils/products.js';
import { calculateBillMargin, calculateItemProfit } from '../src/utils/profitability.js';
import { isBankMode, isCashMode, linkedCashLines, linkedBankLines, ownCashLines, fundsSummary, cashSummary, formatAccountBadge } from '../src/utils/cashBook.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log('\n[Issue #189] 1. Product MRP & Bulk Edit');
{
  const rawProduct = { id: 'p1', name: 'Parle-G Biscuit 250g', purchasePrice: 20, sellingPrice: 25, mrp: 30, taxPercent: 18 };
  const res = bulkRowToProduct(rawProduct, { mrp: 35, sellingPrice: 28 });
  assert(!res.error, 'bulkRowToProduct executes without error');
  assert(res.product.mrp === 35, `Product MRP updated to 35 (got ${res.product.mrp})`);
  assert(res.product.sellingPrice === 28, `Product selling price updated to 28`);
  assert(res.product.rate === 28, `Product legacy rate mirrored to 28`);
}

console.log('\n[Issue #189] 2. Real-time Live Bill Margin & Profit');
{
  const products = [
    { id: 'prod1', name: 'Notebook 200pg', purchasePrice: 40, sellingPrice: 60, mrp: 65 },
    { id: 'prod2', name: 'Ball Pen Blue', purchasePrice: 5, sellingPrice: 10, mrp: 12 },
  ];
  const items = [
    { id: 'it1', productId: 'prod1', name: 'Notebook 200pg', quantity: 10, rate: 60, mrp: 65 }, // Cost: 10 * 40 = 400
    { id: 'it2', productId: 'prod2', name: 'Ball Pen Blue', quantity: 20, rate: 10, mrp: 12 },  // Cost: 20 * 5 = 100
  ];
  // Total cost: 400 + 100 = 500
  // Revenue (total bill amount with tax/subtotal): say 800
  const margin = calculateBillMargin(items, 800, products);
  assert(margin.hasCostData === true, 'hasCostData is true when products have purchase price');
  assert(margin.totalCost === 500, `totalCost is 500 (got ${margin.totalCost})`);
  assert(margin.revenue === 800, `revenue is 800 (got ${margin.revenue})`);
  assert(margin.profit === 300, `profit is 300 (800 - 500) (got ${margin.profit})`);
  // margin percent: 300 / 800 * 100 = 37.5%
  assert(margin.marginPercent === 37.5, `marginPercent is 37.5% (got ${margin.marginPercent})`);
}

console.log('\n[Issue #189] 3. Banking section in Cash Book');
{
  // Payment mode detection
  assert(isBankMode('bank-transfer') === true, 'bank-transfer is recognized as bank mode');
  assert(isBankMode('upi') === true, 'upi is recognized as bank mode');
  assert(isBankMode('cheque') === true, 'cheque is recognized as bank mode');
  assert(isBankMode('card') === true, 'card is recognized as bank mode');
  assert(isBankMode('cash') === false, 'cash is NOT bank mode');
  assert(isCashMode('cash') === true, 'cash is recognized as cash mode');
  assert(isCashMode('upi') === false, 'upi is NOT cash mode');

  // Badge helpers
  assert(formatAccountBadge({ account: 'cash', mode: 'cash' }) === 'Cash', 'Cash badge formatted');
  assert(formatAccountBadge({ account: 'bank', mode: 'upi' }) === 'UPI', 'UPI badge formatted');
  assert(formatAccountBadge({ account: 'bank', mode: 'cheque' }) === 'Cheque', 'Cheque badge formatted');
  assert(formatAccountBadge({ account: 'bank', mode: 'bank-transfer' }) === 'Bank', 'Bank badge formatted');

  // Linked lines separation
  const bills = [
    {
      id: 'inv-1', invoiceNumber: 'INV-001', invoiceDate: '2026-11-12', totalAmount: 1000,
      payments: [
        { id: 'pay-1', amount: 400, mode: 'cash', date: '2026-11-12' },
        { id: 'pay-2', amount: 600, mode: 'upi', date: '2026-11-12' },
      ],
    },
  ];
  const expenses = [
    { id: 'exp-1', amount: 150, paymentMode: 'cash', date: '2026-11-12', description: 'Tea' },
    { id: 'exp-2', amount: 350, paymentMode: 'bank-transfer', date: '2026-11-12', description: 'Internet' },
  ];
  const purchases = [
    { id: 'pur-1', invoiceNumber: 'BILL-101', date: '2026-11-12', totalAmount: 200, paymentStatus: 'Paid', paymentMode: 'cash' },
    { id: 'pur-2', invoiceNumber: 'BILL-102', date: '2026-11-12', totalAmount: 500, paymentStatus: 'Paid', paymentMode: 'bank-transfer' },
  ];

  const cashLines = linkedCashLines({ bills, expenses, purchases });
  const bankLines = linkedBankLines({ bills, expenses, purchases });

  assert(cashLines.length === 3, `3 cash lines extracted (got ${cashLines.length})`);
  assert(bankLines.length === 3, `3 bank lines extracted (got ${bankLines.length})`);

  // Cash in = 400 (pay-1), Cash out = 150 (exp-1) + 200 (pur-1) = 350. Net Cash = +50
  // Bank in = 600 (pay-2), Bank out = 350 (exp-2) + 500 (pur-2) = 850. Net Bank = -250
  const allLines = [...cashLines, ...bankLines];
  const summary = fundsSummary(allLines, '2026-11-12');

  assert(summary.inHand === 50, `Cash in hand is 50 (got ${summary.inHand})`);
  assert(summary.bank === -250, `Bank balance is -250 (got ${summary.bank})`);
  assert(summary.totalFunds === -200, `Total available funds is -200 (got ${summary.totalFunds})`);
}

console.log(`\nIssue #189 Tests completed: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
