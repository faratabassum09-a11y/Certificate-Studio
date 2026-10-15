import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useTemplates } from '../context/Templates.jsx';
import ChangeDialog from '../components/ChangeDialog.jsx';
import { canvasToFile } from '../export.js';
import { downloadBlob, loadImage, renderCertificate, safeFileName } from '../render.js';

const PAGE = 25;
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function History({ isAdmin }) {
  const { templates } = useTemplates();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    api.history({ q: query, templateId, page, limit: PAGE })
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message));
  }, [query, templateId, page]);
  useEffect(load, [load]);

  const download = async (c, format) => {
    setBusy(c.id);
    try {
      const tpl = await api.get(c.templateId);
      const img = await loadImage(tpl.imageUrl);
      const canvas = document.createElement('canvas');
      await renderCertificate(canvas, img, tpl, { name: c.studentName, date: c.dateText, certId: c.certId });
      downloadBlob(await canvasToFile(canvas, format), `${safeFileName(c.studentName)}_${c.certId}.${format}`);
    } catch (e) {
      setError(e.message === 'Template not found' ? 'The certificate template was deleted, so it cannot be re-rendered.' : e.message);
    }
    setBusy('');
  };

  const revoke = async (c) => {
    if (!window.confirm(`Remove ${c.certId} (${c.studentName} – ${c.program})? That student can then be issued this program's certificate again.`)) return;
    try { await api.removeCert(c.id); load(); } catch (e) { setError(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { items } = await api.history({ q: query, templateId, page: 1, limit: 5000 });
      const head = ['Certificate ID', 'Student', 'Student ID', 'Program', 'Date on certificate', 'Issued by', 'Issued at'];
      const rows = items.map((c) => [c.certId, c.studentName, c.studentRef, c.program, c.dateText, c.issuedBy?.name, new Date(c.createdAt).toISOString()]);
      const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
      downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), 'certificate_history.csv');
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="row between">
        <div>
          <h1>Issued certificates</h1>
          <p className="muted">{data ? `${data.total} record(s)` : 'Loading…'} · each student can hold one certificate per program.</p>
        </div>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <div className="row gap filters">
        <input className="search grow" placeholder="Search name, student ID or certificate ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setPage(1); }}>
          <option value="">All programs</option>
          {(templates || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr><th>Certificate ID</th><th>Student</th><th>Program</th><th>Date</th><th>Issued by</th><th /></tr>
          </thead>
          <tbody>
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td><code>{c.certId}</code></td>
                <td>{c.studentName}{c.studentRef && <><br /><small className="muted">{c.studentRef}</small></>}</td>
                <td>{c.program}</td>
                <td>{c.dateText}<br /><small className="muted">{new Date(c.createdAt).toLocaleString()}</small></td>
                <td>{c.issuedBy?.name}</td>
                <td className="actions">
                  <button className="btn small" disabled={busy === c.id} onClick={() => download(c, 'png')}>PNG</button>
                  <button className="btn small" disabled={busy === c.id} onClick={() => download(c, 'pdf')}>PDF</button>
                  <button className="btn small" onClick={() => setEditing(c)}>{isAdmin ? 'Edit' : 'Request change'}</button>
                  {isAdmin && <button className="btn small danger" onClick={() => revoke(c)}>Remove</button>}
                </td>
              </tr>
            ))}
            {data && !data.items.length && <tr><td colSpan="6" className="muted">No certificates found.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="row gap pager">
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="muted">Page {data.page} of {data.pages}</span>
          <button className="btn small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}

      {editing && (
        <ChangeDialog
          cert={editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onDone={(msg) => { setEditing(null); setNotice(msg); load(); }}
        />
      )}
    </>
  );
}
