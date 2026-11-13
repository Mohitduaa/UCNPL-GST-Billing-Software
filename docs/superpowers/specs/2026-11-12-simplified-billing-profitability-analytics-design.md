# Simplified Billing, Live Margin & Business Profitability Analytics Design Spec

**Issue:** #147 ("Simplified Billing Interface, Real-Time Profitability Analysis & Advanced Business Analytics")  
**Date:** 2026-11-12  
**Status:** Approved  

---

## 1. Overview & Business Intent

Small retail stores and shop counters (apparel, electronics, glass/hardware, grocery, mobile) handle fast-paced walk-in sales where:
1. Asking for every walk-in customer's name and address slows down the queue. Defaulting to "Cash Sale" cuts checkout friction in half.
2. Counter staff negotiate discounts with customers without knowing whether the discounted price covers the purchase cost. A live, privacy-masked margin badge provides instant clarity on profitability before saving the invoice.
3. Business owners need bill-wise profitability analytics to see exactly which invoices earned the highest and lowest gross margins.
4. Business owners need customer retention insights (repeat purchase rates, top customers by revenue, and dormant/inactive customers) to drive repeat business.

---

## 2. Key Components & Architecture

### A. Default Customer: "Cash Sale" Toggle
- **Configuration:** Stored in `printSettings.js` / localStorage as `defaultCashSale: boolean` (default: `false`).
- **Settings UI:** Added to Settings (Branding & Preferences / Print & PDF tab) with a toggle: *"Default new invoices to Cash Sale (Walk-in)"*.
- **Invoice Creation:** When `defaultCashSale` is true and a new invoice is created (not editing an existing invoice), `client` state initializes with:
  ```javascript
  {
    name: 'Cash Sale',
    address: '', city: '', pin: '',
    state: profile?.state || '',
    country: profile?.country || 'India',
    gstin: '', email: '', phone: '',
    isSEZ: false, isDeemedExport: false
  }
  ```
  The user can still click and edit the customer or pick any existing customer from the autocomplete dropdown anytime.

### B. Real-Time Live Margin & Profit Analysis Engine
- **Module:** `src/utils/profitability.js`
- **Functions:**
  - `calculateItemProfit(item, product)`: calculates purchase cost, selling revenue, profit, and margin % for a single line item.
  - `calculateBillMargin(items, totalAmount, products)`: calculates total cost of goods sold (COGS), total revenue, net gross profit (₹), and margin % (`profit / revenue * 100`).
  - Gracefully ignores service items (`isServiceProduct`), charges, and SAC lines (`99...`).
  - Missing purchase price handling: identifies products without a recorded purchase price and computes margin based on available costed items.
- **Invoice UI Component:** In `InvoiceGenerator.jsx`, a discreet live margin pill is displayed right next to the Grand Total with:
  - Formatted Profit (₹) and Margin (%).
  - An eye toggle (Show/Hide) with privacy masking (`••••••`) so shop cashiers can keep customer-facing screens private.

### C. Bill-Wise Profitability Report
- **Module & View:** Added as a tab `"profitability"` in `ReportsView.jsx`.
- **Metrics Bar:**
  - Total Billed Sales (₹)
  - Total Cost of Goods Sold (₹)
  - Total Gross Profit (₹)
  - Overall Margin %
- **Bill-wise Table:**
  - Date
  - Invoice #
  - Customer Name
  - Items Count
  - Total Sale Amount
  - Cost of Goods Sold (COGS)
  - Gross Profit (₹)
  - Margin % (color-coded badge: Green ≥ 20%, Amber 5-20%, Red < 5%)
- **Export:** Export to CSV / Excel button.

### D. Advanced Customer Insights Analytics
- **Location:** Enhanced `clients` tab in `ReportsView.jsx`.
- **New Metrics:**
  - Total Customer Count
  - Repeat Customer Count & Repeat Rate % (`repeatCount / totalCount * 100`)
  - Average Order Value per Customer
  - Dormant Customers (Haven't purchased in 60+ days)
- **Top Customers by Profit & Revenue**: Table sorting and visualization.

---

## 3. Data Integrity & Privacy
- Zero telemetry: All calculations are strictly local in-browser / Node.js.
- Backward compatibility: Zero changes to invoice schema or JSON structure. Existing bills load without modification.
- Single-user & Multi-user compatible.
