const express = require('express');
const axios = require('axios');
const router = express.Router();

// Google Custom Search API integration
router.get('/', async (req, res) => {
  try {
    const { query, start = 1, num = 10, license = 'creative_commons' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !searchEngineId) {
      return res.status(500).json({ 
        error: 'Search API configuration missing',
        message: 'Please configure GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID'
      });
    }

    const searchUrl = 'https://www.googleapis.com/customsearch/v1';
    const params = {
      key: apiKey,
      cx: searchEngineId,
      q: query,
      searchType: 'image',
      start,
      num,
      safe: 'medium',
      imgSize: 'xlarge',
      imgType: 'photo',
      fileType: 'jpg,png,webp'
    };

    // Add license filtering if Creative Commons is requested
    if (license === 'creative_commons') {
      params.rights = 'cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived';
    }

    const response = await axios.get(searchUrl, { params });
    
    // Transform the response to our format and filter out GIFs / small images
    const MIN_DIMENSION = 800;
    const results = response.data.items
      ?.filter(item => {
        const url = item.link?.toLowerCase() || '';
        const title = item.title?.toLowerCase() || '';
        const width = item.image?.width || 0;
        const height = item.image?.height || 0;
        const isGif = url.includes('.gif') || title.includes('gif') || title.includes('animated');
        const isLargeEnough = width >= MIN_DIMENSION || height >= MIN_DIMENSION || !width; // keep when unknown
        return !isGif && isLargeEnough;
      })
      ?.map((item, index) => ({
        id: `search_${Date.now()}_${index}`,
        title: item.title,
        url: item.link,
        thumbnail: item.image?.thumbnailLink || item.link,
        source: item.displayLink,
        width: item.image?.width,
        height: item.image?.height
      })) || [];

    res.json({
      query,
      results,
      totalResults: response.data.searchInformation?.totalResults || 0,
      searchTime: response.data.searchInformation?.searchTime || 0,
      licenseFilter: license,
      licenseInfo: license === 'creative_commons' 
        ? 'Results filtered to Creative Commons licensed images only'
        : 'No license filtering applied'
    });

  } catch (error) {
    console.error('Search API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.response?.data?.error?.message || 'Failed to search images'
    });
  }
});

module.exports = router;
