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

// Advanced remix and compositing functionality
router.post('/', async (req, res) => {
  try {
    let { prompt, images, purpose, aspectRatio, imageCount, styleId } = req.body;
    
    // Set user ID for GCS storage
    const userId = req.get('x-user-id') || 'anonymous';
    global.currentUserId = userId;
    
    if (!prompt || !images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Prompt and images array are required'
      });
    }

    // Apply brand-aware placeholder replacement only
    try {
      const brand = require('../services/brandkit');
      const kit = brand.getBrandKit();

      // Determine whether brand font is relevant (only if text is implied or explicitly requested)
      const textImplied = brand.promptImpliesText(prompt) || (prompt || '').includes('[brand font]');

      // Replace explicit placeholders first
      prompt = brand.applyBrandColorsPlaceholder(prompt);
      if (textImplied) {
        prompt = brand.applyBrandFontPlaceholder(prompt);
      } else {
        // Strip brand font placeholder if present but not applicable
        prompt = (prompt || '').replace('[brand font]', '');
      }

      const containsLogoKeyword = (prompt || '').includes('[brand logo]');
      prompt = brand.applyBrandLogoPlaceholder(prompt);

      // Inject logo as an additional reference image only when explicitly requested
      if (containsLogoKeyword) {
        const primaryLogo = brand.getPrimaryLogo();
        if (primaryLogo) {
          const alreadyIncluded = images.some((img) => img.url === primaryLogo);
          if (!alreadyIncluded) {
            images = [
              ...images,
              { id: `brand_logo_${Date.now()}`, url: primaryLogo, title: 'Brand Logo (Primary)' }
            ];
          }
        }
      }
    } catch (e) {
      console.warn('Brand placeholder replacement skipped:', e.message);
    }

    // Get Gemini service (lazy initialization)
    const gemini = getGeminiService();

    // Process the remix operation using Gemini with user prompt directly

    const requestedCount = Number(imageCount) || 1;
    let results;
    if (requestedCount <= 1) {
      const single = await gemini.remixImagesWithContext(prompt, images, aspectRatio || '16:9', styleId || 'freeform');
      results = [single];
    } else {
      const tasks = Array.from({ length: requestedCount }, () =>
        gemini.remixImagesWithContext(prompt, images, aspectRatio || '16:9', styleId || 'freeform')
      );
      results = await Promise.all(tasks);
    }

    res.json({
      prompt,
      // Keep backward compatibility: first item as `result`
      result: results[0],
      results,
      purpose: purpose || null,
      requestedCount,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Remix API error:', error.message);
    res.status(500).json({ 
      error: 'Remix operation failed',
      message: error.message
    });
  }
});

module.exports = router;

module.exports = router;
