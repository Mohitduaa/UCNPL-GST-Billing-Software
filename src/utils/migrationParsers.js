/**
 * Multi-Country Data Migration & Header Aliases Normalization Engine
 * 
 * Supports India & Global accounting software:
 * - India: Tally Prime, Busy, Vyapar, myBillBook, Marg ERP 9+, Govt GST Portal
 * - Global: QuickBooks (Intuit), Xero, Zoho Books, Wave Accounting, Universal CSV/XLSX
 * 
 * Strictly zero AI icons or references.
 * Pure JavaScript module. Offline and client-side processing only.
 */

import { parseCsv, rowsToRecords, toNum, percentPart } from './bulkCsv.js';

// Canonical header aliases for Parties / Clients / Customers / Vendors
export const CLIENT_ALIASES = {
  name: [
    'customer', 'customer name', 'client name', 'client', 'party name', 'party',
    'account name', 'ledger name', 'contact name', 'contactname', 'name',
    'display name', 'company', 'company name', 'business name',
    'vendor', 'vendor name', 'supplier', 'supplier name', 'buyer', 'buyer name',
  ],
  company: [
    'company', 'company name', 'business name', 'trade name', 'legal name',
    'organization', 'organisation',
  ],
  gstin: [
    'gstin', 'gst no', 'gst no.', 'gst number', 'gstin/uin', 'gstin / uin', 'gst',
    'tax id', 'tax number', 'taxno', 'vat id', 'vat no', 'vat number', 'vat reg no',
    'vat registration number', 'trn', 'tax registration number',
    'gst identification number (gstin)', 'gst identification number',
    'tax identification number', 'tin',
  ],
  phone: [
    'phone numbers', 'phone number', 'phone no', 'phone no.', 'phone',
    'mobile number', 'mobile no', 'mobile no.', 'mobile', 'contact no', 'contact no.',
    'party phone no', 'party phone no.', 'work phone', 'mobile phone', 'primary phone',
    'telephone', 'phonenumber', 'mobilenumber', 'contact', 'cell', 'cell phone',
    'phone 1', 'primary mobile',
  ],
  email: [
    'email', 'email address', 'email id', 'primary email', 'contact email',
    'emailaddress', 'mail', 'emailid',
  ],
  address: [
    'billing address', 'address', 'bill to address', 'street address', 'billing street',
    'customer address', 'party address', 'address line 1', 'address line1', 'address 1',
    'street', 'billingaddress', 'postaladdress', 'address 1 / street', 'registered address',
  ],
  state: [
    'state', 'billing state', 'state name', 'state / province', 'place of supply',
    'pos', 'state code', 'billingstate', 'region', 'province', 'billing province',
  ],
  city: [
    'city', 'billing city', 'town', 'billingcity', 'station/city', 'station', 'district',
  ],
  country: [
    'country', 'billing country', 'country/region', 'billingcountry', 'nation',
  ],
  pincode: [
    'pincode', 'pin code', 'postal code', 'zip code', 'zip', 'billing zip',
    'postalcode', 'billing code', 'post code',
  ],
  pan: [
    'pan', 'pan number', 'pan no', 'pan no.', 'it pan',
  ],
  openingBalance: [
    'opening balance', 'opening bal', 'open balance', 'op bal', 'op. bal.',
    'balance', 'openingbalance', 'current balance',
  ],
};

// Canonical header aliases for Products / Items / Stock / Services
export const PRODUCT_ALIASES = {
  name: [
    'item name', 'itemname', 'product name', 'product/service', 'product',
    'item', 'item description', 'description', 'particulars', 'name',
    'service', 'service name', 'product title', 'item title',
  ],
  sellingPrice: [
    'salesunitprice', 'sales unit price', 'sale price', 'selling price',
    'sales price', 'rate', 'price', 'unit price', 'unitprice', 'price/unit',
    'price per unit', 'mrp', 'standard rate', 'sellingprice', 'saleprice',
    'sales rate', 'item price',
  ],
  purchasePrice: [
    'purchasesunitprice', 'purchases unit price', 'purchase price', 'purchase rate',
    'cost price', 'cost', 'buy price', 'purchaseprice', 'purchaserate',
    'costprice', 'pur. price', 'pur price', 'buying price', 'purchase unit price',
  ],
  barcode: [
    'itemcode', 'item code', 'barcode', 'bar code', 'sku', 'ean', 'upc',
    'code', 'product code', 'part number', 'item number', 'item no', 'item no.',
  ],
  taxPercent: [
    'taxrate', 'tax rate', 'salestaxrate', 'gst rate', 'gst %', 'gst%',
    'tax %', 'tax%', 'tax percent', 'taxpercent', 'tax', 'vat rate', 'vat %',
    'vat', 'tax category', 'gst', 'intra state tax rate', 'intra state tax',
  ],
  cessPercent: [
    'cess %', 'cess', 'cess rate', 'cess percent',
  ],
  hsn: [
    'hsn', 'hsn code', 'sac', 'sac code', 'hsn/sac', 'hsn code/sac code',
    'tax code', 'commodity code', 'hsn/sac code',
  ],
  unit: [
    'unit', 'uom', 'measuring unit', 'base unit', 'usage unit',
    'unit of measure', 'uqc', 'packing/unit', 'packing', 'measurement unit',
  ],
  stock: [
    'opening stock', 'opening stock quantity', 'opening qty', 'qty on hand',
    'quantity on hand', 'stock quantity', 'stock', 'quantity', 'current stock',
    'available qty', 'op stock', 'op. stock', 'openingstock', 'qty in stock', 'inventory',
  ],
  description: [
    'description', 'item description', 'sales description', 'product description',
    'details', 'notes', 'item details',
  ],
  type: [
    'type', 'kind', 'goods or service', 'goods/service', 'product type', 'item type',
  ],
  taxInclusive: [
    'tax inclusive', 'tax inclusive (y/n)', 'inclusive of tax',
    'price includes tax', 'is tax inclusive',
  ],
  brand: [
    'brand', 'company', 'make', 'brand name', 'manufacturer',
  ],
  category: [
    'category', 'prime category', 'main category', 'product category',
    'item category', 'group', 'item group', 'sub category', 'subcategory',
  ],
};

// Canonical header aliases for Sales Invoices
export const INVOICE_ALIASES = {
  invoiceNumber: [
    'invoice number', 'invoice no', 'invoice no.', 'inv no', 'inv no.',
    'bill no', 'bill no.', 'number', 'invoice #', 'invoice no./txn no.',
    'vch no.', 'vch no', 'voucher no', 'voucher number', 'invoicenumber',
    'txn number', 'transaction number', 'reference', 'doc no', 'document no',
  ],
  invoiceDate: [
    'invoice date', 'date', 'bill date', 'vch date', 'voucher date',
    'invoicedate', 'transaction date', 'txn date', 'document date',
  ],
  dueDate: [
    'due date', 'due', 'duedate', 'payment due date', 'expiry date',
  ],
  invoiceType: [
    'invoice type', 'type', 'document type', 'transaction type', 'voucher type',
  ],
  clientName: [
    'client name', 'client', 'customer', 'customer name', 'party',
    'party name', 'buyer', 'buyer name', 'contact name', 'contactname',
    'account name', 'bill to',
  ],
  clientGstin: [
    'client gstin', 'gstin', 'customer gstin', 'party gstin', 'buyer gstin',
    'tax id', 'vat number', 'vat id', 'taxnumber', 'customer tax id',
  ],
  clientPhone: [
    'client phone', 'phone', 'mobile', 'customer phone', 'mobile number',
    'contact no', 'phone number',
  ],
  clientEmail: [
    'client email', 'email', 'customer email', 'email address',
  ],
  clientAddress: [
    'client address', 'address', 'billing address', 'customer address', 'party address',
  ],
  clientState: [
    'client state', 'state', 'customer state', 'party state', 'place of supply', 'pos',
  ],
  clientCountry: [
    'client country', 'country', 'customer country',
  ],
  placeOfSupply: [
    'place of supply', 'pos',
  ],
  itemName: [
    'item name', 'item', 'product', 'product/service', 'description',
    'particulars', 'itemname', 'item description',
  ],
  hsn: [
    'hsn/sac', 'hsn', 'sac', 'hsn code', 'sac code',
  ],
  quantity: [
    'quantity', 'qty', 'units', 'volume',
  ],
  unit: [
    'unit', 'uom', 'uqc',
  ],
  rate: [
    'rate', 'price', 'unit price', 'unitprice', 'sales price',
    'price/unit', 'price per unit', 'salesunitprice', 'item rate',
  ],
  discount: [
    'discount', 'discount amount', 'discount %', 'disc', 'disc %', 'discount value',
  ],
  taxPercent: [
    'gst rate', 'tax rate', 'tax percent', 'gst %', 'tax %', 'gst',
    'tax', 'taxrate', 'vat rate', 'vat %',
  ],
  cessPercent: [
    'cess %', 'cess', 'cess rate',
  ],
  taxInclusive: [
    'prices include tax', 'tax inclusive', 'inclusive', 'tax included',
  ],
  notes: [
    'notes', 'note', 'remarks', 'memo',
  ],
  billDiscount: [
    'bill discount', 'invoice discount',
  ],
  roundOff: [
    'round off', 'round-off', 'rounding',
  ],
  total: [
    'total', 'amount', 'net amount', 'invoice amount', 'line total', 'total amount', 'bill amount',
  ],
};

// Canonical header aliases for Purchase Bills
export const PURCHASE_ALIASES = {
  invoiceNumber: [
    'bill number', 'bill no', 'bill no.', 'purchase bill no', 'invoice number',
    'invoice no', 'inv no', 'reference', 'vch no', 'vch no.', 'voucher no',
    'supplier invoice no', 'vendor bill no', 'vendor invoice no',
  ],
  invoiceDate: [
    'bill date', 'date', 'purchase date', 'invoice date', 'vch date', 'voucher date',
  ],
  dueDate: [
    'due date', 'due', 'payment due date',
  ],
  clientName: [
    'supplier name', 'supplier', 'vendor name', 'vendor', 'party name',
    'party', 'creditor name', 'account name', 'contact name', 'seller name',
  ],
  clientGstin: [
    'supplier gstin', 'gstin', 'vendor gstin', 'party gstin', 'tax id', 'vat number',
  ],
  itemName: [
    'item name', 'item', 'product', 'description', 'particulars', 'itemname',
  ],
  hsn: [
    'hsn/sac', 'hsn', 'sac', 'hsn code',
  ],
  quantity: [
    'quantity', 'qty',
  ],
  unit: [
    'unit', 'uom',
  ],
  rate: [
    'rate', 'price', 'unit price', 'cost price', 'purchase rate',
    'purchasesunitprice', 'cost', 'purchase price',
  ],
  discount: [
    'discount', 'discount amount', 'disc',
  ],
  taxPercent: [
    'gst rate', 'tax rate', 'gst %', 'tax %', 'gst', 'tax', 'taxrate',
  ],
  cessPercent: [
    'cess %', 'cess',
  ],
  total: [
    'total', 'amount', 'net amount', 'bill amount',
  ],
};

const norm = (h) => String(h || '').toLowerCase().replace(/[\s_\-.%()/#*]+/g, '');

/**
 * Standardize entity type names into one of 4 canonical entities:
 * 'clients' | 'products' | 'invoices' | 'purchases'
 */
export function normalizeEntityType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (/^(client|clients|party|parties|customer|customers|vendor|vendors|debtor|debtors|creditor|creditors)$/.test(t)) {
    return 'clients';
  }
  if (/^(product|products|item|items|inventory|stock|service|services)$/.test(t)) {
    return 'products';
  }
  if (/^(invoice|invoices|sale|sales|bill|bills)$/.test(t)) {
    return 'invoices';
  }
  if (/^(purchase|purchases|purchase-bill|purchase-bills|purchasebill|purchasebills|expense|expenses)$/.test(t)) {
    return 'purchases';
  }
  return 'clients';
}

/**
 * Retrieve canonical fields dictionary for a given entity type.
 * @param {'clients' | 'products' | 'invoices' | 'purchases'} entityType
 * @returns {Record<string, string[]>}
 */
export function getCanonicalFields(entityType) {
  const t = normalizeEntityType(entityType);
  switch (t) {
    case 'products':
      return PRODUCT_ALIASES;
    case 'invoices':
      return INVOICE_ALIASES;
    case 'purchases':
      return PURCHASE_ALIASES;
    case 'clients':
    default:
      return CLIENT_ALIASES;
  }
}

function countHits(headerCells, aliasesDict) {
  const wanted = new Set(Object.values(aliasesDict).flat().map(norm));
  return headerCells.filter((c) => wanted.has(c)).length;
}

function hasAny(headerCells, targets) {
  return targets.some((t) => headerCells.includes(t));
}

/**
 * Detect the entity type (clients, products, invoices, purchases) from raw table rows.
 * Inspects header row candidates among the first 8 lines.
 * 
 * @param {Array<Array<any>> | string} rows - Raw table rows or CSV text.
 * @returns {'clients' | 'products' | 'invoices' | 'purchases'}
 */
export function detectEntityType(rows) {
  const table = (Array.isArray(rows) ? rows : parseCsv(rows))
    .map((r) => (Array.isArray(r) ? r : []))
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''));

  if (table.length < 1) return 'clients';

  // Search first 8 rows for candidate header
  let bestHeader = null;
  let maxScore = -1;

  for (const r of table.slice(0, 8)) {
    const cells = r.map(norm);
    const clientHits = countHits(cells, CLIENT_ALIASES);
    const productHits = countHits(cells, PRODUCT_ALIASES);
    const invoiceHits = countHits(cells, INVOICE_ALIASES);
    const purchaseHits = countHits(cells, PURCHASE_ALIASES);
    const hits = Math.max(clientHits, productHits, invoiceHits, purchaseHits);
    if (hits > maxScore) {
      maxScore = hits;
      bestHeader = cells;
    }
  }

  if (!bestHeader) return 'clients';

  // Check strong indicators
  const hasInvNum = hasAny(bestHeader, ['invoicenumber', 'invoiceno', 'billno', 'vchno', 'invoicetxnno', 'docno', 'voucherno']);
  const hasSupplier = hasAny(bestHeader, ['supplier', 'suppliername', 'vendor', 'vendorname', 'creditorname']);
  const hasCustomer = hasAny(bestHeader, ['customer', 'customername', 'client', 'clientname', 'party', 'partyname', 'buyer']);
  const hasPartyDetails = hasAny(bestHeader, ['gstin', 'gstno', 'mobilenumber', 'phonenumber', 'phonenumbers', 'billingaddress', 'emailaddress']);

  if (hasInvNum) {
    if (hasSupplier && !hasCustomer) return 'purchases';
    return 'invoices';
  }

  // Strong product indicators
  const strongProductCols = hasAny(bestHeader, [
    'itemcode', 'salesunitprice', 'purchasesunitprice', 'openingstock', 'openingqty',
    'qtyonhand', 'hsn', 'hsncode', 'sac', 'barcode', 'sku', 'mrp', 'saleprice',
  ]);

  if (strongProductCols && !hasPartyDetails) {
    return 'products';
  }

  // Strong client indicators
  const strongClientCols = hasAny(bestHeader, [
    'customer', 'client', 'partyname', 'gstin', 'gstno', 'mobilenumber',
    'phonenumbers', 'billingaddress', 'contactname',
  ]);

  if (strongClientCols && !strongProductCols) {
    return 'clients';
  }

  // Fallback to highest hit count
  const cScore = countHits(bestHeader, CLIENT_ALIASES);
  const pScore = countHits(bestHeader, PRODUCT_ALIASES);
  const iScore = countHits(bestHeader, INVOICE_ALIASES);
  const puScore = countHits(bestHeader, PURCHASE_ALIASES);

  if (pScore > cScore && pScore > iScore && pScore > puScore) return 'products';
  if (iScore > cScore && iScore > pScore && iScore > puScore) return 'invoices';
  if (puScore > cScore && puScore > pScore && puScore > iScore) return 'purchases';
  return 'clients';
}

/**
 * Normalizes raw table rows from any accounting software into canonical records.
 * 
 * @param {Array<Array<any>> | string} rows - Spreadsheet rows or CSV text.
 * @param {string} [softwareId='universal'] - Source software identifier.
 * @param {'clients' | 'products' | 'invoices' | 'purchases' | 'auto'} [entityType='auto'] - Target entity.
 * @returns {{
 *   records: Array<Record<string, string>>,
 *   valid: Array<Record<string, string>>,
 *   errors: string[],
 *   missing: string[],
 *   unknown: string[],
 *   colOf: Record<string, number>,
 *   entityType: string,
 *   softwareId: string,
 *   total: number,
 *   validCount: number
 * }}
 */
export function normalizeMigrationRows(rows, softwareId = 'universal', entityType = null) {
  const normType = entityType && entityType !== 'auto'
    ? normalizeEntityType(entityType)
    : detectEntityType(rows);

  const fields = getCanonicalFields(normType);
  const parsed = rowsToRecords(rows, fields);
  const rawRecords = parsed.records || [];
  const colOf = parsed.colOf || {};
  const unknown = parsed.unknown || [];

  const requiredField =
    normType === 'clients' ? 'name' :
    normType === 'products' ? 'name' :
    normType === 'invoices' ? 'invoiceNumber' :
    'invoiceNumber';

  const missing = [];
  if (colOf[requiredField] === undefined) {
    missing.push(requiredField);
  }

  const errors = [];
  const valid = [];
  const records = [];

  for (const r of rawRecords) {
    const item = { ...r };

    if (normType === 'clients') {
      // If Customer name was blank but Company was provided
      if (!item.name && item.company) item.name = item.company;
      if (item.name) item.name = String(item.name).trim();
      if (item.gstin) item.gstin = String(item.gstin).trim().toUpperCase();
      if (item.phone) item.phone = String(item.phone).trim().replace(/^'+/, '');
      if (item.email) item.email = String(item.email).trim().toLowerCase();
      if (item.address) item.address = String(item.address).trim();
      if (item.state) item.state = String(item.state).trim();
      if (item.country) item.country = String(item.country).trim();
      if (item.city) item.city = String(item.city).trim();
      if (item.pincode) item.pincode = String(item.pincode).trim();
      if (item.pan) item.pan = String(item.pan).trim().toUpperCase();

      if (!item.name) {
        errors.push(`Row ${item._line}: Missing party / client name`);
      } else {
        valid.push(item);
      }
    } else if (normType === 'products') {
      if (item.name) item.name = String(item.name).trim();
      // Mirror sellingPrice and rate
      if (item.sellingPrice && !item.rate) item.rate = item.sellingPrice;
      if (item.rate && !item.sellingPrice) item.sellingPrice = item.rate;
      if (item.barcode) item.barcode = String(item.barcode).trim();
      if (item.hsn) item.hsn = String(item.hsn).trim();
      if (item.unit) item.unit = String(item.unit).trim();
      if (item.brand) item.brand = String(item.brand).trim();
      if (item.category) item.category = String(item.category).trim();

      if (!item.name) {
        errors.push(`Row ${item._line}: Missing product / item name`);
      } else {
        valid.push(item);
      }
    } else {
      // Invoices & Purchases
      if (item.invoiceNumber) item.invoiceNumber = String(item.invoiceNumber).trim();
      if (item.clientName) item.clientName = String(item.clientName).trim();
      if (item.itemName) item.itemName = String(item.itemName).trim();
      if (item.quantity) item.quantity = String(item.quantity).trim();
      if (item.rate) item.rate = String(item.rate).trim();

      if (!item.invoiceNumber) {
        errors.push(`Row ${item._line}: Missing invoice / bill number`);
      } else {
        valid.push(item);
      }
    }

    records.push(item);
  }

  return {
    records,
    valid,
    errors,
    missing,
    unknown,
    colOf,
    entityType: normType,
    softwareId: String(softwareId || 'universal').toLowerCase(),
    total: records.length,
    validCount: valid.length,
  };
}

const CLIENT_FILL_FIELDS = ['gstin', 'phone', 'email', 'address', 'state', 'country', 'city', 'pincode', 'pan'];

/**
 * Fills blank fields in an existing client from fresh migration data.
 * Safe and non-destructive: existing non-empty fields are NEVER overwritten.
 * 
 * @param {object} saved - Existing client object in database.
 * @param {object} fresh - Fresh imported client data.
 * @returns {object | null} Updated client object with filled blanks, or null if no change.
 */
export function fillClientBlanks(saved, fresh) {
  if (!saved || !fresh) return null;
  const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
  const add = {};
  for (const field of CLIENT_FILL_FIELDS) {
    if (isBlank(saved[field]) && !isBlank(fresh[field])) {
      add[field] = fresh[field];
    }
  }
  return Object.keys(add).length ? { ...saved, ...add } : null;
}

/**
 * High-level scorecard and migration plan builder for UI preview and batch execution.
 * 
 * @param {ReturnType<typeof normalizeMigrationRows>} normalized
 * @param {{
 *   clients?: any[],
 *   products?: any[],
 *   bills?: any[],
 *   purchases?: any[],
 *   opts?: { updateExisting?: boolean, adjustStock?: boolean }
 * }} context
 */
export function buildMigrationPlan(normalized, { clients = [], products = [], bills = [], purchases = [], opts = {} } = {}) {
  const normType = normalized.entityType;
  const records = normalized.valid;

  if (normType === 'clients') {
    const key = (n) => String(n || '').trim().toLowerCase();
    const saved = new Map(clients.map((c) => [key(c.name), c]));
    const seen = new Set();
    const newClients = [];
    const updatedClients = [];
    let skipped = 0;

    for (const r of records) {
      const k = key(r.name);
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k);

      const old = saved.get(k);
      if (!old) {
        newClients.push({
          name: r.name,
          address: r.address || '',
          state: r.state || '',
          gstin: r.gstin || '',
          email: r.email || '',
          phone: r.phone || '',
          country: r.country || '',
          city: r.city || '',
          pincode: r.pincode || '',
          pan: r.pan || '',
        });
      } else {
        const updated = fillClientBlanks(old, r);
        if (updated) updatedClients.push(updated);
        else skipped++;
      }
    }

    return {
      entityType: 'clients',
      softwareId: normalized.softwareId,
      scorecard: {
        total: normalized.total,
        readyToAdd: newClients.length,
        readyToUpdate: updatedClients.length,
        skipped,
        errors: normalized.errors.length,
      },
      newItems: newClients,
      updatedItems: updatedClients,
      errors: normalized.errors,
    };
  }

  if (normType === 'products') {
    const key = (n) => String(n || '').trim().toLowerCase();
    const saved = new Map(products.map((p) => [key(p.name), p]));
    const seen = new Set();
    const newProducts = [];
    const updatedProducts = [];
    let skipped = 0;

    for (const r of records) {
      const k = key(r.name);
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k);

      const old = saved.get(k);
      const sPrice = toNum(r.sellingPrice, 0);
      const pPrice = toNum(r.purchasePrice, 0);
      const taxRate = toNum(percentPart(r.taxPercent), 0);
      const stockQty = toNum(r.stock, 0);

      const product = {
        name: r.name,
        sellingPrice: sPrice,
        rate: sPrice,
        purchasePrice: pPrice,
        taxPercent: taxRate,
        unit: r.unit || 'Nos',
        hsn: r.hsn || '',
        stock: stockQty,
        barcode: r.barcode || '',
        description: r.description || '',
        brand: r.brand || '',
        category: r.category || '',
      };

      if (!old) {
        newProducts.push(product);
      } else {
        // Safe fill blanks
        const add = {};
        if (!old.hsn && product.hsn) add.hsn = product.hsn;
        if (!old.barcode && product.barcode) add.barcode = product.barcode;
        if (!old.description && product.description) add.description = product.description;
        if ((!old.purchasePrice || Number(old.purchasePrice) === 0) && product.purchasePrice) add.purchasePrice = product.purchasePrice;
        if ((!old.sellingPrice || Number(old.sellingPrice) === 0) && product.sellingPrice) {
          add.sellingPrice = product.sellingPrice;
          add.rate = product.sellingPrice;
        }
        if (opts.adjustStock && product.stock) {
          add.stock = (Number(old.stock) || 0) + product.stock;
        }
        if (Object.keys(add).length) updatedProducts.push({ ...old, ...add });
        else skipped++;
      }
    }

    return {
      entityType: 'products',
      softwareId: normalized.softwareId,
      scorecard: {
        total: normalized.total,
        readyToAdd: newProducts.length,
        readyToUpdate: updatedProducts.length,
        skipped,
        errors: normalized.errors.length,
      },
      newItems: newProducts,
      updatedItems: updatedProducts,
      errors: normalized.errors,
    };
  }

  // Invoices
  if (normType === 'invoices') {
    const existingNum = new Set(bills.map((b) => String(b.invoiceNumber || b.billNo || '').trim().toLowerCase()));
    const groups = new Map();
    for (const r of records) {
      const num = r.invoiceNumber;
      if (!groups.has(num)) groups.set(num, []);
      groups.get(num).push(r);
    }

    const readyInvoices = [];
    let skipped = 0;

    for (const [invNum, rows] of groups) {
      if (existingNum.has(invNum.toLowerCase())) {
        skipped++;
      } else {
        readyInvoices.push({ invoiceNumber: invNum, rows });
      }
    }

    return {
      entityType: 'invoices',
      softwareId: normalized.softwareId,
      scorecard: {
        total: groups.size,
        readyToAdd: readyInvoices.length,
        readyToUpdate: 0,
        skipped,
        errors: normalized.errors.length,
      },
      newItems: readyInvoices,
      updatedItems: [],
      errors: normalized.errors,
    };
  }

  // Purchases
  const existingPurchases = new Set(purchases.map((p) => String(p.billNumber || p.invoiceNumber || '').trim().toLowerCase()));
  const groups = new Map();
  for (const r of records) {
    const num = r.invoiceNumber;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num).push(r);
  }

  const readyPurchases = [];
  let skipped = 0;

  for (const [num, rows] of groups) {
    if (existingPurchases.has(num.toLowerCase())) {
      skipped++;
    } else {
      readyPurchases.push({ billNumber: num, rows });
    }
  }

  return {
    entityType: 'purchases',
    softwareId: normalized.softwareId,
    scorecard: {
      total: groups.size,
      readyToAdd: readyPurchases.length,
      readyToUpdate: 0,
      skipped,
      errors: normalized.errors.length,
    },
    newItems: readyPurchases,
    updatedItems: [],
    errors: normalized.errors,
  };
}
