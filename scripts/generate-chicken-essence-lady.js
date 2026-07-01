#!/usr/bin/env node
/**
 * Essence of Chicken lady video — same woman, same home, late night, reaches out, uncaps, drinks.
 * Reference images: front hero (capped) + real uncap action shot + another EOC angle.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const VEO_MODEL = 'veo-3.1-generate-preview';
const IMAGE_DIR = '/home/angieng/images';

// 3 reference images — Essence of Chicken only.
// Chosen to give VEO: exact product look (capped), real hands uncapping in context, another product angle.
const SELECTED = [
  'NMEOC24_TRD_Bottle_Front_Dec2024.jpg',  // exact label + green cap — product lock
  'images (7).jpeg',                          // real hands physically uncapping the bottle (green cap mid-lift)
  'image (10).png',                           // another EOC view, no Bird's Nest in frame
];

const PROMPT = `Cinematic 9:16 vertical commercial for New Moon Essence of Chicken — a traditional Chinese nutritional health supplement.

SETTING: A Singaporean woman in her early 30s is at home late at night, relaxing on the sofa in comfortable loungewear. The living room is warmly lit by a floor lamp. A television is on in the background, its screen casting a soft glow. She is winding down for the evening.

PRODUCT — must appear identical to the reference images in every single frame:
The product is New Moon Essence of Chicken. It is a small squat dark amber glass bottle (approximately 68ml). The bottle body is dark amber glass — wider at the shoulder, narrowing toward the base. On top of the bottle sits a bright vivid green ribbed plastic screw cap — the green is a bright saturated green, and the cap has prominent vertical ribbing around its circumference for grip. The label wraps around the glass body: the label background is solid green, the top section has a white and gold banner reading "NewMoon SINCE 1959" with a yellow crescent moon logo on the left, the centre of the label has the words "ESSENCE of CHICKEN 鸡精" in large bold white letters, a red heartbeat ECG pulse line runs diagonally through the label behind the main text, and a circular Halal certification seal sits at the bottom left of the label. The bottle contains dark brown opaque liquid inside. Every detail — the bright green cap colour, the green label, the yellow crescent moon logo, the white ESSENCE of CHICKEN text, the red ECG line, and the dark amber glass bottle shape — must stay exactly as described and match the reference images unchanged in every shot.

SCENE — the following actions happen in clear sequential order, each one visible on screen:

First, the woman is seen relaxing on the sofa watching television late at night. The Essence of Chicken bottle sits on the coffee table in front of her, bright green cap on, green label facing camera.

Second, she reaches forward and picks up the bottle with both hands from the coffee table.

Third, she holds the bottle steady with one hand gripping the dark amber glass body, and with her other hand she rotates the bright green ribbed plastic cap counter-clockwise, unscrewing it. The green cap turns and comes off the bottle completely.

Fourth, she places the green cap on the coffee table beside the bottle. The bottle now sits open with no cap on it.

Fifth, she lifts the open bottle (no cap present on the bottle) and drinks the traditional Chinese health supplement inside. Her expression is calm and energised.

Sixth, she sets the open bottle back on the table. The green cap remains beside it separately on the table.

Final shot: close-up of the open bottle on the coffee table, green ESSENCE of CHICKEN label facing camera, green cap placed beside it, warm lamplight glowing behind. No text overlays.

Warm cinematic style, shallow depth of field, natural handheld feel, 9:16 vertical.`;

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

  console.log(`Loading ${SELECTED.length} Essence of Chicken reference images...`);
  const referenceImages = SELECTED.map(f => {
    const ext = f.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const imageBytes = fs.readFileSync(path.join(IMAGE_DIR, f)).toString('base64');
    console.log(`  ✓ ${f}`);
    return { image: { imageBytes, mimeType }, referenceType: 'SUBJECT' };
  });

  console.log('\nPrompt preview (first 300 chars):', PROMPT.slice(0, 300) + '...');
  console.log('\nSubmitting Essence of Chicken video to VEO... (5-10 minutes)\n');

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

  const outPath = `/tmp/chicken-essence-lady-${Date.now()}.mp4`;
  const downloadUrl = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`;
  console.log(`Downloading to ${outPath}...`);
  await downloadFile(downloadUrl, outPath);

  const dest = path.join(require('os').homedir(), 'veo-chicken-essence-lady-v3.mp4');
  fs.copyFileSync(outPath, dest);

  console.log(`\nDone!`);
  console.log(`  Temp:        ${outPath}`);
  console.log(`  Linux files: ~/veo-chicken-essence-lady-v3.mp4`);
})().catch(err => { console.error('\nError:', err.message); process.exit(1); });
