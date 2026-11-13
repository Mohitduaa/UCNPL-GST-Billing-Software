# How to Remove / Uninstall UCNPL GST Billing Software

This guide explains how to cleanly remove UCNPL GST Billing Software from your computer, depending on how you installed or run it.

---

## 1. Portable ZIP / Folder (No Install) 🚀

If you run the app directly from an extracted folder or USB drive (without running an installer):

1. **Close the Software**:
   - In the app, open **Control Panel** and click **Stop Server** (or close the app window / terminal).
2. **Back Up Your Data (Optional)**:
   - Your invoices, clients, and settings are saved inside the `data/` folder within the app directory.
   - All your automatic and manual backups are also stored in:
     `C:\Users\<Your Name>\Documents\UCNPL Billing Backups\`
   - Copy the `data/` folder or the `Documents\UCNPL Billing Backups\` folder to a safe place if you want to keep your books.
3. **Delete the Folder**:
   - Right-click the `UCNPL-GST-Billing` folder and select **Delete** (or move to Recycle Bin).
   - There are **no hidden background services, no registry junk, and no leftover files** on your computer.

---

## 2. Windows Setup Program (`.exe` Installer) 💻

If you installed UCNPL Billing using the `UCNPL-GST-Billing-Setup.exe` installer:

1. Press `Win + I` to open **Windows Settings**.
2. Navigate to **Apps** → **Installed apps** (or **Apps & features**).
3. Search for **UCNPL Billing** in the search box.
4. Click the three dots (`⋮`) on the right and select **Uninstall**.
5. Follow the on-screen uninstaller prompt:
   - The uninstaller will ask: *"Do you want to keep your data?"*
   - Choose **Yes** to preserve your invoices, clients, and backups.
   - Choose **No** if you want to wipe everything completely.

---

## 3. One-Line PowerShell Install ⚡

If you installed using the one-line PowerShell script:

1. Open PowerShell and run:
   ```powershell
   powershell -ExecutionPolicy Bypass -c "[Net.ServicePointManager]::SecurityProtocol='Tls12'; & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Mohitduaa/UCNPL-GST-Billing-Software/main/install.ps1))) -Uninstall"
   ```
2. The script will safely ask before removing your books and clean up desktop shortcuts.

---

## 4. macOS 🍏

If you are using macOS:

1. Close the app by quitting the launcher or pressing `Ctrl + C` in Terminal.
2. Open **Finder** → **Applications**.
3. Locate **UCNPL Billing** and drag it to the **Trash**.
4. To remove local data and backups:
   - App data: `~/Library/Application Support/UCNPL Billing/`
   - Backups: `~/Documents/UCNPL Billing Backups/`

---

## 5. Linux 🐧

- **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo apt remove ucnpl-billing
  ```
- **AppImage**:
  Simply delete the `.AppImage` file and any desktop shortcut you created.

---

## Where Is My Data Kept?

Even after uninstalling the application:
* Automatic backups are kept in:
  `Documents\UCNPL Billing Backups\`
* To wipe data completely, manually delete that folder from your `Documents` directory.
