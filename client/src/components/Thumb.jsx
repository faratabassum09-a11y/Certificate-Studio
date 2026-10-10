import React, { useEffect, useState } from 'react';

// Certificate thumbnail that degrades gracefully if the image file is missing on the server.
export default function Thumb({ src, alt = '' }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (bad) return <div className="thumb-missing" title="Image file missing — open Edit and replace the image">⚠ missing</div>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}
