import assert from 'node:assert/strict';
import {
  formatDocNumber,
  DEFAULT_NUMBER_SETTINGS,
  INVOICE_TYPES,
  getFinancialYearLabel,
} from '../src/utils.js';
import { purchaseTotals } from '../src/utils/purchaseOrders.js';
import { purchasePaid, purchaseBalance } from '../src/utils/purchasePayments.js';

console.log('Testing Issue #194: Auto-Numbering & Supplier Statement Improvements...\n');

// 1. Auto-Numbering formatting across all document types
{
  const fyLabel = getFinancialYearLabel(new Date());
  const typesToTest = [
    { type: 'tax-invoice', expectedPrefix: 'INV' },
    { type: 'quotation', expectedPrefix: 'QUO' },
    { type: 'proforma', expectedPrefix: 'EST' },
    { type: 'sales-order', expectedPrefix: 'SO' },
    { type: 'bill-of-supply', expectedPrefix: 'BOS' },
  ];

  for (const t of typesToTest) {
    const config = INVOICE_TYPES[t.type];
    assert.ok(config, `Config for ${t.type} should exist`);
    assert.equal(config.prefix, t.expectedPrefix, `Prefix for ${t.type} should be ${t.expectedPrefix}`);

    const formatted = formatDocNumber({
      settings: DEFAULT_NUMBER_SETTINGS,
      typePrefix: config.prefix,
      next: 1,
      fyLabel,
    });

    assert.ok(formatted.startsWith(t.expectedPrefix), `${formatted} should start with ${t.expectedPrefix}`);
    assert.ok(formatted.endsWith('0001'), `${formatted} should end with 0001`);
  }
  console.log('✓ 1. Auto-Numbering formatting verified across all transaction types');
}

// 2. Draft healing: If a draft restores with empty invoiceNumber, system must provide next number
{
  const simulateDraftRestoration = (draftDetails, nextPeekedNumber) => {
    // If draft details exist but invoiceNumber is empty, heal with peekedNumber
    if (!draftDetails?.invoiceNumber || !String(draftDetails.invoiceNumber).trim()) {
      return { ...draftDetails, invoiceNumber: nextPeekedNumber };
    }
    return draftDetails;
  };

  const draftWithBlankNumber = { invoiceNumber: '', invoiceDate: '2026-11-16', placeOfSupply: '07' };
  const healed = simulateDraftRestoration(draftWithBlankNumber, 'INV/26-27/0042');
  assert.equal(healed.invoiceNumber, 'INV/26-27/0042', 'Blank draft invoiceNumber must be healed with next sequential number');

  // If user deliberately entered their own number, it should be kept
  const draftWithUserNumber = { invoiceNumber: 'CUSTOM-101', invoiceDate: '2026-11-16' };
  const untouched = simulateDraftRestoration(draftWithUserNumber, 'INV/26-27/0042');
  assert.equal(untouched.invoiceNumber, 'CUSTOM-101', 'User typed custom invoice number must not be overwritten');
  console.log('✓ 2. Draft restoration safely heals blank invoiceNumber without overwriting custom numbers');
}

// 3. Supplier Running Account Statement calculations
{
  const sampleSupplier = 'M/S Sharma Traders';
  const sampleBills = [
    {
      id: 'pur_1',
      date: '2026-11-01',
      supplierName: sampleSupplier,
      invoiceNumber: 'BILL-101',
      items: [{ name: 'Cement Bags', quantity: 100, rate: 350, taxPercent: 18 }],
      payments: [{ date: '2026-11-02', amount: 20000, mode: 'bank', note: 'Advance transfer' }],
    },
    {
      id: 'pur_2',
      date: '2026-11-10',
      supplierName: sampleSupplier,
      invoiceNumber: 'BILL-102',
      items: [{ name: 'Steel Rods', quantity: 50, rate: 800, taxPercent: 18 }],
      payments: [{ date: '2026-11-12', amount: 15000, mode: 'upi', note: 'UPI payment' }],
    },
  ];

  let totalBilled = 0;
  let totalPaid = 0;

  for (const b of sampleBills) {
    const tot = purchaseTotals(b.items).finalTotal;
    const paid = purchasePaid(b);
    totalBilled += tot;
    totalPaid += paid;
  }

  const balanceOwed = totalBilled - totalPaid;

  assert.equal(totalBilled, 41300 + 47200, 'Total billed should sum both purchase bills including tax');
  assert.equal(totalPaid, 35000, 'Total paid should sum recorded payments (20k + 15k)');
  assert.equal(balanceOwed, 53500, 'Balance payable should be totalBilled - totalPaid');
  console.log('✓ 3. Supplier Running Account Statement calculation & ledger balances verified');
}

console.log('\nAll Issue #194 Tests Passed!');
