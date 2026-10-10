import React, { useEffect, useState } from 'react';

const SWATCHES = ['#000000', '#1a1a1a', '#ffffff', '#7a5c00', '#b8860b', '#8b0000', '#0b3d91', '#1f4fd8', '#0a6b3d', '#5b2c83'];

function normalise(v) {
  let s = v.trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + [...s.slice(1)].map((c) => c + c).join('');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

// Colour picker + hex box + quick swatches (works even where the native picker is awkward).
export default function ColorField({ label = 'Colour', value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div className="field">
      <span>{label}</span>
      <div className="color-row">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        <input
          className="hex"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            const c = normalise(e.target.value);
            if (c) onChange(c);
          }}
          onBlur={() => setText(value)}
          aria-label={`${label} hex code`}
        />
      </div>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            type="button"
            key={c}
            className={`swatch ${c === value ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
