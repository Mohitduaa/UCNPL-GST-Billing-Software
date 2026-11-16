import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { ShoppingCart, Upload, Plus, Edit3, Trash2, Search, X, Save, Download, ScanText, Eye, ClipboardList, IndianRupee, Building2, FileText, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import HelpButton from './HelpButton';
import { getAllPurchases, savePurchase, deletePurchase, getAllProducts, saveProduct, getProfile, getEnabledModules, getAllPurchaseOrders, savePurchaseOrder, getNextPoNumber } from '../store';
import { findDuplicateProduct, formatDuplicateProductDetails, calculateUpdatedStock, reconcilePurchaseProducts } from '../utils/products';
import { formatCurrency, getFYOptions, belongsToProfile, parseLocalDate, isUnassignedToBusiness, isInterstateSupply, localToday, roundQty, splitPurchaseTax, isModuleEnabled, businessKeyOf, getAllUnits, TDS_SECTIONS } from '../utils';
import { openWhatsAppShare, supplierShareMessage } from '../utils/share';
import { purchaseTdsAmount } from '../utils/tdsTcs';
import { parseGstrJsonToPurchases } from '../utils/gstrImport';
import { purchaseTotals as calcPurchaseTotal, billFormFromPo } from '../utils/purchaseOrders';
import PurchaseOrders from './PurchaseOrders';
import TableExport from './TableExport';
import BulkCsvImport from './BulkCsvImport';
import UnassignedBanner from './UnassignedBanner';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction, promptAction } from './ConfirmModal';
import { useCostCentres } from './useCostCentres';
import { CostCentreSelect, CostCentreFilter } from './CostCentrePicker';
import { matchesCentre, centreFields } from '../utils/costCentres';
import { PURCHASE_STATUS_LABEL, OVERPAY_SLACK, purchaseStatus, purchaseBalance, purchasePaid, purchaseOwed, hasPurchasePayments, withPurchasePayments, markPurchasePaid, markPurchaseUnpaid, purchasePaymentModeName } from '../utils/purchasePayments';
import PurchasePaymentModal from './PurchasePaymentModal';
import PdfPreviewModal from './PdfPreviewModal';
import BarcodeLabelsModal from './BarcodeLabelsModal';
import { playScanBeep, generateRandomBarcode } from '../utils/barcode';

// v1.10.31 — UI-C3: Same accent-color helper as ClientsView so the
// Purchase Bill PDF header rule + totals line pick up the user's brand.
function getAccentRGB() {
  try {
    const ps = getPrintSettings();
    if (ps.userColorsEnabled && ps.pdfAccent) {
      const hex = String(ps.pdfAccent).replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
      }
    }
  } catch { /* ignore */ }
  return [30, 64, 175];
}

// v1.10.22 — Purchase-bill OCR modal. Lazy-loaded because tesseract.js is
// ~2MB gzipped; we only pay the download cost when the user actually
// opens the OCR flow.
const BillOCR = lazy(() => import('./BillOCR'));

const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Partial'];

// v1.10.69 (#71 item 3) - the same three colours the pill used, now shared
// with the dropdown in the records table.
const PAYMENT_STATUS_COLORS = {
  Unpaid:  { bg: 'rgba(143, 100, 32, 0.14)', color: '#8f6420' },
  Paid:    { bg: 'rgba(63, 125, 84, 0.14)',  color: '#3f7d54' },
  Partial: { bg: 'rgba(124, 58, 237, 0.14)', color: '#7c3aed' },
};

// cessPercent added in v1.6.8 (P1 #16) — suppliers of tobacco / aerated
// drinks / motor vehicles / coal charge GST + Cess. Without a slot for it,
// we couldn't reclaim ITC on the cess in GSTR-3B Table 4(A).
// v1.10.83 (#112) - unit is shown on purchase orders only; a bill made from
// a PO keeps it for the products it adds.
// _auto marks the 18% default as not typed by the user (see isOursToReplace),
// so picking a 12% product sets 12%. Before, the default was never replaced
// and every product picked on a new row came in at 18%.
const emptyItem = { name: '', hsn: '', serialNo: '', quantity: 1, unit: '', rate: 0, discount: '', discountType: 'percent', taxPercent: 18, cessPercent: 0, _auto: { taxPercent: 18 } };


const emptyForm = {
  date: '', // v1.10.74 - set to localToday() when the form opens
  supplierName: '',
  // v1.10.29 — supplier address for the PDF header. Optional; blank
  // pre-v1.10.29 records fall through gracefully.
  supplierAddress: '',
  supplierGstin: '',
  invoiceNumber: '',
  items: [{ ...emptyItem }],
  paymentStatus: 'Unpaid',
  paymentMode: 'cash',
  interstate: false, // true ⇒ supplier charged IGST; false ⇒ CGST + SGST. Routes ITC correctly in GSTR-3B.
  applyRoundOff: false, // off by default — purchase bill totals are usually pre-rounded by the supplier. Users with suppliers that don't pre-round can opt in here.
  note: '',
  // v1.10.83 (#112) - the same form edits purchase orders (kind 'po'): it
  // already knows suppliers, products and the GST split. fromPo links a bill
  // to the order it was made from.
  kind: 'bill',
  poNumber: '',
  expectedDate: '',
  fromPo: '',
  // v1.10.83 (#112) - optional; see utils/costCentres.js
  costCentre: '',
  costCentreName: '',
  // v1.10.83 - TDS you deduct from the supplier (194C, 194J...): worked out on
  // the value before GST at tdsRate, or the amount typed in tdsAmountManual.
  tdsOn: false,
  tdsSection: '194C',
  tdsRate: 1,
  tdsAmountManual: '',
};

// v1.10.83 (#112) - calcItemTax / calcPurchaseTotal moved to
// utils/purchaseOrders.js unchanged, shared with purchase orders.

// v1.10.6 — audit L4: local copy removed, imported from utils above.

// The TDS fields stored on a purchase bill (cleared when TDS is off).
const purchaseTdsFields = (form, taxable) => {
  if (!form.tdsOn) return { tdsAmount: 0, tdsSection: '', tdsRate: 0, tdsManual: false };
  const manual = String(form.tdsAmountManual ?? '').trim();
  return {
    tdsSection: form.tdsSection || '194C',
    tdsRate: parseFloat(form.tdsRate) || 0,
    tdsAmount: purchaseTdsAmount(taxable, form.tdsRate, manual),
    tdsManual: manual !== '',
  };
};

export default function PurchaseBills() {
  const [purchases, setPurchases] = useState([]);
  // v1.10.65 (#58 item 3) — the business these records belong to.
  const [ownerProfile, setOwnerProfile] = useState(null);
  const gstrInputRef = useRef(null);

  const handleGstrJsonImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = parseGstrJsonToPurchases(text, { existingPurchases: purchases, profile: ownerProfile || {} });
      if (res.toImport.length === 0) {
        toast(`All ${res.totalInvoices} invoices in this file are already recorded in Purchases.`, 'info');
        return;
      }
      for (const pur of res.toImport) {
        await savePurchase(pur);
      }
      toast(`Imported ${res.toImport.length} purchase bills from GSTR-2B/2A!${res.skipped.length > 0 ? ` (${res.skipped.length} existing skipped)` : ''}`, 'success');
      await loadPurchases();
      await loadProducts();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Failed to import GSTR JSON', 'error');
    } finally {
      if (gstrInputRef.current) gstrInputRef.current.value = '';
    }
  };
  // v1.10.54 (#42) — the Products & Services master, used to seed item
  // suggestions. Loaded on mount alongside purchases.
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [barcodeModalData, setBarcodeModalData] = useState(null);
  const [purchaseScannedBarcode, setPurchaseScannedBarcode] = useState('');
  const [showSerialNo, setShowSerialNo] = useState(() => {
    try { return localStorage.getItem('fgsb_purchase_show_serial') === 'true'; } catch { return false; }
  });

  const openBarcodeForPurchase = (purchase) => {
    const purchaseProducts = [];
    const initialCounts = {};

    (purchase.items || []).forEach((item, idx) => {
      if (!item.name || !item.name.trim()) return;
      const match = products.find(p =>
        (item.productId && p.id === item.productId) ||
        (item.barcode && p.barcode === item.barcode) ||
        (p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      );
      const id = match?.id || item.productId || `purchase-item-${idx}`;
      const barcode = match?.barcode || item.barcode || generateRandomBarcode('PROD');
      const sellingPrice = match?.sellingPrice ?? match?.rate ?? item.rate ?? 0;
      const qty = Math.max(1, Math.round(Number(item.quantity) || 1));

      purchaseProducts.push({
        id,
        name: item.name,
        barcode,
        sellingPrice,
        rate: item.rate,
        stock: qty,
      });
      initialCounts[id] = qty;
    });

    if (purchaseProducts.length === 0) {
      toast('No valid items found in this purchase bill', 'warning');
      return;
    }

    setBarcodeModalData({
      products: purchaseProducts,
      initialCounts,
    });
  };

  const handlePurchaseBarcodeScan = (codeRaw) => {
    const code = String(codeRaw || '').trim().toLowerCase();
    if (!code) return;

    const found = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === code) ||
      (p.id && String(p.id).toLowerCase() === code) ||
      (p.name && p.name.trim().toLowerCase() === code)
    );

    if (found) {
      playScanBeep(true);
      const buyRate = found.purchasePrice !== undefined && found.purchasePrice !== ''
        ? Number(found.purchasePrice)
        : (found.sellingPrice ?? found.rate ?? 0);

      setForm(prev => {
        const items = [...prev.items];
        const existingIdx = items.findIndex(it =>
          (it.productId && it.productId === found.id) ||
          (it.name && it.name.trim().toLowerCase() === found.name.trim().toLowerCase())
        );

        if (existingIdx !== -1) {
          const it = items[existingIdx];
          const newQty = (Number(it.quantity) || 0) + 1;
          items[existingIdx] = { ...it, quantity: newQty };
          toast(`Scanned: ${found.name} (Qty: ${newQty})`, 'success', 2000);
          return { ...prev, items };
        }

        if (items.length === 1 && !items[0].name && !items[0].rate) {
          items[0] = {
            ...items[0],
            productId: found.id,
            name: found.name,
            hsn: found.hsn || '',
            quantity: 1,
            unit: found.unit || 'Nos',
            rate: buyRate,
            taxPercent: found.taxPercent ?? 18,
          };
          toast(`Scanned: ${found.name} (Qty: 1)`, 'success', 2000);
          return { ...prev, items };
        }

        items.push({
          productId: found.id,
          name: found.name,
          hsn: found.hsn || '',
          quantity: 1,
          unit: found.unit || 'Nos',
          rate: buyRate,
          taxPercent: found.taxPercent ?? 18,
          cessPercent: 0,
        });
        toast(`Scanned: ${found.name} (Qty: 1)`, 'success', 2000);
        return { ...prev, items };
      });
      setPurchaseScannedBarcode('');
    } else {
      playScanBeep(false);
      toast(`Barcode not found in inventory: "${codeRaw}"`, 'warning', 3000);
    }
  };

  const supplierAccounts = useMemo(() => {
    const map = new Map();
    for (const p of purchases) {
      const name = (p.supplierName || 'Unknown Supplier').trim();
      if (!map.has(name)) {
        map.set(name, {
          name,
          gstin: p.supplierGstin || '',
          address: p.supplierAddress || '',
          bills: [],
          totalBilled: 0,
          totalPaid: 0,
          balanceOwed: 0,
        });
      }
      const sup = map.get(name);
      if (!sup.gstin && p.supplierGstin) sup.gstin = p.supplierGstin;
      if (!sup.address && p.supplierAddress) sup.address = p.supplierAddress;
      const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
      const paid = purchasePaid(p);
      const bal = purchaseBalance(p);
      sup.bills.push(p);
      sup.totalBilled += t.finalTotal;
      sup.totalPaid += paid;
      sup.balanceOwed += bal;
    }
    return Array.from(map.values()).sort((a, b) => b.balanceOwed - a.balanceOwed || a.name.localeCompare(b.name));
  }, [purchases]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return supplierAccounts;
    const q = supplierSearch.trim().toLowerCase();
    return supplierAccounts.filter(s =>
      s.name.toLowerCase().includes(q) || s.gstin.toLowerCase().includes(q)
    );
  }, [supplierAccounts, supplierSearch]);

  const supplierStats = useMemo(() => {
    return supplierAccounts.reduce((acc, s) => ({
      totalBilled: acc.totalBilled + s.totalBilled,
      totalPaid: acc.totalPaid + s.totalPaid,
      balanceOwed: acc.balanceOwed + s.balanceOwed,
    }), { totalBilled: 0, totalPaid: 0, balanceOwed: 0 });
  }, [supplierAccounts]);

  const generateSupplierStatement = async (supplierName) => {
    const supBills = purchases
      .filter(p => (p.supplierName || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase())
      .sort((a, b) => ((parseLocalDate(a.date) || 0) - (parseLocalDate(b.date) || 0)) || String(a.invoiceNumber || '').localeCompare(String(b.invoiceNumber || '')));

    if (supBills.length === 0) {
      toast('No purchase bills found for this supplier', 'warning');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const savedGstin = supBills.find(p => p.supplierGstin)?.supplierGstin || '';
      const savedAddress = supBills.find(p => p.supplierAddress)?.supplierAddress || '';
      const profile = ownerProfile || {};

      const pageW = 210, marginL = 15, marginR = 195, tableW = marginR - marginL;
      const fmt = (n) => {
        const v = Number(n) || 0;
        const abs = Math.abs(v);
        const parts = abs.toFixed(2).split('.');
        const last3 = parts[0].slice(-3);
        const rest = parts[0].slice(0, -3);
        const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
        return (v < 0 ? '-' : '') + 'Rs. ' + grouped + '.' + parts[1];
      };

      // Header band
      doc.setFillColor(...getAccentRGB());
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('SUPPLIER ACCOUNT STATEMENT', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Generated ${new Date().toLocaleDateString('en-IN')}  ·  Period: All purchase bills`, pageW / 2, 18, { align: 'center' });
      doc.setTextColor(0);

      let y = 30;

      // FROM / TO BLOCKS
      const colL = marginL, colR = marginL + tableW / 2 + 5;
      const colWidth = tableW / 2 - 5;

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
      doc.text('BUYER (OUR BUSINESS)', colL, y);
      doc.text('SUPPLIER / VENDOR', colR, y);
      doc.setTextColor(0);
      y += 4;

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(profile.businessName || '', colWidth), colL, y);
      doc.text(doc.splitTextToSize(supplierName, colWidth), colR, y);
      y += 5;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');

      const buyerLines = [
        profile.address,
        [profile.city, profile.state, profile.pin].filter(Boolean).join(', '),
        profile.gstin ? `GSTIN: ${profile.gstin}` : null,
        profile.email,
        profile.phone ? `Ph: ${profile.phone}` : null,
      ].filter(Boolean);

      const supplierLines = [
        savedAddress,
        savedGstin ? `GSTIN: ${savedGstin}` : null,
      ].filter(Boolean);

      let buyerDy = 0;
      buyerLines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, colWidth);
        doc.text(wrapped, colL, y + buyerDy);
        buyerDy += wrapped.length * 4;
      });
      let supplierDy = 0;
      supplierLines.forEach(line => {
        const wrapped = doc.splitTextToSize(line, colWidth);
        doc.text(wrapped, colR, y + supplierDy);
        supplierDy += wrapped.length * 4;
      });
      y += Math.max(buyerDy, supplierDy) + 5;

      // Summary Strip
      let totBilled = 0, totPaid = 0, totTds = 0;
      for (const b of supBills) {
        totBilled += calcPurchaseTotal(b.items, !!b.applyRoundOff).finalTotal;
        totPaid += purchasePaid(b);
        totTds += Math.max(0, Number(b.tdsAmount) || 0);
      }
      const totOwed = Math.max(0, totBilled - totPaid - totTds);

      doc.setFillColor(241, 245, 249);
      doc.rect(marginL, y, tableW, 16, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginL, y, tableW, 16, 'S');

      const cellW = tableW / 4;
      const summaryCells = [
        { label: 'Bills', value: String(supBills.length) },
        { label: 'Total Purchases', value: fmt(totBilled) },
        { label: 'Paid / Settled', value: fmt(totPaid + totTds), color: [5, 150, 105] },
        { label: 'Balance Payable', value: fmt(totOwed), color: totOwed > 0.005 ? [220, 38, 38] : [5, 150, 105] },
      ];
      summaryCells.forEach((cell, i) => {
        const cx = marginL + i * cellW + cellW / 2;
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
        doc.text(cell.label.toUpperCase(), cx, y + 5, { align: 'center' });
        doc.setFontSize(cell.label === 'Bills' ? 12 : 10); doc.setFont('helvetica', 'bold');
        if (cell.color) doc.setTextColor(...cell.color); else doc.setTextColor(15, 23, 42);
        doc.text(cell.value, cx, y + 12, { align: 'center' });
      });
      doc.setTextColor(0);
      y += 22;

      // Ledger Columns (Indian Creditor convention):
      // Date | Particulars | Debit (Paid) | Credit (Billed) | Balance (Payable)
      const col = {
        dateEnd: 40,
        particEnd: 100,
        debitEnd: 133,
        creditEnd: 163,
        balanceEnd: marginR - 2,
      };

      const drawHeader = () => {
        doc.setFillColor(...getAccentRGB());
        doc.rect(marginL, y, tableW, 9, 'F');
        doc.setTextColor(255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text('Date', marginL + 2, y + 6);
        doc.text('Particulars', col.dateEnd + 2, y + 6);
        doc.text('Debit (Paid)', col.debitEnd, y + 6, { align: 'right' });
        doc.text('Credit (Billed)', col.creditEnd, y + 6, { align: 'right' });
        doc.text('Balance (Payable)', col.balanceEnd, y + 6, { align: 'right' });
        doc.setTextColor(0);
        y += 12;
      };

      drawHeader();

      // Opening balance line
      doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80);
      doc.text('Opening Balance', col.dateEnd + 2, y);
      doc.text(fmt(0), col.balanceEnd, y, { align: 'right' });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.15);
      doc.line(marginL, y + 2, marginR, y + 2);
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
      y += 7;

      let runningBalance = 0; // Credit increases (we owe supplier), Debit decreases (we paid supplier)

      for (let i = 0; i < supBills.length; i++) {
        const bill = supBills[i];
        const t = calcPurchaseTotal(bill.items, !!bill.applyRoundOff);
        const billAmount = t.finalTotal;
        const pays = bill.payments || [];

        // Purchase Bill increases payable to supplier (Credit)
        const credit = billAmount;
        const debit = 0;
        runningBalance += (credit - debit);

        // Line items summary (#148)
        const itemsList = (bill.items || []).filter(it => it.name);
        let itemLines = [];
        if (itemsList.length > 0) {
          const itemSummary = itemsList.map(it => {
            const q = it.quantity ? ` (${it.quantity} ${it.unit || ''})`.trim() : '';
            return `${it.name}${q}`;
          }).join(', ');
          itemLines = doc.splitTextToSize(itemSummary, col.particEnd - col.dateEnd - 4).slice(0, 2);
        }

        const extraH = itemLines.length > 0 ? (itemLines.length * 3.2) : 0;
        const rowH = 7 + extraH;

        if (y + rowH > 260) { doc.addPage(); y = 20; drawHeader(); }

        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginL, y - 5, tableW, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
        doc.text(bill.date ? parseLocalDate(bill.date).toLocaleDateString('en-IN') : '-', marginL + 2, y);
        doc.text(`Bill #${bill.invoiceNumber || '-'} · Purchase`, col.dateEnd + 2, y);

        if (itemLines.length > 0) {
          doc.setFontSize(7.2); doc.setTextColor(100);
          itemLines.forEach((l, idx) => {
            doc.text(l, col.dateEnd + 2, y + 3.2 * (idx + 1));
          });
          doc.setFontSize(8.5); doc.setTextColor(15, 23, 42);
        }

        doc.setTextColor(180); doc.text('—', col.debitEnd, y, { align: 'right' }); doc.setTextColor(15, 23, 42);
        doc.text(fmt(credit), col.creditEnd, y, { align: 'right' });

        const isOwing = runningBalance > 0.01;
        if (isOwing) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
        else { doc.setTextColor(5, 150, 105); }
        doc.text(fmt(Math.abs(runningBalance)) + (isOwing ? ' Cr' : ' Nil'), col.balanceEnd, y, { align: 'right' });
        doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
        y += rowH;

        const tdsAmt = Math.max(0, Number(bill.tdsAmount) || 0);

        // Follow-on rows for payments recorded on this purchase
        if (pays.length > 0) {
          for (const p of pays) {
            const pAmt = Number(p.amount) || 0;
            if (pAmt <= 0) continue;
            if (y > 265) { doc.addPage(); y = 20; drawHeader(); }
            runningBalance -= pAmt;

            doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(80);
            doc.text(p.date ? parseLocalDate(p.date).toLocaleDateString('en-IN') : '', marginL + 2, y);
            doc.text(`   Payment (${purchasePaymentModeName(p.mode)}${p.reference ? ` - Ref: ${p.reference}` : ''})`, col.dateEnd + 2, y);
            doc.text(fmt(pAmt), col.debitEnd, y, { align: 'right' });
            doc.setTextColor(180); doc.text('—', col.creditEnd, y, { align: 'right' }); doc.setTextColor(80);

            const isOwingP = runningBalance > 0.01;
            if (isOwingP) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
            else { doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); }
            doc.text(fmt(Math.abs(runningBalance)) + (isOwingP ? ' Cr' : ' Nil'), col.balanceEnd, y, { align: 'right' });
            doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
            y += 7;
          }
        } else if (bill.paymentStatus === 'Paid') {
          if (y > 265) { doc.addPage(); y = 20; drawHeader(); }
          const settledAmt = Math.max(0, billAmount - tdsAmt);
          runningBalance -= settledAmt;

          doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(80);
          doc.text('   Payment (Settled in full)', col.dateEnd + 2, y);
          doc.text(fmt(settledAmt), col.debitEnd, y, { align: 'right' });
          doc.setTextColor(180); doc.text('—', col.creditEnd, y, { align: 'right' }); doc.setTextColor(80);

          const isOwingP = runningBalance > 0.01;
          if (isOwingP) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
          else { doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); }
          doc.text(fmt(Math.abs(runningBalance)) + (isOwingP ? ' Cr' : ' Nil'), col.balanceEnd, y, { align: 'right' });
          doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
          y += 7;
        }

        // TDS withheld from this purchase (reduces balance payable to supplier)
        if (tdsAmt > 0.01) {
          if (y > 265) { doc.addPage(); y = 20; drawHeader(); }
          runningBalance -= tdsAmt;

          doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(80);
          doc.text(bill.date ? parseLocalDate(bill.date).toLocaleDateString('en-IN') : '', marginL + 2, y);
          doc.text(`   TDS Deducted (u/s ${bill.tdsSection || '194Q'}${bill.tdsRate ? ` @ ${bill.tdsRate}%` : ''})`, col.dateEnd + 2, y);
          doc.text(fmt(tdsAmt), col.debitEnd, y, { align: 'right' });
          doc.setTextColor(180); doc.text('—', col.creditEnd, y, { align: 'right' }); doc.setTextColor(80);

          const isOwingT = runningBalance > 0.01;
          if (isOwingT) { doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38); }
          else { doc.setFont('helvetica', 'normal'); doc.setTextColor(5, 150, 105); }
          doc.text(fmt(Math.abs(runningBalance)) + (isOwingT ? ' Cr' : ' Nil'), col.balanceEnd, y, { align: 'right' });
          doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'normal');
          y += 7;
        }
      }

      // Closing balance line
      y += 3;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.6);
      doc.line(marginL, y, marginR, y); y += 8;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
      doc.text('CLOSING BALANCE', marginL, y);
      doc.setFontSize(12);
      if (runningBalance > 0.01) doc.setTextColor(220, 38, 38); else doc.setTextColor(5, 150, 105);
      const balanceLabel = fmt(Math.abs(runningBalance)) + (runningBalance > 0.01 ? ' Cr (Payable)' : ' Nil');
      doc.text(balanceLabel, col.balanceEnd, y, { align: 'right' });
      doc.setTextColor(0);
      y += 10;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100);
      doc.text('Cr = balance payable to supplier  ·  Dr = advance/excess paid to supplier', marginL, y);

      // Signature & Footer
      y = Math.max(y + 15, 260);
      doc.setDrawColor(150); doc.line(marginR - 55, y, marginR - 2, y);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      doc.text('Authorised Signatory', marginR - 28, y + 4, { align: 'center' });
      doc.text(profile.businessName || '', marginR - 28, y + 8, { align: 'center' });

      doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(120);
      doc.text('Computer-generated supplier statement of account.', pageW / 2, 285, { align: 'center' });
      doc.text('Generated by UCNPL Billing', pageW / 2, 290, { align: 'center' });

      const blob = doc.output('blob');
      const filename = `supplier-statement-${supplierName.replace(/[^\w]+/g, '-')}-${localToday()}.pdf`;
      setPdfPreview({
        title: `Supplier Statement — ${supplierName}`,
        filename,
        pdfBlob: blob,
        clientPhone: '',
        shareText: '',
      });
    } catch (e) {
      console.error('generateSupplierStatement', e);
      toast('Failed to generate supplier statement PDF', 'error');
    }
  };
  const [fyFilter, setFyFilter] = useState('');
  const [centreFilter, setCentreFilter] = useState('');
  const { on: ccOn, centres } = useCostCentres(ownerProfile);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, items: [{ ...emptyItem }] });
  // v1.10.22 — OCR modal state.
  const [showOCR, setShowOCR] = useState(false);
  // v1.10.30 — reported: "add a view only option modal type so can user
  // check the price without downloading the file every time". Holds the
  // purchase being previewed; modal has a Download PDF button inside.
  const [viewPurchase, setViewPurchase] = useState(null);
  // v1.10.83 (#123) - the bill whose supplier payments are open, and the
  // status filter ('' all, 'due' unpaid or partly paid, 'Paid').
  const [payPurchase, setPayPurchase] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  // v1.10.83 (#112) - purchase orders, when switched on in Settings -> Features.
  const [poEnabled] = useState(() => isModuleEnabled('purchaseOrders', getEnabledModules()));
  const [tab, setTab] = useState('bills');
  const [orders, setOrders] = useState([]);
  // The number shown on a new PO; only that one is swapped for a reserved
  // number on save, so a number the user typed is kept.
  const previewedPoRef = useRef('');
  const applyOCR = (extracted) => {
    // v1.10.35 — Now consumes the richer payload from BillOCR:
    // extracted.items[] with name/hsn/qty/rate/taxPercent/amount, and
    // extracted.taxBreakdown with cgst/sgst/igst/cess. Falls back to
    // the old single-line-from-grand-total behaviour only if no line
    // items were detected at all.
    setEditingId(null);
    let items;
    if (Array.isArray(extracted.items) && extracted.items.length > 0) {
      // Trust the OCR-extracted line items. Strip the internal match
      // metadata (_matchedProductId etc.) since the purchase form
      // doesn't consume it.
      items = extracted.items.map(it => ({
        name: it.name || '',
        hsn: it.hsn || '',
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        cessPercent: 0,
      }));
    } else if (extracted.grandTotal > 0) {
      // Legacy fallback — no line items detected, seed a single-row
      // placeholder from the grand total so the user has something to
      // split.
      items = [{ name: 'From OCR — split into real items', hsn: '', quantity: 1, rate: extracted.grandTotal, taxPercent: 0, cessPercent: 0 }];
    } else {
      items = [{ ...emptyItem }];
    }
    // v1.10.74 - IGST on the bill and no CGST means the supplier is in
    // another state, so open the form with Inter-state ticked.
    const tb = extracted.taxBreakdown || {};
    setForm({
      ...emptyForm,
      date: extracted.date || localToday(),
      supplierName: extracted.supplierName || '',
      supplierGstin: extracted.supplierGstin || '',
      invoiceNumber: extracted.invoiceNumber || '',
      items,
      interstate: Number(tb.igst) > 0 && !Number(tb.cgst),
    });
    setShowForm(true);
    const msg = Array.isArray(extracted.items) && extracted.items.length > 0
      ? `OCR loaded ${extracted.items.length} line item${extracted.items.length === 1 ? '' : 's'} — review HSN + tax rates before saving.`
      : 'OCR values loaded — please review, then break the total into line items with correct GST.';
    toast(msg, 'info');
  };

  const fyOptions = getFYOptions();


  // v1.10.65 (#58 item 3) — assign records saved before businesses were kept
  // separate. Never automatic: only the user knows which business an old
  // record belonged to, so guessing would file it into the wrong books.
  const unassignedPurchases = purchases.filter(isUnassignedToBusiness);
  const assignUnassignedPurchases = async () => {
    await Promise.all(unassignedPurchases.map(r => savePurchase({
      ...r,
      ownerGstin: ownerProfile?.gstin || '',
      ownerName: ownerProfile?.businessName || '',
    })));
    loadPurchases();
  };

  const loadPurchases = async () => {
    try {
      const [rows, prof, pos] = await Promise.all([
        getAllPurchases(),
        getProfile().catch(() => null),
        poEnabled ? getAllPurchaseOrders().catch(() => []) : [],
      ]);
      setOwnerProfile(prof);
      // v1.10.65 (#58 item 3) — show only this business's records. Anything
      // saved before businesses were separated has no owner recorded and is
      // always shown, so nothing disappears from an existing ledger.
      setPurchases((rows || []).filter(r => belongsToProfile(r, prof)));
      setOrders((pos || []).filter(r => belongsToProfile(r, prof)));
    } catch {
      toast('Failed to load purchases', 'error');
    }
  };

  // v1.10.54 — reported (#42, @sangwanmail-eng): "Product not show properly
  // in purchase tab". The Products & Services master held Keyboard,
  // motherboard, Mouse, Pen drive — but the purchase item dropdown offered
  // "mouse", "key", "Pen drive": lowercase variants and a half-typed entry
  // from old bills, with two real products missing entirely.
  //
  // Cause: v1.10.50 built the suggestion list purely from what had been
  // TYPED on past purchase bills, and never read the product master. The
  // save path already calls getAllProducts() to update stock, so the data
  // was right there — it just was not being used for suggestions.
  const loadProducts = async () => {
    try {
      setProducts(await getAllProducts());
    } catch {
      // Non-fatal: suggestions fall back to purchase history alone.
    }
  };

  useEffect(() => {
    if (fyOptions[0]) setFyFilter(fyOptions[0].value);
    loadPurchases();
    loadProducts();
  }, []);

  const filtered = purchases.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const hasItemSerial = (p.items || []).some(it =>
        (it.serialNo || '').toLowerCase().includes(q) ||
        (it.name || '').toLowerCase().includes(q)
      );
      if (!(p.supplierName || '').toLowerCase().includes(q) &&
          !(p.invoiceNumber || '').toLowerCase().includes(q) &&
          !(p.supplierGstin || '').toLowerCase().includes(q) &&
          !hasItemSerial) return false;
    }
    if (fyFilter) {
      const fy = fyOptions.find(f => f.value === fyFilter);
      if (fy && p.date) {
        if (p.date < fy.from || p.date > fy.to) return false;
      }
    }
    if (statusFilter === 'due' && purchaseStatus(p) === 'Paid') return false;
    if (statusFilter === 'Paid' && purchaseStatus(p) !== 'Paid') return false;
    return matchesCentre(p, centreFilter);
  });

  const totalStats = filtered.reduce((acc, p) => {
    const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
    return { taxable: acc.taxable + t.taxable, tax: acc.tax + t.tax, total: acc.total + t.finalTotal, owed: acc.owed + purchaseBalance(p) };
  }, { taxable: 0, tax: 0, total: 0, owed: 0 });

  const openAdd = () => {
    setForm({ ...emptyForm, date: localToday(), items: [{ ...emptyItem }] });
    setEditingId(null);
    try { setShowSerialNo(localStorage.getItem('fgsb_purchase_show_serial') === 'true'); } catch { /* ignore */ }
    setShowForm(true);
  };

  const openEdit = (purchase) => {
    if (purchase.items && purchase.items.some(i => (i.serialNo || '').trim())) {
      setShowSerialNo(true);
    }
    setForm({
      date: purchase.date || '',
      supplierName: purchase.supplierName || '',
      supplierAddress: purchase.supplierAddress || '',
      supplierGstin: purchase.supplierGstin || '',
      invoiceNumber: purchase.invoiceNumber || '',
      items: purchase.items && purchase.items.length > 0 ? purchase.items.map(i => ({ ...i })) : [{ ...emptyItem }],
      paymentStatus: purchase.paymentStatus || 'Unpaid',
      paymentMode: purchase.paymentMode || (purchase.payments && purchase.payments[0]?.mode) || 'cash',
      interstate: !!purchase.interstate,
      // Detect round-off from older entries: if roundOff field exists and is
      // non-zero, treat applyRoundOff as on. Older entries without the field
      // just default to off — they won't suddenly change totals on re-save.
      applyRoundOff: !!purchase.applyRoundOff || (typeof purchase.roundOff === 'number' && purchase.roundOff !== 0),
      note: purchase.note || '',
      kind: 'bill',
      poNumber: '',
      expectedDate: '',
      fromPo: purchase.fromPo || '',
      costCentre: purchase.costCentre || '',
      costCentreName: purchase.costCentreName || '',
      tdsOn: (Number(purchase.tdsAmount) || 0) > 0,
      tdsSection: purchase.tdsSection || '194C',
      tdsRate: purchase.tdsRate ?? 1,
      tdsAmountManual: purchase.tdsManual ? String(purchase.tdsAmount) : '',
    });
    setEditingId(purchase.id);
    setShowForm(true);
  };

  // v1.10.83 (#112) - a new purchase order, blank or copied from `from`
  // (Duplicate). The next number is shown at once; it is reserved on save.
  const openNewPo = async (from = null) => {
    const date = localToday();
    previewedPoRef.current = '';
    setForm({
      ...emptyForm,
      kind: 'po',
      date,
      ...(from ? {
        supplierName: from.supplierName || '',
        supplierAddress: from.supplierAddress || '',
        supplierGstin: from.supplierGstin || '',
        interstate: !!from.interstate,
        note: from.note || '',
      } : {}),
      items: from?.items?.length ? from.items.map(i => ({ ...i })) : [{ ...emptyItem }],
    });
    setEditingId(null);
    setShowForm(true);
    try {
      const next = await getNextPoNumber({ peek: true, businessKey: businessKeyOf(ownerProfile), date });
      previewedPoRef.current = next;
      setForm(prev => (prev.kind === 'po' && !prev.poNumber ? { ...prev, poNumber: next } : prev));
    } catch { /* offline: the user can type a number */ }
  };

  const openEditPo = (po) => {
    setForm({
      ...emptyForm,
      kind: 'po',
      date: po.date || '',
      expectedDate: po.expectedDate || '',
      poNumber: po.poNumber || '',
      supplierName: po.supplierName || '',
      supplierAddress: po.supplierAddress || '',
      supplierGstin: po.supplierGstin || '',
      interstate: !!po.interstate,
      note: po.note || '',
      costCentre: po.costCentre || '',
      costCentreName: po.costCentreName || '',
      items: po.items?.length ? po.items.map(i => ({ ...i })) : [{ ...emptyItem }],
    });
    setEditingId(po.id);
    setShowForm(true);
  };

  // Convert to purchase bill: the bill form, filled with what is still to
  // come on the order. Stock moves only when that bill is saved.
  const openBillFromPo = (po) => {
    setForm({ ...emptyForm, date: localToday(), ...billFormFromPo(po, purchases) });
    setEditingId(null);
    setShowForm(true);
  };

  const cancelPo = async (po) => {
    if (!await confirmAction({
      title: `Cancel ${po.poNumber || 'this purchase order'}?`,
      message: 'It keeps its number and can still be viewed and duplicated, but no longer edited or turned into a bill. Bills already saved from it stay as they are.',
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep it',
      tone: 'danger',
    })) return;
    try {
      await savePurchaseOrder({ ...po, cancelled: true, cancelledAt: new Date().toISOString() });
      toast(`${po.poNumber || 'Purchase order'} cancelled`, 'success');
      loadPurchases();
    } catch {
      toast('Could not cancel the purchase order', 'error');
    }
  };

  const handleSavePo = async () => {
    if (!form.date) { toast('PO date is required', 'warning'); return; }
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    const items = form.items
      .filter(i => (i.name || '').trim() && (parseFloat(i.quantity) || 0) > 0)
      .map(i => ({
        name: i.name.trim(),
        hsn: (i.hsn || '').trim(),
        serialNo: (i.serialNo || '').trim(),
        quantity: parseFloat(i.quantity) || 0,
        unit: (i.unit || '').trim(),
        rate: parseFloat(i.rate) || 0,
        discount: parseFloat(i.discount) || 0,
        discountType: i.discountType || 'percent',
        taxPercent: parseFloat(i.taxPercent) || 0,
        cessPercent: parseFloat(i.cessPercent) || 0,
      }));
    if (!items.length) { toast('Add at least one item with a quantity', 'warning'); return; }
    const existing = editingId ? orders.find(o => o.id === editingId) : null;
    let poNumber = (form.poNumber || '').trim();
    try {
      if (!existing && (!poNumber || poNumber === previewedPoRef.current)) {
        poNumber = await getNextPoNumber({ businessKey: businessKeyOf(ownerProfile), date: form.date });
      }
    } catch {
      if (!poNumber) { toast('Could not get the next PO number. Type one in PO number.', 'error'); return; }
    }
    if (orders.some(o => o.id !== editingId && String(o.poNumber || '').trim().toLowerCase() === poNumber.toLowerCase())) {
      setForm(prev => ({ ...prev, poNumber }));
      toast(`${poNumber} is already used by another purchase order`, 'warning');
      return;
    }
    const t = calcPurchaseTotal(items);
    try {
      await savePurchaseOrder({
        ...(existing || {}),
        poNumber,
        date: form.date,
        expectedDate: form.expectedDate || '',
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        interstate: !!form.interstate,
        // Same rule as receipts: an edited order keeps the business it had.
        ownerGstin: existing ? (existing.ownerGstin || '') : (ownerProfile?.gstin || ''),
        ownerName: existing ? (existing.ownerName || '') : (ownerProfile?.businessName || ''),
        items,
        note: (form.note || '').trim(),
        // v1.10.83 (#112) - cost centre on the order too (cleared when unpicked:
        // undefined drops the old value from the saved file).
        costCentre: undefined,
        costCentreName: undefined,
        ...centreFields(form.costCentre, form.costCentreName),
        taxableAmount: t.taxable,
        totalTax: t.tax,
        totalCess: t.cess,
        totalAmount: t.finalTotal,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
      toast(existing ? `${poNumber} updated` : `${poNumber} saved`, 'success');
      closeForm();
      loadPurchases();
    } catch {
      toast('Failed to save the purchase order', 'error');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, items: [{ ...emptyItem }] });
  };

  // v1.10.29 — reported: "option to view as pdf give it that will be
  // better". Generates a simple one-page purchase-bill PDF with header,
  // supplier block, line items table, tax breakdown, and total. Uses
  // jsPDF's built-in text/rect helpers (same as the ledger PDF) so we
  // don't pull autotable and keep the bundle small.
  const viewAsPdf = async (purchase) => {
    try {
      const { jsPDF } = await import('jspdf');
      const t = calcPurchaseTotal(purchase.items, !!purchase.applyRoundOff);
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginL = 15, marginR = 195;
      let y = 20;
      const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('PURCHASE BILL', marginL, y); y += 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(`Invoice #: ${purchase.invoiceNumber || '-'}`, marginL, y); y += 5;
      doc.text(`Date: ${purchase.date ? new Date(purchase.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}`, marginL, y); y += 5;
      doc.text(`Payment: ${PURCHASE_STATUS_LABEL[purchaseStatus(purchase)]}   ·   ${purchase.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}`, marginL, y); y += 8;
      doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.5);
      doc.line(marginL, y, marginR, y); y += 8;

      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Supplier', marginL, y); y += 6;
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(purchase.supplierName || '-', marginL, y); y += 5;
      // v1.10.29 — supplier address (wraps at ~110mm so it doesn't collide
      // with anything on the right side of the header).
      if (purchase.supplierAddress) {
        const wrapped = doc.splitTextToSize(purchase.supplierAddress, 110);
        wrapped.forEach(line => { doc.text(line, marginL, y); y += 5; });
      }
      if (purchase.supplierGstin) { doc.text(`GSTIN: ${purchase.supplierGstin}`, marginL, y); y += 5; }
      y += 4;

      // Items header
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('#', marginL, y);
      doc.text('Description', marginL + 8, y);
      doc.text('HSN', marginL + 80, y);
      doc.text('Qty', marginL + 100, y, { align: 'right' });
      doc.text('Rate', marginL + 122, y, { align: 'right' });
      doc.text('GST%', marginL + 140, y, { align: 'right' });
      doc.text('Amount', marginR, y, { align: 'right' });
      y += 2; doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;

      doc.setFont('helvetica', 'normal');
      (purchase.items || []).forEach((item, idx) => {
        if (y > 265) { doc.addPage(); y = 20; }
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const withTax = lineTotal * (1 + (Number(item.taxPercent) || 0) / 100);
        // v1.10.30 — reported: "in purchase bill pdf long names got cut in
        // pdf fix". Prior code used `.slice(0, 40)` which mid-word truncated
        // "4 Copier Paper (Pack of..." → "4 Copier Paper (Pack o". Now we
        // wrap the description into as many lines as needed (70mm column
        // width). The row height grows to fit the wrapped text so nothing
        // clips into the next line.
        const nameCol = 70; // mm — width of description column
        const fullDesc = item.serialNo ? `${String(item.name || '-')}\nSN/IMEI: ${item.serialNo}` : String(item.name || '-');
        const nameLines = doc.splitTextToSize(fullDesc, nameCol);
        const rowH = Math.max(6, nameLines.length * 4.5);
        // Page break if this row won't fit.
        if (y + rowH > 275) { doc.addPage(); y = 20; }
        doc.text(String(idx + 1), marginL, y);
        // Description wraps top-aligned.
        nameLines.forEach((line, lineIdx) => {
          doc.text(line, marginL + 8, y + lineIdx * 4.5);
        });
        // Everything else aligns to the top of the row (so it lines up
        // with the first line of the wrapped description).
        doc.text(String(item.hsn || '-'), marginL + 80, y);
        doc.text(String(item.quantity || 0), marginL + 100, y, { align: 'right' });
        doc.text(fmt(item.rate), marginL + 122, y, { align: 'right' });
        doc.text(String(item.taxPercent || 0) + '%', marginL + 140, y, { align: 'right' });
        doc.text(fmt(withTax), marginR, y, { align: 'right' });
        y += rowH;
      });

      // Totals
      y += 4; doc.setDrawColor(...getAccentRGB()); doc.setLineWidth(0.4);
      doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
      if (t.discount > 0.005) {
        doc.text('Subtotal', marginL + 100, y); doc.text(fmt(t.subtotal), marginR, y, { align: 'right' }); y += 5;
        doc.text('Discount', marginL + 100, y); doc.text('-' + fmt(t.discount), marginR, y, { align: 'right' }); y += 5;
      }
      doc.text('Taxable', marginL + 100, y); doc.text(fmt(t.taxable), marginR, y, { align: 'right' }); y += 5;
      // v1.10.74 - show the tax split instead of one combined line.
      if (purchase.interstate) {
        doc.text('IGST', marginL + 100, y); doc.text(fmt(t.tax), marginR, y, { align: 'right' }); y += 5;
      } else {
        const sp = splitPurchaseTax(t.tax, false);
        doc.text('CGST', marginL + 100, y); doc.text(fmt(sp.cgst), marginR, y, { align: 'right' }); y += 5;
        doc.text('SGST', marginL + 100, y); doc.text(fmt(sp.sgst), marginR, y, { align: 'right' }); y += 5;
      }
      if (t.cess > 0.005) { doc.text('Cess', marginL + 100, y); doc.text(fmt(t.cess), marginR, y, { align: 'right' }); y += 5; }
      if (Math.abs(t.roundOff) > 0.005) { doc.text('Round-off', marginL + 100, y); doc.text((t.roundOff > 0 ? '+' : '') + fmt(t.roundOff), marginR, y, { align: 'right' }); y += 5; }
      y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(marginL + 100, y, marginR, y); y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
      doc.text('TOTAL', marginL + 100, y); doc.text(fmt(t.finalTotal), marginR, y, { align: 'right' });
      if ((Number(purchase.tdsAmount) || 0) > 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); y += 6;
        doc.text(`Less: TDS (${String(purchase.tdsSection || '').replace(/-(co|tech|pm)$/, '')})`, marginL + 100, y); doc.text('-' + fmt(purchase.tdsAmount), marginR, y, { align: 'right' }); y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Paid to supplier', marginL + 100, y); doc.text(fmt(t.finalTotal - purchase.tdsAmount), marginR, y, { align: 'right' });
      }

      // v1.10.83 (#123) - payments made to the supplier, and what is left.
      const pays = purchase.payments || [];
      if (pays.length) {
        y += 12;
        if (y + 14 + pays.length * 5 > 280) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
        doc.text('Payments made', marginL, y); y += 2;
        doc.setLineWidth(0.2); doc.line(marginL, y, marginR, y); y += 5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        for (const x of pays) {
          if (y > 280) { doc.addPage(); y = 20; }
          const when = x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
          doc.text(when, marginL, y);
          doc.text(purchasePaymentModeName(x.mode), marginL + 30, y);
          doc.text(doc.splitTextToSize([x.reference, x.note].filter(Boolean).join(' · ') || '', 90)[0] || '', marginL + 60, y);
          doc.text(fmt(x.amount), marginR, y, { align: 'right' });
          y += 5;
        }
      }
      if (pays.length || purchaseStatus(purchase) === 'Paid') {
        y += pays.length ? 1 : 8;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(0);
        if (pays.length) { doc.text('Paid', marginL + 100, y); doc.text(fmt(purchasePaid(purchase)), marginR, y, { align: 'right' }); y += 5; }
        doc.setFont('helvetica', 'bold');
        doc.text('Balance due', marginL + 100, y); doc.text(fmt(purchaseBalance(purchase)), marginR, y, { align: 'right' });
      }

      if (purchase.note) {
        y += 14; doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(90);
        doc.text('Note: ' + purchase.note, marginL, y);
      }

      const safeInv = String(purchase.invoiceNumber || 'purchase').replace(/[^A-Za-z0-9._-]/g, '_');
      const filename = `Purchase-${safeInv}-${purchase.date || 'undated'}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Purchase PDF failed:', err);
      toast('Could not generate PDF — see console', 'error');
    }
  };

  const handleSave = async () => {
    if (form.kind === 'po') return handleSavePo();
    if (!form.supplierName.trim()) { toast('Supplier name is required', 'warning'); return; }
    if (!form.invoiceNumber.trim()) { toast('Invoice number is required', 'warning'); return; }
    // v1.10.58 — reported (#47 item 2, @sangwanmail-eng): "Purchase also
    // save without adding any product." Supplier and invoice number were
    // checked, but nothing verified the bill had any line items, so an
    // empty bill saved with a zero total.
    //
    // That is not merely untidy: a purchase bill is the ITC record. A zero
    // bill sits in GSTR-3B reconciliation as a vendor invoice claiming
    // nothing, and the empty rows also feed the stock/product sync on save.
    if (!form.items.some(i => (i.name || '').trim() && (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0) > 0)) {
      toast('Add at least one item with a quantity and rate', 'warning');
      return;
    }
    try {
      const totals = calcPurchaseTotal(form.items, form.applyRoundOff);
      const before = editingId ? purchases.find(p => p.id === editingId) : null;
      const purchaseFields = {
        ...(editingId ? { id: editingId } : {}),
        date: form.date,
        supplierName: form.supplierName.trim(),
        supplierAddress: (form.supplierAddress || '').trim(),
        supplierGstin: form.supplierGstin.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        // Which of YOUR businesses bought this. Distinct from supplierGstin
        // directly above, which is who sold it.
        ownerGstin: ownerProfile?.gstin || '',
        ownerName: ownerProfile?.businessName || '',
        items: form.items.map(i => ({
          name: (i.name || '').trim(),
          hsn: (i.hsn || '').trim(),
          serialNo: (i.serialNo || '').trim(),
          quantity: parseFloat(i.quantity) || 0,
          rate: parseFloat(i.rate) || 0,
          discount: parseFloat(i.discount) || 0,
          discountType: i.discountType || 'percent',
          taxPercent: parseFloat(i.taxPercent) || 0,
          cessPercent: parseFloat(i.cessPercent) || 0,
          // v1.10.83 (#112) - only lines from a purchase order carry a unit.
          ...(String(i.unit || '').trim() ? { unit: String(i.unit).trim() } : {}),
        })),
        // The purchase order this bill was made from; its status follows the
        // quantities on the bills linked to it.
        ...(form.fromPo ? { fromPo: form.fromPo } : {}),
        // totalAmount is the grand total INCLUDING round-off so the table
        // sum and GSTR-3B reconciliation both reflect what the supplier
        // actually charged. roundOff stored separately for audit clarity.
        totalAmount: totals.finalTotal,
        totalTax: totals.tax,
        taxableAmount: totals.taxable,
        totalDiscount: totals.discount || 0,
        subtotal: totals.subtotal || totals.taxable,
        applyRoundOff: !!form.applyRoundOff,
        roundOff: totals.roundOff,
        paymentStatus: form.paymentStatus,
        paymentMode: form.paymentMode || 'cash',
        interstate: !!form.interstate,
        note: form.note.trim(),
        ...centreFields(form.costCentre, form.costCentreName),
        ...purchaseTdsFields(form, totals.taxable),
      };
      // v1.10.83 (#123) - payments to the supplier stay with the bill when it
      // is edited, and the status follows them (and a new total or TDS). With
      // no payments, choosing Paid records one for the balance, as the list
      // does; an old bill already marked Paid keeps its mark.
      let purchase = purchaseFields;
      if (hasPurchasePayments(before)) {
        purchase = withPurchasePayments(purchaseFields, before.payments);
        if (purchasePaid(purchase) > purchaseOwed(purchase) + OVERPAY_SLACK) {
          toast(`Payments of ${formatCurrency(purchasePaid(purchase))} are already recorded, more than this bill now comes to (${formatCurrency(purchaseOwed(purchase))}). Change or delete a payment first (₹ button in the list).`, 'warning');
          return;
        }
      } else if (form.paymentStatus === 'Paid' && (before?.paymentStatus || 'Unpaid') !== 'Paid') {
        purchase = markPurchasePaid(purchaseFields, form.date || localToday(), new Date(), form.paymentMode || 'cash');
      }

      // Issue #199: Duplicate Product Detection & Inventory Reconciliation.
      // Automatically checks whether entered products exist in inventory
      // (matching by productId, barcode/serialNo, SKU, modelNumber, or normalized name).
      // - Prevents duplicate product records in the catalog.
      // - Updates existing product stock by adding newly purchased quantity.
      // - Updates latest purchase price (cost) while protecting selling price.
      // - Seeds truly new products with initial stock.
      // - Saves linkedItems with productId bound permanently to the purchase bill.
      try {
        const existingProducts = await getAllProducts();
        const priorLines = editingId
          ? (purchases.find(p => p.id === editingId)?.items || [])
          : [];

        const { productsToSave, linkedItems } = reconcilePurchaseProducts({
          items: purchase.items,
          existingProducts,
          isEdit: !!editingId,
          priorItems: priorLines,
        });

        purchase.items = linkedItems;
        await savePurchase(purchase);

        await Promise.all(productsToSave.map(prod => saveProduct(prod)));
        toast(editingId ? 'Purchase updated' : 'Purchase added — items synced to Products', 'success');
      } catch (e) {
        console.warn('Products auto-sync from purchase failed (non-fatal):', e);
        await savePurchase(purchase).catch(() => {});
        toast('Purchase saved, but updating stock in Products failed - check them there', 'warning');
      }

      closeForm();
      loadPurchases();
      // v1.10.54 — saving a bill upserts its items into the product master
      // (that is what the toast above means by "synced to Products"), so
      // refresh it too. Otherwise a brand-new item would not appear in the
      // suggestions until the page was reloaded.
      loadProducts();
    } catch {
      toast('Failed to save purchase', 'error');
    }
  };

  // v1.10.69 (#71 item 3) - change the payment status straight from the list.
  // Saves the whole record back, so nothing else about the bill is disturbed;
  // the list is reloaded afterwards so the supplier-payable totals follow.
  // v1.10.83 (#123) - Paid records one payment for the balance, Unpaid takes
  // that payment back (yours stay), Partly paid opens Record payment for the
  // amount. See utils/purchasePayments.js.
  const changePaymentStatus = async (purchase, paymentStatus) => {
    if (purchaseStatus(purchase) === paymentStatus) return;
    if (paymentStatus === 'Partial') { setPayPurchase(purchase); return; }
    const next = paymentStatus === 'Paid' ? markPurchasePaid(purchase, localToday(), new Date(), 'cash') : markPurchaseUnpaid(purchase);
    try {
      await savePurchase(next);
      const now = purchaseStatus(next);
      toast(now === paymentStatus ? `Marked ${PURCHASE_STATUS_LABEL[now].toLowerCase()}`
        : `Now ${PURCHASE_STATUS_LABEL[now].toLowerCase()}: payments you recorded stay. Delete them with the ₹ button.`, now === paymentStatus ? 'success' : 'info');
      loadPurchases();
    } catch {
      toast('Could not change the status', 'error');
    }
  };

  // Take a deleted bill's quantities back out of product stock.
  // Matches products the same way saving does: productId, then name.
  const revertPurchaseStock = async (bill) => {
    const lines = (bill?.items || []).filter(it => it.name && Number(it.quantity) > 0);
    if (!lines.length) return;
    const products = await getAllProducts();
    const byName = new Map(products.map(p => [(p.name || '').trim().toLowerCase(), p]));
    const byId = new Map(products.map(p => [p.id, p]));
    const minus = new Map();
    for (const it of lines) {
      const prod = (it.productId && byId.get(it.productId)) || byName.get(it.name.trim().toLowerCase());
      if (prod) minus.set(prod.id, (minus.get(prod.id) || 0) + Number(it.quantity));
    }
    await Promise.all([...minus].map(([pid, qty]) => {
      const prod = byId.get(pid);
      return saveProduct({ ...prod, stock: roundQty((Number(prod.stock) || 0) - qty) });
    }));
  };

  const handleDelete = async (id) => {
    // A bill's payments are kept only on the bill, so they go with it.
    const target = purchases.find(p => p.id === id);
    const paidNote = hasPurchasePayments(target)
      ? ` Its payments of ${formatCurrency(purchasePaid(target))} are deleted with it and leave the Cash book. To re-enter the bill, edit it instead.`
      : '';
    if (await confirmAction({
      title: 'Delete this purchase bill?',
      message: `Stock levels for the products in this bill will be reverted. Any GST ITC already claimed against this bill in past returns stays as filed.${paidNote}`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        const bill = purchases.find(p => p.id === id);
        await deletePurchase(id);
        // The confirm above promises this: the bill's quantities were added to
        // stock when it was saved, so deleting it takes them back out.
        let stockOk = true;
        try { await revertPurchaseStock(bill); } catch (e) { stockOk = false; console.warn('Stock revert failed', e); }
        toast(stockOk ? 'Purchase deleted' : 'Purchase deleted, but its stock could not be taken out of Products', stockOk ? 'success' : 'warning');
        loadPurchases();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  // v1.10.50 — reported (#39, @sangwanmail-eng): "In add purchase option
  // previous added supplier and item not shown. So all details need to be
  // fill again, like supplier name, gst number, address, item name etc".
  //
  // Purchase bills store supplier details INLINE (supplierName /
  // supplierGstin / supplierAddress) rather than against a supplier master
  // record, so unlike the invoice side — which has saved clients and
  // product suggestions — there was nothing to recall and every bill meant
  // retyping the GSTIN by hand. For someone entering a stack of bills from
  // the same three or four vendors that is the bulk of the typing, and a
  // mistyped GSTIN quietly breaks ITC reconciliation in GSTR-3B.
  //
  // Rather than introduce a supplier master (a migration, and a second
  // place for the same data to drift), derive the history from the bills
  // already loaded in `purchases`. Newest first, so the most recent
  // spelling of a supplier wins.
  const supplierHistory = useMemo(() => {
    const seen = new Map();
    for (const p of purchases) {
      const name = (p.supplierName || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      // First wins: `purchases` arrives newest-first, so this keeps the
      // most recent details for a supplier rather than the oldest.
      if (!seen.has(key)) {
        seen.set(key, {
          name,
          gstin: (p.supplierGstin || '').trim(),
          address: (p.supplierAddress || '').trim(),
          interstate: !!p.interstate,
        });
      }
    }
    return [...seen.values()];
  }, [purchases]);

  // v1.10.54 (#42) — suggestions come from the product master FIRST, then
  // anything else that has been typed on a past bill.
  //
  // Order matters: the master is inserted first and the map is first-wins,
  // so "Mouse" from Products beats a stray "mouse" typed on an old bill.
  // Deduping is case-insensitive for the same reason — the user should see
  // one entry with the spelling they curated, not two differing in case.
  //
  // Purchase-only names are still kept. A one-off item bought once and
  // never added to the catalogue is legitimate history, and there is no
  // reliable way to tell that apart from an old typo — so both stay, and
  // the user decides.
  const itemHistory = useMemo(() => {
    const seen = new Map();

    for (const pr of products) {
      const name = (pr.name || '').trim();
      if (!name) continue;
      seen.set(name.toLowerCase(), {
        productId: pr.id,
        name,
        brand: (pr.brand || '').trim(),
        modelNumber: (pr.modelNumber || pr.model || '').trim(),
        barcode: (pr.barcode || '').trim(),
        sku: (pr.sku || '').trim(),
        stock: Number(pr.stock) || 0,
        hsn: (pr.hsn || '').trim(),
        // purchasePrice is what we PAY a supplier; `rate`/sellingPrice is
        // what we charge a customer. On a purchase bill the former is the
        // sensible prefill.
        rate: Number(pr.purchasePrice) || Number(pr.rate) || 0,
        taxPercent: Number(pr.taxPercent) || 0,
        cessPercent: Number(pr.cessPercent) || 0,
        unit: String(pr.unit || '').trim(),
      });
    }

    for (const p of purchases) {
      for (const it of (p.items || [])) {
        const name = (it.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            productId: it.productId,
            name,
            brand: (it.brand || '').trim(),
            modelNumber: (it.modelNumber || '').trim(),
            barcode: (it.barcode || '').trim(),
            sku: (it.sku || '').trim(),
            stock: 0,
            hsn: (it.hsn || '').trim(),
            rate: Number(it.rate) || 0,
            taxPercent: Number(it.taxPercent) || 0,
            cessPercent: Number(it.cessPercent) || 0,
            unit: String(it.unit || '').trim(),
          });
        }
      }
    }

    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [products, purchases]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // v1.10.76 (#82) - a full supplier GSTIN sets "Inter-state" from the two
  // states, the way sales invoices already work it out. The box stays
  // editable for the rare exception.
  const updateSupplierGstin = (value) => setForm(prev => {
    const interstate = isInterstateSupply(value, ownerProfile);
    return interstate === null ? { ...prev, supplierGstin: value } : { ...prev, supplierGstin: value, interstate };
  });

  // Typing or picking a known supplier fills in the rest of their details.
  //
  // Deliberately only fills fields the user has left BLANK. Overwriting
  // whatever they already typed would be worse than not helping — someone
  // correcting a supplier's new GSTIN would watch the old one reappear as
  // they finished typing the name.
  const updateSupplierName = (value) => {
    const match = supplierHistory.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
    setForm(prev => {
      const next = { ...prev, supplierName: value };
      if (match) {
        // v1.10.55 (#43) — same re-selection bug as the item rows, and worse
        // here: switching supplier used to leave the PREVIOUS supplier's
        // GSTIN in place, so the bill was filed against the wrong taxpayer
        // and ITC reconciliation broke. See isOursToReplace above.
        const last = prev._autoSupplier || {};
        if (isOursToReplace(prev.supplierGstin, last.gstin)) next.supplierGstin = match.gstin;
        if (isOursToReplace(prev.supplierAddress, last.address)) next.supplierAddress = match.address;
        // Interstate drives CGST+SGST vs IGST, so recall it too — it is a
        // property of where the supplier is, and getting it wrong routes
        // ITC to the wrong GSTR-3B column.
        next.interstate = match.interstate;
        next._autoSupplier = { gstin: match.gstin, address: match.address };
      }
      return next;
    });
  };

  // Same idea for line items: recall HSN, rate and tax rates from the last
  // time this item was purchased. Rate is filled only when still 0 so a
  // price change the user has already typed is never clobbered.
  // v1.10.55 — reported (#43, @sangwanmail-eng): "when we select item all
  // details fetch ok. But when we change item in same field details not
  // change."
  //
  // v1.10.50 filled a field only when it was BLANK, to avoid overwriting
  // something the user had typed. That protected typed input but broke
  // re-selection: pick "Pen drive" (HSN fills to `s`), then change the same
  // row to "Mouse" — HSN is no longer blank, so it stayed on Pen drive's
  // value. The bill then carried the wrong HSN and the wrong rate, silently.
  //
  // The flaw was treating "field is non-empty" as "user typed this". We now
  // record what WE auto-filled on the row (`_auto`, transient — the save
  // path whitelists fields, so it never persists). A field is ours to
  // replace when it is empty or still holds exactly what we last put there;
  // once the user edits it, it stops matching and we leave it alone.
  //
  // So: re-selecting updates the details, and a hand-typed correction still
  // survives — both, rather than one at the cost of the other.
  const isOursToReplace = (current, lastAuto) => {
    const cur = current === undefined || current === null ? '' : String(current).trim();
    if (cur === '' || cur === '0') return true;              // never filled, or still zero
    if (lastAuto === undefined || lastAuto === null) return false;
    return cur === String(lastAuto).trim();                  // untouched since we filled it
  };

  const updateItemName = (index, value) => {
    const match = itemHistory.find(i => i.name.toLowerCase() === value.trim().toLowerCase());
    setForm(prev => {
      const items = [...prev.items];
      const cur = { ...items[index], name: value };
      if (match) {
        if (match.productId) cur.productId = match.productId;
        const last = cur._auto || {};
        if (isOursToReplace(cur.hsn, last.hsn)) cur.hsn = match.hsn;
        if (isOursToReplace(cur.rate, last.rate)) cur.rate = match.rate;
        // A product with no GST rate saved keeps the row's default (18%), as
        // the invoice screen does, instead of turning it into 0%.
        const hasRate = match.taxPercent !== undefined && match.taxPercent !== null && match.taxPercent !== '';
        if (hasRate && isOursToReplace(cur.taxPercent, last.taxPercent)) cur.taxPercent = match.taxPercent;
        if (isOursToReplace(cur.cessPercent, last.cessPercent)) cur.cessPercent = match.cessPercent;
        // v1.10.83 (#112) - unit only on a purchase order; bills have no unit field.
        if (prev.kind === 'po' && isOursToReplace(cur.unit, last.unit)) cur.unit = match.unit;
        // Remember exactly what we just wrote, so the next re-selection can
        // tell our values apart from the user's.
        cur._auto = {
          hsn: match.hsn,
          rate: match.rate,
          taxPercent: cur.taxPercent,
          cessPercent: match.cessPercent,
          unit: match.unit,
        };
      } else {
        // Issue #199: Check if matches any existing inventory product directly
        const dup = findDuplicateProduct({ name: value }, products);
        if (dup.isDuplicate && dup.existingProduct) {
          const ep = dup.existingProduct;
          cur.productId = ep.id;
          const last = cur._auto || {};
          if (isOursToReplace(cur.hsn, last.hsn)) cur.hsn = ep.hsn || '';
          const epCost = Number(ep.purchasePrice) || Number(ep.rate) || 0;
          if (epCost > 0 && isOursToReplace(cur.rate, last.rate)) cur.rate = epCost;
          if (ep.taxPercent !== undefined && isOursToReplace(cur.taxPercent, last.taxPercent)) cur.taxPercent = ep.taxPercent;
          if (prev.kind === 'po' && ep.unit && isOursToReplace(cur.unit, last.unit)) cur.unit = ep.unit;
          cur._auto = {
            hsn: ep.hsn,
            rate: epCost,
            taxPercent: cur.taxPercent,
            cessPercent: ep.cessPercent,
            unit: ep.unit,
          };
        } else {
          cur.productId = undefined;
        }
      }
      items[index] = cur;
      return { ...prev, items };
    });
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    // Tag the new row so we can focus its first input after React renders.
    // Tab → Enter on the Add Item button now keeps the user in keyboard
    // flow instead of forcing a mouse click on the empty row.
    const focusKey = 'new-' + Date.now();
    setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem, _focusKey: focusKey }] }));
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-focus-key="${focusKey}"] input.form-input`);
      if (el) el.focus();
    });
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  // v1.10.77 (#85) - the purchase register as CSV, Excel or Print / PDF, with
  // a total row. v1.10.74 columns kept: Cess and Inter-state; Tax never
  // included cess.
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const registerRows = (() => {
    if (!filtered.length) return [];
    const sum = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, roundOff: 0, finalTotal: 0, paid: 0, balance: 0 };
    const rows = [...filtered].sort((x, y) => String(x.date || '').localeCompare(String(y.date || ''))).map(p => {
      const t = { ...calcPurchaseTotal(p.items, !!p.applyRoundOff), paid: purchasePaid(p), balance: purchaseBalance(p) };
      Object.assign(t, splitPurchaseTax(t.tax, !!p.interstate));
      for (const k of Object.keys(sum)) sum[k] += Number(t[k]) || 0;
      return [p.date || '', p.supplierName || '', p.supplierGstin || '', p.invoiceNumber || '', r2(t.taxable), r2(t.cgst), r2(t.sgst), r2(t.igst), r2(t.cess),
        p.interstate ? 'Y' : 'N', r2(t.roundOff), r2(t.finalTotal), r2(t.paid), r2(t.balance), PURCHASE_STATUS_LABEL[purchaseStatus(p)], p.note || ''];
    });
    return [...rows, ['Total', '', '', '', r2(sum.taxable), r2(sum.cgst), r2(sum.sgst), r2(sum.igst), r2(sum.cess), '', r2(sum.roundOff), r2(sum.finalTotal), r2(sum.paid), r2(sum.balance), '', '']];
  })();

  const isPo = form.kind === 'po';
  const editingBill = !isPo && editingId ? purchases.find(p => p.id === editingId) : null;
  const fromPoNumber = form.fromPo ? orders.find(o => o.id === form.fromPo)?.poNumber : '';
  const formTotals = calcPurchaseTotal(form.items, !isPo && form.applyRoundOff);
  const formTds = !isPo && form.tdsOn ? purchaseTdsFields(form, formTotals.taxable).tdsAmount : 0;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">{poEnabled ? 'Purchases' : 'Purchase Bills'} <HelpButton title="Purchase Bills — how to use" doc="purchases" size={16} /></h1>
            <p className="page-subtitle">Track supplier invoices for ITC claims in GSTR-3B</p>
          </div>
        </div>
        {tab === 'orders' ? (
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => openNewPo()}><Plus size={18} /> New purchase order</button>
          </div>
        ) : (
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowOCR(true)} title="Extract fields from a bill photo/scan">
            <ScanText size={16} /> Import from image (OCR)
          </button>
          <BulkCsvImport kind="purchase" onDone={() => { loadPurchases(); loadProducts(); }} />
          <button className="btn btn-secondary" onClick={() => gstrInputRef.current?.click()} title="Import purchase bills directly from GSTR-2B or GSTR-2A JSON file from GST portal">
            <Upload size={16} /> Import GSTR-2B / 2A
          </button>
          <input ref={gstrInputRef} type="file" accept=".json,application/json" onChange={handleGstrJsonImport} style={{ display: 'none' }} />
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase</button>
        </div>
        )}
      </div>

      {/* v1.10.83 (#112) - Purchase bills | Purchase orders, only when the
          Purchase orders feature is on. */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className={`btn ${tab === 'bills' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bills')} aria-pressed={tab === 'bills'}>
          <ShoppingCart size={16} /> Purchase bills
        </button>
        <button className={`btn ${tab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('suppliers')} aria-pressed={tab === 'suppliers'}>
          <Building2 size={16} /> Supplier Accounts
        </button>
        {poEnabled && (
          <button className={`btn ${tab === 'orders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('orders')} aria-pressed={tab === 'orders'}>
            <ClipboardList size={16} /> Purchase orders
          </button>
        )}
      </div>

      {tab === 'orders' && (
        <PurchaseOrders orders={orders} purchases={purchases} ownerProfile={ownerProfile}
          onNew={() => openNewPo()} onEdit={openEditPo} onConvert={openBillFromPo}
          onDuplicate={openNewPo} onCancel={cancelPo} />
      )}

      {/* v1.10.22 — Bill OCR modal (tesseract.js, lazy-loaded). */}
      {showOCR && (
        <Suspense fallback={<div className="modal-overlay"><div className="modal-content" style={{ maxWidth: 320, textAlign: 'center' }}>Loading OCR…</div></div>}>
          <BillOCR onClose={() => setShowOCR(false)} onExtracted={applyOCR} />
        </Suspense>
      )}

      {/* v1.10.30 — Purchase view modal (quick check, no download). */}
      {viewPurchase && (() => {
        const p = viewPurchase;
        const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
        return (
          <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Purchase Bill · {p.invoiceNumber || '—'} <HelpButton title="Viewing a purchase bill" doc="purchases#view-bill" size={16} /></h3>
                <button className="icon-btn" onClick={() => setViewPurchase(null)} title="Close"><X size={18} /></button>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''} · {PURCHASE_STATUS_LABEL[purchaseStatus(p)]} · {p.interstate ? 'Interstate (IGST)' : 'Intrastate (CGST+SGST)'}
              </div>
              {/* Supplier block */}
              <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: 6, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Supplier</div>
                <div style={{ fontWeight: 600 }}>{p.supplierName || '—'}</div>
                {p.supplierAddress && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.supplierAddress}</div>}
                {p.supplierGstin && <div style={{ fontSize: '0.82rem' }}>GSTIN: <strong>{p.supplierGstin}</strong></div>}
              </div>
              {/* Line items */}
              <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, marginBottom: '1rem' }}>
                <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>GST%</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(p.items || []).map((it, idx) => {
                      const line = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
                      const withTax = line * (1 + (Number(it.taxPercent) || 0) / 100);
                      return (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {it.name || '—'}
                            {it.serialNo && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 500, marginTop: 2 }}>
                                SN / IMEI: {it.serialNo}
                              </div>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{it.hsn || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{it.quantity || 0}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(it.rate || 0)}</td>
                          <td style={{ textAlign: 'right' }}>{it.taxPercent || 0}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(withTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem 1rem', fontSize: '0.9rem', maxWidth: 320, marginLeft: 'auto' }}>
                {t.discount > 0.005 && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span style={{ textAlign: 'right' }}>{formatCurrency(t.subtotal)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <span style={{ textAlign: 'right', color: 'var(--danger, #b3453a)' }}>-{formatCurrency(t.discount)}</span>
                  </>
                )}
                <span style={{ color: 'var(--text-muted)' }}>Taxable</span>
                <span style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</span>
                {/* v1.10.74 - tax split: IGST, or CGST + SGST half each. */}
                {p.interstate ? (
                  <><span style={{ color: 'var(--text-muted)' }}>IGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.tax)}</span></>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>CGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(splitPurchaseTax(t.tax, false).cgst)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>SGST</span><span style={{ textAlign: 'right' }}>{formatCurrency(splitPurchaseTax(t.tax, false).sgst)}</span>
                  </>
                )}
                {t.cess > 0.005 && <><span style={{ color: 'var(--text-muted)' }}>Cess</span><span style={{ textAlign: 'right' }}>{formatCurrency(t.cess)}</span></>}
                {Math.abs(t.roundOff) > 0.005 && <><span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Round-off</span><span style={{ textAlign: 'right', fontStyle: 'italic' }}>{(t.roundOff > 0 ? '+' : '') + formatCurrency(t.roundOff)}</span></>}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, fontWeight: 700 }}>TOTAL</span>
                {/* v1.10.34 — was hardcoded color:'#0f172a' (slate-900) which
                    disappeared against the dark card background. Reported
                    with screenshot showing invisible total on Purchase Bill
                    view modal. Now uses --text so it flips with theme. */}
                <span style={{ borderTop: '2px solid var(--text)', paddingTop: 6, textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{formatCurrency(t.finalTotal)}</span>
                {(Number(p.tdsAmount) || 0) > 0 && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Less: TDS ({String(p.tdsSection || '').replace(/-(co|tech|pm)$/, '')}{p.tdsRate ? ` @ ${p.tdsRate}%` : ''})</span>
                    <span style={{ textAlign: 'right' }}>-{formatCurrency(p.tdsAmount)}</span>
                    <span style={{ fontWeight: 600 }}>Paid to supplier</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(t.finalTotal - p.tdsAmount)}</span>
                  </>
                )}
                {/* v1.10.83 (#123) - paid so far and what is left. */}
                {hasPurchasePayments(p) && (
                  <><span style={{ color: 'var(--text-muted)' }}>Paid</span><span style={{ textAlign: 'right' }}>{formatCurrency(purchasePaid(p))}</span></>
                )}
                <span style={{ fontWeight: 600 }}>Balance due</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: purchaseBalance(p) > 0.005 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(purchaseBalance(p))}</span>
              </div>
              {hasPurchasePayments(p) && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="form-label">Payments made <HelpButton title="Payment history" doc="purchases#payment-history" size={14} /></div>
                  <div className="payment-history">
                    {p.payments.map((x, i) => (
                      <div key={x.id || i} className="payment-row" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 90 }}>{x.date ? new Date(`${x.date}T00:00:00`).toLocaleDateString('en-IN') : '-'}</span>
                        <span className="font-bold" style={{ minWidth: 100 }}>{formatCurrency(x.amount)}</span>
                        <span className="text-muted">{purchasePaymentModeName(x.mode)}</span>
                        {(x.reference || x.note) && <span className="text-muted" style={{ overflowWrap: 'anywhere' }}>· {[x.reference, x.note].filter(Boolean).join(' · ')}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {p.note &&<p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '1rem' }}>Note: {p.note}</p>}
              {/* Action bar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setViewPurchase(null)}>Close</button>
                <button className="btn btn-secondary" onClick={() => { setPayPurchase(p); setViewPurchase(null); }}><IndianRupee size={14} /> Payments</button>
                <button className="btn btn-secondary" onClick={() => { openEdit(p); setViewPurchase(null); }}><Edit3 size={14} /> Edit</button>
                <button className="btn btn-primary" onClick={() => viewAsPdf(p)}><Download size={14} /> Download PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {payPurchase && (
        <PurchasePaymentModal purchase={payPurchase} onClose={() => setPayPurchase(null)} onChanged={() => loadPurchases()} />
      )}

      {/* Stats */}
      {tab === 'bills' && (<>
      <UnassignedBanner
        count={unassignedPurchases.length}
        businessName={ownerProfile?.businessName}
        noun="purchase bill"
        onAssign={assignUnassignedPurchases}
      />

      <div className="stats-grid stats-grid-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">Total Purchases</p><h2 className="stat-value stat-value-purple">{formatCurrency(totalStats.total)}</h2></div>
        </div>
        {/* v1.10.83 (#123) - what is still to pay on the bills shown. */}
        <div className="stat-card">
          <div className="stat-icon stat-icon-amber"><IndianRupee size={22} /></div>
          <div>
            <p className="stat-label">Owed to suppliers <HelpButton title="Owed to suppliers" doc="purchases#owed-to-suppliers" size={13} /></p>
            <h2 className="stat-value" style={{ color: totalStats.owed > 0.005 ? 'var(--danger)' : undefined }}>{formatCurrency(totalStats.owed)}</h2>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">GST (ITC Eligible)</p><h2 className="stat-value stat-value-green">{formatCurrency(totalStats.tax)}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><ShoppingCart size={22} /></div>
          <div><p className="stat-label">Entries</p><h2 className="stat-value">{filtered.length}</h2></div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4 mb-6">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Search supplier, invoice..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
          </div>
          <select className="filter-select" value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
            {/* v1.10.74 - '' already means no FY filter below. */}
            <option value="">All years</option>
            {fyOptions.map(fy => <option key={fy.value} value={fy.value}>{fy.label}</option>)}
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Payment status">
            <option value="">All bills</option>
            <option value="due">Unpaid / Partly paid</option>
            <option value="Paid">Paid</option>
          </select>
          {ccOn && <CostCentreFilter centres={centres} value={centreFilter} onChange={setCentreFilter} />}
          {(search || centreFilter || statusFilter) && (
            <button className="icon-btn icon-btn-red" onClick={() => { setSearch(''); setCentreFilter(''); setStatusFilter(''); }} title="Clear search" aria-label="Clear search"><X size={15} /></button>
          )}
        </div>
      </div>

      </>)}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <h3 className="section-title">{isPo ? (editingId ? 'Edit purchase order' : 'New purchase order') : (editingId ? 'Edit Purchase Bill' : 'Add Purchase Bill')} <HelpButton title="Purchases" doc={isPo ? 'purchases#new-po' : (fromPoNumber && !editingId) ? 'purchases#convert-po' : 'purchases#add-purchase'} size={16} style={{ marginLeft: 6 }} /></h3>
            {/* v1.10.83 (#112) - a bill made from a purchase order. */}
            {!isPo && fromPoNumber && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
                From purchase order <strong>{fromPoNumber}</strong>. Type the supplier's bill number, and change quantities to what actually came.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">{isPo ? 'PO date *' : 'Date *'}</label>
                <input type="date" className="form-input" value={form.date} onChange={e => updateField('date', e.target.value)} />
              </div>
              {isPo ? (
                <div className="form-group">
                  <label className="form-label">Expected delivery</label>
                  <input type="date" className="form-input" value={form.expectedDate} onChange={e => updateField('expectedDate', e.target.value)} />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Payment Status <HelpButton title="Paying suppliers" doc="purchases#payment-status" size={13} /></label>
                    {/* v1.10.83 (#123) - with payments recorded, they decide the
                        status: change them from the ₹ button in the list. A part
                        payment needs its amount, so Partly paid is not offered here
                        (an old bill already Partial keeps it). */}
                    {hasPurchasePayments(editingBill) ? (
                      <div className="form-input" style={{ background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                        {PURCHASE_STATUS_LABEL[purchaseStatus(editingBill)]} · {editingBill.payments.length} payment{editingBill.payments.length === 1 ? '' : 's'} (₹ button in the list)
                      </div>
                    ) : (
                      <select className="form-input" value={form.paymentStatus} onChange={e => updateField('paymentStatus', e.target.value)}>
                        {PAYMENT_STATUSES.filter(s => s !== 'Partial' || form.paymentStatus === 'Partial').map(s => <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>)}
                      </select>
                    )}
                  </div>
                  {form.paymentStatus === 'Paid' && !hasPurchasePayments(editingBill) && (
                    <div className="form-group">
                      <label className="form-label">Payment Mode</label>
                      <select className="form-input" value={form.paymentMode || 'cash'} onChange={e => updateField('paymentMode', e.target.value)}>
                        <option value="cash">Cash (Updates Cash Book)</option>
                        <option value="bank-transfer">Bank Transfer</option>
                        <option value="upi">UPI</option>
                        <option value="cheque">Cheque</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="form-group">
                <label className="form-label">Supplier Name *</label>
                {/* v1.10.50 (#39) — recall previously used suppliers. A native
                    <datalist> rather than a custom dropdown: it is keyboard
                    accessible for free, does not trap focus, and degrades to a
                    plain text field, which matters because a supplier not yet
                    in the history must still be typeable. */}
                <input type="text" className="form-input" value={form.supplierName}
                  list="fgsb-supplier-history" autoComplete="off"
                  onChange={e => updateSupplierName(e.target.value)}
                  placeholder={supplierHistory.length ? 'Type or pick a previous supplier' : 'Vendor / Supplier name'} />
                {/* v1.10.52 (#40) — value ONLY, never child text or a label
                    attribute. Browsers disagree about which one they show:
                    Chrome lists the value with the label as secondary text,
                    Firefox shows the label INSTEAD of the value. v1.10.50 put
                    the GSTIN in the child text as a hint, so Firefox users got
                    a list of GST numbers where supplier names should be.
                    The GSTIN is auto-filled on selection anyway, so the hint
                    bought nothing and cost the actual name. */}
                <datalist id="fgsb-supplier-history">
                  {supplierHistory.map(s => <option key={s.name} value={s.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Supplier GSTIN</label>
                <input type="text" className="form-input" value={form.supplierGstin}
                  onChange={e => updateSupplierGstin(e.target.value)} placeholder="15-digit GSTIN" maxLength={15} />
              </div>
              {/* v1.10.29 — Supplier address for the PDF. Optional; full width row. */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Supplier Address (optional)</label>
                <input type="text" className="form-input" value={form.supplierAddress || ''}
                  onChange={e => updateField('supplierAddress', e.target.value)}
                  placeholder={isPo ? 'Street, City, State — printed on the PO' : 'Street, City, State — printed on the Purchase Bill PDF'} />
              </div>
              {isPo ? (<>
                <div className="form-group">
                  <label className="form-label">PO number *</label>
                  <input type="text" className="form-input" value={form.poNumber}
                    onChange={e => updateField('poNumber', e.target.value)} placeholder="PO/26-27/0001" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes / terms (optional)</label>
                  <textarea className="form-input" rows={3} value={form.note}
                    onChange={e => updateField('note', e.target.value)} placeholder="Delivery address, payment terms, packing..." />
                </div>
              </>) : (<>
              <div className="form-group">
                <label className="form-label">Invoice Number *</label>
                <input type="text" className="form-input" value={form.invoiceNumber}
                  onChange={e => updateField('invoiceNumber', e.target.value)} placeholder="Supplier invoice no." />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={form.note}
                  onChange={e => updateField('note', e.target.value)} placeholder="Any note..." />
              </div>
              </>)}
              {ccOn && (
                <div className="form-group">
                  <label className="form-label" htmlFor="cost-centre">Cost centre</label>
                  <CostCentreSelect centres={centres} value={form.costCentre} name={form.costCentreName}
                    onChange={(id, name) => setForm(prev => ({ ...prev, costCentre: id, costCentreName: name }))} />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.interstate}
                    onChange={e => updateField('interstate', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                  <span>
                    <strong>Inter-state purchase</strong> — supplier charged IGST (different state)
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>
                      Routes ITC to IGST in GSTR-3B instead of CGST + SGST. Tip: first 2 digits of supplier GSTIN = their state code.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Items <HelpButton title="Items on the bill" doc="purchases#purchase-items" size={16} />
              </h4>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none', background: 'var(--bg-secondary, rgba(0,0,0,0.03))', padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={showSerialNo}
                  onChange={e => {
                    const val = e.target.checked;
                    setShowSerialNo(val);
                    try { localStorage.setItem('fgsb_purchase_show_serial', val ? 'true' : 'false'); } catch { /* ignore */ }
                  }}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Serial No. / IMEI</span>
              </label>
            </div>
            {/* v1.10.84 (#137, #158) - Barcode Quick-Scan for Purchase Entry */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.65rem',
              padding: '0.55rem 0.85rem', marginBottom: '0.85rem',
              background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
              border: '1px solid var(--border)', borderRadius: 8,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.84rem' }}>
                <Scan size={18} />
                <span>Scan Barcode:</span>
              </div>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Scan goods received or type barcode + Enter"
                  value={purchaseScannedBarcode}
                  onChange={(e) => setPurchaseScannedBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePurchaseBarcodeScan(purchaseScannedBarcode);
                    }
                  }}
                  style={{ fontSize: '0.84rem', padding: '0.35rem 0.65rem', height: 32 }}
                />
                {purchaseScannedBarcode && (
                  <button
                    type="button"
                    onClick={() => setPurchaseScannedBarcode('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Scan item barcode to auto-fill (adds +1 Qty on repeat scans)
              </span>
            </div>
            {/* Rendered once for all rows — a <datalist> is referenced by id,
                so duplicating it per row would only bloat the DOM. */}
            {/* Same rule as the supplier list above — value only. */}
            <datalist id="fgsb-item-history">
              {itemHistory.map(i => <option key={i.name} value={i.name} />)}
            </datalist>
            {isPo && (
              <datalist id="fgsb-unit-list">
                {getAllUnits().map(u => <option key={u.label} value={u.label} />)}
              </datalist>
            )}
            {form.items.map((item, idx) => {
              const dup = findDuplicateProduct(item, products);
              const isExisting = dup.isDuplicate && dup.existingProduct;
              const details = isExisting ? formatDuplicateProductDetails(dup.existingProduct) : null;
              const updatedStock = isExisting ? calculateUpdatedStock(details.stock, item.quantity) : null;

              return (
                <div key={idx} data-focus-key={item._focusKey} style={{ marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: isPo ? 1.2 : 2, margin: 0 }}>
                      {idx === 0 && <label className="form-label">Name</label>}
                      {/* v1.10.50 (#39) — recall previously purchased items along
                          with their HSN, rate and tax rates. One shared datalist
                          serves every row; the browser scopes suggestions to the
                          focused input. */}
                      <input type="text" className="form-input" value={item.name}
                        list="fgsb-item-history" autoComplete="off"
                        onChange={e => updateItemName(idx, e.target.value)}
                        placeholder={itemHistory.length ? 'Type or pick a previous item' : 'Item name'} />
                    </div>
                    {showSerialNo && (
                      <div className="form-group" style={{ flex: isPo ? 1.1 : 1.3, margin: 0, minWidth: 120 }}>
                        {idx === 0 && <label className="form-label">Serial / IMEI</label>}
                        <input type="text" className="form-input" value={item.serialNo || ''}
                          onChange={e => updateItem(idx, 'serialNo', e.target.value)}
                          placeholder="SN / IMEI" />
                      </div>
                    )}
                    <div className="form-group" style={{ flex: isPo ? 0.8 : 1, margin: 0 }}>
                      {idx === 0 && <label className="form-label">HSN</label>}
                      <input type="text" className="form-input" value={item.hsn}
                        onChange={e => updateItem(idx, 'hsn', e.target.value)} placeholder="HSN" />
                    </div>
                    <div className="form-group" style={{ flex: isPo ? 0.9 : 0.7, margin: 0 }}>
                      {idx === 0 && <label className="form-label">Qty</label>}
                      {/* v1.6.8 (P2 #30): decimal quantity for 2.5 kg / 0.5 hr / etc. */}
                      {/* v1.10.69 - requested (#71 item 2, @sangwanmail-eng): the
                          number fields here now select their contents on focus, as
                          the invoice screen has since v1.10.67. Without it, typing
                          into a field showing 0 gave you 018 rather than 18. */}
                      <input type="number" className="form-input" value={item.quantity} min="0" step="any"
                        onFocus={e => e.target.select()}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                    </div>
                    {isPo && (
                      <div className="form-group" style={{ flex: 0.8, margin: 0 }}>
                        {idx === 0 && <label className="form-label">Unit</label>}
                        <input type="text" className="form-input" value={item.unit || ''} list="fgsb-unit-list"
                          autoComplete="off" onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Nos" />
                      </div>
                    )}
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      {idx === 0 && <label className="form-label">Rate</label>}
                      <input type="number" className="form-input" value={item.rate} min="0" step="any"
                        onFocus={e => e.target.select()}
                        onChange={e => updateItem(idx, 'rate', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: isPo ? 0.95 : 0.85, margin: 0, minWidth: 80 }}>
                      {idx === 0 && (
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Disc</span>
                          <span style={{ fontSize: '0.68rem', cursor: 'pointer', color: 'var(--primary)' }}
                            onClick={() => updateItem(idx, 'discountType', item.discountType === 'fixed' ? 'percent' : 'fixed')}>
                            {item.discountType === 'fixed' ? '₹' : '%'}
                          </span>
                        </label>
                      )}
                      <div style={{ display: 'flex', position: 'relative' }}>
                        <input type="number" className="form-input" value={item.discount ?? ''} min="0" step="any"
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          onChange={e => updateItem(idx, 'discount', e.target.value)}
                          style={{ paddingRight: '22px' }} />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => updateItem(idx, 'discountType', item.discountType === 'fixed' ? 'percent' : 'fixed')}
                          title="Toggle % or ₹"
                          style={{
                            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', padding: '2px 4px'
                          }}>
                          {item.discountType === 'fixed' ? '₹' : '%'}
                        </button>
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: isPo ? 0.95 : 0.75, margin: 0 }}>
                      {idx === 0 && <label className="form-label">Tax %</label>}
                      {/* v1.6.8 (P2 #29): "Other…" for jeweller 3% / diamond 0.25% /
                           agriculture 0.1% and any bespoke rate. */}
                      <select className="form-input" value={
                        ['0','0.1','0.25','3','5','12','18','28','40'].includes(String(item.taxPercent)) ? String(item.taxPercent) : '__custom__'
                      } onChange={async e => {
                        if (e.target.value === '__custom__') {
                          const v = await promptAction({
                            title: 'Custom tax rate',
                            message: 'Enter a GST rate between 0% and 100% (up to 2 decimals).',
                            defaultValue: String(item.taxPercent || 0),
                            placeholder: 'e.g. 7.5',
                            inputType: 'number',
                            confirmLabel: 'Apply rate',
                          });
                          const n = parseFloat(v);
                          if (Number.isFinite(n) && n >= 0 && n <= 100) updateItem(idx, 'taxPercent', n);
                        } else {
                          updateItem(idx, 'taxPercent', e.target.value);
                        }
                      }}>
                        <option value="0">0%</option>
                        <option value="0.1">0.1%</option>
                        <option value="0.25">0.25%</option>
                        <option value="3">3%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                        <option value="40">40%</option>
                        <option value="__custom__">Other…{['0','0.1','0.25','3','5','12','18','28','40'].includes(String(item.taxPercent)) ? '' : ` (${item.taxPercent}%)`}</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 0.7, margin: 0 }}>
                      {idx === 0 && <label className="form-label" title="Compensation Cess — for tobacco, aerated, motor vehicles, coal, etc.">Cess %</label>}
                      <input type="number" className="form-input" value={item.cessPercent ?? 0} min="0" step="any"
                        onFocus={e => e.target.select()}
                        onChange={e => updateItem(idx, 'cessPercent', e.target.value)} />
                    </div>
                    <div style={{ flex: '0 0 auto', marginBottom: idx === 0 ? 0 : 0 }}>
                      {form.items.length > 1 && (
                        <button className="icon-btn icon-btn-red" onClick={() => removeItem(idx)} title="Remove"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </div>

                  {/* Issue #199: Duplicate Product Detection Warning & Existing Product Details */}
                  {isExisting && (
                    <div style={{
                      marginTop: '0.35rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      background: 'rgba(201, 100, 66, 0.05)',
                      border: '1px solid rgba(201, 100, 66, 0.22)',
                      fontSize: '0.78rem',
                      color: 'var(--text, #1e293b)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--primary, #c96442)' }}>
                          <AlertCircle size={14} style={{ flexShrink: 0 }} />
                          <span>This product already exists in your inventory.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: '#15803d',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            <CheckCircle2 size={12} />
                            No duplicate product &bull; Stock will increase (+{item.quantity || 0} {details.unit})
                          </span>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.85rem',
                        paddingTop: '0.25rem',
                        borderTop: '1px dashed rgba(201, 100, 66, 0.18)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted, #64748b)'
                      }}>
                        <span>Product: <strong style={{ color: 'var(--text)' }}>{details.name}</strong></span>
                        {details.brand !== '—' && (
                          <span>Brand: <strong style={{ color: 'var(--text)' }}>{details.brand}</strong></span>
                        )}
                        {details.modelNumber !== '—' && (
                          <span>Model: <strong style={{ color: 'var(--text)' }}>{details.modelNumber}</strong></span>
                        )}
                        {details.sku !== '—' && (
                          <span>SKU / Barcode: <strong style={{ color: 'var(--text)' }}>{details.sku}</strong></span>
                        )}
                        <span>
                          Current Stock: <strong style={{ color: details.stock > 0 ? '#15803d' : '#b3453a' }}>{details.stock} {details.unit}</strong>
                          {' '}&rarr; New Stock: <strong style={{ color: '#15803d' }}>{updatedStock} {details.unit}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}
              onClick={addItem}><Plus size={14} /> Add Item</button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {formTotals.discount > 0.005 && (
                  <>
                    <span>Subtotal: <strong>{formatCurrency(formTotals.subtotal)}</strong></span>
                    <span>Discount: <strong style={{ color: 'var(--danger, #b3453a)' }}>-{formatCurrency(formTotals.discount)}</strong></span>
                  </>
                )}
                <span>Taxable: <strong>{formatCurrency(formTotals.taxable)}</strong></span>
                {/* v1.10.83 (#117) - the split as filed, not one tax figure. */}
                {form.interstate ? (
                  <span>IGST: <strong>{formatCurrency(formTotals.tax)}</strong></span>
                ) : (
                  <>
                    <span>CGST: <strong>{formatCurrency(splitPurchaseTax(formTotals.tax, false).cgst)}</strong></span>
                    <span>SGST: <strong>{formatCurrency(splitPurchaseTax(formTotals.tax, false).sgst)}</strong></span>
                  </>
                )}
                {formTotals.cess > 0 && (
                  <span>Cess: <strong>{formatCurrency(formTotals.cess)}</strong></span>
                )}
                {/* v1.10.74 - hide when there is nothing to round, like View/PDF. */}
                {form.applyRoundOff && Math.abs(formTotals.roundOff) > 0.005 && (
                  <span style={{ color: '#475569' }}>
                    Round-off: <strong>{(formTotals.roundOff >= 0 ? '+' : '') + formatCurrency(formTotals.roundOff)}</strong>
                  </span>
                )}
                <span>Total: <strong>{formatCurrency(formTotals.finalTotal)}</strong></span>
                {formTds > 0 && (
                  <>
                    <span>Less TDS: <strong>{formatCurrency(formTds)}</strong></span>
                    <span>Paid to supplier: <strong>{formatCurrency(formTotals.finalTotal - formTds)}</strong></span>
                  </>
                )}
              </div>
              {!isPo && (
                <div style={{ marginTop: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.tdsOn} onChange={e => updateField('tdsOn', e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                    <span><strong>TDS deducted</strong> — you keep back income-tax TDS from this supplier's payment and deposit it yourself</span>
                    <HelpButton title="TDS on a purchase bill" doc="purchases#purchase-tds" size={14} />
                  </label>
                  {form.tdsOn && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <select className="form-input" aria-label="TDS section" value={form.tdsSection}
                        onChange={e => {
                          const code = e.target.value;
                          const sec = TDS_SECTIONS.find(x => x.code === code);
                          setForm(prev => ({ ...prev, tdsSection: code, tdsRate: code === 'custom' ? prev.tdsRate : (sec?.rate ?? prev.tdsRate), tdsAmountManual: '' }));
                        }}>
                        {TDS_SECTIONS.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
                      </select>
                      <input type="number" step="any" min="0" max="100" className="form-input" aria-label="TDS rate %" placeholder="Rate %"
                        value={form.tdsRate} onChange={e => setForm(prev => ({ ...prev, tdsRate: e.target.value, tdsAmountManual: '' }))} />
                      <input type="number" step="any" min="0" className="form-input" aria-label="TDS amount" placeholder={`Amount (${formatCurrency(purchaseTdsAmount(formTotals.taxable, form.tdsRate))})`}
                        value={form.tdsAmountManual} onChange={e => updateField('tdsAmountManual', e.target.value)} />
                    </div>
                  )}
                </div>
              )}
              {!isPo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', cursor: 'pointer', marginTop: '0.6rem', color: '#475569' }}>
                <input type="checkbox" checked={!!form.applyRoundOff}
                  onChange={e => updateField('applyRoundOff', e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: 'var(--primary)' }} />
                <span>
                  <strong>Apply round-off</strong> — round the grand total to the nearest rupee.
                  Use when the supplier's bill is rounded (e.g. ₹1,234.56 → ₹1,235). Off by default —
                  most suppliers' totals already match what's calculated from line items.
                </span>
              </label>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Table */}
      {tab === 'bills' && (
      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Purchase Records <HelpButton title="Purchase Records" doc="purchases#purchase-list" size={16} /></h3>
          <TableExport title="Purchase register" filename="Purchases" landscape
            subtitle={ownerProfile?.businessName || ''}
            headers={['Date', 'Supplier', 'GSTIN', 'Invoice No', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Cess', 'Inter-state', 'Round-off', 'Total', 'Paid', 'Balance due', 'Status', 'Note']}
            rows={registerRows} />
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={48} />
            <p>{purchases.length === 0 ? 'No purchase bills recorded yet.' : 'No purchases match your filters.'}</p>
            {purchases.length === 0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Purchase</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>GSTIN</th>
                  <th>Invoice No</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Balance due</th>
                  <th>Status</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const t = calcPurchaseTotal(p.items, !!p.applyRoundOff);
                  const st = purchaseStatus(p);
                  const bal = purchaseBalance(p);
                  return (
                    <tr key={p.id}>
                      <td className="text-muted">{p.date ? new Date(p.date).toLocaleDateString('en-IN') : ''}</td>
                      <td className="font-medium">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{p.supplierName}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 3, height: 'auto', lineHeight: '1.2' }}
                            title="View / Download Supplier Account Statement PDF"
                            onClick={(e) => { e.stopPropagation(); generateSupplierStatement(p.supplierName); }}
                          >
                            <FileText size={11} /> Statement
                          </button>
                        </div>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.78rem' }}>{p.supplierGstin || '-'}</td>
                      <td><span className="invoice-badge">{p.invoiceNumber}</span></td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(t.taxable)}</td>
                      <td style={{ textAlign: 'right' }} className="text-muted">{formatCurrency(t.tax)}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold">{formatCurrency(t.finalTotal)}</td>
                      <td style={{ textAlign: 'right', color: bal > 0.005 ? 'var(--danger)' : 'var(--text-muted)' }}>{bal > 0.005 ? formatCurrency(bal) : '-'}</td>
                      {/* v1.10.69 - requested (#71 item 3, @sangwanmail-eng):
                          "the Status column should have a drop-down option,
                          similar to the Status drop-down available on the
                          Dashboard." Marking a supplier bill paid took
                          opening it, changing one field and saving. */}
                      <td>
                        <select className="status-select"
                          value={st} aria-label={`Payment status of ${p.invoiceNumber}`}
                          style={{ background: PAYMENT_STATUS_COLORS[st].bg, color: PAYMENT_STATUS_COLORS[st].color, borderColor: PAYMENT_STATUS_COLORS[st].color + '44' }}
                          onChange={e => changePaymentStatus(p, e.target.value)}>
                          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{PURCHASE_STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="table-actions">
                          {/* v1.10.84 (#158) - Print Barcode Labels for received goods */}
                          <button className="icon-btn" onClick={() => openBarcodeForPurchase(p)} title="Print Barcode Labels for this purchase (exact quantities)"><Barcode size={15} /></button>
                          {/* v1.10.30 — quick View modal (no download).
                              Modal has a Download PDF button inside for
                              users who do want the file. */}
                          <button className="icon-btn" onClick={() => setViewPurchase(p)} title="View details (no download)"><Eye size={15} /></button>
                          {/* v1.10.83 (#123) - record / see payments to the supplier. */}
                          <button className="icon-btn icon-btn-green" onClick={() => setPayPurchase(p)} title={st === 'Paid' ? 'Payment history' : 'Record payment to supplier'} aria-label="Payments to supplier"><IndianRupee size={15} /></button>
                          <button className="icon-btn icon-btn-blue" onClick={() => openEdit(p)} title="Edit"><Edit3 size={15} /></button>
                          <button className="icon-btn icon-btn-red" onClick={() => handleDelete(p.id)} title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.tax)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.total)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(totalStats.owed)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      )}

      {/* tab === 'suppliers' Supplier Ledger & Accounts */}
      {tab === 'suppliers' && (
        <div className="space-y-4">
          <div className="stats-grid stats-grid-4">
            <div className="stat-card">
              <div className="stat-icon stat-icon-purple"><Building2 size={22} /></div>
              <div><p className="stat-label">Total Suppliers</p><h2 className="stat-value stat-value-purple">{supplierAccounts.length}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue"><ShoppingCart size={22} /></div>
              <div><p className="stat-label">Total Purchases</p><h2 className="stat-value">{formatCurrency(supplierStats.totalBilled)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-green"><IndianRupee size={22} /></div>
              <div><p className="stat-label">Paid to Suppliers</p><h2 className="stat-value stat-value-green">{formatCurrency(supplierStats.totalPaid)}</h2></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon stat-icon-amber"><IndianRupee size={22} /></div>
              <div>
                <p className="stat-label">Total Owed to Suppliers</p>
                <h2 className="stat-value" style={{ color: supplierStats.balanceOwed > 0.005 ? 'var(--danger)' : undefined }}>
                  {formatCurrency(supplierStats.balanceOwed)}
                </h2>
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 mb-4">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="search-box" style={{ maxWidth: '320px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search supplier by name or GSTIN..."
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  className="search-input"
                />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing {filteredSuppliers.length} of {supplierAccounts.length} suppliers
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="table-header">
              <h3>Supplier Accounts & Ledgers</h3>
            </div>
            {filteredSuppliers.length === 0 ? (
              <div className="empty-state">
                <Building2 size={48} />
                <p>{supplierAccounts.length === 0 ? 'No suppliers found yet. Add purchase bills to track suppliers.' : 'No suppliers match your search.'}</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ minWidth: '800px' }}>
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>GSTIN</th>
                      <th style={{ textAlign: 'center' }}>Bills</th>
                      <th style={{ textAlign: 'right' }}>Total Billed</th>
                      <th style={{ textAlign: 'right' }}>Total Paid</th>
                      <th style={{ textAlign: 'right' }}>Balance Payable</th>
                      <th className="col-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map(s => (
                      <tr key={s.name}>
                        <td className="font-medium">
                          <div>{s.name}</div>
                          {s.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.address}</div>}
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.78rem' }}>{s.gstin || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="invoice-badge">{s.bills.length}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(s.totalBilled)}</td>
                        <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(s.totalPaid)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: s.balanceOwed > 0.005 ? 'var(--danger)' : '#059669' }}>
                          {s.balanceOwed > 0.005 ? `${formatCurrency(s.balanceOwed)} Cr` : 'Nil'}
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={() => generateSupplierStatement(s.name)}
                              title="View & download complete statement PDF for this supplier"
                            >
                              <FileText size={13} /> Statement PDF
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#16a34a' }}
                              onClick={() => openWhatsAppShare('', supplierShareMessage(s, ownerProfile))}
                              title="Share statement summary via WhatsApp"
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSearch(s.name);
                                setTab('bills');
                              }}
                              title="Filter all bills by this supplier"
                            >
                              View Bills
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3}>Total ({filteredSuppliers.length} suppliers)</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(supplierStats.totalBilled)}</td>
                      <td style={{ textAlign: 'right', color: '#059669' }}>{formatCurrency(supplierStats.totalPaid)}</td>
                      <td style={{ textAlign: 'right', color: supplierStats.balanceOwed > 0.005 ? 'var(--danger)' : '#059669' }}>
                        {formatCurrency(supplierStats.balanceOwed)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-app PDF Preview Modal (#157) */}
      {pdfPreview && (
        <PdfPreviewModal
          title={pdfPreview.title}
          filename={pdfPreview.filename}
          pdfBlob={pdfPreview.pdfBlob}
          clientPhone={pdfPreview.clientPhone}
          shareText={pdfPreview.shareText}
          onClose={() => setPdfPreview(null)}
        />
      )}

      {/* Barcode Labels Modal from Purchase Entry (#158) */}
      {barcodeModalData && (
        <BarcodeLabelsModal
          products={barcodeModalData.products}
          initialCounts={barcodeModalData.initialCounts}
          profile={ownerProfile}
          onClose={() => setBarcodeModalData(null)}
        />
      )}
    </div>
  );
}
