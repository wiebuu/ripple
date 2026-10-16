import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '../lib/auth';
import { HttpError } from '../lib/http';

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO = ['video/mp4', 'video/quicktime'];
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: MAX_VIDEO },
  fileFilter: (_req, file, cb) => {
    if (![...IMAGE, ...VIDEO].includes(file.mimetype)) return cb(new HttpError(415, 'Use a JPG, PNG or WebP image, or an MP4 video'));
    cb(null, true);
  },
});

export const uploads = Router();

uploads.post('/', requireAuth, upload.single('file'), (req, res, next) => {
  const f = req.file;
  if (!f) return next(new HttpError(400, 'No file received'));
  if (IMAGE.includes(f.mimetype) && f.size > MAX_IMAGE) {
    fs.rmSync(f.path, { force: true });
    return next(new HttpError(413, 'Images must be under 8 MB'));
  }
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.status(201).json({ url: `${base}/uploads/${f.filename}`, kind: VIDEO.includes(f.mimetype) ? 'video' : 'image', size: f.size });
});
