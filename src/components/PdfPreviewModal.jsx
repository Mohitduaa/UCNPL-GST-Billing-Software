import { useState, useEffect, useRef } from 'react';
import { X, Download, Printer, MessageCircle, ExternalLink } from 'lucide-react';
import { openWhatsAppShare } from '../utils/share';
import { toast } from './Toast';

export default function PdfPreviewModal({
  title = 'Document Preview',
  filename = 'document.pdf',
  pdfBlob,
  clientPhone = '',
  shareText = '',
  onClose,
}) {
  const [blobUrl, setBlobUrl] = useState('');
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pdfBlob]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('PDF downloaded successfully', 'success');
  };

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // Fallback if cross-origin or blocked
      }
    }
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const handleWhatsApp = () => {
    if (!clientPhone) {
      toast('No client phone number available for WhatsApp sharing', 'warning');
      return;
    }
    openWhatsAppShare(clientPhone, shareText || `Here is your ${title}.`);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: '95vw',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{title}</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{filename}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownload}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
              title="Save PDF file to your device"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
              title="Print document directly"
            >
              <Printer size={14} /> Print
            </button>
            {clientPhone && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleWhatsApp}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', padding: '0.35rem 0.75rem', color: '#059669', borderColor: '#a7f3d0' }}
                title="Send notification to client on WhatsApp"
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              title="Close preview"
              style={{ marginLeft: '0.5rem' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF Preview Frame */}
        <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0, background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
          {blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title={title}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Generating PDF preview…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Tip: You can zoom, rotate, and print using the built-in PDF viewer controls above.</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
