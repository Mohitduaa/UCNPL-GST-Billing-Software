# Multi-User RBAC & LAN Device Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full Multi-User Role-Based Access Control (RBAC) and local Wi-Fi / LAN Device Pairing with QR Code and PIN handshake in UCNPL GST Billing Software.

**Architecture:** A lightweight file-based data engine (`users.json`, `roles.json`, `lan_pairing.json`) coupled with Express security middleware in `server.js` that dynamically binds to `0.0.0.0` when LAN sharing is enabled, validates device tokens from private IPs, issues session tokens, and enforces permission checks on sensitive endpoints. Client UI provides a PIN lock/login screen, header user switcher, and a comprehensive Settings screen for Users, Roles Matrix, and LAN pairing with QR code.

**Tech Stack:** Node.js, Express.js, React (Vite), Web Crypto (crypto), QRCode.js.

**Spec:** [`docs/superpowers/specs/2026-11-12-multi-user-rbac-lan-pairing-design.md`](file:///d:/billingsoftware/UCNPL-GST-Billing-Software/docs/superpowers/specs/2026-11-12-multi-user-rbac-lan-pairing-design.md)

## Global Constraints
- Desktop-first offline privacy: Zero external third-party servers; all data remains in the local `data/` folder.
- Single-user backward compatibility: Single-user setups without multi-user enabled work identically without any forced login prompts.
- Windows CRLF & shell execution: All helper scripts executed via node script files.

---

### Task 1: RBAC & LAN Pairing Utilities and Data Engine

**Files:**
- Create: `src/utils/rbac.js`
- Create: `src/utils/lanPairing.js`
- Create: `scripts/rbac-test.mjs`

**Interfaces:**
- `DEFAULT_ROLES`: Array of `{ id, name, description, isSystem, permissions }`
- `ALL_PERMISSIONS`: Array of `{ id, label, category }`
- `hasPermission(role, permissionKey)`: returns boolean
- `hashPin(pin, salt)` / `verifyPin(pin, salt, hash)`
- `generatePairingCode()`: returns `{ code: '123456', expiresAt }`
- `generateDeviceToken()`: returns random cryptographically safe token
- `isPrivateNetworkIp(ip)`: validates RFC 1918 addresses

- [ ] **Step 1: Write the failing unit tests in `scripts/rbac-test.mjs`**
  - Test permission resolution for admin wildcard `*` vs specific permission keys (`sales.delete`, `reports.view`).
  - Test PIN hashing and verification.
  - Test LAN pairing code expiry and verification.
  - Test private IP detection for `192.168.1.10`, `10.0.0.5`, `127.0.0.1`, rejecting public IPs.
  - Run `node scripts/rbac-test.mjs` (must fail because modules don't exist yet).

- [ ] **Step 2: Implement `src/utils/rbac.js`**
  - Define `ALL_PERMISSIONS` dictionary grouped by module.
  - Define built-in `DEFAULT_ROLES` (Admin, Cashier, Accountant, Viewer).
  - Implement `hasPermission(role, permissionKey)` supporting wildcard `*` and prefix matching.
  - Implement PIN hash with `crypto.scryptSync` or `crypto.pbkdf2Sync`.

- [ ] **Step 3: Implement `src/utils/lanPairing.js`**
  - Implement 6-digit random code generator with 15-minute expiration.
  - Implement device token generator and validator.
  - Implement `getLocalNetworkIps()` using Node's `os.networkInterfaces()`.
  - Implement `isPrivateIp(ip)`.

- [ ] **Step 4: Run tests & verify**
  - Run `node scripts/rbac-test.mjs`.
  - Confirm all tests pass.

---

### Task 2: Server API Endpoints & LAN Security Middleware

**Files:**
- Modify: `server.js`
- Modify: `scripts/rbac-test.mjs`

**Interfaces:**
- `GET /api/auth/status` -> `{ multiUserEnabled, currentUser, roles }`
- `POST /api/auth/login` -> `{ success, user, role, token }`
- `POST /api/auth/logout` -> `{ success }`
- `GET /api/users` & `POST /api/users` & `DELETE /api/users/:id`
- `GET /api/roles` & `POST /api/roles`
- `GET /api/lan/status` -> `{ lanEnabled, localIps, port, pairingCode, devices }`
- `POST /api/lan/toggle` -> toggles LAN mode and updates persistence
- `POST /api/lan/code/refresh` -> generates fresh 6-digit pairing code
- `POST /api/lan/pair` -> accepts `{ code, deviceName }`, registers device
- `POST /api/lan/revoke` -> `{ deviceId }` revokes authorization

- [ ] **Step 1: Add server route unit tests to `scripts/rbac-test.mjs`**
  - Add API mock/call tests verifying device pairing verification and user login endpoint responses.
  - Run test to verify failure.

- [ ] **Step 2: Update Host Header & CORS check in `server.js`**
  - Allow private network IPs in `LOCAL_HOST_RE` and origin checks when LAN sharing is enabled.
  - Add `x-device-token` verification middleware for requests originating from non-localhost IPs.

- [ ] **Step 3: Implement Auth & RBAC routes in `server.js`**
  - Add read/write helpers for `DATA_DIR/users.json`, `DATA_DIR/roles.json`, `DATA_DIR/lan_pairing.json`.
  - Provide seed data on first run (default admin user if empty).
  - Add routes: `/api/auth/status`, `/api/auth/login`, `/api/auth/logout`.
  - Add routes: `/api/users`, `/api/roles`.
  - Add routes: `/api/lan/status`, `/api/lan/toggle`, `/api/lan/pair`, `/api/lan/revoke`.
  - Protect `DELETE /api/bills/:id` and `POST /api/profile` with permission verification.

- [ ] **Step 4: Run tests & verify**
  - Run `node scripts/rbac-test.mjs`.

---

### Task 3: Client Store & Auth Context Provider

**Files:**
- Create: `src/utils/authContext.js`
- Modify: `src/store.js`

**Interfaces:**
- `getAuthStatus()`, `loginUser(username, pin)`, `logoutUser()`
- `getAllUsers()`, `saveUser(user)`, `deleteUser(id)`
- `getAllRoles()`, `saveRole(role)`
- `getLanStatus()`, `toggleLan(enabled)`, `refreshPairingCode()`, `pairDevice(code, name)`, `revokeDevice(deviceId)`
- `AuthContext`: exports `{ currentUser, activeRole, can(permission), multiUserEnabled, isPairedDevice, login, logout }`

- [ ] **Step 1: Add API functions to `src/store.js`**
  - Export all auth, user, role, and LAN pairing fetch methods.
  - Ensure `x-device-token` and `x-session-token` are automatically injected into `apiFetch` headers when available in `localStorage`.

- [ ] **Step 2: Implement `src/utils/authContext.js`**
  - React context providing reactive access to `currentUser`, `activeRole`, and `can(permissionKey)`.
  - Provides `hasPermission(activeRole, key)` check.

---

### Task 4: UI — Login & Quick User Switcher

**Files:**
- Create: `src/components/LoginModal.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 1: Implement `src/components/LoginModal.jsx`**
  - Clean card with user avatars/cards or dropdown.
  - Numeric PIN keypad (1-9, Clear, Backspace) + keyboard support.
  - Shows friendly error messages on incorrect PIN.

- [ ] **Step 2: Integrate User Switcher & Pairing Modal in `src/App.jsx`**
  - If a device connects from LAN and is not paired: Render device pairing screen with PIN box.
  - If multi-user mode is enabled and user is locked out: Render `LoginModal`.
  - In top bar / sidebar: Show active user badge `👤 [Name] ([Role])` with a 1-click "Switch" button.

---

### Task 5: UI — Settings: Users, Roles & LAN Device Pairing

**Files:**
- Create: `src/components/UsersRolesSettings.jsx`
- Modify: `src/components/SettingsView.jsx`
- Modify: `src/utils.js` (add Users & Roles tab / feature flag)

- [ ] **Step 1: Implement `src/components/UsersRolesSettings.jsx`**
  - **Tab 1: Users**: List users, Add User modal, Edit User modal, Reset PIN, Role assignment dropdown, toggle Active/Inactive.
  - **Tab 2: Roles & Permissions Matrix**: Table displaying roles with checkboxes for each action (`sales.create`, `sales.delete`, etc.). Save custom role button.
  - **Tab 3: LAN & Device Pairing**:
    - Toggle: "Allow other devices on this Wi-Fi / Local Network".
    - Display LAN URLs: `http://192.168.X.X:47371`.
    - QR Code rendered with `qrcode` for instant mobile connection.
    - 6-digit Pairing Code with countdown/refresh button.
    - Paired Devices list with "Revoke Access" button.

- [ ] **Step 2: Add tab to `src/components/SettingsView.jsx`**
  - Add `Users & Roles` tab with `ShieldCheck` or `Users` icon.
  - Mount `UsersRolesSettings` inside `SettingsView`.

---

### Task 6: Permission Enforcement across Application Views

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/InvoiceGenerator.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Guard Navigation Items in `src/App.jsx`**
  - If role lacks `reports.view`, hide Reports menu item.
  - If role lacks `settings.manage`, hide Settings menu item.
  - If role lacks `gst.view`, hide GST Returns menu item.

- [ ] **Step 2: Guard Delete & Financial Actions**
  - In Invoice list / Dashboard: Hide or disable "Delete" action if user role lacks `sales.delete`.
  - In InvoiceGenerator: Hide discount box if user role lacks `sales.discount`.

---

### Task 7: Full Verification & Build

**Files:**
- All created and modified files.

- [ ] **Step 1: Run RBAC unit tests**
  - `node scripts/rbac-test.mjs`.

- [ ] **Step 2: Run complete unit test suite**
  - `npm run test:unit`.

- [ ] **Step 3: Run production build**
  - `npm run build`.

- [ ] **Step 4: Check running server and verify endpoints**
  - Check `http://127.0.0.1:47371/api/version`.
