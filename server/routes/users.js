import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Mounted behind requireAuth + requireAdmin
const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function otherAdminExists(excludeId) {
  return (await User.countDocuments({ role: 'admin', _id: { $ne: excludeId } })) > 0;
}

router.get('/', async (req, res, next) => {
  try {
    res.json(await User.find().sort({ createdAt: 1 }));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'member';
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await User.create({ name, email, role, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json(user);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That email is already registered' });
    next(e);
  }
});

// Reset password and/or change role
router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.body.password !== undefined) {
      const password = String(req.body.password);
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      user.passwordHash = await bcrypt.hash(password, 12);
    }
    if (req.body.role && req.body.role !== user.role) {
      if (user.role === 'admin' && !(await otherAdminExists(user.id))) {
        return res.status(400).json({ error: 'There must be at least one admin' });
      }
      user.role = req.body.role === 'admin' ? 'admin' : 'member';
    }
    await user.save();
    res.json(user);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.id === req.user.id) return res.status(400).json({ error: "You can't remove your own account" });
    if (user.role === 'admin' && !(await otherAdminExists(user.id))) {
      return res.status(400).json({ error: 'There must be at least one admin' });
    }
    await user.deleteOne();
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
