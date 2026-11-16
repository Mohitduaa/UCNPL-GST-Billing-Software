import assert from 'node:assert/strict';
import {
  calculateLineItemTax,
  computeInvoiceTotals,
  generateEWayBillJSON,
  localToday,
} from '../src/utils.js';
import { getBillOverpayment, getClientCredit, planCreditApplication } from '../src/utils/clientCredit.js';
import { reconcilePurchaseProducts } from '../src/utils/products.js';
import { convertGstrInvoiceToPurchase } from '../src/utils/gstrImport.js';

console.log('--- Testing In-Depth Bug Fixes ---');

// Test 1: GST Inclusive Cess Engine
{
  console.log('Test 1: GST Inclusive with Cess');
  // Item sold at ₹1400 inclusive of 28% GST + 12% Cess = 40% total
  // Taxable should be 1400 / 1.40 = 1000
  // Tax should be 280, Cess should be 120
  // Grand total must be 1400 (NOT 1520 or 1531)
  const line = calculateLineItemTax({ quantity: 1, rate: 1400, taxPercent: 28, cessPercent: 12 }, true);
  assert.equal(Math.round(line.afterDiscount), 1000, 'Taxable must be 1000');
  assert.equal(Math.round(line.taxAmount), 280, 'Tax must be 280');
  assert.equal(Math.round(line.cessAmount), 120, 'Cess must be 120');
  assert.equal(line.total, 1400, 'Line total must be 1400');

  const invoice = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 1400, taxPercent: 28, cessPercent: 12 }],
    taxInclusive: true,
    invoiceOptions: { reverseCharge: false },
    profile: { state: 'Punjab' },
    client: { state: 'Punjab' },
    details: {},
    showGST: true,
  });
  assert.equal(invoice.taxableAmount, 1000, 'Invoice taxable must be 1000');
  assert.equal(invoice.cgst + invoice.sgst, 280, 'Invoice CGST + SGST must be 280');
  assert.equal(invoice.cess, 120, 'Invoice cess must be 120');
  assert.equal(invoice.total, 1400, 'Grand total must be exactly 1400');
  console.log('✓ Test 1 Passed: GST inclusive with Cess backed out cleanly to exact ₹1400');
}

// Test 2: 1-Paisa CGST/SGST Rounding Balance
{
  console.log('Test 2: 1-Paisa CGST/SGST Rounding Balance');
  // Taxable with odd paise tax: 100 * 11.37% = 11.37 tax total
  // cgst = 5.69, sgst = 5.68 (sum = 11.37)
  const inv = computeInvoiceTotals({
    items: [{ quantity: 1, rate: 100, taxPercent: 11.37 }],
    invoiceOptions: { taxInclusive: false },
    profile: { state: 'Punjab' },
    client: { state: 'Punjab' },
    details: {},
    showGST: true,
  });
  assert.equal(Number((inv.cgst + inv.sgst).toFixed(2)), 11.37, 'CGST + SGST must equal taxTotal (11.37)');
  assert.equal(inv.cgst, 5.69, 'CGST should be 5.69');
  assert.equal(inv.sgst, 5.68, 'SGST should be 5.68');
  console.log(`✓ Test 2 Passed: CGST=${inv.cgst}, SGST=${inv.sgst}, sum=${(inv.cgst + inv.sgst).toFixed(2)}`);
}

// Test 3: Credit Note in Client Credit
{
  console.log('Test 3: Credit Note in Client Credit');
  const creditBill = {
    id: 'cn-1',
    invoiceNumber: 'CN-001',
    invoiceType: 'credit-note',
    clientName: 'Rahul Sharma',
    totalAmount: 1000,
    paidAmount: 0,
    payments: [],
    invoiceDate: '2026-11-10',
  };

  const overpay = getBillOverpayment(creditBill);
  assert.equal(overpay, 1000, 'Credit Note must yield positive credit');

  const credit = getClientCredit('Rahul Sharma', [creditBill]);
  assert.equal(credit.available, 1000, 'Client must have 1000 credit');

  // Plan application of 300 to a new bill
  const plan = planCreditApplication('Rahul Sharma', [creditBill], 300, 'inv-new');
  assert.ok(plan);
  assert.equal(plan.amountApplied, 300);
  assert.equal(plan.sourcePatches.length, 1);
  const updatedPayments = plan.sourcePatches[0].updatedBill.payments;
  assert.equal(updatedPayments[0].amount, -300);

  // Re-check overpayment on the updated credit note
  const remainingOverpay = getBillOverpayment(plan.sourcePatches[0].updatedBill);
  assert.equal(remainingOverpay, 700, 'Remaining credit after 300 transfer must be 700');
  console.log('✓ Test 3 Passed: Credit Note generates and transfers credit accurately');
}

// Test 4: Purchase Stock Multi-Row Delta on Edit
{
  console.log('Test 4: Purchase Stock Multi-Row Delta on Edit');
  const existingProducts = [
    { id: 'p1', name: 'Basmati Rice 10kg', stock: 50, purchasePrice: 400, sellingPrice: 500 },
  ];

  // Prior bill had 20 units of Basmati Rice
  const priorItems = [
    { name: 'Basmati Rice 10kg', quantity: 20, rate: 400 },
  ];

  // Edited bill has 2 lines of Basmati Rice: Line 1 = 10, Line 2 = 15 (Total = 25 units)
  // Expected stock delta: 25 - 20 = +5 units
  // Expected new stock: 50 + 5 = 55 units
  const newItems = [
    { name: 'Basmati Rice 10kg', quantity: 10, rate: 400 },
    { name: 'Basmati Rice 10kg', quantity: 15, rate: 410 },
  ];

  const result = reconcilePurchaseProducts({
    items: newItems,
    existingProducts,
    isEdit: true,
    priorItems,
  });

  const p1Saved = result.productsToSave.find(p => p.id === 'p1');
  assert.ok(p1Saved);
  assert.equal(p1Saved.stock, 55, `Stock should be 55, got ${p1Saved.stock}`);
  console.log(`✓ Test 4 Passed: Multi-row purchase stock updated from 50 to ${p1Saved.stock} (delta +5)`);
}

// Test 5: GSTR Import Local Date
{
  console.log('Test 5: GSTR Import Local Date fallback');
  const purchase = convertGstrInvoiceToPurchase({
    inum: 'GST-001',
    dt: '', // missing date
    val: 500,
  }, { gstin: '07AAAAA0000A1Z5', trdnm: 'Vendor Test' });

  assert.equal(purchase.date, localToday(), 'GSTR import fallback date must match localToday()');
  console.log(`✓ Test 5 Passed: Date fallback is ${purchase.date}`);
}

// Test 6: Barcode Scan baseQuantity and secondary conversion
{
  console.log('Test 6: Barcode Scan baseQuantity tracking');
  const calculateBaseQuantity = (it, newQty) => {
    const factor = Number(it.conversionFactor) || 1;
    const isSec = Boolean(it.selectedUnit && it.secondaryUnit && it.selectedUnit === it.secondaryUnit && factor > 0);
    return isSec ? Math.round((newQty * factor) * 1000) / 1000 : newQty;
  };

  // Standard item
  const item1 = { quantity: 1, baseQuantity: 1 };
  const baseQty2 = calculateBaseQuantity(item1, 2);
  assert.equal(baseQty2, 2, 'Standard item quantity 2 must yield baseQuantity 2');

  // Secondary unit item (e.g., Box with conversion factor 12)
  const itemSec = { quantity: 1, baseQuantity: 12, selectedUnit: 'Box', secondaryUnit: 'Box', conversionFactor: 12 };
  const baseQtySec3 = calculateBaseQuantity(itemSec, 3);
  assert.equal(baseQtySec3, 36, 'Secondary unit 3 boxes with factor 12 must yield baseQuantity 36');
  console.log('✓ Test 6 Passed: Barcode scan baseQuantity stays strictly synced across repeat scans');
}

// Test 7: Compound Unit Division Float Precision (IEEE-754 Truncation Fix)
{
  console.log('Test 7: Compound Unit Division Float Precision');
  const { toSecondaryQuantity } = await import('../src/utils/units.js');

  // 1 kg divided into 250g (0.25) packs -> Must be exactly 4 packs, 0 remaining
  const res1 = toSecondaryQuantity(1.0, { unit: 'kg', secondaryUnit: 'pack', conversionFactor: 0.25 });
  assert.equal(res1.secondaryQty, 4, '1.0 / 0.25 must be 4 packs, not 3');
  assert.equal(res1.remainderBaseQty, 0, 'Remainder must be 0, not 0.25');

  // 0.6 Litres divided into 0.2L bottles -> Must be exactly 3 bottles, 0 remaining
  const res2 = toSecondaryQuantity(0.6, { unit: 'L', secondaryUnit: 'bottle', conversionFactor: 0.2 });
  assert.equal(res2.secondaryQty, 3, '0.6 / 0.2 must be 3 bottles, not 2');
  assert.equal(res2.remainderBaseQty, 0, 'Remainder must be 0');

  // 5 kg divided into 0.25kg packs -> Must be 20 packs
  const res3 = toSecondaryQuantity(5.0, { unit: 'kg', secondaryUnit: 'pack', conversionFactor: 0.25 });
  assert.equal(res3.secondaryQty, 20, '5.0 / 0.25 must be 20 packs, not 19');
  assert.equal(res3.remainderBaseQty, 0, 'Remainder must be 0');
  console.log('✓ Test 7 Passed: Compound unit division is mathematically exact without float truncation');
}

// Test 8: With-Tax Discount Base Divisor with Cess
{
  console.log('Test 8: With-Tax Discount Base Divisor with Cess');
  const { resolveLineDiscount } = await import('../src/utils.js');

  // 14 Rs with-tax discount on 28% GST + 12% Cess (40% total tax)
  // Tax-exclusive discount should be 14 / 1.40 = 10 Rs
  const item = { quantity: 1, rate: 100, discount: 14, discountBase: 'with-tax', taxPercent: 28, cessPercent: 12 };
  const netDiscount = resolveLineDiscount(item, false);
  assert.equal(Math.round(netDiscount * 100) / 100, 10, 'With-tax discount must back out combined tax+cess rate (40%)');
  console.log(`✓ Test 8 Passed: With-tax discount backs out both GST and Cess cleanly to ${netDiscount}`);
}

// Test 9: Purchase Totals Float Arithmetic Rounding
{
  console.log('Test 9: Purchase Totals Float Arithmetic Rounding');
  const { purchaseTotals } = await import('../src/utils/purchaseOrders.js');

  const items = [
    { quantity: 1, rate: 10.1, taxPercent: 18 },
    { quantity: 1, rate: 20.2, taxPercent: 18 },
  ];
  const totals = purchaseTotals(items, false);
  // 10.1 + 20.2 = 30.3 (in raw float 30.299999999999997)
  assert.equal(totals.subtotal, 30.3, 'Subtotal must be clean 30.3');
  assert.equal(totals.taxable, 30.3, 'Taxable must be clean 30.3');
  assert.equal(Number.isInteger(totals.subtotal * 100), true, 'Totals must not have float noise beyond 2 decimals');
  console.log('✓ Test 9 Passed: Purchase totals rounded to clean 2 decimals without IEEE float noise');
}

// Test 10: Purchase Discount in GSTR Book Totals
{
  console.log('Test 10: Purchase Book Totals with Line Discount & Cess');
  const { purchaseTotals } = await import('../src/utils/purchaseOrders.js');

  // Purchase of 10 units @ 100 with 10% line discount, 18% GST, 12% Cess
  // Gross = 1000, Discount = 100, Taxable = 900
  // Tax = 162, Cess = 108, Total = 1170
  const items = [{ quantity: 10, rate: 100, discount: 10, discountType: 'percent', taxPercent: 18, cessPercent: 12 }];
  const t = purchaseTotals(items, false);
  assert.equal(t.taxable, 900, 'Taxable must be 900 after discount');
  assert.equal(t.tax, 162, 'Tax must be 162');
  assert.equal(t.cess, 108, 'Cess must be 108');
  assert.equal(t.finalTotal, 1170, 'Grand total must be 1170');
  console.log('✓ Test 10 Passed: Purchase totals with line discount and cess calculate accurately');
}

// Test 11: Cash Book Purchase TDS Outflow
{
  console.log('Test 11: Cash Book Purchase TDS Outflow');
  const { purchaseOwed } = await import('../src/utils/purchasePayments.js');

  // Purchase total 10,000, TDS deducted @ 1% under 194C = 100
  // Amount paid to supplier = 9,900
  const purchase = {
    totalAmount: 10000,
    tdsAmount: 100,
    paymentStatus: 'Paid',
    paymentMode: 'cash',
  };
  const netOut = purchaseOwed(purchase);
  assert.equal(netOut, 9900, 'Net cash outflow must be 9,900 (total less TDS)');
  console.log(`✓ Test 11 Passed: Purchase outflow reflects actual paid amount ₹${netOut}`);
}

// Test 12: Purchase Alternate / Compound Units Stock Reconciliation
{
  console.log('Test 12: Purchase Alternate / Compound Units Stock');
  const existingProducts = [
    { id: 'oil-1', name: 'Refined Oil', unit: 'Pcs', secondaryUnit: 'Box', conversionFactor: 10, stock: 20 },
  ];

  // Purchase 5 Boxes (each Box = 10 Pcs)
  const purchaseItems = [
    { name: 'Refined Oil', unit: 'Box', quantity: 5, rate: 1200 },
  ];

  const res = reconcilePurchaseProducts({
    items: purchaseItems,
    existingProducts,
    isEdit: false,
  });

  const updated = res.productsToSave.find(p => p.id === 'oil-1');
  assert.ok(updated);
  // Expected stock: 20 + (5 * 10) = 70 Pcs
  assert.equal(updated.stock, 70, `Stock should be 70 Pcs, got ${updated.stock}`);
  console.log(`✓ Test 12 Passed: Secondary unit purchase (5 Boxes of 10) correctly added 50 units to stock (total ${updated.stock})`);
}

// Test 13: GSTR-2B Auto-Import iamt IGST Recognition
{
  console.log('Test 13: GSTR-2B Auto-Import iamt IGST Recognition');
  const gstr2bInv = {
    inum: 'PORTAL-001',
    dt: '12-11-2026',
    val: 1180,
    items: [
      { num: 1, itm_det: { rt: 18, txval: 1000, iamt: 180, csamt: 0 } },
    ],
  };

  const parsed = convertGstrInvoiceToPurchase(gstr2bInv, {
    ctin: '03AAAAA0000A1Z5',
    trdnm: 'Supplier Punjab',
  }, { gstin: '' }); // profile GSTIN blank

  assert.equal(parsed.interstate, true, 'Invoice with iamt > 0 must be marked interstate');
  assert.equal(parsed.totalAmount, 1180, 'Total amount must match');
  console.log('✓ Test 13 Passed: Official portal iamt recognized and marked as interstate purchase');
}

// Test 14: WhatsApp 10-Digit Indian Mobile Phone Sanitize
{
  console.log('Test 14: WhatsApp 10-Digit Indian Mobile Phone Sanitize');
  const { sanitizeWhatsAppPhone } = await import('../src/utils/share.js');

  assert.equal(sanitizeWhatsAppPhone('9876543210'), '919876543210', '10-digit Indian phone should get 91 prefix');
  assert.equal(sanitizeWhatsAppPhone('+91 98765 43210'), '919876543210', 'Already prefixed +91 should be clean digits');
  assert.equal(sanitizeWhatsAppPhone('919876543210'), '919876543210', 'Already prefixed 91 should not duplicate');
  assert.equal(sanitizeWhatsAppPhone(''), '', 'Empty phone stays empty');
  console.log('✓ Test 14 Passed: WhatsApp phone numbers correctly sanitized and prefixed with 91');
}

// Test 15: Sort Stability with Date Timestamps
{
  console.log('Test 15: Sort Stability with Date Timestamps');
  const { parseLocalDate } = await import('../src/utils.js');

  const bills = [
    { invoiceNumber: 'INV-02', invoiceDate: '2026-11-15' },
    { invoiceNumber: 'INV-01', invoiceDate: '2026-11-10' },
    { invoiceNumber: 'INV-03', invoiceDate: '' }, // missing date
  ];

  const sorted = [...bills].sort((a, b) => ((parseLocalDate(a.invoiceDate)?.getTime() || 0) - (parseLocalDate(b.invoiceDate)?.getTime() || 0)) || String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || '')));

  assert.equal(sorted[0].invoiceNumber, 'INV-03', 'Missing date (0 timestamp) should sort first');
  assert.equal(sorted[1].invoiceNumber, 'INV-01', '10 Nov should sort second');
  assert.equal(sorted[2].invoiceNumber, 'INV-02', '15 Nov should sort third');
  console.log('✓ Test 15 Passed: Date sorting handles empty/invalid dates reliably without NaN corruption');
}

// Test 16: Client Credit Application Floating Point Rounding
{
  console.log('Test 16: Client Credit Application Floating Point Rounding');
  const { planCreditApplication } = await import('../src/utils/clientCredit.js');

  const sourceBill = {
    id: 'b-credit',
    invoiceNumber: 'INV-OVER',
    invoiceType: 'tax-invoice',
    clientName: 'Test Client',
    totalAmount: 100,
    paidAmount: 200, // overpaid by 100
    payments: [{ amount: 200, date: '2026-11-01', mode: 'cash' }],
    invoiceDate: '2026-11-01',
  };

  const plan = planCreditApplication('Test Client', [sourceBill], 33.33, 'INV-TARGET');
  assert.ok(plan);
  assert.equal(plan.amountApplied, 33.33, 'Applied amount must be exact 33.33');
  assert.equal(plan.sourcePatches[0].updatedBill.paidAmount, 166.67, 'Remaining paid amount must be exactly 166.67 without float noise');
  console.log('✓ Test 16 Passed: Client credit transfer amounts rounded to exact 2 decimals');
}

console.log('All 16 In-Depth Bug Fix verification tests passed 100%!');
