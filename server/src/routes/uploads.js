const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { uploadBuffer } = require('../services/storage');
const sharp = require('sharp');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const THUMB_MAX_WIDTH = 512;

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Use memory storage when GCS is configured for direct streaming
// Check if GCS is properly configured (has bucket AND credentials)
let useGcs = false;
if (process.env.GCS_BUCKET) {
  try {
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage();
    // Test if credentials are available (synchronous check)
    useGcs = true;
  } catch (error) {
    console.warn('GCS bucket set but credentials not available, falling back to local storage:', error.message);
    useGcs = false;
  }
}
const storage = useGcs
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        console.log('Multer destination:', UPLOAD_DIR);
        cb(null, UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filename = `${timestamp}_${sanitized}`;
        console.log('Multer filename:', filename);
        cb(null, filename);
      }
    });

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: images (JPEG, PNG, WebP) and videos (MP4, WebM, MOV)`));
  },
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB for video support
});

router.post('/', (req, res, next) => {
  console.log('Upload middleware called');
  next();
}, upload.array('files', 20), (err, req, res, next) => {
  if (err) {
    console.error('Multer error:', err);
    return res.status(400).json({ error: 'Upload failed', message: err.message });
  }
  next();
}, async (req, res) => {
  try {
    console.log('Upload request received');
    console.log('Files:', req.files);
    console.log('Body:', req.body);
    
    // Force HTTPS in production (Cloud Run)
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    const files = req.files || [];
    
    console.log('Processing files:', files.length);

    const results = [];
    const userId = req.get('x-user-id') || 'anonymous';
    const companyId = req.get('x-company-id') || 'public';
    for (const file of files) {
      const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);

      if (useGcs) {
        try {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const timestamp = Date.now();
          const sanitized = (file.originalname || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ext = path.extname(sanitized) || (isVideo ? '.mp4' : (file.mimetype === 'image/png' ? '.png' : (file.mimetype === 'image/webp' ? '.webp' : '.jpg')));
          const base = path.basename(sanitized, ext);
          const subfolder = isVideo ? 'uploads/videos' : 'uploads';
          const key = `users/${userId}/${subfolder}/${y}/${m}/${timestamp}_${base}${ext}`;
          const nowIso = new Date().toISOString();
          const url = await uploadBuffer(file.buffer, key, file.mimetype, { customTime: nowIso });

          const result = {
            id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: file.originalname,
            url,
            thumbnail: url,
            source: 'Uploaded',
          };

          if (isVideo) {
            result.mediaType = 'video';
          } else {
            const imgMeta = await sharp(file.buffer).metadata();
            result.width = imgMeta.width || null;
            result.height = imgMeta.height || null;
            const thumbKey = `users/${userId}/${subfolder}/${y}/${m}/${timestamp}_${base}_thumb${ext}`;
            const thumbBuf = await sharp(file.buffer).resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true }).toBuffer();
            result.thumbnail = await uploadBuffer(thumbBuf, thumbKey, file.mimetype, { customTime: nowIso });
          }

          results.push(result);
        } catch (gcsError) {
          console.warn('GCS upload failed, falling back to local storage:', gcsError.message);
          const timestamp = Date.now();
          const sanitized = (file.originalname || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ext = path.extname(sanitized) || (isVideo ? '.mp4' : (file.mimetype === 'image/png' ? '.png' : (file.mimetype === 'image/webp' ? '.webp' : '.jpg')));
          const base = path.basename(sanitized, ext);
          const filename = `${timestamp}_${base}${ext}`;
          const filePath = path.join(UPLOAD_DIR, filename);

          try {
            await fs.promises.writeFile(filePath, file.buffer);
            const result = {
              id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              title: file.originalname,
              url: `${host}/uploads/${filename}`,
              thumbnail: `${host}/uploads/${filename}`,
              source: 'Uploaded',
            };
            if (isVideo) {
              result.mediaType = 'video';
            } else {
              const metadata = await sharp(file.buffer).metadata();
              result.width = metadata.width || null;
              result.height = metadata.height || null;
              const thumbName = `${timestamp}_${base}_thumb${ext}`;
              const thumbPath = path.join(UPLOAD_DIR, thumbName);
              await sharp(file.buffer).resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true }).toFile(thumbPath);
              result.thumbnail = `${host}/uploads/${thumbName}`;
            }
            results.push(result);
          } catch (err) {
            console.error('Local fallback failed:', err);
            results.push({
              id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              title: file.originalname,
              url: `${host}/uploads/${filename}`,
              thumbnail: `${host}/uploads/${filename}`,
              source: 'Uploaded',
              ...(isVideo ? { mediaType: 'video' } : {})
            });
          }
        }
      } else {
        console.log('Processing file:', file.filename, 'at', file.path);
        const inputPath = file.path;
        const ext = path.extname(file.filename);
        const base = path.basename(file.filename, ext);
        const result = {
          id: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: file.originalname,
          url: `${host}/uploads/${file.filename}`,
          thumbnail: `${host}/uploads/${file.filename}`,
          source: 'Uploaded',
        };
        if (isVideo) {
          result.mediaType = 'video';
        } else {
          try {
            const metadata = await sharp(inputPath).metadata();
            result.width = metadata.width || null;
            result.height = metadata.height || null;
            const thumbName = `${base}_thumb${ext}`;
            const thumbPath = path.join(UPLOAD_DIR, thumbName);
            await sharp(inputPath).resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true }).toFile(thumbPath);
            result.thumbnail = `${host}/uploads/${thumbName}`;
          } catch (err) {
            // thumbnail generation failed, use original
          }
        }
        results.push(result);
      }
    }

    res.json({
      results,
      uploadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// Save edited image from data URL - always creates new edit in edits/ folder
router.post('/save-edit', async (req, res) => {
  console.log('save-edit route hit');
  try {
    const { dataUrl, originalUrl, replaceOriginal } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'dataUrl required' });
    }
    const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!m) return res.status(400).json({ error: 'Invalid dataUrl' });
    const mimeType = m[1];
    const base64 = m[2];
    const buf = Buffer.from(base64, 'base64');

    const useGcsHere = !!process.env.GCS_BUCKET;
    if (useGcsHere) {
      const userId = req.get('x-user-id') || 'anonymous';
      const now = new Date();
      const y = now.getFullYear();
      const mStr = String(now.getMonth() + 1).padStart(2, '0');
      const ext = (mimeType === 'image/png') ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg');

      // Always create a new edit in the edits/ folder
      const editsKey = `users/${userId}/edits/${y}/${mStr}/edited_${Date.now()}${ext}`;
      const finalUrl = await uploadBuffer(buf, editsKey, mimeType, { customTime: new Date().toISOString() });
      const finalFilename = editsKey.split('/').pop();

      res.json({ url: finalUrl, filename: finalFilename, replaced: false });
      return;
    }

    // Fallback to local disk
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = (mimeType === 'image/png') ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg');
    const filename = `edited_${Date.now()}${ext}`;
    const outPath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(outPath, buf);
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    const url = `${host}/uploads/${filename}`;
    res.json({ url, filename, replaced: false });
  } catch (e) {
    console.error('save-edit error:', e);
    res.status(500).json({ error: 'Save failed', message: e.message });
  }
});
 
module.exports = router;

