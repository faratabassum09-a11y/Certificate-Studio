import React, { useState } from 'react';
import { api } from '../api.js';

// Admin: edits the certificate directly. Coordinator: sends a request that an admin must approve.
export default function ChangeDialog({ cert, isAdmin, onClose, onDone }) {
  const [form, setForm] = useState({
    studentName: cert.studentName,
    studentRef: cert.studentRef || '',
    dateText: cert.dateText || '',
    reason: ''
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isAdmin) {
        const { reason, ...data } = form;
        await api.editCert(cert.id, data);
        onDone('Certificate updated.');
      } else {
        await api.requestChange(cert.id, form);
        onDone('Change request sent. An admin must approve it before the certificate changes.');
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="modal panel" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="h2">{isAdmin ? 'Edit certificate' : 'Request a change'}</h2>
        <p className="muted">
          <code>{cert.certId}</code> · {cert.program}
          {!isAdmin && <><br />This certificate is already issued. It stays unchanged until an admin approves your request.</>}
        </p>
        <label className="field"><span>Name</span><input value={form.studentName} onChange={set('studentName')} required /></label>
        <label className="field"><span>Student ID / email</span><input value={form.studentRef} onChange={set('studentRef')} /></label>
        <label className="field"><span>Date text on certificate</span><input value={form.dateText} onChange={set('dateText')} /></label>
        {!isAdmin && (
          <label className="field">
            <span>Reason for change (required)</span>
            <textarea rows={3} value={form.reason} onChange={set('reason')} required maxLength={500} placeholder="e.g. Spelling mistake in the name" />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row gap">
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : isAdmin ? 'Save changes' : 'Send request'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
