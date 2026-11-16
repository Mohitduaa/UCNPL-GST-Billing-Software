/**
 * Multi-Country Accounting Software Migration Catalog & Export Guides
 * 
 * Supports India & Global accounting applications:
 * - India: Tally Prime / Tally.ERP 9, Busy, Vyapar, myBillBook, Marg ERP 9+, Govt GST Portal (GSTR-2B)
 * - Global: QuickBooks (Intuit), Xero, Zoho Books, Wave Accounting, Universal Multi-Currency Excel/CSV
 * 
 * Strictly zero AI icons, sparkles, stars, magic wands, or robot imagery.
 * 100% offline and client-side processing.
 */

export const MIGRATION_SOFTWARES = [
  {
    id: 'tally-prime',
    name: 'Tally Prime / Tally.ERP 9',
    tagline: 'Import Sundry Debtors, Creditors & Stock Items with HSN & GST rates',
    region: 'india',
    format: 'XML',
    extensions: ['.xml'],
    accept: '.xml',
    badge: {
      text: 'Tally',
      bg: 'bg-amber-100 dark:bg-amber-950/40',
      textCol: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-800',
    },
    capabilities: ['clients', 'products'],
    steps: [
      'Open Tally Prime (or Tally.ERP 9) and stay on the "Gateway of Tally" home screen.',
      'Press Alt + E on your keyboard to open the Export menu, then select "Masters".',
      'In the Export Configuration screen, set File Format to "XML (Data Interchange)".',
      'Choose your export destination folder, press Ctrl + A to export, then upload the generated XML file here.',
    ],
    tips: 'Exports Sundry Debtors (Customers) and Sundry Creditors (Suppliers) with GSTIN, State & Address, plus Stock Items with HSN codes, GST rates, and opening balances.',
    templateType: 'xml',
  },
  {
    id: 'busy',
    name: 'Busy Accounting Software',
    tagline: 'Export parties, items, inventory and vouchers to Excel or CSV',
    region: 'india',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'Busy',
      bg: 'bg-blue-100 dark:bg-blue-950/40',
      textCol: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-800',
    },
    capabilities: ['clients', 'products', 'invoices', 'purchases'],
    steps: [
      'Open Busy and log into your company dataset.',
      'Navigate to Administration > Data Export/Import > Export Data.',
      'Select "Accounts" (for Clients/Parties) or "Items" (for Products/Stock).',
      'Set the export format as "MS-Excel (.xlsx)" or "CSV" and save the file to your computer.',
    ],
    tips: 'Supports standard Busy export column headers with party GST numbers, state codes, opening balance, and item purchase/sale rates.',
    templateType: 'universal',
  },
  {
    id: 'vyapar',
    name: 'Vyapar App',
    tagline: 'Multi-sheet Excel export for parties, items, sales and purchases',
    region: 'india',
    format: 'Excel (.xlsx)',
    extensions: ['.xlsx', '.xls'],
    accept: '.xlsx,.xls',
    badge: {
      text: 'Vyapar',
      bg: 'bg-red-100 dark:bg-red-950/40',
      textCol: 'text-red-800 dark:text-red-300',
      border: 'border-red-300 dark:border-red-800',
    },
    capabilities: ['clients', 'products', 'invoices', 'purchases'],
    steps: [
      'Open Vyapar on your desktop or mobile app and click on "Reports" in the left sidebar.',
      'Open the report you wish to export: "Party Statement", "Item Stock Summary", or "Sale Report".',
      'Click the Excel (XLSX) icon in the top right corner of the report screen.',
      'Save the downloaded workbook and upload it directly. Multi-sheet workbooks are automatically detected.',
    ],
    tips: 'Vyapar multi-sheet workbooks with separate sheets for parties, stock items, and sales are automatically detected and parsed.',
    templateType: 'universal',
  },
  {
    id: 'mybillbook',
    name: 'myBillBook',
    tagline: 'Import parties, stock items and sales transactions from Excel / CSV',
    region: 'india',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'myBillBook',
      bg: 'bg-emerald-100 dark:bg-emerald-950/40',
      textCol: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-800',
    },
    capabilities: ['clients', 'products', 'invoices'],
    steps: [
      'Open myBillBook and navigate to the "Parties" or "Items" section from the left navigation.',
      'Click the "Export" button (or the three-dots action menu) in the top-right corner.',
      'Select "Export to Excel (.xlsx)" or "Export as CSV".',
      'Download the exported spreadsheet and upload it directly here.',
    ],
    tips: 'Recognizes myBillBook party columns (Party Name, GST No, Mobile Number, Billing Address, State) and item columns (Item Name, Sale Price, Purchase Price, Opening Stock).',
    templateType: 'universal',
  },
  {
    id: 'marg',
    name: 'Marg ERP 9+',
    tagline: 'Export customer ledger accounts and inventory master records',
    region: 'india',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'Marg',
      bg: 'bg-indigo-100 dark:bg-indigo-950/40',
      textCol: 'text-indigo-800 dark:text-indigo-300',
      border: 'border-indigo-300 dark:border-indigo-800',
    },
    capabilities: ['clients', 'products'],
    steps: [
      'Open Marg ERP and go to the "Masters" menu on the main toolbar.',
      'Select "Marg Setups" > "Data Export" (or navigate to Reports > Management Report).',
      'Choose "Ledgers Master" or "Stock Master" and choose export format as Excel or CSV.',
      'Save the generated file to your local computer and upload it here.',
    ],
    tips: 'Safely imports pharma, FMCG, and retail party ledgers with address details, contact numbers, and product selling prices.',
    templateType: 'universal',
  },
  {
    id: 'gst-portal',
    name: 'Govt GST Portal (GSTR-2B)',
    tagline: 'Auto-generate purchase bills with ITC, HSN and supplier GSTINs directly from govt returns',
    region: 'india',
    format: 'JSON',
    extensions: ['.json'],
    accept: '.json',
    badge: {
      text: 'GST Portal',
      bg: 'bg-cyan-100 dark:bg-cyan-950/40',
      textCol: 'text-cyan-800 dark:text-cyan-300',
      border: 'border-cyan-300 dark:border-cyan-800',
    },
    capabilities: ['purchases', 'clients'],
    steps: [
      'Log into the official GST Portal at gst.gov.in and navigate to "Return Dashboard".',
      'Select the relevant Financial Year and Return Period (Month or Quarter).',
      'Under "Auto-drafted ITC Statement GSTR-2B", click the "Download" button.',
      'Click "Generate JSON File to download", wait a few moments, download the ZIP/JSON, extract the JSON file, and upload it here.',
    ],
    tips: 'Directly parses B2B purchase invoices, creates supplier party records automatically, and populates CGST, SGST, IGST, and ITC eligibility breakdown.',
    templateType: 'json',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks (Intuit)',
    tagline: 'Import Customers, Vendors, Products & Services and Invoices from QuickBooks Online or Desktop',
    region: 'global',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'QuickBooks',
      bg: 'bg-green-100 dark:bg-green-950/40',
      textCol: 'text-green-800 dark:text-green-300',
      border: 'border-green-300 dark:border-green-800',
    },
    capabilities: ['clients', 'products', 'invoices', 'purchases'],
    steps: [
      'In QuickBooks Online, click the Gear icon (Settings) in the top navigation bar.',
      'Under the "Tools" column, select "Export Data".',
      'Choose whether to export Customers, Vendors, Products and Services, or Invoices.',
      'Select the export format as "Excel" or "CSV", download the file, and upload it here.',
    ],
    tips: 'Automatically normalizes standard QuickBooks headers: Customer, Company, Phone Numbers, Email, Billing Address, GSTIN/Tax ID, Product/Service, Sales Price, and Cost.',
    templateType: 'universal',
  },
  {
    id: 'xero',
    name: 'Xero Accounting',
    tagline: 'Migrate Contacts, Inventory Items and Invoices seamlessly from Xero',
    region: 'global',
    format: 'CSV',
    extensions: ['.csv'],
    accept: '.csv',
    badge: {
      text: 'Xero',
      bg: 'bg-sky-100 dark:bg-sky-950/40',
      textCol: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-300 dark:border-sky-800',
    },
    capabilities: ['clients', 'products', 'invoices'],
    steps: [
      'In Xero, go to Contacts > All Contacts.',
      'Click the "Export" button in the upper right toolbar to download your contacts as a CSV file.',
      'For products and inventory: go to Business > Products and Services > click Export > CSV.',
      'Upload the downloaded CSV file here.',
    ],
    tips: 'Recognizes Xero column structure: ContactName, AccountNumber, EmailAddress, ItemCode, ItemName, SalesUnitPrice, and PurchasesUnitPrice.',
    templateType: 'universal',
  },
  {
    id: 'zoho-books',
    name: 'Zoho Books',
    tagline: 'Export Customers, Vendors, Items and Invoices across India, UAE, Saudi, US, UK',
    region: 'global',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'Zoho Books',
      bg: 'bg-amber-100 dark:bg-amber-950/40',
      textCol: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-800',
    },
    capabilities: ['clients', 'products', 'invoices', 'purchases'],
    steps: [
      'In Zoho Books, open the "Sales" menu and click "Customers" (or open "Items").',
      'Click the gear / hamburger action icon in the top right corner and choose "Export Customers" (or "Export Items").',
      'Select "All Customers", choose file format as "CSV" or "XLSX", and click Export.',
      'Upload the exported spreadsheet directly.',
    ],
    tips: 'Compatible with Zoho Books exports from India (GSTIN), UAE / Saudi Arabia (VAT ID), US / UK, and global editions.',
    templateType: 'universal',
  },
  {
    id: 'wave',
    name: 'Wave Accounting',
    tagline: 'Export Customers, Products & Services and Transactions for small businesses',
    region: 'global',
    format: 'CSV',
    extensions: ['.csv'],
    accept: '.csv',
    badge: {
      text: 'Wave',
      bg: 'bg-teal-100 dark:bg-teal-950/40',
      textCol: 'text-teal-800 dark:text-teal-300',
      border: 'border-teal-300 dark:border-teal-800',
    },
    capabilities: ['clients', 'products', 'invoices'],
    steps: [
      'Log into Wave Accounting and navigate to "Settings" at the bottom left.',
      'Under the "Data Management" section, select "Data Export".',
      'Choose "Export CSV" for Customers, Products, or Transactions and download the ZIP/CSV.',
      'Upload the unzipped CSV file here.',
    ],
    tips: 'Maps standard Wave columns: Customer Name, Email, Phone, Address, Product Name, and Price.',
    templateType: 'universal',
  },
  {
    id: 'universal-excel',
    name: 'Universal Excel / CSV (Any Software)',
    tagline: 'Import from any spreadsheet, ERP, custom software or custom CSV template',
    region: 'all',
    format: 'Excel / CSV',
    extensions: ['.xlsx', '.xls', '.csv'],
    accept: '.xlsx,.xls,.csv',
    badge: {
      text: 'Universal',
      bg: 'bg-violet-100 dark:bg-violet-950/40',
      textCol: 'text-violet-800 dark:text-violet-300',
      border: 'border-violet-300 dark:border-violet-800',
    },
    capabilities: ['clients', 'products', 'invoices', 'purchases'],
    steps: [
      'Download our sample spreadsheet template or prepare your own Excel/CSV file.',
      'Ensure columns have recognizable headers such as Name, Phone, Email, Address, GSTIN/Tax ID, Item Name, Price, etc.',
      'Save as .xlsx or .csv format and upload here.',
      'Review the live scorecard preview before completing your import.',
    ],
    tips: 'Works with any currency (₹ INR, $ USD, £ GBP, € EUR, AED, SAR, etc.) and auto-detects column names with flexible header aliases.',
    templateType: 'universal',
  },
];

/**
 * Filter software catalog by region and optional search query.
 * 
 * @param {'india' | 'global' | 'all'} region - Region tab to filter by.
 * @param {string} [searchQuery=''] - Optional text query to search by name, id, tagline, or capabilities.
 * @returns {Array<typeof MIGRATION_SOFTWARES[number]>} Filtered software array.
 */
export function getSoftwaresByRegion(region = 'all', searchQuery = '') {
  const normRegion = String(region || 'all').toLowerCase().trim();
  const query = String(searchQuery || '').toLowerCase().trim();

  return MIGRATION_SOFTWARES.filter(sw => {
    // Region match
    const regionMatches =
      normRegion === 'all' ||
      normRegion === 'any' ||
      sw.region === 'all' ||
      sw.region === normRegion;

    if (!regionMatches) return false;

    // Search query match
    if (!query) return true;

    const nameMatch = sw.name.toLowerCase().includes(query);
    const idMatch = sw.id.toLowerCase().includes(query);
    const taglineMatch = sw.tagline ? sw.tagline.toLowerCase().includes(query) : false;
    const formatMatch = sw.format ? sw.format.toLowerCase().includes(query) : false;
    const capMatch = Array.isArray(sw.capabilities) && sw.capabilities.some(c => c.toLowerCase().includes(query));

    return nameMatch || idMatch || taglineMatch || formatMatch || capMatch;
  });
}

/**
 * Retrieve a single software guide by unique software ID.
 * 
 * @param {string} id - Unique software ID (e.g. 'tally-prime', 'quickbooks')
 * @returns {typeof MIGRATION_SOFTWARES[number] | null} Matching software guide or null.
 */
export function getSoftwareById(id) {
  if (!id) return null;
  const match = MIGRATION_SOFTWARES.find(sw => sw.id === id);
  return match || null;
}
