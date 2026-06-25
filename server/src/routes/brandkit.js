const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getBrandKit, setBrandKit } = require('../services/brandkit');
const { uploadBuffer } = require('../services/storage');

const router = express.Router();

// Uploads for brand assets reuse same /uploads dir
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Use memory storage if GCS is configured to avoid temporary disk writes
const useGcs = !!process.env.GCS_BUCKET;
const storage = useGcs
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => {
        const ts = Date.now();
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `brand_${ts}_${sanitized}`);
      }
    });

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow images and fonts in this router, we further restrict per-endpoint
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Get brand kit
router.get('/', async (req, res) => {
  let kit = getBrandKit();

  // Always try to refresh from GCS to ensure all users see the latest data
  if (process.env.GCS_BUCKET) {
    try {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage();
      const bucket = storage.bucket(process.env.GCS_BUCKET);
      const key = process.env.BRANDKIT_CONFIG_KEY || 'config/brandkit.json';
      const file = bucket.file(key);
      const [exists] = await file.exists();
      if (exists) {
        const [contents] = await file.download();
        const obj = JSON.parse(String(contents || '{}'));
        kit = {
          logos: Array.isArray(obj.logos) ? obj.logos : [],
          colors: Array.isArray(obj.colors) ? obj.colors : [],
          fonts: Array.isArray(obj.fonts) ? obj.fonts : [],
          font: typeof obj.font === 'string' ? obj.font : null,
          heroImage: obj.heroImage || null,
          idGrid: Array.isArray(obj.idGrid) ? obj.idGrid : [],
          idGridMaster: obj.idGridMaster || null,
          idDetail: Array.isArray(obj.idDetail) ? obj.idDetail : [],
          idLifestyle: Array.isArray(obj.idLifestyle) ? obj.idLifestyle : [],
        };
        // Update local cache for consistency
        try { setBrandKit(kit); } catch {}
      }
    } catch (err) {
      console.error('Failed to refresh brand kit from GCS:', err);
      // Fall back to local cache on error
    }
  }

  // Ensure same-host http URLs are upgraded to https when behind proxy
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const expectedHost = req.get('host');
  const rewrite = (url) => {
    try {
      // Handle relative upload paths
      if (typeof url === 'string' && url.startsWith('/uploads/')) {
        return `${protocol}://${expectedHost}${url}`;
      }
      const u = new URL(url);
      // Upgrade scheme for same host
      if (u.host === expectedHost && u.protocol === 'http:') {
        u.protocol = `${protocol}:`;
        return u.toString();
      }
      // Replace localhost dev URLs with current host
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        u.protocol = `${protocol}:`;
        u.host = expectedHost;
        return u.toString();
      }
      return url;
    } catch {
      return url;
    }
  };
  const normalized = {
    ...kit,
    logos: Array.isArray(kit.logos) ? kit.logos.map(rewrite) : kit.logos,
    fonts: Array.isArray(kit.fonts) ? kit.fonts.map(rewrite) : kit.fonts,
  };
  res.json(normalized);
});

// Update brand kit
router.put('/', (req, res) => {
  const { colors, logos, fonts, font, heroImage, idGrid, idGridMaster, idDetail, idLifestyle } = req.body || {};
  const updated = setBrandKit({ colors, logos, fonts, font, heroImage, idGrid, idGridMaster, idDetail, idLifestyle });
  res.json(updated);
});

// Upload logos
router.post('/logos', upload.array('files', 10), (req, res) => {
  try {
    console.log('Brand Kit logo upload request received');
    console.log('Files:', req.files?.map(f => ({ name: f.filename, path: f.path, mimetype: f.mimetype })));
    
    // Force HTTPS in production (Cloud Run)
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    const files = req.files || [];
    const kit = getBrandKit();
    
    // Filter to PNG only per requirements
    const pngFiles = files.filter(f => (f.mimetype || '').includes('png'));
    let newUrls = [];
    if (useGcs) {
      // Upload each PNG buffer to GCS
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const uploads = pngFiles.map(async (f) => {
        const key = `brand/logos/${y}/${m}/brand_${Date.now()}_${(f.originalname || 'logo').replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const buf = f.buffer || fs.readFileSync(f.path);
        // Force no-cache for brand logos to ensure they always refresh
        const url = await uploadBuffer(buf, key, 'image/png', { 
          cacheControl: 'no-cache, no-store, must-revalidate',
          customTime: new Date().toISOString() 
        });
        return url;
      });
      // Resolve URLs - now always returns public URLs (never expires)
      Promise.all(uploads).then((urls) => {
        newUrls = urls.filter(Boolean);
        const updated = setBrandKit({ ...kit, logos: [...kit.logos, ...newUrls] });
        console.log('Brand kit updated with new logos:', updated.logos);
        res.json(updated);
      }).catch((err) => {
        console.error('GCS logo upload failed:', err);
        res.status(500).json({ error: 'Logo upload failed', message: err.message });
      });
      return;
    } else {
      newUrls = pngFiles.map(f => {
        const url = `${host}/uploads/${f.filename}`;
        console.log('Generated logo URL:', url);
        return url;
      });
    }
    
    console.log('New logo URLs:', newUrls);
    const updated = setBrandKit({ ...kit, logos: [...kit.logos, ...newUrls] });
    res.json(updated);
  } catch (error) {
    console.error('Brand Kit logo upload error:', error);
    res.status(500).json({ error: 'Logo upload failed', message: error.message });
  }
});

// Delete logo by URL
router.delete('/logos', (req, res) => {
  const { url } = req.body || {};
  const kit = getBrandKit();
  const updated = setBrandKit({ ...kit, logos: kit.logos.filter(l => l !== url) });
  res.json(updated);
});

// Upload style images
// Removed styles endpoints per updated requirements

// Upload fonts
router.post('/fonts', upload.array('files', 10), (req, res) => {
  // Force HTTPS in production (Cloud Run)
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = `${protocol}://${req.get('host')}`;
  const files = req.files || [];
  const allowed = ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/font-woff', 'application/font-woff2'];
  const kit = getBrandKit();
  const newUrls = files
    .filter(f => allowed.includes(f.mimetype))
    .map(f => `${host}/uploads/${f.filename}`);
  const updated = setBrandKit({ ...kit, fonts: [...(kit.fonts || []), ...newUrls] });
  res.json(updated);
});

// Delete font by URL
router.delete('/fonts', (req, res) => {
  const { url } = req.body || {};
  const kit = getBrandKit();
  const updated = setBrandKit({ ...kit, fonts: (kit.fonts || []).filter(f => f !== url) });
  res.json(updated);
});

module.exports = router;


