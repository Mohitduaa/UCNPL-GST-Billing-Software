# Implementation Plan: Client Statement PDF Preview & Payment History (#157)

## Proposed Changes

### Task 1: Create Reusable `src/components/PdfPreviewModal.jsx`
- Build a lightweight modal component that displays an iframe rendering the PDF blob.
- Actions:
  - Download: downloads the Blob with the given filename.
  - Print: prints the iframe or opens print window.
  - WhatsApp: opens WhatsApp share with client phone and message.
  - Close: revokes object URL and closes modal.

### Task 2: Create Utility & Unit Test `scripts/client-payments-test.mjs`
- Create utility functions in `src/utils/clientPayments.js`:
  - `extractClientPayments(clientBills)`: flattens, calculates remaining balances, and sorts payments descending by date.
  - `getLatestClientPayment(clientBills)`: returns the most recent payment or null.
  - `formatPaymentMode(mode)`: clean display label.
- Add test suites in `scripts/client-payments-test.mjs` verifying aggregation, date sorting, and balance calculations.

### Task 3: Integrate PDF Preview & Payment History in `src/components/ClientsView.jsx`
- Replace direct `doc.save()` in `generateClientStatement` and `generateAgingReport` with `openPdfPreview(title, filename, doc, clientPhone)`.
- In client card header:
  - Show latest payment date and amount using `getLatestClientPayment`.
- In client expanded view:
  - Add tab toggle between `Invoices (${clientBills.length})` and `Payment History (${clientPayments.length})`.
  - In `Payment History` tab: render responsive table with payment date, invoice number, mode badge, reference note, amount, and receipt button.
- In `generateClientStatement`:
  - Print exact payment dates and payment modes for each installment from `bill.payments`.
- Add Record Payment (`₹`) button on unpaid bills directly in `ClientsView`.

### Task 4: Integrate PDF Preview in `src/components/PurchaseBills.jsx`
- Wire `openPdfPreview` into `generateSupplierStatement` so supplier statements also preview in-app before downloading.

### Task 5: Verification & Production Build
- Add `client-payments-test.mjs` to `package.json`'s `test:unit`.
- Run `npm run test:unit`.
- Run `npm run build`.
