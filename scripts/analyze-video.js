#!/usr/bin/env node
/**
 * Standalone Gemini full-video understanding script.
 *
 * Usage:
 *   node scripts/analyze-video.js <path-to-video>
 *   node scripts/analyze-video.js <path-to-video> --question "What product is being advertised?"
 *   node scripts/analyze-video.js <path-to-video> --reverse-prompt
 *   node scripts/analyze-video.js <path-to-video> --all   (analysis + reverse prompt together)
 *   node scripts/analyze-video.js <path-to-video> --reverse-prompt --product-image <image-path>
 *       (reverse-engineer the video style, then swap in your own product)
 *
 * Requires: GOOGLE_GEMINI_API_KEY in env (or .env file at project root)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const MODEL = 'gemini-3.5-flash';

const REVERSE_PROMPT_PROMPT = `You are an expert at writing prompts for AI video generation models (specifically Google VEO 3.1).

Watch this video carefully in full, then write a generation prompt that reproduces the same:
- Subject(s) and their appearance
- Setting / environment / background
- Camera movement and angle
- Lighting mood and color grading
- Pacing and visual style
- Actions and motion
- Overall emotional tone

CRITICAL — Product Interaction Fidelity:
Any scene where a person handles, holds, unboxes, unscrews, drinks from, or displays the product must be described with extreme precision. Include:
- Exact hand grip and orientation (e.g. "right hand grips bottle vertically, label facing camera")
- Which direction the cap/lid opens
- Whether the label/logo is visible and which side faces the camera at all times
- Any close-up product shots: state "product label must remain upright, unaltered, and fully legible at all times"

MANDATORY PRODUCT FIDELITY RULES — embed these into every product interaction scene:
1. SHAPE & SIZE LOCKED: Product dimensions and silhouette must be identical in every single scene. Never resize, stretch, or morph.
2. LOGO LOCKED: Logo design, colours, and layout must be pixel-identical to the reference image in every frame. Never simplify or alter.
3. CAP REMOVAL MUST BE REALISTIC: The cap must physically rotate and lift off in a continuous motion. No jump cuts, no dissolves — the cap must visibly come off on screen.
4. CONSUMPTION MUST BE REAL: When the product is drunk, liquid must visibly flow from bottle to mouth. Bottle level must visibly decrease. Never cut away before consumption completes.
5. CROSS-SCENE CONSISTENCY: Product appearance must be identical across all scenes — same shape, same label, same cap colour, same liquid colour.

CRITICAL — Text Overlay Fidelity:
Any text that appears on screen (taglines, slogans, product names, CTAs) must follow these rules:
- Only include text that was actually in the original video — do NOT invent new text
- Each text overlay must appear at the correct moment, in the correct position (top / center / bottom)
- Text must be clearly legible — large enough to read, high contrast against the background
- Text must NOT fill the entire screen with random or unrelated words
- Text must NOT bleed into product label areas or obscure the product
- Each overlay is a short, discrete line — never a wall of text

Return a JSON object with exactly these keys:
{
  "veo_prompt": "The full generation prompt as a single detailed paragraph. For every product interaction moment, add a parenthetical fidelity note in CAPS. For every text overlay moment, add a parenthetical in CAPS specifying the exact text, position, and that it must be legible and not full-screen, e.g. (TEXT OVERLAY: 'UNLEASH YOUR ENERGY' — BOLD WHITE CAPS, BOTTOM THIRD, FULLY LEGIBLE, MUST NOT FILL SCREEN). 150-300 words.",
  "product_interaction_scenes": [
    {
      "timestamp": "MM:SS",
      "action": "exact description of what the person does with the product",
      "fidelity_requirement": "what must not change — orientation, label visibility, cap direction, etc."
    }
  ],
  "text_overlay_scenes": [
    {
      "timestamp": "MM:SS",
      "text": "exact verbatim text to display",
      "position": "top / center / bottom / top-left / bottom-right etc.",
      "style": "bold white capitals / yellow outlined text / etc.",
      "rule": "must be fully legible, short, discrete — must NOT fill the entire screen or overlap the product label"
    }
  ],
  "style_tags": ["cinematic", "handheld", "golden hour", ...],
  "suggested_aspect_ratio": "16:9 or 9:16 or 1:1",
  "suggested_duration": "5s or 8s",
  "camera_movement": "description of camera motion",
  "confidence_notes": "Honest assessment of what VEO may still get wrong despite these instructions"
}

Return ONLY the JSON object. No markdown fences, no explanation.`;

const ANALYSIS_PROMPT = `You are a professional video analyst. Analyze this video in full and return a structured JSON object with exactly these keys:

{
  "summary": "A concise narrative summary of the full video (2-4 sentences)",
  "scenes": [
    {
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "description": "What is happening visually",
      "objects": ["list", "of", "key", "objects", "or", "people"],
      "actions": ["list", "of", "key", "actions"]
    }
  ],
  "transcript": "Full verbatim transcription of all spoken dialogue and narration. Empty string if none.",
  "events": [
    {
      "timestamp": "MM:SS",
      "event": "Description of a notable event, cut, transition, or moment"
    }
  ],
  "visual_style": {
    "color_palette": ["dominant hex or color name"],
    "lighting": "description of lighting style",
    "pacing": "slow / medium / fast",
    "composition_notes": "brief note on framing and composition style"
  },
  "emotional_tone": "description of the overall mood and emotional tone",
  "key_themes": ["list", "of", "thematic", "keywords"],
  "text_overlays": [
    {
      "timestamp": "MM:SS",
      "text": "exact verbatim text as it appears on screen",
      "position": "top / center / bottom / top-left / top-right / bottom-left / bottom-right",
      "style": "brief description of font style, size, colour, and any animation (e.g. bold white capitals, fade in, lightning underline)",
      "covers_full_screen": true or false
    }
  ]
}

Return ONLY the JSON object. No markdown fences, no explanation.`;

async function uploadVideo(genAI, filePath) {
  const mimeType = filePath.endsWith('.mp4') ? 'video/mp4'
    : filePath.endsWith('.mov') ? 'video/quicktime'
    : filePath.endsWith('.avi') ? 'video/x-msvideo'
    : filePath.endsWith('.webm') ? 'video/webm'
    : 'video/mp4';

  console.error(`Uploading ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB)...`);

  const uploadResult = await genAI.files.upload({
    file: filePath,
    config: { mimeType },
  });

  console.error(`Upload complete. File URI: ${uploadResult.uri}`);
  console.error('Waiting for file to become active...');

  // Poll until file is ACTIVE (processing can take a moment for large files)
  let file = uploadResult;
  while (file.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 3000));
    file = await genAI.files.get({ name: file.name });
    process.stderr.write('.');
  }
  console.error('');

  if (file.state !== 'ACTIVE') {
    throw new Error(`File processing failed with state: ${file.state}`);
  }

  return file;
}

async function describeProduct(genAI, imagePath) {
  const mimeType = imagePath.match(/\.png$/i) ? 'image/png'
    : imagePath.match(/\.webp$/i) ? 'image/webp'
    : 'image/jpeg';

  const imageData = fs.readFileSync(imagePath).toString('base64');

  console.error(`Analysing product image: ${path.basename(imagePath)}...`);

  const response = await genAI.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: { mimeType, data: imageData },
        },
        {
          text: `Describe this product image in precise detail for use in an AI video generation prompt. Include:
- Product name and brand (exactly as written on label)
- Form factor: bottle, can, box, pouch, jar, etc. — be specific about shape and size
- Colors and finish of the packaging (matte, glossy, metallic, transparent, etc.)
- Cap/lid type: screw cap, flip top, pull tab, cork — color and material
- Label layout: what is at the top, middle, bottom — logo position, key text, colors
- Orientation anchors: which way is "up", where the logo sits, which side the label faces

Then add a strict fidelity section with these exact rules:
FIDELITY RULES:
1. SHAPE & SIZE: The product's physical dimensions, silhouette, and proportions must remain identical in every scene — never shrink, stretch, bulge, or morph between shots.
2. LOGO INTEGRITY: The logo design, colours, typography, and layout must not be altered, simplified, distorted, or reimagined in any frame. It must look exactly as it does in this image.
3. LABEL INTEGRITY: The label must always appear upright and fully legible — never rotated, flipped, warped, or partially obscured. All text must be readable.
4. CAP REMOVAL REALISM: When the cap is removed, the unscrewing motion must be physically realistic and continuous — the cap must visibly rotate and lift off in the correct direction. It must not teleport off, dissolve, or disappear between frames.
5. CONSUMPTION REALISM: When the product is consumed (drunk), the action must be physically realistic and complete on screen — the liquid must visibly flow from the bottle into the person's mouth. The bottle level must visibly decrease. Do not cut away before consumption is fully shown.
6. CONSISTENCY ACROSS SCENES: The product must look identical across all scenes — same bottle shape, same cap colour, same label design, same liquid colour. No scene-to-scene variation in the product's appearance.

Write this as a structured block a director and AI model can reference exactly.`,
        },
      ],
    }],
  });

  return response.text.trim();
}

async function proofreadTexts(genAI, textOverlays) {
  if (!textOverlays || textOverlays.length === 0) return textOverlays;

  const lines = textOverlays.map((t, i) => `${i + 1}. "${t.text}"`).join('\n');

  const response = await genAI.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [{
        text: `You are a copy editor. Check each of the following video text overlays for spelling mistakes, missing spaces, incorrect spacing between words, grammar errors, and punctuation issues.

For each line, return the corrected version. If a line is already correct, return it unchanged.

Return a JSON array of strings in the same order, e.g. ["corrected text 1", "corrected text 2", ...]

Text overlays to check:
${lines}

Return ONLY the JSON array. No explanation.`
      }]
    }]
  });

  let raw = response.text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const corrected = JSON.parse(raw);
    return textOverlays.map((t, i) => {
      const original = t.text;
      const fixed = corrected[i] || t.text;
      if (fixed !== original) console.error(`  Text corrected: "${original}" → "${fixed}"`);
      return { ...t, text: fixed };
    });
  } catch {
    return textOverlays;
  }
}

function buildVariationsPrompt(basePrompt, n) {
  return `${basePrompt}

IMPORTANT — GENERATE ${n} VARIATIONS:
Return a JSON array of exactly ${n} objects. Each object must follow the same schema as the single-result version above (veo_prompt, product_interaction_scenes, text_overlay_scenes, style_tags, suggested_aspect_ratio, suggested_duration, camera_movement, confidence_notes).

Each variation must differ meaningfully from the others in at least ONE of these dimensions:
1. Opening mood/scenario (e.g. tired office worker, sports warm-up, late-night study, post-workout)
2. Camera style (e.g. close-up heavy, handheld energy, cinematic wide, POV)
3. Color/lighting mood (e.g. warm amber, cool stadium lights, high-contrast dramatic, soft natural)
4. Narrative arc pacing (e.g. slow build to explosive energy, fast cuts throughout, single long take)

All variations must keep:
- The same product (NewMoon ESSENCE OF CHICKEN bottle) with full fidelity rules
- The same text overlays from the original video
- The two-hands close-up during cap removal

Label each variation with a short "variation_name" key (e.g. "tired-to-energised", "stadium-hero", "handheld-energy").`;
}

async function reversePrompt(genAI, videoPart, productDescription, variations = 1) {
  console.error(`\nGenerating ${variations > 1 ? variations + ' variations of the' : ''} reverse prompt...\n`);

  const promptText = productDescription
    ? `${REVERSE_PROMPT_PROMPT}

IMPORTANT — PRODUCT SWAP:
Replace the original product in the video with the product described below. Keep all scene structure, people, actions, pacing, camera work, and setting identical.

For every product interaction (taking out, unboxing, unscrewing cap, drinking, displaying):
- SHAPE & SIZE: Product dimensions must be identical in every scene — never resize or morph
- LOGO: Logo design, colours, and layout must exactly match the reference image in every frame — never alter or simplify
- CAP REMOVAL: Must be physically realistic and continuous — cap rotates and lifts off on screen, never teleports or disappears. Include a close-up shot of BOTH HANDS on the bottle: one hand gripping the bottle body steady, the other hand unscrewing the cap. Both hands must be clearly visible in frame during cap removal.
- CONSUMPTION: Liquid must visibly flow from bottle into mouth, bottle level must visibly decrease, never cut away before it completes
- LABEL: Must face camera, remain upright and fully legible in every scene
- CONSISTENCY: Product must look identical across all scenes — same shape, cap colour, label, liquid colour
- HANDS CLOSE-UP: During the primary bottle interaction sequence, include at least one dedicated close-up shot showing both hands holding or interacting with the bottle — one hand stabilising the body, the other engaging the cap or tipping to drink. Fingers and palms clearly visible, natural skin tone, no gloves.

For every text overlay (taglines, slogans, product names):
- Use ONLY the exact text from the original video — do not invent or paraphrase
- Every word must be correctly spelled, properly spaced, and grammatically correct
- Text must appear as a short, discrete line — never fill the entire screen
- Text must be clearly legible — high contrast, large enough to read, not overlapping the product
- Do NOT generate random, unrelated, or filler text anywhere on screen

Product to use:
${productDescription}`
    : REVERSE_PROMPT_PROMPT;

  const finalPrompt = variations > 1 ? buildVariationsPrompt(promptText, variations) : promptText;

  const response = await genAI.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [videoPart, { text: finalPrompt }] }],
  });

  let raw = response.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    const result = JSON.parse(raw);

    if (Array.isArray(result)) {
      // Proofread text overlays in each variation
      for (const variant of result) {
        if (variant.text_overlay_scenes && variant.text_overlay_scenes.length > 0) {
          console.error(`\nProofreading text overlays for variation: ${variant.variation_name || '?'}...`);
          variant.text_overlay_scenes = await proofreadTexts(genAI, variant.text_overlay_scenes);
        }
      }
      return result;
    }

    // Single result
    if (result.text_overlay_scenes && result.text_overlay_scenes.length > 0) {
      console.error('\nProofreading text overlays...');
      result.text_overlay_scenes = await proofreadTexts(genAI, result.text_overlay_scenes);
    }
    return result;
  } catch {
    return { veo_prompt: raw };
  }
}

async function analyzeVideo(filePath, { question, doReversePrompt, doAll, productImagePath, variations }) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenAI({ apiKey });

  // Upload the full video once — reuse for all operations
  const file = await uploadVideo(genAI, filePath);

  const videoPart = {
    fileData: {
      fileUri: file.uri,
      mimeType: file.mimeType,
    },
  };

  // Focused Q&A mode
  if (question) {
    console.error(`\nAnswering: "${question}"\n`);
    const response = await genAI.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [videoPart, { text: question }] }],
    });
    console.log(response.text);
    return;
  }

  // Reverse prompt only
  if (doReversePrompt && !doAll) {
    const productDescription = productImagePath ? await describeProduct(genAI, productImagePath) : null;
    if (productDescription) console.error(`\nProduct description:\n${productDescription}\n`);
    const result = await reversePrompt(genAI, videoPart, productDescription, variations);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Full structured analysis
  console.error('\nRunning full video analysis...\n');
  const analysisResponse = await genAI.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [videoPart, { text: ANALYSIS_PROMPT }] }],
  });

  let raw = analysisResponse.text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let analysisResult;
  try {
    analysisResult = JSON.parse(raw);
    // Proofread text overlays extracted from the analysis
    if (analysisResult.text_overlays && analysisResult.text_overlays.length > 0) {
      console.error('\nProofreading text overlays from analysis...');
      analysisResult.text_overlays = await proofreadTexts(genAI, analysisResult.text_overlays);
    }
  } catch {
    analysisResult = { raw: raw };
  }

  if (doAll) {
    const productDescription = productImagePath ? await describeProduct(genAI, productImagePath) : null;
    const rpResult = await reversePrompt(genAI, videoPart, productDescription, variations);
    console.log(JSON.stringify({ analysis: analysisResult, reverse_prompt: rpResult }, null, 2));
  } else {
    console.log(JSON.stringify(analysisResult, null, 2));
  }
}

// --- CLI entry point ---
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error([
    'Usage:',
    '  node scripts/analyze-video.js <video>                                                          # full structured analysis',
    '  node scripts/analyze-video.js <video> --reverse-prompt                                         # VEO prompt to recreate this video',
    '  node scripts/analyze-video.js <video> --reverse-prompt --product-image <img>                   # swap in your own product',
    '  node scripts/analyze-video.js <video> --reverse-prompt --product-image <img> --variations N    # N distinct prompt variations',
    '  node scripts/analyze-video.js <video> --all                                                    # analysis + reverse prompt',
    '  node scripts/analyze-video.js <video> --question "..."                                         # ask a specific question',
  ].join('\n'));
  process.exit(1);
}

const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const qIdx = args.indexOf('--question');
const question = qIdx !== -1 ? args[qIdx + 1] : null;
const doReversePrompt = args.includes('--reverse-prompt');
const doAll = args.includes('--all');
const piIdx = args.indexOf('--product-image');
const productImagePath = piIdx !== -1 ? path.resolve(args[piIdx + 1]) : null;
const vIdx = args.indexOf('--variations');
const variations = vIdx !== -1 ? parseInt(args[vIdx + 1], 10) || 3 : 1;

if (productImagePath && !fs.existsSync(productImagePath)) {
  console.error(`Product image not found: ${productImagePath}`);
  process.exit(1);
}

analyzeVideo(filePath, { question, doReversePrompt, doAll, productImagePath, variations }).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
