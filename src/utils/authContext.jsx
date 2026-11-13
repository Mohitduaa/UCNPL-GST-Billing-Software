// src/utils/authContext.jsx
// React context providing reactive Auth, RBAC permissions, and LAN Pairing state

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAuthStatus,
  loginUser as apiLoginUser,
  logoutUser as apiLogoutUser,
  pairDevice as apiPairDevice,
} from '../store';
import { hasPermission, DEFAULT_ROLES } from './rbac';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState(DEFAULT_ROLES[0]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [multiUserEnabled, setMultiUserEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [needsPairing, setNeedsPairing] = useState(false);

  // Detect whether the client is accessing over local network / Wi-Fi IP
  const isLanClient = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname !== '[::1]';

  const checkStatus = useCallback(async () => {
    try {
      if (isLanClient) {
        const devToken = localStorage.getItem('fgsb_device_token');
        if (!devToken) {
          setNeedsPairing(true);
          setLoading(false);
          return;
        }
      }

      const status = await getAuthStatus();
      const isMulti = Boolean(status?.multiUserEnabled);
      setMultiUserEnabled(isMulti);
      setRoles(status?.roles || DEFAULT_ROLES);

      if (isMulti) {
        const sessToken = localStorage.getItem('fgsb_session_token');
        if (status?.currentUser && sessToken) {
          setCurrentUser(status.currentUser);
          setActiveRole(status.activeRole || DEFAULT_ROLES[0]);
          setIsLocked(false);
        } else {
          // Multi-user enabled but no active valid session
          setCurrentUser(null);
          setActiveRole(DEFAULT_ROLES.find(r => r.id === 'viewer') || null);
          setIsLocked(true);
        }
      } else {
        // Single user mode: full admin access
        setCurrentUser(status?.currentUser || { id: 'u_admin', username: 'admin', name: 'Admin', role: 'admin' });
        setActiveRole(DEFAULT_ROLES[0]);
        setIsLocked(false);
      }
      setNeedsPairing(false);
    } catch (err) {
      if (err?.body?.needsPairing || (err?.status === 401 && isLanClient)) {
        setNeedsPairing(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isLanClient]);

  useEffect(() => {
    checkStatus();

    const handleAuthRequired = (e) => {
      if (e?.detail?.needsPairing && isLanClient) {
        setNeedsPairing(true);
      } else if (e?.detail?.needsLogin) {
        setIsLocked(true);
      }
    };

    window.addEventListener('fgsb-auth-required', handleAuthRequired);
    return () => window.removeEventListener('fgsb-auth-required', handleAuthRequired);
  }, [checkStatus, isLanClient]);

  const login = async (usernameOrId, pin) => {
    const res = await apiLoginUser(usernameOrId, pin);
    if (res?.token) {
      localStorage.setItem('fgsb_session_token', res.token);
    }
    setCurrentUser(res.user);
    setActiveRole(res.role);
    setIsLocked(false);
    return res;
  };

  const logout = async () => {
    try { await apiLogoutUser(); } catch {}
    localStorage.removeItem('fgsb_session_token');
    setCurrentUser(null);
    setIsLocked(true);
  };

  const switchUser = () => {
    setIsLocked(true);
  };

  const pairDevice = async (code, deviceName) => {
    const res = await apiPairDevice(code, deviceName);
    if (res?.deviceToken) {
      localStorage.setItem('fgsb_device_token', res.deviceToken);
      setNeedsPairing(false);
      await checkStatus();
    }
    return res;
  };

  const can = useCallback((permissionKey) => {
    if (!multiUserEnabled) return true; // Single-user mode has full access
    if (!activeRole) return false;
    return hasPermission(activeRole, permissionKey);
  }, [multiUserEnabled, activeRole]);

  const value = {
    currentUser,
    activeRole,
    roles,
    multiUserEnabled,
    loading,
    isLocked,
    setIsLocked,
    needsPairing,
    setNeedsPairing,
    isLanClient,
    can,
    login,
    logout,
    switchUser,
    pairDevice,
    refreshStatus: checkStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      currentUser: { id: 'u_admin', username: 'admin', name: 'Admin', role: 'admin' },
      activeRole: DEFAULT_ROLES[0],
      roles: DEFAULT_ROLES,
      multiUserEnabled: false,
      loading: false,
      isLocked: false,
      setIsLocked: () => {},
      needsPairing: false,
      setNeedsPairing: () => {},
      isLanClient: false,
      can: () => true,
      login: async () => {},
      logout: async () => {},
      switchUser: () => {},
      pairDevice: async () => {},
      refreshStatus: async () => {},
    };
  }
  return ctx;
}
