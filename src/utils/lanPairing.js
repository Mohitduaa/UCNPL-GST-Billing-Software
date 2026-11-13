// src/utils/lanPairing.js
// LAN device discovery, pairing code generation, and device token utilities
import crypto from 'crypto';
import os from 'os';

export const PAIRING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export function generatePairingCode() {
  // 6-digit random code 100000..999999
  const code = String(Math.floor(100000 + Math.random() * 900000));
  return {
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIRING_EXPIRY_MS,
  };
}

export function verifyPairingCode(activeCodeObj, inputCode) {
  if (!activeCodeObj || !inputCode) return false;
  if (Date.now() > activeCodeObj.expiresAt) return false;
  return String(activeCodeObj.code).trim() === String(inputCode).trim();
}

export function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function isPrivateNetworkIp(ip) {
  if (!ip) return false;
  const cleanIp = String(ip).replace(/^::ffff:/, '').trim().toLowerCase();

  // Loopback
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') return true;

  // RFC 1918 Private Ranges:
  // 10.0.0.0/8: 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

  // 192.168.0.0/16: 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

  // 172.16.0.0/12: 172.16.0.0 - 172.31.255.255
  const m172 = cleanIp.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m172) {
    const octet = parseInt(m172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  return false;
}

export function getLocalNetworkIps() {
  const ips = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal/loopback and non-IPv4
        if (iface.family === 'IPv4' && !iface.internal) {
          if (isPrivateNetworkIp(iface.address)) {
            ips.push(iface.address);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error discovering network interfaces:', err);
  }
  return ips;
}
