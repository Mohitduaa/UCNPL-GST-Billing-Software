import assert from 'node:assert/strict';
import {
  normalizeMigrationRows,
  detectEntityType,
  getCanonicalFields,
  fillClientBlanks,
  buildMigrationPlan,
} from '../src/utils/migrationParsers.js';

console.log('Testing migration parser normalization...');

// 1. QuickBooks Customers export format
const qbCustomers = [
  ['Customer', 'Company', 'Phone Numbers', 'Email', 'Billing Address', 'GSTIN'],
  ['Acme Traders', 'Acme Ltd', '9876543210', 'info@acme.com', '123 Market St, Mumbai', '27AABCA1234A1Z5'],
];
const qbResult = normalizeMigrationRows(qbCustomers, 'quickbooks', 'clients');
assert.equal(qbResult.records.length, 1);
assert.equal(qbResult.records[0].name, 'Acme Traders');
assert.equal(qbResult.records[0].phone, '9876543210');
assert.equal(qbResult.records[0].gstin, '27AABCA1234A1Z5');

// 2. Xero Items export format
const xeroItems = [
  ['ItemCode', 'ItemName', 'SalesUnitPrice', 'PurchasesUnitPrice', 'TaxRate'],
  ['ITM001', 'Cotton Shirt', '999.00', '450.00', '5%'],
];
const xeroResult = normalizeMigrationRows(xeroItems, 'xero', 'products');
assert.equal(xeroResult.records.length, 1);
assert.equal(xeroResult.records[0].name, 'Cotton Shirt');
assert.equal(xeroResult.records[0].sellingPrice, '999.00');

// 3. myBillBook Parties export format
const myBillBookParties = [
  ['Party Name', 'GST No', 'Mobile Number', 'Billing Address', 'State'],
  ['Rajesh Enterprises', '07AAAAA0000A1Z5', '9811122233', 'Connaught Place', 'Delhi'],
];
const mbbResult = normalizeMigrationRows(myBillBookParties, 'mybillbook', 'clients');
assert.equal(mbbResult.records.length, 1);
assert.equal(mbbResult.records[0].name, 'Rajesh Enterprises');
assert.equal(mbbResult.records[0].gstin, '07AAAAA0000A1Z5');
assert.equal(mbbResult.records[0].state, 'Delhi');

// 4. Busy Accounts export format
const busyAccounts = [
  ['Account Name', 'Print Name', 'Address 1', 'GST No.', 'Mobile', 'State'],
  ['Metro Retailers', 'Metro', 'Ring Road', '24AAACM1234A1Z1', '9898989898', 'Gujarat'],
];
const busyResult = normalizeMigrationRows(busyAccounts, 'busy', 'clients');
assert.equal(busyResult.records.length, 1);
assert.equal(busyResult.records[0].name, 'Metro Retailers');
assert.equal(busyResult.records[0].gstin, '24AAACM1234A1Z1');
assert.equal(busyResult.records[0].phone, '9898989898');
assert.equal(busyResult.records[0].state, 'Gujarat');

// 5. Wave Customers export format
const waveCustomers = [
  ['Customer Name', 'Email', 'Phone', 'Address Line 1', 'Postal Code', 'Country'],
  ['Global Solutions Inc', 'contact@globalsol.com', '+1-555-0199', '500 Tech Blvd', '94105', 'United States'],
];
const waveResult = normalizeMigrationRows(waveCustomers, 'wave', 'clients');
assert.equal(waveResult.records.length, 1);
assert.equal(waveResult.records[0].name, 'Global Solutions Inc');
assert.equal(waveResult.records[0].email, 'contact@globalsol.com');
assert.equal(waveResult.records[0].pincode, '94105');

// 6. Zoho Books Items export format
const zohoItems = [
  ['Item Name', 'SKU', 'Selling Price', 'Purchase Price', 'Intra State Tax Rate', 'Usage Unit'],
  ['Wireless Mouse', 'WM-100', '799.00', '420.00', '18%', 'PCS'],
];
const zohoResult = normalizeMigrationRows(zohoItems, 'zoho-books', 'products');
assert.equal(zohoResult.records.length, 1);
assert.equal(zohoResult.records[0].name, 'Wireless Mouse');
assert.equal(zohoResult.records[0].barcode, 'WM-100');
assert.equal(zohoResult.records[0].sellingPrice, '799.00');
assert.equal(zohoResult.records[0].unit, 'PCS');

// 7. Universal Sales Invoices format
const invoiceRows = [
  ['Invoice Number', 'Invoice Date', 'Customer', 'Item', 'Qty', 'Rate', 'GST %'],
  ['INV-2026-001', '2026-11-15', 'Acme Traders', 'Cotton Shirt', '2', '999.00', '5%'],
];
const invResult = normalizeMigrationRows(invoiceRows, 'universal', 'invoices');
assert.equal(invResult.records.length, 1);
assert.equal(invResult.records[0].invoiceNumber, 'INV-2026-001');
assert.equal(invResult.records[0].clientName, 'Acme Traders');
assert.equal(invResult.records[0].itemName, 'Cotton Shirt');
assert.equal(invResult.records[0].quantity, '2');

// 8. Auto-detection of entity types
assert.equal(detectEntityType(qbCustomers), 'clients');
assert.equal(detectEntityType(xeroItems), 'products');
assert.equal(detectEntityType(invoiceRows), 'invoices');

// 9. Auto-detection in normalizeMigrationRows when entityType is omitted
const autoResult = normalizeMigrationRows(xeroItems, 'xero');
assert.equal(autoResult.entityType, 'products');
assert.equal(autoResult.records.length, 1);
assert.equal(autoResult.records[0].name, 'Cotton Shirt');

// 10. CSV string input support
const csvText = 'Party Name,GST No,Mobile Number\nSharma Stores,08AAACS1234A1Z9,9822334455\n';
const csvResult = normalizeMigrationRows(csvText, 'universal', 'clients');
assert.equal(csvResult.records.length, 1);
assert.equal(csvResult.records[0].name, 'Sharma Stores');
assert.equal(csvResult.records[0].gstin, '08AAACS1234A1Z9');

// 11. Canonical fields helper
const clientFields = getCanonicalFields('clients');
assert.ok(clientFields.name.includes('customer'));
assert.ok(clientFields.gstin.includes('gst no'));

// 12. Marg ERP Ledgers and Stock Items
const margLedgers = [
  ['Ledger Name', 'Station/City', 'Address', 'Phone', 'GSTIN'],
  ['Apollo Pharmacy', 'Jaipur', 'MI Road', '0141234567', '08AABCA1234A1Z2'],
];
const margResult = normalizeMigrationRows(margLedgers, 'marg', 'clients');
assert.equal(margResult.records.length, 1);
assert.equal(margResult.records[0].name, 'Apollo Pharmacy');
assert.equal(margResult.records[0].city, 'Jaipur');
assert.equal(margResult.records[0].gstin, '08AABCA1234A1Z2');

// 13. Safe and non-destructive client blank-filling
const savedClient = {
  id: 'c-1',
  name: 'Acme Traders',
  phone: '9876543210',
  gstin: '', // missing
  address: '', // missing
};
const freshClient = {
  name: 'Acme Traders',
  phone: '0000000000', // should NOT overwrite saved phone
  gstin: '27AABCA1234A1Z5',
  address: '123 Market St, Mumbai',
};
const updated = fillClientBlanks(savedClient, freshClient);
assert.ok(updated);
assert.equal(updated.phone, '9876543210', 'Existing non-blank phone must be preserved');
assert.equal(updated.gstin, '27AABCA1234A1Z5', 'Blank GSTIN must be filled');
assert.equal(updated.address, '123 Market St, Mumbai', 'Blank address must be filled');

// 14. buildMigrationPlan scorecard
const existingClients = [savedClient];
const plan = buildMigrationPlan(qbResult, { clients: existingClients });
assert.equal(plan.scorecard.total, 1);
assert.equal(plan.scorecard.readyToAdd, 0);
assert.equal(plan.scorecard.readyToUpdate, 1);
assert.equal(plan.updatedItems.length, 1);
assert.equal(plan.updatedItems[0].gstin, '27AABCA1234A1Z5');

// 15. Skip title rows (Vyapar / Busy style reports)
const rowsWithTitle = [
  ['ACME TRADING COMPANY - CUSTOMER MASTER REPORT'],
  ['Generated on: 2026-11-16'],
  ['Customer', 'GSTIN', 'Phone Numbers'],
  ['Super Traders', '29AAAAA0000A1Z5', '9845098450'],
];
const titleResult = normalizeMigrationRows(rowsWithTitle, 'busy', 'clients');
assert.equal(titleResult.records.length, 1);
assert.equal(titleResult.records[0].name, 'Super Traders');

console.log('✓ Migration parser normalization passed all checks!');
