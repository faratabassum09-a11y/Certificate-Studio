import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { api } from '../api.js';
import CertCanvas from '../components/CertCanvas.jsx';
import ColorField from '../components/ColorField.jsx';
import { canvasToFile, parseStudentLine } from '../export.js';
import {
  DATE_FORMATS, formatDate, loadImage, renderCertificate,
  downloadBlob, safeFileName
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
  const [studentRef, setStudentRef] = useState('');
  const [skipped, setSkipped] = useState([]); // already-issued certificates (duplicates)
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setTpl(null);
    setImg(null);
    setColors({});
    setError('');
    setImgFailed(false);
    setSkipped([]);
    setNotice('');
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
  const bulkStudents = useMemo(
    () => bulk.split('\n').map((s) => s.trim()).filter(Boolean).map(parseStudentLine).filter((s) => s.name),
    [bulk]
  );
  const previewValues = useMemo(
    () => ({
      name: mode === 'bulk' ? bulkStudents[0]?.name || '' : name,
      date: dateText,
      certId: `CS-${new Date().getFullYear()}-XXXXXX` // sample; the real ID is generated on download
    }),
    [mode, name, bulkStudents, dateText]
  );

  // Renders one certificate at the image's full native resolution.
  const makeCanvas = async (values) => {
    const canvas = document.createElement('canvas');
    await renderCertificate(canvas, img, view, values);
    return canvas;
  };

  const ext = format === 'pdf' ? 'pdf' : 'png';
  const fileFor = (c) => `${safeFileName(c.studentName)}_${c.certId}.${ext}`;
  const valuesFor = (c) => ({ name: c.studentName, date: c.dateText, certId: c.certId });

  // Registers the certificates on the server first (assigns IDs, blocks duplicates, writes history).
  const issue = (students) => api.issue({ templateId: id, dateText, students });

  const reDownload = async (cert) => {
    setBusy('Rendering…');
    try {
      downloadBlob(await canvasToFile(await makeCanvas(valuesFor(cert)), format), fileFor(cert));
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  const downloadSingle = async () => {
    if (!name.trim()) return;
    setBusy('Issuing…');
    setError('');
    setNotice('');
    setSkipped([]);
    try {
      const { results } = await issue([{ name, studentRef }]);
      const r = results[0];
      if (r.status === 'duplicate') {
        setSkipped([r.certificate]);
        setBusy('');
        return;
      }
      if (r.status !== 'issued') throw new Error('Please enter a valid name.');
      setBusy('Rendering…');
      downloadBlob(await canvasToFile(await makeCanvas(valuesFor(r.certificate)), format), fileFor(r.certificate));
      setNotice(`Issued certificate ${r.certificate.certId} to ${r.certificate.studentName}.`);
    } catch (e) {
      setError(e.message);
    }
    setBusy('');
  };

  const downloadBulk = async () => {
    if (!bulkStudents.length) return;
    setError('');
    setNotice('');
    setSkipped([]);
    try {
      setBusy('Issuing…');
      const { results } = await issue(bulkStudents);
      const issued = results.filter((r) => r.status === 'issued').map((r) => r.certificate);
      const dupes = results.filter((r) => r.status === 'duplicate').map((r) => r.certificate);
      setSkipped(dupes);
      if (!issued.length) { setBusy(''); return; }

      const zip = new JSZip();
      for (let i = 0; i < issued.length; i++) {
        setBusy(`Rendering ${i + 1} of ${issued.length}…`);
        const canvas = await makeCanvas(valuesFor(issued[i]));
        zip.file(fileFor(issued[i]), await canvasToFile(canvas, format));
        await new Promise((r) => setTimeout(r)); // keep the UI responsive
      }
      setBusy('Zipping…');
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${safeFileName(tpl.name)}_certificates.zip`);
      setNotice(`Issued ${issued.length} certificate(s).${dupes.length ? ` Skipped ${dupes.length} already issued (listed below).` : ''}`);
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
            <>
              <label className="field">
                <span>Name on certificate</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
              </label>
              <label className="field">
                <span>Student ID / email (optional)</span>
                <input value={studentRef} onChange={(e) => setStudentRef(e.target.value)} placeholder="e.g. STU-1023" />
                <small className="muted">Use this to tell apart two students with the same name.</small>
              </label>
            </>
          ) : (
            <label className="field">
              <span>One student per line: Name, Student ID (ID optional) — {bulkStudents.length} students</span>
              <textarea rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)}
                placeholder={'Aarav Sharma, STU-1001\nFatima Khan, STU-1002\nJohn Doe'} />
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
              {busy || `Issue & download ${ext.toUpperCase()}`}
            </button>
          ) : (
            <button className="btn primary block" onClick={downloadBulk} disabled={!bulkStudents.length || !!busy}>
              {busy || `Issue & download ${bulkStudents.length || ''} certificates (ZIP)`}
            </button>
          )}

          {notice && <p className="ok">{notice}</p>}
          {skipped.length > 0 && (
            <div className="warn">
              <strong>Already issued — not issued again ({skipped.length})</strong>
              <small>Each student gets one certificate per program. Download a copy of the existing one instead:</small>
              <ul>
                {skipped.map((c) => (
                  <li key={c.id}>
                    <span>{c.studentName}<br /><code>{c.certId}</code> · {new Date(c.createdAt).toLocaleDateString()}</span>
                    <button className="btn small" disabled={!!busy} onClick={() => reDownload(c)}>Download copy</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
