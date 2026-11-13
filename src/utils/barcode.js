// v1.10.84 (#137, #158) - Barcode generation (Code128), SVG rendering, audio feedback, and barcode helpers
// Pure zero-dependency Code128 implementation for retail POS and barcode label printing.

export const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

/**
 * Encode ASCII text into Code128 (Subset B) code indices and width patterns.
 */
export function encodeCode128B(text) {
  const clean = String(text || '').replace(/[^\x20-\x7E]/g, '');
  if (!clean) return null;
  const codes = [104]; // Start B (index 104)
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop (index 106)

  let pattern = '';
  for (const c of codes) {
    pattern += CODE128_PATTERNS[c];
  }
  return { clean, pattern, codes };
}

/**
 * Generates an SVG string representation of a Code128 barcode.
 */
export function renderCode128Svg(text, { height = 36, barWidth = 1.5, includeText = true, fontSize = 11 } = {}) {
  const encoded = encodeCode128B(text);
  if (!encoded) return '';
  const { clean, pattern } = encoded;
  let x = 8; // Quiet zone
  let d = '';
  let isBar = true;
  for (let i = 0; i < pattern.length; i++) {
    const w = Number(pattern[i]) * barWidth;
    if (isBar) {
      d += `M${x.toFixed(1)},0 h${w.toFixed(1)} v${height} h-${w.toFixed(1)} Z `;
    }
    x += w;
    isBar = !isBar;
  }
  const totalWidth = Math.ceil(x + 8);
  const totalHeight = includeText ? height + fontSize + 5 : height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}"><path d="${d.trim()}" fill="#000000" />${includeText ? `<text x="${totalWidth / 2}" y="${height + fontSize}" text-anchor="middle" font-family="monospace, monospace" font-size="${fontSize}" fill="#111827" font-weight="600">${clean}</text>` : ''}</svg>`;
}

/**
 * Generate a random unique barcode if a product doesn't have one.
 */
export function generateRandomBarcode(prefix = 'PROD') {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}`;
}

/**
 * Web Audio API synthesized scanner beep.
 * High beep (880Hz) on successful item scan; low buzz (220Hz) on missing product.
 */
export function playScanBeep(isSuccess = true) {
  if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext)) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isSuccess) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio permission/context errors silently
  }
}
