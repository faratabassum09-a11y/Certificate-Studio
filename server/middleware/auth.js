import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const isProd = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || (isProd ? null : 'dev-only-secret-change-me');
if (!SECRET) {
  console.error('JWT_SECRET must be set when NODE_ENV=production');
  process.exit(1);
}

const COOKIE = 'cs_token';
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: isProd };

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, cookieOpts);
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please sign in' });
    const { sub } = jwt.verify(token, SECRET);
    const user = await User.findById(sub);
    if (!user) return res.status(401).json({ error: 'Please sign in' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
