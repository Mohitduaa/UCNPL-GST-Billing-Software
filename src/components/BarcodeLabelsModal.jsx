// v1.10.84 (#137, #158) - Barcode Label Printing Modal
// Supports standard A4 label sheets (24-up, 65-up) and thermal barcode rolls (50x25mm).
import { useState, useMemo, useEffect } from 'react';
import { X, Printer, Barcode, CheckSquare, Square, RefreshCw, Tag, Layers } from 'lucide-react';
import { renderCode128Svg, generateRandomBarcode } from '../utils/barcode';
import { formatCurrency, getCountryConfig } from '../utils';
import { toast } from './Toast';

const LAYOUTS = [
  { id: 'a4-24', label: 'A4 Sheet (24 Labels · 3 × 8 · 70×37mm)', cols: 3, rows: 8, perPage: 24, width: '70mm', height: '37mm' },
  { id: 'a4-65', label: 'A4 Sheet (65 Labels · 5 × 13 · 38×21mm)', cols: 5, rows: 13, perPage: 65, width: '38mm', height: '21mm' },
  { id: 'thermal-50x25', label: 'Thermal Roll (50 × 25mm / 2" × 1")', cols: 1, rows: 1, perPage: 1, width: '50mm', height: '25mm' },
];

export default function BarcodeLabelsModal({ products = [], initialCounts = null, profile, onClose }) {
  const [selectedLayout, setSelectedLayout] = useState('a4-24');
  const [counts, setCounts] = useState(() => initialCounts || {});
  const [showBizName, setShowBizName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [currency] = useState(() => getCountryConfig(profile?.country || 'India').currency);

  // Initialize counts for products: default 1 label per product with barcode (unless initialCounts provided)
  useEffect(() => {
    if (initialCounts && Object.keys(initialCounts).length > 0) {
      setCounts(initialCounts);
      return;
    }
    const initial = {};
    products.forEach(p => {
      initial[p.id] = (p.barcode ? 1 : 0);
    });
    setCounts(initial);
  }, [products, initialCounts]);

  const layout = useMemo(() => LAYOUTS.find(l => l.id === selectedLayout) || LAYOUTS[0], [selectedLayout]);

  // Total labels to print
  const totalLabels = useMemo(() => {
    return Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
  }, [counts]);

  // Build the flat list of label items
  const labelItems = useMemo(() => {
    const list = [];
    products.forEach(p => {
      const qty = Number(counts[p.id]) || 0;
      if (qty > 0) {
        const bc = p.barcode || generateRandomBarcode('PROD');
        for (let i = 0; i < qty; i++) {
          list.push({
            id: p.id,
            name: p.name,
            barcode: bc,
            price: p.mrp ?? p.sellingPrice ?? p.rate ?? 0,
          });
        }
      }
    });
    return list;
  }, [products, counts]);

  const handleSetAllCount = (n) => {
    const updated = {};
    products.forEach(p => { updated[p.id] = n; });
    setCounts(updated);
  };

  const handleFillFromStock = () => {
    const updated = {};
    products.forEach(p => {
      const stk = Math.max(0, Math.floor(Number(p.stock) || 0));
      updated[p.id] = stk > 0 ? stk : 1;
    });
    setCounts(updated);
    toast('Quantities updated to match product stock', 'info');
  };

  const handlePrint = () => {
    if (totalLabels === 0) {
      toast('Please select at least 1 product label to print', 'warning');
      return;
    }
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 950, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Barcode size={24} className="text-primary" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Print Barcode Labels & Price Tags</h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Retail barcode stickers for garment POS, sticker sheets, and thermal printers
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Content Body (2 Columns: Controls on Left, Preview on Right) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.25rem', overflow: 'hidden', flex: 1 }}>
          
          {/* Left Column: Settings & Product Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            
            {/* 1. Label Sheet Format */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Label Sheet / Paper Format</label>
              <select
                className="form-input"
                value={selectedLayout}
                onChange={e => setSelectedLayout(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                {LAYOUTS.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Content Options */}
            <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.03))', padding: '0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Label Details to Include
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showBizName} onChange={e => setShowBizName(e.target.checked)} />
                  <span>Business Name ({profile?.businessName || 'Shop Name'})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showProductName} onChange={e => setShowProductName(e.target.checked)} />
                  <span>Product Name</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
                  <span>MRP / Selling Price</span>
                </label>
              </div>
            </div>

            {/* 3. Products & Quantities */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Products ({products.length})</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }} onClick={() => handleSetAllCount(1)}>
                    1 each
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }} onClick={handleFillFromStock} title="Match quantity to stock on hand">
                    Stock qty
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }} onClick={() => handleSetAllCount(0)}>
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, maxHeight: 260 }}>
                {products.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No products found. Add products first.
                  </div>
                ) : (
                  products.map(p => {
                    const c = Number(counts[p.id]) || 0;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)',
                          background: c > 0 ? 'rgba(37, 99, 235, 0.04)' : undefined
                        }}
                      >
                        <div style={{ overflow: 'hidden', marginRight: '0.5rem' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem' }}>
                            <span>{p.barcode ? `BC: ${p.barcode}` : 'Auto-barcode'}</span>
                            <span>·</span>
                            <span>{formatCurrency(p.mrp ?? p.sellingPrice ?? p.rate ?? 0, currency)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <input
                            type="number"
                            min="0"
                            max="500"
                            value={c}
                            onChange={e => setCounts({ ...counts, [p.id]: Math.max(0, parseInt(e.target.value) || 0) })}
                            style={{ width: 55, fontSize: '0.82rem', padding: '0.2rem 0.35rem', textAlign: 'center' }}
                            className="form-input"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Sheet Live Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>
                Preview ({totalLabels} {totalLabels === 1 ? 'label' : 'labels'})
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {layout.perPage > 1 ? `Fits ~${layout.perPage} per page` : 'Continuous Roll'}
              </div>
            </div>

            {/* Preview Sheet Container */}
            <div
              id="barcode-print-container"
              style={{
                flex: 1,
                overflowY: 'auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '8mm 6mm',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderRadius: 4,
              }}
            >
              {labelItems.length === 0 ? (
                <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Barcode size={42} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                  <div>No labels selected</div>
                  <div style={{ fontSize: '0.78rem' }}>Set quantity on the left to generate barcode stickers.</div>
                </div>
              ) : (
                <div
                  className="barcode-labels-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    gap: selectedLayout === 'a4-65' ? '1.5mm' : '3mm',
                  }}
                >
                  {labelItems.map((item, idx) => {
                    const isCompact = selectedLayout === 'a4-65';
                    const svgHtml = renderCode128Svg(item.barcode, {
                      height: isCompact ? 18 : 26,
                      barWidth: isCompact ? 1.0 : 1.25,
                      includeText: true,
                      fontSize: isCompact ? 8 : 9,
                    });

                    return (
                      <div
                        key={idx}
                        className="barcode-label-card"
                        style={{
                          border: '1px dashed #cbd5e1',
                          borderRadius: 3,
                          padding: isCompact ? '2mm 1mm' : '3mm 2mm',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          background: '#ffffff',
                          pageBreakInside: 'avoid',
                          boxSizing: 'border-box',
                          minHeight: isCompact ? '20mm' : '32mm',
                        }}
                      >
                        {showBizName && (
                          <div style={{ fontSize: isCompact ? '0.55rem' : '0.65rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1, marginBottom: 1 }}>
                            {profile?.businessName || 'UCNPL Billing'}
                          </div>
                        )}
                        {showProductName && (
                          <div style={{ fontSize: isCompact ? '0.62rem' : '0.74rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: 1.2, marginBottom: 2 }}>
                            {item.name}
                          </div>
                        )}

                        <div
                          style={{ margin: '1px 0', display: 'flex', justifyContent: 'center', width: '100%' }}
                          dangerouslySetInnerHTML={{ __html: svgHtml }}
                        />

                        {showPrice && (
                          <div style={{ fontSize: isCompact ? '0.65rem' : '0.76rem', fontWeight: 800, color: '#000000', marginTop: 1 }}>
                            MRP: {formatCurrency(item.price, currency)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            <strong>{totalLabels}</strong> {totalLabels === 1 ? 'sticker' : 'stickers'} ready to print
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={totalLabels === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <Printer size={16} />
              Print Labels ({totalLabels})
            </button>
          </div>
        </div>

        {/* Dedicated Print Media Styles for Barcode Printing */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #barcode-print-container, #barcode-print-container * {
              visibility: visible !important;
            }
            #barcode-print-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 100% !important;
              margin: 0 !important;
              padding: 5mm !important;
              border: none !important;
              box-shadow: none !important;
              overflow: visible !important;
              background: #fff !important;
              z-index: 999999 !important;
            }
            .barcode-label-card {
              border: 0.5px solid #e2e8f0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            @page {
              margin: 4mm;
              size: ${selectedLayout === 'thermal-50x25' ? '50mm 25mm' : 'A4 portrait'};
            }
          }
        ` }} />

      </div>
    </div>
  );
}
