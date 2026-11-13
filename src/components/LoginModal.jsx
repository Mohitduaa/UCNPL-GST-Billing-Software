// src/components/LoginModal.jsx
// Multi-User PIN Login Modal & LAN Device Pairing Screen

import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, Smartphone, KeyRound, AlertCircle, RefreshCw, ArrowLeft, Check, Shield } from 'lucide-react';
import { useAuth } from '../utils/authContext';
import { getAllUsers } from '../store';

export default function LoginModal() {
  const {
    isLocked,
    needsPairing,
    login,
    pairDevice,
    isLanClient,
  } = useAuth();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Pairing state
  const [pairCode, setPairCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    try {
      const ua = navigator.userAgent;
      if (/iPad|iPhone|iPod/.test(ua)) return 'Apple Mobile Device';
      if (/Android/.test(ua)) return 'Android Device';
      if (/Windows/.test(ua)) return 'Windows Terminal';
      if (/Macintosh/.test(ua)) return 'Mac Terminal';
      return 'LAN Terminal';
    } catch {
      return 'LAN Terminal';
    }
  });

  const pinInputRef = useRef(null);

  // Fetch users when locked
  useEffect(() => {
    if (!isLocked || needsPairing) return;
    let mounted = true;
    getAllUsers()
      .then((data) => {
        if (!mounted) return;
        const list = (data?.users || []).filter(u => u.isActive !== false);
        setUsers(list);
        if (list.length === 1) {
          setSelectedUser(list[0]);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isLocked, needsPairing]);

  // Handle keyboard typing for PIN entry
  useEffect(() => {
    if (!isLocked || needsPairing || !selectedUser) return;

    const handleKeyDown = (e) => {
      // Don't intercept if an input is focused
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setPin(prev => (prev.length < 8 ? prev + e.key : prev));
        setError('');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(prev => prev.slice(0, -1));
        setError('');
      } else if (e.key === 'Escape') {
        if (users.length > 1) {
          setSelectedUser(null);
          setPin('');
        }
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          handlePinSubmit(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, needsPairing, selectedUser, pin, users.length]);

  const handleKeypadPress = (val) => {
    setError('');
    if (val === 'clear') {
      setPin('');
    } else if (val === 'backspace') {
      setPin(prev => prev.slice(0, -1));
    } else if (typeof val === 'number') {
      if (pin.length < 8) {
        const nextPin = pin + val;
        setPin(nextPin);
        // Auto-submit if reaches typical length (e.g. 4 or 6 digits) when users have 4-digit PINs
        if (nextPin.length === 4) {
          // Attempt login with 4 digits
          handlePinSubmit(nextPin);
        }
      }
    }
  };

  const handlePinSubmit = async (pinToTry) => {
    const code = pinToTry || pin;
    if (!code || code.length < 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await login(selectedUser.id, code);
      setPin('');
    } catch (err) {
      setPin('');
      setError(err?.body?.error || err?.message || 'Incorrect PIN. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePairSubmit = async (e) => {
    e?.preventDefault();
    const cleanCode = pairCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setError('Please enter the 6-digit code shown on the host PC');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await pairDevice(cleanCode, deviceName.trim());
      setError('');
    } catch (err) {
      setError(err?.body?.error || err?.message || 'Pairing failed. Check code and try again.');
    } finally {
      setBusy(false);
    }
  };

  // If neither locked nor needs pairing, don't show modal
  if (!needsPairing && !isLocked) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--bg-card, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '2rem 1.75rem',
          color: 'var(--text, #f8fafc)',
          textAlign: 'center',
        }}
      >
        {/* =========================================
            SCREEN 1: LAN DEVICE PAIRING
            ========================================= */}
        {needsPairing ? (
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(var(--primary-rgb, 201, 100, 66), 0.15)',
                color: 'var(--primary, #c96442)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Smartphone size={28} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Pair with Main Billing PC
            </h2>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.45 }}>
              On your Main Computer, open <strong>Settings → Users & Roles → LAN Sharing</strong> to view your 6-digit Pairing Code.
            </p>

            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  borderRadius: '8px',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  textAlign: 'left',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handlePairSubmit}>
              <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  6-Digit Pairing Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={pairCode}
                  onChange={(e) => {
                    setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    letterSpacing: '8px',
                    fontSize: '1.6rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border, #475569)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
                  Device Name / Station
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter Tablet / Billing Desk 2"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '0.92rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #475569)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={busy || pairCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  background: 'var(--primary, #c96442)',
                  color: '#fff',
                  border: 'none',
                  cursor: busy || pairCode.length !== 6 ? 'not-allowed' : 'pointer',
                  opacity: busy || pairCode.length !== 6 ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {busy ? <RefreshCw size={18} className="animate-spin" /> : <Shield size={18} />}
                Pair & Connect Device
              </button>
            </form>
          </div>
        ) : (
          /* =========================================
             SCREEN 2: MULTI-USER PIN LOGIN
             ========================================= */
          <div>
            {!selectedUser ? (
              /* User selection view */
              <div>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                  }}
                >
                  <User size={26} />
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                  Who is Billing Today?
                </h2>
                <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Select your user account to continue
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 300, overflowY: 'auto' }}>
                  {users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        setPin('');
                        setError('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border, #334155)',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: u.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: u.role === 'admin' ? '#60a5fa' : '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}
                        >
                          {(u.name || u.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.name || u.username}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                            {u.role}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Select →</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* PIN entry keypad view */
              <div>
                {users.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setPin('');
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginBottom: '0.8rem',
                      padding: 0,
                    }}
                  >
                    <ArrowLeft size={14} /> Switch User
                  </button>
                )}

                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: selectedUser.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: selectedUser.role === 'admin' ? '#60a5fa' : '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.6rem',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  {(selectedUser.name || selectedUser.username)[0].toUpperCase()}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.15rem' }}>
                  {selectedUser.name || selectedUser.username}
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'capitalize', marginBottom: '1rem' }}>
                  Role: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedUser.role}</span>
                </div>

                {/* PIN Dots Display */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    margin: '1rem 0 1.25rem',
                  }}
                >
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: '2px solid var(--primary, #c96442)',
                        background: pin.length > idx ? 'var(--primary, #c96442)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    />
                  ))}
                </div>

                {error && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      borderRadius: '8px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.82rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Numeric Touch Keypad */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.55rem',
                    maxWidth: 260,
                    margin: '0 auto 1.2rem',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={busy}
                      onClick={() => handleKeypadPress(n)}
                      style={{
                        padding: '0.75rem',
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--border, #334155)',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseDown={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                      onMouseUp={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleKeypadPress('clear')}
                    style={{
                      padding: '0.75rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleKeypadPress(0)}
                    style={{
                      padding: '0.75rem',
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border, #334155)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleKeypadPress('backspace')}
                    style={{
                      padding: '0.75rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--border, #334155)',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    ⌫
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy || pin.length < 4}
                  onClick={() => handlePinSubmit(pin)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    borderRadius: '10px',
                    background: 'var(--primary, #c96442)',
                    color: '#fff',
                    border: 'none',
                    cursor: busy || pin.length < 4 ? 'not-allowed' : 'pointer',
                    opacity: busy || pin.length < 4 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                  }}
                >
                  {busy ? <RefreshCw size={17} className="animate-spin" /> : <Lock size={17} />}
                  Login / Unlock
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
