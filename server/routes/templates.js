import express from 'express';
import multer from 'multer';
import path from 'path';
import Template from '../models/Template.js';
import { requireAdmin } from '../middleware/auth.js';
import { saveImage, deleteImage } from '../storage.js';

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

// Images are held in memory just long enough to be written to MongoDB (GridFS).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG or WEBP images are allowed'));
  }
});

// Mounted behind requireAuth: everyone signed in can list/get; only admins can change.
const router = express.Router();

const defaultFields = () => [
  { key: 'name', label: 'Name', x: 0.5, y: 0.5, fontFamily: 'Cormorant Garamond', fontSize: 0.05, color: '#1a1a1a', align: 'center', bold: false, maxWidth: 0.6 },
  { key: 'date', label: 'Date', x: 0.5, y: 0.75, fontFamily: 'Montserrat', fontSize: 0.02, color: '#1a1a1a', align: 'center', bold: false, maxWidth: 0.3 }
];

router.get('/', async (req, res, next) => {
  try {
    res.json(await Template.find().sort({ createdAt: -1 }));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await Template.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });
    res.json(item);
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, upload.single('image'), async (req, res, next) => {
  let imageRef = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required' });
    const width = Number(req.body.width);
    const height = Number(req.body.height);
    if (!width || !height) return res.status(400).json({ error: 'Image width/height missing' });

    imageRef = await saveImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    const item = await Template.create({
      name: (req.body.name || '').trim() || path.parse(req.file.originalname).name,
      imageFile: imageRef,
      width,
      height,
      fields: defaultFields()
    });
    res.status(201).json(item);
  } catch (e) {
    await deleteImage(imageRef);
    next(e);
  }
});

// Edit: rename, change layout/colours, and optionally replace the image.
// Accepts multipart/form-data (fields as a JSON string) or plain JSON.
router.put('/:id', requireAdmin, upload.single('image'), async (req, res, next) => {
  let newRef = null;
  try {
    const item = await Template.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });

    if (typeof req.body.name === 'string' && req.body.name.trim()) item.name = req.body.name.trim();

    if (req.body.fields) {
      item.fields = typeof req.body.fields === 'string' ? JSON.parse(req.body.fields) : req.body.fields;
    }

    let oldRef = null;
    if (req.file) {
      const width = Number(req.body.width);
      const height = Number(req.body.height);
      if (!width || !height) return res.status(400).json({ error: 'Image width/height missing' });
      newRef = await saveImage(req.file.buffer, req.file.mimetype, req.file.originalname);
      oldRef = item.imageFile;
      item.imageFile = newRef;
      item.width = width;
      item.height = height;
    }

    await item.save();
    if (oldRef) await deleteImage(oldRef);
    res.json(item);
  } catch (e) {
    await deleteImage(newRef);
    next(e);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const item = await Template.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Template not found' });
    await deleteImage(item.imageFile);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
