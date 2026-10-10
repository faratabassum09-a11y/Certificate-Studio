import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useTemplates } from '../context/Templates.jsx';

export default function NewTemplate() {
  const nav = useNavigate();
  const { reload } = useTemplates();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (f) => {
    if (!f) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setError('Please choose a PNG, JPG or WEBP image.');
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
    setFile(f);
    setPreview(url);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file || !size) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('width', size.width);
      fd.append('height', size.height);
      fd.append('image', file);
      const t = await api.create(fd);
      await reload();
      nav(`/t/${t.id}/edit`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel narrow">
      <h1>Upload a certificate</h1>
      <p className="muted">
        Upload the certificate with the name and date areas left blank. Use the highest resolution
        you have — downloads are exported at this image's full size.
      </p>

      <label className="drop">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.target.files[0])} hidden />
        {preview ? <img src={preview} alt="Preview" /> : <span>Click to choose an image (PNG / JPG / WEBP)</span>}
      </label>
      {size && <p className="muted">{size.width} × {size.height} px</p>}

      <label className="field">
        <span>Certificate name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Workshop Participation" required />
      </label>

      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={!file || !size || busy}>
        {busy ? 'Uploading…' : 'Save & position name/date'}
      </button>
    </form>
  );
}
