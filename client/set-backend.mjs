// Usage: node set-backend.mjs https://your-service.onrender.com
// Writes the real Render URL into vercel.json so Vercel can proxy /api and /uploads.
import fs from 'fs';
let url = (process.argv[2] || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) {
  console.error('Give your Render URL, e.g.: node set-backend.mjs https://certificate-api.onrender.com');
  process.exit(1);
}
const file = new URL('./vercel.json', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const r of cfg.rewrites) {
  if (r.source.startsWith('/api/')) r.destination = `${url}/api/:path*`;
  if (r.source.startsWith('/uploads/')) r.destination = `${url}/uploads/:path*`;
}
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
console.log('vercel.json updated ->', url);
