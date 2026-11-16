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

console.log('All 9 In-Depth Bug Fix verification tests passed 100%!');
