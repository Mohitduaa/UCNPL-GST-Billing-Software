# Global Data Migration & Import Hub Design Spec

**Feature:** Global Data Migration & Import Hub (India & 22+ Countries)  
**Date:** 2026-11-16  
**Status:** Approved  

---

## 1. Overview & Business Intent

When businesses transition to UCNPL GST Billing Software from other accounting or invoicing systems, their primary concern is migrating existing data (Parties/Clients, Stock Items/Products with HSN/tax rates, Opening Stock, and Historical Invoices/Bills).

Currently, the software supports CSV import/export, Excel `.xlsx` multi-sheet reading (such as Vyapar), Tally XML masters, and GSTR-2B JSON import. However, these features are hidden behind plain, generic "CSV import / export" buttons and microcopy. Customers are often unaware that their existing software exports can be directly imported without manual data re-entry.

Furthermore, because UCNPL Billing is designed for **India and 22+ countries** (multi-currency, multi-region tax regimes across UAE, Saudi Arabia, UK, USA, Canada, Australia, Singapore, South Africa, etc.), the migration interface must cater to both **Indian market leaders** (Tally Prime, Busy, Vyapar, myBillBook, Marg ERP, Govt GST Portal) and **Global market leaders** (QuickBooks Intuit, Xero, Zoho Books, Wave Accounting, and Universal Multi-Currency Excel/CSV).

### Design Mandates:
1. **Zero AI Icons / Buzzwords:** Strictly professional business and accounting iconography (clean Lucide icons such as `ArrowRightLeft`, `UploadCloud`, `FileSpreadsheet`, `Building2`, `Boxes`, `FileText`, `CheckCircle2`, and branded software badges). No sparkles, stars, magic wands, or robot icons.
2. **100% Offline & Private:** All file reading, decoding, and parsing occurs strictly inside the user's browser/local runtime. No data is sent to external servers or cloud services.
3. **Safe & Non-Destructive:** Existing invoice numbers are never overwritten. Existing clients are updated only for blank fields (e.g., adding a phone or GSTIN without modifying existing names or history).

---

## 2. Key Components & Architecture

### A. Entry Points & User Discovery

1. **Dashboard Header Action:**
   - The generic `CSV import / export` button is upgraded to **`Import & Migrate Data`** with an `ArrowRightLeft` icon.
   - Clicking it opens the unified `MigrationHub` modal.
2. **Dashboard Getting Started Card (New Accounts / 0 Invoices):**
   - For accounts in setup mode, an onboarding banner is displayed:
     > *"Switching from another software? Import your Parties, Products & Invoices in 2 minutes from Tally, Busy, Vyapar, QuickBooks, Xero & more."*  
     > Button: `[ Open Migration Hub ]`
3. **Sidebar Navigation (Left Menu):**
   - A dedicated **`Import & Migrate`** navigation tab is added with an `ArrowRightLeft` icon, enabling 1-click access from any view.
4. **Cross-Links in Existing Modals:**
   - In `Clients.jsx` and `Products.jsx` import windows, a helper banner links directly: *"Migrating from Tally, Busy, Vyapar, or QuickBooks? Use the Migration Hub for step-by-step guides."*

---

## 3. Supported Software Catalog (`src/utils/migrationGuides.js`)

The catalog contains structured metadata for each supported software, including country/region classification, supported entities, accepted file extensions, badge themes, and exact step-by-step export instructions.

### 🇮🇳 India Software Category:
1. **Tally Prime & Tally.ERP 9**
   - **Supported:** Clients (Sundry Debtors/Creditors), Products (Stock Items with HSN, GST rate, unit, opening stock).
   - **File format:** `.xml` (Masters)
   - **Steps:**
     1. Open Tally Prime and stay on `Gateway of Tally`.
     2. Press `Alt + E` (Export) on keyboard and choose `Masters`.
     3. In File Format, select `XML (Data Interchange)`.
     4. Export the file to your computer and upload here.
2. **Busy Accounting Software**
   - **Supported:** Parties (Clients), Items (Products), Sales & Purchases.
   - **File format:** `.xlsx`, `.csv`
   - **Steps:**
     1. Open Busy > Go to `Administration` > `Data Export/Import`.
     2. Select `Export Data` > Choose `Accounts` or `Items`.
     3. Select Format as `MS-Excel (.xlsx)` or `CSV` and export.
3. **Vyapar App**
   - **Supported:** Sales Invoices, Purchase Bills, Parties, Items.
   - **File format:** `.xlsx` (multi-sheet workbook)
   - **Steps:**
     1. Open Vyapar > Navigate to `Reports`.
     2. Open `Party Statement`, `Item Stock Summary`, or `Sale Report`.
     3. Click the Excel icon in the top right corner to download `.xlsx`.
4. **myBillBook**
   - **Supported:** Parties, Items / Stock, Invoices.
   - **File format:** `.xlsx`, `.csv`
   - **Steps:**
     1. Open myBillBook > Go to `Parties` or `Items`.
     2. Click on the 3-dots or `Export` button in the top right.
     3. Select `Export to Excel (.xlsx)` or `CSV` and save.
5. **Marg ERP 9+**
   - **Supported:** Ledger / Parties, Stock Items.
   - **File format:** `.xlsx`, `.csv`
   - **Steps:**
     1. Open Marg ERP > Go to `Masters` > `Marg Setups` > `Data Export`.
     2. Choose Ledgers or Stock Master and export to Excel/CSV.
6. **Govt GST Portal (GSTR-2B)**
   - **Supported:** Auto-generate Purchase Bills with ITC, HSN, Tax rates, and supplier GSTIN.
   - **File format:** `.json`
   - **Steps:**
     1. Log in to `gst.gov.in` > Go to `Return Dashboard`.
     2. Select the Financial Year and Month > Under `GSTR-2B` click `Download`.
     3. Click `Generate JSON File to download` and upload here.

### 🌍 Global / International Software Category (22+ Countries):
7. **QuickBooks (Intuit)**
   - **Supported:** Customers, Vendors, Products & Services, Invoices.
   - **File format:** `.xlsx`, `.csv`
   - **Steps:**
     1. In QuickBooks, go to `Settings (Gear icon)` > `Export Data`.
     2. Choose `Customers`, `Vendors`, `Products and Services`, or `Invoices`.
     3. Select `Excel` or `CSV` format and download.
8. **Xero**
   - **Supported:** Contacts (Customers/Suppliers), Inventory Items, Invoices.
   - **File format:** `.csv`
   - **Steps:**
     1. In Xero, go to `Contacts` > `All Contacts`.
     2. Click `Export` at the top right to download CSV.
     3. For items: go to `Business` > `Products and Services` > `Export` > `CSV`.
9. **Zoho Books (Global & Middle East)**
   - **Supported:** Customers, Vendors, Items, Invoices.
   - **File format:** `.xlsx`, `.csv`
   - **Steps:**
     1. Go to `Sales` > `Customers` (or `Items`).
     2. Click the Hamburger (gear) icon in the top right > `Export Customers`.
     3. Select format as `CSV` or `XLSX` and export.
10. **Wave Accounting**
    - **Supported:** Customers, Products & Services, Invoices.
    - **File format:** `.csv`
    - **Steps:**
      1. Go to `Settings` > `Data Export`.
      2. Choose `Export CSV` for Customers, Products, or Transactions.
11. **Universal Multi-Currency Excel / CSV**
    - **Supported:** Full Invoices, Purchases, Clients, Products with any currency ($ USD, £ GBP, € EUR, AED, SAR, ₹ INR).
    - **File format:** `.csv`, `.xlsx`
    - **Steps:**
      1. Click `Download Sample Template` button.
      2. Fill in your existing business data and save as CSV or Excel.
      3. Upload the completed file.

---

## 4. UI Flow & Component Specification

### Component: `src/components/MigrationHub.jsx`

#### 1. Header & Region Tabs:
- Title: `Data Migration & Import Hub`
- Subtitle: `Import parties, inventory, and historical invoices from your existing software`
- Region Filter Tabs:
  - `[ 🇮🇳 India ]`
  - `[ 🌍 Global / International ]`
  - `[ All Softwares ]`
- **Smart Country Auto-Selection:**
  - On mount, inspects `profile.country`.
  - If `profile.country === 'India'`, default active tab is `India`.
  - If `profile.country` is any other country (e.g. UAE, Saudi Arabia, UK, USA), default active tab is `Global / International`.
  - User can freely toggle between tabs or click `All Softwares`.

#### 2. Search & Software Grid:
- Search input: *"Search software (e.g. Tally, QuickBooks, Excel)..."*
- Responsive Grid of Software Cards:
  - Software badge/logo with distinct color accents.
  - Software Name (e.g. `Tally Prime`, `QuickBooks`).
  - Format pill: `XML`, `XLSX`, `CSV`, `JSON`.
  - Capabilities chips: `[Clients]` `[Products]` `[Invoices]`.
  - Quick action: `Select →`.

#### 3. Step-by-Step Interactive Detail View:
When a software card is clicked, the modal switches to the focused migration wizard:
- Top bar: `← Back to all softwares`
- Software Title + Tagline.
- **Export Guide:** Ordered 3-4 steps with key shortcuts highlighted (`Alt + E`, `Gateway of Tally`, etc.).
- **Drag & Drop Upload Zone:**
  - Accepts specified file extensions.
  - Clear label: *"Drag your file here or Browse"*.
  - Template download button: `[ Download Template / Sample ]`.

#### 4. Live Scorecard & Preview:
Upon file selection:
- Client-side parser runs immediately (100% offline).
- If workbook has multiple sheets, sheet selector dropdown is shown, defaulting to the sheet with the most records.
- Scorecard displays:
  - 👥 **Parties / Clients:** `X ready to add` (Y already saved with details auto-merged).
  - 📦 **Products / Items:** `X ready to add` (with HSN & tax rates detected).
  - 📄 **Invoices / Bills:** `X invoices ready` (existing invoice numbers safely skipped).
  - ⚠️ **Warnings / Errors (if any):** Number of invalid rows with expandable details.
- Configuration checkboxes:
  - `[✓] Update blank details for existing clients`
  - `[✓] Add opening stock quantities to products`
  - `[ ] Take sold quantities out of product stock (for old invoices)`

#### 5. Execution & Feedback:
- Action buttons: `[ Cancel / Choose Different File ]` and `[ Start Import (X items) ]`
- While executing: Button shows progress `Importing (45/120)...`
- Completion: Success toast + green scorecard + 1-click links:
  - `[ View Clients ]` `[ View Products ]` `[ View Dashboard ]` `[ Close ]`.

---

## 5. Parsers & Data Normalization Engine

### Helper: `src/utils/migrationParsers.js`

1. **Header Alias Normalization:**
   Expands canonical column mapping in `bulkCsv.js` and `listCsv.js` to recognize common export formats:
   - **QuickBooks:** `Customer`, `Company`, `Phone Numbers`, `Billing Address`, `Product/Service`, `Sales Price`, `Cost`, `Qty On Hand`.
   - **Xero:** `ContactName`, `AccountNumber`, `EmailAddress`, `ItemCode`, `ItemName`, `SalesUnitPrice`, `PurchasesUnitPrice`.
   - **myBillBook / Busy:** `Party Name`, `GST No`, `Mobile Number`, `Item Name`, `Sale Price`, `Purchase Price`, `Opening Stock`, `Item Code`.
   - **Wave:** `Customer Name`, `Product Name`, `Price`.
2. **Tally Masters XML Parser:**
   Reuses `src/utils/tallyXml.js` (`tallyMastersToRows`) which parses:
   - Ledgers under `Sundry Debtors` & `Sundry Creditors` -> Clients with GSTIN, State, Country, Address.
   - Stock items -> Products with HSN Code, Tax Rate, Unit of Measure, Opening Stock.
3. **Govt GSTR-2B JSON Parser:**
   Reuses `src/utils/gstrImport.js` (`parseGstrJsonToPurchases`) to auto-extract purchase bills, supplier GSTINs, invoice numbers, tax values, and ITC eligibility.

---

## 6. Safety & Conflict Handling Rules

| Entity | Conflict Scenario | Software Action |
|---|---|---|
| **Invoices** | Invoice # already exists in database | **SKIP.** Overwrite is strictly prevented (`overwrite: false`) to avoid corrupting tax returns or existing records. |
| **Clients** | Client name or GSTIN already exists | **MERGE BLANKS ONLY.** Existing address/phone/state are preserved; any missing field present in the imported file is safely filled in. |
| **Products** | Product name matches an existing item | **PRESERVE.** Item is not duplicated. If "Update opening stock" is checked, stock adjustment is applied. |
| **Invalid Rows** | Row missing essential name or corrupted | **ISOLATE.** Stored in `errors` array, displayed to user with row number, without aborting valid rows. |

---

## 7. Verification & Testing Plan

1. **Automated Unit Tests:**
   - Run `node scripts/tally-xml-test.mjs` to ensure Tally XML parsing remains 100% compliant.
   - Run `node scripts/xlsx-read-test.mjs` to verify multi-sheet Excel decoding.
   - Run `node scripts/csv-test.mjs` to test CSV parsing and header normalization across QuickBooks, Xero, Vyapar, and myBillBook formats.
2. **Production Bundle Verification:**
   - Execute `npm run build` to confirm zero Vite compilation errors, no broken imports, and clean bundle output.
3. **Manual Flow Testing:**
   - Open Dashboard > Click "Import & Migrate Data" > Verify region filter auto-detects profile country.
   - Verify all 11 software cards render with accurate badges and guides.
   - Test uploading sample files (XML, XLSX, CSV, JSON) and confirm live scorecard accuracy.
