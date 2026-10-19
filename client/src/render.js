export const FONTS = [
  'Great Vibes',
  'Dancing Script',
  'Playfair Display',
  'Cinzel',
  'Cormorant Garamond',
  'Lora',
  'Montserrat',
  'Poppins'
];

export const DATE_FORMATS = [
  { id: 'dmy-long', label: '10 October 2026' },
  { id: 'mdy-long', label: 'October 10, 2026' },
  { id: 'dmy-slash', label: '10/10/2026' },
  { id: 'dmy-dash', label: '10-10-2026' }
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// value is "YYYY-MM-DD" from <input type="date">. Parsed manually to avoid timezone shifts.
export function formatDate(value, format = 'dmy-long') {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  switch (format) {
    case 'mdy-long': return `${MONTHS[m - 1]} ${d}, ${y}`;
    case 'dmy-slash': return `${dd}/${mm}/${y}`;
    case 'dmy-dash': return `${dd}-${mm}-${y}`;
    default: return `${d} ${MONTHS[m - 1]} ${y}`;
  }
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load certificate image'));
    img.src = src;
  });
}

const fontSpec = (f, size) => `${f.bold ? 700 : 400} ${size}px "${f.fontFamily}"`;

/**
 * Draws the certificate onto `canvas`.
 * - Without opts.maxWidth the canvas is the image's full native resolution (used for downloads).
 * - With opts.maxWidth it is scaled down (used for fast on-screen previews).
 * Fonts are preloaded first so the actual drawing is synchronous and cannot interleave.
 */
export async function renderCertificate(canvas, img, template, values, opts = {}) {
  const fields = template.fields.filter((f) => values[f.key]);

  await Promise.all(
    fields.map((f) => document.fonts.load(fontSpec(f, 40), values[f.key]).catch(() => null))
  );
  if (opts.shouldCancel && opts.shouldCancel()) return false;

  const scale = opts.maxWidth ? Math.min(1, opts.maxWidth / img.naturalWidth) : 1;
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, W, H);

  for (const f of fields) {
    let text = String(values[f.key]);
    if (f.key === 'certId') text = text.replace(/^CS-\d{4}-/, ''); // show only the code, e.g. 4HWPH7
    let size = f.fontSize * W;
    ctx.font = fontSpec(f, size);
    const maxW = f.maxWidth * W;
    const measured = ctx.measureText(text).width;
    if (measured > maxW) {
      size *= maxW / measured; // shrink long names so they never overflow
      ctx.font = fontSpec(f, size);
    }
    ctx.fillStyle = f.color;
    ctx.textAlign = f.align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, f.x * W, f.y * H);
  }
  return true;
}

export function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), type, quality)
  );
}

export function safeFileName(s) {
  return String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'certificate';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
