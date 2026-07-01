#!/usr/bin/env node
/**
 * Standalone VEO 3.1 video generation test.
 * Takes the veo_prompt output from analyze-video.js --reverse-prompt and fires a generation.
 *
 * Usage:
 *   node scripts/test-veo-generation.js --prompt "..." [--product-image <path>] [--aspect 9:16]
 *   node scripts/test-veo-generation.js --prompt-file result.json [--product-image <path>]
 *   node scripts/test-veo-generation.js --prompt-file result.json --tweak "make it daytime, outdoor setting"
 *       --tweak applies a natural language change while keeping everything else identical
 *
 * Output: saves the generated video to /tmp/veo-test-<timestamp>.mp4
 * Tweaked prompt is also saved to /tmp/veo-tweaked-prompt.json for reuse.
 *
 * Requires: GOOGLE_GEMINI_API_KEY in env (Developer API fallback, no GCP needed)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const VEO_MODEL = 'veo-3.1-generate-preview';
const GEMINI_MODEL = 'gemini-3.5-flash';

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const attempt = (u) => {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          attempt(res.headers.location);
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        res.on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
      }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
    };
    attempt(url);
  });
}

async function applyTweak(genAI, originalPrompt, tweak) {
  console.log(`\nApplying tweak: "${tweak}"\n`);

  const response = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [{
        text: `You are editing a VEO video generation prompt. Apply ONLY the requested change below.
Keep every other detail — scene structure, people, actions, pacing, camera work, product interactions, fidelity rules, and ALL CAPS fidelity notes — completely identical.

ORIGINAL PROMPT:
${originalPrompt}

REQUESTED CHANGE:
${tweak}

Rules:
- Apply the change minimally and precisely — do not rewrite unrelated parts
- All product interaction fidelity notes (the CAPS parentheticals) must remain word-for-word
- If the change contradicts a fidelity rule, honour the fidelity rule and note the conflict
- Return ONLY the updated prompt text, no explanation, no JSON wrapper`
      }]
    }]
  });

  const tweaked = response.text.trim();

  // Save tweaked prompt for reuse
  const outFile = '/tmp/veo-tweaked-prompt.json';
  fs.writeFileSync(outFile, JSON.stringify({ veo_prompt: tweaked, tweak_applied: tweak, original_prompt: originalPrompt }, null, 2));
  console.log(`Tweaked prompt saved to ${outFile}\n`);
  console.log('--- Tweaked prompt ---');
  console.log(tweaked);
  console.log('----------------------\n');

  return tweaked;
}

async function generateVideo({ genAI, apiKey, prompt, productImagePath, aspectRatio }) {

  console.log('\nPrompt:\n' + prompt + '\n');
  console.log(`Aspect ratio: ${aspectRatio}`);

  // Build reference images if product image provided
  let referenceImages;
  if (productImagePath) {
    console.log(`Loading product image: ${path.basename(productImagePath)}`);
    const mimeType = productImagePath.match(/\.png$/i) ? 'image/png'
      : productImagePath.match(/\.webp$/i) ? 'image/webp'
      : 'image/jpeg';
    const imageBytes = fs.readFileSync(productImagePath).toString('base64');
    referenceImages = [{ image: { imageBytes, mimeType }, referenceType: 'STYLE' }];
    console.log('Product image loaded as reference asset.');
  }

  const config = {
    aspectRatio,
    numberOfVideos: 1,
    durationSeconds: 8,
    personGeneration: 'allow_all',
    ...(referenceImages ? { referenceImages } : {}),
  };

  console.log('\nSubmitting to VEO... (this takes 3-8 minutes)\n');

  let op = await genAI.models.generateVideos({
    model: VEO_MODEL,
    prompt,
    config,
  });

  console.log(`Operation started: ${op.name}`);

  const startedAt = Date.now();
  let pollCount = 0;
  while (!op.done) {
    if (Date.now() - startedAt > 15 * 60 * 1000) throw new Error('Timed out after 15 minutes');
    pollCount++;
    await new Promise(r => setTimeout(r, 10000));
    try {
      op = await genAI.operations.getVideosOperation({ operation: op });
    } catch (pollErr) {
      // Retry transient network errors
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

  if (op.error) throw new Error(`VEO error: ${JSON.stringify(op.error)}`);

  const videos = op.response?.generatedVideos || [];
  if (videos.length === 0) throw new Error('No video returned. May have been filtered by safety policy.');

  const videoRef = videos[0].video;
  console.log('Video ref:', JSON.stringify(videoRef));
  const uri = videoRef?.uri || videoRef?.videoUri || videoRef?.downloadUri;
  if (!uri) throw new Error(`No download URI in response: ${JSON.stringify(videoRef)}`);

  const outPath = `/tmp/veo-test-${Date.now()}.mp4`;
  console.log(`Downloading video to ${outPath}...`);

  const downloadUrl = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`;
  await downloadFile(downloadUrl, outPath);

  console.log(`\nDone! Video saved to: ${outPath}`);
  console.log(`Copy to Linux files: cp ${outPath} ~/veo-test-output.mp4`);
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error([
    'Usage:',
    '  node scripts/test-veo-generation.js --prompt "..." [--product-image <img>] [--aspect 9:16]',
    '  node scripts/test-veo-generation.js --prompt-file result.json [--product-image <img>]',
    '  node scripts/test-veo-generation.js --prompt-file result.json --tweak "make it outdoor, daytime"',
    '',
    '  --tweak applies a natural language change while keeping everything else identical.',
    '  Combine --tweak with --prompt-file to iterate on a previous result.',
    '  The tweaked prompt is saved to /tmp/veo-tweaked-prompt.json for further reuse.',
  ].join('\n'));
  process.exit(1);
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) { console.error('GOOGLE_GEMINI_API_KEY is not set'); process.exit(1); }
const genAI = new GoogleGenAI({ apiKey });

let prompt;
const promptIdx = args.indexOf('--prompt');
const promptFileIdx = args.indexOf('--prompt-file');

const varIdxArg = args.indexOf('--variation-index');
const variationIndex = varIdxArg !== -1 ? parseInt(args[varIdxArg + 1], 10) : null;

if (promptIdx !== -1) {
  prompt = args[promptIdx + 1];
} else if (promptFileIdx !== -1) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(args[promptFileIdx + 1]), 'utf8'));
  const file = Array.isArray(raw)
    ? raw[variationIndex !== null ? variationIndex : 0]
    : raw;
  prompt = file.veo_prompt || file.reverse_prompt?.veo_prompt;
  if (!prompt) throw new Error('Could not find veo_prompt in file');
  if (Array.isArray(raw)) {
    console.log(`Using variation [${variationIndex ?? 0}]: ${file.variation_name || '?'}`);
  }
}

if (!prompt) {
  console.error('Provide --prompt "..." or --prompt-file result.json');
  process.exit(1);
}

const tweakIdx = args.indexOf('--tweak');
const tweak = tweakIdx !== -1 ? args[tweakIdx + 1] : null;

const piIdx = args.indexOf('--product-image');
const productImagePath = piIdx !== -1 ? path.resolve(args[piIdx + 1]) : null;

const aspectIdx = args.indexOf('--aspect');
const aspectRatio = aspectIdx !== -1 ? args[aspectIdx + 1] : '9:16';

(async () => {
  try {
    const finalPrompt = tweak ? await applyTweak(genAI, prompt, tweak) : prompt;
    await generateVideo({ genAI, apiKey, prompt: finalPrompt, productImagePath, aspectRatio });
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
})();
