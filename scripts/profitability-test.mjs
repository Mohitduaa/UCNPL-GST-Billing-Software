// scripts/profitability-test.mjs
// Unit tests for Profitability & Customer Insights calculation engine

import assert from 'node:assert/strict';
import {
  calculateItemProfit,
  calculateBillMargin,
  calculateBillWiseProfitList,
  calculateCustomerInsights,
} from '../src/utils/profitability.js';

console.log('Testing Profitability & Customer Insights Engine...\n');

// Mock Products catalogue
const products = [
  { id: 'p1', name: 'Premium Cotton Shirt', purchasePrice: 400, sellingPrice: 799, unit: 'Pcs' },
  { id: 'p2', name: 'Denim Jeans', purchasePrice: 650, sellingPrice: 1299, unit: 'Pcs' },
  { id: 'p3', name: 'Alteration Service', purchasePrice: 0, sellingPrice: 150, kind: 'service' },
  { id: 'p4', name: 'Product Without Cost', purchasePrice: 0, sellingPrice: 300, unit: 'Pcs' },
];

// --- 1. calculateItemProfit ---
console.log('1. calculateItemProfit()');
const item1 = { productId: 'p1', name: 'Premium Cotton Shirt', rate: 800, quantity: 2, discount: 0 };
const profit1 = calculateItemProfit(item1, products[0]);
assert.equal(profit1.hasCost, true);
assert.equal(profit1.itemRevenue, 1600);
assert.equal(profit1.itemCost, 800); // 2 * 400
assert.equal(profit1.profit, 800);
assert.equal(profit1.marginPercent, 50);

// With discount
const itemWithDiscount = { productId: 'p1', name: 'Premium Cotton Shirt', rate: 800, quantity: 2, discount: 100 };
const profitDisc = calculateItemProfit(itemWithDiscount, products[0]);
assert.equal(profitDisc.itemRevenue, 1500); // 1600 - 100
assert.equal(profitDisc.itemCost, 800);
assert.equal(profitDisc.profit, 700);
assert.equal(profitDisc.marginPercent, 46.7); // 700 / 1500 = 46.666...%

// Service item (cost 0)
const serviceItem = { productId: 'p3', name: 'Alteration Service', rate: 150, quantity: 1, discount: 0 };
const profitService = calculateItemProfit(serviceItem, products[2]);
assert.equal(profitService.itemCost, 0);
assert.equal(profitService.profit, 150);

// Item without cost
const noCostItem = { productId: 'p4', name: 'Product Without Cost', rate: 300, quantity: 1 };
const profitNoCost = calculateItemProfit(noCostItem, products[3]);
assert.equal(profitNoCost.hasCost, false);
console.log('   ✓ Single item profit & margin calculation passed');

// --- 2. calculateBillMargin ---
console.log('2. calculateBillMargin()');
const billItems = [
  { productId: 'p1', name: 'Premium Cotton Shirt', rate: 800, quantity: 2, discount: 0 },
  { productId: 'p2', name: 'Denim Jeans', rate: 1200, quantity: 1, discount: 0 },
];
// Total cost = (2 * 400) + (1 * 650) = 800 + 650 = 1450
// Total revenue = 2800
// Profit = 2800 - 1450 = 1350
// Margin = 1350 / 2800 = 48.2%
const billMargin = calculateBillMargin(billItems, 2800, products);
assert.equal(billMargin.totalCost, 1450);
assert.equal(billMargin.revenue, 2800);
assert.equal(billMargin.profit, 1350);
assert.equal(billMargin.marginPercent, 48.2);
assert.equal(billMargin.hasCostData, true);

// Negative margin check (loss sale)
const lossBill = calculateBillMargin(billItems, 1200, products); // Sold below 1450 cost
assert.equal(lossBill.profit, -250);
assert.equal(lossBill.marginPercent, -20.8);
console.log('   ✓ Bill-level margin & loss calculation passed');

// --- 3. calculateBillWiseProfitList ---
console.log('3. calculateBillWiseProfitList()');
const bills = [
  {
    id: 'b1',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-11-01',
    clientName: 'Rahul Verma',
    totalAmount: 2800,
    data: { items: billItems },
  },
  {
    id: 'b2',
    invoiceNumber: 'INV-002',
    invoiceDate: '2026-11-05',
    clientName: 'Sunita Mehra',
    totalAmount: 1000,
    data: { items: [{ productId: 'p1', name: 'Premium Cotton Shirt', rate: 1000, quantity: 1 }] },
  },
  {
    id: 'b3',
    invoiceNumber: 'INV-003',
    invoiceDate: '2026-11-10',
    clientName: 'Cancelled Order',
    status: 'cancelled',
    totalAmount: 500,
    data: { items: [{ productId: 'p1', name: 'Premium Cotton Shirt', rate: 500, quantity: 1 }] },
  },
];

const profitList = calculateBillWiseProfitList(bills, products);
assert.equal(profitList.length, 2, 'Cancelled bills must be excluded');
assert.equal(profitList[0].invoiceNumber, 'INV-002');
assert.equal(profitList[0].cost, 400);
assert.equal(profitList[0].profit, 600);
assert.equal(profitList[0].marginPercent, 60);

assert.equal(profitList[1].invoiceNumber, 'INV-001');
assert.equal(profitList[1].cost, 1450);
assert.equal(profitList[1].profit, 1350);
console.log('   ✓ Bill-wise profit breakdown list passed');

// --- 4. calculateCustomerInsights ---
console.log('4. calculateCustomerInsights()');
const customerBills = [
  { id: '1', clientName: 'Amit Kumar', invoiceDate: '2026-08-01', totalAmount: 1500 }, // Dormant (>60 days before Nov 12)
  { id: '2', clientName: 'Rohan Sharma', invoiceDate: '2026-11-01', totalAmount: 2000 }, // Repeat
  { id: '3', clientName: 'Rohan Sharma', invoiceDate: '2026-11-10', totalAmount: 1000 }, // Repeat
  { id: '4', clientName: 'Priya Singh', invoiceDate: '2026-11-08', totalAmount: 3500 },  // Single
];

const insights = calculateCustomerInsights(customerBills, '2026-11-12');
assert.equal(insights.totalCustomers, 3); // Amit, Rohan, Priya
assert.equal(insights.repeatCustomers, 1); // Rohan Sharma (2 bills)
assert.equal(insights.repeatRate, 33.3);   // 1 / 3 = 33.3%
assert.equal(insights.dormantCustomers.length, 1); // Amit Kumar
assert.equal(insights.dormantCustomers[0].name, 'Amit Kumar');
console.log('   ✓ Customer insights & retention analytics passed');

console.log('\nAll Profitability & Customer Insights tests passed successfully!');
