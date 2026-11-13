# Simplified Billing, Live Margin & Business Profitability Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement simplified walk-in billing (default "Cash Sale"), real-time margin and profit indicator on invoice creation with privacy masking, bill-wise profitability reporting, and customer retention analytics in UCNPL GST Billing Software.

**Architecture:** A standalone calculation engine in `src/utils/profitability.js` computes COGS, line-item profit, and aggregate invoice margins from products' `purchasePrice`. New Invoice UI renders a live margin badge with privacy toggle. Settings adds a default "Cash Sale" preference. Reports view introduces a "Bill Profitability" tab and enhances the "Clients" tab with customer retention metrics.

**Tech Stack:** React, JavaScript (ES modules), Node.js, Lucide icons.

**Spec:** [`docs/superpowers/specs/2026-11-12-simplified-billing-profitability-analytics-design.md`](file:///d:/billingsoftware/UCNPL-GST-Billing-Software/docs/superpowers/specs/2026-11-12-simplified-billing-profitability-analytics-design.md)

## Global Constraints
- Desktop-first offline privacy: All profitability math runs locally without network dependencies.
- Zero breaking changes to bills data or schema.
- Single-user and multi-user full compatibility.

---

### Task 1: Profitability Calculation Engine (`src/utils/profitability.js`)

**Files:**
- Create: `src/utils/profitability.js`
- Create: `scripts/profitability-test.mjs`

**Interfaces:**
- `calculateItemProfit(item, product)`: returns `{ itemRevenue, itemCost, profit, marginPercent, hasCost }`
- `calculateBillMargin(items, totalAmount, products)`: returns `{ totalCost, revenue, profit, marginPercent, hasCostData, missingProducts }`
- `calculateBillWiseProfitList(bills, products)`: returns array of bill profitability objects `{ id, invoiceNumber, invoiceDate, clientName, totalAmount, cost, profit, marginPercent }`
- `calculateCustomerInsights(bills)`: returns `{ totalCustomers, repeatCustomers, repeatRate, averageCustomerValue, dormantCustomers }`

- [ ] **Step 1: Write failing unit tests in `scripts/profitability-test.mjs`**
  - Test single item profit calculation (selling rate 100, cost 60, qty 2 -> cost 120, rev 200, profit 80, margin 40%).
  - Test bill margin with multiple items and discounts.
  - Test credit note handling and service/SAC lines (cost 0).
  - Test customer retention rate and dormant customer detection (no purchase in 60+ days).
  - Run `node scripts/profitability-test.mjs` (must fail).

- [ ] **Step 2: Implement `src/utils/profitability.js`**
  - Implement `calculateItemProfit`.
  - Implement `calculateBillMargin`.
  - Implement `calculateBillWiseProfitList`.
  - Implement `calculateCustomerInsights`.

- [ ] **Step 3: Run test to verify it passes**
  - Run `node scripts/profitability-test.mjs`.

---

### Task 2: Default "Cash Sale" Customer Preference & Toggle

**Files:**
- Modify: `src/utils/printSettings.js`
- Modify: `src/components/SettingsView.jsx`
- Modify: `src/components/InvoiceGenerator.jsx`

- [ ] **Step 1: Add `defaultCashSale` to `DEFAULT_PRINT_SETTINGS` in `src/utils/printSettings.js`**
  - Add `defaultCashSale: false`.

- [ ] **Step 2: Add toggle in `src/components/SettingsView.jsx`**
  - In section "Print & PDF" or "Company / Billing Preferences", add toggle: "Default customer to Cash Sale on new invoice".

- [ ] **Step 3: Initialize default client in `src/components/InvoiceGenerator.jsx`**
  - If `getPrintSettings().defaultCashSale` and not editing an existing bill and no draft client, initialize client name to `"Cash Sale"`.

---

### Task 3: Real-Time Live Margin Badge on New Invoice Screen

**Files:**
- Modify: `src/components/InvoiceGenerator.jsx`

- [ ] **Step 1: Compute live margin in `InvoiceGenerator.jsx`**
  - Import `calculateBillMargin` from `../utils/profitability`.
  - Compute `marginData` using `useMemo` based on `items`, invoice total, and `products`.

- [ ] **Step 2: Render Live Margin Badge with Privacy Eye Toggle**
  - In the invoice totals / footer action bar, render the margin pill.
  - Add eye icon toggle to mask/unmask (`₹ Profit (Margin %)` vs `••••••`).
  - Color-code green when positive, red when negative.

---

### Task 4: Bill-Wise Profitability Report

**Files:**
- Modify: `src/components/ReportsView.jsx`

- [ ] **Step 1: Add "profitability" tab to `ReportsView.jsx`**
  - Add button in report tabs: `Bill Profitability`.
  - Compute bill-wise profit list using `calculateBillWiseProfitList`.

- [ ] **Step 2: Render summary KPIs and data table**
  - Summary cards: Total Billed Revenue, Total Cost of Goods Sold, Total Gross Profit, Overall Margin %.
  - Interactive table: Date, Invoice #, Customer, Sale Amount, Cost, Net Profit, Margin % badge.
  - CSV / Excel Export button.

---

### Task 5: Customer Retention & Advanced Insights

**Files:**
- Modify: `src/components/ReportsView.jsx`

- [ ] **Step 1: Add customer retention metrics to "clients" tab**
  - Import `calculateCustomerInsights` from `../utils/profitability`.
  - Display KPI cards: Total Customers, Repeat Customers (count & % rate), Average Customer Spend.

- [ ] **Step 2: Add Dormant / Inactive Customers alert table**
  - Display customers who haven't ordered in 60+ days with their last purchase date and total historic spend for re-engagement.

---

### Task 6: Full Verification & Build

**Files:**
- `package.json` (add `scripts/profitability-test.mjs` to `test:unit`)
- All modified files

- [ ] **Step 1: Run profitability unit tests**
  - `node scripts/profitability-test.mjs`.

- [ ] **Step 2: Run complete unit test suite**
  - `npm run test:unit`.

- [ ] **Step 3: Run production build**
  - `npm run build`.

- [ ] **Step 4: Check running server**
  - Verify `http://127.0.0.1:47371`.
