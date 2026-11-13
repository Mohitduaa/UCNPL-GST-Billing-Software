// src/components/CashBook.jsx
// Redesigned Senior Product UI:
// - Neutral surface (#ffffff / #f4f5f8), single dark accent (#0f172a), no decorative gradients or glows
// - Consistent line-icon set (Lucide, 1.75px stroke, 16-18px), zero emojis
// - Single surface per section with 1px dividers (no cards inside cards)
// - Strict spacing: label-value 2-4px, group items 8-12px, sections 24px+
// - Nested corner geometry: inner = outer - padding
// - Crisp, intentional user-action transitions (150-200ms ease-out)

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Banknote,
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  Trash2,
  Search,
  X,
  Save,
  ExternalLink,
  Smartphone,
  CreditCard,
  FileText
} from 'lucide-react';
import {
  getAllCashEntries,
  saveCashEntry,
  deleteCashEntry,
  getAllBills,
  getAllReceipts,
  getAllExpenses,
  getAllPurchases,
  getAllClients,
  getProfile
} from '../store';
import { formatCurrency, belongsToProfile, localToday, parseLocalDate } from '../utils';
import {
  CASH_CATEGORIES,
  validateCashEntry,
  linkedCashLines,
  linkedBankLines,
  ownCashLines,
  cashBookView,
  fundsSummary,
  formatAccountBadge,
  periodRange
} from '../utils/cashBook';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';
import TableExport from './TableExport';

const PERIODS = [
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['fy', 'This financial year'],
  ['all', 'All dates'],
  ['custom', 'Choose dates'],
];

const SOURCE_SCREEN = {
  receipts: 'Receipts',
  dashboard: 'the Dashboard',
  expenses: 'Expenses',
  purchases: 'Purchases'
};

const emptyForm = () => ({
  type: 'in',
  account: 'cash',
  amount: '',
  name: '',
  note: '',
  category: '',
  date: localToday()
});

const showDate = (d) =>
  d ? parseLocalDate(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function CashBook({ onOpenView }) {
  const [entries, setEntries] = useState([]);
  const [linked, setLinked] = useState([]);
  const [linkedBank, setLinkedBank] = useState([]);
  const [accountTab, setAccountTab] = useState('all'); // 'all' | 'cash' | 'bank'
  const [names, setNames] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState(() => periodRange('month'));
  const amountRef = useRef(null);

  const load = async () => {
    try {
      const [own, bills, receipts, expenses, purchases, clients, prof] = await Promise.all([
        getAllCashEntries(),
        getAllBills(),
        getAllReceipts(),
        getAllExpenses(),
        getAllPurchases().catch(() => []),
        getAllClients().catch(() => []),
        getProfile().catch(() => null),
      ]);
      const mine = (rows) => (rows || []).filter((r) => belongsToProfile(r, prof));
      setProfile(prof);
      setEntries(mine(own));
      setLinked(linkedCashLines({ bills: mine(bills), receipts: mine(receipts), expenses: mine(expenses), purchases: mine(purchases) }));
      setLinkedBank(linkedBankLines({ bills: mine(bills), receipts: mine(receipts), expenses: mine(expenses), purchases: mine(purchases) }));
      setNames([...new Set([...(clients || []).map((c) => c.name), ...mine(own).map((e) => e.name)].filter(Boolean))].sort());
    } catch {
      toast('Could not load the cash book', 'error');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const allLines = useMemo(() => [...ownCashLines(entries), ...linked, ...linkedBank], [entries, linked, linkedBank]);
  const summary = fundsSummary(allLines);

  const lines = useMemo(() => {
    if (accountTab === 'cash') return allLines.filter((l) => l.account !== 'bank');
    if (accountTab === 'bank') return allLines.filter((l) => l.account === 'bank');
    return allLines;
  }, [allLines, accountTab]);

  const range = period === 'custom' ? custom : periodRange(period);
  const book = cashBookView(lines, { ...range, search });

  const periodLabel = period === 'custom'
    ? [range.from && `from ${showDate(range.from)}`, range.to && `to ${showDate(range.to)}`].filter(Boolean).join(' ') || 'All dates'
    : PERIODS.find(([k]) => k === period)[1];

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const resetForm = () => {
    setForm(emptyForm());
    setEditing(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const entry = {
      ...(editing ? { id: editing.id, createdAt: editing.createdAt } : {}),
      type: form.type,
      account: form.account || 'cash',
      mode: form.account === 'bank' ? 'bank' : 'cash',
      date: form.date,
      amount: Number(form.amount),
      name: form.name,
      note: form.note,
      category: form.category,
      ownerGstin: editing ? editing.ownerGstin || '' : profile?.gstin || '',
      ownerName: editing ? editing.ownerName || '' : profile?.businessName || '',
    };
    const problem = validateCashEntry(entry);
    if (problem) {
      toast(problem, 'warning');
      amountRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCashEntry(entry);
      setEntries((prev) => [...prev.filter((x) => x.id !== saved.id), saved]);
      if (saved.name && !names.includes(saved.name)) setNames((prev) => [...prev, saved.name].sort());
      toast(editing ? 'Entry updated' : `${form.type === 'in' ? 'Money in' : 'Money out'} of ${formatCurrency(saved.amount)} saved`, 'success');
      setForm((prev) => ({ ...emptyForm(), type: prev.type, account: prev.account, date: editing ? localToday() : prev.date }));
      setEditing(null);
      amountRef.current?.focus();
    } catch (err) {
      toast(err?.message && err.status === 400 ? err.message : 'Could not save the entry. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditing(entry);
    setForm({
      type: entry.type,
      account: entry.account === 'bank' || entry.mode === 'bank' ? 'bank' : 'cash',
      amount: String(entry.amount),
      name: entry.name || '',
      note: entry.note || '',
      category: entry.category || '',
      date: entry.date
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => amountRef.current?.focus(), 50);
  };

  const handleDelete = async (entry) => {
    const ok = await confirmAction({
      title: 'Delete this entry?',
      message: `${entry.type === 'in' ? 'Money in' : 'Money out'} of ${formatCurrency(entry.amount)} on ${showDate(entry.date)}${entry.name ? ` (${entry.name})` : ''} will be removed.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCashEntry(entry.id);
      setEntries((prev) => prev.filter((x) => x.id !== entry.id));
      if (editing?.id === entry.id) resetForm();
      toast('Entry deleted', 'success');
    } catch {
      toast('Could not delete the entry. Try again.', 'error');
    }
  };

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const exportRows = book.rows.length ? [
    ...(range.from ? [[range.from, 'Opening balance', '', '', '', '', '', '', book.opening]] : []),
    ...book.rows.map((l) => [l.date, formatAccountBadge(l), l.name, l.note, l.category, l.label || 'Cash book', l.type === 'in' ? r2(l.amount) : '', l.type === 'out' ? r2(l.amount) : '', l.balance]),
    ['', '', search.trim() ? `Total (matching "${search.trim()}")` : 'Total', '', '', '', book.totals.in, book.totals.out, search.trim() ? '' : book.closing],
  ] : [];

  const renderAccountIcon = (line) => {
    if (line.account === 'bank') {
      const m = String(line.mode || 'bank').toLowerCase();
      if (m.includes('upi')) return <Smartphone size={14} strokeWidth={1.75} />;
      if (m.includes('card')) return <CreditCard size={14} strokeWidth={1.75} />;
      if (m.includes('cheque') || m.includes('check')) return <FileText size={14} strokeWidth={1.75} />;
      return <Landmark size={14} strokeWidth={1.75} />;
    }
    return <Banknote size={14} strokeWidth={1.75} />;
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem 3rem' }}>
      {/* Page Header (24px bottom margin) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              Cash & Bank Book
            </h1>
            <HelpButton title="Cash book" doc="cash-book" size={16} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Unified ledger for cash in hand, bank accounts, and digital payments
          </p>
        </div>
      </div>

      {/* Section 1: Unified Metric Surface - No cards inside cards (24px bottom margin) */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginBottom: 24,
        }}
      >
        {/* Metric 1: Cash in Hand */}
        <div
          onClick={() => setAccountTab('cash')}
          style={{
            padding: '16px 20px',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            background: accountTab === 'cash' ? 'var(--bg-tertiary)' : 'transparent',
            transition: 'background-color 150ms ease-out',
          }}
          title="Filter to Cash in Hand"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <Banknote size={16} strokeWidth={1.75} />
            <span>Cash in Hand</span>
          </div>
          <div style={{ marginTop: 4, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: summary.inHand < 0 ? '#dc2626' : 'var(--text)' }}>
            {formatCurrency(summary.inHand)}
          </div>
        </div>

        {/* Metric 2: Bank & UPI Balance */}
        <div
          onClick={() => setAccountTab('bank')}
          style={{
            padding: '16px 20px',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            background: accountTab === 'bank' ? 'var(--bg-tertiary)' : 'transparent',
            transition: 'background-color 150ms ease-out',
          }}
          title="Filter to Bank & Online Payments"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <Landmark size={16} strokeWidth={1.75} />
            <span>Bank & UPI</span>
          </div>
          <div style={{ marginTop: 4, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: summary.bank < 0 ? '#dc2626' : 'var(--text)' }}>
            {formatCurrency(summary.bank)}
          </div>
        </div>

        {/* Metric 3: Total Available Funds */}
        <div
          onClick={() => setAccountTab('all')}
          style={{
            padding: '16px 20px',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
            background: accountTab === 'all' ? 'var(--bg-tertiary)' : 'transparent',
            transition: 'background-color 150ms ease-out',
          }}
          title="Filter to All Accounts"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <Wallet size={16} strokeWidth={1.75} />
            <span>Total Available</span>
          </div>
          <div style={{ marginTop: 4, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: summary.totalFunds < 0 ? '#dc2626' : 'var(--text)' }}>
            {formatCurrency(summary.totalFunds)}
          </div>
        </div>

        {/* Metric 4: Period Activity */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <ArrowDownLeft size={16} strokeWidth={1.75} />
            <span>This Month</span>
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>In </span>
              <strong style={{ fontSize: '0.95rem', color: '#059669', fontWeight: 600 }}>{formatCurrency(summary.month.in)}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Out </span>
              <strong style={{ fontSize: '0.95rem', color: '#dc2626', fontWeight: 600 }}>{formatCurrency(summary.month.out)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Account Filter Switcher (Nested corner geometry: 8px outer, 3px pad -> 5px inner) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--bg-secondary)',
            padding: 3,
            borderRadius: 8,
            gap: 2,
          }}
          role="tablist"
          aria-label="Account ledger selector"
        >
          <button
            type="button"
            role="tab"
            aria-selected={accountTab === 'all'}
            onClick={() => setAccountTab('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: '0.82rem',
              fontWeight: accountTab === 'all' ? 600 : 500,
              background: accountTab === 'all' ? '#ffffff' : 'transparent',
              color: accountTab === 'all' ? 'var(--text)' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              boxShadow: accountTab === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
              transition: 'background-color 150ms ease-out, color 150ms ease-out',
            }}
          >
            <Wallet size={16} strokeWidth={1.75} />
            <span>All Accounts</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountTab === 'cash'}
            onClick={() => setAccountTab('cash')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: '0.82rem',
              fontWeight: accountTab === 'cash' ? 600 : 500,
              background: accountTab === 'cash' ? '#ffffff' : 'transparent',
              color: accountTab === 'cash' ? 'var(--text)' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              boxShadow: accountTab === 'cash' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
              transition: 'background-color 150ms ease-out, color 150ms ease-out',
            }}
          >
            <Banknote size={16} strokeWidth={1.75} />
            <span>Cash Only</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountTab === 'bank'}
            onClick={() => setAccountTab('bank')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 5,
              fontSize: '0.82rem',
              fontWeight: accountTab === 'bank' ? 600 : 500,
              background: accountTab === 'bank' ? '#ffffff' : 'transparent',
              color: accountTab === 'bank' ? 'var(--text)' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              boxShadow: accountTab === 'bank' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
              transition: 'background-color 150ms ease-out, color 150ms ease-out',
            }}
          >
            <Landmark size={16} strokeWidth={1.75} />
            <span>Bank & UPI</span>
          </button>
        </div>

        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing <strong>{book.rows.length}</strong> transactions for {periodLabel}
        </span>
      </div>

      {/* Section 3: Quick Entry Surface - Single surface, 24px bottom margin */}
      <form
        onSubmit={handleSave}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
        aria-label="New ledger entry"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            {editing ? 'Edit Entry' : 'Quick Entry'}
          </h2>
          <HelpButton title={editing ? 'Edit entry' : 'Adding a cash entry'} doc={editing ? 'cash-book#edit-entry' : 'cash-book#add-entry'} size={15} />
        </div>

        {/* Form elements with 10-12px gap, 2-4px label-to-input gap */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {/* Direction Switcher (In / Out) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Flow Direction *</label>
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: 3, borderRadius: 8, gap: 2 }}>
              <button
                type="button"
                onClick={() => update('type', 'in')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 5,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: form.type === 'in' ? 'var(--primary)' : 'transparent',
                  color: form.type === 'in' ? '#ffffff' : '#64748b',
                  transition: 'background-color 150ms ease-out, color 150ms ease-out',
                }}
              >
                <ArrowDownLeft size={15} strokeWidth={1.75} />
                <span>Money In</span>
              </button>
              <button
                type="button"
                onClick={() => update('type', 'out')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 5,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: form.type === 'out' ? 'var(--primary)' : 'transparent',
                  color: form.type === 'out' ? '#ffffff' : '#64748b',
                  transition: 'background-color 150ms ease-out, color 150ms ease-out',
                }}
              >
                <ArrowUpRight size={15} strokeWidth={1.75} />
                <span>Money Out</span>
              </button>
            </div>
          </div>

          {/* Account Switcher (Cash / Bank) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Account *</label>
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: 3, borderRadius: 8, gap: 2 }}>
              <button
                type="button"
                onClick={() => update('account', 'cash')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 5,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: form.account !== 'bank' ? 'var(--primary)' : 'transparent',
                  color: form.account !== 'bank' ? '#ffffff' : '#64748b',
                  transition: 'background-color 150ms ease-out, color 150ms ease-out',
                }}
              >
                <Banknote size={15} strokeWidth={1.75} />
                <span>Cash</span>
              </button>
              <button
                type="button"
                onClick={() => update('account', 'bank')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 5,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: form.account === 'bank' ? 'var(--primary)' : 'transparent',
                  color: form.account === 'bank' ? '#ffffff' : '#64748b',
                  transition: 'background-color 150ms ease-out, color 150ms ease-out',
                }}
              >
                <Landmark size={15} strokeWidth={1.75} />
                <span>Bank / UPI</span>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
            <label htmlFor="cash-amount" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Amount (₹) *</label>
            <input
              id="cash-amount"
              ref={amountRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.875rem',
                color: 'var(--text)',
                outline: 'none',
                background: 'var(--card-bg)',
                transition: 'border-color 150ms ease-out',
              }}
            />
          </div>

          {/* Contact / Purpose */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1.5 1 180px' }}>
            <label htmlFor="cash-name" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Name / Counterparty</label>
            <input
              id="cash-name"
              type="text"
              list="cash-names"
              maxLength={120}
              placeholder="e.g. Ramesh, Supplier, Rent"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.875rem',
                color: 'var(--text)',
                outline: 'none',
                background: 'var(--card-bg)',
                transition: 'border-color 150ms ease-out',
              }}
            />
            <datalist id="cash-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px' }}>
            <label htmlFor="cash-category" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Category</label>
            <input
              id="cash-category"
              type="text"
              list="cash-categories"
              maxLength={60}
              placeholder="Select or type"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.875rem',
                color: 'var(--text)',
                outline: 'none',
                background: 'var(--card-bg)',
                transition: 'border-color 150ms ease-out',
              }}
            />
            <datalist id="cash-categories">
              {CASH_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
            <label htmlFor="cash-date" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Date *</label>
            <input
              id="cash-date"
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.85rem',
                color: 'var(--text)',
                outline: 'none',
                background: 'var(--card-bg)',
                transition: 'border-color 150ms ease-out',
              }}
            />
          </div>

          {/* Note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
            <label htmlFor="cash-note" style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Note (Optional)</label>
            <input
              id="cash-note"
              type="text"
              maxLength={500}
              placeholder="Additional details"
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.875rem',
                color: 'var(--text)',
                outline: 'none',
                background: 'var(--card-bg)',
                transition: 'border-color 150ms ease-out',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                background: 'var(--primary)', color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease-out',
              }}
            >
              <Save size={16} strokeWidth={1.75} />
              <span>{editing ? 'Update' : 'Save'}</span>
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '9px 14px',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: 'var(--card-bg)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease-out',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Section 4: Transaction Ledger Table Surface - Single surface, separated by 1px divider */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Table Toolbar */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: 240 }}>
              <Search
                size={16}
                strokeWidth={1.75}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder="Search description, note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 34px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  color: 'var(--text)',
                  outline: 'none',
                  background: 'var(--bg-secondary)',
                  transition: 'border-color 150ms ease-out',
                }}
              />
            </div>

            {/* Period selector */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                padding: '7px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.85rem',
                color: 'var(--text)',
                background: 'var(--card-bg)',
                outline: 'none',
              }}
            >
              {PERIODS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {period === 'custom' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--bg-secondary)', color: 'var(--text)' }}
                />
                <span style={{ color: '#94a3b8' }}>–</span>
                <input
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--bg-secondary)', color: 'var(--text)' }}
                />
              </div>
            )}

            {(search || period !== 'month') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPeriod('month');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                title="Reset filters"
              >
                <X size={14} strokeWidth={1.75} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Export button */}
          <TableExport
            title="Cash & Bank Ledger"
            filename={`Cash-and-Bank-${periodLabel}`}
            subtitle={[profile?.businessName, periodLabel, search.trim() ? `matching "${search.trim()}"` : ''].filter(Boolean).join(', ')}
            headers={['Date', 'Account', 'Name', 'Note', 'Category', 'Source', 'Money In', 'Money Out', 'Balance']}
            rows={exportRows}
          />
        </div>

        {/* Ledger Table */}
        {book.rows.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Wallet size={36} strokeWidth={1.75} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {lines.length === 0 ? 'No transactions recorded yet in this account.' : 'No entries found matching the selected filters.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 16px', width: 110 }}>Date</th>
                  <th style={{ padding: '10px 12px', width: 90 }}>Account</th>
                  <th style={{ padding: '10px 16px' }}>Description / Contact</th>
                  <th style={{ padding: '10px 16px', width: 140 }}>Category</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', width: 130 }}>Money In</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', width: 130 }}>Money Out</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', width: 140 }}>Balance</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {range.from && (
                  <tr style={{ color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px' }}>{showDate(range.from)}</td>
                    <td style={{ padding: '10px 12px' }}>–</td>
                    <td colSpan={4} style={{ padding: '10px 16px' }}>Opening balance brought forward</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                      {formatCurrency(book.opening)}
                    </td>
                    <td />
                  </tr>
                )}
                {book.rows.map((l) => (
                  <tr key={l.key} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 150ms ease-out' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {showDate(l.date)}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-secondary)',
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}
                      >
                        {renderAccountIcon(l)}
                        <span>{formatAccountBadge(l)}</span>
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {l.name || (l.type === 'in' ? 'Money in' : 'Money out')}
                      </div>
                      {l.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.note}</div>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {l.category && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 4 }}>
                          {l.category}
                        </span>
                      )}
                      {l.source !== 'own' && (
                        <button
                          type="button"
                          onClick={() => onOpenView?.(l.view)}
                          title={`View in ${SOURCE_SCREEN[l.view]}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 6px',
                            background: 'transparent',
                            border: '1px dashed var(--border)',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            marginLeft: l.category ? 6 : 0,
                          }}
                        >
                          <span>{l.label}</span>
                          <ExternalLink size={11} strokeWidth={1.75} />
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>
                      {l.type === 'in' ? formatCurrency(l.amount) : ''}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' }}>
                      {l.type === 'out' ? formatCurrency(l.amount) : ''}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: l.balance < 0 ? '#dc2626' : 'var(--text)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(l.balance)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {l.source === 'own' && (
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(l.entry)}
                            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Edit entry"
                          >
                            <Edit3 size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l.entry)}
                            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#dc2626' }}
                            title="Delete entry"
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '12px 16px', color: 'var(--text)' }}>
                    {search.trim() ? 'Total of filtered lines' : 'Closing Balance'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#059669', whiteSpace: 'nowrap' }}>
                    {formatCurrency(book.totals.in)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#dc2626', whiteSpace: 'nowrap' }}>
                    {formatCurrency(book.totals.out)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: book.closing < 0 ? '#dc2626' : 'var(--text)', whiteSpace: 'nowrap' }}>
                    {search.trim() ? '' : formatCurrency(book.closing)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
