const express = require('express');
const GeminiService = require('../services/gemini');

const router = express.Router();

let geminiService;
const getGemini = () => {
  if (!geminiService) geminiService = new GeminiService();
  return geminiService;
};

router.post('/improve', async (req, res) => {
  try {
    const {
      prompt,
      mode = 'image',
      style,
      aspectRatio = '16:9',
      resolution,
      brandKit,
      stagedImages = []
    } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const result = await getGemini().improvePromptWithContext({
      prompt: String(prompt),
      mode,
      style,
      aspectRatio,
      resolution,
      brandKit,
      images: stagedImages,
      styleId: req.body.styleId || req.body.style || 'freeform'
    });

    res.json(result);
  } catch (e) {
    console.error('Improve prompt error:', e);
    res.status(500).json({ error: 'Improve failed', message: e.message });
  }
});

router.post('/random', async (req, res) => {
  try {
    const { mode = 'image', style, aspectRatio = '16:9', resolution, brandKit, styleId } = req.body || {};
    if (mode !== 'image' && mode !== 'video') {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    const text = await getGemini().generateRandomPrompt({ mode, style, aspectRatio, resolution, brandKit, styleId: styleId || style });
    if (!text) {
      return res.status(502).json({ error: 'No prompt returned' });
    }
    res.json({ prompt: String(text) });
  } catch (e) {
    console.error('Random prompt error:', e);
    res.status(500).json({ error: 'Random failed', message: e.message });
  }
});

router.post('/expand', async (req, res) => {
  try {
    const { brief = '', template = '', fields = {}, brandContext = {} } = req.body || {};
    const prompt = await getGemini().expandVideoPrompt({ brief, template, fields, brandContext });
    if (!prompt) return res.status(502).json({ error: 'No prompt returned' });
    res.json({ prompt });
  } catch (e) {
    console.error('Expand prompt error:', e);
    res.status(500).json({ error: 'Expand failed', message: e.message });
  }
});

module.exports = router;


