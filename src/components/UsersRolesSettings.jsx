// src/components/UsersRolesSettings.jsx
// Users management, Custom Roles & Permissions Matrix, and LAN Device Pairing with QR Code

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Smartphone,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Copy,
  Check,
  QrCode,
  KeyRound,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  getAllUsers,
  saveUser,
  deleteUser,
  toggleMultiUser,
  getAllRoles,
  saveRole,
  getLanStatus,
  toggleLan,
  refreshPairingCode,
  revokeDevice,
} from '../store';
import { useAuth } from '../utils/authContext';
import { DEFAULT_ROLES, ALL_PERMISSIONS } from '../utils/rbac';
import { toast } from './Toast';

export default function UsersRolesSettings() {
  const { refreshStatus } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' | 'roles' | 'lan'

  // Users state
  const [users, setUsers] = useState([]);
  const [multiUserToggle, setMultiUserToggle] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null or user obj
  const [isNewUser, setIsNewUser] = useState(false);
  const [userForm, setUserForm] = useState({
    id: '',
    username: '',
    name: '',
    role: 'cashier',
    pin: '',
    confirmPin: '',
    isActive: true,
  });

  // Roles state
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [selectedRole, setSelectedRole] = useState(DEFAULT_ROLES[0]);
  const [rolePerms, setRolePerms] = useState(new Set());

  // LAN state
  const [lanStatus, setLanStatus] = useState({
    lanEnabled: false,
    localIps: [],
    port: 47371,
    pairingCode: null,
    devices: [],
  });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [lanBusy, setLanBusy] = useState(false);

  // Load all data
  const loadData = async () => {
    try {
      const [uData, rData, lData] = await Promise.all([
        getAllUsers(),
        getAllRoles(),
        getLanStatus(),
      ]);

      setUsers(uData?.users || []);
      setMultiUserToggle(Boolean(uData?.multiUserEnabled));

      const loadedRoles = rData?.roles || DEFAULT_ROLES;
      setRoles(loadedRoles);
      if (!selectedRole || !loadedRoles.some(r => r.id === selectedRole.id)) {
        setSelectedRole(loadedRoles[0]);
        setRolePerms(new Set(loadedRoles[0]?.permissions || []));
      } else {
        const found = loadedRoles.find(r => r.id === selectedRole.id);
        setRolePerms(new Set(found?.permissions || []));
      }

      setLanStatus(lData || { lanEnabled: false, localIps: [], port: 47371, devices: [] });
    } catch (err) {
      console.error('Failed to load users/roles/LAN data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Generate QR code whenever LAN is enabled and local IPs change
  useEffect(() => {
    if (lanStatus.lanEnabled && lanStatus.localIps?.length > 0) {
      const primaryIp = lanStatus.localIps[0];
      const lanUrl = `http://${primaryIp}:${lanStatus.port}`;
      QRCode.toDataURL(lanUrl, { width: 170, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
        .then(url => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''));
    } else {
      setQrCodeDataUrl('');
    }
  }, [lanStatus.lanEnabled, lanStatus.localIps, lanStatus.port]);

  // Handle Multi-User Toggle
  const handleToggleMultiUser = async () => {
    const nextVal = !multiUserToggle;
    try {
      await toggleMultiUser(nextVal);
      setMultiUserToggle(nextVal);
      await refreshStatus();
      toast(nextVal ? 'Multi-User Mode enabled! Users will be prompted for PIN.' : 'Multi-User Mode disabled. Running in single-user mode.', 'success');
    } catch (err) {
      toast(err?.message || 'Failed to toggle Multi-User Mode', 'error');
    }
  };

  // Open User Modal
  const openUserModal = (user = null) => {
    if (user) {
      setIsNewUser(false);
      setEditingUser(user);
      setUserForm({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        pin: '',
        confirmPin: '',
        isActive: user.isActive !== false,
      });
    } else {
      setIsNewUser(true);
      setEditingUser({ id: '' });
      setUserForm({
        id: '',
        username: '',
        name: '',
        role: 'cashier',
        pin: '',
        confirmPin: '',
        isActive: true,
      });
    }
  };

  // Save User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim()) {
      toast('Name is required', 'error');
      return;
    }

    if (isNewUser) {
      if (!userForm.username.trim()) {
        toast('Username is required', 'error');
        return;
      }
      if (!userForm.pin || userForm.pin.length < 4) {
        toast('PIN must be at least 4 digits', 'error');
        return;
      }
      if (userForm.pin !== userForm.confirmPin) {
        toast('PINs do not match', 'error');
        return;
      }
    } else {
      if (userForm.pin && userForm.pin !== userForm.confirmPin) {
        toast('PINs do not match', 'error');
        return;
      }
      if (userForm.pin && userForm.pin.length < 4) {
        toast('PIN must be at least 4 digits', 'error');
        return;
      }
    }

    try {
      await saveUser({
        id: isNewUser ? undefined : userForm.id,
        username: userForm.username.trim().toLowerCase(),
        name: userForm.name.trim(),
        role: userForm.role,
        pin: userForm.pin ? userForm.pin.trim() : undefined,
        isActive: userForm.isActive,
      });

      toast(isNewUser ? 'New user created successfully!' : 'User updated successfully!', 'success');
      setEditingUser(null);
      await loadData();
    } catch (err) {
      toast(err?.body?.error || err?.message || 'Failed to save user', 'error');
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.name || user.username}"?`)) return;
    try {
      await deleteUser(user.id);
      toast('User deleted', 'success');
      await loadData();
    } catch (err) {
      toast(err?.body?.error || err?.message || 'Failed to delete user', 'error');
    }
  };

  // Select Role & Update Permissions
  const handleSelectRole = (r) => {
    setSelectedRole(r);
    setRolePerms(new Set(r.permissions || []));
  };

  const handleTogglePerm = (permId) => {
    if (selectedRole?.id === 'admin') {
      toast('Admin role inherently has full unconstrained access (*).', 'info');
      return;
    }
    const next = new Set(rolePerms);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    setRolePerms(next);
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    try {
      await saveRole({
        id: selectedRole.id,
        name: selectedRole.name,
        description: selectedRole.description,
        permissions: Array.from(rolePerms),
      });
      toast(`Permissions for "${selectedRole.name}" updated successfully!`, 'success');
      await loadData();
      await refreshStatus();
    } catch (err) {
      toast(err?.message || 'Failed to save role permissions', 'error');
    }
  };

  // Add Custom Role Modal
  const handleAddCustomRole = async () => {
    const name = window.prompt('Enter new Role Name (e.g. Branch Supervisor):');
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const roleId = 'role_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    try {
      await saveRole({
        id: roleId,
        name: cleanName,
        description: `Custom role: ${cleanName}`,
        permissions: ['sales.view', 'sales.create', 'sales.print'],
      });
      toast(`Role "${cleanName}" created!`, 'success');
      await loadData();
    } catch (err) {
      toast(err?.message || 'Failed to create role', 'error');
    }
  };

  // LAN Handlers
  const handleToggleLan = async () => {
    setLanBusy(true);
    const nextVal = !lanStatus.lanEnabled;
    try {
      const res = await toggleLan(nextVal);
      setLanStatus(prev => ({
        ...prev,
        lanEnabled: res.lanEnabled,
        pairingCode: res.pairingCode,
      }));
      toast(nextVal ? 'LAN Sharing enabled! Other devices on your Wi-Fi can now connect.' : 'LAN Sharing disabled.', 'success');
      await loadData();
    } catch (err) {
      toast(err?.message || 'Failed to toggle LAN sharing', 'error');
    } finally {
      setLanBusy(false);
    }
  };

  const handleRefreshPairingCode = async () => {
    setLanBusy(true);
    try {
      const res = await refreshPairingCode();
      setLanStatus(prev => ({ ...prev, pairingCode: res.pairingCode }));
      toast('Generated fresh 6-digit pairing code!', 'success');
    } catch (err) {
      toast(err?.message || 'Failed to refresh pairing code', 'error');
    } finally {
      setLanBusy(false);
    }
  };

  const handleRevokeDevice = async (deviceId, name) => {
    if (!window.confirm(`Revoke access for "${name}"? This device will be immediately logged out.`)) return;
    try {
      await revokeDevice(deviceId);
      toast(`Access revoked for ${name}`, 'success');
      await loadData();
    } catch (err) {
      toast(err?.message || 'Failed to revoke device', 'error');
    }
  };

  const primaryIp = lanStatus.localIps?.[0] || '127.0.0.1';
  const primaryLanUrl = `http://${primaryIp}:${lanStatus.port}`;

  const copyLanUrl = () => {
    try {
      navigator.clipboard.writeText(primaryLanUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast('LAN URL copied to clipboard!', 'info');
    } catch {
      toast(primaryLanUrl, 'info');
    }
  };

  // Group permissions by category
  const categories = Array.from(new Set(ALL_PERMISSIONS.map(p => p.category)));

  return (
    <div>
      {/* Header & Sub-Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} className="text-primary" /> Multi-User & LAN Devices
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage staff login accounts, custom role permissions, and local Wi-Fi device pairing
          </p>
        </div>

        {/* Sub-tab pills */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', padding: '0.25rem', borderRadius: '10px', gap: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '7px',
              fontSize: '0.84rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'users' ? 'var(--primary, #c96442)' : 'transparent',
              color: activeSubTab === 'users' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Users size={15} /> Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('roles')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '7px',
              fontSize: '0.84rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'roles' ? 'var(--primary, #c96442)' : 'transparent',
              color: activeSubTab === 'roles' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Shield size={15} /> Roles & Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('lan')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '7px',
              fontSize: '0.84rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'lan' ? 'var(--primary, #c96442)' : 'transparent',
              color: activeSubTab === 'lan' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Smartphone size={15} /> LAN Sharing {lanStatus.lanEnabled && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />}
          </button>
        </div>
      </div>

      {/* ========================================================
          SUB-TAB 1: USERS MANAGEMENT
          ======================================================== */}
      {activeSubTab === 'users' && (
        <div>
          {/* Master Toggle Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              background: multiUserToggle ? 'rgba(37, 99, 235, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${multiUserToggle ? 'rgba(37, 99, 235, 0.3)' : 'var(--border)'}`,
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {multiUserToggle ? <Lock size={17} className="text-primary" /> : <Unlock size={17} />}
                Multi-User Mode (PIN Lock per User)
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {multiUserToggle
                  ? 'Active: Staff must enter their PIN to unlock or bill. Different roles restrict permissions.'
                  : 'Inactive: Single-user mode without PIN prompt. Toggle on to require staff PINs.'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMultiUser}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
                background: multiUserToggle ? '#10b981' : 'var(--primary, #c96442)',
                color: '#fff',
              }}
            >
              {multiUserToggle ? 'Multi-User Enabled (ON)' : 'Enable Multi-User'}
            </button>
          </div>

          {/* Action bar: Add User */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.85rem' }}>
            <button
              type="button"
              onClick={() => openUserModal()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'var(--primary, #c96442)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Add New User
            </button>
          </div>

          {/* Users Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Username</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleObj = roles.find(r => r.id === u.role);
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: u.role === 'admin' ? '#60a5fa' : '#34d399',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                            }}
                          >
                            {(u.name || u.username)[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{u.name || u.username}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        @{u.username}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: u.role === 'admin' ? '#60a5fa' : 'var(--text)',
                          }}
                        >
                          {roleObj?.name || u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: u.isActive !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: u.isActive !== false ? '#34d399' : '#f87171',
                          }}
                        >
                          {u.isActive !== false ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => openUserModal(u)}
                            title="Edit User or Reset PIN"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              cursor: 'pointer',
                              color: 'var(--text)',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              cursor: 'pointer',
                              color: '#f87171',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add / Edit User Modal */}
          {editingUser && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
            >
              <div
                className="glass-panel"
                style={{
                  width: '100%',
                  maxWidth: 440,
                  background: 'var(--bg-card, #1e293b)',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                    {isNewUser ? 'Add New User' : `Edit User: ${userForm.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveUser}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Rohan Sharma"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!isNewUser}
                        className="form-input"
                        placeholder="e.g. rohan"
                        value={userForm.username}
                        onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                        style={{ width: '100%', opacity: !isNewUser ? 0.6 : 1 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Role
                      </label>
                      <select
                        className="form-input"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                          {isNewUser ? '4-Digit PIN *' : 'Reset PIN (optional)'}
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="••••"
                          value={userForm.pin}
                          onChange={(e) => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '') })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                          Confirm PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="••••"
                          value={userForm.confirmPin}
                          onChange={(e) => setUserForm({ ...userForm, confirmPin: e.target.value.replace(/\D/g, '') })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    {!isNewUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <input
                          type="checkbox"
                          id="userActive"
                          checked={userForm.isActive}
                          onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                        />
                        <label htmlFor="userActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                          Account Active (can log in)
                        </label>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        style={{
                          padding: '0.5rem 0.9rem',
                          borderRadius: '8px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: '0.5rem 1.1rem',
                          borderRadius: '8px',
                          background: 'var(--primary, #c96442)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isNewUser ? 'Create User' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: ROLES & PERMISSIONS MATRIX
          ======================================================== */}
      {activeSubTab === 'roles' && (
        <div>
          {/* Roles selector & New Role action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {roles.map((r) => {
                const isSelected = selectedRole?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: `1px solid ${isSelected ? 'var(--primary, #c96442)' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#38bdf8' : 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    {r.name} {r.isSystem && <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>(Default)</span>}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddCustomRole}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <Plus size={15} /> Add Custom Role
            </button>
          </div>

          {/* Selected Role Card */}
          {selectedRole && (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'rgba(255, 255, 255, 0.02)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  {selectedRole.name} Permissions Matrix
                </h3>
                {selectedRole.id !== 'admin' && (
                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    style={{
                      padding: '0.45rem 0.95rem',
                      borderRadius: '7px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      background: 'var(--primary, #c96442)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Save Permissions
                  </button>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 1.25rem' }}>
                {selectedRole.description}
              </p>

              {/* Permissions Categories */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {categories.map((cat) => {
                  const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
                  return (
                    <div
                      key={cat}
                      style={{
                        padding: '0.9rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.92rem', fontWeight: 600, color: '#38bdf8' }}>
                        {cat}
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
                        {catPerms.map((p) => {
                          const isChecked = selectedRole.id === 'admin' || rolePerms.has(p.id) || rolePerms.has('*');
                          const isDisabled = selectedRole.id === 'admin';
                          return (
                            <label
                              key={p.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.55rem',
                                fontSize: '0.84rem',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                opacity: isDisabled ? 0.75 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={() => handleTogglePerm(p.id)}
                                style={{ marginTop: '0.15rem' }}
                              />
                              <div>
                                <div style={{ fontWeight: 500 }}>{p.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.id}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: LAN & WI-FI DEVICE PAIRING
          ======================================================== */}
      {activeSubTab === 'lan' && (
        <div>
          {/* LAN Master Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.1rem 1.25rem',
              borderRadius: '12px',
              background: lanStatus.lanEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${lanStatus.lanEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={18} className={lanStatus.lanEnabled ? 'text-success' : ''} />
                Wi-Fi / LAN Device Access
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {lanStatus.lanEnabled
                  ? 'Active: Mobile phones and tablets on your local Wi-Fi can connect and bill using pairing code.'
                  : 'Inactive: Access restricted strictly to this computer (localhost only).'}
              </div>
            </div>

            <button
              type="button"
              disabled={lanBusy}
              onClick={handleToggleLan}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: lanBusy ? 'not-allowed' : 'pointer',
                background: lanStatus.lanEnabled ? '#10b981' : 'var(--primary, #c96442)',
                color: '#fff',
              }}
            >
              {lanStatus.lanEnabled ? 'LAN Sharing (ON)' : 'Enable LAN Sharing'}
            </button>
          </div>

          {/* When LAN is Enabled: Show URL, QR Code, and 6-Digit Pairing Code */}
          {lanStatus.lanEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Card 1: Connection Info & QR Code */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  Scan with Phone or Tablet
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                  Make sure your device is connected to the same Wi-Fi router
                </p>

                {qrCodeDataUrl ? (
                  <div style={{ padding: '0.5rem', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginBottom: '1rem' }}>
                    <img src={qrCodeDataUrl} alt="LAN QR Code" style={{ display: 'block', width: 150, height: 150 }} />
                  </div>
                ) : (
                  <div style={{ width: 150, height: 150, background: 'rgba(255,255,255,0.05)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <QrCode size={40} className="text-muted" />
                  </div>
                )}

                <div style={{ width: '100%', marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Or open browser on your phone and type:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '7px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    <span style={{ color: '#38bdf8' }}>{primaryLanUrl}</span>
                    <button
                      type="button"
                      onClick={copyLanUrl}
                      title="Copy URL"
                      style={{ background: 'none', border: 'none', color: copiedUrl ? '#10b981' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {copiedUrl ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: 6-Digit Pairing Code */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  Device Pairing Code
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                  Enter this 6-digit code on the new phone/tablet when prompted
                </p>

                <div
                  style={{
                    letterSpacing: '10px',
                    fontSize: '2.4rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    marginBottom: '1rem',
                  }}
                >
                  {lanStatus.pairingCode?.code || '------'}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={lanBusy}
                    onClick={handleRefreshPairingCode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '7px',
                      fontSize: '0.82rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      cursor: lanBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw size={14} className={lanBusy ? 'animate-spin' : ''} /> Generate New Code
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Code auto-refreshes every 15 minutes for security
                </div>
              </div>
            </div>
          )}

          {/* Connected / Paired Devices Table */}
          <div style={{ marginTop: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem' }}>
              Connected / Paired Devices ({lanStatus.devices?.length || 0})
            </h3>

            {lanStatus.devices?.length === 0 ? (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border)',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                }}
              >
                No mobile or LAN devices paired yet. Enable LAN sharing above and scan the QR code to pair your first device.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Device Name</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Last IP</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Paired Date</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Last Active</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lanStatus.devices.map((d) => (
                      <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Smartphone size={16} className="text-primary" />
                            {d.name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {d.lastIp || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {d.pairedAt ? new Date(d.pairedAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleRevokeDevice(d.id, d.name)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              color: '#f87171',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Revoke Access
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
