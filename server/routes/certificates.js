import express from 'express';
import crypto from 'crypto';
import Template from '../models/Template.js';
import Certificate from '../models/Certificate.js';
import { requireAdmin } from '../middleware/auth.js';

// Mounted behind requireAuth.
const router = express.Router();

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L lookalikes
const newCertId = () => {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `CS-${new Date().getFullYear()}-${s}`;
};

const clean = (s) => String(s || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
// Identity = student ID if given, otherwise the (case-insensitive) name.
const studentKey = (name, ref) => (ref ? `ref:${ref.toLowerCase()}` : `name:${name.toLowerCase()}`);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Issue certificates. Creates the history record first; a duplicate (same student + program) is
// refused and the existing certificate is returned instead, so it can be re-downloaded but never re-issued.
router.post('/issue', async (req, res, next) => {
  try {
    const { templateId, dateText, students } = req.body;
    if (!Array.isArray(students) || !students.length) return res.status(400).json({ error: 'No students given' });
    if (students.length > 500) return res.status(400).json({ error: 'Maximum 500 certificates at a time' });
    const tpl = await Template.findById(templateId);
    if (!tpl) return res.status(404).json({ error: 'Certificate template not found' });

    const results = [];
    for (const s of students) {
      const name = clean(s.name);
      const ref = clean(s.studentRef);
      if (!name) { results.push({ status: 'invalid', name: '' }); continue; }
      const key = studentKey(name, ref);

      let cert = null;
      for (let attempt = 0; attempt < 5 && !cert; attempt++) {
        try {
          cert = await Certificate.create({
            certId: newCertId(),
            templateId: tpl._id,
            program: tpl.name,
            studentName: name,
            studentRef: ref,
            studentKey: key,
            dateText: String(dateText || ''),
            issuedBy: { id: req.user.id, name: req.user.name }
          });
        } catch (e) {
          if (e.code !== 11000) throw e;
          if (e.keyPattern?.certId) continue; // ID collision: try another
          const existing = await Certificate.findOne({ studentKey: key, templateId: tpl._id });
          results.push({ status: 'duplicate', certificate: existing });
          cert = 'dup';
        }
      }
      if (cert === 'dup') continue;
      if (!cert) throw new Error('Could not generate a unique certificate ID. Please retry.');
      results.push({ status: 'issued', certificate: cert });
    }
    res.status(201).json({ results });
  } catch (e) { next(e); }
});

// History with search + filter + paging.
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 5000);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = {};
    if (req.query.templateId) filter.templateId = req.query.templateId;
    const q = clean(req.query.q);
    if (q) {
      const re = new RegExp(escapeRe(q), 'i');
      filter.$or = [{ studentName: re }, { studentRef: re }, { certId: re }];
    }
    const [items, total] = await Promise.all([
      Certificate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Certificate.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

// Admin only: remove a record (e.g. issued by mistake) so that student can be issued again.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await Certificate.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Certificate not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
