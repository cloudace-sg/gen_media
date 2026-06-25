const express = require('express');
const { Storage } = require('@google-cloud/storage');
const mime = require('mime-types');
const { signedReadUrl } = require('../services/storage');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET;

function ensureGcsConfigured(res) {
  if (!bucketName) {
    // Return empty result instead of error for development
    res.json({ items: [], nextPageToken: null });
    return false;
  }
  return true;
}

function toItemFromFile(file, { signedUrl, publicBase }) {
  const name = file.name || '';
  const parts = name.split('/');
  const type = name.includes('/generated/videos/') ? 'video' : (name.includes('/generated/images/') || name.includes('/generated/remix/')) ? 'image' : 'upload';
  const createdAt = (file.metadata && (file.metadata.timeCreated || file.metadata.customTime)) || null;
  const url = signedUrl || (publicBase ? `${publicBase}/${name}` : undefined);
  return {
    id: name,
    key: name,
    type: type === 'video' ? 'generated_video' : (type === 'image' ? (name.includes('/remix/') ? 'remix_image' : (name.includes('/images/') ? 'generated_image' : 'image')) : 'upload'),
    url,
    size: file.metadata ? Number(file.metadata.size || 0) : null,
    contentType: file.metadata ? (file.metadata.contentType || mime.lookup(name) || null) : null,
    createdAt,
  };
}

// List local files from uploads directory
async function listLocalFiles(req, res) {
  try {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    const { type, limit = 50 } = req.query || {};
    
    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ items: [], nextPageToken: null });
    }
    
    const files = await fs.promises.readdir(uploadsDir);
    const items = [];
    
    for (const filename of files) {
      // Skip thumbnail files
      if (filename.toLowerCase().includes('thumb')) continue;
      
      const filePath = path.join(uploadsDir, filename);
      const stats = await fs.promises.stat(filePath);
      
      // Determine file type based on filename patterns
      let fileType = 'upload';
      if (filename.includes('_thumb')) continue; // Skip thumbnails
      
      const ext = path.extname(filename).toLowerCase();
      const contentType = mime.lookup(filename) || 'application/octet-stream';
      
      if (contentType.startsWith('video/')) {
        fileType = 'generated_video';
      }

      // Map client filter values to local fileType values
      const typeFilterMap = {
        uploads: 'upload',
        generated_images: 'generated_image',
        generated_videos: 'generated_video',
        generated_remix: 'remix_image',
        edits: 'edit',
      };
      const normalizedFilter = typeFilterMap[type] || type;
      if (type && normalizedFilter !== fileType) continue;
      
      items.push({
        id: filename,
        key: filename,
        type: fileType,
        url: `${host}/uploads/${filename}`,
        size: stats.size,
        contentType,
        createdAt: stats.birthtime.toISOString()
      });
    }
    
    // Sort by creation time (newest first)
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply limit
    const limitedItems = items.slice(0, limit);
    
    res.json({ 
      items: limitedItems, 
      nextPageToken: limitedItems.length < items.length ? 'has_more' : null 
    });
  } catch (error) {
    console.error('List local files error:', error);
    res.json({ items: [], nextPageToken: null });
  }
}

// GET /api/files
router.get('/', async (req, res) => {
  try {
    // No GCS in local dev — list uploads from disk instead
    if (!bucketName) return await listLocalFiles(req, res);
    
    // Check if GCS credentials are available on the specific bucket (not getBuckets which requires storage.Admin)
    try {
      await storage.bucket(bucketName).getMetadata();
    } catch (credError) {
      console.warn('GCS credentials not available, falling back to local files:', credError.message);
      // Fall back to local files
      return await listLocalFiles(req, res);
    }
    
    const userId = req.get('x-user-id') || 'anonymous';
    const { type, limit = 50, pageToken } = req.query || {};

    const bucket = storage.bucket(bucketName);
    const prefix = `users/${userId}/`;

    // Map filter to path segment
    let typePrefix = '';
    if (type === 'uploads') typePrefix = 'uploads/';
    else if (type === 'generated_images') typePrefix = 'generated/images/';
    else if (type === 'generated_remix') typePrefix = 'generated/remix/';
    else if (type === 'generated_videos') typePrefix = 'generated/videos/';
    else if (type === 'edits') typePrefix = 'edits/';

    const options = {
      prefix: prefix + typePrefix,
      maxResults: Math.max(1, Math.min(Number(limit) || 50, 200)),
      autoPaginate: false,
      pageToken: pageToken || undefined,
    };

    const [files, , resp] = await bucket.getFiles(options);
    const nextPageToken = resp && resp.nextPageToken ? resp.nextPageToken : undefined;

    const publicBase = process.env.ASSET_PUBLIC === 'public' ? `https://storage.googleapis.com/${bucketName}` : null;

    // Filter out thumbnails and prepare signed URLs if private
    const items = [];
    for (const f of files) {
      // Skip thumbnail files (contain 'thumb' in name)
      if (f.name.toLowerCase().includes('thumb')) continue;
      let url;
      if (process.env.ASSET_PUBLIC === 'public') {
        url = `${publicBase}/${f.name}`;
      } else {
        try {
          url = await signedReadUrl(f.name, Number(process.env.SIGNED_URL_TTL || 86400));
        } catch (_) {
          url = null;
        }
      }
      items.push(toItemFromFile(f, { signedUrl: url, publicBase }));
    }

    // Sort by creation time (newest first)
    items.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA; // Descending order (newest first)
    });

    res.json({ items, nextPageToken });
  } catch (e) {
    console.error('List files error:', e);
    // Return empty result instead of error for development
    res.json({ items: [], nextPageToken: null });
  }
});

// POST /api/files/signed-url { key, ttlSec }
router.post('/signed-url', async (req, res) => {
  try {
    if (!ensureGcsConfigured(res)) return;
    const { key, ttlSec } = req.body || {};
    if (!key) return res.status(400).json({ error: 'key required' });
    const url = await signedReadUrl(String(key), Number(ttlSec || process.env.SIGNED_URL_TTL || 86400));
    res.json({ url });
  } catch (e) {
    console.error('Signed URL error:', e);
    res.status(500).json({ error: 'Sign failed', message: e.message });
  }
});

// DELETE /api/files { keys: [] }
router.delete('/', async (req, res) => {
  try {
    if (!ensureGcsConfigured(res)) return;
    const keys = (req.body && Array.isArray(req.body.keys)) ? req.body.keys : [];
    if (!keys.length) return res.status(400).json({ error: 'keys required' });
    const bucket = storage.bucket(bucketName);
    const results = [];
    for (const k of keys) {
      try {
        await bucket.file(k).delete({ ignoreNotFound: true });
        results.push({ key: k, deleted: true });
      } catch (e) {
        results.push({ key: k, deleted: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) {
    console.error('Delete files error:', e);
    res.status(500).json({ error: 'Delete failed', message: e.message });
  }
});

module.exports = router;


