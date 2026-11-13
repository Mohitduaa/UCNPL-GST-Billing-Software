// src/utils/gstrImport.js
// Auto-import Purchase Bills from GSTR-2B and GSTR-2A JSON files

import { toIsoDate } from './bulkCsv.js';

// Normalise invoice number for duplicate matching
export function normInv(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extracts line items from a GSTR-2B or GSTR-2A invoice record.
 * Handles both 2B (`items`) and 2A (`itms` with `itm_det`).
 */
export function extractGstrItems(inv) {
  const rawList = inv.items || inv.itms || [];
  if (!rawList.length) {
    const txval = Number(inv.txval || inv.val || 0);
    return [{
      name: 'Goods / Services',
      hsn: '',
      quantity: 1,
      rate: txval,
      taxPercent: 0,
      cessPercent: 0,
    }];
  }

  return rawList.map((item) => {
    const det = item.itm_det || item;
    const txval = Number(det.txval || 0);
    const rt = Number(det.rt || 0);
    const cess = Number(det.cess || det.csamt || 0);
    const cessPercent = (txval > 0 && cess > 0) ? Math.round((cess / txval) * 10000) / 100 : 0;
    return {
      name: `Goods / Services @ ${rt}% GST`,
      hsn: '',
      quantity: 1,
      rate: txval,
      taxPercent: rt,
      cessPercent,
    };
  });
}

/**
 * Converts a single GSTR-2B / 2A invoice into a Free GST Billing purchase bill record.
 */
export function convertGstrInvoiceToPurchase(inv, supplier = {}, profile = {}) {
  const ctin = String(supplier.ctin || supplier.gstin || '').trim().toUpperCase();
  const supName = String(supplier.trdnm || supplier.cname || supplier.legal_name || supplier.name || ctin).trim();
  const rawDate = inv.dt || inv.idt || '';
  const date = toIsoDate(rawDate) || new Date().toISOString().slice(0, 10);
  const invoiceNumber = String(inv.inum || '').trim();

  const items = extractGstrItems(inv);

  // Line-item totals
  const totals = items.reduce((acc, it) => {
    const amount = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
    const tax = amount * (Number(it.taxPercent) || 0) / 100;
    const cess = amount * (Number(it.cessPercent) || 0) / 100;
    return {
      taxable: acc.taxable + amount,
      tax: acc.tax + tax,
      cess: acc.cess + cess,
      total: acc.total + amount + tax + cess
    };
  }, { taxable: 0, tax: 0, cess: 0, total: 0 });

  // Calculate IGST from 2B/2A items if present
  const totalIgst = (inv.items || inv.itms || []).reduce((sum, it) => {
    const det = it.itm_det || it;
    return sum + Number(det.igst || 0);
  }, 0);

  const profileGstin = String(profile?.gstin || '').trim().toUpperCase();
  const isInterstate = totalIgst > 0 || (profileGstin.length >= 2 && ctin.length >= 2 && profileGstin.slice(0, 2) !== ctin.slice(0, 2));

  const totalInvoiceVal = Number(inv.val || 0);
  let finalTotal = totalInvoiceVal > 0 ? totalInvoiceVal : totals.total;
  let roundOff = Math.round((finalTotal - totals.total) * 100) / 100;
  let applyRoundOff = false;
  if (Math.abs(roundOff) > 0.001 && Math.abs(roundOff) < 10) {
    applyRoundOff = true;
  } else {
    roundOff = 0;
  }

  return {
    date,
    supplierName: supName,
    supplierAddress: supplier.addr || '',
    supplierGstin: ctin,
    invoiceNumber,
    ownerGstin: profile?.gstin || '',
    ownerName: profile?.businessName || '',
    items,
    totalAmount: finalTotal,
    totalTax: totals.tax + totals.cess,
    taxableAmount: totals.taxable,
    applyRoundOff,
    roundOff,
    paymentStatus: 'Unpaid',
    interstate: isInterstate,
    note: `Auto-imported from GSTR-2B/2A`,
    importedAt: new Date().toISOString(),
    source: 'gstr2b',
  };
}

/**
 * Parses raw GSTR-2B or GSTR-2A JSON and returns ready-to-import purchase records,
 * skipping any already present in `existingPurchases`.
 */
export function parseGstrJsonToPurchases(jsonTextOrObj, { existingPurchases = [], profile = {} } = {}) {
  let root = jsonTextOrObj;
  if (typeof jsonTextOrObj === 'string') {
    try {
      root = JSON.parse(jsonTextOrObj);
    } catch {
      throw new Error('Invalid JSON format: unable to parse file.');
    }
  }

  // Handle wrapped { data: { docdata: ... } } or { data: { b2b: ... } }
  if (root?.data) root = root.data;

  // Extract suppliers list from B2B
  const suppliers = root?.docdata?.b2b || root?.b2b || [];
  if (!Array.isArray(suppliers) || suppliers.length === 0) {
    throw new Error('No B2B invoices found in this file (expected docdata.b2b or b2b array).');
  }

  // Key for matching booked purchases: GSTIN + normalized invoiceNumber
  const bookedKeys = new Set(
    (existingPurchases || []).map(p => `${(p.supplierGstin || '').toUpperCase()}::${normInv(p.invoiceNumber)}`)
  );

  const toImport = [];
  const skipped = [];

  for (const sup of suppliers) {
    const ctin = (sup.ctin || sup.gstin || '').toUpperCase();
    const supName = sup.trdnm || sup.cname || sup.legal_name || ctin;
    const invList = sup.inv || [];

    for (const inv of invList) {
      const invNum = inv.inum || '';
      const key = `${ctin}::${normInv(invNum)}`;
      const label = `${supName} (${invNum})`;

      if (bookedKeys.has(key)) {
        skipped.push({ key, label, reason: 'Already in purchases' });
        continue;
      }

      const purchaseRecord = convertGstrInvoiceToPurchase(inv, sup, profile);
      toImport.push(purchaseRecord);
      bookedKeys.add(key);
    }
  }

  return {
    gstin: root?.gstin || root?.docdata?.gstin || '',
    period: root?.rtnprd || root?.fp || root?.docdata?.rtnprd || '',
    totalInvoices: toImport.length + skipped.length,
    toImport,
    skipped,
  };
}
