import axios from 'axios';
import { auth } from '../lib/firebase';

// Auto-detect localhost for dev; use same-origin in production
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost ? 'http://localhost:3001/api' : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 900000, // 15 minutes timeout for AI operations (video generation can take 10-15+ minutes)
});

// Request interceptor for logging and adding user headers
api.interceptors.request.use(
  async (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add user ID and company ID headers if user is authenticated
    try {
      if (auth && auth.currentUser) {
        const user = auth.currentUser;
        const email = user.email || '';
        const domain = email.split('@')[1]?.toLowerCase() || '';
        
        // Use email as user ID, domain as company ID
        config.headers['x-user-id'] = email;
        config.headers['x-company-id'] = domain;

        try {
          const token = await user.getIdToken();
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn('Failed to get auth token:', error);
          // Continue without token - some endpoints might work without auth
        }
      } else {
        // Add default headers for unauthenticated requests
        config.headers['x-user-id'] = 'anonymous';
        config.headers['x-company-id'] = 'unknown';
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
      // Add default headers if auth check fails
      config.headers['x-user-id'] = 'anonymous';
      config.headers['x-company-id'] = 'unknown';
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Search API
export const searchImages = async (query, start = 1, num = 10, license = 'creative_commons') => {
  try {
    const response = await api.get('/search', {
      params: { query, start, num, license }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to search images');
  }
};

// Video Search API
export const searchVideos = async (query, start = 1, num = 10) => {
  try {
    const response = await api.get('/search/videos', {
      params: { query, start, num }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to search videos');
  }
};

// Generate API
export const generateImages = async (prompt, purpose, imageCount = 1, aspectRatio = '16:9', styleId) => {
  try {
    const response = await api.get('/generate', {
      params: { prompt, purpose, imageCount, aspectRatio, styleId }
    });
    return response.data;
  } catch (error) {
    console.error('Generate images error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to generate images');
  }
};

// Remix API
export const remixImages = async (prompt, images, purpose, aspectRatio = '16:9', imageCount = 1, styleId) => {
  try {
    const response = await api.post('/remix', {
      prompt,
      purpose,
      aspectRatio,
      imageCount,
      styleId,
      images: images.map(img => ({
        id: img.id,
        url: img.url,
        title: img.title,
        mediaType: img.mediaType || 'image'
      }))
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to remix images');
  }
};

// Video generation (Veo 3)
export const generateVideo = async ({ prompt, negativePrompt, aspectRatio = '16:9', resolution = '720p', personGeneration, imageUrl, styleId }) => {
  try {
    const response = await api.post('/video', {
      prompt,
      negativePrompt,
      aspectRatio,
      resolution,
      personGeneration,
      imageUrl,
      styleId
    });
    return response.data; // { url, filename, aspectRatio, resolution }
  } catch (error) {
    console.error('Generate video error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to generate video');
  }
};

// Upload API
export const uploadImages = async (files) => {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  try {
    const response = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to upload images');
  }
};

// Improve Prompt API
export const improvePrompt = async ({ prompt, mode, style, aspectRatio, resolution, stagedImages, brandKit, styleId }) => {
  try {
    const response = await api.post('/prompt/improve', {
      prompt, mode, style, aspectRatio, resolution, stagedImages, brandKit, styleId
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to improve prompt');
  }
};

// Random Prompt API
export const randomPrompt = async ({ mode, style, aspectRatio, resolution, brandKit, styleId }) => {
  try {
    const response = await api.post('/prompt/random', { mode, style, aspectRatio, resolution, brandKit, styleId });
    return response.data; // { prompt }
  } catch (error) {
    console.error('Random prompt error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to get random prompt');
  }
};

// Styles API
export const listStyles = async () => {
  const res = await api.get('/styles');
  return res.data?.items || [];
};

// Billing APIs
export const getBillingSummary = async ({ start, end } = {}) => {
  const res = await api.get('/billing/summary', { params: { start, end } });
  return res.data;
};

export const getBillingCredits = async () => {
  const res = await api.get('/billing/credits');
  return res.data;
};

// Save edited image from data url
export const saveEditedImage = async ({ dataUrl, originalUrl, replaceOriginal = true }) => {
  try {
    const response = await api.post('/uploads/save-edit', { dataUrl, originalUrl, replaceOriginal });
    return response.data; // { url, filename, replaced }
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to save edited image');
  }
};

// Health check
export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw new Error('API health check failed');
  }
};

// Brand Kit APIs
export const getBrandKit = async () => {
  // Use no-cache headers to force fresh data without URL cache busting
  const res = await api.get('/brandkit', {
    headers: { 
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  return res.data;
};

export const updateBrandKit = async (payload) => {
  const res = await api.put('/brandkit', payload);
  return res.data;
};

export const uploadBrandLogos = async (files) => {
  const formData = new FormData();
  for (const f of files) formData.append('files', f);
  const res = await api.post('/brandkit/logos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
};

// Removed style uploads and font uploads per revised requirements

// Files (GCS) APIs
export const listFiles = async ({ type, limit = 50, pageToken } = {}) => {
  const res = await api.get('/files', { params: { type, limit, pageToken } });
  return res.data; // { items, nextPageToken }
};

export const getSignedUrl = async ({ key, ttlSec }) => {
  const res = await api.post('/files/signed-url', { key, ttlSec });
  return res.data; // { url }
};

export const deleteFiles = async (keys) => {
  const res = await api.delete('/files', { data: { keys } });
  return res.data; // { results }
};

// Admin: Users APIs
export async function listUsers(params = {}) {
  const res = await api.get('/users', { params });
  return res.data;
}


export async function setUserRole(uid, role) {
  const res = await api.post('/users/role', { uid, role });
  return res.data;
}

export async function setUserDisabled(uid, disabled) {
  const res = await api.post('/users/disable', { uid, disabled });
  return res.data;
}

export async function deleteUser(uid) {
  const res = await api.delete(`/users/${uid}`);
  return res.data;
}

export async function inviteUser({ email, displayName, role }) {
  const res = await api.post('/users/invite', { email, displayName, role });
  return res.data; // { ok, uid, link }
}

export async function checkUserExists(email) {
  const res = await api.get(`/users/check/${encodeURIComponent(email)}`);
  return res.data; // { exists: boolean, disabled?: boolean }
}

export async function getAllowlist() {
  const res = await api.get('/users/allowlist');
  return res.data;
}

export async function saveAllowlist(data) {
  const res = await api.post('/users/allowlist', data);
  return res.data;
}

export async function postSignIn() {
  const res = await api.post('/auth/postSignIn');
  return res.data;
}

export async function getRemainingCounts() {
  const res = await api.get('/billing/remaining');
  return res.data;
}

export default api;
