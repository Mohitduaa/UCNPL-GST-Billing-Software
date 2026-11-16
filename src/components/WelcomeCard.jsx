// v1.10.81 - a welcome for new users at the top of the Dashboard (asked for by
// the maintainer): thanks them, and whoever told them about the app, says it
// is free, and that support of any amount is welcome but never
// needed. On the page, not a popup; shown until closed and only while the
// business has fewer than 10 invoices (from 10 the daily support card takes
// over, so the two never show together).
import { useState } from 'react';
import { X } from 'lucide-react';
import { SUPPORT_NUDGE_MIN_INVOICES } from '../utils/supporters';
import HelpButton from './HelpButton';

const KEY = 'freegstbill_welcomeCard';
const SHARE_TEXT = 'I use UCNPL Billing for my GST invoices. It is free, works offline and keeps the data on your own PC: https://github.com/Mohitduaa/UCNPL-GST-Billing-Software';

const isClosed = () => { try { return localStorage.getItem(KEY) === 'closed'; } catch { return false; } };

export default function WelcomeCard({ invoiceCount }) {
  const [closed, setClosed] = useState(isClosed);
  if (closed || invoiceCount >= SUPPORT_NUDGE_MIN_INVOICES) return null;
  const close = () => {
    try { localStorage.setItem(KEY, 'closed'); } catch { /* private mode */ }
    setClosed(true);
  };
  return (
    <section className="welcome-card" aria-labelledby="welcome-card-title">
      <button type="button" className="welcome-card-close" onClick={close} aria-label="Close the welcome note">
        <X size={18} />
      </button>
      <h2 id="welcome-card-title">Thank you for choosing UCNPL Billing <HelpButton title="The welcome note" doc="dashboard#welcome-card" size={16} /></h2>
      <p className="welcome-card-lead">
        And thank you to whoever told you about it. This app grows
        because shop owners, accountants and CAs recommend it to each other.
      </p>
      <ul className="welcome-card-points">
        <li><strong>100% Free &amp; Offline.</strong> No subscription, no ads, no locked features.</li>
        <li><strong>Your data stays yours.</strong> Everything is saved on this PC and works offline.</li>
        <li><strong>Regular updates.</strong> Continuous improvements, fixes and new features each week.</li>
      </ul>
      <div className="welcome-card-actions">
        <a className="welcome-card-btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(SHARE_TEXT)}`} target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          <span>Share on WhatsApp</span>
        </a>
        <button type="button" className="welcome-card-btn welcome-card-btn-secondary" onClick={close}>Start billing</button>
      </div>
    </section>
  );
}
