import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { issueSession, clearSession, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Tiny in-memory brute-force guard: 10 failed logins / 15 min per IP + email
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map();
const failCount = (k) => {
  const now = Date.now();
  const recent = (fails.get(k) || []).filter((t) => now - t < WINDOW);
  fails.set(k, recent);
  return recent.length;
};
const addFail = (k) => fails.set(k, [...(fails.get(k) || []), Date.now()]);

const signupOpen = (count) => count === 0 || process.env.ALLOW_SIGNUP === 'true';

router.get('/status', async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    res.json({ hasUsers: count > 0, allowSignup: signupOpen(count) });
  } catch (e) { next(e); }
});

router.post('/signup', async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (!signupOpen(count)) return res.status(403).json({ error: 'Sign-up is closed. Ask an admin to create your account.' });

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: count === 0 ? 'admin' : 'coordinator' // the very first account is the admin
    });
    issueSession(res, user);
    res.status(201).json(user);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That email is already registered' });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const key = `${req.ip}|${email}`;
    if (failCount(key) >= MAX_FAILS) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) {
      addFail(key);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    fails.delete(key);
    issueSession(res, user);
    res.json(user);
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => res.json(req.user));

export default router;
