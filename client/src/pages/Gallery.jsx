import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useTemplates } from '../context/Templates.jsx';
import Thumb from '../components/Thumb.jsx';

export default function Gallery({ isAdmin }) {
  const { templates, error: loadError, reload } = useTemplates();
  const [error, setError] = useState('');

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    try {
      await api.remove(t.id);
      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loadError) return <p className="error">{loadError}</p>;
  if (!templates) return <p>Loading…</p>;

  return (
    <>
      <h1>All certificates</h1>
      <p className="muted">Pick one here or from the sidebar to generate certificates.</p>
      {error && <p className="error">{error}</p>}

      {templates.length === 0 ? (
        <div className="empty">
          <p>No certificate templates yet.</p>
          {isAdmin
            ? <Link to="/new" className="btn primary">Upload your first certificate</Link>
            : <p>Ask an admin to upload one.</p>}
        </div>
      ) : (
        <div className="grid">
          {templates.map((t) => (
            <div key={t.id} className="card">
              <Link to={`/t/${t.id}`} className="thumb">
                <Thumb src={t.imageUrl} alt={t.name} />
              </Link>
              <div className="card-body">
                <div className="card-title">
                  <strong title={t.name}>{t.name}</strong>
                  {t.code && <code className="code-tag">{t.code}</code>}
                </div>
                <div className="row gap">
                  <Link to={`/t/${t.id}`} className="btn small primary">Use</Link>
                  {isAdmin && <Link to={`/t/${t.id}/edit`} className="btn small">Edit</Link>}
                  {isAdmin && <button className="btn small danger" onClick={() => remove(t)}>Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
