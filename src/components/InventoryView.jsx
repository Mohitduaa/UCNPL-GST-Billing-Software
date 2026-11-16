import { useState, useEffect, useMemo } from 'react';
import { Package, Search, Plus, Edit3, Trash2, X, Save, Upload, Table2, Factory, Barcode, RefreshCw, Tag, ArrowRightLeft } from 'lucide-react';
import { renderCode128Svg, generateRandomBarcode } from '../utils/barcode';
import BarcodeLabelsModal from './BarcodeLabelsModal';
import { getAllProducts, saveProduct, deleteProduct, getProfile, getStockAlertSettings, getEnabledModules } from '../store';
import { getAllUnits, getCountryConfig, formatCurrency, isModuleEnabled, isServiceProduct, trackedStock, filterUnitsByMode, getDefaultUnitForMode } from '../utils';
import { productsCsvToList, PRODUCTS_SAMPLE } from '../utils/listCsv';
import CsvListImport from './CsvListImport';
import MigrationHub from './MigrationHub';
import { bomError, unitCost } from '../utils/manufacturing';
import { BomEditor, MakeModal, ProductionList } from './Manufacturing';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import ProductBulkEdit from './ProductBulkEdit';
import TableExport from './TableExport';
import { hasAlternateUnit } from '../utils/units';

// v1.10.29 — reported: "here purchase price and selling price need".
// Product now carries BOTH: `purchasePrice` (what we paid the supplier) and
// `sellingPrice` (what we charge the customer). Legacy `rate` field is
// still written on save (mirrors sellingPrice) so any pre-v1.10.29 reader
// still gets a valid number, but the form no longer edits it directly —
// dead state removed for clarity.
const emptyForm = {
  // kind: v1.10.83 (#121) - 'goods' or 'service' (a service has no stock).
  kind: 'goods', name: '', barcode: '', hsn: '', purchasePrice: '', sellingPrice: '', mrp: '', taxPercent: '', gstTreatment: '', unit: 'Pcs', stock: '', description: '',
  madeHere: false, bom: [],
  trackSerial: false, warrantyMonths: 0,
  calcCategory: 'qty', // 'qty' | 'sqft' | 'rft' (#140)
  brand: '', category: '', subCategory1: '', subCategory2: '', subCategory3: '', // #142
  secondaryUnit: '', conversionFactor: '', secondaryRate: '', enableAlternateUnit: false,
};

export default function InventoryView() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  // v1.10.77 (#85) - edit many products at once (see ProductBulkEdit).
  const [bulkEdit, setBulkEdit] = useState(false);
  // v1.10.84 (#177) - tick products, then delete them in one go.
  const [picked, setPicked] = useState(() => new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [units, setUnits] = useState(getAllUnits());
  const [profileCountry, setProfileCountry] = useState('India');
  const profileCurrency = getCountryConfig(profileCountry).currency;
  // The colour-coded stock badge in the table respects the user's threshold
  // — defaults to 5 if no setting saved yet. When alerts are disabled
  // entirely, items at or below threshold render in the same plain colour
  // as everything else (still "Out of Stock" red for 0 — that's a hard fact,
  // not an alert preference).
  const [stockAlerts, setStockAlerts] = useState({ enabled: true, threshold: 5 });
  // v1.10.83 (#115) - manufacturing (Settings -> Features). When off, nothing
  // below changes: no Make button, no BOM in the form, no production list.
  const mfgOn = isModuleEnabled('manufacturing', getEnabledModules());
  const [showMake, setShowMake] = useState(false);
  const [mfgReload, setMfgReload] = useState(0);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const afterProduction = () => { setShowMake(false); setMfgReload((n) => n + 1); loadProducts(); };

  const loadProducts = async () => {
    try {
      const data = await getAllProducts();
      setProducts(data);
    } catch {
      toast('Failed to load products', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
    setUnits(getAllUnits());
    getProfile().then(p => { setProfile(p); if (p?.country) setProfileCountry(p.country); }).catch(() => {});
    getStockAlertSettings().then(setStockAlerts).catch(() => {});
  }, []);

  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const distinctBrands = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.brand?.trim()) set.add(p.brand.trim()); });
    return Array.from(set).sort();
  }, [products]);

  const distinctCategories = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.category?.trim()) set.add(p.category.trim()); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = products.filter(p => {
    if (brandFilter && (p.brand || '').trim().toLowerCase() !== brandFilter.trim().toLowerCase()) {
      return false;
    }
    if (categoryFilter && (p.category || '').trim().toLowerCase() !== categoryFilter.trim().toLowerCase()) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const match = (p.name || '').toLowerCase().includes(q) ||
        (p.hsn || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.subCategory1 || '').toLowerCase().includes(q) ||
        (p.subCategory2 || '').toLowerCase().includes(q) ||
        (p.subCategory3 || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
  const pickedShown = filtered.filter((p) => picked.has(p.id));

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (product) => {
    // v1.10.29 — Backward-compat: pre-v1.10.29 products only had `rate`.
    // Read `sellingPrice` if set, else fall back to `rate`. `purchasePrice`
    // is new — starts empty for legacy products until the user fills it.
    setForm({
      kind: isServiceProduct(product) ? 'service' : 'goods',
      name: product.name || '',
      barcode: product.barcode || '',
      hsn: product.hsn || '',
      purchasePrice: product.purchasePrice ?? '',
      sellingPrice: product.sellingPrice ?? product.rate ?? '',
      mrp: product.mrp ?? '',
      taxPercent: product.taxPercent || '',
      gstTreatment: product.gstTreatment || '',
      unit: product.unit || 'Nos',
      stock: product.stock ?? '', // v1.10.74 - was `|| ''`, which blanked a stock of 0
      description: product.description || '',
      madeHere: !!product.madeHere,
      bom: (product.bom || []).map((l) => ({ productId: l.productId, qty: String(l.qty ?? '') })),
      trackSerial: !!product.trackSerial,
      warrantyMonths: product.warrantyMonths || 0,
      calcCategory: product.calcCategory || (product.unit === 'Sq.ft' ? 'sqft' : product.unit === 'R.ft' ? 'rft' : 'qty'),
      brand: product.brand || '',
      category: product.category || '',
      subCategory1: product.subCategory1 || '',
      subCategory2: product.subCategory2 || '',
      subCategory3: product.subCategory3 || '',
      secondaryUnit: product.secondaryUnit || '',
      conversionFactor: product.conversionFactor ?? '',
      secondaryRate: product.secondaryRate ?? '',
      enableAlternateUnit: !!(product.secondaryUnit && Number(product.conversionFactor) > 0),
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('Product name is required', 'warning');
      return;
    }
    // v1.10.74 - the input's min/max are not enforced by the browser on save.
    const gst = form.taxPercent === '' ? 0 : Number(form.taxPercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      toast('GST % must be between 0 and 100', 'warning');
      return;
    }
    // v1.10.83 (#115) - a raw materials list must be complete, positive and loop-free.
    const bom = form.bom.map((l) => ({ productId: l.productId, qty: Number(l.qty) }));
    if (mfgOn && form.madeHere && form.kind !== 'service') {
      const err = bomError(editingId || '_new', bom, products);
      if (err) { toast(err, 'warning'); return; }
    }
    try {
      // v1.10.29 — Persist both prices. `rate` mirrors sellingPrice so any
      // old caller reading .rate still gets the right number.
      const sellingPrice = form.sellingPrice ? parseFloat(form.sellingPrice) : 0;
      const purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : 0;
      const mrp = form.mrp !== '' && Number(form.mrp) > 0 ? parseFloat(form.mrp) : undefined;
      const service = form.kind === 'service';
      const enableAlt = !service && !!form.enableAlternateUnit && !!form.secondaryUnit && Number(form.conversionFactor) > 0;
      const secondaryUnit = enableAlt ? form.secondaryUnit.trim() : undefined;
      const conversionFactor = enableAlt ? Number(form.conversionFactor) : undefined;
      const secondaryRate = enableAlt && form.secondaryRate !== '' ? Number(form.secondaryRate) : undefined;
      const product = {
        // Fields this form does not show (cess % from purchase bills, etc.)
        // are kept: the record used to be rebuilt from the form alone.
        ...(editingId ? (products.find(p => p.id === editingId) || {}) : {}),
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        barcode: (form.barcode || '').trim(),
        hsn: form.hsn.trim(),
        purchasePrice,
        sellingPrice,
        rate: sellingPrice, // mirror for legacy readers
        mrp,
        taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : 0,
        gstTreatment: form.gstTreatment || '',
        unit: form.unit,
        secondaryUnit,
        conversionFactor,
        secondaryRate,
        kind: service ? 'service' : 'goods',
        // #121 - a service has no stock; blank stock is "not tracked" (it used
        // to save 0, which showed Out of Stock for things never counted).
        stock: service || form.stock === '' ? undefined : parseFloat(form.stock),
        description: form.description.trim(),
        trackSerial: !!form.trackSerial,
        warrantyMonths: Number(form.warrantyMonths) || 0,
        calcCategory: form.calcCategory || (form.unit === 'Sq.ft' ? 'sqft' : form.unit === 'R.ft' ? 'rft' : 'qty'),
        brand: (form.brand || '').trim(),
        category: (form.category || '').trim(),
        subCategory1: (form.subCategory1 || '').trim(),
        subCategory2: (form.subCategory2 || '').trim(),
        subCategory3: (form.subCategory3 || '').trim(),
        // Only written while the feature is on; otherwise the fields a product
        // already has are kept as they are (spread above).
        ...(mfgOn ? (form.madeHere && !service ? { madeHere: true, bom } : { madeHere: false }) : {}),
      };
      await saveProduct(product);
      toast(editingId ? 'Product updated' : 'Product added', 'success');
      closeForm();
      loadProducts();
    } catch {
      toast('Failed to save product', 'error');
    }
  };

  const handleDelete = async (id) => {
    // v1.10.83 (#115) - say so when a made product uses it as a raw material.
    const usedIn = mfgOn ? products.filter((p) => p.madeHere && (p.bom || []).some((l) => l.productId === id)).map((p) => p.name) : [];
    if (await confirmAction({
      title: 'Delete this product?',
      message: 'Existing invoices that used this product keep their line items unchanged. This just removes the product from your catalog.'
        + (usedIn.length ? ` It is a raw material of ${usedIn.join(', ')}: remove it from their raw materials list too.` : ''),
      confirmLabel: 'Delete',
      tone: 'danger',
    })) {
      try {
        await deleteProduct(id);
        toast('Product deleted', 'success');
        loadProducts();
      } catch {
        toast('Failed to delete', 'error');
      }
    }
  };

  // #177 - only ticked products the list shows now (the search) are deleted.
  const deletePicked = async (list) => {
    if (!list.length) return;
    const ids = new Set(list.map((p) => p.id));
    const usedIn = mfgOn ? products.filter((p) => p.madeHere && !ids.has(p.id) && (p.bom || []).some((l) => ids.has(l.productId))).map((p) => p.name) : [];
    if (!(await confirmAction({
      title: `Delete ${list.length} product${list.length === 1 ? '' : 's'}?`,
      message: `${list.slice(0, 5).map((p) => p.name).join(', ')}${list.length > 5 ? ` and ${list.length - 5} more` : ''}. `
        + 'Existing invoices that used them keep their line items unchanged. This just removes them from your catalog.'
        + (usedIn.length ? ` Some are raw materials of ${usedIn.join(', ')}: remove them from their raw materials list too.` : ''),
      confirmLabel: 'Delete',
      tone: 'danger',
    }))) return;
    let done = 0;
    for (const p of list) {
      try { await deleteProduct(p.id); done += 1; } catch { /* counted below */ }
    }
    toast(done === list.length ? `${done} product${done === 1 ? '' : 's'} deleted` : `${done} of ${list.length} deleted; the rest could not be deleted`, done === list.length ? 'success' : 'error');
    setPicked(new Set());
    loadProducts();
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };
  // A service starts on a service unit (Hrs) unless its unit is one already.
  const serviceUnits = filterUnitsByMode(units, 'services');
  const setKind = (kind) => setForm(prev => ({
    ...prev, kind,
    ...(kind === 'service' && !serviceUnits.some(u => u.label === prev.unit) ? { unit: getDefaultUnitForMode('services') } : {}),
  }));
  const [showImport, setShowImport] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <h1 className="page-title">Products <HelpButton title="Products — how to use" doc="products" size={16} /></h1>
            <p className="page-subtitle">Manage your products and services catalog</p>
          </div>
        </div>
        {/* Wraps on a phone: with Make there are four buttons (v1.10.83, #115). */}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowBarcodeModal(true)} disabled={!products.length || bulkEdit} title="Print barcode labels/tags for your products (A4 sheets or thermal rolls)">
            <Barcode size={16} /> Barcode labels
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)} title="Add products from a CSV, an Excel file (.xlsx, such as Vyapar's) or Tally's masters export (.xml)">
            <Upload size={16} /> Import CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setShowMigration(true)} title="Import products from Tally, Busy, Vyapar, QuickBooks, etc.">
            <ArrowRightLeft size={16} /> Import &amp; Migrate
          </button>
          <button className="btn btn-secondary" onClick={() => setBulkEdit(true)} disabled={!products.length || bulkEdit}
            title="Edit name, HSN, prices, GST %, unit and stock of many products at once">
            <Table2 size={16} /> Bulk edit
          </button>
          {mfgOn && (
            <button className="btn btn-secondary" onClick={() => setShowMake(true)} disabled={bulkEdit}
              title="Record production: uses up raw materials and adds the finished product to stock">
              <Factory size={16} /> Make
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>
      {showImport && (
        <CsvListImport what="products" sample={PRODUCTS_SAMPLE} sampleName="Products-sample.csv" doc="products#import"
          intro="One product or service per row: Name (required), Type (Goods or Service), HSN/SAC, Unit, Purchase Price, Selling Price, GST % and Stock (leave Stock blank for a service). For a product already saved, details that are empty on it are filled in from the file; nothing already filled is changed."
          parse={(rows) => { const r = productsCsvToList(rows, products); return { list: r.products, updates: r.updates, skipped: r.skipped, errors: r.errors }; }}
          save={saveProduct} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); loadProducts(); }}
          onOpenMigration={() => { setShowImport(false); setShowMigration(true); }} />
      )}
      {showMigration && (
        <MigrationHub
          isOpen
          onClose={() => setShowMigration(false)}
          onDone={() => {
            setShowMigration(false);
            loadProducts();
          }}
        />
      )}
      {showMake && <MakeModal products={products} currency={profileCurrency} onClose={() => setShowMake(false)} onSaved={afterProduction} />}

      {/* Search & Filters */}
      <div className="glass-panel p-4 mb-6" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ maxWidth: '350px', flex: 1, minWidth: 200 }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search by name, HSN, barcode, brand, category..." value={search}
            onChange={e => setSearch(e.target.value)} className="search-input" disabled={bulkEdit}
            title={bulkEdit ? 'Save or cancel the bulk edit first' : undefined} />
          {search && <button className="icon-btn" onClick={() => setSearch('')} title="Clear search" aria-label="Clear search"><X size={14} /></button>}
        </div>

        {distinctCategories.length > 0 && (
          <div style={{ minWidth: 160 }}>
            <select className="form-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ height: 38, fontSize: '0.85rem' }}>
              <option value="">All Categories ({distinctCategories.length})</option>
              {distinctCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        )}

        {distinctBrands.length > 0 && (
          <div style={{ minWidth: 140 }}>
            <select className="form-input" value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ height: 38, fontSize: '0.85rem' }}>
              <option value="">All Brands ({distinctBrands.length})</option>
              {distinctBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {(brandFilter || categoryFilter) && (
          <button type="button" className="btn btn-secondary text-xs" style={{ padding: '0.35rem 0.6rem' }}
            onClick={() => { setBrandFilter(''); setCategoryFilter(''); }}>
            Reset Filters
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">{editingId ? 'Edit Product' : 'Add Product'} <HelpButton title="Adding a product or service" doc="products#add-product" size={16} /></h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Product / Service Name *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => updateField('name', e.target.value)} placeholder="e.g. Web Development" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <span className="form-label" id="product-kind-label">This is a <HelpButton title="Goods or service" doc="products#goods-or-service" size={14} /></span>
                <div role="radiogroup" aria-labelledby="product-kind-label" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[['goods', 'Goods (stock counted)'], ['service', 'Service (no stock)']].map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={form.kind === id}
                      className={`type-chip ${form.kind === id ? 'type-chip-active' : ''}`} onClick={() => setKind(id)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Barcode / SKU</label>
                  <button
                    type="button"
                    style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    onClick={() => updateField('barcode', generateRandomBarcode('PROD'))}
                    title="Generate random Code128 barcode"
                  >
                    <RefreshCw size={11} strokeWidth={1.75} style={{ marginRight: 3, verticalAlign: 'middle' }} /> Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  className="form-input"
                  value={form.barcode || ''}
                  onChange={e => updateField('barcode', e.target.value)}
                  placeholder="e.g. 890123456789 or scan with USB scanner"
                />
                {form.barcode && (
                  <div
                    style={{ marginTop: '0.35rem', padding: '0.35rem', background: '#ffffff', borderRadius: 4, display: 'inline-block', border: '1px solid var(--border)' }}
                    dangerouslySetInnerHTML={{ __html: renderCode128Svg(form.barcode, { height: 26, barWidth: 1.2, includeText: true, fontSize: 10 }) }}
                  />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">{form.kind === 'service' ? 'SAC Code' : 'HSN / SAC Code'}</label>
                <input type="text" className="form-input" value={form.hsn}
                  onChange={e => updateField('hsn', e.target.value)} placeholder={form.kind === 'service' ? 'e.g. 998314' : 'e.g. 4802'} />
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input type="text" className="form-input" value={form.brand}
                  onChange={e => updateField('brand', e.target.value)}
                  placeholder="e.g. Samsung, HP, Tata" list="product-brands-list" />
                <datalist id="product-brands-list">
                  {distinctBrands.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Prime Category</label>
                <input type="text" className="form-input" value={form.category}
                  onChange={e => updateField('category', e.target.value)}
                  placeholder="e.g. Electronics, Hardware" list="product-cats-list" />
                <datalist id="product-cats-list">
                  {distinctCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', padding: '0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.02))', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <span className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                  Sub-Categories (3-Level Classification)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Sub-Category 1 (Group / Type)</label>
                    <input type="text" className="form-input" value={form.subCategory1}
                      onChange={e => updateField('subCategory1', e.target.value)}
                      placeholder="e.g. Mobiles" />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Sub-Category 2 (Segment)</label>
                    <input type="text" className="form-input" value={form.subCategory2}
                      onChange={e => updateField('subCategory2', e.target.value)}
                      placeholder="e.g. Smartphones" />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.72rem' }}>Sub-Category 3 (Variant / Grade)</label>
                    <input type="text" className="form-input" value={form.subCategory3}
                      onChange={e => updateField('subCategory3', e.target.value)}
                      placeholder="e.g. 5G Series" />
                  </div>
                </div>
              </div>
              {/* v1.10.29 — Purchase price + selling price side by side.
                  Selling price seeds the invoice rate; purchase price seeds
                  the purchase-bill rate. Legacy `rate` field kept invisible
                  for backward compat — writes through to sellingPrice. */}
              <div className="form-group">
                <label className="form-label">Purchase Price</label>
                <input type="number" className="form-input" value={form.purchasePrice}
                  onChange={e => updateField('purchasePrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you pay the supplier. Auto-fills on new Purchase Bills." />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price</label>
                <input type="number" className="form-input" value={form.sellingPrice}
                  onChange={e => updateField('sellingPrice', e.target.value)}
                  placeholder="0.00" min="0" step="any"
                  title="What you charge the customer. Auto-fills on new Invoices." />
              </div>
              <div className="form-group">
                <label className="form-label">GST %</label>
                <input type="number" className="form-input" value={form.taxPercent}
                  onChange={e => updateField('taxPercent', e.target.value)} placeholder="18" min="0" max="100" />
              </div>
              {/* v1.10.84 - for GSTR-1 Table 8: only matters at 0% or on a bill of supply. */}
              <div className="form-group">
                <label className="form-label" htmlFor="gst-treatment">If no GST is charged</label>
                <select id="gst-treatment" className="form-input" value={form.gstTreatment}
                  onChange={e => updateField('gstTreatment', e.target.value)}
                  title="How GSTR-1 reports this item when it is sold at 0% or on a bill of supply">
                  <option value="">Automatic (0% = nil-rated, bill of supply = exempt)</option>
                  <option value="nil">Nil-rated</option>
                  <option value="exempt">Exempt</option>
                  <option value="nongst">Non-GST supply</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Calculation Type</label>
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: 4, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="radio" name="calcCategory" value="qty"
                      checked={!form.calcCategory || form.calcCategory === 'qty'}
                      onChange={() => updateField('calcCategory', 'qty')} />
                    Standard (Qty / Nos)
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="radio" name="calcCategory" value="sqft"
                      checked={form.calcCategory === 'sqft'}
                      onChange={() => {
                        updateField('calcCategory', 'sqft');
                        updateField('unit', 'Sq.ft');
                      }} />
                    Glass / Mirror (Square Feet - SQFT)
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input type="radio" name="calcCategory" value="rft"
                      checked={form.calcCategory === 'rft'}
                      onChange={() => {
                        updateField('calcCategory', 'rft');
                        updateField('unit', 'R.ft');
                      }} />
                    Edge Polish / Channel (Running Feet - RFT)
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-input" value={form.unit}
                  onChange={e => updateField('unit', e.target.value)}>
                  {form.unit && !units.some(u => u.label === form.unit) && (
                    <option value={form.unit}>{form.unit}</option>
                  )}
                  {(form.kind === 'service' ? serviceUnits : units).map(u => <option key={u.label} value={u.label}>{u.label}{u.custom ? ' ★' : ''}</option>)}
                </select>
              </div>
              {form.kind !== 'service' && (
                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input type="number" className="form-input" value={form.stock}
                    onChange={e => updateField('stock', e.target.value)} placeholder="Blank = not counted" min="0" />
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description (optional)</label>
                <input type="text" className="form-input" value={form.description}
                  onChange={e => updateField('description', e.target.value)} placeholder="Brief description..." />
              </div>
              {form.kind !== 'service' && (
                <div className="form-group" style={{ gridColumn: 'span 2', padding: '0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.02))', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={!!form.enableAlternateUnit} onChange={e => updateField('enableAlternateUnit', e.target.checked)} />
                    Alternate Unit / Packaging (e.g. 1 Box = 12 Pcs)
                  </label>
                  {form.enableAlternateUnit && (
                    <div style={{ marginTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                      <div>
                        <label className="form-label">Secondary Unit</label>
                        <select className="form-input" value={form.secondaryUnit}
                          onChange={e => updateField('secondaryUnit', e.target.value)}>
                          <option value="">Select Alternate Unit...</option>
                          {units.filter(u => u.label !== form.unit).map(u => (
                            <option key={u.label} value={u.label}>{u.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Conversion Factor ({form.unit || 'Base'} per {form.secondaryUnit || 'Pack'})</label>
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          className="form-input"
                          value={form.conversionFactor}
                          onChange={e => updateField('conversionFactor', e.target.value)}
                          placeholder={`e.g. 12 (${form.unit || 'Nos'} in 1 ${form.secondaryUnit || 'Box'})`}
                        />
                      </div>
                      <div>
                        <label className="form-label">Price per {form.secondaryUnit || 'Pack'} (Optional)</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="form-input"
                          value={form.secondaryRate}
                          onChange={e => updateField('secondaryRate', e.target.value)}
                          placeholder={
                            form.sellingPrice && form.conversionFactor
                              ? `Default: ${(Number(form.sellingPrice) * Number(form.conversionFactor)).toFixed(2)}`
                              : 'Custom pack selling price'
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {form.kind !== 'service' && (
                <div className="form-group" style={{ gridColumn: 'span 2', padding: '0.75rem', background: 'var(--bg-secondary, rgba(0,0,0,0.02))', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={!!form.trackSerial} onChange={e => updateField('trackSerial', e.target.checked)} />
                    Track Serial Numbers / IMEI & Warranty
                  </label>
                  {form.trackSerial && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="form-label">Default Warranty</label>
                        <select className="form-input" value={[0, 3, 6, 12, 24, 36].includes(Number(form.warrantyMonths)) ? Number(form.warrantyMonths) : -1}
                          onChange={e => {
                            const v = Number(e.target.value);
                            updateField('warrantyMonths', v === -1 ? 1 : v);
                          }}>
                          <option value={0}>No warranty</option>
                          <option value={3}>3 Months</option>
                          <option value={6}>6 Months</option>
                          <option value={12}>1 Year (12 Months)</option>
                          <option value={24}>2 Years (24 Months)</option>
                          <option value={36}>3 Years (36 Months)</option>
                          <option value={-1}>Custom months...</option>
                        </select>
                      </div>
                      {(![0, 3, 6, 12, 24, 36].includes(Number(form.warrantyMonths)) || form.warrantyMonths === -1) && (
                        <div style={{ width: 140 }}>
                          <label className="form-label">Custom Months</label>
                          <input type="number" className="form-input" min="1" max="120"
                            value={form.warrantyMonths || ''}
                            onChange={e => updateField('warrantyMonths', Math.max(0, Number(e.target.value) || 0))}
                            placeholder="e.g. 18" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {mfgOn && form.kind !== 'service' && (
                <BomEditor productId={editingId} madeHere={form.madeHere} bom={form.bom} products={products} currency={profileCurrency}
                  onChange={({ madeHere, bom }) => setForm((prev) => ({ ...prev, madeHere, bom }))} />
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} /> {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="glass-panel">
        <div className="table-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3>Products & Services <HelpButton title="The product list" doc="products#product-list" size={16} /></h3>
          {!bulkEdit && (
            <TableExport title="Products" filename="Products"
              headers={['Name', 'Type', 'HSN/SAC', 'Purchase price', 'Selling price', 'MRP', 'GST %', 'Unit', 'Stock']}
              rows={filtered.map((p) => [p.name, isServiceProduct(p) ? 'Service' : 'Goods', p.hsn || '', Number(p.purchasePrice) || 0, Number(p.sellingPrice ?? p.rate) || 0, Number(p.mrp) || '', Number(p.taxPercent) || 0, p.unit || 'Nos', trackedStock(p) ?? ''])} />
          )}
        </div>
        {bulkEdit && filtered.length > 0 ? (
          <ProductBulkEdit products={filtered} units={units} onDone={(saved) => { setBulkEdit(false); if (saved) loadProducts(); }} />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>{products.length === 0 ? 'No products yet. Add your first product.' : 'No products match your search.'}</p>
            {products.length === 0 && (
              <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Product</button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            {pickedShown.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', margin: '0 0 0.5rem', background: 'var(--primary-light)', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.88rem' }}>{pickedShown.length} selected</strong>
                <button type="button" className="btn btn-secondary" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => deletePicked(pickedShown)}>
                  <Trash2 size={14} /> Delete selected
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPicked(new Set())}>Clear</button>
              </div>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all products shown"
                      checked={pickedShown.length === filtered.length}
                      onChange={(e) => setPicked(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} />
                  </th>
                  <th>Name</th>
                  <th>HSN/SAC</th>
                  <th>Rate</th>
                  <th>GST %</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(product => (
                  <tr key={product.id}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${product.name}`} checked={picked.has(product.id)}
                        onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(product.id); else next.delete(product.id); return next; })} />
                    </td>
                    <td className="font-medium" title={product.description || ''}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{product.name}</span>
                        {(product.calcCategory === 'sqft' || product.unit === 'Sq.ft') && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                            SQFT
                          </span>
                        )}
                        {(product.calcCategory === 'rft' || product.unit === 'R.ft') && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                            RFT
                          </span>
                        )}
                      </div>
                      {(product.brand || product.category) && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {product.brand && (
                            <span style={{ fontWeight: 600, color: '#4f46e5', background: '#eef2ff', padding: '1px 5px', borderRadius: 3 }}>
                              🏷️ {product.brand}
                            </span>
                          )}
                          {(product.category || product.subCategory1) && (
                            <span>
                              {[product.category, product.subCategory1, product.subCategory2, product.subCategory3].filter(Boolean).join(' › ')}
                            </span>
                          )}
                        </div>
                      )}
                      {product.barcode && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <Barcode size={12} /> {product.barcode}
                        </div>
                      )}
                      {product.trackSerial && (
                        <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 500 }}>
                          Trackable S/N{Number(product.warrantyMonths) > 0 ? ` · Warranty ${product.warrantyMonths >= 12 && product.warrantyMonths % 12 === 0 ? `${product.warrantyMonths / 12} Yr` : `${product.warrantyMonths} Mo`}` : ''}
                        </div>
                      )}
                      {mfgOn && product.madeHere && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          Made here · cost {formatCurrency(unitCost(product, products), profileCurrency)} per {product.unit || 'unit'}
                        </div>
                      )}
                    </td>
                    <td className="text-muted">{product.hsn || '-'}</td>
                    <td className="font-bold">
                      <div>{product.rate ? formatCurrency(product.rate, profileCurrency) : '-'}</div>
                      {Number(product.mrp) > 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          MRP: {formatCurrency(product.mrp, profileCurrency)}
                        </div>
                      )}
                    </td>
                    <td>{product.taxPercent ? `${product.taxPercent}%` : '-'}</td>
                    <td className="text-muted">
                      <div>{product.unit || 'Nos'}</div>
                      {hasAlternateUnit(product) && (
                        <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 500 }}>
                          1 {product.secondaryUnit} = {product.conversionFactor} {product.unit || 'Nos'}
                        </div>
                      )}
                    </td>
                    <td>
                      {/* #121 - a service, or stock never entered, is not counted: never "Out of Stock". */}
                      {isServiceProduct(product) ? (
                        <span className="text-muted" title="A service has no stock">Service</span>
                      ) : trackedStock(product) === null ? (
                        <span className="text-muted" title="No stock entered, so it is not counted">-</span>
                      ) : trackedStock(product) <= 0 ? (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Out of Stock</span>
                      ) : (stockAlerts.enabled !== false && trackedStock(product) <= Number(stockAlerts.threshold ?? 5)) ? (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>{product.stock}</span>
                      ) : (
                        product.stock
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn icon-btn-blue" onClick={() => openEdit(product)} title="Edit">
                          <Edit3 size={15} />
                        </button>
                        <button className="icon-btn icon-btn-red" onClick={() => handleDelete(product.id)} title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {mfgOn && <ProductionList products={products} currency={profileCurrency} reloadKey={mfgReload} onChanged={afterProduction} />}
      {showBarcodeModal && <BarcodeLabelsModal products={products} profile={profile} onClose={() => setShowBarcodeModal(false)} />}
    </div>
  );
}
