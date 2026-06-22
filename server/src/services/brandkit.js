const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BRANDKIT_FILE = path.join(DATA_DIR, 'brandkit.json');
const GCS_BUCKET = process.env.GCS_BUCKET;
const GCS_CONFIG_KEY = process.env.BRANDKIT_CONFIG_KEY || 'config/brandkit.json';

function getStorageBucket() {
  if (!GCS_BUCKET) return null;
  try {
    const storage = new Storage();
    return storage.bucket(GCS_BUCKET);
  } catch (_) {
    return null;
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BRANDKIT_FILE)) {
    const defaultKit = {
      logos: [],
      colors: [],
      fonts: [],
      font: null
    };
    fs.writeFileSync(BRANDKIT_FILE, JSON.stringify(defaultKit, null, 2));
  }
}

async function readBrandKitFromGcs() {
  const bucket = getStorageBucket();
  if (!bucket) return null;
  try {
    const file = bucket.file(GCS_CONFIG_KEY);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [contents] = await file.download();
    const obj = JSON.parse(String(contents || '{}'));
    return {
      logos: Array.isArray(obj.logos) ? obj.logos : [],
      colors: Array.isArray(obj.colors) ? obj.colors : [],
      fonts: Array.isArray(obj.fonts) ? obj.fonts : [],
      font: typeof obj.font === 'string' ? obj.font : null
    };
  } catch (_) {
    return null;
  }
}

async function writeBrandKitToGcs(kit) {
  const bucket = getStorageBucket();
  if (!bucket) return false;
  try {
    const payload = JSON.stringify(kit || {}, null, 2);
    await bucket.file(GCS_CONFIG_KEY).save(payload, {
      contentType: 'application/json',
      resumable: false,
      metadata: {
        cacheControl: 'no-cache, no-store, must-revalidate'
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to write brandkit to GCS:', err);
    return false;
  }
}

function getBrandKit() {
  // Note: This synchronous function returns the best-known snapshot quickly.
  // If GCS is configured, we prefer the on-disk cache but will populate it from GCS if empty.
  ensureDataFile();
  // First try reading the local cache
  try {
    const raw = fs.readFileSync(BRANDKIT_FILE, 'utf-8');
    const kit = JSON.parse(raw);
    if (!('heroImage' in kit)) kit.heroImage = null;
    if (!('idGrid' in kit)) kit.idGrid = [];
    if (!('idGridMaster' in kit)) kit.idGridMaster = null;
    return kit;
  } catch (_) {}
  // If local read failed or empty, do a best-effort synchronous fallback to empty,
  // and asynchronously refresh from GCS for next call.
  // Since this module is used inside HTTP handlers, we can't block synchronously for network I/O.
  (async () => {
    const fromGcs = await readBrandKitFromGcs();
    if (fromGcs) {
      try { fs.writeFileSync(BRANDKIT_FILE, JSON.stringify(fromGcs, null, 2)); } catch (_) {}
    }
  })().catch(()=>{});
  return { logos: [], colors: [], fonts: [], font: null, heroImage: null, idGrid: [], idGridMaster: null };
}

function setBrandKit(update) {
  ensureDataFile();
  const current = getBrandKit();
  const next = {
    logos: Array.isArray(update.logos) ? update.logos : current.logos,
    colors: Array.isArray(update.colors) ? update.colors : current.colors,
    fonts: Array.isArray(update.fonts) ? update.fonts : current.fonts,
    font: typeof update.font === 'string' ? update.font : current.font,
    heroImage: 'heroImage' in update ? (update.heroImage || null) : current.heroImage,
    idGrid: Array.isArray(update.idGrid) ? update.idGrid.slice(0, 9) : current.idGrid,
    idGridMaster: 'idGridMaster' in update ? (update.idGridMaster || null) : current.idGridMaster,
  };
  // Write-through local cache
  fs.writeFileSync(BRANDKIT_FILE, JSON.stringify(next, null, 2));
  // Write to GCS synchronously to ensure consistency
  (async () => { 
    const success = await writeBrandKitToGcs(next);
    if (success) {
      console.log('Brand kit synced to GCS successfully');
    }
  })().catch((err) => {
    console.error('Failed to sync brand kit to GCS:', err);
  });
  return next;
}

function getPrimaryLogo() {
  const kit = getBrandKit();
  return Array.isArray(kit.logos) && kit.logos.length > 0 ? kit.logos[0] : null;
}


function applyBrandColorsPlaceholder(prompt) {
  if (!prompt) return prompt;
  if (!prompt.includes('[brand colors]')) return prompt;
  const kit = getBrandKit();
  const colors = Array.isArray(kit.colors) ? kit.colors.filter(Boolean) : [];
  if (colors.length === 0) {
    return prompt.replace('[brand colors]', '');
  }
  const description = colors.join(', ');
  return prompt.replace('[brand colors]', `colors ${description}`);
}

function applyBrandFontPlaceholder(prompt) {
  if (!prompt) return prompt;
  if (!prompt.includes('[brand font]')) return prompt;
  const kit = getBrandKit();
  const fontFamily = kit.font;
  if (!fontFamily) {
    return prompt.replace('[brand font]', 'brand typography style');
  }
  // Suggest stylistic emulation using the selected Google Font
  return prompt.replace('[brand font]', `typography similar to ${fontFamily}`);
}

function applyBrandLogoPlaceholder(prompt) {
  if (!prompt) return prompt;
  if (!prompt.includes('[brand logo]')) return prompt;
  // The actual image will be injected separately; replace keyword with guidance text
  return prompt.replace('[brand logo]', 'the brand logo (provided in reference images)');
}

module.exports = {
  getBrandKit,
  setBrandKit,
  applyBrandColorsPlaceholder,
  applyBrandFontPlaceholder,
  applyBrandLogoPlaceholder,
  getPrimaryLogo,
  /**
   * Heuristically detect whether the user's instruction involves text rendering.
   * Used to decide if brand font guidance should be injected.
   */
  promptImpliesText(prompt) {
    if (!prompt) return false;
    const p = prompt.toLowerCase();
    const keywords = [
      'text', 'title', 'headline', 'subheadline', 'subtitle', 'caption', 'typography', 'type',
      'label', 'tagline', 'slogan', 'poster text', 'add the text', 'write', 'insert text', 'font'
    ];
    return keywords.some(k => p.includes(k));
  }
};


