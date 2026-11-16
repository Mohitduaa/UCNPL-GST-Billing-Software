import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { Home, FileText, Settings, Plus, Users, Package, BarChart3, Wallet, RefreshCw, Receipt, BookOpen, Moon, Sun, Download, X, ShoppingCart, ChevronDown, ChevronRight, Building2, Pencil, HelpCircle, Search, Command, Bell, Calculator, HardDrive, Menu, Heart, Banknote, ShoppingBag, ReceiptText, CheckCircle2, SlidersHorizontal, Clock, AlertTriangle, ClipboardList, Repeat, Lock, Lightbulb, User } from 'lucide-react';
import { getAllProfiles, saveProfile, getEnabledModules, getMenuOrder, onMenuChanged, getAllBills, getAllProducts, getStockAlertSettings, getAllClients, runUpdateNow, getLockStatus } from './store';
import { isModuleEnabled, getUpcomingFilings, countsAsSales, localToday, toLocalIsoDate, DOCS_URL, findLowStock, trackedStock } from './utils';
import { orderedMenu } from './utils/businessTypes';
import { notifyUpdate, canAskToNotify, askToNotify } from './utils/updateNotice';
// v1.10.4 — Route-level lazy loading. Prior App.jsx synchronously
// imported all 12 views (~15k LOC combined), so a first-paint on
// Dashboard downloaded and parsed GSTReturns (1952), InvoiceGenerator
// (2409), IncomeTax (1038), SettingsView (1479), PrintSettings (1294)
// etc. before the user even asked for them.
//
// Now:
//  - Dashboard stays eager — it's the default landing route.
//  - InvoiceGenerator stays eager — new-invoice is the primary action
//    reachable from Ctrl+K / manifest shortcut / big blue button.
//  - Every other view is React.lazy → own Vite chunk → fetched on
//    first navigation only. Suspense fallback is a lightweight spinner.
// Result: smaller initial JS payload; each heavy view chunk-caches
// once fetched.
import Dashboard from './components/Dashboard';
import InvoiceGenerator from './components/InvoiceGenerator';
import SetupWizard from './components/SetupWizard';
import ToastContainer, { toast } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import ConfirmModalContainer from './components/ConfirmModal';
import WelcomeGuide from './components/WelcomeGuide';
import { useAuth } from './utils/authContext.jsx';
import LoginModal from './components/LoginModal.jsx';
const SettingsView = lazy(() => import('./components/SettingsView'));
const ClientsView = lazy(() => import('./components/ClientsView'));
const InventoryView = lazy(() => import('./components/InventoryView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const ExpenseTracker = lazy(() => import('./components/ExpenseTracker'));
const RecurringInvoices = lazy(() => import('./components/RecurringInvoices'));
const ReceiptVoucher = lazy(() => import('./components/ReceiptVoucher'));
const CashBook = lazy(() => import('./components/CashBook'));
const GSTReturns = lazy(() => import('./components/GSTReturns'));
const IncomeTax = lazy(() => import('./components/IncomeTax'));
const PurchaseBills = lazy(() => import('./components/PurchaseBills'));
const ControlPanel = lazy(() => import('./components/ControlPanel'));
const SupportView = lazy(() => import('./components/SupportView'));
const SalesOrdersView = lazy(() => import('./components/SalesOrdersView'));
import StarBanner from './components/StarBanner';
import AppFooter from './components/AppFooter';
import LockButton from './components/LockButton';
import OfflineModeButton from './components/OfflineModeButton';
import { isOfflineMode } from './utils/offlineMode';
import HelpButton from './components/HelpButton';
import { lockNow } from './utils/appLock';
import { getPrintSettings } from './utils/printSettings';

const openDocs = () => window.open(DOCS_URL, '_blank', 'noopener,noreferrer');

// v1.10.4 — Lightweight Suspense fallback shown while a lazy view
// downloads. Purely visual — no data fetching, no state.
function ViewLoading() {
  return (
    <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <span style={{
          display: 'inline-block', width: 14, height: 14, border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Loading…
      </div>
    </div>
  );
}

const MENU_BRAND_KEY = 'gst_menuBrand';

function App() {
  const { currentUser, activeRole, multiUserEnabled, switchUser, can } = useAuth();
  // v1.9.3 — Setup Wizard shown on first-run (before onboardingComplete = true)
  const [showWizard, setShowWizard] = useState(() => {
    try { return !getPrintSettings().onboardingComplete; } catch { return false; }
  });
  const [currentView, setCurrentView] = useState(() => {
    // PWA manifest "shortcuts" deep-link in via ?view=X (e.g. right-clicking
    // the pinned taskbar icon → "New Invoice" opens /?view=new). Honour that
    // before falling back to whatever the user was last looking at.
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('view');
      // v1.10.74 - 'controlpanel' added so ?view=controlpanel deep links work too.
      const valid = ['dashboard', 'new', 'clients', 'inventory', 'expenses', 'purchases', 'recurring', 'receipts', 'cashbook', 'reports', 'filing', 'incometax', 'settings', 'controlpanel', 'support'];
      if (v && valid.includes(v)) {
        // Strip the query string so a refresh doesn't keep snapping back to
        // the shortcut target — only the *first* navigation honours it.
        window.history.replaceState({}, '', window.location.pathname);
        return v;
      }
    } catch { /* sandboxed history API — fall through */ }
    // 'guide' was the built-in User Guide (removed in v1.10.75).
    const last = sessionStorage.getItem('gst_currentView');
    return last && last !== 'guide' ? last : 'dashboard';
  });
  const [profile, setProfile] = useState(null);
  // v1.10.83 - the menu's own name and logo, as last shown (see `brand` below).
  const [menuBrandCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MENU_BRAND_KEY) || 'null'); } catch { return null; }
  });
  useEffect(() => {
    if (!profile) return; // not loaded yet: keep what was there
    try {
      const name = String(profile.businessName || '').trim();
      if (!profile.showInMenu || !name) { localStorage.removeItem(MENU_BRAND_KEY); return; }
      const keep = { showInMenu: true, businessName: name, logo: profile.logo || '' };
      try { localStorage.setItem(MENU_BRAND_KEY, JSON.stringify(keep)); }
      catch { localStorage.setItem(MENU_BRAND_KEY, JSON.stringify({ ...keep, logo: '' })); } // a very large logo: the name at least
    } catch { /* browser storage off: the menu simply waits for the profile */ }
  }, [profile]);
  const [editingBill, setEditingBill] = useState(() => {
    try {
      const saved = sessionStorage.getItem('gst_editingBill');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('freegstbill_theme') === 'dark';
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const retryTimer = useRef(null);

  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const profileLoaded = useRef(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Update notification state. Auto-checks GitHub on mount + every 6h.
  // The user can dismiss a specific version (stored in localStorage) so the
  // banner doesn't keep nagging once they've seen it. A NEW version released
  // after that dismissal will re-show the banner.
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [notifyAsked, setNotifyAsked] = useState(false);
  const updateBannerVisible = updateInfo?.updateAvailable
    && localStorage.getItem('freegstbill_dismissedUpdate') !== updateInfo.latest;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // The server also skips it when Offline mode is on, but it reads the
      // copy in the data folder, which can lag behind this browser's.
      if (isOfflineMode()) return;
      try {
        const res = await fetch('/api/check-update');
        const data = await res.json();
        if (!cancelled) setUpdateInfo(data);
        // v1.10.84 - and a Windows notification, once per version (if allowed).
        if (!cancelled && data?.updateAvailable && localStorage.getItem('freegstbill_dismissedUpdate') !== data.latest) notifyUpdate(data.latest);
      } catch { /* offline — quietly skip */ }
    };
    // First check ~5 seconds after mount so it doesn't fight the initial load.
    const initial = setTimeout(check, 5000);
    // Then re-check every 6 hours while the app is open.
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(initial); clearInterval(interval); };
  }, []);

  // ---- Notification centre ----
  // Computed from server data on app boot + every 10 minutes; tucked under a
  // bell icon next to dark-mode toggle in the sidebar. Each section is one
  // click away from the relevant page.
  const [notifications, setNotifications] = useState({ overdue: [], dueSoon: [], lowStock: [], filings: [], autoFire: null });
  const [showNotifs, setShowNotifs] = useState(false);

  // v1.10.62 — reported (#53, @sangwanmail-eng): "Notifications should clear
  // after check."
  //
  // They never did, and the reason is that these are not messages — they are
  // computed live from your data every time the app loads ("3 invoices are
  // overdue", "2 products are low on stock"). There was no notion of having
  // read one, so the badge simply reported what was true and stayed lit
  // forever.
  //
  // Marking them read cannot just hide them, though: if an invoice goes
  // overdue tomorrow you must be told, even if you dismissed yesterday's
  // overdue notice. So dismissal is recorded per section as a SIGNATURE of
  // what was actually shown — the specific invoice numbers, the specific
  // products. Dismissing stores that signature; the section stays quiet only
  // while the signature is unchanged. The moment the underlying facts differ
  // — a new overdue invoice, a different product running low — the signature
  // changes and the alert comes back on its own.
  //
  // Kept in localStorage: it is a per-machine reading preference, not
  // business data, and it must not travel in a backup or sync to another PC.
  const DISMISS_KEY = 'fgsb_dismissedNotifs';
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
  });

  const notifSignatures = useMemo(() => ({
    overdue: notifications.overdue.map(b => b.invoiceNumber || b.id).sort().join('|'),
    dueSoon: notifications.dueSoon.map(b => b.invoiceNumber || b.id).sort().join('|'),
    lowStock: notifications.lowStock.map(p => `${p.id || p.name}:${p.stock ?? ''}`).sort().join('|'),
    filings: notifications.filings.map(f => f.label || f.id || String(f)).sort().join('|'),
    autoFire: notifications.autoFire?.count > 0 ? `autofire:${notifications.autoFire.count}` : '',
  }), [notifications]);

  // A section counts toward the badge only when it has content AND that
  // content is not the exact thing the user already dismissed.
  const isLive = (key) => !!notifSignatures[key] && dismissed[key] !== notifSignatures[key];

  const notifTotal = (isLive('overdue') ? notifications.overdue.length : 0)
    + (isLive('dueSoon') ? notifications.dueSoon.length : 0)
    + (isLive('lowStock') ? notifications.lowStock.length : 0)
    + (isLive('filings') ? notifications.filings.length : 0)
    + (isLive('autoFire') ? 1 : 0);

  // How many sections are currently showing something that could be cleared.
  const dismissableCount = ['overdue', 'dueSoon', 'lowStock', 'filings', 'autoFire']
    .filter(isLive).length;

  const markAllNotifsRead = () => {
    const next = { ...dismissed, ...notifSignatures };
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  useEffect(() => {
    let cancelled = false;
    const compute = async () => {
      try {
        const [bills, products, stockAlertCfg] = await Promise.all([
          getAllBills().catch(() => []),
          getAllProducts().catch(() => []),
          getStockAlertSettings().catch(() => ({ enabled: true, threshold: 5 })),
        ]);
        if (cancelled) return;
        // Local dates: toISOString() is UTC (yesterday in India until 05:30),
        // while the server stamps lastRecurringAutoFire with its local date.
        const today = localToday();
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 3);
        const tomorrowStr = toLocalIsoDate(tomorrow);
        // v1.10.67 (#66 item 12) — never chase payment for a cancelled invoice;
        // nor for a quotation, proforma, challan or credit note (countsAsSales).
        const overdue = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d < today && b.status !== 'paid' && countsAsSales(b);
        });
        const dueSoon = bills.filter(b => {
          const d = b.data?.details?.dueDate;
          return d && d >= today && d <= tomorrowStr && b.status !== 'paid' && countsAsSales(b);
        });
        // Honour the user's stock-alert preferences. When disabled, the filter
        // returns nothing — bell badge drops to 0 for the stock category.
        // When enabled, use the configured threshold (default 5).
        const stockThreshold = Number(stockAlertCfg?.threshold ?? 5);
        const lowStock = stockAlertCfg?.enabled === false
          ? []
          : findLowStock(products, stockThreshold); // services and uncounted left out (#121)
        const filings = getUpcomingFilings().filter(f => f.daysAway <= 10);
        // Recurring auto-fire breadcrumb — set by server.js processDueRecurring().
        // Only "fresh" (today's) auto-fires count as a notification; older ones
        // would otherwise stay sticky forever.
        let autoFire = null;
        try {
          const r = await fetch('/api/meta/lastRecurringAutoFire');
          if (r.ok) {
            const j = await r.json();
            if (j.value && j.value.date === today && j.value.count > 0) autoFire = j.value;
          }
        } catch { /* fine */ }
        setNotifications({ overdue, dueSoon, lowStock, filings, autoFire });
      } catch { /* offline / server down — leave previous counts */ }
    };
    compute();
    const interval = setInterval(compute, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentView]); // recompute on view change so the bell stays fresh after the user records a payment

  // ---- Keyboard shortcuts + command palette ----
  // Ctrl+K opens a Spotlight-style command palette; Ctrl+N starts a new
  // invoice from anywhere; Ctrl+/ shows the full shortcuts list. Ctrl+S /
  // Ctrl+P live in InvoiceGenerator (they need invoice-form context). All
  // global handlers also accept Meta (⌘) for macOS users.
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  // v1.9.4 — pre-load searchable content so Ctrl+K acts as a true global
  // search across invoices, clients, products, and settings sections.
  // Small cost (fires once on mount + when palette opens); big UX win.
  const [searchCorpus, setSearchCorpus] = useState({ bills: [], clients: [], products: [] });
  useEffect(() => {
    Promise.all([
      getAllBills().catch(() => []),
      getAllClients().catch(() => []),
      getAllProducts().catch(() => []),
    ]).then(([bills, clients, products]) => {
      setSearchCorpus({
        bills: bills.slice(0, 100),
        clients: clients.slice(0, 200),
        products: products.slice(0, 200),
      });
    });
  }, [showPalette]); // refresh when palette opens
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Palette useMemo + dependent effects are declared further down, AFTER
  // `navItems` and `handleNewInvoice` exist. Declaring them up here would
  // throw "Cannot access 'X' before initialization" at render time because
  // useMemo's dependency array is evaluated synchronously every render.

  // v1.10.69 - see runUpdateNow() in store.js for why this is no longer a link.
  const [updating, setUpdating] = useState(false);
  const handleUpdateNow = async () => {
    setUpdating(true);
    toast('Updating… your data is backed up first. This takes about a minute.', 'info', 8000);
    const result = await runUpdateNow();
    setUpdating(false);
    if (result.ok) {
      setShowUpdateModal(false);
      toast('Update finished. Reload the page to use the new version.', 'success', 10000);
    } else {
      toast(`Update failed — ${result.error}`, 'error', 10000);
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.latest) {
      localStorage.setItem('freegstbill_dismissedUpdate', updateInfo.latest);
      // v1.10.6 — audit L10: was `setUpdateInfo(prev => prev ? { ...prev }
      // : prev)` "to trigger re-render". No-op — `setShowUpdateModal(false)`
      // below already re-renders, and `updateBannerVisible` reads
      // localStorage every render so the new dismissal is picked up.
    }
    setShowUpdateModal(false);
  };

  // Check if server is running — continuously monitors
  useEffect(() => {
    let cancelled = false;
    // v1.10.73 - a busy or older PC can take a few seconds to answer. One
    // slow reply used to replace the whole app with "Needs a Quick Start"
    // mid-invoice. Once the app has loaded, it now takes 3 missed checks in a
    // row (about 15 s) before saying the app is not running; before the first
    // load it still says so straight away.
    let misses = 0;

    const checkServer = async () => {
      try {
        // v1.10.84 - is the app's server really running? A GET can be answered
        // by the offline copy (the api-cache), so with the server stopped the
        // app showed old data with a green "running" dot. HEAD reaches the
        // server or fails.
        const live = await fetch('/api/profile', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (live.ok) {
          if (cancelled) return;
          misses = 0;
          setServerDown(false);
          setServerStatus('online');
          if (!profileLoaded.current) {
            const res = await fetch('/api/profile', { signal: AbortSignal.timeout(8000) });
            if (!res.ok) throw new Error('not ok');
            profileLoaded.current = true;
            const p = await res.json();
            setProfile(p);
            if (!p.businessName && !localStorage.getItem('freegstbill_onboarded')) {
              setShowWelcome(true);
            }
          }
          return;
        }
        throw new Error('not ok');
      } catch {
        if (cancelled) return;
        misses += 1;
        if (!profileLoaded.current || misses >= 3) {
          setServerDown(true);
          setServerStatus('offline');
        }
      }
    };

    checkServer();
    // Keep checking every 5 seconds (fast when down, normal heartbeat when up)
    retryTimer.current = setInterval(checkServer, 5000);

    return () => {
      cancelled = true;
      if (retryTimer.current) clearInterval(retryTimer.current);
    };
  }, []);

  // v1.10.83 - the "Install as Desktop App" banner is gone. The browser icon
  // it made opens only a browser window: it cannot start the app's server, so
  // after a restart it showed "Needs a Quick Start". The installers' own
  // UCNPL Billing icon starts the server and opens the app.

  useEffect(() => {
    sessionStorage.setItem('gst_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (editingBill) {
      // _printOnOpen is a one-shot request; a refresh must not print again.
      const { _printOnOpen, ...toKeep } = editingBill;
      sessionStorage.setItem('gst_editingBill', JSON.stringify(toKeep));
    } else {
      sessionStorage.removeItem('gst_editingBill');
    }
  }, [editingBill]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('freegstbill_theme', darkMode ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', darkMode ? '#1c1c1a' : '#c96442');
  }, [darkMode]);

  // Load all saved business profiles
  useEffect(() => {
    if (serverStatus === 'online') {
      getAllProfiles().then(setAllProfiles).catch(() => {});
    }
  }, [serverStatus]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  const handleSwitchProfile = async (bp) => {
    setShowProfileMenu(false);
    const loaded = { ...bp };
    delete loaded.id;
    await saveProfile(loaded);
    setProfile(loaded);
  };

  // v1.10.66 (#64 item 1) — identifies the active business for the screens
  // keyed on it below. GSTIN first, the same rule belongsToProfile() uses to
  // decide which records a business owns; the name covers a business that has
  // no GSTIN yet.
  const businessKey = String(profile?.gstin || profile?.businessName || '').trim().toUpperCase();

  // v1.10.66 (#59) — on a phone the sidebar is a slide-in menu. It closes as
  // soon as something in it is chosen, so picking a page never leaves the menu
  // covering the page that was just asked for. Opening the business list is
  // the one exception: that choice is not finished yet.
  const [navOpen, setNavOpen] = useState(false);
  const closeNavAfterPick = (e) => {
    const picked = e.target.closest('button');
    if (picked && !picked.classList.contains('profile-switcher-btn')) setNavOpen(false);
  };

  // v1.10.76 - a fresh editor for every invoice opened, so nothing (such as
  // the stock record of the last invoice) carries over to the next one.
  const [editorKey, setEditorKey] = useState(0);
  // v1.10.77 (#84) - sidebar auto-hide (desktop): a slim strip of icons that
  // opens over the page when pointed at, for more room on small screens.
  const [sidebarAutoHide, setSidebarAutoHide] = useState(() => {
    try { return localStorage.getItem('freegstbill_sidebarAutoHide') === '1'; } catch { return false; }
  });
  const toggleSidebarAutoHide = (on) => {
    setSidebarAutoHide(on);
    try { localStorage.setItem('freegstbill_sidebarAutoHide', on ? '1' : '0'); } catch { /* private mode */ }
  };
  const handleNewInvoice = () => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(null);
    setCurrentView('new');
  };

  const handleEditInvoice = (bill) => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill(bill);
    setCurrentView('new');
  };

  // v1.10.77 (#86) - Print from the Dashboard row: opens the invoice just long
  // enough to build the same PDF the invoice screen prints (same pages, HD),
  // prints it, and comes back.
  const handlePrintInvoice = (bill) => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    setEditingBill({ ...bill, _printOnOpen: true });
    setCurrentView('new');
  };

  const handleDuplicateInvoice = (bill) => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleConvertToInvoice = (bill) => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    clone._convertToType = 'tax-invoice';
    if (bill.invoiceType === 'sales-order' && clone.data?.details) {
      if (!clone.data.details.buyerOrderNo) {
        clone.data.details.buyerOrderNo = bill.invoiceNumber;
      }
      if (!clone.data.details.buyerOrderDate && (bill.invoiceDate || bill.data?.details?.invoiceDate)) {
        clone.data.details.buyerOrderDate = bill.invoiceDate || bill.data.details.invoiceDate;
      }
    }
    setEditingBill(clone);
    setCurrentView('new');
  };

  const handleConvertToChallan = (bill) => {
    setEditorKey((k) => k + 1);
    sessionStorage.removeItem('gst_invoiceDraft');
    const clone = JSON.parse(JSON.stringify(bill));
    clone._isDuplicate = true;
    clone._convertToType = 'delivery-challan';
    if (bill.invoiceType === 'sales-order' && clone.data?.details) {
      if (!clone.data.details.buyerOrderNo) {
        clone.data.details.buyerOrderNo = bill.invoiceNumber;
      }
      if (!clone.data.details.buyerOrderDate && (bill.invoiceDate || bill.data?.details?.invoiceDate)) {
        clone.data.details.buyerOrderDate = bill.invoiceDate || bill.data.details.invoiceDate;
      }
    }
    setEditingBill(clone);
    setCurrentView('new');
  };

  // Pull the user's module preferences once per render. Re-mount happens
  // when settings save, which triggers a re-render via the profile state.
  const enabledModules = getEnabledModules();
  const showIfModule = (moduleId) => isModuleEnabled(moduleId, enabledModules);
  // v1.10.83 - a switch or a new order in Settings → Features redraws the
  // sidebar straight away.
  const [, setMenuTick] = useState(0);
  useEffect(() => onMenuChanged(() => setMenuTick(t => t + 1)), []);
  // Sidebar items in the saved order; hidden ones dropped. `module: null`
  // items (Settings, Support & About, Lock app) are always shown.
  const menu = orderedMenu(getMenuOrder()).filter(m => !m.module || showIfModule(m.module));

  // If the user just disabled the module backing the current view, kick them to dashboard
  // so they don't land on an empty page after toggling.
  useEffect(() => {
    const map = { salesorders: 'salesOrders', new: 'invoicing', clients: 'clients', inventory: 'inventory', expenses: 'expenses', purchases: 'purchases', recurring: 'recurring', receipts: 'receipts', cashbook: 'cashBook', reports: 'reports', filing: 'gstReturns', incometax: 'incomeTax' };
    const moduleForView = map[currentView];
    if (moduleForView && !isModuleEnabled(moduleForView, enabledModules)) {
      setCurrentView('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, JSON.stringify(enabledModules)]);

  // v1.10.83 - order, labels and switches come from MENU_ITEMS (utils.js);
  // only the icons and click handlers live here.
  const NAV_EXTRAS = {
    dashboard: { icon: Home, label: 'Dashboard' },
    salesorders: { icon: ShoppingBag, label: 'Sales Orders' },
    new: { icon: Plus, label: 'New Invoice', onClick: handleNewInvoice },
    clients: { icon: Users, label: 'Clients' },
    inventory: { icon: Package, label: 'Products' },
    expenses: { icon: Wallet, label: 'Expenses' },
    purchases: { icon: ShoppingCart, label: 'Purchases' },
    recurring: { icon: RefreshCw, label: 'Recurring' },
    receipts: { icon: Receipt, label: 'Receipts' },
    cashbook: { icon: Banknote, label: 'Cash book' },
    reports: { icon: BarChart3, label: 'Reports' },
    filing: { icon: BookOpen, label: 'GST Returns' },
    incometax: { icon: Calculator, label: 'Income Tax' },
    // v1.10.75 - opens the online documentation, which covers every screen
    // and stays current; the old built-in guide had fallen far behind.
    guide: { icon: HelpCircle, label: 'User Guide', onClick: openDocs },
  };
  const navItems = menu
    .filter(m => m.section === 'main')
    .filter(m => {
      if (m.id === 'reports' && !can('reports.view')) return false;
      if (m.id === 'incometax' && !can('reports.view')) return false;
      if (m.id === 'filing' && !can('gst.view')) return false;
      if (m.id === 'purchases' && !can('purchases.view')) return false;
      if (m.id === 'expenses' && !can('purchases.view')) return false;
      if (m.id === 'cashbook' && !can('purchases.view')) return false;
      if (m.id === 'inventory' && !can('inventory.view')) return false;
      if (m.id === 'clients' && !can('customers.view')) return false;
      return true;
    })
    .map(m => ({ id: m.id, ...NAV_EXTRAS[m.id] }));
  const bottomIds = menu
    .filter(m => m.section === 'bottom')
    .filter(m => {
      if (m.id === 'settings' && !can('settings.manage')) return false;
      return true;
    })
    .map(m => m.id);
  // v1.10.83 - small buttons at the top right of every screen (asked for:
  // "dark mode button should be on top, not in the sidebar").
  const topIds = menu.filter(m => m.section === 'top').map(m => m.id);
  // v1.10.83 - the business's own name and logo at the top of the menu, when
  // it says so (Settings → Branding, or the first-run setup).
  // The profile comes from the server a moment after the first paint; until
  // then the menu uses the name and logo it showed last time (kept in this
  // browser), so a refresh does not flash "GST Billing" before the logo.
  const brand = profile || menuBrandCache;
  const ownBrand = !!brand?.showInMenu && !!String(brand?.businessName || '').trim();
  // The window's title bar shows the page and the business, like a desktop
  // program ("Invoices - Dice Codes"), not the long search-engine title.
  const pageLabel = (NAV_EXTRAS[currentView] || menu.find(m => m.id === currentView))?.label;
  const windowName = String(brand?.businessName || '').trim() || 'UCNPL Billing';
  // v1.10.84 - and says so when an update is waiting (the taskbar shows it too).
  const updateNote = updateBannerVisible ? ` (update ${updateInfo.latest} available)` : '';
  // View permission guard
  useEffect(() => {
    if (currentView === 'reports' && !can('reports.view')) setCurrentView('dashboard');
    if (currentView === 'incometax' && !can('reports.view')) setCurrentView('dashboard');
    if (currentView === 'filing' && !can('gst.view')) setCurrentView('dashboard');
    if (currentView === 'purchases' && !can('purchases.view')) setCurrentView('dashboard');
    if (currentView === 'expenses' && !can('purchases.view')) setCurrentView('dashboard');
    if (currentView === 'cashbook' && !can('purchases.view')) setCurrentView('dashboard');
    if (currentView === 'inventory' && !can('inventory.view')) setCurrentView('dashboard');
    if (currentView === 'clients' && !can('customers.view')) setCurrentView('dashboard');
    if (currentView === 'settings' && !can('settings.manage')) setCurrentView('dashboard');
  }, [currentView, can]);

  useEffect(() => {
    document.title = (pageLabel ? `${pageLabel} - ${windowName}` : windowName) + updateNote;
  }, [pageLabel, windowName, updateNote]);
  const topActions = topIds.map(id => ({
    guide: (
      <button key={id} type="button" className="topbar-btn" onClick={openDocs}
        title="User guide (opens in your browser)" aria-label="User guide">
        <HelpCircle size={18} />
      </button>
    ),
    /* Opens the list of overdue / due-soon invoices, GST filing deadlines and
       low-stock items, each a click away from the page that fixes it. */
    notifications: (
      <button key={id} type="button" className="topbar-btn" onClick={() => setShowNotifs(s => !s)}
        title="Notifications" aria-label={notifTotal > 0 ? `Notifications: ${notifTotal}` : 'Notifications'}>
        <Bell size={18} />
        {notifTotal > 0 && <span className="topbar-badge">{notifTotal > 99 ? '99+' : notifTotal}</span>}
      </button>
    ),
    /* v1.10.80 (#98) - only when a PIN is set. */
    lock: <LockButton key={id} className="topbar-btn" label={null} />,
    /* v1.10.83 - Offline mode on / off, and what it changes. */
    offline: <OfflineModeButton key={id} className="topbar-btn" onOpenSettings={() => {
      try { sessionStorage.setItem('gst_settingsTab', 'section-privacy'); } catch { /* storage blocked */ }
      setCurrentView('settings');
    }} />,
    darkMode: (
      <button key={id} type="button" className="topbar-btn" onClick={() => setDarkMode(d => !d)}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={darkMode ? 'Light mode' : 'Dark mode'}>
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    ),
  })[id]);

  // Command palette actions — declared here (not earlier) because the deps
  // array references `navItems` and `handleNewInvoice`, which are consts.
  // Reading a const before its declaration triggers a Temporal Dead Zone
  // ReferenceError ("Cannot access 'X' before initialization") at runtime.
  const paletteActions = useMemo(() => {
    const acts = [
      { label: 'New Invoice', hint: 'Ctrl+N', category: 'action', run: () => { handleNewInvoice(); } },
    ];
    navItems.forEach(item => {
      if (item.id === 'new') return; // already covered above
      acts.push({ label: `Go to ${item.label}`, hint: '', category: 'nav', run: item.onClick || (() => setCurrentView(item.id)) });
    });
    acts.push({ label: 'Go to Settings', hint: '', category: 'nav', run: () => setCurrentView('settings') });
    // v1.10.74 - Control Panel has its own sidebar button but was missing here.
    // v1.10.83 - and, like every menu item, not when it is switched off.
    if (bottomIds.includes('controlpanel')) acts.push({ label: 'Go to Control Panel', hint: '', category: 'nav', run: () => setCurrentView('controlpanel') });
    acts.push({ label: 'Go to Support & About', hint: '', category: 'nav', run: () => setCurrentView('support') });
    if (topIds.includes('guide')) acts.push({ label: 'Open the User Guide', hint: '', category: 'help', run: openDocs });
    acts.push({ label: 'Toggle dark mode', hint: '', category: 'action', run: () => setDarkMode(d => !d) });
    acts.push({ label: 'Show keyboard shortcuts', hint: 'Ctrl+/', category: 'help', run: () => setShowShortcutsHelp(true) });
    if (updateInfo?.updateAvailable) {
      acts.push({ label: `View update — v${updateInfo.latest}`, hint: '', category: 'update', run: () => setShowUpdateModal(true) });
    }
    // v1.9.4 — cross-app search: invoices, clients, products
    // v1.10.5 — audit H24 fix. Prior code dispatched
    // `CustomEvent('fgsb-open-bill', { detail: b.id })` but no one
    // listened for it — selecting an invoice in the palette silently
    // dropped the ID and just landed on Dashboard. Now: reuse
    // handleEditInvoice() directly, which is already the canonical way
    // to open a bill for editing (works from Dashboard row-click too).
    searchCorpus.bills.forEach(b => {
      acts.push({
        icon: FileText, label: `${b.invoiceNumber || 'INV-?'} — ${b.clientName || 'No client'}`,
        hint: b.invoiceDate ? new Date(b.invoiceDate).toLocaleDateString('en-IN') : '',
        category: 'invoice',
        run: () => handleEditInvoice(b),
      });
    });
    searchCorpus.clients.forEach(c => {
      acts.push({
        icon: User, label: `${c.name} — client${c.gstin ? ' · GSTIN: ' + c.gstin : ''}`,
        hint: c.phone || c.email || '',
        category: 'client',
        run: () => setCurrentView('clients'),
      });
    });
    // v1.10.83 - a product result opens Products, so none while it is hidden.
    if (navItems.some(i => i.id === 'inventory')) searchCorpus.products.forEach(p => {
      acts.push({
        icon: Package, label: `${p.name} — product${p.hsn ? ' · HSN: ' + p.hsn : ''}`,
        hint: trackedStock(p) === null ? '' : trackedStock(p) + ' in stock',
        category: 'product',
        run: () => setCurrentView('inventory'),
      });
    });
    // Settings sections (jump to specific area)
    // v1.10.74 - these all used to just open Settings at the top. Each now
    // names its section id; after Settings mounts (it's lazy-loaded, so retry
    // briefly) we click that section's "Jump to" chip, which already scrolls
    // below the sticky bars.
    // v1.10.84 - Settings has 6 tabs of several sections: it opens the
    // section's tab and scrolls to it (first open: sessionStorage; already
    // open: the event SettingsView listens for).
    const openSettingsAt = (sectionId) => {
      try { sessionStorage.setItem('gst_settingsTab', sectionId); } catch { /* storage blocked */ }
      setCurrentView('settings');
      setTimeout(() => window.dispatchEvent(new CustomEvent('fgsb:settings-open', { detail: sectionId })), 80);
    };
    const settingsJumps = [
      ['Company profile', 'section-company'], ['Payment accounts', 'section-company'],
      ['Print & PDF Settings', 'section-print'], ['PDF Style Editor', 'section-print'],
      ['Business type presets', 'section-print'], ['Section labels', 'section-print'],
      ['Watermarks', 'section-print'], ['Multi-copy print', 'section-print'],
      ['Digital signature', 'section-company'], ['Company letterhead', 'section-print'],
      ['Business type', 'section-biztype'], ['Features', 'section-modules'], ['Region preference', 'section-region'],
      ['Google Drive backup', 'section-cloud'], ['App updates', 'section-updates'],
    ];
    settingsJumps.forEach(([s, sectionId]) => {
      acts.push({ icon: Settings, label: `Settings → ${s}`, hint: '', category: 'settings', run: () => openSettingsAt(sectionId) });
    });
    return acts;
  }, [navItems, bottomIds, topIds, updateInfo, handleNewInvoice, searchCorpus]);

  const filteredPalette = paletteActions.filter(a =>
    !paletteQuery.trim() || a.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // Global keyboard shortcuts. Lives down here for the same TDZ reason —
  // the handler closes over `handleNewInvoice` which is declared above only.
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const tag = (e.target?.tagName || '').toLowerCase();
      const editable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowPalette(p => !p);
        setPaletteQuery('');
        setPaletteIdx(0);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(s => !s);
      } else if ((e.key === 'l' || e.key === 'L') && e.shiftKey) {
        // v1.10.80 (#98) - lock now; does nothing when no PIN is set.
        e.preventDefault();
        getLockStatus().then((st) => { if (st?.enabled) lockNow(); }).catch(() => {});
      } else if ((e.key === 'n' || e.key === 'N') && !editable) {
        e.preventDefault();
        handleNewInvoice();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v1.9.4 — Accessibility hooks (v1.10.4/1.10.6 updated):
  //   1. Mirror `title` → `aria-label` on every icon button that lacks one.
  //      Runs on mount + via a MutationObserver when the DOM adds new
  //      icon buttons (bulk toolbars, modals, etc.). See M15.
  //   2. Global ESC handler for any open `.modal-overlay` — clicks the
  //      backdrop (which triggers the overlay's own close). No CSS
  //      class is added; the earlier `.esc-closable` idea was never
  //      implemented, comment cleaned up (audit L7).
  useEffect(() => {
    // v1.10.4 — audit M15. Prior code polled the DOM every 3 seconds
    // to mirror title→aria-label on new .icon-btn elements. Constant
    // idle-time work for a paper-thin accessibility win. Replaced with
    // a MutationObserver that fires ONLY when new buttons enter the
    // DOM. Existing buttons get the treatment once at mount.
    const mirrorTitleToAria = (root = document) => {
      root.querySelectorAll('button.icon-btn[title]:not([aria-label])').forEach(btn => {
        btn.setAttribute('aria-label', btn.getAttribute('title'));
      });
    };
    mirrorTitleToAria();
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {  // Element
              if (node.matches?.('button.icon-btn[title]:not([aria-label])')) {
                node.setAttribute('aria-label', node.getAttribute('title'));
              }
              mirrorTitleToAria(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Global ESC → click the topmost modal-overlay (dismisses it).
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
      const top = overlays[overlays.length - 1];
      if (!top) return;
      if (showPalette) return;
      top.click();
    };
    window.addEventListener('keydown', onEsc);
    return () => { observer.disconnect(); window.removeEventListener('keydown', onEsc); };
  }, [showPalette]);

  // Palette-only arrow / Enter / Esc nav. Filtered list dep keeps the
  // handler in sync with the user's current query.
  useEffect(() => {
    if (!showPalette) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowPalette(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx(i => Math.min(i + 1, filteredPalette.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const action = filteredPalette[paletteIdx];
        if (action) { action.run(); setShowPalette(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPalette, paletteIdx, filteredPalette]);

  // v1.10.84 (maintainer, 7 Nov: "this window should never come") - inside the
  // Windows Setup's own window (WebView2 gives every page window.chrome.webview)
  // the window starts the app again by itself, and an update stops it for a
  // moment. No instructions there: the start screen's look until it answers
  // (the check below every 5 s brings the app back by itself). A browser or
  // the ZIP's launcher still gets the Quick Start help.
  if (serverDown && typeof window !== 'undefined' && window.chrome?.webview) {
    return (
      <div className="app-window-starting" role="status" aria-live="polite" style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem',
        background: 'var(--ground, #faf9f5)', color: 'var(--text, #141413)',
        fontFamily: 'var(--font-sans, "Montserrat", sans-serif)',
      }}>
        <img src="/icons/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 16 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>UCNPL Billing</h2>
        <div className="server-down-waiting"><div className="server-down-spinner" /><span>Starting again…</span></div>
      </div>
    );
  }

  if (serverDown) {
    return (
      <div className="server-down-overlay">
        <div className="server-down-modal">
          <img src="/icons/icon-192.png" alt="UCNPL Billing" width={56} height={56} style={{ borderRadius: 14, marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(201, 100, 66, 0.25)' }} />
          <h2>UCNPL Billing Needs a Quick Start <HelpButton title="Needs a Quick Start" doc="shortcuts#app-not-running" size={16} /></h2>
          <p>
            Your data is <strong>100% safe</strong> on your computer — nothing is lost.
            The app just needs to be started once.
          </p>
          <div className="server-down-steps">
            <p className="server-down-hint">How to start it:</p>
            <ol>
              <li>Double-click the <strong>UCNPL Billing</strong> icon on your Desktop</li>
              <li>Or search <strong>"UCNPL Billing"</strong> in the Start Menu</li>
            </ol>
            <p className="server-down-hint">Opened this from a Chrome or Edge app icon? That icon cannot start the app. Use the UCNPL Billing icon instead; you can remove the other one (right-click it, then Uninstall).</p>
          </div>
          <p className="server-down-safe">All your invoices, clients, and data are safely stored on your computer. They are never deleted or shared.</p>
          <div className="server-down-waiting">
            <div className="server-down-spinner" />
            <span>Starting... this page will open automatically.</span>
          </div>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <>
        <WelcomeGuide onComplete={(p) => {
          if (p) setProfile(p);
          setShowWelcome(false);
        }} />
        <ToastContainer />
        <ConfirmModalContainer />
      <LoginModal />
      </>
    );
  }

  // v1.10.33 — "Finish setup" bottom-right pill. Shown when the user
  // hit Skip on the wizard (onboardingSkipped=true) so they can come
  // back later without hunting through Settings. Hidden after they
  // finish setup (finish() clears the flag) or if they explicitly said
  // "None of these — I'll configure manually".
  const showResumeSetupPill = (() => {
    try {
      const ps = getPrintSettings();
      return !showWizard && ps.onboardingComplete === true && ps.onboardingSkipped === true;
    } catch { return false; }
  })();

  return (
    <div className={`app-layout${sidebarAutoHide ? ' sidebar-autohide' : ''}`}>
      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
      {showResumeSetupPill && (
        <button type="button"
          onClick={() => setShowWizard(true)}
          title="Come back to the setup wizard — pick a business type, paper size, and language."
          style={{
            // Above the docked Save bar on Settings, so it never covers Save.
            position: 'fixed', bottom: currentView === 'settings' ? '5.5rem' : '1.25rem', right: '1.25rem', zIndex: 9998,
            padding: '0.6rem 1rem', borderRadius: 999,
            background: 'var(--primary)', color: '#fff', border: 'none',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(30,64,175,0.35), 0 2px 4px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
          <CheckCircle2 size={16} strokeWidth={1.75} /> Finish setup
        </button>
      )}
      {/* v1.10.66 (#59) — phone-only top bar with the menu button. CSS hides it
          on wider screens, where the sidebar is always shown. */}
      <div className="mobile-topbar">
        <button type="button" className="mobile-topbar-btn" onClick={() => setNavOpen(true)}
          aria-label="Open menu" aria-expanded={navOpen}>
          <Menu size={22} />
        </button>
        <span className="mobile-topbar-title">UCNPL Billing</span>
        <span className="mobile-topbar-business">{profile?.businessName || ''}</span>
        {topActions}
      </div>
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <div className={`sidebar${navOpen ? ' sidebar-open' : ''}`} onClick={closeNavAfterPick}>
        <div className="sidebar-brand">
          <div className={`sidebar-logo${ownBrand && brand.logo ? ' sidebar-logo-own' : ''}`}>
            {ownBrand && brand.logo ? <img src={brand.logo} alt="" />
              : ownBrand ? <span className="sidebar-logo-letter">{brand.businessName.trim().charAt(0).toUpperCase()}</span>
                : <ReceiptText size={22} color="#ffffff" />}
          </div>
          {/* "Free" is
              in the top bar; on a phone (no top bar) it stays here. */}
          <div className="sidebar-brand-text">
            <h2 className={`sidebar-title${ownBrand ? ' sidebar-title-own' : ''}`} title={ownBrand ? `${brand.businessName} - UCNPL Billing` : undefined}>{ownBrand ? brand.businessName : 'UCNPL Billing'}</h2>
          </div>
          {/* Auto-hide as a ☰ button (was a text checkbox): pressed = the menu
              shrinks to icons and opens when pointed at. */}
          <button type="button" className={`sidebar-autohide-toggle${sidebarAutoHide ? ' on' : ''}`}
            aria-pressed={sidebarAutoHide} aria-label="Auto-hide menu"
            title={sidebarAutoHide ? 'Keep this menu open' : 'Auto-hide this menu: icons only, it opens when you point at it'}
            onClick={(e) => { e.stopPropagation(); toggleSidebarAutoHide(!sidebarAutoHide); }}>
            <Menu size={18} />
          </button>
        </div>

        <div className="profile-switcher" ref={profileMenuRef} style={{ position: 'relative' }}>
          <div className="profile-switcher-row">
            <button
              className="profile-switcher-btn"
              onClick={() => allProfiles.length > 1 && setShowProfileMenu(v => !v)}
              title={allProfiles.length > 1 ? 'Switch business profile' : profile?.businessName || 'My Business'}
              style={{ cursor: allProfiles.length > 1 ? 'pointer' : 'default' }}
            >
              <Building2 size={14} />
              <span className="profile-switcher-name">{profile?.businessName || 'My Business'}</span>
              {allProfiles.length > 1 && <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
            <button
              className="profile-switcher-edit"
              onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              title="Edit business profile"
            >
              <Pencil size={13} />
            </button>
          </div>
          {showProfileMenu && (
            <div className="profile-switcher-menu">
              {allProfiles.map(bp => (
                <button
                  key={bp.id || bp.businessName}
                  className={`profile-switcher-item${bp.businessName?.trim().toLowerCase() === profile?.businessName?.trim().toLowerCase() ? ' active' : ''}`}
                  onClick={() => handleSwitchProfile(bp)}
                >
                  {bp.businessName}
                </button>
              ))}
              <button
                className="profile-switcher-item profile-switcher-manage"
                onClick={() => { setShowProfileMenu(false); setCurrentView('settings'); }}
              >
                Manage profiles...
              </button>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${currentView === item.id ? 'nav-btn-active' : ''}`}
              onClick={item.onClick || (() => setCurrentView(item.id))}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {/* Update-available banner — only shows when GitHub has a newer version
                AND the user hasn't already dismissed THIS specific version. New
                releases re-show the banner. Click to view notes + update. */}
            {updateBannerVisible && (
              <button
                className="nav-btn"
                onClick={() => setShowUpdateModal(true)}
                title={`v${updateInfo.latest} is available`}
                style={{
                  background: 'var(--info-bg)',
                  borderColor: 'var(--info-border)',
                  color: 'var(--info-text)',
                  fontWeight: 600,
                  position: 'relative',
                }}
              >
                <Download size={18} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  Update to v{updateInfo.latest}
                </span>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.25)',
                  flexShrink: 0,
                }} />
              </button>
            )}
            {/* v1.10.83 - in the order chosen in Settings → Features; switched-off
                ones are already left out of bottomIds. */}
            {bottomIds.map(id => ({
              support: (
                <button key={id}
                  className={`nav-btn nav-btn-support${currentView === 'support' ? ' nav-btn-support-active' : ''}`}
                  onClick={() => setCurrentView('support')}
                  title="Who makes this app, and how to help"
                >
                  <Heart size={18} /> Support &amp; About
                </button>
              ),
              controlpanel: (
                <button key={id}
                  className={`nav-btn ${currentView === 'controlpanel' ? 'nav-btn-active' : ''}`}
                  onClick={() => setCurrentView('controlpanel')}
                  title={`${serverStatus === 'online' ? 'App Ready' : serverStatus === 'offline' ? 'App Not Running' : 'Connecting...'} - update, backup, restore, move to another PC`}
                >
                  <HardDrive size={18} /> Control Panel
                  {/* v1.10.83 - the app's status dot, formerly the "App Ready" box under the menu. */}
                  <span className={`server-status-dot server-status-${serverStatus}`} aria-label={serverStatus === 'online' ? 'App Ready' : serverStatus === 'offline' ? 'App Not Running' : 'Connecting'} />
                </button>
              ),
              settings: (
                <button key={id}
                  className={`nav-btn ${currentView === 'settings' ? 'nav-btn-active' : ''}`}
                  onClick={() => setCurrentView('settings')}
                  style={updateBannerVisible ? { position: 'relative' } : undefined}
                >
                  <Settings size={18} /> Settings
                  {updateBannerVisible && (
                    <span className="nav-badge" style={{
                      position: 'absolute', top: '8px', right: '12px',
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#f59e0b',
                    }} title="Update available" />
                  )}
                </button>
              ),
            })[id])}
          </div>
        </nav>
      </div>

      <div className="main-content">
        <div className="app-topbar">
          {multiUserEnabled && currentUser && (
            <button
              type="button"
              className="topbar-btn"
              onClick={switchUser}
              title={`Logged in as ${currentUser.name || currentUser.username} (${activeRole?.name || currentUser.role}) - Click to Switch User`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.82rem',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 600,
                marginRight: 'auto',
              }}
            >
              <User size={14} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              <span>{currentUser.name || currentUser.username}</span>
              <span style={{ fontSize: '0.74rem', opacity: 0.8, textTransform: 'capitalize' }}>
                ({activeRole?.name || currentUser.role})
              </span>
              <span style={{ fontSize: '0.72rem', opacity: 0.6, marginLeft: '0.2rem' }}>Switch</span>
            </button>
          )}
          {topActions}
        </div>
        {/* v1.10.83 - a screen that throws shows "ran into a problem" here
            instead of blanking the app; keyed by screen so the sidebar works
            and opening another screen starts clean. */}
        <ErrorBoundary key={currentView} onHome={() => setCurrentView('dashboard')}>
        {currentView !== 'new' && <StarBanner />}
        {currentView === 'dashboard' && (
          <Dashboard onNew={handleNewInvoice} onEdit={handleEditInvoice} onPrint={handlePrintInvoice} onDuplicate={handleDuplicateInvoice} onConvert={handleConvertToInvoice} onOpenProducts={() => setCurrentView('inventory')} onOpenSettings={() => setCurrentView('settings')} onOpenGuide={openDocs} onOpenSupport={() => setCurrentView('support')} activeProfile={profile} />
        )}
        {currentView === 'new' && (
          <InvoiceGenerator
            key={editorKey}
            onBack={() => { setEditingBill(null); setCurrentView('dashboard'); }}
            profile={profile} editingBill={editingBill}
          />
        )}
        {/* v1.10.4 — All lazy views under one Suspense boundary. Only the
             matched view's chunk actually loads; others stay unfetched. */}
        <Suspense fallback={<ViewLoading />}>
        {currentView === 'salesorders' && (
          <SalesOrdersView
            key={businessKey}
            activeProfile={profile}
            onNew={() => handleNewInvoice('sales-order')}
            onEdit={handleEditInvoice}
            onPrint={handlePrintInvoice}
            onDuplicate={handleDuplicateInvoice}
            onConvert={handleConvertToInvoice}
            onConvertToChallan={handleConvertToChallan}
          />
        )}
        {currentView === 'clients' && (
          <ClientsView onNew={handleNewInvoice} onEdit={handleEditInvoice} onDuplicate={handleDuplicateInvoice} />
        )}
        {currentView === 'inventory' && (
          // v1.10.83 (#115) - remounted per business, like the screens below, so its production list follows the switch.
          <InventoryView key={businessKey} />
        )}
        {/* v1.10.66 (#64 item 1) — `key={businessKey}` remounts these screens
            when the business changes. Each reads the business once when it
            opens, so a switch left the previous company's records on screen,
            and a record added straight after switching was saved under the OLD
            business. Remounting makes every one of them read it again. */}
        {currentView === 'expenses' && (
          <ExpenseTracker key={businessKey} />
        )}
        {currentView === 'purchases' && (
          <PurchaseBills key={businessKey} />
        )}
        {currentView === 'recurring' && (
          <RecurringInvoices key={businessKey} onEdit={handleEditInvoice} />
        )}
        {currentView === 'receipts' && (
          <ReceiptVoucher key={businessKey} />
        )}
        {currentView === 'cashbook' && (
          <CashBook key={businessKey} onOpenView={setCurrentView} />
        )}
        {currentView === 'reports' && (
          <ReportsView key={businessKey} />
        )}
        {currentView === 'filing' && (
          <GSTReturns key={businessKey} />
        )}
        {currentView === 'incometax' && (
          <IncomeTax key={businessKey} />
        )}
        {currentView === 'settings' && (
          <SettingsView onSaved={(p) => setProfile(p)} />
        )}
        {currentView === 'controlpanel' && (
          <ControlPanel />
        )}
        {currentView === 'support' && (
          <SupportView />
        )}
        </Suspense>
        {/* Version line: Dashboard only, so it never takes space on working screens. */}
        {currentView === 'dashboard' && <AppFooter onOpenSupport={() => setCurrentView('support')} />}
        </ErrorBoundary>
      </div>

      {/* Update modal — release notes + Export-backup-first nudge + Update Now */}
      {/* Notification popover — rendered as a click-out modal so it works on
          tablets too. Grouped by category with a navigate-to button per group. */}
      {showNotifs && (
        <div className="modal-overlay" onClick={() => setShowNotifs(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Notifications <HelpButton title="Notifications" doc="shortcuts#notifications" size={16} /></h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {/* v1.10.62 (#53) — clears everything currently shown. Each
                    section remembers exactly WHAT was cleared, so a genuinely
                    new overdue invoice or a different product running low
                    brings the alert back by itself. */}
                {dismissableCount > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={markAllNotifsRead}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                    title="Clear these notifications. They return if something new happens.">
                    Mark all as read
                  </button>
                )}
                <button className="icon-btn" onClick={() => setShowNotifs(false)} title="Close"><X size={18} /></button>
              </span>
            </div>
            {notifTotal === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', margin: 0 }}>
                All clear — nothing needs your attention right now.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {isLive('filings') && (() => {
                  const count = notifications.filings.length;
                  const first = notifications.filings[0];
                  const daysText = first.daysAway === 0 ? 'Due today' : first.daysAway === 1 ? 'Due tomorrow' : `Due in ${first.daysAway} days`;
                  const title = count === 1 ? 'Upcoming GST Return' : `${count} GST Returns Due Soon`;
                  const desc = count === 1
                    ? `${first.label} is scheduled for filing (${daysText}).`
                    : notifications.filings.slice(0, 3).map(f => `${f.label} (${f.daysAway === 0 ? 'today' : f.daysAway === 1 ? 'tomorrow' : f.daysAway + 'd'})`).join(' · ');
                  return (
                    <button type="button" className="notif-card" onClick={() => { setShowNotifs(false); setCurrentView('filing'); }}>
                      <div className="notif-icon-box notif-icon-filing">
                        <ClipboardList size={18} strokeWidth={2} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{title}</span>
                          <span className="notif-chip notif-chip-filing">{daysText}</span>
                        </div>
                        <p className="notif-desc">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="notif-arrow" />
                    </button>
                  );
                })()}

                {isLive('overdue') && (() => {
                  const count = notifications.overdue.length;
                  const title = count === 1 ? 'Overdue Invoice' : `${count} Overdue Invoices`;
                  const desc = count === 1
                    ? `Invoice ${notifications.overdue[0].invoiceNumber} (${notifications.overdue[0].clientName || 'Client'}) has passed its due date.`
                    : `${notifications.overdue.slice(0, 3).map(b => b.invoiceNumber).join(', ')}${count > 3 ? ` and ${count - 3} more` : ''} awaiting payment.`;
                  return (
                    <button type="button" className="notif-card" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }}>
                      <div className="notif-icon-box notif-icon-danger">
                        <AlertTriangle size={18} strokeWidth={2} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{title}</span>
                          <span className="notif-chip notif-chip-danger">Overdue</span>
                        </div>
                        <p className="notif-desc">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="notif-arrow" />
                    </button>
                  );
                })()}

                {isLive('dueSoon') && (() => {
                  const count = notifications.dueSoon.length;
                  const title = count === 1 ? 'Payment Due Soon' : `${count} Invoices Due Soon`;
                  const desc = count === 1
                    ? `Invoice ${notifications.dueSoon[0].invoiceNumber} (${notifications.dueSoon[0].clientName || 'Client'}) is due within 3 days.`
                    : `${notifications.dueSoon.slice(0, 3).map(b => `${b.invoiceNumber} (${b.clientName || 'Client'})`).join(' · ')} due within 3 days.`;
                  return (
                    <button type="button" className="notif-card" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }}>
                      <div className="notif-icon-box notif-icon-warn">
                        <Clock size={18} strokeWidth={2} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{title}</span>
                          <span className="notif-chip notif-chip-warn">Next 3 days</span>
                        </div>
                        <p className="notif-desc">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="notif-arrow" />
                    </button>
                  );
                })()}

                {isLive('lowStock') && (() => {
                  const count = notifications.lowStock.length;
                  const title = count === 1 ? 'Low Stock Warning' : `${count} Products Low on Stock`;
                  const desc = `${notifications.lowStock.slice(0, 3).map(p => `${p.name} (${trackedStock(p)} left)`).join(' · ')}${count > 3 ? ` · +${count - 3} more` : ''} — reorder recommended.`;
                  return (
                    <button type="button" className="notif-card" onClick={() => { setShowNotifs(false); setCurrentView('inventory'); }}>
                      <div className="notif-icon-box notif-icon-stock">
                        <Package size={18} strokeWidth={2} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{title}</span>
                          <span className="notif-chip notif-chip-stock">Inventory</span>
                        </div>
                        <p className="notif-desc">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="notif-arrow" />
                    </button>
                  );
                })()}

                {isLive('autoFire') && (() => {
                  const count = notifications.autoFire.count;
                  const title = count === 1 ? 'Recurring Invoice Created' : `${count} Recurring Invoices Created`;
                  const desc = 'Auto-generated from your recurring schedules. Ready to review on the Dashboard.';
                  return (
                    <button type="button" className="notif-card" onClick={() => { setShowNotifs(false); setCurrentView('dashboard'); }}>
                      <div className="notif-icon-box notif-icon-filing">
                        <Repeat size={18} strokeWidth={2} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{title}</span>
                          <span className="notif-chip notif-chip-filing">Today</span>
                        </div>
                        <p className="notif-desc">{desc}</p>
                      </div>
                      <ChevronRight size={16} className="notif-arrow" />
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command palette — Ctrl/Cmd+K. Spotlight-style: type to filter actions,
          ↑/↓ to navigate, Enter to run, Esc to close. */}
      {showPalette && (
        <div className="modal-overlay" onClick={() => setShowPalette(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input autoFocus type="text" placeholder="Type a command or page name…"
                value={paletteQuery}
                onChange={e => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                className="form-input" style={{ border: 0, background: 'transparent', flex: 1, fontSize: '0.95rem' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Esc</span>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {filteredPalette.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.25rem', margin: 0, fontSize: '0.85rem' }}>
                  Nothing matches "{paletteQuery}".
                </p>
              )}
              {filteredPalette.map((a, i) => (
                <button key={a.label} type="button"
                  onClick={() => { a.run(); setShowPalette(false); }}
                  onMouseEnter={() => setPaletteIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '0.6rem 1rem', border: 0, cursor: 'pointer',
                    background: i === paletteIdx ? 'var(--bg-tertiary)' : 'transparent',
                    color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.88rem',
                  }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{a.icon && <a.icon size={15} strokeWidth={1.75} style={{ opacity: 0.8 }} />}<span>{a.label}</span></span>
                  {a.hint && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.hint}</span>}
                </button>
              ))}
            </div>
            <div style={{ padding: '0.4rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><Command size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Ctrl+K to toggle · ↑↓ navigate · Enter run <HelpButton title="Quick search" doc="shortcuts#command-palette" size={16} /></span>
              <button type="button" onClick={() => { setShowPalette(false); setShowShortcutsHelp(true); }} style={{ background: 'none', border: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: '0.7rem' }}>
                All shortcuts (Ctrl+/)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard-shortcuts help — Ctrl/Cmd+/. Single-pane reference. */}
      {showShortcutsHelp && (
        <div className="modal-overlay" onClick={() => setShowShortcutsHelp(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Keyboard Shortcuts <HelpButton title="Keyboard shortcuts" doc="shortcuts#keyboard" size={16} /></h3>
              <button className="icon-btn" onClick={() => setShowShortcutsHelp(false)} title="Close"><X size={18} /></button>
            </div>
            <table className="kv-list">
              <tbody>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>K</kbd></td><td>Open command palette (jump to any page)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>N</kbd></td><td>New invoice</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>S</kbd></td><td>Save current invoice (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>P</kbd></td><td>Download PDF (when on the invoice form)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>Shift</kbd>&nbsp;+&nbsp;<kbd>L</kbd></td><td>Lock the app (when a PIN is set)</td></tr>
                <tr><td><kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>/</kbd></td><td>Toggle this help</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Close any open modal</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
              On macOS, use <kbd>⌘</kbd> instead of <kbd>Ctrl</kbd>.
            </p>
          </div>
        </div>
      )}

      {showUpdateModal && updateInfo && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <h3 className="section-title" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
                  Update available — v{updateInfo.latest} <HelpButton title="Updating the app" doc="update#update-window" size={16} />
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  You're on v{updateInfo.current}
                  {updateInfo.releasePublishedAt && ` · released ${new Date(updateInfo.releasePublishedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setShowUpdateModal(false)} title="Close"><X size={18} /></button>
            </div>

            {/* Data-safety reassurance — explicit, prominent. Same .notice-info style
                as the Data Management privacy card so users learn one visual pattern. */}
            <div className="notice notice-info" style={{ marginBottom: '0.85rem' }}>
              <span className="notice-icon"><Lock size={16} strokeWidth={1.75} /></span>
              <div>
                <strong>Your data is safe.</strong> Updates only refresh the app code and dependencies — your <code>data/</code> folder (invoices, clients, products, settings) and <code>Saved Invoices/</code> PDF archive are <strong>never touched</strong>. The updater pulls the latest source from GitHub and rebuilds, then restarts.
              </div>
            </div>

            {/* Release notes */}
            <div className="surface-card" style={{ maxHeight: '320px', overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: '0.85rem' }}>
              {updateInfo.releaseNotes || (
                <span style={{ color: 'var(--text-muted)' }}>
                  No release notes available — see the full changelog at{' '}
                  <a href={updateInfo.releaseUrl || 'https://github.com/Mohitduaa/UCNPL-GST-Billing-Software/releases'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>GitHub Releases</a>.
                </span>
              )}
            </div>

            {/* Suggested pre-update step: export a backup */}
            <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
              <span className="notice-icon"><Lightbulb size={16} strokeWidth={1.75} /></span>
              <div>
                <strong>Recommended:</strong> export a backup before updating, just in case. <button type="button" className="btn-link" onClick={() => { setShowUpdateModal(false); setCurrentView('settings'); }} style={{ background: 'none', border: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>Open Settings → Data Management</button> and click <em>Export Backup…</em>.
              </div>
            </div>

            <div className="flex gap-2 justify-end" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={dismissUpdate}>
                Skip this version
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
                Remind me later
              </button>
              {updateInfo.releaseUrl && (
                <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  View on GitHub
                </a>
              )}
              {/* The .deb, AppImage and Docker copies update by installing the new package (server.js updateHint). */}
              {!updateInfo.updateHint && (
                <button type="button" className="btn btn-primary" disabled={updating} onClick={handleUpdateNow}>
                  <Download size={16} /> {updating ? 'Updating…' : 'Update Now'}
                </button>
              )}
            </div>
            {!notifyAsked && canAskToNotify() && (
              <p style={{ fontSize: '0.78rem', marginTop: '0.6rem', marginBottom: 0 }}>
                <button type="button" className="btn-link" onClick={() => { setNotifyAsked(true); askToNotify(updateInfo.latest); }}
                  style={{ background: 'none', border: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  Tell me with a Windows notification when the next update comes out
                </button>
              </p>
            )}
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.6rem', marginBottom: 0 }}>
              {updateInfo.updateHint || <><em>Update Now</em> backs up your data, then fetches the newest release. It takes about a minute — leave this window open, then reload the page when it finishes.</>}
            </p>
          </div>
        </div>
      )}

      <ToastContainer />
      <ConfirmModalContainer />
    </div>
  );
}

export default App;
