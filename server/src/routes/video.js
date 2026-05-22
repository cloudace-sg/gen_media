const express = require('express');
const router = express.Router();
const path = require('path');
const mime = require('mime-types');
const { uploadFile } = require('../services/storage');

const GeminiService = require('../services/gemini');
let gemini = null; // lazy init to avoid crashing on import if env is missing

// POST /api/video
// Body: { prompt: string, negativePrompt?: string, aspectRatio?: '16:9'|'9:16', resolution?: '720p'|'1080p', personGeneration?: 'allow_all'|'allow_adult'|'dont_allow', imageUrl?: string, videoUrl?: string }
router.post('/', async (req, res) => {
  try {
    if (!gemini) gemini = new GeminiService();
    const { prompt, negativePrompt, aspectRatio, resolution, personGeneration, imageUrl, videoUrl } = req.body || {};
    
    // Set user ID for GCS storage
    const userId = req.get('x-user-id') || 'anonymous';
    global.currentUserId = userId;

    // Brand-aware placeholder replacement only
    let promptProcessed = String(prompt || '');
    try {
      const brand = require('../services/brandkit');
      const kit = brand.getBrandKit();
      const textImplied = brand.promptImpliesText(promptProcessed) || promptProcessed.includes('[brand font]');
      promptProcessed = brand.applyBrandColorsPlaceholder(promptProcessed);
      if (textImplied) {
        promptProcessed = brand.applyBrandFontPlaceholder(promptProcessed);
      } else {
        promptProcessed = promptProcessed.replace('[brand font]', '');
      }
      // Do not inject logo assets for video here; keep semantic mention only
      promptProcessed = brand.applyBrandLogoPlaceholder(promptProcessed);
    } catch (e) {
      console.warn('Brand placeholder replacement skipped:', e.message);
    }

    const result = await gemini.generateVideoVeo3({ prompt: promptProcessed, negativePrompt, aspectRatio, resolution, personGeneration, imageUrl, videoUrl });

    // If GCS is configured, upload resulting file to bucket and return its URL
    let videoUrl;
    if (process.env.GCS_BUCKET && result && result.filepath) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const key = `users/${userId}/generated/videos/${y}/${m}/${path.basename(result.filepath)}`;
      videoUrl = await uploadFile(result.filepath, key, mime.lookup(result.filepath) || 'video/mp4', { customTime: new Date().toISOString() });
    } else {
      const filename = result.filename;
      videoUrl = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}/uploads/${filename}`;
    }

    res.json({
      prompt: promptProcessed,
      aspectRatio: result.aspectRatio,
      resolution: result.resolution,
      url: videoUrl,
      filename: path.basename(videoUrl)
    });
  } catch (err) {
    console.error('Video generation error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: 'Video generation failed', message: err.message });
  }
});

module.exports = router;


