# Global Data Migration & Import Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive, country-aware Data Migration & Import Hub enabling seamless 1-click data import from 11 top Indian & Global accounting systems (Tally Prime, Busy, Vyapar, myBillBook, Marg ERP, Govt GST Portal, QuickBooks, Xero, Zoho Books, Wave, and Universal Excel/CSV) with step-by-step guides, live preview scorecards, and non-destructive conflict handling.

**Architecture:** A centralized `MigrationHub` modal with smart country auto-detection (`India` vs `Global / International`) backed by a structured software catalog (`src/utils/migrationGuides.js`) and normalization engine (`src/utils/migrationParsers.js`) that pipes parsed data safely into existing clients, products, purchases, and bills stores without server dependencies or AI icons.

**Tech Stack:** React 18, Vite, Lucide Icons (Strictly business icons: `ArrowRightLeft`, `UploadCloud`, `FileSpreadsheet`, `Building2`, `Boxes`, `FileText`, `CheckCircle2`), client-side XML/XLSX/CSV/JSON parsers.

**Spec:** [docs/superpowers/specs/2026-11-16-data-migration-hub-design.md](file:///d:/billingsoftware/Free-GST-Billing-Software/docs/superpowers/specs/2026-11-16-data-migration-hub-design.md)

## Global Constraints

- Strictly zero AI icons, sparkles, stars, magic wands, or robot imagery; use only clean professional business accounting badges and standard Lucide icons.
- 100% offline and client-side processing; no user data leaves the machine.
- Safe and non-destructive: existing invoice numbers are never overwritten (`overwrite: false`); existing client details are filled only for blank fields; product stock updates are opt-in.
- Multi-country awareness: automatically detects `profile.country` to default to `India` or `Global / International` tab while allowing instant toggling to `All Softwares`.

---

### Task 1: Software Catalog & Migration Guides (`src/utils/migrationGuides.js`)

**Files:**
- Create: `src/utils/migrationGuides.js`
- Test: `scripts/migration-guides-test.mjs`

**Interfaces:**
- Produces: `MIGRATION_SOFTWARES`: array of 11 software definitions.
- Produces: `getSoftwaresByRegion(region, searchQuery)`: returns filtered software list.
- Produces: `getSoftwareById(id)`: returns a single software guide object.

- [ ] **Step 1: Write the test script for migration guides**

Create `scripts/migration-guides-test.mjs`:
```javascript
import assert from 'node:assert/strict';
import { MIGRATION_SOFTWARES, getSoftwaresByRegion, getSoftwareById } from '../src/utils/migrationGuides.js';

console.log('Testing migration guides catalog...');

assert.equal(MIGRATION_SOFTWARES.length, 11, 'Must have exactly 11 software definitions');

// Check required fields for every software
for (const sw of MIGRATION_SOFTWARES) {
  assert.ok(sw.id, `Software missing id: ${JSON.stringify(sw)}`);
  assert.ok(sw.name, `Software ${sw.id} missing name`);
  assert.ok(['india', 'global', 'all'].includes(sw.region), `Software ${sw.id} invalid region: ${sw.region}`);
  assert.ok(Array.isArray(sw.extensions) && sw.extensions.length > 0, `Software ${sw.id} missing extensions`);
  assert.ok(Array.isArray(sw.steps) && sw.steps.length >= 3, `Software ${sw.id} must have at least 3 steps`);
  assert.ok(Array.isArray(sw.capabilities) && sw.capabilities.length > 0, `Software ${sw.id} missing capabilities`);
}

// Test filtering by region
const indiaList = getSoftwaresByRegion('india');
assert.ok(indiaList.some(s => s.id === 'tally-prime'), 'India list must contain Tally Prime');
assert.ok(indiaList.some(s => s.id === 'busy'), 'India list must contain Busy');
assert.ok(indiaList.some(s => s.id === 'vyapar'), 'India list must contain Vyapar');
assert.ok(indiaList.some(s => s.id === 'mybillbook'), 'India list must contain myBillBook');

const globalList = getSoftwaresByRegion('global');
assert.ok(globalList.some(s => s.id === 'quickbooks'), 'Global list must contain QuickBooks');
assert.ok(globalList.some(s => s.id === 'xero'), 'Global list must contain Xero');
assert.ok(globalList.some(s => s.id === 'wave'), 'Global list must contain Wave');

// Test search filter
const searchResult = getSoftwaresByRegion('all', 'tally');
assert.equal(searchResult.length, 1);
assert.equal(searchResult[0].id, 'tally-prime');

console.log('✓ Migration guides catalog passed all checks!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/migration-guides-test.mjs`  
Expected: FAIL with module not found `migrationGuides.js`.

- [ ] **Step 3: Implement `src/utils/migrationGuides.js`**

Create `src/utils/migrationGuides.js` with all 11 software definitions, exact menu export steps, color badges, accepted extensions, and query helper functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/migration-guides-test.mjs`  
Expected: PASS with "✓ Migration guides catalog passed all checks!".

- [ ] **Step 5: Commit**

```bash
git add src/utils/migrationGuides.js scripts/migration-guides-test.mjs
git commit -m "feat(migration): add multi-country software catalog and export guides"
```

---

### Task 2: Header Aliases & Normalization Engine (`src/utils/migrationParsers.js`)

**Files:**
- Create: `src/utils/migrationParsers.js`
- Test: `scripts/migration-parsers-test.mjs`

**Interfaces:**
- Consumes: `rowsToRecords`, `parseCsv`, `toNum` from `src/utils/bulkCsv.js`
- Produces: `normalizeMigrationRows(rows, softwareId, entityType)`: maps raw rows from QuickBooks, Xero, Busy, myBillBook, Wave, Zoho Books into canonical Client, Product, or Invoice records.

- [ ] **Step 1: Write the test script for normalization parsers**

Create `scripts/migration-parsers-test.mjs`:
```javascript
import assert from 'node:assert/strict';
import { normalizeMigrationRows } from '../src/utils/migrationParsers.js';

console.log('Testing migration parser normalization...');

// 1. QuickBooks Customers export format
const qbCustomers = [
  ['Customer', 'Company', 'Phone Numbers', 'Email', 'Billing Address', 'GSTIN'],
  ['Acme Traders', 'Acme Ltd', '9876543210', 'info@acme.com', '123 Market St, Mumbai', '27AABCA1234A1Z5'],
];
const qbResult = normalizeMigrationRows(qbCustomers, 'quickbooks', 'clients');
assert.equal(qbResult.records.length, 1);
assert.equal(qbResult.records[0].name, 'Acme Traders');
assert.equal(qbResult.records[0].phone, '9876543210');
assert.equal(qbResult.records[0].gstin, '27AABCA1234A1Z5');

// 2. Xero Items export format
const xeroItems = [
  ['ItemCode', 'ItemName', 'SalesUnitPrice', 'PurchasesUnitPrice', 'TaxRate'],
  ['ITM001', 'Cotton Shirt', '999.00', '450.00', '5%'],
];
const xeroResult = normalizeMigrationRows(xeroItems, 'xero', 'products');
assert.equal(xeroResult.records.length, 1);
assert.equal(xeroResult.records[0].name, 'Cotton Shirt');
assert.equal(xeroResult.records[0].sellingPrice, '999.00');

// 3. myBillBook Parties export format
const myBillBookParties = [
  ['Party Name', 'GST No', 'Mobile Number', 'Billing Address', 'State'],
  ['Rajesh Enterprises', '07AAAAA0000A1Z5', '9811122233', 'Connaught Place', 'Delhi'],
];
const mbbResult = normalizeMigrationRows(myBillBookParties, 'mybillbook', 'clients');
assert.equal(mbbResult.records.length, 1);
assert.equal(mbbResult.records[0].name, 'Rajesh Enterprises');
assert.equal(mbbResult.records[0].gstin, '07AAAAA0000A1Z5');
assert.equal(mbbResult.records[0].state, 'Delhi');

console.log('✓ Migration parser normalization passed all checks!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/migration-parsers-test.mjs`  
Expected: FAIL with module not found `migrationParsers.js`.

- [ ] **Step 3: Implement `src/utils/migrationParsers.js`**

Implement column aliases for all supported international and domestic accounting software, mapping raw rows cleanly into canonical fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/migration-parsers-test.mjs`  
Expected: PASS with "✓ Migration parser normalization passed all checks!".

- [ ] **Step 5: Commit**

```bash
git add src/utils/migrationParsers.js scripts/migration-parsers-test.mjs
git commit -m "feat(migration): add header aliases and data normalization engine"
```

---

### Task 3: MigrationHub Component (`src/components/MigrationHub.jsx`)

**Files:**
- Create: `src/components/MigrationHub.jsx`

**Interfaces:**
- Consumes:
  - `MIGRATION_SOFTWARES`, `getSoftwaresByRegion` from `src/utils/migrationGuides.js`
  - `fileToSheets`, `bestSheet` from `src/utils/importFile.js`
  - `normalizeMigrationRows` from `src/utils/migrationParsers.js`
  - `getProfile`, `getAllBills`, `saveBill`, `getAllProducts`, `saveProduct`, `getAllClients`, `saveClient`, `getAllPurchases`, `savePurchase` from `src/store.js`
- Produces: `<MigrationHub isOpen={open} onClose={() => setOpen(false)} onDone={refreshData} />`

- [ ] **Step 1: Implement `MigrationHub.jsx` UI and state management**
  - Region filter tabs (`India`, `Global / International`, `All Softwares`) with auto-detect from active business profile country.
  - Search filter input with clear button.
  - Grid of software cards with branded badges, tags, and click handler.
  - Software detail view showing ordered step-by-step export guide, template download button, drag-and-drop file upload zone.
  - Multi-sheet selection dropdown when `.xlsx` has several sheets.
  - Live scorecard displaying total found, new clients, updated clients, products, invoices, and skipped duplicates.
  - Execution handler with real-time progress indicator, toast notifications, and post-import action buttons.

- [ ] **Step 2: Verify component syntax and imports with a dry build**

Run: `npm run build`  
Expected: PASS without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MigrationHub.jsx
git commit -m "feat(migration): create unified MigrationHub modal component"
```

---

### Task 4: Entry Points Integration (Dashboard, Getting Started & Navigation)

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/Sidebar.jsx` (or Navigation)
- Modify: `src/components/Clients.jsx` and `src/components/Products.jsx` (cross-link helper)

**Interfaces:**
- Consumes: `<MigrationHub />` component

- [ ] **Step 1: Update `Dashboard.jsx`**
  - Replace/augment `BulkCsvImport` button in header with `Import & Migrate Data` (using `ArrowRightLeft` icon).
  - Add Getting Started migration banner for accounts with 0 invoices.
  - Wire state `[migrationOpen, setMigrationOpen]` to render `<MigrationHub />`.

- [ ] **Step 2: Update Sidebar Navigation**
  - Add `Import & Migrate` menu item with `ArrowRightLeft` icon to open the Migration Hub from anywhere in the app.

- [ ] **Step 3: Update `Clients.jsx` and `Products.jsx` import modals**
  - Add friendly link: *"Looking to import from Tally, Busy, Vyapar, or QuickBooks? Open Migration Hub"*.

- [ ] **Step 4: Run build to verify clean integration**

Run: `npm run build`  
Expected: PASS with 0 build errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.jsx src/components/Sidebar.jsx src/components/Clients.jsx src/components/Products.jsx
git commit -m "feat(migration): integrate MigrationHub into Dashboard, Sidebar and list views"
```

---

### Task 5: End-to-End Test Suite & Verification

**Files:**
- Test scripts: `scripts/migration-guides-test.mjs`, `scripts/migration-parsers-test.mjs`, `scripts/tally-xml-test.mjs`, `scripts/xlsx-read-test.mjs`, `scripts/csv-test.mjs`.

- [ ] **Step 1: Execute all unit test suites**

Run:
```powershell
node scripts/migration-guides-test.mjs
node scripts/migration-parsers-test.mjs
node scripts/tally-xml-test.mjs
node scripts/xlsx-read-test.mjs
node scripts/csv-test.mjs
```
Expected: All suites exit with code 0.

- [ ] **Step 2: Execute full production Vite build**

Run: `npm run build`  
Expected: Exit code 0, complete bundle generated in `dist/`.

- [ ] **Step 3: Commit final plan verification**

```bash
git add -A
git commit -m "chore(migration): complete and verify migration hub test suite"
```
