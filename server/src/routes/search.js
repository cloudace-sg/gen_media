const express = require('express');
const axios = require('axios');
const router = express.Router();

const PEXELS_BASE = 'https://api.pexels.com';

function getPexelsKey() {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  return key;
}

// Image search via Pexels
router.get('/', async (req, res) => {
  try {
    const { query, start = 1, num = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const apiKey = getPexelsKey();
    if (!apiKey) {
      return res.status(500).json({
        error: 'Search API configuration missing',
        message: 'Please configure PEXELS_API_KEY'
      });
    }

    const page = Math.max(1, Math.ceil(Number(start) / Number(num)));
    const perPage = Math.min(Number(num), 80);

    const response = await axios.get(`${PEXELS_BASE}/v1/search`, {
      headers: { Authorization: apiKey },
      params: { query, page, per_page: perPage }
    });

    const results = (response.data.photos || []).map((photo, index) => ({
      id: `search_${Date.now()}_${index}`,
      title: photo.alt || query,
      url: photo.src.original,
      thumbnail: photo.src.medium,
      source: `pexels.com – ${photo.photographer}`,
      width: photo.width,
      height: photo.height
    }));

    res.json({
      query,
      results,
      totalResults: response.data.total_results || 0,
      searchTime: 0,
      licenseFilter: 'pexels',
      licenseInfo: 'Pexels license – free for personal and commercial use with attribution'
    });
  } catch (error) {
    console.error('Search API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Search failed',
      message: error.response?.data?.error || error.message || 'Failed to search images'
    });
  }
});

// Video search via Pexels
router.get('/videos', async (req, res) => {
  try {
    const { query, start = 1, num = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const apiKey = getPexelsKey();
    if (!apiKey) {
      return res.status(500).json({
        error: 'Search API configuration missing',
        message: 'Please configure PEXELS_API_KEY'
      });
    }

    const page = Math.max(1, Math.ceil(Number(start) / Number(num)));
    const perPage = Math.min(Number(num), 80);

    const response = await axios.get(`${PEXELS_BASE}/videos/search`, {
      headers: { Authorization: apiKey },
      params: { query, page, per_page: perPage }
    });

    const results = (response.data.videos || []).map((video, index) => {
      const hdFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0] || {};
      return {
        id: `video_search_${Date.now()}_${index}`,
        title: video.url.split('/').pop() || query,
        url: hdFile.link || '',
        thumbnail: video.image || '',
        source: `pexels.com – ${video.user?.name || 'Unknown'}`,
        width: hdFile.width || video.width,
        height: hdFile.height || video.height,
        duration: video.duration,
        type: 'video'
      };
    });

    res.json({
      query,
      results,
      totalResults: response.data.total_results || 0,
      searchTime: 0,
      licenseFilter: 'pexels',
      licenseInfo: 'Pexels license – free for personal and commercial use with attribution'
    });
  } catch (error) {
    console.error('Video search API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Video search failed',
      message: error.response?.data?.error || error.message || 'Failed to search videos'
    });
  }
});

module.exports = router;
