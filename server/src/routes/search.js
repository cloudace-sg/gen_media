const express = require('express');
const axios = require('axios');
const router = express.Router();

async function searchGoogleImages(query, limit = 5) {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!key || !cx) return [];
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { key, cx, q: query, searchType: 'image', num: limit, imgType: 'photo', safe: 'active' },
      timeout: 8000
    });
    return (response.data.items || []).map(item => ({ url: item.link }));
  } catch (e) {
    console.warn('Google Custom Search failed:', e.message);
    return [];
  }
}

const PEXELS_BASE = 'https://api.pexels.com';
const UNSPLASH_BASE = 'https://api.unsplash.com';
const PIXABAY_BASE = 'https://pixabay.com/api';

function getKeys() {
  return {
    pexels: process.env.PEXELS_API_KEY || null,
    unsplash: process.env.UNSPLASH_ACCESS_KEY || null,
    pixabay: process.env.PIXABAY_API_KEY || null
  };
}

async function searchPexelsImages(query, perPage, apiKey) {
  try {
    const response = await axios.get(`${PEXELS_BASE}/v1/search`, {
      headers: { Authorization: apiKey },
      params: { query, per_page: perPage },
      timeout: 5000
    });
    return (response.data.photos || []).map((photo, i) => ({
      id: `pexels_${photo.id}`,
      title: photo.alt || query,
      url: photo.src.original,
      thumbnail: photo.src.medium,
      source: `Pexels – ${photo.photographer}`,
      width: photo.width,
      height: photo.height
    }));
  } catch (e) {
    console.warn('Pexels image search failed:', e.message);
    return [];
  }
}

async function searchUnsplashImages(query, perPage, apiKey) {
  try {
    const response = await axios.get(`${UNSPLASH_BASE}/search/photos`, {
      headers: { Authorization: `Client-ID ${apiKey}` },
      params: { query, per_page: perPage },
      timeout: 5000
    });
    return (response.data.results || []).map((photo, i) => ({
      id: `unsplash_${photo.id}`,
      title: photo.alt_description || photo.description || query,
      url: photo.urls.full,
      thumbnail: photo.urls.small,
      source: `Unsplash – ${photo.user?.name || 'Unknown'}`,
      width: photo.width,
      height: photo.height
    }));
  } catch (e) {
    console.warn('Unsplash image search failed:', e.message);
    return [];
  }
}

async function searchPixabayImages(query, perPage, apiKey) {
  try {
    const response = await axios.get(PIXABAY_BASE, {
      params: { key: apiKey, q: query, per_page: perPage, image_type: 'photo', min_width: 800 },
      timeout: 5000
    });
    return (response.data.hits || []).map((hit, i) => ({
      id: `pixabay_${hit.id}`,
      title: hit.tags || query,
      url: hit.largeImageURL,
      thumbnail: hit.previewURL,
      source: `Pixabay – ${hit.user || 'Unknown'}`,
      width: hit.imageWidth,
      height: hit.imageHeight
    }));
  } catch (e) {
    console.warn('Pixabay image search failed:', e.message);
    return [];
  }
}

async function searchPexelsVideos(query, perPage, apiKey) {
  try {
    const response = await axios.get(`${PEXELS_BASE}/videos/search`, {
      headers: { Authorization: apiKey },
      params: { query, per_page: perPage },
      timeout: 5000
    });
    return (response.data.videos || []).map((video, i) => {
      const hdFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0] || {};
      return {
        id: `pexels_video_${video.id}`,
        title: video.url.split('/').pop() || query,
        url: hdFile.link || '',
        thumbnail: video.image || '',
        source: `Pexels – ${video.user?.name || 'Unknown'}`,
        width: hdFile.width || video.width,
        height: hdFile.height || video.height,
        duration: video.duration,
        type: 'video',
        mediaType: 'video'
      };
    });
  } catch (e) {
    console.warn('Pexels video search failed:', e.message);
    return [];
  }
}

async function searchPixabayVideos(query, perPage, apiKey) {
  try {
    const response = await axios.get(`${PIXABAY_BASE}/videos/`, {
      params: { key: apiKey, q: query, per_page: perPage },
      timeout: 5000
    });
    return (response.data.hits || []).map((hit, i) => {
      const hdVideo = hit.videos?.large || hit.videos?.medium || hit.videos?.small || {};
      const tinyVideo = hit.videos?.tiny || {};
      const thumbnail = hit.picture_id
        ? `https://i.vimeocdn.com/video/${hit.picture_id}_295x166.jpg`
        : (tinyVideo.thumbnail || tinyVideo.url || '');
      return {
        id: `pixabay_video_${hit.id}`,
        title: hit.tags || query,
        url: hdVideo.url || '',
        thumbnail,
        source: `Pixabay – ${hit.user || 'Unknown'}`,
        width: hdVideo.width || 1920,
        height: hdVideo.height || 1080,
        duration: hit.duration,
        type: 'video',
        mediaType: 'video'
      };
    });
  } catch (e) {
    console.warn('Pixabay video search failed:', e.message);
    return [];
  }
}

function interleave(...arrays) {
  const result = [];
  const maxLen = Math.max(...arrays.map(a => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}

// Multi-source image search
router.get('/', async (req, res) => {
  try {
    const { query, num = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const keys = getKeys();
    if (!keys.pexels && !keys.unsplash && !keys.pixabay) {
      return res.status(500).json({
        error: 'Search API configuration missing',
        message: 'Please configure at least one: PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, or PIXABAY_API_KEY'
      });
    }

    const perSource = Math.ceil(Number(num) / Object.values(keys).filter(Boolean).length);
    const searches = [];

    if (keys.pexels) searches.push(searchPexelsImages(query, perSource, keys.pexels));
    if (keys.unsplash) searches.push(searchUnsplashImages(query, perSource, keys.unsplash));
    if (keys.pixabay) searches.push(searchPixabayImages(query, perSource, keys.pixabay));

    const allResults = await Promise.all(searches);
    const results = interleave(...allResults).slice(0, Number(num));

    const sources = [];
    if (keys.pexels) sources.push('Pexels');
    if (keys.unsplash) sources.push('Unsplash');
    if (keys.pixabay) sources.push('Pixabay');

    res.json({
      query,
      results,
      totalResults: results.length,
      searchTime: 0,
      licenseFilter: 'free',
      licenseInfo: `Free for commercial use – sourced from ${sources.join(', ')}`
    });
  } catch (error) {
    console.error('Search API error:', error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.message || 'Failed to search images'
    });
  }
});

// Multi-source video search
router.get('/videos', async (req, res) => {
  try {
    const { query, num = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const keys = getKeys();
    const videoKeys = { pexels: keys.pexels, pixabay: keys.pixabay };
    if (!videoKeys.pexels && !videoKeys.pixabay) {
      return res.status(500).json({
        error: 'Video search API configuration missing',
        message: 'Please configure at least one: PEXELS_API_KEY or PIXABAY_API_KEY'
      });
    }

    const perSource = Math.ceil(Number(num) / Object.values(videoKeys).filter(Boolean).length);
    const searches = [];

    if (videoKeys.pexels) searches.push(searchPexelsVideos(query, perSource, videoKeys.pexels));
    if (videoKeys.pixabay) searches.push(searchPixabayVideos(query, perSource, videoKeys.pixabay));

    const allResults = await Promise.all(searches);
    const results = interleave(...allResults).slice(0, Number(num));

    const sources = [];
    if (videoKeys.pexels) sources.push('Pexels');
    if (videoKeys.pixabay) sources.push('Pixabay');

    res.json({
      query,
      results,
      totalResults: results.length,
      searchTime: 0,
      licenseFilter: 'free',
      licenseInfo: `Free for commercial use – sourced from ${sources.join(', ')}`
    });
  } catch (error) {
    console.error('Video search API error:', error.message);
    res.status(500).json({
      error: 'Video search failed',
      message: error.message || 'Failed to search videos'
    });
  }
});

// POST /api/search/product-references
// Identifies the product in the master image via Gemini, then searches Google Images for references.
router.post('/product-references', async (req, res) => {
  const { imageUrl } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  try {
    const GeminiService = require('../services/gemini');
    const gemini = new GeminiService();
    const query = await gemini.identifyProductFromImage(imageUrl);
    if (!query) return res.json({ query: null, references: [] });
    const references = await searchGoogleImages(query, 5);
    res.json({ query, references });
  } catch (e) {
    console.error('Product reference search failed:', e.message);
    res.json({ query: null, references: [] }); // graceful fallback — don't block generation
  }
});

module.exports = router;
