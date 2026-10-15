import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const FIELDS = [
  ['studentName', 'Name'],
  ['studentRef', 'Student ID'],
  ['dateText', 'Date']
];

function Diff({ cr }) {
  const rows = FIELDS.filter(([k]) => (cr.current[k] || '') !== (cr.proposed[k] || ''));
  return (
    <ul className="diff">
      {rows.map(([k, label]) => (
        <li key={k}>
          <small className="muted">{label}</small><br />
          <s>{cr.current[k] || '—'}</s> → <strong>{cr.proposed[k] || '—'}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function ChangeRequests({ isAdmin, onChanged }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api.changeRequests(status ? { status } : {})
      .then((d) => { setItems(d); setError(''); })
      .catch((e) => setError(e.message));
  }, [status]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const decide = async (cr, approve) => {
    const note = window.prompt(approve ? 'Optional note for the coordinator:' : 'Reason for rejecting (optional):', '');
    if (note === null) return;
    setBusy(cr.id);
    try {
      await (approve ? api.approveChange(cr.id, note) : api.rejectChange(cr.id, note));
      load();
      onChanged?.();
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  return (
    <>
      <h1>{isAdmin ? 'Change requests' : 'My change requests'}</h1>
      <p className="muted">
        {isAdmin
          ? 'Coordinators cannot alter an issued certificate. Approve a request to apply the change; reject it to keep the certificate as issued.'
          : 'Issued certificates can only be changed with admin permission. Track your requests here, then re-download the certificate once approved.'}
      </p>
      {error && <p className="error">{error}</p>}

      <div className="tabs" style={{ maxWidth: 360, margin: '12px 0' }}>
        {[['pending', 'Pending'], ['', 'All']].map(([v, l]) => (
          <button key={v} className={`tab ${status === v ? 'on' : ''}`} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Certificate</th><th>Requested change</th><th>Reason</th><th>Requested by</th><th>Status</th>{isAdmin && <th />}</tr></thead>
          <tbody>
            {items?.map((cr) => (
              <tr key={cr.id}>
                <td><code>{cr.certId}</code><br /><small className="muted">{cr.program}</small></td>
                <td><Diff cr={cr} /></td>
                <td>{cr.reason}</td>
                <td>{cr.requestedBy?.name}<br /><small className="muted">{new Date(cr.createdAt).toLocaleString()}</small></td>
                <td>
                  <span className={`pill ${cr.status}`}>{cr.status}</span>
                  {cr.decidedBy && <><br /><small className="muted">by {cr.decidedBy.name}</small></>}
                  {cr.decisionNote && <><br /><small className="muted">{cr.decisionNote}</small></>}
                </td>
                {isAdmin && (
                  <td className="actions">
                    {cr.status === 'pending' && (
                      <>
                        <button className="btn small primary" disabled={busy === cr.id} onClick={() => decide(cr, true)}>Approve</button>
                        <button className="btn small danger" disabled={busy === cr.id} onClick={() => decide(cr, false)}>Reject</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {items && !items.length && <tr><td colSpan={isAdmin ? 6 : 5} className="muted">No requests.</td></tr>}
            {!items && <tr><td colSpan="6" className="muted">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
