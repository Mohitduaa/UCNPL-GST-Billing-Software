// src/utils/rbac.js
// Role-Based Access Control (RBAC) and PIN utilities
import crypto from 'crypto';

export const ALL_PERMISSIONS = [
  // Sales
  { id: 'sales.view', label: 'View Invoices & Sales Orders', category: 'Sales' },
  { id: 'sales.create', label: 'Create Invoices & Sales Orders', category: 'Sales' },
  { id: 'sales.edit', label: 'Edit Invoices & Sales Orders', category: 'Sales' },
  { id: 'sales.delete', label: 'Delete Invoices & Sales Orders', category: 'Sales' },
  { id: 'sales.print', label: 'Print / Share Invoices', category: 'Sales' },
  { id: 'sales.discount', label: 'Apply Custom Discounts', category: 'Sales' },

  // Purchases & Expenses
  { id: 'purchases.view', label: 'View Purchases & Expenses', category: 'Purchases' },
  { id: 'purchases.manage', label: 'Add/Edit Purchases & Expenses', category: 'Purchases' },

  // Inventory
  { id: 'inventory.view', label: 'View Products & Stock', category: 'Inventory' },
  { id: 'inventory.manage', label: 'Add/Edit/Delete Products & Stock', category: 'Inventory' },

  // Customers / Clients
  { id: 'customers.view', label: 'View Customers', category: 'Customers' },
  { id: 'customers.manage', label: 'Add/Edit Customers', category: 'Customers' },

  // Reports
  { id: 'reports.view', label: 'View Reports & Analytics', category: 'Reports' },
  { id: 'reports.export', label: 'Export Reports (Excel/CSV)', category: 'Reports' },

  // GST & Compliance
  { id: 'gst.view', label: 'View GST Returns & GSTR-1', category: 'GST & Compliance' },
  { id: 'gst.export', label: 'Export GSTR-1 JSON & Filing Reports', category: 'GST & Compliance' },

  // Settings & Management
  { id: 'settings.manage', label: 'Manage Business Profile & Settings', category: 'Settings' },
  { id: 'users.manage', label: 'Manage Users, Roles & LAN Devices', category: 'Settings' },
];

export const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full unconstrained access to all billing, settings, reports and user management.',
    isSystem: true,
    permissions: ['*'],
  },
  {
    id: 'cashier',
    name: 'Cashier / Billing Counter',
    description: 'Fast billing, printing invoices, viewing products and managing customers.',
    isSystem: true,
    permissions: [
      'sales.view',
      'sales.create',
      'sales.print',
      'inventory.view',
      'customers.view',
      'customers.manage',
    ],
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Full access to sales, purchases, stock, reports, and GST return preparation.',
    isSystem: true,
    permissions: [
      'sales.view',
      'purchases.view',
      'purchases.manage',
      'inventory.view',
      'customers.view',
      'reports.view',
      'reports.export',
      'gst.view',
      'gst.export',
    ],
  },
  {
    id: 'viewer',
    name: 'Read-Only Viewer',
    description: 'Read-only access to invoices, inventory, and reports.',
    isSystem: true,
    permissions: [
      'sales.view',
      'inventory.view',
      'reports.view',
    ],
  },
];

export function hasPermission(role, permissionKey) {
  if (!role || !permissionKey) return false;
  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  if (perms.includes('*')) return true;
  if (perms.includes(permissionKey)) return true;

  // Prefix wildcard check, e.g. "sales.*" matches "sales.create"
  const dotIndex = permissionKey.indexOf('.');
  if (dotIndex !== -1) {
    const wildPrefix = permissionKey.slice(0, dotIndex) + '.*';
    if (perms.includes(wildPrefix)) return true;
  }

  return false;
}

export function hashPin(pin, salt) {
  if (crypto && typeof crypto.randomBytes === 'function') {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const h = crypto.pbkdf2Sync(String(pin || ''), s, 1000, 32, 'sha256').toString('hex');
    return { hash: h, salt: s };
  }
  const s = salt || Math.random().toString(36).slice(2, 18);
  return { hash: `h_${s}_${pin}`, salt: s };
}

export function verifyPin(pin, salt, expectedHash) {
  if (!pin || !salt || !expectedHash) return false;
  try {
    const { hash } = hashPin(pin, salt);
    if (crypto && typeof crypto.timingSafeEqual === 'function') {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
    }
    return hash === expectedHash;
  } catch {
    return false;
  }
}
