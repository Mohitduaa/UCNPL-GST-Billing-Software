// v1.10.77 (#85) - product helpers for bulk edit and the stock report.
import { appliedStock, isCancelledBill, isServiceProduct, salesSign } from '../utils.js';

const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

// One edited row of the bulk-edit grid -> the product to save, or { error }.
// Same rules as the single product form: a name is required, GST % 0-100,
// and the selling price is mirrored to `rate` for older readers.
export const bulkRowToProduct = (product, edits) => {
  const merged = { ...product, ...edits };
  const name = String(merged.name ?? '').trim();
  if (!name) return { error: 'a product needs a name' };
  const gst = num(merged.taxPercent);
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) return { error: `${name}: GST % must be 0 to 100` };
  for (const k of ['purchasePrice', 'sellingPrice', 'stock', 'mrp']) {
    if (!Number.isFinite(num(merged[k]))) return { error: `${name}: ${k === 'stock' ? 'stock' : 'price'} must be a number` };
  }
  const sellingPrice = num(edits.sellingPrice ?? product.sellingPrice ?? product.rate);
  // #121 - a service keeps no stock; a blank stock stays "not tracked" (it
  // used to become 0, so editing a price made it "Out of Stock").
  const blank = merged.stock === '' || merged.stock === null || merged.stock === undefined;
  return {
    product: {
      ...product,
      name,
      hsn: String(merged.hsn ?? '').trim(),
      purchasePrice: num(merged.purchasePrice),
      sellingPrice,
      rate: sellingPrice,
      mrp: num(merged.mrp) > 0 ? num(merged.mrp) : undefined,
      taxPercent: gst,
      unit: merged.unit || 'Nos',
      stock: isServiceProduct(merged) || blank ? undefined : num(merged.stock),
      trackSerial: !!merged.trackSerial,
      warrantyMonths: num(merged.warrantyMonths),
      barcode: String(merged.barcode ?? '').trim(),
      secondaryUnit: String(merged.secondaryUnit ?? '').trim(),
      conversionFactor: num(merged.conversionFactor),
      secondaryRate: num(merged.secondaryRate),
    },
  };
};

// Closing stock of each product at the end of a day (YYYY-MM-DD), worked
// back from today's stock: take off what purchases dated after it brought in,
// and add back what invoices dated after it took out (each invoice's own
// stock record, see appliedStock). Stock typed in by hand on the Products
// screen has no date, so it counts as if it happened today.
// v1.10.83 (#115) - production entries dated after it are undone the same
// way, from each entry's own stock record (raw materials back, made goods out).
// v1.10.83 (#121) - services have no stock and are left out.
// Returns Map(productId -> quantity).
export const closingStock = (products, bills, purchases, asOf, productions = []) => {
  const qty = new Map((products || []).filter((p) => !isServiceProduct(p)).map((p) => [p.id, Number(p.stock) || 0]));
  const byName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p.id]));
  for (const pur of purchases || []) {
    if (!pur?.date || pur.date <= asOf) continue;
    for (const it of pur.items || []) {
      const id = it.productId || byName.get(String(it.name || '').trim().toLowerCase());
      if (id && qty.has(id)) qty.set(id, qty.get(id) - (Number(it.quantity) || 0));
    }
  }
  for (const b of bills || []) {
    if (!b?.invoiceDate || b.invoiceDate <= asOf || isCancelledBill(b)) continue;
    for (const [id, change] of Object.entries(appliedStock(b))) {
      if (qty.has(id)) qty.set(id, qty.get(id) - change);
    }
  }
  for (const pr of productions || []) {
    if (!pr?.date || pr.date <= asOf) continue;
    for (const [id, change] of Object.entries(pr.stockApplied || {})) {
      if (qty.has(id)) qty.set(id, qty.get(id) - (Number(change) || 0));
    }
  }
  for (const [id, q] of qty) qty.set(id, Math.round(q * 1000) / 1000);
  return qty;
};

// Value of a quantity at the product's purchase price (cost), or at its
// selling price when no purchase price is known.
export const stockValueOf = (product, quantity) => {
  const cost = Number(product?.purchasePrice) || 0;
  const price = cost > 0 ? cost : (Number(product?.sellingPrice) || Number(product?.rate) || 0);
  return { price, value: Math.round(price * (Number(quantity) || 0) * 100) / 100, atCost: cost > 0 };
};

// v1.10.84 (#146) - cost of goods sold, for Profit & Loss: quantity sold x
// the product's Purchase price. Profit used to be sales minus Expenses only, so
// with no expenses entered all the sales showed as profit. Credit notes
// (salesSign -1) take their goods back out; quotes and challans (0) count
// nothing. A line finds its product by productId, else by name. Services,
// charge lines (delivery) and SAC lines (99...) cost nothing. A goods line
// whose product has no purchase price, or that is not a product at all, counts
// 0 and its name is listed in `missing` so the report can ask for the price.
export const costOfGoodsSold = (bills, products) => {
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const byName = new Map((products || []).map((p) => [String(p.name || '').trim().toLowerCase(), p]));
  const missing = new Set();
  let cost = 0;
  for (const bill of bills || []) {
    const sign = salesSign(bill);
    if (!sign) continue;
    for (const it of bill.data?.items || []) {
      const qty = Number(it.quantity) || 0;
      if (!qty || it.isCharge || /^99/.test(String(it.hsn || '').trim())) continue;
      const p = (it.productId && byId.get(it.productId)) || byName.get(String(it.name || '').trim().toLowerCase());
      if (isServiceProduct(p)) continue;
      const price = Number(p?.purchasePrice) || 0;
      if (price > 0) cost += sign * qty * price;
      else if (String(it.name || '').trim()) missing.add(String(p?.name || it.name).trim());
    }
  }
  return { cost: Math.round(cost * 100) / 100, missing: [...missing] };
};

// ============================================================================
// Issue #199: Duplicate Product Detection & Inventory Reconciliation
// ============================================================================

const normStr = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Checks whether a given purchase item matches an existing product in inventory.
 * Match precedence:
 *   1. productId (exact id)
 *   2. barcode (matches product.barcode or product.sku)
 *   3. sku (matches product.sku or product.barcode)
 *   4. modelNumber (matches product.modelNumber or product.model)
 *   5. name (case-insensitive, trimmed, normalized whitespace)
 */
export const findDuplicateProduct = (item, products = []) => {
  if (!item || !Array.isArray(products) || products.length === 0) {
    return { isDuplicate: false, existingProduct: null };
  }

  // 1. Explicit productId match
  if (item.productId) {
    const found = products.find((p) => p && p.id === item.productId);
    if (found) {
      return { isDuplicate: true, existingProduct: found, matchReason: 'productId' };
    }
  }

  // 2. Barcode match
  const rawBarcode = item.barcode || item.serialNo;
  if (rawBarcode) {
    const normCode = normStr(rawBarcode);
    if (normCode) {
      const found = products.find((p) => p && (normStr(p.barcode) === normCode || normStr(p.sku) === normCode));
      if (found) {
        return { isDuplicate: true, existingProduct: found, matchReason: 'barcode' };
      }
    }
  }

  // 3. SKU match
  if (item.sku) {
    const normSku = normStr(item.sku);
    if (normSku) {
      const found = products.find((p) => p && (normStr(p.sku) === normSku || normStr(p.barcode) === normSku));
      if (found) {
        return { isDuplicate: true, existingProduct: found, matchReason: 'sku' };
      }
    }
  }

  // 4. Model Number match
  const rawModel = item.modelNumber || item.model;
  if (rawModel) {
    const normModel = normStr(rawModel);
    if (normModel) {
      const found = products.find((p) => p && (normStr(p.modelNumber) === normModel || normStr(p.model) === normModel));
      if (found) {
        return { isDuplicate: true, existingProduct: found, matchReason: 'modelNumber' };
      }
    }
  }

  // 5. Name match (case-insensitive, normalized whitespace)
  if (item.name) {
    const normName = normStr(item.name);
    if (normName) {
      const found = products.find((p) => p && normStr(p.name) === normName);
      if (found) {
        return { isDuplicate: true, existingProduct: found, matchReason: 'name' };
      }
    }
  }

  return { isDuplicate: false, existingProduct: null };
};

/**
 * Formats details of an existing product for clean UI warning display.
 */
export const formatDuplicateProductDetails = (product) => {
  if (!product) {
    return {
      name: '—',
      brand: '—',
      modelNumber: '—',
      sku: '—',
      stock: 0,
      unit: 'Nos',
    };
  }

  return {
    id: product.id,
    name: product.name || '—',
    brand: (product.brand || '').trim() || '—',
    modelNumber: (product.modelNumber || product.model || '').trim() || '—',
    sku: (product.sku || product.barcode || '').trim() || '—',
    stock: Number(product.stock) || 0,
    unit: product.unit || 'Nos',
    purchasePrice: Number(product.purchasePrice) || Number(product.rate) || 0,
    sellingPrice: Number(product.sellingPrice) || Number(product.rate) || 0,
  };
};

/**
 * Computes updated stock quantity safely.
 */
export const calculateUpdatedStock = (currentStock, quantityAdded) => {
  const cur = Number(currentStock) || 0;
  const add = Number(quantityAdded) || 0;
  return Math.round((cur + add) * 1000) / 1000;
};

/**
 * Reconciles purchase bill items with inventory products:
 * - Existing products are updated (stock delta applied, latest purchasePrice updated).
 * - NO duplicate product entries created.
 * - Truly new items seeded with initial stock.
 * - Items returned with linked productId.
 */
export const reconcilePurchaseProducts = ({
  items = [],
  existingProducts = [],
  isEdit = false,
  priorItems = [],
}) => {
  const byId = new Map((existingProducts || []).map((p) => [p.id, p]));
  const priorQtyByKey = new Map();

  const getBaseQty = (it, prod) => {
    if (it?.baseQuantity !== undefined && it?.baseQuantity !== null && !isNaN(Number(it.baseQuantity)) && Number(it.baseQuantity) !== 0) {
      return Number(it.baseQuantity);
    }
    if (prod?.secondaryUnit && it?.unit && String(it.unit).trim().toLowerCase() === String(prod.secondaryUnit).trim().toLowerCase() && Number(prod.conversionFactor) > 0) {
      return (Number(it?.quantity) || 0) * Number(prod.conversionFactor);
    }
    return Number(it?.quantity) || 0;
  };

  if (isEdit) {
    for (const p of priorItems || []) {
      const match = findDuplicateProduct(p, existingProducts);
      const key = match.isDuplicate ? match.existingProduct.id : `name:${normStr(p.name)}`;
      const pQty = getBaseQty(p, match.existingProduct);
      priorQtyByKey.set(key, (priorQtyByKey.get(key) || 0) + pQty);
    }
  }

  const stockDeltaById = new Map();
  const productsToUpsert = new Map();
  const seenPriorKeys = new Set();
  const linkedItems = [];

  for (const it of (items || []).filter((x) => x && x.name && String(x.name).trim())) {
    const qty = Number(it.quantity) || 0;
    const match = findDuplicateProduct(it, existingProducts);
    const existing = match.isDuplicate ? match.existingProduct : null;
    const baseQty = getBaseQty(it, existing);

    if (existing) {
      linkedItems.push({ ...it, productId: existing.id });

      const key = existing.id;
      seenPriorKeys.add(key);

      // Accumulate new purchased quantity across all line items for this existing product (in base units)
      stockDeltaById.set(existing.id, (stockDeltaById.get(existing.id) || 0) + baseQty);

      const lineGross = qty * (Number(it.rate) || 0);
      let lineDisc = Number(it.discount) || 0;
      if (lineDisc > 0 && it.discountType === 'percent') {
        lineDisc = (lineGross * lineDisc) / 100;
      }
      lineDisc = Math.min(lineGross, Math.max(0, lineDisc));
      const effectiveUnitCost = qty > 0 ? (lineGross - lineDisc) / qty : (Number(it.rate) || 0);

      // Merge into upsert map without overwriting selling price
      const currentUpsert = productsToUpsert.get(existing.id) || existing;
      productsToUpsert.set(existing.id, {
        ...currentUpsert,
        purchasePrice: effectiveUnitCost > 0 ? effectiveUnitCost : currentUpsert.purchasePrice,
        hsn: existing.hsn || it.hsn,
        taxPercent: existing.taxPercent ?? it.taxPercent,
        cessPercent: existing.cessPercent ?? it.cessPercent ?? 0,
        _placeholderId: existing.id,
      });
    } else {
      linkedItems.push({ ...it });

      const newKey = `__new__::${normStr(it.name)}`;
      const seeded = Number(productsToUpsert.get(newKey)?.stock) || 0;
      productsToUpsert.set(newKey, {
        name: String(it.name).trim(),
        brand: (it.brand || '').trim(),
        modelNumber: (it.modelNumber || '').trim(),
        barcode: (it.barcode || '').trim(),
        sku: (it.sku || '').trim(),
        hsn: it.hsn || '',
        purchasePrice: Number(it.rate) || 0,
        sellingPrice: Number(it.rate) || 0,
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        cessPercent: Number(it.cessPercent) || 0,
        unit: it.unit || 'Nos',
        stock: Math.round((seeded + baseQty) * 1000) / 1000,
        description: it.description || '',
      });
    }
  }

  // Adjust stock for prior quantities on edit
  if (isEdit) {
    for (const [key, priorQty] of priorQtyByKey) {
      const targetId = key.startsWith('name:')
        ? existingProducts.find((p) => normStr(p.name) === key.slice(5))?.id
        : key;

      if (seenPriorKeys.has(key)) {
        // Product is retained: subtract prior quantity ONCE so net delta = newQtyTotal - priorQtyTotal
        if (targetId) {
          stockDeltaById.set(targetId, (stockDeltaById.get(targetId) || 0) - priorQty);
        }
      } else {
        // Product was removed while editing: reduce stock by priorQty
        const gone = key.startsWith('name:')
          ? existingProducts.find((p) => normStr(p.name) === key.slice(5))
          : byId.get(key);
        if (!gone) continue;
        stockDeltaById.set(gone.id, (stockDeltaById.get(gone.id) || 0) - priorQty);
        if (!productsToUpsert.has(gone.id)) {
          productsToUpsert.set(gone.id, { ...gone, _placeholderId: gone.id });
        }
      }
    }
  }

  const productsToSave = [];
  for (const [, prod] of productsToUpsert) {
    if (prod._placeholderId) {
      const existing = byId.get(prod._placeholderId) || existingProducts.find((p) => p.id === prod._placeholderId);
      const delta = stockDeltaById.get(prod._placeholderId) || 0;
      const currentStock = Number(existing?.stock) || 0;
      const newStock = Math.round((currentStock + delta) * 1000) / 1000;
      const { _placeholderId, ...clean } = prod;
      productsToSave.push({ ...clean, stock: newStock });
    } else {
      productsToSave.push(prod);
    }
  }

  return { productsToSave, linkedItems };
};
