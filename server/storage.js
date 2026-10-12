import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Legacy location: images uploaded before the move to MongoDB still live here.
export const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const BUCKET = 'certimages';
const isObjectId = (s) => /^[a-f0-9]{24}$/i.test(String(s));

let bucket;
const getBucket = () =>
  (bucket ||= new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET }));
const filesCol = () => mongoose.connection.db.collection(`${BUCKET}.files`);
const legacyPath = (ref) => path.join(UPLOAD_DIR, path.basename(String(ref)));

// Stores the image inside MongoDB (GridFS) and returns its id as a string.
export function saveImage(buffer, contentType, filename) {
  return new Promise((resolve, reject) => {
    const up = getBucket().openUploadStream(filename || 'certificate', { contentType });
    up.on('error', reject);
    up.on('finish', () => resolve(up.id.toString()));
    up.end(buffer);
  });
}

export async function deleteImage(ref) {
  if (!ref) return;
  if (isObjectId(ref)) {
    try { await getBucket().delete(new mongoose.Types.ObjectId(ref)); } catch { /* already gone */ }
  } else {
    fs.unlink(legacyPath(ref), () => {});
  }
}

export async function imageExists(ref) {
  if (isObjectId(ref)) {
    return (await filesCol().countDocuments({ _id: new mongoose.Types.ObjectId(ref) })) > 0;
  }
  return fs.existsSync(legacyPath(ref));
}

// Express handler for GET /uploads/:ref (mounted behind requireAuth)
export async function serveImage(req, res, next) {
  try {
    const { ref } = req.params;
    if (isObjectId(ref)) {
      const file = await filesCol().findOne({ _id: new mongoose.Types.ObjectId(ref) });
      if (!file) return res.status(404).end();
      res.setHeader('Cache-Control', 'private, max-age=604800');
      res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', file.length);
      getBucket().openDownloadStream(file._id).on('error', next).pipe(res);
    } else {
      const p = legacyPath(ref);
      if (!fs.existsSync(p)) return res.status(404).end();
      res.setHeader('Cache-Control', 'private, max-age=604800');
      res.sendFile(p);
    }
  } catch (e) { next(e); }
}
