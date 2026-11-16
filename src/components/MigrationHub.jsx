import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRightLeft,
  UploadCloud,
  FileSpreadsheet,
  Building2,
  Boxes,
  FileText,
  CheckCircle2,
  Download,
  Upload,
  X,
  Search,
  ArrowLeft,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import {
  MIGRATION_SOFTWARES,
  getSoftwaresByRegion,
  getSoftwareById,
} from '../utils/migrationGuides.js';
import { fileToSheets, bestSheet } from '../utils/importFile.js';
import {
  normalizeMigrationRows,
  buildMigrationPlan,
  detectEntityType,
} from '../utils/migrationParsers.js';
import { tallyMastersToRows } from '../utils/tallyXml.js';
import { parseGstrJsonToPurchases } from '../utils/gstrImport.js';
import {
  salesCsvToBills,
  purchaseCsvToRecords,
  receivedByInvoice,
  newProductsFromBills,
} from '../utils/bulkCsv.js';
import {
  getProfile,
  getAllBills,
  saveBill,
  getAllProducts,
  saveProduct,
  getAllClients,
  saveClient,
  getAllPurchases,
  savePurchase,
  applyStockChanges,
} from '../store.js';
import { belongsToProfile, isInterstateSupply, roundQty } from '../utils.js';
import { toast } from './Toast';

// Download file helper (browser-safe, offline)
function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Sample Templates (Zero external network calls, clean demo data)
const SAMPLE_TEMPLATES = {
  xml: {
    fileName: 'tally-masters-sample.xml',
    mime: 'application/xml;charset=utf-8;',
    content: `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Apex Enterprises Pvt Ltd" RESERVEDNAME="">
            <PARENT>Sundry Debtors</PARENT>
            <PARTYGSTIN>27AAAAA0000A1Z5</PARTYGSTIN>
            <LEDGERMOBILE>9820012345</LEDGERMOBILE>
            <EMAIL>accounts@apexenterprises.example</EMAIL>
            <LEDSTATENAME>Maharashtra</LEDSTATENAME>
            <ADDRESS.LIST>
              <ADDRESS>Plot 12, Commercial Hub</ADDRESS>
              <ADDRESS>Andheri East, Mumbai</ADDRESS>
            </ADDRESS.LIST>
            <PINCODE>400069</PINCODE>
          </LEDGER>
          <LEDGER NAME="Global Industrial Suppliers" RESERVEDNAME="">
            <PARENT>Sundry Creditors</PARENT>
            <PARTYGSTIN>29BBBBB1111B1Z2</PARTYGSTIN>
            <LEDGERMOBILE>9845012345</LEDGERMOBILE>
            <EMAIL>sales@globalsuppliers.example</EMAIL>
            <LEDSTATENAME>Karnataka</LEDSTATENAME>
            <ADDRESS.LIST>
              <ADDRESS>45 Peenya Industrial Area</ADDRESS>
              <ADDRESS>Bengaluru</ADDRESS>
            </ADDRESS.LIST>
            <PINCODE>560058</PINCODE>
          </LEDGER>
          <STOCKITEM NAME="Industrial Ball Bearing 6205" RESERVEDNAME="">
            <BASEUNITS>Nos</BASEUNITS>
            <OPENINGRATE>180.00</OPENINGRATE>
            <STANDARDPRICELIST.LIST>
              <RATE>240.00</RATE>
            </STANDARDPRICELIST.LIST>
            <GSTDETAILS.LIST>
              <APPLICABLEFROM>20240401</APPLICABLEFROM>
              <HSNCODE>8482</HSNCODE>
              <TAXABILITY>Taxable</TAXABILITY>
              <RATEDETAILS.LIST>
                <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>
                <GSTRATE>18</GSTRATE>
              </RATEDETAILS.LIST>
            </GSTDETAILS.LIST>
          </STOCKITEM>
          <STOCKITEM NAME="Synthetic Gear Lubricant 1L" RESERVEDNAME="">
            <BASEUNITS>Ltr</BASEUNITS>
            <OPENINGRATE>350.00</OPENINGRATE>
            <STANDARDPRICELIST.LIST>
              <RATE>480.00</RATE>
            </STANDARDPRICELIST.LIST>
            <GSTDETAILS.LIST>
              <APPLICABLEFROM>20240401</APPLICABLEFROM>
              <HSNCODE>2710</HSNCODE>
              <TAXABILITY>Taxable</TAXABILITY>
              <RATEDETAILS.LIST>
                <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>
                <GSTRATE>18</GSTRATE>
              </RATEDETAILS.LIST>
            </GSTDETAILS.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`,
  },
  json: {
    fileName: 'gstr2b-sample.json',
    mime: 'application/json;charset=utf-8;',
    content: `{
  "gstin": "27AAAAA0000A1Z5",
  "fp": "102026",
  "data": {
    "b2b": [
      {
        "ctin": "29BBBBB1111B1Z2",
        "trdnm": "Global Industrial Suppliers",
        "inv": [
          {
            "inum": "INV-2026-904",
            "idt": "10-10-2026",
            "val": 28320,
            "pos": "27",
            "itms": [
              {
                "num": 1,
                "itm_det": {
                  "txval": 24000,
                  "rt": 18,
                  "cgst": 0,
                  "sgst": 0,
                  "igst": 4320,
                  "cess": 0
                }
              }
            ]
          }
        ]
      }
    ]
  }
}`,
  },
  clients: {
    fileName: 'clients-sample-template.csv',
    mime: 'text/csv;charset=utf-8;',
    content: `Name,Company,GSTIN,Phone,Email,Address,City,State,Pincode,Country
Apex Enterprises Pvt Ltd,Apex Corp,27AAAAA0000A1Z5,9820012345,billing@apexenterprises.example,"Plot 12, Commercial Hub, Andheri East",Mumbai,Maharashtra,400069,India
Global Industrial Suppliers,Global Suppliers,29BBBBB1111B1Z2,9845012345,sales@globalsuppliers.example,"45 Peenya Industrial Area",Bengaluru,Karnataka,560058,India
Horizon Technologies LLC,Horizon Tech,VAT-99887766,14155552671,accounts@horizon.example,"100 Market St, Suite 300",San Francisco,California,94105,United States`,
  },
  products: {
    fileName: 'products-sample-template.csv',
    mime: 'text/csv;charset=utf-8;',
    content: `Item Name,HSN/SAC,Unit,Selling Price,Purchase Price,GST Rate,Opening Stock,Barcode,Brand,Category
Industrial Ball Bearing 6205,8482,Nos,240,180,18,50,BRG-6205,SKF,Hardware
Synthetic Gear Lubricant 1L,2710,Ltr,480,350,18,30,LUB-1001,Castrol,Consumables
Wireless Laser Barcode Scanner,8471,Nos,1850,1200,18,15,SCN-8800,Honeywell,Electronics
Consulting & Support Services,998313,Hours,1500,0,18,0,SRV-CONSULT,In-House,Services`,
  },
  invoices: {
    fileName: 'sales-invoices-sample-template.csv',
    mime: 'text/csv;charset=utf-8;',
    content: `Invoice Number,Invoice Date,Invoice Type,Due Date,Customer Name,Customer GSTIN,Customer State,Customer Address,Item Name,HSN,Quantity,Unit,Rate,Discount,GST Rate,Cess Rate
INV-2026-001,2026-10-01,Tax Invoice,2026-10-31,Apex Enterprises Pvt Ltd,27AAAAA0000A1Z5,Maharashtra,"Plot 12, Commercial Hub, Mumbai",Industrial Ball Bearing 6205,8482,10,Nos,240,0,18,0
INV-2026-001,2026-10-01,Tax Invoice,2026-10-31,Apex Enterprises Pvt Ltd,27AAAAA0000A1Z5,Maharashtra,"Plot 12, Commercial Hub, Mumbai",Synthetic Gear Lubricant 1L,2710,2,Ltr,480,0,18,0
INV-2026-002,2026-10-02,Tax Invoice,2026-11-01,Horizon Technologies LLC,,California,"100 Market St, San Francisco",Wireless Laser Barcode Scanner,8471,1,Nos,1850,0,18,0`,
  },
  purchases: {
    fileName: 'purchase-bills-sample-template.csv',
    mime: 'text/csv;charset=utf-8;',
    content: `Bill Number,Date,Supplier Name,Supplier GSTIN,Supplier Address,Item Name,HSN,Quantity,Unit,Rate,GST Rate,Cess Rate,Payment Status
SUP-2026-881,2026-10-03,Global Industrial Suppliers,29BBBBB1111B1Z2,"45 Peenya Industrial Area, Bengaluru",Industrial Ball Bearing 6205,8482,50,Nos,180,18,0,Paid
SUP-2026-882,2026-10-05,Global Industrial Suppliers,29BBBBB1111B1Z2,"45 Peenya Industrial Area, Bengaluru",Synthetic Gear Lubricant 1L,2710,20,Ltr,350,18,0,Unpaid`,
  },
};

export default function MigrationHub({ isOpen, onClose, onDone, onNavigate }) {
  if (!isOpen) return null;

  // Region tabs state
  const [activeRegion, setActiveRegion] = useState('india');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSoftware, setSelectedSoftware] = useState(null);

  // File parsing & scorecard state
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [loadedFile, setLoadedFile] = useState(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [detectedEntityType, setDetectedEntityType] = useState('clients');
  const [plan, setPlan] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Checkbox configuration options
  const [updateExistingClients, setUpdateExistingClients] = useState(true);
  const [updateStock, setUpdateStock] = useState(true);
  const [takeSoldOutOfStock, setTakeSoldOutOfStock] = useState(false);

  // Execution state
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [completionStats, setCompletionStats] = useState(null);

  const fileInputRef = useRef(null);

  // Auto-detect country on mount
  useEffect(() => {
    let mounted = true;
    getProfile()
      .then((prof) => {
        if (!mounted || !prof) return;
        const country = String(prof.country || '').trim().toLowerCase();
        if (country && country !== 'india' && country !== 'in') {
          setActiveRegion('global');
        } else {
          setActiveRegion('india');
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Filtered software list
  const softwareList = getSoftwaresByRegion(activeRegion, searchQuery);

  const handleClose = () => {
    if (busy) return;
    onClose?.();
  };

  const handleSelectSoftware = (sw) => {
    setSelectedSoftware(sw);
    setLoadedFile(null);
    setPlan(null);
    setParseError(null);
    setCompletionStats(null);
    setProgress(0);
  };

  const handleBackToCatalog = () => {
    if (busy) return;
    setSelectedSoftware(null);
    setLoadedFile(null);
    setPlan(null);
    setParseError(null);
    setCompletionStats(null);
    setProgress(0);
  };

  const handleDownloadSample = (key) => {
    const tpl = SAMPLE_TEMPLATES[key] || SAMPLE_TEMPLATES.clients;
    downloadFile(tpl.content, tpl.fileName, tpl.mime);
    toast(`Sample template "${tpl.fileName}" downloaded`, 'success');
  };

  // Evaluate sheet rows and build migration scorecard plan
  const evaluateSheetData = async (
    sheets,
    sheetIdx,
    fileName,
    entityTypeOverride = null,
    optsOverride = null
  ) => {
    const currentSheet = sheets[sheetIdx];
    if (!currentSheet) return;
    setSelectedSheetIndex(sheetIdx);

    const [profile, clients, products, bills, purchases] = await Promise.all([
      getProfile().catch(() => ({})),
      getAllClients().catch(() => []),
      getAllProducts().catch(() => []),
      getAllBills().catch(() => []),
      getAllPurchases().catch(() => []),
    ]);

    const targetType =
      entityTypeOverride || currentSheet.forcedType || detectEntityType(currentSheet.rows);
    setDetectedEntityType(targetType);

    const opts = optsOverride || {
      updateExisting: updateExistingClients,
      adjustStock: updateStock,
    };

    const normalized = normalizeMigrationRows(
      currentSheet.rows,
      selectedSoftware?.id || 'universal',
      targetType
    );

    let migrationPlan;
    if (targetType === 'invoices') {
      const existingIds = new Set(
        bills.map((b) => String(b.invoiceNumber || b.id || '').trim().toLowerCase())
      );

      // Support Vyapar multi-sheet payment detection
      const otherSheets = sheets.filter((_, i) => i !== sheetIdx);
      const paymentMap =
        otherSheets.map((s) => receivedByInvoice(s.rows)).find((m) => m.size > 0) || null;

      const salesResult = salesCsvToBills(currentSheet.rows, {
        profile,
        products,
        clients,
        adjustStock: takeSoldOutOfStock,
        existingIds,
        received: paymentMap,
      });

      migrationPlan = {
        entityType: 'invoices',
        softwareId: selectedSoftware?.id || 'universal',
        scorecard: {
          total: salesResult.bills.length + salesResult.skipped.length + salesResult.errors.length,
          readyToAdd: salesResult.bills.length,
          readyToUpdate: 0,
          skipped: salesResult.skipped.length,
          errors: salesResult.errors.length,
        },
        newItems: salesResult.bills,
        updatedItems: [],
        newClientsFromInvoices: salesResult.newClients || [],
        errors: salesResult.errors,
        warnings: salesResult.warnings || [],
      };
    } else if (targetType === 'purchases') {
      const existing = purchases.filter((p) => belongsToProfile(p, profile));
      const purchaseResult = purchaseCsvToRecords(currentSheet.rows, {
        profile,
        existing,
        inferInterstate: (g) => isInterstateSupply(g, profile),
      });

      migrationPlan = {
        entityType: 'purchases',
        softwareId: selectedSoftware?.id || 'universal',
        scorecard: {
          total:
            purchaseResult.purchases.length +
            purchaseResult.skipped.length +
            purchaseResult.errors.length,
          readyToAdd: purchaseResult.purchases.length,
          readyToUpdate: 0,
          skipped: purchaseResult.skipped.length,
          errors: purchaseResult.errors.length,
        },
        newItems: purchaseResult.purchases,
        updatedItems: [],
        errors: purchaseResult.errors,
        warnings: purchaseResult.warnings || [],
      };
    } else {
      // Clients or Products via buildMigrationPlan
      migrationPlan = buildMigrationPlan(normalized, {
        clients,
        products,
        bills,
        purchases,
        opts,
      });
    }

    setPlan(migrationPlan);
  };

  // Process uploaded or dropped file
  const processUploadedFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setPlan(null);
    setCompletionStats(null);
    setProgress(0);

    try {
      const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1]?.toLowerCase();

      // Handle Tally Masters XML
      if (ext === 'xml') {
        const buffer = await file.arrayBuffer();
        const tallyData = tallyMastersToRows(new Uint8Array(buffer));
        const sheets = [];
        if (tallyData.clients && tallyData.clients.length >= 2) {
          sheets.push({
            name: `Parties / Ledgers (${tallyData.clients.length - 1})`,
            rows: tallyData.clients,
            forcedType: 'clients',
          });
        }
        if (tallyData.products && tallyData.products.length >= 2) {
          sheets.push({
            name: `Stock Items (${tallyData.products.length - 1})`,
            rows: tallyData.products,
            forcedType: 'products',
          });
        }
        if (sheets.length === 0) {
          throw new Error('This Tally XML file contains no party ledgers or stock items.');
        }

        setLoadedFile({ name: file.name, type: 'xml', sheets });
        await evaluateSheetData(sheets, 0, file.name);
        return;
      }

      // Handle GSTR-2B JSON
      if (ext === 'json') {
        const text = await file.text();
        const profile = await getProfile().catch(() => ({}));
        const existingPurchases = await getAllPurchases().catch(() => []);
        const gstrResult = parseGstrJsonToPurchases(text, { existingPurchases, profile });

        const gstrPlan = {
          softwareId: selectedSoftware?.id || 'gst-portal',
          entityType: 'purchases',
          sourceType: 'gstr-json',
          scorecard: {
            total: gstrResult.totalInvoices,
            readyToAdd: gstrResult.toImport.length,
            readyToUpdate: 0,
            skipped: gstrResult.skipped.length,
            errors: 0,
          },
          newItems: gstrResult.toImport,
          updatedItems: [],
          errors: [],
          gstrMeta: { gstin: gstrResult.gstin, period: gstrResult.period },
        };

        setLoadedFile({
          name: file.name,
          type: 'json',
          sheets: [{ name: 'GSTR-2B Purchases', rows: [] }],
        });
        setSelectedSheetIndex(0);
        setPlan(gstrPlan);
        return;
      }

      // Handle Excel .xlsx or CSV
      const sheets = await fileToSheets(file, 'clients');
      if (!sheets || sheets.length === 0) {
        throw new Error('No sheets or rows found in the selected file.');
      }

      setLoadedFile({ name: file.name, type: ext === 'xlsx' ? 'xlsx' : 'csv', sheets });

      const bestIdx = bestSheet(sheets, (rows) => {
        const norm = normalizeMigrationRows(rows, selectedSoftware?.id || 'universal');
        return norm.validCount;
      });

      await evaluateSheetData(sheets, bestIdx >= 0 ? bestIdx : 0, file.name);
    } catch (err) {
      setParseError(err.message || 'Failed to read file');
      toast(`Could not read ${file.name}: ${err.message}`, 'error', 8000);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processUploadedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleSheetSwitch = (idx) => {
    if (!loadedFile?.sheets?.[idx]) return;
    evaluateSheetData(loadedFile.sheets, idx, loadedFile.name);
  };

  const handleEntityTypeSwitch = (newType) => {
    if (!loadedFile?.sheets?.[selectedSheetIndex]) return;
    evaluateSheetData(loadedFile.sheets, selectedSheetIndex, loadedFile.name, newType);
  };

  // Re-evaluate plan on checkbox option toggle
  const handleToggleUpdateClients = (val) => {
    setUpdateExistingClients(val);
    if (loadedFile?.sheets?.[selectedSheetIndex]) {
      evaluateSheetData(
        loadedFile.sheets,
        selectedSheetIndex,
        loadedFile.name,
        detectedEntityType,
        {
          updateExisting: val,
          adjustStock: updateStock,
        }
      );
    }
  };

  const handleToggleStock = (val) => {
    setUpdateStock(val);
    if (loadedFile?.sheets?.[selectedSheetIndex]) {
      evaluateSheetData(
        loadedFile.sheets,
        selectedSheetIndex,
        loadedFile.name,
        detectedEntityType,
        {
          updateExisting: updateExistingClients,
          adjustStock: val,
        }
      );
    }
  };

  // Execute safe non-destructive migration
  const executeMigration = async () => {
    if (!plan) return;
    setBusy(true);
    setProgress(0);
    setStatusMessage('Starting migration import...');

    const stats = {
      added: 0,
      updated: 0,
      skipped: plan.scorecard.skipped || 0,
      failed: 0,
      entityType: plan.entityType,
    };

    try {
      if (plan.entityType === 'clients') {
        const itemsToSave = [
          ...plan.newItems.map((item) => ({ item, isUpdate: false })),
          ...(updateExistingClients
            ? plan.updatedItems.map((item) => ({ item, isUpdate: true }))
            : []),
        ];
        const total = itemsToSave.length;
        for (let i = 0; i < total; i++) {
          const { item, isUpdate } = itemsToSave[i];
          try {
            await saveClient(item);
            if (isUpdate) stats.updated++;
            else stats.added++;
          } catch {
            stats.failed++;
          }
          setProgress(Math.round(((i + 1) / total) * 100));
          setStatusMessage(`Saving client ${i + 1} of ${total}: ${item.name}...`);
        }
      } else if (plan.entityType === 'products') {
        const itemsToSave = [
          ...plan.newItems.map((item) => ({ item, isUpdate: false })),
          ...(updateExistingClients
            ? plan.updatedItems.map((item) => ({ item, isUpdate: true }))
            : []),
        ];
        const total = itemsToSave.length;
        for (let i = 0; i < total; i++) {
          const { item, isUpdate } = itemsToSave[i];
          try {
            await saveProduct(item);
            if (isUpdate) stats.updated++;
            else stats.added++;
          } catch {
            stats.failed++;
          }
          setProgress(Math.round(((i + 1) / total) * 100));
          setStatusMessage(`Saving product ${i + 1} of ${total}: ${item.name}...`);
        }
      } else if (plan.entityType === 'invoices') {
        const stock = {};
        const savedBills = [];
        const total = plan.newItems.length;

        try {
          for (let i = 0; i < total; i++) {
            const bill = plan.newItems[i];
            try {
              await saveBill(bill, { overwrite: false });
              stats.added++;
              savedBills.push(bill);
              if (takeSoldOutOfStock) {
                for (const [id, d] of Object.entries(bill.data?.stockApplied || {})) {
                  stock[id] = (stock[id] || 0) + d;
                }
              }
            } catch (err) {
              if (err.status === 409) stats.skipped++;
              else stats.failed++;
            }
            setProgress(Math.round(((i + 1) / total) * 100));
            setStatusMessage(`Saving invoice ${i + 1} of ${total}: ${bill.invoiceNumber}...`);
          }
        } finally {
          if (takeSoldOutOfStock && Object.keys(stock).length > 0) {
            await applyStockChanges(stock).catch(() => {});
          }
          if (savedBills.length > 0) {
            const currentProducts = await getAllProducts().catch(() => null);
            if (currentProducts) {
              const newProds = newProductsFromBills(savedBills, currentProducts);
              for (const p of newProds) {
                await saveProduct(p).catch(() => {});
              }
            }
          }
          if (plan.newClientsFromInvoices?.length > 0) {
            for (const c of plan.newClientsFromInvoices) {
              await saveClient(c).catch(() => {});
            }
          }
        }
      } else if (plan.entityType === 'purchases') {
        const total = plan.newItems.length;
        const currentProducts = await getAllProducts().catch(() => []);
        const byName = new Map(
          currentProducts.map((p) => [String(p.name || '').trim().toLowerCase(), { ...p }])
        );
        const touched = new Set();

        try {
          for (let i = 0; i < total; i++) {
            const pur = plan.newItems[i];
            try {
              await savePurchase(pur);
              stats.added++;
              if (updateStock && Array.isArray(pur.items)) {
                for (const it of pur.items) {
                  const k = (it.name || '').trim().toLowerCase();
                  const prev = byName.get(k) || {
                    name: (it.name || '').trim(),
                    hsn: it.hsn || '',
                    sellingPrice: it.rate || 0,
                    rate: it.rate || 0,
                    taxPercent: it.taxPercent || 0,
                    cessPercent: it.cessPercent || 0,
                    unit: 'Nos',
                    stock: 0,
                    description: '',
                  };
                  byName.set(k, {
                    ...prev,
                    stock: roundQty((Number(prev.stock) || 0) + (Number(it.quantity) || 0)),
                    purchasePrice: it.rate,
                  });
                  touched.add(k);
                }
              }
            } catch {
              stats.failed++;
            }
            setProgress(Math.round(((i + 1) / total) * 100));
            setStatusMessage(
              `Saving purchase bill ${i + 1} of ${total}: ${pur.invoiceNumber || pur.billNumber || ''}...`
            );
          }
        } finally {
          if (updateStock && touched.size > 0) {
            for (const k of touched) {
              await saveProduct(byName.get(k)).catch(() => {});
            }
          }
        }
      }

      setCompletionStats(stats);
      toast(
        `Migration completed! Added ${stats.added}${stats.updated > 0 ? `, updated ${stats.updated}` : ''}${stats.skipped > 0 ? `, skipped ${stats.skipped}` : ''}.`,
        'success',
        6000
      );
      if (onDone) onDone(stats.entityType);
    } catch (err) {
      toast(`Migration interrupted: ${err.message}`, 'error', 9000);
    } finally {
      setBusy(false);
      setStatusMessage('');
    }
  };

  const handleNavigateView = (viewTarget) => {
    handleClose();
    if (onNavigate) {
      onNavigate(viewTarget);
    } else if (onDone) {
      onDone(viewTarget);
    }
  };

  // Helper for capability badge icons
  const renderCapIcon = (cap) => {
    switch (cap) {
      case 'clients':
        return <Building2 size={12} style={{ marginRight: 4 }} />;
      case 'products':
        return <Boxes size={12} style={{ marginRight: 4 }} />;
      case 'invoices':
        return <FileSpreadsheet size={12} style={{ marginRight: 4 }} />;
      case 'purchases':
        return <FileText size={12} style={{ marginRight: 4 }} />;
      default:
        return null;
    }
  };

  const readyCount =
    (plan?.scorecard?.readyToAdd || 0) +
    (updateExistingClients ? plan?.scorecard?.readyToUpdate || 0 : 0);

  return (
    <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: 960,
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflow: 'hidden',
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-primary, #141413)',
          border: '1px solid var(--border-color, #dad9d4)',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--border-color, #dad9d4)',
            marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--primary-light, #f4e3da)',
                  color: 'var(--primary, #c96442)',
                }}
              >
                <ArrowRightLeft size={18} />
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #141413)',
                }}
              >
                Accounting Software Migration Hub
              </h2>
            </div>
            <p
              className="text-muted"
              style={{
                margin: '0.3rem 0 0 2.6rem',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              Switching from another software? Seamlessly migrate your parties, inventory, and
              vouchers offline with zero data lock-in.
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={handleClose}
            disabled={busy}
            title="Close Migration Hub"
            aria-label="Close"
            style={{
              padding: '0.4rem',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: busy ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted, #6e6d68)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {!selectedSoftware ? (
            /* ============================================================ */
            /* VIEW 1: SOFTWARE CATALOG WITH REGION TABS & SEARCH           */
            /* ============================================================ */
            <div>
              {/* Region Tabs & Search Row */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                {/* Region Tabs */}
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-secondary, #f5f4ee)',
                    padding: '0.25rem',
                    borderRadius: 8,
                    border: '1px solid var(--border-color, #dad9d4)',
                    gap: '0.25rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveRegion('india')}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeRegion === 'india' ? 'var(--card-bg, #ffffff)' : 'transparent',
                      color:
                        activeRegion === 'india'
                          ? 'var(--primary, #c96442)'
                          : 'var(--text-muted, #6e6d68)',
                      boxShadow: activeRegion === 'india' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🇮🇳 India
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRegion('global')}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeRegion === 'global' ? 'var(--card-bg, #ffffff)' : 'transparent',
                      color:
                        activeRegion === 'global'
                          ? 'var(--primary, #c96442)'
                          : 'var(--text-muted, #6e6d68)',
                      boxShadow: activeRegion === 'global' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🌍 Global / International
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRegion('all')}
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      background: activeRegion === 'all' ? 'var(--card-bg, #ffffff)' : 'transparent',
                      color:
                        activeRegion === 'all'
                          ? 'var(--primary, #c96442)'
                          : 'var(--text-muted, #6e6d68)',
                      boxShadow: activeRegion === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All Softwares
                  </button>
                </div>

                {/* Search Input */}
                <div
                  style={{
                    position: 'relative',
                    minWidth: 260,
                    flex: '1 1 260px',
                    maxWidth: 400,
                  }}
                >
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted, #6e6d68)',
                    }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search software, format or ERP..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 2rem 0.45rem 2rem',
                      fontSize: '0.82rem',
                      borderRadius: 8,
                      border: '1px solid var(--border-color, #dad9d4)',
                      background: 'var(--bg-secondary, #f5f4ee)',
                      color: 'var(--text-primary, #141413)',
                      outline: 'none',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 2,
                        color: 'var(--text-muted, #6e6d68)',
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Software Grid */}
              {softwareList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    background: 'var(--bg-secondary, #f5f4ee)',
                    borderRadius: 10,
                    border: '1px dashed var(--border-color, #dad9d4)',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary, #141413)' }}>
                    No matching accounting software found for "{searchQuery}".
                  </p>
                  <p
                    className="text-muted"
                    style={{ fontSize: '0.85rem', margin: '0.4rem 0 1rem' }}
                  >
                    You can import from any system using our Universal Excel / CSV importer.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveRegion('all');
                      handleSelectSoftware(getSoftwareById('universal-excel'));
                    }}
                  >
                    Use Universal Excel / CSV Importer
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  {softwareList.map((sw) => (
                    <div
                      key={sw.id}
                      onClick={() => handleSelectSoftware(sw)}
                      style={{
                        padding: '1rem',
                        borderRadius: 10,
                        border: '1px solid var(--border-color, #dad9d4)',
                        background: 'var(--card-bg, #ffffff)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary, #c96442)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color, #dad9d4)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        {/* Top Badge & Format Pill */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            className={sw.badge.bg + ' ' + sw.badge.textCol}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: 4,
                              border: '1px solid currentColor',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {sw.badge.text}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 4,
                              background: 'var(--bg-secondary, #f5f4ee)',
                              color: 'var(--text-muted, #6e6d68)',
                              border: '1px solid var(--border-color, #dad9d4)',
                            }}
                          >
                            {sw.format}
                          </span>
                        </div>

                        {/* Software Name & Tagline */}
                        <h3
                          style={{
                            margin: '0 0 0.35rem 0',
                            fontSize: '0.96rem',
                            fontWeight: 700,
                            color: 'var(--text-primary, #141413)',
                          }}
                        >
                          {sw.name}
                        </h3>
                        <p
                          className="text-muted"
                          style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            lineHeight: 1.4,
                            minHeight: '2.4em',
                          }}
                        >
                          {sw.tagline}
                        </p>
                      </div>

                      {/* Capabilities Footer */}
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border-color, #dad9d4)',
                        }}
                      >
                        {sw.capabilities.map((cap) => (
                          <span
                            key={cap}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: 4,
                              background: 'var(--bg-secondary, #f5f4ee)',
                              color: 'var(--text-primary, #141413)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {renderCapIcon(cap)}
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ============================================================ */
            /* VIEW 2: FOCUSED DETAIL VIEW FOR SELECTED SOFTWARE           */
            /* ============================================================ */
            <div>
              {/* Back to Catalog Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={handleBackToCatalog}
                  disabled={busy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary, #c96442)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    padding: '0.3rem 0',
                  }}
                >
                  <ArrowLeft size={16} /> All Softwares
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className={selectedSoftware.badge.bg + ' ' + selectedSoftware.badge.textCol}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      border: '1px solid currentColor',
                    }}
                  >
                    {selectedSoftware.badge.text}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      background: 'var(--bg-secondary, #f5f4ee)',
                      color: 'var(--text-muted, #6e6d68)',
                    }}
                  >
                    {selectedSoftware.format}
                  </span>
                </div>
              </div>

              {/* Software Title & Guide Steps */}
              <div
                style={{
                  background: 'var(--bg-secondary, #f5f4ee)',
                  borderRadius: 10,
                  padding: '1rem',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--border-color, #dad9d4)',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #141413)',
                  }}
                >
                  Export Guide: How to export data from {selectedSoftware.name}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.75rem',
                  }}
                >
                  {selectedSoftware.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--card-bg, #ffffff)',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--border-color, #dad9d4)',
                        fontSize: '0.8rem',
                        lineHeight: 1.45,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--primary, #c96442)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {idx + 1}
                      </div>
                      <span style={{ color: 'var(--text-primary, #141413)' }}>{step}</span>
                    </div>
                  ))}
                </div>

                {selectedSoftware.tips && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      marginTop: '0.85rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 6,
                      background: 'var(--note-bg, #fdfaf2)',
                      border: '1px solid var(--note-border, #ebd9b5)',
                      color: 'var(--note-text, #784d12)',
                      fontSize: '0.78rem',
                      lineHeight: 1.4,
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      <b>Pro-Tip:</b> {selectedSoftware.tips}
                    </span>
                  </div>
                )}
              </div>

              {/* Sample Template & Upload Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary, #141413)',
                    }}
                  >
                    Need a template?
                  </span>
                  {selectedSoftware.id === 'tally-prime' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDownloadSample('xml')}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      <Download size={13} /> Download Tally Masters XML Sample
                    </button>
                  ) : selectedSoftware.id === 'gst-portal' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDownloadSample('json')}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    >
                      <Download size={13} /> Download GSTR-2B JSON Sample
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownloadSample('clients')}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        <Download size={13} /> Parties Template (CSV)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownloadSample('products')}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        <Download size={13} /> Products Template (CSV)
                      </button>
                      {selectedSoftware.capabilities.includes('invoices') && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDownloadSample('invoices')}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                        >
                          <Download size={13} /> Sales Invoices Template (CSV)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragOver
                    ? '2px dashed var(--primary, #c96442)'
                    : '2px dashed var(--border-color, #dad9d4)',
                  background: dragOver
                    ? 'var(--primary-light, #f4e3da)'
                    : 'var(--bg-secondary, #f5f4ee)',
                  borderRadius: 12,
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  marginBottom: '1rem',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={selectedSoftware.accept}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  disabled={busy}
                />
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--primary, #c96442)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: '0.75rem',
                  }}
                >
                  <UploadCloud size={24} />
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--text-primary, #141413)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {loadedFile ? loadedFile.name : 'Drag and drop your export file here, or click to browse'}
                </div>
                <div
                  className="text-muted"
                  style={{
                    fontSize: '0.8rem',
                  }}
                >
                  Supports {selectedSoftware.format} ({selectedSoftware.extensions.join(', ')}). 100% offline & client-side processing.
                </div>
              </div>

              {/* Parsing Indicator */}
              {parsing && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted, #6e6d68)',
                  }}
                >
                  Analyzing file sheets and data structures…
                </div>
              )}

              {/* Parse Error Display */}
              {parseError && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    background: 'var(--danger-light, rgba(179, 69, 58, 0.12))',
                    color: 'var(--danger, #b3453a)',
                    border: '1px solid var(--danger, #b3453a)',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Live Preview Scorecard */}
              {plan && !completionStats && (
                <div
                  style={{
                    background: 'var(--bg-secondary, #f5f4ee)',
                    borderRadius: 10,
                    padding: '1.25rem',
                    border: '1px solid var(--border-color, #dad9d4)',
                    marginBottom: '1rem',
                  }}
                >
                  {/* Sheet Selector & Entity Type Row */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1rem',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px solid var(--border-color, #dad9d4)',
                    }}
                  >
                    {/* Multi-Sheet Selector */}
                    {loadedFile?.sheets && loadedFile.sheets.length > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Layers size={15} color="var(--primary, #c96442)" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Sheet:</span>
                        <select
                          value={selectedSheetIndex}
                          onChange={(e) => handleSheetSwitch(Number(e.target.value))}
                          disabled={busy}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.82rem',
                            borderRadius: 6,
                            border: '1px solid var(--border-color, #dad9d4)',
                            background: 'var(--card-bg, #ffffff)',
                            color: 'var(--text-primary, #141413)',
                          }}
                        >
                          {loadedFile.sheets.map((s, idx) => (
                            <option key={idx} value={idx}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Detected Entity Selector / Override */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Import as:</span>
                      <select
                        value={detectedEntityType}
                        onChange={(e) => handleEntityTypeSwitch(e.target.value)}
                        disabled={busy || loadedFile?.type === 'json'}
                        style={{
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.82rem',
                          borderRadius: 6,
                          border: '1px solid var(--border-color, #dad9d4)',
                          background: 'var(--card-bg, #ffffff)',
                          color: 'var(--text-primary, #141413)',
                          fontWeight: 600,
                        }}
                      >
                        <option value="clients">Parties / Clients</option>
                        <option value="products">Products / Items</option>
                        <option value="invoices">Sales Invoices</option>
                        <option value="purchases">Purchase Bills</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary Metric Scorecard Badges */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.65rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--card-bg, #ffffff)',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--border-color, #dad9d4)',
                        textAlign: 'center',
                      }}
                    >
                      <div className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        FOUND IN FILE
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--text-primary, #141413)',
                        }}
                      >
                        {plan.scorecard.total}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--card-bg, #ffffff)',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--success, #3f7d54)',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--success, #3f7d54)',
                        }}
                      >
                        READY TO ADD (NEW)
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--success, #3f7d54)',
                        }}
                      >
                        +{plan.scorecard.readyToAdd}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--card-bg, #ffffff)',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--info, #3d6a92)',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--info, #3d6a92)',
                        }}
                      >
                        FILL BLANKS (UPDATES)
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--info, #3d6a92)',
                        }}
                      >
                        {plan.scorecard.readyToUpdate}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--card-bg, #ffffff)',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid var(--border-color, #dad9d4)',
                        textAlign: 'center',
                      }}
                    >
                      <div className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                        SKIPPED DUPLICATES
                      </div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--text-muted, #6e6d68)',
                        }}
                      >
                        {plan.scorecard.skipped}
                      </div>
                    </div>

                    {plan.scorecard.errors > 0 && (
                      <div
                        style={{
                          background: 'var(--card-bg, #ffffff)',
                          padding: '0.75rem',
                          borderRadius: 8,
                          border: '1px solid var(--danger, #b3453a)',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => setShowErrors(!showErrors)}
                        title="Click to view problem rows"
                      >
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--danger, #b3453a)',
                          }}
                        >
                          PROBLEM ROWS
                        </div>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--danger, #b3453a)',
                          }}
                        >
                          {plan.scorecard.errors}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Problem Rows List (if errors exist) */}
                  {plan.errors?.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowErrors(!showErrors)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--danger, #b3453a)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: 0,
                          marginBottom: '0.35rem',
                        }}
                      >
                        <AlertTriangle size={14} />
                        {showErrors ? 'Hide' : 'Show'} {plan.errors.length} Problem Row
                        {plan.errors.length === 1 ? '' : 's'} (Skipped automatically)
                      </button>
                      {showErrors && (
                        <div
                          style={{
                            maxHeight: 140,
                            overflowY: 'auto',
                            background: 'var(--card-bg, #ffffff)',
                            border: '1px solid var(--danger, #b3453a)',
                            borderRadius: 6,
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.78rem',
                            color: 'var(--danger, #b3453a)',
                          }}
                        >
                          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                            {plan.errors.slice(0, 50).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Checkbox Options */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      padding: '0.75rem',
                      background: 'var(--card-bg, #ffffff)',
                      borderRadius: 8,
                      border: '1px solid var(--border-color, #dad9d4)',
                      marginBottom: '1rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    {(plan.entityType === 'clients' || plan.entityType === 'products') && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={updateExistingClients}
                          onChange={(e) => handleToggleUpdateClients(e.target.checked)}
                          disabled={busy}
                        />
                        <span>
                          <b>Fill in blank details for existing items</b> (non-destructive: existing values are strictly preserved, only missing phone, GSTIN, address or prices are added)
                        </span>
                      </label>
                    )}

                    {(plan.entityType === 'products' || plan.entityType === 'purchases') && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={updateStock}
                          onChange={(e) => handleToggleStock(e.target.checked)}
                          disabled={busy}
                        />
                        <span>
                          <b>Update opening inventory stock</b> (records opening stock from file into product records)
                        </span>
                      </label>
                    )}

                    {plan.entityType === 'invoices' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={takeSoldOutOfStock}
                          onChange={(e) => setTakeSoldOutOfStock(e.target.checked)}
                          disabled={busy}
                        />
                        <span>
                          <b>Take sold quantities out of inventory stock</b> (deducts items sold in these invoices from current inventory)
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Progress Bar & Status (when busy) */}
                  {busy && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div
                        style={{
                          height: 8,
                          background: 'var(--border-color, #dad9d4)',
                          borderRadius: 4,
                          overflow: 'hidden',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'var(--primary, #c96442)',
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted, #6e6d68)',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>{statusMessage}</span>
                        <span>{progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.65rem',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPlan(null);
                        setLoadedFile(null);
                      }}
                      disabled={busy}
                    >
                      Cancel / Choose Other File
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={executeMigration}
                      disabled={busy || readyCount === 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 600,
                      }}
                    >
                      <Upload size={15} />
                      {busy ? 'Importing…' : `Import ${readyCount} Record${readyCount === 1 ? '' : 's'} Now`}
                    </button>
                  </div>
                </div>
              )}

              {/* Completion Scorecard & 1-Click Navigation */}
              {completionStats && (
                <div
                  style={{
                    background: 'var(--card-bg, #ffffff)',
                    borderRadius: 12,
                    padding: '2rem 1.5rem',
                    border: '1px solid var(--success, #3f7d54)',
                    textAlign: 'center',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'rgba(63, 125, 84, 0.12)',
                      color: 'var(--success, #3f7d54)',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>
                  <h3
                    style={{
                      margin: '0 0 0.4rem 0',
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: 'var(--text-primary, #141413)',
                    }}
                  >
                    Migration Completed Successfully!
                  </h3>
                  <p
                    className="text-muted"
                    style={{
                      margin: '0 0 1.25rem 0',
                      fontSize: '0.88rem',
                    }}
                  >
                    Your records have been safely verified and imported into your local books.
                  </p>

                  {/* Summary Metric Stats */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '1.5rem',
                      marginBottom: '1.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: 'var(--success, #3f7d54)',
                        }}
                      >
                        +{completionStats.added}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        Newly Added
                      </div>
                    </div>

                    {completionStats.updated > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--info, #3d6a92)',
                          }}
                        >
                          {completionStats.updated}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                          Details Filled In
                        </div>
                      </div>
                    )}

                    {completionStats.skipped > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: 'var(--text-muted, #6e6d68)',
                          }}
                        >
                          {completionStats.skipped}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                          Existing Skipped
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1-Click Navigation Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {completionStats.entityType === 'clients' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleNavigateView('clients')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Building2 size={15} /> View Parties / Clients
                      </button>
                    )}
                    {completionStats.entityType === 'products' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleNavigateView('inventory')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Boxes size={15} /> View Products & Inventory
                      </button>
                    )}
                    {completionStats.entityType === 'invoices' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleNavigateView('dashboard')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <FileSpreadsheet size={15} /> View Sales Invoices
                      </button>
                    )}
                    {completionStats.entityType === 'purchases' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleNavigateView('purchases')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <FileText size={15} /> View Purchase Bills
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCompletionStats(null);
                        setPlan(null);
                        setLoadedFile(null);
                      }}
                    >
                      Import Another File
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleClose}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
