const express = require('express');
const GeminiService = require('../services/gemini');
const router = express.Router();

// Lazy initialize Gemini service
let geminiService;
const getGeminiService = () => {
  if (!geminiService) {
    try {
      geminiService = new GeminiService();
    } catch (error) {
      console.error('Failed to initialize Gemini service:', error.message);
      throw error;
    }
  }
  return geminiService;
};

// Text-to-image generation using Google Gemini
router.get('/', async (req, res) => {
  try {
    let { prompt, purpose, imageCount, aspectRatio, styleId } = req.query;
    
    // Set user ID for GCS storage
    const userId = req.get('x-user-id') || 'anonymous';
    global.currentUserId = userId;
    // Apply brand-aware placeholder replacement only
    try {
      const brand = require('../services/brandkit');
      const kit = brand.getBrandKit();

      const textImplied = brand.promptImpliesText(prompt) || (prompt || '').includes('[brand font]');

      prompt = brand.applyBrandColorsPlaceholder(prompt);
      if (textImplied) {
        prompt = brand.applyBrandFontPlaceholder(prompt);
      } else {
        prompt = (prompt || '').replace('[brand font]', '');
      }
      // Replace [brand logo] with descriptive wording in text-only generation
      prompt = brand.applyBrandLogoPlaceholder(prompt);
    } catch (e) {
      console.warn('Brand placeholder replacement skipped:', e.message);
    }
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt parameter is required' });
    }

    // Get Gemini service (lazy initialization)
    const gemini = getGeminiService();

    // Generate image using Gemini service with user prompt directly
    const finalPrompt = prompt;

    const requestedCount = Number(imageCount) || 1;
    let results;
    let generatedImage;
    
    // Generate multiple images if requested
    if (requestedCount <= 1) {
      generatedImage = await gemini.generateImage(finalPrompt, 'photorealistic', aspectRatio || '16:9', styleId);
      results = [generatedImage];
    } else {
      // Generate multiple images in parallel
      const imagePromises = Array.from({ length: requestedCount }, () => 
        gemini.generateImage(finalPrompt, 'photorealistic', aspectRatio || '16:9', styleId)
      );
      results = await Promise.all(imagePromises);
      generatedImage = results[0]; // Use first image for prompt reference
    }

    res.json({
      prompt: generatedImage.prompt,
      results,
      purpose: purpose || null,
      requestedCount,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Generation API error:', error.message);
    res.status(500).json({ 
      error: 'Generation failed',
      message: error.message
    });
  }
});

// POST /api/generate — accepts referenceImages for reference-guided generation
router.post('/', async (req, res) => {
  try {
    let { prompt, purpose, imageCount, aspectRatio, styleId, referenceImages } = req.body || {};
    const userId = req.get('x-user-id') || 'anonymous';
    global.currentUserId = userId;

    try {
      const brand = require('../services/brandkit');
      const textImplied = brand.promptImpliesText(prompt) || (prompt || '').includes('[brand font]');
      prompt = brand.applyBrandColorsPlaceholder(prompt);
      if (textImplied) {
        prompt = brand.applyBrandFontPlaceholder(prompt);
      } else {
        prompt = (prompt || '').replace('[brand font]', '');
      }
      prompt = brand.applyBrandLogoPlaceholder(prompt);
    } catch (e) {
      console.warn('Brand placeholder replacement skipped:', e.message);
    }

    if (!prompt) return res.status(400).json({ error: 'Prompt parameter is required' });

    const gemini = getGeminiService();
    const requestedCount = Math.max(1, Math.min(Number(imageCount) || 1, 4));
    const refs = Array.isArray(referenceImages) && referenceImages.length > 0 ? referenceImages : [];

    let results;
    if (refs.length > 0) {
      // Use remixImagesWithContext when references are provided
      const tasks = Array.from({ length: requestedCount }, () =>
        gemini.remixImagesWithContext(prompt, refs, aspectRatio || '16:9', styleId || 'freeform')
      );
      results = await Promise.all(tasks);
    } else {
      const tasks = Array.from({ length: requestedCount }, () =>
        gemini.generateImage(prompt, 'photorealistic', aspectRatio || '16:9', styleId)
      );
      results = await Promise.all(tasks);
    }

    res.json({ prompt, results, purpose: purpose || null, requestedCount, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Generation POST API error:', error.message);
    res.status(500).json({ error: 'Generation failed', message: error.message });
  }
});

module.exports = router;
