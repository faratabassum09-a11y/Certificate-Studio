import { jsPDF } from 'jspdf';
import { canvasToBlob } from './render.js';

// Turns a rendered canvas into a PNG or PDF blob.
export async function canvasToFile(canvas, format) {
  if (format === 'pdf') {
    const W = canvas.width;
    const H = canvas.height;
    const pdf = new jsPDF({
      orientation: W >= H ? 'landscape' : 'portrait',
      unit: 'px',
      format: [W, H],
      hotfixes: ['px_scaling'],
      compress: true
    });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, W, H);
    return pdf.output('blob');
  }
  return canvasToBlob(canvas, 'image/png');
}

// "Name, Student ID" (ID optional). Comma, tab or | separates the ID.
export function parseStudentLine(line) {
  const parts = line.split(/\t|\||,/).map((s) => s.trim());
  return { name: parts[0] || '', studentRef: parts.slice(1).join(' ').trim() };
}
