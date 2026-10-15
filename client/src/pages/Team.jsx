import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';

export default function Team() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'coordinator' });
  const [busy, setBusy] = useState(false);

  const load = () => api.users().then(setUsers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addUser(form);
      setForm({ name: '', email: '', password: '', role: 'coordinator' });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const act = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (err) { setError(err.message); }
  };

  const resetPassword = (u) => {
    const pw = window.prompt(`New password for ${u.name} (min 8 characters):`);
    if (pw) act(() => api.updateUser(u.id, { password: pw }));
  };

  const remove = (u) => {
    if (window.confirm(`Remove ${u.name}? They will no longer be able to sign in.`)) act(() => api.removeUser(u.id));
  };

  const toggleRole = (u) => act(() => api.updateUser(u.id, { role: u.role === 'admin' ? 'coordinator' : 'admin' }));

  return (
    <>
      <h1>Team</h1>
      <p className="muted">
        Admins upload, edit and delete certificate templates, manage the team, and approve changes to issued certificates. Coordinators add names and download certificates; an issued certificate can only be changed with admin approval.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 className="h2">Add a team member</h2>
        <form onSubmit={add} className="team-form">
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input type="password" placeholder="Password (min 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="coordinator">Coordinator</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 className="h2">People</h2>
        {!users ? <p>Loading…</p> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.id === me.id && <small className="muted"> (you)</small>}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td className="actions">
                    <button className="btn small" onClick={() => resetPassword(u)}>Reset password</button>
                    {u.id !== me.id && (
                      <>
                        <button className="btn small" onClick={() => toggleRole(u)}>
                          Make {u.role === 'admin' ? 'coordinator' : 'admin'}
                        </button>
                        <button className="btn small danger" onClick={() => remove(u)}>Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
