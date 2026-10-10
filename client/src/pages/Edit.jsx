import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { FONTS, loadImage } from '../render.js';
import { useTemplates } from '../context/Templates.jsx';
import CertCanvas from '../components/CertCanvas.jsx';
import ColorField from '../components/ColorField.jsx';

const SAMPLE = { name: 'Aarav Kumar Sharma', date: '10 October 2026' };

export default function Edit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { reload } = useTemplates();

  const [tpl, setTpl] = useState(null);
  const [img, setImg] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [newSize, setNewSize] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [sel, setSel] = useState('name');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    api.get(id)
      .then(async (t) => {
        setTpl(t);
        try {
          setImg(await loadImage(t.imageUrl));
        } catch {
          setImgFailed(true); // image file missing on the server: let the admin re-upload it
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const field = useMemo(() => tpl?.fields.find((f) => f.key === sel), [tpl, sel]);

  const patch = (key, changes) =>
    setTpl((t) => ({ ...t, fields: t.fields.map((f) => (f.key === key ? { ...f, ...changes } : f)) }));

  // ----- replace image -----
  const pickImage = async (f) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setError('Please choose a PNG, JPG or WEBP image.');
      return;
    }
    setError('');
    try {
      const loaded = await loadImage(URL.createObjectURL(f));
      setImg(loaded);
      setImgFailed(false);
      setNewFile(f);
      setNewSize({ width: loaded.naturalWidth, height: loaded.naturalHeight });
    } catch (e) {
      setError(e.message);
    }
  };

  // ----- drag markers on the preview -----
  const pointerPos = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    };
  };
  const onDown = (e) => {
    if (!img) return;
    const p = pointerPos(e);
    let best = sel;
    let bestD = Infinity;
    for (const f of tpl.fields) {
      const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = f.key; }
    }
    setSel(best);
    patch(best, { x: p.x, y: p.y });
    dragging.current = best;
    wrapRef.current.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const p = pointerPos(e);
    patch(dragging.current, { x: p.x, y: p.y });
  };
  const onUp = () => { dragging.current = false; };

  const nudge = (dx, dy) => field && patch(sel, {
    x: Math.min(1, Math.max(0, field.x + dx)),
    y: Math.min(1, Math.max(0, field.y + dy))
  });

  // ----- save / delete -----
  const save = async () => {
    if (!tpl.name.trim()) { setError('Please enter a name for this certificate.'); return; }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', tpl.name.trim());
      fd.append('fields', JSON.stringify(tpl.fields));
      if (newFile && newSize) {
        fd.append('width', newSize.width);
        fd.append('height', newSize.height);
        fd.append('image', newFile);
      }
      await api.update(id, fd);
      await reload();
      nav(`/t/${id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${tpl.name}"? This cannot be undone.`)) return;
    try {
      await api.remove(id);
      await reload();
      nav('/');
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !tpl) return <p className="error">{error}</p>;
  if (!tpl || (!img && !imgFailed)) return <p>Loading…</p>;

  return (
    <>
      <div className="row between">
        <div>
          <h1>Edit certificate</h1>
          <p className="muted">
            Click or drag on the preview to move the name / date. Changes apply to every certificate generated afterwards.
          </p>
        </div>
        <div className="row gap">
          <button className="btn" onClick={() => nav(`/t/${id}`)}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="editor">
        <div
          className="stage"
          ref={wrapRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          {img ? (
            <CertCanvas img={img} template={tpl} values={SAMPLE} />
          ) : (
            <div className="missing">
              <strong>The image file for this certificate is missing on the server.</strong>
              <span>Use “Replace image…” on the right to upload it again. Your saved layout is kept.</span>
            </div>
          )}
          {img && tpl.fields.map((f) => (
            <span
              key={f.key}
              className={`marker ${f.key === sel ? 'active' : ''}`}
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
            >
              <i>{f.label || f.key}</i>
            </span>
          ))}
        </div>

        <aside className="panel side">
          <label className="field">
            <span>Certificate name</span>
            <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
          </label>

          <div className="field">
            <span>Certificate image</span>
            <label className="btn small block replace">
              {newFile ? `New image: ${newFile.name}` : 'Replace image…'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                onChange={(e) => pickImage(e.target.files[0])} />
            </label>
            <small className="muted">
              {newSize ? `${newSize.width} × ${newSize.height} px (not saved yet)` : `${tpl.width} × ${tpl.height} px`}
            </small>
          </div>

          <hr />

          <div className="tabs">
            {tpl.fields.map((f) => (
              <button key={f.key} className={`tab ${f.key === sel ? 'on' : ''}`} onClick={() => setSel(f.key)}>
                {f.label || f.key}
              </button>
            ))}
          </div>

          {field && (
            <>
              <label className="field">
                <span>Font</span>
                <select value={field.fontFamily} onChange={(e) => patch(sel, { fontFamily: e.target.value })}>
                  {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Size ({(field.fontSize * 100).toFixed(1)}% of width)</span>
                <input type="range" min="0.01" max="0.15" step="0.001" value={field.fontSize}
                  onChange={(e) => patch(sel, { fontSize: Number(e.target.value) })} />
              </label>

              <label className="field">
                <span>Max text width ({Math.round(field.maxWidth * 100)}%) — longer text shrinks to fit</span>
                <input type="range" min="0.1" max="1" step="0.01" value={field.maxWidth}
                  onChange={(e) => patch(sel, { maxWidth: Number(e.target.value) })} />
              </label>

              <ColorField value={field.color} onChange={(c) => patch(sel, { color: c })} />

              <div className="row gap">
                <label className="field grow">
                  <span>Align</span>
                  <select value={field.align} onChange={(e) => patch(sel, { align: e.target.value })}>
                    <option value="left">Left</option>
                    <option value="center">Centre</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="check grow">
                  <input type="checkbox" checked={field.bold} onChange={(e) => patch(sel, { bold: e.target.checked })} />
                  Bold
                </label>
              </div>

              <div className="field">
                <span>Fine tune position</span>
                <div className="nudge">
                  <button className="btn small" onClick={() => nudge(0, -0.002)}>↑</button>
                  <button className="btn small" onClick={() => nudge(-0.002, 0)}>←</button>
                  <button className="btn small" onClick={() => nudge(0.002, 0)}>→</button>
                  <button className="btn small" onClick={() => nudge(0, 0.002)}>↓</button>
                </div>
              </div>
            </>
          )}

          <hr />
          <button className="btn small danger block" onClick={remove}>Delete this certificate</button>
        </aside>
      </div>
    </>
  );
}
