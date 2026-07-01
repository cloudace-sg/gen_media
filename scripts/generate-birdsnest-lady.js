#!/usr/bin/env node
/**
 * Bird's Nest lady video — woman at home late night watching TV, reaches out, uncaps, drinks.
 * Reference images: front hero (capped) + transparent jar with golden liquid + uncapped shot.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const VEO_MODEL = 'veo-3.1-generate-preview';
const IMAGE_DIR = '/home/angieng/images';

// 3 reference images — Bird's Nest only.
// Chosen to give VEO: exact product look (capped), liquid content (through glass), and uncapped lid position.
const SELECTED = [
  '20250328_BNWF_LS_Bottle_Front.jpg',  // front hero: exact label + gold lid — single image works best for safety filter
];

const PROMPT = `Cinematic 9:16 vertical commercial for New Moon Premium Bird's Nest with White Fungus — a traditional Chinese nutritional health food supplement.

SETTING: A Singaporean woman in her early 30s is at home very late at night, relaxing on a sofa in comfortable loungewear. A television is on in the background. Warm amber lamplight in the room.

PRODUCT SIZE AND APPEARANCE — unchanged in every frame:
A small compact wide-mouth cylindrical transparent glass jar — about the size of a small jam jar or yoghurt pot, 150g. Small enough that one hand wraps fully around the glass body. NOT a large jar. The lid is a flat wide circular metallic gold screw cap, disc-shaped. The glossy red label shows a gold border, yellow crescent moon logo, large 燕窝 Chinese characters, green LESS SWEET badge. Transparent glass shows pale golden contents inside.

CONTINUOUS ACTION SEQUENCE — this is the entire scene from start to finish:

The woman is sitting on the sofa watching television late at night. On the coffee table directly in front of her is the Bird's Nest jar. The gold lid is ON the jar. The red label faces the camera.

She leans forward and picks the jar up off the coffee table with both hands. She holds it in front of her.

Still holding the jar, she uses one hand to grip the glass body and her other hand to twist and unscrew the flat gold lid off the top. The gold lid rotates off the jar and separates from it completely.

She reaches over and sets the gold lid down flat on the coffee table — the lid is now on the table, separate from the jar. The jar in her hands has no lid — the top of the jar is open.

She raises the open jar (the top is open, no lid anywhere near it) up to her mouth and tilts it to drink the traditional health supplement inside. The jar is small — it fits in her hands naturally at mouth level.

She lowers the open jar back onto the coffee table. The gold lid is flat on the table beside the jar. Both are visible.

Warm cinematic style, shallow depth of field, natural light, no text overlays, 9:16 vertical.`;

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const attempt = (u) => {
      https.get(u, res => {
        if ([301, 302, 307].includes(res.statusCode)) { attempt(res.headers.location); return; }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        res.on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
    };
    attempt(url);
  });
}

(async () => {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) { console.error('GOOGLE_GEMINI_API_KEY is not set'); process.exit(1); }
  const genAI = new GoogleGenAI({ apiKey });

  console.log(`Loading ${SELECTED.length} Bird's Nest reference images...`);
  const referenceImages = SELECTED.map(f => {
    const ext = f.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const imageBytes = fs.readFileSync(path.join(IMAGE_DIR, f)).toString('base64');
    console.log(`  ✓ ${f}`);
    return { image: { imageBytes, mimeType }, referenceType: 'SUBJECT' };
  });

  console.log('\nPrompt preview (first 300 chars):', PROMPT.slice(0, 300) + '...');
  console.log('\nSubmitting Bird\'s Nest video to VEO... (5-10 minutes)\n');

  const op = await genAI.models.generateVideos({
    model: VEO_MODEL,
    prompt: PROMPT,
    config: {
      aspectRatio: '9:16',
      numberOfVideos: 1,
      durationSeconds: 8,
      personGeneration: 'allow_all',
      referenceImages,
    },
  });

  console.log(`Operation: ${op.name}`);

  let currentOp = op;
  const startedAt = Date.now();
  let pollCount = 0;
  while (!currentOp.done) {
    if (Date.now() - startedAt > 20 * 60 * 1000) throw new Error('Timed out after 20 minutes');
    pollCount++;
    await new Promise(r => setTimeout(r, 10000));
    try {
      currentOp = await genAI.operations.getVideosOperation({ operation: currentOp });
    } catch (pollErr) {
      if (/fetch failed|503|unavailable|ECONNRESET/i.test(pollErr.message || '')) {
        process.stdout.write(`\r[transient error, retrying] attempt ${pollCount}...`);
        continue;
      }
      throw pollErr;
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    process.stdout.write(`\rPolling... attempt ${pollCount}, elapsed ${elapsed}s`);
  }
  console.log('\n');

  if (currentOp.error) throw new Error(`VEO error: ${JSON.stringify(currentOp.error)}`);

  const videos = currentOp.response?.generatedVideos || [];
  if (videos.length === 0) throw new Error('No video returned — may have been filtered by safety policy.');

  const videoRef = videos[0].video;
  const uri = videoRef?.uri || videoRef?.videoUri || videoRef?.downloadUri;
  if (!uri) throw new Error(`No download URI: ${JSON.stringify(videoRef)}`);

  const outPath = `/tmp/birdsnest-lady-${Date.now()}.mp4`;
  const downloadUrl = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`;
  console.log(`Downloading to ${outPath}...`);
  await downloadFile(downloadUrl, outPath);

  const dest = path.join(require('os').homedir(), 'veo-birdsnest-lady-v5.mp4');
  fs.copyFileSync(outPath, dest);

  console.log(`\nDone!`);
  console.log(`  Temp:        ${outPath}`);
  console.log(`  Linux files: ~/veo-birdsnest-lady-v5.mp4`);
})().catch(err => { console.error('\nError:', err.message); process.exit(1); });
