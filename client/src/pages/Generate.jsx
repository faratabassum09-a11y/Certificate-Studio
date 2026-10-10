import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { api } from '../api.js';
import CertCanvas from '../components/CertCanvas.jsx';
import ColorField from '../components/ColorField.jsx';
import {
  DATE_FORMATS, formatDate, loadImage, renderCertificate,
  canvasToBlob, downloadBlob, safeFileName
} from '../render.js';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Generate({ isAdmin }) {
  const { id } = useParams();
  const [tpl, setTpl] = useState(null);
  const [img, setImg] = useState(null);
  const [error, setError] = useState('');

  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [bulk, setBulk] = useState('');
  const [dateISO, setDateISO] = useState(today());
  const [dateFmt, setDateFmt] = useState('dmy-long');
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState('');
  const [colors, setColors] = useState({}); // per-download colour overrides (not saved)
  const [showStyle, setShowStyle] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setTpl(null);
    setImg(null);
    setColors({});
    setError('');
    setImgFailed(false);
    api.get(id)
      .then(async (t) => {
        setTpl(t);
        try {
          setImg(await loadImage(t.imageUrl));
        } catch {
          setImgFailed(true);
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Template with any colour overrides applied
  const view = useMemo(
    () => tpl && { ...tpl, fields: tpl.fields.map((f) => ({ ...f, color: colors[f.key] || f.color })) },
    [tpl, colors]
  );

  const dateText = formatDate(dateISO, dateFmt);
  const bulkNames = useMemo(
    () => bulk.split('\n').map((s) => s.trim()).filter(Boolean),
    [bulk]
  );
  const previewValues = useMemo(
    () => ({ name: mode === 'bulk' ? bulkNames[0] || '' : name, date: dateText }),
    [mode, name, bulkNames, dateText]
  );

  // Renders one certificate at the image's full native resolution.
  const makeCanvas = async (personName) => {
    const canvas = document.createElement('canvas');
    await renderCertificate(canvas, img, view, { name: personName, date: dateText });
    return canvas;
  };

  const toFile = async (canvas) => {
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
  };

  const ext = format === 'pdf' ? 'pdf' : 'png';

  const downloadSingle = async () => {
    if (!name.trim()) return;
    setBusy('Rendering…');
    try {
      const canvas = await makeCanvas(name.trim());
      downloadBlob(await toFile(canvas), `${safeFileName(name)}.${ext}`);
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  const downloadBulk = async () => {
    if (!bulkNames.length) return;
    try {
      const zip = new JSZip();
      const used = new Map();
      for (let i = 0; i < bulkNames.length; i++) {
        setBusy(`Rendering ${i + 1} of ${bulkNames.length}…`);
        const canvas = await makeCanvas(bulkNames[i]);
        const base = safeFileName(bulkNames[i]);
        const n = (used.get(base) || 0) + 1;
        used.set(base, n);
        zip.file(`${base}${n > 1 ? `_${n}` : ''}.${ext}`, await toFile(canvas));
        await new Promise((r) => setTimeout(r)); // keep the UI responsive
      }
      setBusy('Zipping…');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${safeFileName(tpl.name)}_certificates.zip`);
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  if (error && !tpl) return <p className="error">{error}</p>;
  if (tpl && imgFailed) {
    return (
      <div className="panel narrow">
        <h1>{tpl.name}</h1>
        <p className="error">The image file for this certificate is missing on the server.</p>
        {isAdmin
          ? <p><Link to={`/t/${id}/edit`} className="btn primary">Open Edit and replace the image</Link></p>
          : <p className="muted">Please ask an admin to upload the image again.</p>}
      </div>
    );
  }
  if (!view || !img) return <p>Loading…</p>;

  return (
    <>
      <div className="row between">
        <div>
          <h1>{tpl.name}</h1>
          <p className="muted">Output size: {tpl.width} × {tpl.height} px</p>
        </div>
        {isAdmin && <Link to={`/t/${id}/edit`} className="btn">Edit certificate</Link>}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="editor">
        <div className="stage">
          <CertCanvas img={img} template={view} values={previewValues} />
        </div>

        <aside className="panel side">
          <div className="tabs">
            <button className={`tab ${mode === 'single' ? 'on' : ''}`} onClick={() => setMode('single')}>Single</button>
            <button className={`tab ${mode === 'bulk' ? 'on' : ''}`} onClick={() => setMode('bulk')}>Bulk (many names)</button>
          </div>

          {mode === 'single' ? (
            <label className="field">
              <span>Name on certificate</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
            </label>
          ) : (
            <label className="field">
              <span>One name per line ({bulkNames.length} names)</span>
              <textarea rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)}
                placeholder={'Aarav Sharma\nFatima Khan\nJohn Doe'} />
            </label>
          )}

          <label className="field">
            <span>Date</span>
            <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
          </label>

          <label className="field">
            <span>Date format</span>
            <select value={dateFmt} onChange={(e) => setDateFmt(e.target.value)}>
              {DATE_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{formatDate(dateISO || today(), f.id)}</option>
              ))}
            </select>
          </label>

          <button type="button" className="linklike" onClick={() => setShowStyle((s) => !s)}>
            {showStyle ? '▾' : '▸'} Text colour
          </button>
          {showStyle && (
            <div className="style-box">
              {view.fields.map((f) => (
                <ColorField
                  key={f.key}
                  label={`${f.label || f.key} colour`}
                  value={f.color}
                  onChange={(c) => setColors((prev) => ({ ...prev, [f.key]: c }))}
                />
              ))}
              {Object.keys(colors).length > 0 && (
                <button type="button" className="btn small" onClick={() => setColors({})}>
                  Reset to saved colours
                </button>
              )}
              <small className="muted">Applies to the certificates you download now. To change the saved default, use Edit.</small>
            </div>
          )}

          <label className="field">
            <span>Download as</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="png">PNG (lossless, full resolution)</option>
              <option value="pdf">PDF (print ready)</option>
            </select>
          </label>

          {mode === 'single' ? (
            <button className="btn primary block" onClick={downloadSingle} disabled={!name.trim() || !!busy}>
              {busy || `Download ${ext.toUpperCase()}`}
            </button>
          ) : (
            <button className="btn primary block" onClick={downloadBulk} disabled={!bulkNames.length || !!busy}>
              {busy || `Download ${bulkNames.length || ''} certificates (ZIP)`}
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
