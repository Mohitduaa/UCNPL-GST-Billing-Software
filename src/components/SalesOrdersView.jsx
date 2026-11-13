// v1.10.84 (#135) - Dedicated Sales Orders module (Zoho Books style)
// Tracks customer orders across their full lifecycle:
// Confirmed -> In Production -> Dispatched -> Invoiced -> Paid
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingBag, Search, Plus, Filter, Calendar, Clock,
  CheckCircle2, AlertTriangle, ArrowRight, Eye, Edit3,
  Copy, Trash2, Printer, MessageCircle, FileText, Truck,
  ChevronDown, X, Phone, AlertCircle
} from 'lucide-react';
import ActionsMenu from './ActionsMenu';
import { getAllBills, saveBill, trashBill } from '../store';
import {
  formatCurrency, parseLocalDate, localToday, belongsToProfile,
  SALES_ORDER_STATUSES, SO_STATUS_MAP, getDeliveryDueBadge, billMatchesSearch
} from '../utils';
import { openWhatsAppShare, invoiceShareMessage } from '../utils/share';
import { toast } from './Toast';
import HelpButton from './HelpButton';

const STATUS_OPTIONS = SALES_ORDER_STATUSES;

export default function SalesOrdersView({
  activeProfile,
  onNew,
  onEdit,
  onPrint,
  onDuplicate,
  onConvert,
  onConvertToChallan
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // 'all', 'this-month', 'last-month', 'overdue'
  const [updatingId, setUpdatingId] = useState(null);

  // Load orders for active profile
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const bills = await getAllBills();
      const soList = bills.filter(b => b.invoiceType === 'sales-order' && belongsToProfile(b, activeProfile));
      // Sort newest first
      soList.sort((a, b) => {
        const da = a.invoiceDate || a.data?.details?.invoiceDate || '';
        const db = b.invoiceDate || b.data?.details?.invoiceDate || '';
        return db.localeCompare(da);
      });
      setOrders(soList);
    } catch (err) {
      console.error('Failed to load sales orders:', err);
      toast('Failed to load sales orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Update order status inline without opening editor
  const handleStatusChange = async (order, newStatus) => {
    try {
      setUpdatingId(order.id);
      const updated = {
        ...order,
        orderStatus: newStatus,
        data: {
          ...order.data,
          details: {
            ...order.data?.details,
            orderStatus: newStatus,
          },
        },
      };
      await saveBill(updated, { overwrite: true });
      setOrders(prev => prev.map(o => o.id === order.id ? updated : o));
      const statusLabel = SO_STATUS_MAP[newStatus]?.label || newStatus;
      toast(`Order #${order.invoiceNumber} updated to ${statusLabel}`, 'success');
    } catch (err) {
      console.error('Failed to update status:', err);
      toast('Could not update order status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Trash an order
  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to delete Sales Order #${order.invoiceNumber}?`)) return;
    try {
      await trashBill(order);
      setOrders(prev => prev.filter(o => o.id !== order.id));
      toast(`Sales Order #${order.invoiceNumber} moved to trash`, 'info');
    } catch (err) {
      console.error('Failed to delete sales order:', err);
      toast('Failed to delete sales order', 'error');
    }
  };

  // WhatsApp share
  const handleWhatsApp = (order) => {
    const msg = invoiceShareMessage(order, activeProfile);
    const phone = order.data?.client?.phone || '';
    openWhatsAppShare(phone, msg);
    toast('Opening WhatsApp share…', 'info');
  };

  // Quick metrics
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const confirmed = orders.filter(o => (o.orderStatus || 'confirmed') === 'confirmed' && !o.convertedTo && o.status !== 'cancelled');
    const inProduction = orders.filter(o => o.orderStatus === 'in-production' && o.status !== 'cancelled');
    const dispatched = orders.filter(o => o.orderStatus === 'dispatched' && o.status !== 'cancelled');
    const invoiced = orders.filter(o => o.orderStatus === 'invoiced' || !!o.convertedTo);
    const cancelled = orders.filter(o => o.orderStatus === 'cancelled' || o.status === 'cancelled');

    const overdue = orders.filter(o => {
      if (o.convertedTo || o.orderStatus === 'invoiced' || o.orderStatus === 'cancelled' || o.status === 'cancelled') return false;
      const expDate = o.expectedDate || o.data?.details?.expectedDate || o.data?.details?.dueDate;
      const b = getDeliveryDueBadge(expDate);
      return !!b?.isOverdue;
    });

    return {
      totalCount,
      totalAmount,
      confirmedCount: confirmed.length,
      confirmedAmount: confirmed.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
      inProductionCount: inProduction.length,
      inProductionAmount: inProduction.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
      dispatchedCount: dispatched.length,
      dispatchedAmount: dispatched.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
      invoicedCount: invoiced.length,
      invoicedAmount: invoiced.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0),
      cancelledCount: cancelled.length,
      overdueCount: overdue.length,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Status Filter
      const currentStatus = o.orderStatus || 'confirmed';
      if (statusFilter === 'confirmed' && (currentStatus !== 'confirmed' || !!o.convertedTo || o.status === 'cancelled')) return false;
      if (statusFilter === 'in-production' && (currentStatus !== 'in-production' || o.status === 'cancelled')) return false;
      if (statusFilter === 'dispatched' && (currentStatus !== 'dispatched' || o.status === 'cancelled')) return false;
      if (statusFilter === 'invoiced' && currentStatus !== 'invoiced' && !o.convertedTo) return false;
      if (statusFilter === 'cancelled' && currentStatus !== 'cancelled' && o.status !== 'cancelled') return false;
      if (statusFilter === 'overdue') {
        if (o.convertedTo || currentStatus === 'invoiced' || currentStatus === 'cancelled' || o.status === 'cancelled') return false;
        const expDate = o.expectedDate || o.data?.details?.expectedDate || o.data?.details?.dueDate;
        const b = getDeliveryDueBadge(expDate);
        if (!b?.isOverdue) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const matches = billMatchesSearch(o, searchQuery);
        if (!matches) return false;
      }

      // 3. Date range filter
      if (dateRange === 'this-month') {
        const now = parseLocalDate(localToday());
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = parseLocalDate(o.invoiceDate || o.data?.details?.invoiceDate);
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      } else if (dateRange === 'last-month') {
        const now = parseLocalDate(localToday());
        let y = now.getFullYear();
        let m = now.getMonth() - 1;
        if (m < 0) { m = 11; y -= 1; }
        const d = parseLocalDate(o.invoiceDate || o.data?.details?.invoiceDate);
        if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery, dateRange]);

  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 className="view-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag className="text-primary" size={26} />
              Sales Orders
            </h1>
            <HelpButton title="Sales Orders" doc="invoices#sales-orders" size={18} />
          </div>
          <p className="view-subtitle" style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Track customer orders from confirmation to production, dispatch and invoice.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNew}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.55rem 1rem' }}
          >
            <Plus size={16} strokeWidth={1.75} />
            New Sales Order
          </button>
        </div>
      </div>

      {/* Top KPI Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Total Orders */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 10,
            borderLeft: '4px solid var(--primary)',
            background: statusFilter === 'all' ? 'rgba(30, 64, 175, 0.05)' : undefined,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setStatusFilter('all')}
          title="Click to view all orders"
        >
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em', marginBottom: '0.35rem' }}>Total Orders</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '0.3rem' }}>{metrics.totalCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(metrics.totalAmount)}</div>
        </div>

        {/* Confirmed */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 10,
            borderLeft: '4px solid #2563eb',
            cursor: 'pointer',
            background: statusFilter === 'confirmed' ? 'rgba(37, 99, 235, 0.08)' : undefined,
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
          title="Click to filter Confirmed orders"
        >
          <div style={{ fontSize: '0.76rem', color: '#2563eb', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em', marginBottom: '0.35rem' }}>Confirmed</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '0.3rem', color: '#2563eb' }}>{metrics.confirmedCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(metrics.confirmedAmount)}</div>
        </div>

        {/* In Production */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 10,
            borderLeft: '4px solid #7c3aed',
            cursor: 'pointer',
            background: statusFilter === 'in-production' ? 'rgba(124, 58, 237, 0.08)' : undefined,
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setStatusFilter(statusFilter === 'in-production' ? 'all' : 'in-production')}
          title="Click to filter In Production orders"
        >
          <div style={{ fontSize: '0.76rem', color: '#7c3aed', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em', marginBottom: '0.35rem' }}>In Production</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '0.3rem', color: '#7c3aed' }}>{metrics.inProductionCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(metrics.inProductionAmount)}</div>
        </div>

        {/* Dispatched */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 10,
            borderLeft: '4px solid #d97706',
            cursor: 'pointer',
            background: statusFilter === 'dispatched' ? 'rgba(217, 119, 6, 0.08)' : undefined,
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setStatusFilter(statusFilter === 'dispatched' ? 'all' : 'dispatched')}
          title="Click to filter Dispatched orders"
        >
          <div style={{ fontSize: '0.76rem', color: '#d97706', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em', marginBottom: '0.35rem' }}>Dispatched</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '0.3rem', color: '#d97706' }}>{metrics.dispatchedCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(metrics.dispatchedAmount)}</div>
        </div>

        {/* Invoiced */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 10,
            borderLeft: '4px solid #059669',
            cursor: 'pointer',
            background: statusFilter === 'invoiced' ? 'rgba(5, 150, 105, 0.08)' : undefined,
            transition: 'background-color 0.15s ease',
          }}
          onClick={() => setStatusFilter(statusFilter === 'invoiced' ? 'all' : 'invoiced')}
          title="Click to filter Invoiced orders"
        >
          <div style={{ fontSize: '0.76rem', color: '#059669', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em', marginBottom: '0.35rem' }}>Invoiced</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 700, lineHeight: 1.15, marginBottom: '0.3rem', color: '#059669' }}>{metrics.invoicedCount}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(metrics.invoicedAmount)}</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Orders', count: metrics.totalCount },
              { id: 'confirmed', label: 'Confirmed', count: metrics.confirmedCount },
              { id: 'in-production', label: 'In Production', count: metrics.inProductionCount },
              { id: 'dispatched', label: 'Dispatched', count: metrics.dispatchedCount },
              { id: 'invoiced', label: 'Invoiced', count: metrics.invoicedCount },
              { id: 'overdue', label: 'Overdue', count: metrics.overdueCount, tone: 'danger' },
              { id: 'cancelled', label: 'Cancelled', count: metrics.cancelledCount },
            ].map(tab => {
              const active = statusFilter === tab.id;
              const isOverdueTab = tab.id === 'overdue';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    border: 'none',
                    background: active
                      ? (isOverdueTab ? '#ef4444' : 'var(--primary)')
                      : 'var(--bg-secondary, rgba(0,0,0,0.05))',
                    color: active ? '#fff' : (isOverdueTab && tab.count > 0 ? '#ef4444' : 'var(--text)'),
                    padding: '0.35rem 0.75rem',
                    borderRadius: 20,
                    fontSize: '0.8rem',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span style={{
                      fontSize: '0.72rem',
                      opacity: 0.9,
                      background: active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                      padding: '0.05rem 0.4rem',
                      borderRadius: 10
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Date Controls */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 300px', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', minWidth: 200, flex: 1, maxWidth: 320 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search orders, clients, items…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '1.9rem', fontSize: '0.84rem', height: 34, width: '100%' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <select
              className="form-input"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{ fontSize: '0.84rem', height: 34, width: 'auto', minWidth: 120 }}
            >
              <option value="all">All Dates</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table (Zoho Books Style) */}
      <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: 8 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.03))', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Sales Order #</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Customer Name</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Order Status</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'center' }}>Shipped</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'center' }}>Invoiced</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>Expected Shipment</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Loading sales orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <ShoppingBag size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>No sales orders found</div>
                      <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: 0, fontSize: '0.85rem' }}>
                        {searchQuery || statusFilter !== 'all'
                          ? 'No orders match your filter criteria. Try clearing filters or searching for something else.'
                          : 'Create your first Sales Order to track customer orders, production progress, and convert them to invoices with one click.'}
                      </p>
                      {(!searchQuery && statusFilter === 'all') && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={onNew} style={{ marginTop: '0.5rem' }}>
                          <Plus size={16} /> Create Sales Order
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const currentStatus = order.orderStatus || 'confirmed';
                  const statusCfg = SO_STATUS_MAP[currentStatus] || SO_STATUS_MAP.confirmed;
                  const expDate = order.expectedDate || order.data?.details?.expectedDate || order.data?.details?.dueDate;
                  const dueBadge = getDeliveryDueBadge(expDate);

                  const isShipped = currentStatus === 'dispatched' || currentStatus === 'invoiced';
                  const isInvoiced = currentStatus === 'invoiced' || !!order.convertedTo;

                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s',
                        opacity: order.status === 'cancelled' || currentStatus === 'cancelled' ? 0.65 : 1,
                      }}
                      className="hover:bg-slate-50/5"
                    >
                      {/* Date */}
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                        {order.invoiceDate ? parseLocalDate(order.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>

                      {/* Sales Order Number */}
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => onEdit(order)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--primary)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                              textAlign: 'left',
                              textDecoration: 'underline',
                            }}
                            title="Edit / View Sales Order"
                          >
                            {order.invoiceNumber}
                          </button>
                          {order.convertedTo && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#059669',
                                background: '#d1fae5',
                                padding: '0.1rem 0.35rem',
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                              title={`Converted to Invoice #${order.convertedTo}`}
                            >
                              → {order.convertedTo}
                            </span>
                          )}
                        </div>
                        {order.data?.details?.buyerOrderNo && order.data.details.buyerOrderNo !== order.invoiceNumber && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            PO: {order.data.details.buyerOrderNo}
                          </div>
                        )}
                      </td>

                      {/* Customer Name */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {order.clientName || 'Cash Sale'}
                        </div>
                        {order.data?.client?.phone && (
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Phone size={12} strokeWidth={1.75} /> {order.data.client.phone}
                          </div>
                        )}
                      </td>

                      {/* Order Status Selector */}
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <select
                            value={currentStatus}
                            disabled={updatingId === order.id}
                            onChange={(e) => handleStatusChange(order, e.target.value)}
                            style={{
                              border: `1px solid ${statusCfg.color}44`,
                              background: statusCfg.bg,
                              color: statusCfg.color,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 14,
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'auto',
                            }}
                            title="Change order status"
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Shipped Indicator */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isShipped ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: '#dcfce7',
                              color: '#16a34a',
                            }}
                            title="Dispatched / Shipped"
                          >
                            <CheckCircle2 size={13} />
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--border, #cbd5e1)',
                            }}
                            title="Not shipped"
                          />
                        )}
                      </td>

                      {/* Invoiced Indicator */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isInvoiced ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: '#dcfce7',
                              color: '#16a34a',
                            }}
                            title={order.convertedTo ? `Invoiced as ${order.convertedTo}` : 'Invoiced'}
                          >
                            <CheckCircle2 size={13} />
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--border, #cbd5e1)',
                            }}
                            title="Not invoiced"
                          />
                        )}
                      </td>

                      {/* Expected Shipment Date & Due Alert */}
                      <td style={{ padding: '0.75rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div>{expDate ? parseLocalDate(expDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                        {dueBadge && !isInvoiced && currentStatus !== 'cancelled' && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: dueBadge.color,
                              background: dueBadge.bg,
                              display: 'inline-block',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 4,
                              fontWeight: 600,
                              marginTop: 2,
                            }}
                          >
                            {dueBadge.text}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {formatCurrency(order.totalAmount, order.currency || 'INR')}
                        </div>
                        {isInvoiced && (
                          <div style={{ fontSize: '0.72rem', color: '#059669' }}>
                            Invoiced: {formatCurrency(order.totalAmount, order.currency || 'INR')}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          {/* Quick 1-click Convert to Tax Invoice */}
                          {!order.convertedTo && currentStatus !== 'cancelled' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onConvert(order)}
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}
                              title="Turn this Sales Order into a Tax Invoice"
                            >
                              Convert to Invoice
                            </button>
                          )}

                          {/* Quick 1-click Convert to Delivery Challan */}
                          {!order.convertedTo && currentStatus !== 'dispatched' && currentStatus !== 'cancelled' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onConvertToChallan(order)}
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem' }}
                              title="Create Delivery Challan for this order"
                            >
                              <Truck size={12} style={{ marginRight: 3 }} /> Challan
                            </button>
                          )}

                          {/* Dropdown Menu */}
                          <ActionsMenu
                            items={[
                              { label: 'View / Print', icon: Eye, onClick: () => onPrint(order) },
                              { label: 'Edit', icon: Edit3, onClick: () => onEdit(order) },
                              { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(order) },
                              {
                                label: 'Convert to Tax Invoice',
                                icon: FileText,
                                onClick: () => onConvert(order),
                                hidden: !!order.convertedTo,
                              },
                              {
                                label: 'Convert to Delivery Challan',
                                icon: Truck,
                                onClick: () => onConvertToChallan(order),
                              },
                              { label: 'WhatsApp Share', icon: MessageCircle, tone: 'green', onClick: () => handleWhatsApp(order) },
                              {
                                label: 'Delete',
                                icon: Trash2,
                                tone: 'danger',
                                onClick: () => handleDeleteOrder(order),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
