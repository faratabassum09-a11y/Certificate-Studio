import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import templatesRouter from './routes/templates.js';
import { serveImage, imageExists, UPLOAD_DIR } from './storage.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import Template from './models/Template.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, requireAdmin, usersRouter);
app.use('/api/templates', requireAuth, templatesRouter);

// Certificate images are private: only signed-in users can fetch them.
app.get('/uploads/:ref', requireAuth, serveImage);

// Serve the built React app in production
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Error handler (multer errors, validation errors, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/certificate-generator';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    // Warn about templates whose image is missing (old disk uploads that were not copied over)
    Template.find().then(async (all) => {
      const missing = [];
      for (const t of all) if (!(await imageExists(t.imageFile))) missing.push(t);
      if (missing.length) {
        console.warn(`WARNING: ${missing.length} of ${all.length} certificate image(s) are missing:`);
        missing.forEach((t) => console.warn(`  - "${t.name}" (${t.imageFile})`));
        console.warn(`Old images lived in ${UPLOAD_DIR}. Copy them back there, or open Edit on each certificate and replace the image.`);
      }
    }).catch(() => {});
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
