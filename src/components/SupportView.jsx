// Support & About.
import { Heart, Mail, Globe, Code, Wrench, Database, LifeBuoy, Cpu, Smartphone, Workflow } from 'lucide-react';
import WhatsNew from './WhatsNew';
import ProblemLog from './ProblemLog';
import HelpButton from './HelpButton';
import { SafePrivateSection } from './SafePrivateNote';

const EMAIL = 'contact@ucnpl.com';
const SITE = 'https://ucnpl.com';

const SERVICES = [
  { icon: Code, title: 'Custom software & web apps', text: 'Websites, web apps and business tools built for how you work.' },
  { icon: Wrench, title: 'Customising this app', text: 'Your own invoice layout, reports or features in UCNPL Billing.' },
  { icon: Database, title: 'Setup & data migration', text: 'Installation, moving your data from Tally or Excel, and training.' },
  { icon: LifeBuoy, title: 'Support plans for businesses', text: 'Priority help and updates on a yearly plan.' },
  { icon: Cpu, title: 'AI integration', text: 'Add AI to your product: assistants, document reading, smart search.' },
  { icon: Workflow, title: 'AI automation', text: 'Automate the repetitive work in the software you already use.' },
  { icon: Smartphone, title: 'Mobile apps', text: 'Android and iPhone apps for your business or customers.' },
];

export default function SupportView() {
  const card = { padding: '1.25rem 1.5rem' };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support &amp; About <HelpButton title="Support & About" doc="support" size={16} style={{ marginLeft: 6 }} /></h1>
          <p className="page-subtitle">UCNPL Billing</p>
        </div>
      </div>

      <div className="glass-panel" style={{ ...card, marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <Heart size={28} style={{ color: '#e11d48', flexShrink: 0, marginTop: 2 }} />
        <div>
          <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem' }}>Free, and it stays free <HelpButton title="Free, and it stays free" doc="support#about" size={16} /></h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '70ch' }}>
            UCNPL Billing is built and maintained in India. No ads, no account, no locked features,
            and your invoices never leave this computer.
          </p>
        </div>
      </div>

      <SafePrivateSection style={{ marginBottom: '1.25rem' }} />

      <WhatsNew />

      <ProblemLog />

      <div className="glass-panel" style={card}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>Services <HelpButton title="Services" doc="support#services" size={16} /></h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Software development and business support services.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.1rem' }}>
          {SERVICES.map((w) => (
            <div key={w.title} style={{ display: 'flex', gap: '0.7rem', padding: '0.85rem', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <w.icon size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{w.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.45 }}>{w.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={`mailto:${EMAIL}?subject=${encodeURIComponent('Project enquiry (from UCNPL Billing)')}`}>
            <Mail size={16} /> Email {EMAIL}
          </a>
          <a className="btn btn-secondary" href={SITE} target="_blank" rel="noopener noreferrer"><Globe size={16} /> ucnpl.com</a>
        </div>
      </div>
    </div>
  );
}
