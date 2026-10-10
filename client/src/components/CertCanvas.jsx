import React, { useEffect, useRef } from 'react';
import { renderCertificate } from '../render.js';

// Fast, scaled-down on-screen preview of a certificate.
export default function CertCanvas({ img, template, values }) {
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (ref.current && img) {
      renderCertificate(ref.current, img, template, values, {
        maxWidth: 1400,
        shouldCancel: () => cancelled
      });
    }
    return () => { cancelled = true; };
  }, [img, template, values]);

  return <canvas ref={ref} className="cert-canvas" />;
}
