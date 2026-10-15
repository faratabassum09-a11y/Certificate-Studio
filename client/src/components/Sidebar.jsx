import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { useTemplates } from '../context/Templates.jsx';
import Thumb from './Thumb.jsx';

export default function Sidebar({ open }) {
  const { user, logout } = useAuth();
  const { templates, error } = useTemplates();
  const [q, setQ] = useState('');
  const isAdmin = user.role === 'admin';

  const list = (templates || []).filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <NavLink to="/" end className="brand">Certificate Studio</NavLink>

      {isAdmin && (
        <NavLink to="/new" className="btn primary block">+ Upload certificate</NavLink>
      )}

      <input
        className="search full"
        placeholder="Search certificates…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="side-label">
        Certificates{templates ? ` (${templates.length})` : ''}
      </div>

      <nav className="side-list">
        {error && <p className="error small">{error}</p>}
        {!templates && !error && <p className="muted pad">Loading…</p>}
        {templates && list.length === 0 && (
          <p className="muted pad">
            {templates.length === 0 ? 'No certificates yet.' : 'No matches.'}
          </p>
        )}
        {list.map((t) => (
          <NavLink
            key={t.id}
            to={`/t/${t.id}`}
            className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}
          >
            <Thumb src={t.imageUrl} />
            <span>{t.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-foot">
        <NavLink to="/history" className="btn small block">Issued certificates</NavLink>
        {isAdmin && <NavLink to="/team" className="btn small block">Team</NavLink>}
        <div className="who">
          <div>
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </div>
          <button className="btn small" onClick={logout}>Sign out</button>
        </div>
      </div>
    </aside>
  );
}
