# Changelog

All notable changes to **UCNPL GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.10.84] - 2026-11-07

### How to update

**Current version:** 1.10.83  →  **New version:** 1.10.84

#### If the in-app Update button works for you (1.10.73 and later)
1. Open the app and click **Update to v1.10.84** in the menu, or
   **Settings → Updates → Update Now**.
2. Wait about a minute, then reload the page.

#### On 1.10.72 or older
Use the launcher: **More options → Update to the latest version**, then
**Open App**.

#### If that does not work (or you are unsure)
1. Download `UCNPL-GST-Billing.zip` from the
   [Releases page](https://github.com/Mohitduaa/UCNPL-GST-Billing-Software/releases/latest).
2. Close the app (Control Panel → **Stop Server**, or the launcher's
   **More options → Stop the app**).
3. **Right-click the ZIP → Extract All.** Do not open anything while still inside the ZIP.
4. Extract over your existing UCNPL Billing folder, replacing files when asked.
5. Double-click **UCNPL GST Billing - WINDOWS**.

#### Mac
Use the **Update** button in the app. **Never drag the new folder over the
old one on a Mac**: Finder's Replace swaps the whole folder, including
`_system/data` with your invoices. Step by step:
[Updating on a Mac](https://ucnpl.com/free-gst-software-documentation/update.html#mac).

#### Linux / NAS
Run `update-unix.sh` from the `_system` folder, or extract the new ZIP over
the old folder. Restart the app afterwards. New on Linux: the `.deb` and the
AppImage (see *Added*).

#### New: install it like other Windows programs (optional)
You do not need this to update - the steps above are enough. If you want the
app as a normal program with its own window: download
`UCNPL-GST-Billing-Setup.exe` from the
[Releases page](https://github.com/Mohitduaa/UCNPL-GST-Billing-Software/releases/latest)
and run it (Windows may say "Windows protected your PC": click **More info**,
then **Run anyway**). It finds your current copy and asks: keep using your
books where they are, or copy them to `C:\Users\<your name>\UCNPL Billing`.
Your current folder is never changed or deleted. Later updates come from the
app's **Update Now**, with no download by hand.

Your invoices, clients, products and settings are never touched by an update;
a backup is made first.

### Added
- **A Windows Setup program** (`UCNPL-GST-Billing-Setup.exe`): installs
  like other software (Start menu, Desktop icon, optional start with Windows,
  Settings → Apps to remove; no administrator password), opens in a window of
  its own - a real program window with its own taskbar icon (pin it), which
  opens full screen the first time and then remembers its size and place. Closing it with X keeps the app running near
  the clock (click the icon to open it again; right-click for Check for
  updates, Open books folder, Make a backup now and Quit), and with "Open when
  Windows starts" it waits there quietly. Update notices show there too. If
  the app ever stops, the window starts it again by itself behind its start
  screen (logo and a moving bar), never an error page. Right-click its
  taskbar icon for New Invoice, Dashboard, Clients and Reports. Setup installs
  Microsoft's WebView2 engine if your PC does not have it (needs the
  internet; without it the app opens in Edge's app window as before). It
  updates itself from **Update Now** with that window open, no reinstalling
  and no restart. It asks
  where your books go and finds an earlier copy: keep using it where it is, or
  copy it to `C:\Users\<your name>\UCNPL Billing` (every file checked; the old folder
  is never changed, its icons are moved to a backup folder). Not signed yet:
  Windows SmartScreen asks once (More info → Run anyway).
- **Linux packages** (Ubuntu, Linux Mint, Debian and others): install
  `ucnpl-billing_1.10.84_amd64.deb` like any other program (double-click,
  or `sudo apt install ./ucnpl-billing_1.10.84_amd64.deb`), or use
  `UCNPL-GST-Billing-Linux-x86_64.AppImage` on any 64-bit Linux (right-click ->
  Properties -> Permissions -> *Allow executing file as program*, then
  double-click). The app opens in your browser; your books are kept in
  `~/.local/share/ucnpl-billing-data`, and removing the program keeps them.
  An earlier ZIP copy is left exactly as it was. The ZIP still works on Linux
  as before.
- **One copy of the server per set of books.** Two copies started on the same
  data folder (two launchers, two icons) used to both write the same files;
  the second now does not start and the running one opens instead.
- **Import from Vyapar, Tally and Excel** (#130, #131). Clients and Products
  import take a CSV, an Excel `.xlsx` (a *Sheet* list appears when the file has
  several) or Tally's masters export (`.xml`, *Gateway of Tally → Export →
  Masters*): Sundry Debtors and Creditors become clients, stock items become
  products with HSN, GST, unit and prices. The invoice and purchase import take
  `.xlsx` too, and a Vyapar Sale Report brings in what was received as payments.
- **Importing products again fills in the blanks** (#134): a product already
  saved gets the details it is missing (HSN, unit, prices, GST...) from the
  file; nothing already filled in is changed.
- **Size billing for glass, mirror and flex shops** (#140). Turn on *Settings →
  Features → Size billing (Sq.ft)*, pick the unit Sq.ft on a row and type
  Length and Width in inches, the pieces and 3 or 6 inch rounding: the square
  feet and amount are worked out (25 x 30, 2 pcs, 6 inch, ₹50 = 12.50 sq.ft,
  ₹625). *Type amount* bills a fixed amount. The invoice prints Size and SQFT
  columns.
- **Your own fields on invoices** (#126): under *Order, dispatch & reference
  details*, *Add a field* adds a box you name (R SPH, patient name, job card).
  Filled ones print; the names stay for your next invoice.
- **Unit NA for services** (#143): no quantity, the amount is the rate;
  GSTR-1 reports it with unit NA and quantity 0.
- **Customer phone box** (#129): type a phone number at the top of the invoice
  to fill in that customer, or add a new one with just a name. Clients shows
  visits and the last visit.
- **GSTR-1 file: exports, nil-rated / exempt and deemed exports** (Tables 6A,
  8 and DE), bills of supply included, and GSTR-3B 3.1(c)/(e) from the same lines.
- **Income tax for tax year 2026-27**, with a year picker (2025-26 kept).
- **Profit & Loss counts the cost of the goods sold** (#146): quantity sold ×
  the product's purchase price, as its own line, then Gross Profit. Items with
  no purchase price are named so you can fill it in.
- **Invoices, Cancelled and Trash tabs on the Invoices screen**: cancelled
  invoices have their own tab (they keep their numbers; *Undo cancel* puts one
  back). *Delete* (in each invoice's ⋯ menu, or *Delete invoices* for the ticked
  ones) moves invoices to the *Trash* tab, which shows the days left; they are
  removed for good after 30 days. *Restore* puts one back with its stock;
  *Delete forever* removes it at once.
- **Delete many products at once** (#177): tick products in the list (or the
  box in the header for all shown) and click *Delete selected*.
- **Search invoices by order ID, AWB, phone or GSTIN** (#172): the Invoices
  search also looks in the order, dispatch and reference details (Buyer's Order
  No, Dispatch Doc No, courier, your own fields) and the client's phone and GSTIN.
- **Received From suggests your clients** on a new payment receipt (#143).
- **Print rates before GST** (#164): with *Prices include tax* ticked, a second
  tick box prints each rate without GST (₹13.25 at 18% prints ₹11.23), so
  Qty × Rate matches the Amount. The GST and the total do not change.
- **A Print switch beside every printed part of the invoice form** (due date,
  place of supply, bank details, UPI QR, LUT declaration, notes, terms), and
  Customize can hide the export / LUT declaration.

### Changed
- **Control Panel in the installed Windows app**: *Stop Server* and *Move to
  Another PC* are gone there (the icon near the clock has *Quit*; Backup and
  Restore move your books), and *Remove the App* opens Windows' *Installed apps*.
  The ZIP's Control Panel is unchanged.
- **Settings has 6 tabs instead of 14**: *Company*, *Print & PDF*, *Features*,
  *Privacy & Security*, *Data & Backups* and *Updates*, each showing its cards
  one under the other. Nothing was removed; *Ctrl + K* finds any setting and
  opens its tab at that card.
- **The GST switch says what it does** (#152, #138): Customize's *Tax % column*
  always turned GST off for the whole invoice. It is now *Charge GST on this
  invoice* (group *Tax*), and a new *Tax % columns* switch hides only the GST
  columns on each line while GST is still charged. *Hide all* no longer turns
  GST or the round-off line off.
- **One WhatsApp message everywhere** (#156): the Invoices list, the Clients
  page and the invoice form send the same message: your business, the client,
  number and dates, total, paid and balance, status, and your UPI ID while
  money is due.
- **Numbering carries on after a number you type** (#145): type
  `.../0049` and the next invoice is `.../0050`. A lower number (an old paper
  bill) leaves the series alone.
- **GSTR-1 Table 12 in two parts** (#166): the GST Returns screen and the HSN
  CSV show B2B and B2C separately, as the portal does (the JSON already did).
- The window title reads like a desktop program: the page and your business name.

### Fixed
- **The Invoices list fits the screen**: at 1366 px with the full menu its last
  column (with the ⋯ menu and Delete) was off the right edge; the list now fits,
  and the Actions column stays visible on narrower windows too.
- **Compact menu**: the Control Panel icon sat off-centre (its status dot pushed
  it left); the dot is now a small badge in the corner.
- **The app window never shows "Needs a Quick Start"** (ERR-085): while an
  update or a restart stopped the app for a moment, the window showed the
  browser's start-up instructions; it now shows "Starting again..." and
  carries on by itself.
- **Cancel invoices did nothing when the ticked invoices were already
  cancelled**: it now says so and points to *Delete invoices*.
- **A deleted invoice now really stays 30 days in the Trash** (ERR-084): an
  invoice not changed for over 30 days was removed from the Trash at the next
  start of the app, and the Trash bin showed its old date as the delete date.
- **Imported invoices add their items to Products** (#170): new items get
  their name, HSN, unit, rate and GST (tick box *Add new items to Products*,
  on by default); products you already have are not changed.
- **The app opens on the newest version** (ERR-075): the page comes from the
  app first, the cached copy only when the app is not running. Edge could show
  a blank window after an update (#153).
- **Opening the app stopped at "Opening the app in your browser now..."** on
  some PCs (ERR-076).
- **GST Returns cleans client GSTINs** (capitals, spaces, hidden characters)
  and accepts a letter as the 13th character (#141, ERR-077).
- **Enter after an item put the cursor in HSN**, not the next Item box (#151, ERR-078).
- **With the preview hidden, Save / Download / Print opened it and closed it
  again** (#161, ERR-079).
- **Enter moves to the next box** on an item row: Item → HSN → Qty → Unit →
  Rate; Enter in Rate starts the next row. Picking a product jumps to Qty (#167).
- **The copy label (ORIGINAL FOR RECIPIENT) no longer covers the e-invoice QR**
  code (ERR-081).

### Security
- The app answers only requests addressed to `localhost` / `127.0.0.1`, so a
  web page cannot use "DNS rebinding" to reach your books through your
  browser.
- A receipt number is escaped in the receipt print window, so text typed into
  it can never run as a script.

---
