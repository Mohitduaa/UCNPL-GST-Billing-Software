// v1.10.83 (#112) - purchase orders: the pure parts (totals, status, numbering,
// the bill a PO turns into), kept out of the components so they can be tested.
// v1.10.85 (#171) - added per-item discount (% or fixed amount) to purchase totals.
import { calculateRoundOff, formatDocNumber, getFinancialYearLabel, parseLocalDate, roundQty } from '../utils.js';

// Line and document totals for purchase bills and purchase orders alike.
// Moved here from PurchaseBills.jsx unchanged, so both use the same sums.
export function purchaseLineTax(item) {
  const gross = (Number(item?.quantity) || 0) * (Number(item?.rate) || 0);
  const rawDisc = Number(item?.discount) || 0;
  let discount = 0;
  if (rawDisc > 0) {
    if (item?.discountType === 'percent') {
      discount = (gross * rawDisc) / 100;
    } else {
      discount = Math.min(gross, rawDisc);
    }
  }
  discount = Math.min(gross, Math.max(0, discount));
  const amount = Math.max(0, gross - discount);
  const tax = (amount * (Number(item?.taxPercent) || 0)) / 100;
  const cess = (amount * (Number(item?.cessPercent) || 0)) / 100;
  return { gross, discount, amount, tax, cess, total: amount + tax + cess };
}

export function purchaseTotals(items, applyRoundOff = false) {
  const raw = (items || []).reduce((acc, item) => {
    const { gross, discount, amount, tax, cess, total } = purchaseLineTax(item);
    return {
      subtotal: acc.subtotal + gross,
      discount: acc.discount + discount,
      taxable: acc.taxable + amount,
      tax: acc.tax + tax,
      cess: acc.cess + cess,
      total: acc.total + total,
    };
  }, { subtotal: 0, discount: 0, taxable: 0, tax: 0, cess: 0, total: 0 });
  // Round-off is applied to the GRAND total (taxable + tax + cess). Stored
  // as a separate line so GSTR-3B input tax credit reflects the supplier's
  // actual tax amount, not a rounded version.
  const roundOff = applyRoundOff ? calculateRoundOff(raw.total) : 0;
  return { ...raw, roundOff, finalTotal: raw.total + roundOff };
}

export const PO_STATUS_LABELS = {
  open: 'Open',
  'partly-received': 'Partly received',
  received: 'Received',
  cancelled: 'Cancelled',
};

// Bill lines are matched to PO lines by item name, the same way saving a bill
// matches products.
const nameKey = (it) => String(it?.name || '').trim().toLowerCase();

// What is still to come on a PO: its lines less everything the bills saved
// from it (bill.fromPo) received. Two PO lines of the same item share what
// was received, first line first.
export function poRemainingItems(po, purchases) {
  const got = new Map();
  for (const b of purchases || []) {
    if (!po?.id || b?.fromPo !== po.id) continue;
    for (const it of b.items || []) got.set(nameKey(it), (got.get(nameKey(it)) || 0) + (Number(it.quantity) || 0));
  }
  const out = [];
  for (const it of po?.items || []) {
    const qty = Number(it.quantity) || 0;
    const take = Math.min(qty, got.get(nameKey(it)) || 0);
    got.set(nameKey(it), (got.get(nameKey(it)) || 0) - take);
    const left = roundQty(qty - take);
    if (left > 0) out.push({ ...it, quantity: left });
  }
  return out;
}

// Open until a bill is saved from it; Received once the bills cover every
// line; Partly received in between. Cancelled is the user's choice and stays.
export function poStatus(po, purchases) {
  if (po?.cancelled) return 'cancelled';
  if (!(purchases || []).some((b) => po?.id && b?.fromPo === po.id)) return 'open';
  return poRemainingItems(po, purchases).length ? 'partly-received' : 'received';
}

// The purchase bill form, filled from a PO: what is still to come, at the PO's
// rates. The supplier's bill number is left for the user to type.
export function billFormFromPo(po, purchases) {
  return {
    supplierName: po.supplierName || '',
    supplierAddress: po.supplierAddress || '',
    supplierGstin: po.supplierGstin || '',
    interstate: !!po.interstate,
    invoiceNumber: '',
    items: poRemainingItems(po, purchases).map((it) => ({
      name: it.name || '', hsn: it.hsn || '', quantity: it.quantity, unit: it.unit || '',
      rate: Number(it.rate) || 0,
      ...(Number(it.discount) ? { discount: Number(it.discount), discountType: it.discountType || 'percent' } : {}),
      taxPercent: Number(it.taxPercent) || 0, cessPercent: Number(it.cessPercent) || 0,
    })),
    fromPo: po.id,
    // v1.10.83 (#112) - the bill belongs to the same cost centre as its order.
    costCentre: po.costCentre || '',
    costCentreName: po.costCentreName || '',
  };
}

// Each business counts its own POs (counter_PO@<business>), and a number is
// never handed out twice: the counter only goes up.
export const poCounterKey = (businessKey) => (businessKey ? `counter_PO@${businessKey}` : 'counter_PO');

// PO/26-27/0001 - the financial year of the PO's date.
export const formatPoNumber = (next, date) => formatDocNumber({
  settings: { format: 'branded', brandPrefix: '', separator: '/', showFinYear: true, padDigits: 4, fyStyle: 'short' },
  typePrefix: 'PO',
  next,
  fyLabel: getFinancialYearLabel(date ? parseLocalDate(date) : new Date()),
});
