# Multi-Unit / Alternate Unit, Supplier Ledger & Itemized Statements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-unit / alternate packaging units (e.g., 1 Box = 12 Pcs) with automatic rate scaling and stock deduction, itemized customer ledger statements, and a dedicated supplier ledger statement in UCNPL GST Billing Software.

**Architecture:** A standalone packaging and unit conversion engine in `src/utils/units.js` coordinates base units, alternate units, conversion multipliers, and dual stock formatting (`120 Pcs (10 Box)`). `stockEffect` in `src/utils.js` converts secondary units to base quantities for stock deduction. `InventoryView.jsx` and `InvoiceGenerator.jsx` support selecting primary or secondary units. `ClientsView.jsx` adds item details to statement PDFs, and `PurchaseBills.jsx` adds a Supplier Ledger statement with PDF export.

**Tech Stack:** React, JavaScript (ES modules), jsPDF, Lucide icons.

**Spec:** [`docs/superpowers/specs/2026-11-12-alternate-units-supplier-ledger-design.md`](file:///d:/billingsoftware/UCNPL-GST-Billing-Software/docs/superpowers/specs/2026-11-12-alternate-units-supplier-ledger-design.md)

## Global Constraints
- Desktop-first offline privacy: Zero third-party network services.
- Single-user and multi-user full compatibility.
- Seamless backward compatibility: Products without alternate units continue functioning identically.

---

### Task 1: Alternate Unit Calculation Engine (`src/utils/units.js`)

**Files:**
- Create: `src/utils/units.js`
- Create: `scripts/units-test.mjs`

**Interfaces:**
- `toBaseQuantity(quantity, selectedUnit, product)`: returns base unit quantity (e.g., 2 Boxes with factor 12 -> 24 Pcs)
- `toSecondaryQuantity(baseQuantity, product)`: returns `{ secondaryQty, remainderBaseQty, formatted }` (e.g. 25 Pcs -> "2 Box 1 Pcs")
- `getEffectiveItemRate(rate, selectedUnit, product)`: calculates selling rate for chosen unit
- `formatDualStock(stock, product)`: returns formatted string, e.g. "120 Pcs (10 Box)"

- [ ] **Step 1: Write failing unit tests in `scripts/units-test.mjs`**
  - Test `toBaseQuantity` with primary unit vs secondary unit with conversion factor 12.
  - Test `toSecondaryQuantity` with exact match (24 -> 2 Box) and remainder (26 -> 2 Box 2 Pcs).
  - Test `getEffectiveItemRate` with primary rate vs secondary rate.
  - Test `formatDualStock` for single-unit and dual-unit products.
  - Run `node scripts/units-test.mjs` (must fail).

- [ ] **Step 2: Implement `src/utils/units.js`**
  - Implement all interfaces cleanly with null/undefined safety.

- [ ] **Step 3: Run test to verify it passes**
  - Run `node scripts/units-test.mjs`.

---

### Task 2: Product Master Alternate Units Support

**Files:**
- Modify: `src/utils/products.js`
- Modify: `src/components/InventoryView.jsx`

- [ ] **Step 1: Update `bulkRowToProduct` in `src/utils/products.js`**
  - Preserve `secondaryUnit`, `conversionFactor`, and `secondaryRate`.

- [ ] **Step 2: Add Alternate Unit controls in `InventoryView.jsx`**
  - In product modal: Checkbox "Enable Alternate Unit (e.g. 1 Box = 12 Pcs)".
  - When checked, show inputs: Secondary Unit, Conversion Factor (Pcs per Box), and Optional Secondary Rate.
  - In products table: Render dual stock if alternate unit is configured (e.g. `120 Pcs (10 Box)`).

---

### Task 3: Invoice Creation with Alternate Unit Selection & Stock Deduction

**Files:**
- Modify: `src/utils.js` (`stockEffect`)
- Modify: `src/components/InvoiceGenerator.jsx`

- [ ] **Step 1: Update `stockEffect` in `src/utils.js`**
  - Convert `it.quantity * factor` when `selectedUnit === secondaryUnit`.

- [ ] **Step 2: Add Alternate Unit selector in `InvoiceGenerator.jsx`**
  - If picked product has `secondaryUnit`, allow switching unit between primary and secondary unit.
  - Auto-adjust rate and update line item amount.

---

### Task 4: Itemized Customer Statements in `ClientsView.jsx`

**Files:**
- Modify: `src/components/ClientsView.jsx`

- [ ] **Step 1: Include item breakdown in `generateClientStatement`**
  - For each invoice in the ledger, format the items description: `Items: Shirt (x2), Jeans (x1)`.
  - Render description under the invoice number in the Particulars column in PDF.

---

### Task 5: Supplier Accounts Ledger & Statement

**Files:**
- Modify: `src/components/PurchaseBills.jsx`

- [ ] **Step 1: Add "Suppliers" view / statement in `PurchaseBills.jsx`**
  - Group purchase bills by supplier name.
  - Display Supplier Ledger Summary: Total Billed, Total Paid, Balance Owed.
  - Add "Supplier Statement PDF" generator matching Indian accounting format.

---

### Task 6: Verification & Production Build

**Files:**
- `package.json` (add `scripts/units-test.mjs` to `test:unit`)
- All modified files

- [ ] **Step 1: Run units unit tests**
  - `node scripts/units-test.mjs`.

- [ ] **Step 2: Run complete unit test suite**
  - `npm run test:unit`.

- [ ] **Step 3: Run production build**
  - `npm run build`.

- [ ] **Step 4: Check running server**
  - Verify `http://127.0.0.1:47371`.
