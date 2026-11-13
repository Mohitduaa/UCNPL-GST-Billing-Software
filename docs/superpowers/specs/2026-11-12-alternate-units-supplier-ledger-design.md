# Multi-Unit / Alternate Unit, Supplier Ledger & Itemized Statements Design Spec

**Issue:** #148 ("Request to add some features: Multi-unit / alternate unit, separate supplier accounts, items in statement")  
**Date:** 2026-11-12  
**Status:** Approved  

---

## 1. Overview & Business Intent

In retail and wholesale trading (hardware, garments, electricals, FMCG, pharmaceuticals), products are bought and sold in multiple packaging units:
- Example: 1 Box contains 12 Pieces (`1 Box = 12 Pcs`), 1 Carton contains 24 Bottles (`1 Carton = 24 Btl`), or 1 Bag contains 50 Kg.
- Billing counter staff need the flexibility to sell either in Pieces or in Boxes. The system must automatically calculate the total price, adjust the per-unit rates, and deduct the exact converted quantity from the base inventory stock.
- Businesses also need dedicated **Supplier Accounts & Ledger Statements** (tracking what was purchased, what was paid, and the net balance owed to each supplier) and **Itemized Customer Statements** (where line items/stock descriptions appear alongside invoice numbers).

---

## 2. Key Components & Architecture

### A. Multi-Unit & Alternate Unit Data Engine (`src/utils/units.js`)
- **Product Schema Extension:**
  - `unit`: Primary / Base Unit (e.g., `Pcs`, `Nos`, `Kg`, `Mtr`)
  - `secondaryUnit`: Alternate Unit (e.g., `Box`, `Carton`, `Pack`, `Dozen`)
  - `conversionFactor`: Multiplier: number of primary units in 1 secondary unit (e.g., `12` means 1 secondary unit = 12 primary units).
  - `secondaryRate`: Optional selling price when sold by alternate unit (e.g., ₹1100 per Box instead of 12 × ₹100 = ₹1200).
- **Stock Math (`stockEffect` in `src/utils.js`):**
  - When an invoice item is sold with `selectedUnit === secondaryUnit`, the deducted stock quantity is:
    $$\text{Base Stock Qty} = \text{Invoice Qty} \times \text{conversionFactor}$$
  - When sold in primary unit, base stock deducted is simply `Invoice Qty`.

### B. Product Master UI (`InventoryView.jsx`)
- Product Form additions:
  - Checkbox: "Enable Alternate / Secondary Unit (e.g. 1 Box = 12 Pcs)".
  - When checked, shows:
    - Primary Unit dropdown (e.g. `Pcs`)
    - Alternate Unit dropdown (e.g. `Box`)
    - Conversion Factor input (e.g. `12`)
    - Optional Alternate Rate (e.g. ₹`1100`)
- Product Table & Stock Display:
  - For items with alternate unit, stock displays both units: e.g., `120 Pcs (10 Box)`.

### C. Invoice Creation with Alternate Unit Selection (`InvoiceGenerator.jsx`)
- Line Item Row:
  - If a selected product has a `secondaryUnit`, the unit cell becomes an active toggle/dropdown (`Pcs` / `Box`).
  - Switching to `Box`:
    - Rate updates to `secondaryRate` (or `rate * conversionFactor`).
    - Quantity represents Boxes.
    - Total amount calculates: `qty * boxRate`.
    - Line item stores `{ selectedUnit: 'Box', conversionFactor: 12, baseQuantity: qty * 12 }`.
  - Printed Invoice & Thermal slips show the selected unit (`2 Box` or `12 Pcs`).

### D. Itemized Customer Statement (`ClientsView.jsx`)
- In `generateClientStatement(clientName)`:
  - Checkbox toggle before generation: "Include item details / stock summary in statement".
  - When checked, the Particulars column renders both the invoice number and the itemized description:
    `INV-2026-0042`  
    `Items: Denim Jeans (2 Pcs), Cotton Shirt (1 Box)`

### E. Supplier Ledger Statement (`PurchaseBills.jsx`)
- In `PurchaseBills.jsx`, add a dedicated "Supplier Ledger & Statement" view/tab:
  - Groups all purchases and payments by Supplier Name.
  - Displays: Total Billed, Total Paid, Balance Owed.
  - Action button: **Download Supplier Statement PDF / CSV**, matching standard Indian double-entry format (Date, Purchase Bill #, Items, Debit, Credit, Balance).
