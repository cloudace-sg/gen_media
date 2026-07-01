#!/usr/bin/env node
/**
 * One-shot: New Moon World Cup commercial — Bird's Nest + Essence of Chicken
 * Family/friends at home, late night, watching World Cup, consuming both products.
 * All /home/angieng/images/ assets used as SUBJECT reference images.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../server/.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { GoogleGenAI } = require('@google/genai');

const VEO_MODEL = 'veo-3.1-generate-preview';
const IMAGE_DIR = '/home/angieng/images';

// Exclude the AI-generated generic jar image — it has garbled text and will confuse VEO
const EXCLUDE = ['image (11).png'];

const PROMPT = `Cinematic 9:16 vertical commercial for New Moon (Singapore health supplement brand, since 1959).

SCENE: A cosy Singapore HDB living room, late at night. The room is dimly lit with warm amber light from a floor lamp and the bright glow of a large TV screen showing a live World Cup football match — a packed stadium, green pitch, scoreboards. Four people — a mix of family and friends (two older adults, two young adults) — are lounging on a sofa and armchairs, relaxed and excited.

On the coffee table in front of them sit TWO NEW MOON PRODUCTS side by side:
- LEFT: New Moon Essence of Chicken — small squat dark amber glass bottle, bright green ribbed plastic screw cap, green-white-gold label with yellow crescent moon logo and "ESSENCE OF CHICKEN 鸡精" in bold white text, contains dark brown opaque liquid (68ml)
- RIGHT: New Moon Premium Bird's Nest with White Fungus — compact wide-mouth transparent glass jar, metallic gold screw-top metal lid with red "OPEN 旋开" arrows, glossy red label with traditional Chinese gold fretwork border, yellow crescent moon logo, large "燕窝" calligraphy in black with gold border, "LESS SWEET 少糖" green badge, light golden translucent liquid with suspended bird's nest and white fungus pieces inside

SEQUENCE OF SHOTS:
1. Wide establishing shot — room, TV showing match, four people, both products visible on coffee table (caps on, labels facing camera)
2. The young woman reaches forward and picks up the Essence of Chicken bottle with both hands. Close-up: she steadies the glass body with one hand, and with the other hand physically rotates and unscrews the ribbed green plastic cap — the cap turns continuously, lifts off, and she places it upside-down on the table (PRODUCT FIDELITY: CAP REMOVAL MUST BE A CONTINUOUS REALISTIC UNSCREWING MOTION, NO JUMP CUTS, GREEN CAP VISIBLE ROTATING). She tilts the bottle and drinks the dark brown liquid in a single smooth motion — liquid visibly flows from bottle to mouth, bottle level decreases (PRODUCT FIDELITY: DARK BROWN LIQUID FLOWS REALISTICALLY, BOTTLE LEVEL DROPS ON SCREEN)
3. The older man beside her reaches for the Bird's Nest jar. Close-up of both hands — one steadies the glass jar body, the other grips the metallic gold lid and rotates it counter-clockwise in a continuous smooth unscrewing motion — the gold lid lifts off and is set aside (PRODUCT FIDELITY: GOLD METALLIC LID ROTATES AND LIFTS OFF CONTINUOUSLY, LABEL REMAINS UPRIGHT AND LEGIBLE, RED LABEL WITH 燕窝 FACING CAMERA). He lifts the wide-mouth jar and drinks the golden translucent liquid — the suspended white fungus pieces are visible inside, and the liquid level visibly decreases as he drinks (PRODUCT FIDELITY: PALE GOLDEN TRANSLUCENT LIQUID FLOWS FROM JAR TO MOUTH, LEVEL DROPS)
4. Reaction shot — both adults energized, leaning forward as a goal is scored on TV, cheering
5. Hero product shot — both products on table, caps removed and placed beside each product (Essence of Chicken green cap upside-down left, Bird's Nest gold lid flat right), labels fully facing camera, warm lamp light glowing behind them (TEXT OVERLAY: 'RECHARGE YOUR NIGHT' — bold white sans-serif, centered bottom third; TEXT OVERLAY: 'NEW MOON SINCE 1959' — gold smaller caps, below)
6. Final end card — both products upright side by side on a dark background, soft golden spotlight, New Moon crescent moon logo visible on both

PRODUCT FIDELITY RULES (apply to every frame either product appears):
- ESSENCE OF CHICKEN: dark amber glass body, bright green ribbed screw cap, label always upright with green background, "ESSENCE OF CHICKEN" in white, crescent moon logo top of label, Halal seal bottom-left. Dark brown opaque liquid inside. Size: small squat 68ml jar.
- BIRD'S NEST: wide-mouth transparent glass jar, metallic gold vacuum lid, glossy red label with gold fretwork border, yellow crescent moon + "燕窝" calligraphy centered, "LESS SWEET 少糖" green badge bottom of label, pale golden translucent liquid with suspended pieces. Label always upright and fully legible.
- Both products must look IDENTICAL to the reference images in every frame — same label design, same cap colour, same bottle shape, same liquid colour. No variation across scenes.
- When cap is removed: the cap motion must be physically realistic, continuous, and visible on screen. No teleporting or dissolving.
- When consumed: liquid must visibly flow on screen and bottle level must decrease.

STYLE: warm cinematic lighting, shallow depth of field on products during close-ups, natural handheld feel during action, cuts matching the excitement of the match, 9:16 vertical format.`;

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

  // VEO Developer API hard limit: 3 reference images max.
  // Selected to maximise coverage: both-products-together + each product's clean front hero.
  const selected = [
    'image (8).png',                        // BOTH products side by side, caps off
    '20250328_BNWF_LS_Bottle_Front.jpg',    // Bird's Nest front hero (cap on, red label)
    'NMEOC24_TRD_Bottle_Front_Dec2024.jpg', // Chicken Essence front hero (cap on, green label)
  ];

  console.log(`Loading ${selected.length} reference images (API max: 3)...`);
  const referenceImages = selected.map(f => {
    const ext = f.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const imageBytes = fs.readFileSync(path.join(IMAGE_DIR, f)).toString('base64');
    console.log(`  ✓ ${f}`);
    return { image: { imageBytes, mimeType }, referenceType: 'SUBJECT' };
  });

  console.log(`\n3 reference images loaded.`);
  console.log('\nPrompt preview (first 300 chars):', PROMPT.slice(0, 300) + '...');
  console.log('\nSubmitting to VEO... (this takes 5-10 minutes)\n');

  let op;
  try {
    op = await genAI.models.generateVideos({
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
  } catch (err) {
    // If too many reference images, retry with a curated subset
    if (err.message && (err.message.includes('reference') || err.message.includes('INVALID') || err.message.includes('400'))) {
      console.warn('\nFull image set rejected by API. Retrying with curated subset (best 5)...\n');
      const curated = [
        'image (8).png',                        // BOTH products side by side, caps off
        '20250328_BNWF_LS_Bottle_Front.jpg',    // Bird's Nest front hero (cap on, red label)
        'NMEOC24_TRD_Bottle_Front_Dec2024.jpg', // Chicken Essence front hero (cap on, green label)
      ];
      const subset = curated.map(f => {
        const ext = f.split('.').pop().toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const imageBytes = fs.readFileSync(path.join(IMAGE_DIR, f)).toString('base64');
        return { image: { imageBytes, mimeType }, referenceType: 'SUBJECT' };
      });
      op = await genAI.models.generateVideos({
        model: VEO_MODEL,
        prompt: PROMPT,
        config: {
          aspectRatio: '9:16',
          numberOfVideos: 1,
          durationSeconds: 8,
          personGeneration: 'allow_all',
          referenceImages: subset,
        },
      });
      console.log('Submitted with curated 5-image subset.');
    } else {
      throw err;
    }
  }

  console.log(`Operation started: ${op.name}`);

  const startedAt = Date.now();
  let pollCount = 0;
  while (!op.done) {
    if (Date.now() - startedAt > 20 * 60 * 1000) throw new Error('Timed out after 20 minutes');
    pollCount++;
    await new Promise(r => setTimeout(r, 10000));
    try {
      op = await genAI.operations.getVideosOperation({ operation: op });
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

  if (op.error) throw new Error(`VEO error: ${JSON.stringify(op.error)}`);

  const videos = op.response?.generatedVideos || [];
  if (videos.length === 0) throw new Error('No video returned — may have been filtered by safety policy.');

  const videoRef = videos[0].video;
  const uri = videoRef?.uri || videoRef?.videoUri || videoRef?.downloadUri;
  if (!uri) throw new Error(`No download URI: ${JSON.stringify(videoRef)}`);

  const outPath = `/tmp/newmoon-worldcup-${Date.now()}.mp4`;
  const downloadUrl = uri.includes('key=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}key=${apiKey}`;
  console.log(`Downloading to ${outPath}...`);
  await downloadFile(downloadUrl, outPath);

  const dest = path.join(require('os').homedir(), 'veo-newmoon-worldcup.mp4');
  fs.copyFileSync(outPath, dest);

  console.log(`\nDone!`);
  console.log(`  Temp:       ${outPath}`);
  console.log(`  Linux files: ~/veo-newmoon-worldcup.mp4`);
})().catch(err => { console.error('\nError:', err.message); process.exit(1); });
