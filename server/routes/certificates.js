import express from 'express';
import crypto from 'crypto';
import Template from '../models/Template.js';
import Certificate from '../models/Certificate.js';
import ChangeRequest from '../models/ChangeRequest.js';
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

// Validates proposed edits against a certificate. Returns { next } or { error }.
function buildEdit(cert, body) {
  const next = {
    studentName: body.studentName === undefined ? cert.studentName : clean(body.studentName),
    studentRef: body.studentRef === undefined ? cert.studentRef : clean(body.studentRef),
    dateText: body.dateText === undefined ? cert.dateText : String(body.dateText || '').trim()
  };
  if (!next.studentName) return { error: 'Name cannot be empty' };
  if (next.studentName.length > 200) return { error: 'Name is too long' };
  const same =
    next.studentName === cert.studentName && next.studentRef === cert.studentRef && next.dateText === cert.dateText;
  if (same) return { error: 'Nothing was changed' };
  return { next };
}

async function applyEdit(cert, next) {
  cert.studentName = next.studentName;
  cert.studentRef = next.studentRef;
  cert.dateText = next.dateText;
  cert.studentKey = studentKey(next.studentName, next.studentRef);
  try {
    await cert.save();
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Another certificate for this program already exists for that student.');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

// Coordinator: ask an admin for permission to correct an issued certificate.
router.post('/:id/change-request', async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return res.status(400).json({ error: 'Admins can edit a certificate directly.' });
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please give a reason for the change' });
    const { next: proposed, error } = buildEdit(cert, req.body);
    if (error) return res.status(400).json({ error });
    if (await ChangeRequest.exists({ certificateId: cert._id, status: 'pending' })) {
      return res.status(409).json({ error: 'A change request for this certificate is already waiting for admin approval.' });
    }
    const cr = await ChangeRequest.create({
      certificateId: cert._id,
      certId: cert.certId,
      program: cert.program,
      current: { studentName: cert.studentName, studentRef: cert.studentRef, dateText: cert.dateText },
      proposed,
      reason: reason.slice(0, 500),
      requestedBy: { id: req.user.id, name: req.user.name }
    });
    res.status(201).json(cr);
  } catch (e) { next(e); }
});

// Admin sees every request; a coordinator sees only their own.
router.get('/change-requests', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    if (req.user.role !== 'admin') filter['requestedBy.id'] = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await ChangeRequest.find(filter).sort({ createdAt: -1 }).limit(limit));
  } catch (e) { next(e); }
});

router.get('/change-requests/pending-count', requireAdmin, async (req, res, next) => {
  try {
    res.json({ count: await ChangeRequest.countDocuments({ status: 'pending' }) });
  } catch (e) { next(e); }
});

async function decide(req, res, next, approve) {
  try {
    const cr = await ChangeRequest.findById(req.params.rid);
    if (!cr) return res.status(404).json({ error: 'Request not found' });
    if (cr.status !== 'pending') return res.status(409).json({ error: `Already ${cr.status}` });

    if (approve) {
      const cert = await Certificate.findById(cr.certificateId);
      if (!cert) return res.status(404).json({ error: 'The certificate no longer exists' });
      await applyEdit(cert, cr.proposed);
    }
    cr.status = approve ? 'approved' : 'rejected';
    cr.decidedBy = { id: req.user.id, name: req.user.name };
    cr.decidedAt = new Date();
    cr.decisionNote = String(req.body?.note || '').trim().slice(0, 500);
    await cr.save();
    res.json(cr);
  } catch (e) { next(e); }
}
router.post('/change-requests/:rid/approve', requireAdmin, (req, res, next) => decide(req, res, next, true));
router.post('/change-requests/:rid/reject', requireAdmin, (req, res, next) => decide(req, res, next, false));

// Admin only: edit an issued certificate directly (no approval needed).
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    const { next: proposed, error } = buildEdit(cert, req.body);
    if (error) return res.status(400).json({ error });
    await applyEdit(cert, proposed);
    // any pending request for this certificate is now stale
    await ChangeRequest.updateMany(
      { certificateId: cert._id, status: 'pending' },
      { status: 'rejected', decidedBy: { id: req.user.id, name: req.user.name }, decidedAt: new Date(), decisionNote: 'Superseded: admin edited the certificate directly.' }
    );
    res.json(cert);
  } catch (e) { next(e); }
});

// Admin only: remove a record (e.g. issued by mistake) so that student can be issued again.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await Certificate.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Certificate not found' });
    await ChangeRequest.updateMany(
      { certificateId: item._id, status: 'pending' },
      { status: 'rejected', decidedBy: { id: req.user.id, name: req.user.name }, decidedAt: new Date(), decisionNote: 'Certificate was removed.' }
    );
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
