// src/utils/profitability.js
// Standalone engine for Real-Time Invoice Margins, Bill-Wise Profitability, and Customer Insights

import { isCancelledBill, isServiceProduct, salesSign, toLocalIsoDate } from '../utils.js';

/**
 * Calculates profit and margin for a single line item
 */
export function calculateItemProfit(item, product) {
  const qty = Number(item?.quantity) || 0;
  const rate = Number(item?.rate) || 0;
  const discount = Number(item?.discount) || 0;
  const revenue = Math.max(0, Math.round(((qty * rate) - discount) * 100) / 100);

  const isService = isServiceProduct(product) || item?.isCharge || /^99/.test(String(item?.hsn || '').trim());
  const purchasePrice = Number(product?.purchasePrice) || 0;

  if (isService) {
    return {
      itemRevenue: revenue,
      itemCost: 0,
      profit: revenue,
      marginPercent: revenue > 0 ? 100 : 0,
      hasCost: true,
    };
  }

  const hasCost = purchasePrice > 0;
  const itemCost = hasCost ? Math.round(qty * purchasePrice * 100) / 100 : 0;
  const profit = Math.round((revenue - itemCost) * 100) / 100;
  const marginPercent = (revenue > 0 && hasCost) ? Math.round(((profit / revenue) * 100) * 10) / 10 : 0;

  return {
    itemRevenue: revenue,
    itemCost,
    profit,
    marginPercent,
    hasCost,
  };
}

/**
 * Calculates real-time live margin and profitability for an invoice
 */
export function calculateBillMargin(items, totalAmount, products = []) {
  const byId = new Map((products || []).map(p => [p.id, p]));
  const byName = new Map((products || []).map(p => [String(p.name || '').trim().toLowerCase(), p]));

  let totalCost = 0;
  let hasCostData = false;
  const missingProducts = [];

  for (const it of items || []) {
    const qty = Number(it?.quantity) || 0;
    if (!qty || it.isCharge || /^99/.test(String(it.hsn || '').trim())) continue;

    const p = (it.productId && byId.get(it.productId)) || byName.get(String(it.name || '').trim().toLowerCase());
    if (isServiceProduct(p)) continue;

    const price = Number(p?.purchasePrice) || 0;
    if (price > 0) {
      totalCost += qty * price;
      hasCostData = true;
    } else if (String(it.name || '').trim()) {
      missingProducts.push(String(p?.name || it.name).trim());
    }
  }

  totalCost = Math.round(totalCost * 100) / 100;
  const revenue = Number(totalAmount) || 0;
  const profit = Math.round((revenue - totalCost) * 100) / 100;
  const marginPercent = (revenue > 0 && hasCostData) ? Math.round(((profit / revenue) * 100) * 10) / 10 : 0;

  return {
    totalCost,
    revenue,
    profit,
    marginPercent,
    hasCostData,
    missingProducts: Array.from(new Set(missingProducts)),
  };
}

/**
 * Calculates bill-wise profitability breakdown list from all invoices
 */
export function calculateBillWiseProfitList(bills = [], products = []) {
  const byId = new Map((products || []).map(p => [p.id, p]));
  const byName = new Map((products || []).map(p => [String(p.name || '').trim().toLowerCase(), p]));

  const result = [];

  for (const bill of bills || []) {
    if (isCancelledBill(bill)) continue;
    const sign = salesSign(bill);
    if (!sign) continue;

    const items = bill.data?.items || bill.items || [];
    let billCost = 0;
    let hasCost = false;

    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      if (!qty || it.isCharge || /^99/.test(String(it.hsn || '').trim())) continue;

      const p = (it.productId && byId.get(it.productId)) || byName.get(String(it.name || '').trim().toLowerCase());
      if (isServiceProduct(p)) continue;

      const costPrice = Number(p?.purchasePrice) || 0;
      if (costPrice > 0) {
        billCost += sign * qty * costPrice;
        hasCost = true;
      }
    }

    billCost = Math.round(billCost * 100) / 100;
    const amount = Number(bill.totalAmount) || 0;
    const profit = Math.round((amount - billCost) * 100) / 100;
    const marginPercent = amount > 0 && hasCost ? Math.round(((profit / amount) * 100) * 10) / 10 : 0;

    result.push({
      id: bill.id,
      invoiceNumber: bill.invoiceNumber || bill.id,
      invoiceDate: bill.invoiceDate || '',
      clientName: bill.clientName || bill.data?.client?.name || 'Cash Sale',
      itemsCount: items.length,
      totalAmount: amount,
      cost: billCost,
      profit,
      marginPercent,
      hasCost,
    });
  }

  // Sort by invoiceDate descending
  result.sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));
  return result;
}

/**
 * Calculates customer insights: retention rate, repeat rate, and dormant customers
 */
export function calculateCustomerInsights(bills = [], asOfDate = toLocalIsoDate(new Date())) {
  const byClient = new Map();
  const asOf = new Date(asOfDate).getTime();

  for (const bill of bills || []) {
    if (isCancelledBill(bill)) continue;
    const name = String(bill.clientName || bill.data?.client?.name || '').trim();
    if (!name || name.toLowerCase() === 'cash sale') continue; // Exclude anonymous walk-ins from named retention

    const amount = Number(bill.totalAmount) || 0;
    const dateStr = bill.invoiceDate || '';

    if (!byClient.has(name)) {
      byClient.set(name, {
        name,
        billsCount: 0,
        totalSpend: 0,
        lastInvoiceDate: dateStr,
      });
    }

    const rec = byClient.get(name);
    rec.billsCount += 1;
    rec.totalSpend += amount;
    if (!rec.lastInvoiceDate || dateStr > rec.lastInvoiceDate) {
      rec.lastInvoiceDate = dateStr;
    }
  }

  const clientList = Array.from(byClient.values());
  const totalCustomers = clientList.length;
  const repeatCustomers = clientList.filter(c => c.billsCount > 1).length;
  const repeatRate = totalCustomers > 0 ? Math.round(((repeatCustomers / totalCustomers) * 100) * 10) / 10 : 0;
  const totalSpend = clientList.reduce((acc, c) => acc + c.totalSpend, 0);
  const averageCustomerValue = totalCustomers > 0 ? Math.round(totalSpend / totalCustomers) : 0;

  // 60+ days dormant detection
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const dormantCustomers = clientList
    .filter(c => {
      if (!c.lastInvoiceDate) return false;
      const lastTime = new Date(c.lastInvoiceDate).getTime();
      return (asOf - lastTime) >= SIXTY_DAYS_MS;
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  return {
    totalCustomers,
    repeatCustomers,
    repeatRate,
    averageCustomerValue,
    dormantCustomers,
  };
}
