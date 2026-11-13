// scripts/rbac-test.mjs
// Unit tests for RBAC, PIN hashing, and LAN pairing utilities

import assert from 'node:assert/strict';
import {
  DEFAULT_ROLES,
  ALL_PERMISSIONS,
  hasPermission,
  hashPin,
  verifyPin,
} from '../src/utils/rbac.js';

import {
  generatePairingCode,
  verifyPairingCode,
  generateDeviceToken,
  isPrivateNetworkIp,
  getLocalNetworkIps,
} from '../src/utils/lanPairing.js';

console.log('Testing RBAC & LAN Pairing Utilities...\n');

// --- RBAC Tests ---
console.log('1. DEFAULT_ROLES & ALL_PERMISSIONS structure');
assert(Array.isArray(DEFAULT_ROLES), 'DEFAULT_ROLES must be an array');
assert(DEFAULT_ROLES.length >= 4, 'Must have at least 4 default roles');

const adminRole = DEFAULT_ROLES.find(r => r.id === 'admin');
const cashierRole = DEFAULT_ROLES.find(r => r.id === 'cashier');
const accountantRole = DEFAULT_ROLES.find(r => r.id === 'accountant');
const viewerRole = DEFAULT_ROLES.find(r => r.id === 'viewer');

assert(adminRole, 'Admin role must exist');
assert(cashierRole, 'Cashier role must exist');
assert(accountantRole, 'Accountant role must exist');
assert(viewerRole, 'Viewer role must exist');

assert(Array.isArray(ALL_PERMISSIONS), 'ALL_PERMISSIONS must be an array');
assert(ALL_PERMISSIONS.some(p => p.id === 'sales.create'), 'sales.create must exist');
assert(ALL_PERMISSIONS.some(p => p.id === 'sales.delete'), 'sales.delete must exist');
assert(ALL_PERMISSIONS.some(p => p.id === 'sales.discount'), 'sales.discount must exist');
assert(ALL_PERMISSIONS.some(p => p.id === 'reports.view'), 'reports.view must exist');
assert(ALL_PERMISSIONS.some(p => p.id === 'settings.manage'), 'settings.manage must exist');
assert(ALL_PERMISSIONS.some(p => p.id === 'users.manage'), 'users.manage must exist');
console.log('   ✓ Default roles and permissions defined');

console.log('2. hasPermission()');
// Admin with wildcard '*'
assert.equal(hasPermission(adminRole, 'sales.create'), true);
assert.equal(hasPermission(adminRole, 'sales.delete'), true);
assert.equal(hasPermission(adminRole, 'users.manage'), true);
assert.equal(hasPermission(adminRole, 'non.existent.permission'), true);

// Cashier
assert.equal(hasPermission(cashierRole, 'sales.create'), true);
assert.equal(hasPermission(cashierRole, 'sales.view'), true);
assert.equal(hasPermission(cashierRole, 'sales.print'), true);
assert.equal(hasPermission(cashierRole, 'sales.delete'), false);
assert.equal(hasPermission(cashierRole, 'sales.discount'), false);
assert.equal(hasPermission(cashierRole, 'reports.view'), false);
assert.equal(hasPermission(cashierRole, 'settings.manage'), false);

// Accountant
assert.equal(hasPermission(accountantRole, 'reports.view'), true);
assert.equal(hasPermission(accountantRole, 'gst.view'), true);
assert.equal(hasPermission(accountantRole, 'sales.view'), true);
assert.equal(hasPermission(accountantRole, 'sales.delete'), false);
assert.equal(hasPermission(accountantRole, 'users.manage'), false);

// Custom role
const customManager = {
  id: 'manager',
  name: 'Store Manager',
  permissions: ['sales.*', 'inventory.*', 'reports.view'],
};
assert.equal(hasPermission(customManager, 'sales.create'), true);
assert.equal(hasPermission(customManager, 'sales.delete'), true);
assert.equal(hasPermission(customManager, 'inventory.manage'), true);
assert.equal(hasPermission(customManager, 'reports.view'), true);
assert.equal(hasPermission(customManager, 'settings.manage'), false);

// Empty or null role
assert.equal(hasPermission(null, 'sales.create'), false);
assert.equal(hasPermission(undefined, 'sales.create'), false);
console.log('   ✓ Permissions evaluated correctly including wildcards');

console.log('3. hashPin & verifyPin');
const pin = '1234';
const hashed = hashPin(pin);
assert(hashed.hash && typeof hashed.hash === 'string', 'Hashed output must contain hash string');
assert(hashed.salt && typeof hashed.salt === 'string', 'Hashed output must contain salt string');
assert.notEqual(hashed.hash, pin, 'Hash must not equal plaintext PIN');

assert.equal(verifyPin('1234', hashed.salt, hashed.hash), true, 'Correct PIN should verify');
assert.equal(verifyPin('9999', hashed.salt, hashed.hash), false, 'Incorrect PIN should fail');
assert.equal(verifyPin('', hashed.salt, hashed.hash), false, 'Empty PIN should fail');

// Deterministic with same salt
const rehashed = hashPin(pin, hashed.salt);
assert.equal(rehashed.hash, hashed.hash, 'Hashing with same salt must yield identical hash');
console.log('   ✓ PIN hashing and verification verified');

// --- LAN Pairing Tests ---
console.log('4. generatePairingCode & verifyPairingCode');
const codeObj = generatePairingCode();
assert(/^[0-9]{6}$/.test(codeObj.code), 'Code must be 6 digits');
assert(codeObj.expiresAt > Date.now(), 'expiresAt must be in the future');

assert.equal(verifyPairingCode(codeObj, codeObj.code), true, 'Matching code must succeed');
assert.equal(verifyPairingCode(codeObj, '000000'), false, 'Non-matching code must fail');
assert.equal(verifyPairingCode({ ...codeObj, expiresAt: Date.now() - 1000 }, codeObj.code), false, 'Expired code must fail');
console.log('   ✓ Pairing code generation and verification verified');

console.log('5. generateDeviceToken');
const token1 = generateDeviceToken();
const token2 = generateDeviceToken();
assert.equal(typeof token1, 'string');
assert(token1.length >= 32, 'Token must be at least 32 characters');
assert.notEqual(token1, token2, 'Generated tokens must be unique');
console.log('   ✓ Device token generation verified');

console.log('6. isPrivateNetworkIp');
// Loopback
assert.equal(isPrivateNetworkIp('127.0.0.1'), true);
assert.equal(isPrivateNetworkIp('::1'), true);
assert.equal(isPrivateNetworkIp('localhost'), true);

// 192.168.0.0/16
assert.equal(isPrivateNetworkIp('192.168.1.1'), true);
assert.equal(isPrivateNetworkIp('192.168.100.254'), true);

// 10.0.0.0/8
assert.equal(isPrivateNetworkIp('10.0.0.1'), true);
assert.equal(isPrivateNetworkIp('10.255.255.254'), true);

// 172.16.0.0/12
assert.equal(isPrivateNetworkIp('172.16.0.1'), true);
assert.equal(isPrivateNetworkIp('172.24.1.5'), true);
assert.equal(isPrivateNetworkIp('172.31.255.254'), true);

// Public / Not private
assert.equal(isPrivateNetworkIp('8.8.8.8'), false);
assert.equal(isPrivateNetworkIp('172.32.0.1'), false);
assert.equal(isPrivateNetworkIp('1.1.1.1'), false);
assert.equal(isPrivateNetworkIp('example.com'), false);
console.log('   ✓ Private IP network checking verified');

console.log('7. getLocalNetworkIps');
const ips = getLocalNetworkIps();
assert(Array.isArray(ips), 'Must return an array of IP addresses');
console.log('   Discovered local IPs:', ips);
console.log('   ✓ Local network IPs returned');

// --- Server-side Data Helpers & Auth Flow Tests ---
console.log('\n8. Auth & RBAC State logic');
// Simulation of server-side user/role/lan state functions
const mockUsersDb = {
  multiUserEnabled: false,
  users: [
    {
      id: 'u_admin',
      username: 'admin',
      name: 'Store Admin',
      role: 'admin',
      pinHash: hashed.hash,
      pinSalt: hashed.salt,
      isActive: true,
      createdAt: Date.now(),
    },
    {
      id: 'u_cashier',
      username: 'cashier1',
      name: 'Rohan Sharma',
      role: 'cashier',
      pinHash: hashPin('5555').hash,
      pinSalt: hashPin('5555').salt,
      isActive: true,
      createdAt: Date.now(),
    },
  ],
};

// Check login logic
function authenticateUser(db, usernameOrId, pin) {
  const user = db.users.find(u => u.username === usernameOrId || u.id === usernameOrId);
  if (!user) return { success: false, error: 'User not found' };
  if (!user.isActive) return { success: false, error: 'Account disabled' };
  if (!verifyPin(pin, user.pinSalt, user.pinHash)) return { success: false, error: 'Invalid PIN' };
  return { success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
}

const loginResult = authenticateUser(mockUsersDb, 'admin', '1234');
assert.equal(loginResult.success, true);
assert.equal(loginResult.user.username, 'admin');

const badLogin = authenticateUser(mockUsersDb, 'admin', 'wrong');
assert.equal(badLogin.success, false);
assert.equal(badLogin.error, 'Invalid PIN');

// Device Pairing verification flow
const mockLanDb = {
  enabled: true,
  activePairingCode: generatePairingCode(),
  pairedDevices: [],
};

function pairNewDevice(lanDb, code, deviceName) {
  if (!lanDb.enabled) return { success: false, error: 'LAN sharing is disabled' };
  if (!verifyPairingCode(lanDb.activePairingCode, code)) {
    return { success: false, error: 'Invalid or expired pairing code' };
  }
  const token = generateDeviceToken();
  const dev = {
    id: 'dev_' + Date.now(),
    name: deviceName || 'Counter Phone',
    token,
    pairedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  lanDb.pairedDevices.push(dev);
  return { success: true, token, device: dev };
}

const pairRes = pairNewDevice(mockLanDb, mockLanDb.activePairingCode.code, 'Counter Tablet');
assert.equal(pairRes.success, true);
assert.equal(typeof pairRes.token, 'string');
assert.equal(mockLanDb.pairedDevices.length, 1);
assert.equal(mockLanDb.pairedDevices[0].name, 'Counter Tablet');

// Revoking a device
function revokeDevice(lanDb, deviceId) {
  const initialLen = lanDb.pairedDevices.length;
  lanDb.pairedDevices = lanDb.pairedDevices.filter(d => d.id !== deviceId);
  return { success: true, revoked: lanDb.pairedDevices.length < initialLen };
}

const revokeRes = revokeDevice(mockLanDb, pairRes.device.id);
assert.equal(revokeRes.success, true);
assert.equal(revokeRes.revoked, true);
assert.equal(mockLanDb.pairedDevices.length, 0);
console.log('   ✓ Server-side auth, pairing and revoking logic verified');

console.log('\nAll RBAC & LAN pairing tests passed successfully!');
