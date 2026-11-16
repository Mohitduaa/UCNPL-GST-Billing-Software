// src/components/SoftwareLogo.jsx
// Authentic, high-precision SVG brand logos for all 11 accounting platforms
// Enables instant visual recognition for customers without having to read text labels.
import React from 'react';

export default function SoftwareLogo({ id, size = 36, className = '', style = {} }) {
  const s = size;
  const common = {
    width: s,
    height: s,
    minWidth: s,
    minHeight: s,
    display: 'inline-block',
    verticalAlign: 'middle',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    flexShrink: 0,
    ...style,
  };

  switch (id) {
    case 'tally-prime':
      // Tally Prime: Deep Navy background (#002840) with vibrant golden-yellow (#FFB800) geometric "T" monogram
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Tally Prime Logo">
          <rect width="48" height="48" rx="10" fill="#032541" />
          <path d="M10 14h28v6H27v18h-6V20H10v-6z" fill="#FFBA08" />
          <circle cx="36" cy="17" r="2.5" fill="#FFFFFF" />
          <path d="M21 34h6v4h-6z" fill="#FFD000" opacity="0.9" />
        </svg>
      );

    case 'busy':
      // Busy Accounting: Isometric 3D "B" in Royal Blue (#1E40AF) and Crimson Red (#DC2626)
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Busy Accounting Logo">
          <rect width="48" height="48" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
          {/* Top lobe in Blue */}
          <path d="M13 11h13c4.4 0 8 3.1 8 7s-3.6 7-8 7H13V11z" fill="#1D4ED8" />
          {/* Bottom lobe in Red */}
          <path d="M13 23h15c4.7 0 8.5 3.3 8.5 7.5S32.7 38 28 38H13V23z" fill="#DC2626" />
          {/* Inner cutout windows */}
          <rect x="18" y="15" width="6" height="6" rx="1.5" fill="#FFFFFF" />
          <rect x="18" y="27" width="7" height="6" rx="1.5" fill="#FFFFFF" />
        </svg>
      );

    case 'vyapar':
      // Vyapar App: Crimson Red (#D8232A) rounded app icon with white ledger checkmark / "V" glyph
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Vyapar Logo">
          <rect width="48" height="48" rx="10" fill="#DC2626" />
          <path
            d="M13 14h22a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z"
            fill="#B91C1C"
          />
          {/* Stylized white V checkmark */}
          <path
            d="M16 23l6 7 13-14"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Ledger ruled line */}
          <line x1="16" y1="36" x2="32" y2="36" stroke="#FEF2F2" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );

    case 'mybillbook':
      // myBillBook: Royal Electric Blue (#2563EB) rounded app square with white "B" and emerald green checkmark
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="myBillBook Logo">
          <rect width="48" height="48" rx="10" fill="#2563EB" />
          {/* White bill document */}
          <path d="M14 11h14l8 8v18H14V11z" fill="#FFFFFF" />
          {/* Folded corner */}
          <path d="M28 11v8h8" fill="#DBEAFE" />
          {/* Emerald checkmark on bill */}
          <circle cx="27" cy="27" r="7.5" fill="#10B981" />
          <path
            d="M23.5 27l2.5 2.5 5-5"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'marg':
      // Marg ERP: Dark Navy background (#0B192C) with vibrant Flame Orange (#FF6B00) dynamic 'M' swoosh
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Marg ERP Logo">
          <rect width="48" height="48" rx="10" fill="#0F172A" />
          <path
            d="M11 36V14l9 12 4-5 4 5 9-12v22h-5V23l-4 5-4-5-4 5v8h-5z"
            fill="#FF6B00"
          />
          <circle cx="24" cy="12" r="3" fill="#38BDF8" />
        </svg>
      );

    case 'gst-portal':
      // India GST Portal: Official Saffron, White with Navy Ashok Chakra, and Green Tricolor Ring
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="GST Portal Logo">
          <rect width="48" height="48" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          {/* Saffron Arc */}
          <path d="M24 6a18 18 0 0 1 18 18h-6a12 12 0 0 0-12-12V6z" fill="#FF9933" />
          {/* Green Arc */}
          <path d="M24 42a18 18 0 0 1-18-18h6a12 12 0 0 0 12 12v6z" fill="#138808" />
          {/* Navy Ashok Chakra Center with 12 radial spokes */}
          <circle cx="24" cy="24" r="8" fill="#000080" />
          <circle cx="24" cy="24" r="4.5" fill="#FFFFFF" />
          <circle cx="24" cy="24" r="2" fill="#000080" />
          <text
            x="24"
            y="27.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="900"
            fontFamily="sans-serif"
            letterSpacing="-0.5"
          >
            GST
          </text>
        </svg>
      );

    case 'quickbooks':
      // QuickBooks (Intuit): Iconic bright green circle (#2CA01C) with white interlocking "qb" monogram
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="QuickBooks Logo">
          <rect width="48" height="48" rx="10" fill="#2CA01C" />
          <circle cx="24" cy="24" r="14" fill="#228815" opacity="0.4" />
          {/* "q" loop and stem */}
          <path
            d="M21 16a6 6 0 1 0 0 12h3V16h-3zm-2.5 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
            fill="#FFFFFF"
          />
          {/* "b" loop and stem */}
          <path
            d="M27 32a6 6 0 1 0 0-12h-3v12h3zm2.5-9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case 'xero':
      // Xero: Iconic Cyan Sky-Blue (#13B5EA) circle with white stylized "xero" monogram
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Xero Logo">
          <rect width="48" height="48" rx="10" fill="#13B5EA" />
          {/* Stylized bold white X with curved endpoints */}
          <path
            d="M16 16l16 16m0-16L16 32"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="24" cy="24" r="2" fill="#0284C7" />
        </svg>
      );

    case 'zoho-books':
      // Zoho Books: Iconic 4-color interlocking blocks (Red #E42528, Green #1BB76E, Blue #0066FF, Yellow #F7B500)
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Zoho Books Logo">
          <rect width="48" height="48" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
          {/* Red Cube */}
          <rect x="11" y="11" width="12" height="12" rx="3" fill="#E42528" />
          {/* Green Cube */}
          <rect x="25" y="11" width="12" height="12" rx="3" fill="#1BB76E" />
          {/* Blue Cube */}
          <rect x="11" y="25" width="12" height="12" rx="3" fill="#0066FF" />
          {/* Yellow Cube */}
          <rect x="25" y="25" width="12" height="12" rx="3" fill="#F7B500" />
          {/* White 'Z' in center */}
          <path d="M15 15h4l-4 4h4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M29 29h4l-4 4h4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case 'wave':
      // Wave Accounting: Ocean Blue (#0B72E7) with double white fluid wave curves
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Wave Accounting Logo">
          <rect width="48" height="48" rx="10" fill="#0B72E7" />
          {/* Upper wave */}
          <path
            d="M10 22c4-5 8-5 12 0s8 5 12 0 4-3 4-3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Lower wave */}
          <path
            d="M10 30c4-5 8-5 12 0s8 5 12 0 4-3 4-3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      );

    case 'universal-excel':
    default:
      // Microsoft Excel: Forest Green (#107C41) with folded sheet and bold white "X"
      return (
        <svg viewBox="0 0 48 48" style={common} className={className} aria-label="Excel / CSV Logo">
          <rect width="48" height="48" rx="10" fill="#107C41" />
          {/* Table spreadsheet grid */}
          <rect x="18" y="12" width="20" height="24" rx="2" fill="#E8F5E9" />
          <line x1="18" y1="18" x2="38" y2="18" stroke="#107C41" strokeWidth="1.5" />
          <line x1="18" y1="24" x2="38" y2="24" stroke="#107C41" strokeWidth="1.5" />
          <line x1="18" y1="30" x2="38" y2="30" stroke="#107C41" strokeWidth="1.5" />
          <line x1="28" y1="12" x2="28" y2="36" stroke="#107C41" strokeWidth="1.5" />
          {/* Green 3D tile with white 'X' */}
          <rect x="10" y="16" width="16" height="16" rx="3" fill="#0E6B37" />
          <path
            d="M14 20l8 8m0-8l-8 8"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
