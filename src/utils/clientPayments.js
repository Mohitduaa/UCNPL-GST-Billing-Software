// src/utils/clientPayments.js
// Client Payment History & Analytics Engine

/**
 * Standardizes raw payment modes to clean UI display strings
 */
export function formatPaymentMode(mode) {
  if (!mode) return 'Cash';
  const m = String(mode).trim().toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'cash') return 'Cash';
  if (m.includes('bank') || m === 'neft' || m === 'rtgs' || m === 'imps') return 'Bank Transfer';
  if (m === 'cheque' || m === 'check') return 'Cheque';
  if (m === 'card' || m === 'debit' || m === 'credit') return 'Card';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/**
 * Extracts and aggregates all payments made across a client's invoices,
 * sorted with the newest payment first.
 */
export function extractClientPayments(clientBills = []) {
  const payments = [];

  for (const bill of clientBills) {
    if (!bill || bill.status === 'cancelled') continue;

    const invoiceTotal = Number(bill.totalAmount) || 0;
    const invNo = bill.invoiceNumber || 'Invoice';
    const invDate = bill.invoiceDate || '';

    if (Array.isArray(bill.payments) && bill.payments.length > 0) {
      let cumulativePaid = 0;
      // Sort bill payments ascending first to track running balance properly
      const sortedBillPayments = [...bill.payments].sort((a, b) => {
        const da = new Date(a.date || a.recordedAt || 0).getTime();
        const db = new Date(b.date || b.recordedAt || 0).getTime();
        return da - db;
      });

      for (let i = 0; i < sortedBillPayments.length; i++) {
        const p = sortedBillPayments[i];
        const pAmt = Number(p.amount) || 0;
        if (pAmt <= 0) continue;

        cumulativePaid += pAmt;
        const balanceAfter = Math.max(0, Math.round((invoiceTotal - cumulativePaid) * 100) / 100);

        payments.push({
          id: p.id || `${bill.id}-pay-${i}`,
          billId: bill.id,
          invoiceNumber: invNo,
          invoiceDate: invDate,
          invoiceTotal,
          amount: pAmt,
          date: p.date || p.recordedAt || invDate,
          mode: formatPaymentMode(p.mode),
          rawMode: p.mode || 'cash',
          note: p.note || p.reference || '',
          receiptNo: p.receiptNo || '',
          recordedAt: p.recordedAt || p.date || invDate,
          balanceAfter,
        });
      }
    } else if (Number(bill.paidAmount) > 0.01) {
      // Legacy or quick-marked invoice without individual payment items
      const pAmt = Number(bill.paidAmount);
      const balanceAfter = Math.max(0, Math.round((invoiceTotal - pAmt) * 100) / 100);

      payments.push({
        id: `${bill.id}-paid`,
        billId: bill.id,
        invoiceNumber: invNo,
        invoiceDate: invDate,
        invoiceTotal,
        amount: pAmt,
        date: bill.paidDate || invDate,
        mode: 'Settled',
        rawMode: 'settled',
        note: 'Settled against invoice',
        receiptNo: '',
        recordedAt: bill.paidDate || invDate,
        balanceAfter,
      });
    }
  }

  // Sort descending: newest payment first
  return payments.sort((a, b) => {
    const da = new Date(a.date || a.recordedAt || 0).getTime();
    const db = new Date(b.date || b.recordedAt || 0).getTime();
    return db - da;
  });
}

/**
 * Returns the most recent payment received from a client, or null if none
 */
export function getLatestClientPayment(clientBills = []) {
  const all = extractClientPayments(clientBills);
  return all.length > 0 ? all[0] : null;
}

/**
 * Calculates a summary breakdown of payments by mode and total
 */
export function summarizeClientPayments(payments = []) {
  let totalReceived = 0;
  const byMode = {};

  for (const p of payments) {
    totalReceived += p.amount;
    const mode = p.mode || 'Other';
    byMode[mode] = (byMode[mode] || 0) + p.amount;
  }

  return {
    count: payments.length,
    totalReceived: Math.round(totalReceived * 100) / 100,
    byMode,
  };
}
