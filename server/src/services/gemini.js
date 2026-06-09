const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const mime = require('mime-types');
const fs = require('fs');
const path = require('path');
const { uploadFile, uploadBuffer } = require('./storage');

// Centralized model configuration.
// Text and image models use the generateContent / generateContentStream API.
// Video model uses the generateVideos API (long-running operation).
//
// When Gemini Omni Flash ships its developer API, it will likely replace the
// video model — but note that Omni uses generateContent (not generateVideos),
// so the video generation method will need a new implementation, not just an
// ID swap. Add a parallel generateVideoOmni() method at that point.
const MODELS = {
  text:  'gemini-3.5-flash',               // prompt enhancement, improvement, random prompt, marketing prompt
  image: 'gemini-3.1-flash-image-preview',  // image generation + remix (generateContentStream)
  video: 'veo-3.1-generate-preview',        // video generation (generateVideos)
};

class GeminiService {
  constructor() {
    this.apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenAI({
      apiKey: this.apiKey
    });
  }

  buildSystemPrompt({ basePrompt, styleId }) {
    const { getStyleById } = require('./styles');
    const style = getStyleById(styleId);
    const parts = [basePrompt];
    const textHeavyStyleIds = new Set(['bold_graphic_ad']);
    const allowEmbeddedText = textHeavyStyleIds.has(style?.id);
    if (style && style.systemPrompt) {
      parts.push(
        `Style preset active: ${style.label}. Apply ONLY this stylistic guidance: ${style.systemPrompt}. Do not add or stack additional quality/camera/film modifiers beyond this preset.`
      );
    }
    // Default policy: avoid inventing slogans/taglines unless explicitly asked or the style implies large typography work
    if (!allowEmbeddedText) {
      parts.push(
        'Do not render any embedded text, slogans, taglines, wordmarks, logos, or letters inside the image/video unless the user explicitly requests text. If labels are present on packaging, keep them completely blank (no letters or numbers); use abstract shapes or solid fills instead. If a design would typically include copy, leave clean negative space for future text overlay instead.'
      );
    } else {
      parts.push(
        'If adding typographic elements, never invent brand slogans or taglines unless explicitly provided by the user. Prefer generic layout without literal words when unspecified.'
      );
    }
    parts.push("You're an IQ 200 specialist in brand / product marketing. Never include font names, brand names, or technical specifications in the visual content.");
    return parts.join('\n\n');
  }

  /**
   * Ask a lightweight text model to rewrite a user's prompt for optimal image generation.
   * The rewrite should preserve intent, be concise, and include relevant brand guidance
   * when provided via options. This does NOT call the image model; it only returns text.
   *
   * @param {string} prompt - User provided prompt
   * @param {Object} options - Optional context
   * @param {Object} [options.brandKit] - { colors?: string[], font?: string | null }
   * @param {('generate'|'remix')} [options.operation] - Type of operation
   * @param {boolean} [options.includeFont] - Whether brand font should be referenced
   * @param {boolean} [options.includeColors] - Whether brand colors should be referenced
   * @returns {Promise<string>} - Refined prompt
   */
  async rewritePromptForImageTask(prompt, options = {}) {
    const brandKit = options.brandKit || {};
    const includeFont = Boolean(options.includeFont && brandKit.font);
    const includeColors = Boolean(options.includeColors && Array.isArray(brandKit.colors) && brandKit.colors.length > 0);
    const operation = options.operation || 'generate';

    const systemGuidance = [
      'You are a prompt optimizer for an image generation model. Rewrite the user prompt to be clear, concrete, and visually descriptive.',
      'Preserve the user intent. Avoid inventing new subjects or elements not implied by the user.',
      'Prefer concise phrasing. Max 240 characters. No lists or quotes—output a single sentence.',
      'If composition is implied, include subject, setting, style adjectives, lighting, and camera/angle if helpful.',
      operation === 'remix' ? 'The user will also provide reference images; keep instructions compatible with image-to-image edits.' : 'Focus on text-to-image generation.',
      includeColors ? `Use these brand colors: ${(brandKit.colors || []).join(', ')}.` : 'Do not mention brand colors unless provided.',
      includeFont ? `When adding text, use typography that matches the style of ${brandKit.font} but do not mention the font name in the output.` : 'Do not mention typography unless text is required.',
      'Never include placeholders like [brand colors] or [brand font]. Output the final instruction only.'
    ].filter(Boolean).join(' ');

    try {
      const { candidates } = await this.genAI.models.generateContent({
        model: MODELS.text,
        contents: [
          { role: 'user', parts: [{ text: systemGuidance }] },
          { role: 'user', parts: [{ text: `User prompt: ${prompt}` }] }
        ]
      });

      const text = candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim();
      if (text && text.length > 0) {
        return text;
      }
    } catch (err) {
      // Fall through to return original prompt when rewrite fails
      console.warn('Prompt rewrite failed, using original prompt:', err.message);
    }
    return prompt;
  }

  async prepareImagesForRemix(images) {
    const preparedImages = [];
    for (const img of images) {
      try {
        const url = img.url || '';
        const isVideo = img.mediaType === 'video' || url.includes('.mp4') || url.includes('.webm') || url.includes('.mov');

        if (url.startsWith('data:')) {
          const m = url.match(/^data:(.+?);base64,(.*)$/);
          if (m) {
            preparedImages.push({
              inlineData: {
                mimeType: m[1],
                data: m[2]
              }
            });
            continue;
          }
        }
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const mimeType = isVideo ? 'video/mp4' : (mime.lookup(url) || 'image/jpeg');

        preparedImages.push({
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: mimeType,
          },
        });
      } catch (error) {
        console.error(`Failed to download or process image/video from ${img.url}:`, error.message);
        throw new Error(`Failed to process image/video for remix: ${img.url}`);
      }
    }
    return preparedImages;
  }

  async improvePromptWithContext({ prompt, mode, style, aspectRatio, resolution, brandKit, images, styleId }) {
    const imageParts = Array.isArray(images) && images.length ? await this.prepareImagesForRemix(images) : [];
    const sys = [
      'You are a prompt optimizer for generative media. Rewrite the user prompt clearly and concretely.',
      'Preserve intent. Prefer concise phrasing and specific visual details.',
      `Aspect ratio: ${aspectRatio || '16:9'}.`,
      mode === 'video' && resolution ? `Resolution: ${resolution}.` : null,
      mode === 'video' ? 'Ensure the description fits in <= 8 seconds.' : null,
      brandKit?.colors?.length ? `Use palette hints: ${(brandKit.colors || []).join(', ')}.` : null,
      brandKit?.font ? `For any text elements, use typography that matches the style of ${brandKit.font} but do not mention the font name in the final output.` : null,
      styleId && styleId !== 'freeform' ? 'A style preset is selected. Do not add extra quality/camera/film modifiers beyond the preset. Focus on content and composition.' : null,
      styleId && styleId !== 'bold_graphic_ad' ? 'Do not include embedded text, slogans, or taglines in the content unless the user explicitly requests text. Leave space for copy instead.' : 'If typography is implied by the preset, do not invent brand slogans; only use literal text if specified by the user.',
      'IMPORTANT: Do NOT return JSON format. Return ONLY in this exact tiered numbering format:\n1) Improved prompt: [your improved prompt text here]\n2) Negative prompt: [what to avoid here]\n3) Rationale:\n   3.1) [first reason]\n   3.2) [second reason]\n   3.3) [third reason]\n\nDo not use JSON, code blocks, or any other formatting. Just plain text with the numbered format above.'
    ].filter(Boolean).join(' ');

    const userMsg = [
      `Mode: ${mode || 'image'}`,
      style ? `Purpose: ${style}` : null,
      'UserPrompt:',
      String(prompt || '')
    ].filter(Boolean).join('\n');

    const parts = [
      { text: sys },
      ...imageParts,
      { text: userMsg }
    ];

    const { candidates } = await this.genAI.models.generateContent({
      model: MODELS.text,
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: -1 }
      }
    });

    // Filter out thought parts — only keep visible response text
    const text = candidates?.[0]?.content?.parts
      ?.filter(p => !p.thought)
      .map(p => p.text)
      .join(' ')
      .trim();
    let out = { improvedPrompt: prompt, negativePrompt: '', rationale: [] };

    if (text) {
      // 1) Try to extract JSON inside code fences first
      let parsedFromJson = false;
      let candidateForJson = text;
      const fenced = text.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) {
        candidateForJson = fenced[1].trim();
      }
      // Try parse entire fenced content as JSON
      try {
        const obj = JSON.parse(candidateForJson);
        if (obj && (obj.improvedPrompt || obj.negativePrompt || obj.rationale)) {
          out.improvedPrompt = String(obj.improvedPrompt || out.improvedPrompt || '').trim();
          out.negativePrompt = String(obj.negativePrompt || '').trim();
          out.rationale = Array.isArray(obj.rationale) ? obj.rationale.slice(0, 5) : [];
          parsedFromJson = true;
        }
      } catch (_) {
        // If that fails, try to find a JSON object anywhere in the text
        const jsonMatch = candidateForJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const obj = JSON.parse(jsonMatch[0]);
            if (obj && (obj.improvedPrompt || obj.negativePrompt || obj.rationale)) {
              out.improvedPrompt = String(obj.improvedPrompt || out.improvedPrompt || '').trim();
              out.negativePrompt = String(obj.negativePrompt || '').trim();
              out.rationale = Array.isArray(obj.rationale) ? obj.rationale.slice(0, 5) : [];
              parsedFromJson = true;
            }
          } catch (_) {
            // ignore JSON parse errors and continue to tiered parsing
          }
        }
      }

      // 2) If not parsed from JSON, parse tiered numbering format, skipping code fences and JSON-like lines
      if (!parsedFromJson) {
        const lines = text.split('\n');
        let currentSection = '';
        const rationaleItems = [];
        const shouldSkip = (s) => {
          const t = s.trim();
          if (t.startsWith('```')) return true; // code fences
          if (t === '{' || t === '}' || t === '[' || t === '],') return true; // braces
          if (/^\"(improvedPrompt|negativePrompt|rationale)\"\s*:/.test(t)) return true; // JSON keys
          if (/^\".+\"\s*[:,]?$/.test(t)) return true; // generic JSON key lines
          return false;
        };

        for (const line of lines) {
          const trimmed = line.trim();
          if (shouldSkip(trimmed)) continue;

          if (trimmed.startsWith('1) Improved prompt:')) {
            currentSection = 'improved';
            out.improvedPrompt = trimmed.replace('1) Improved prompt:', '').trim();
            continue;
          }
          if (trimmed.startsWith('2) Negative prompt:')) {
            currentSection = 'negative';
            out.negativePrompt = trimmed.replace('2) Negative prompt:', '').trim();
            continue;
          }
          if (trimmed.startsWith('3) Rationale:')) {
            currentSection = 'rationale';
            continue;
          }
          const rationaleMatch = trimmed.match(/^3\.(\d+)\)\s*(.*)$/);
          if (rationaleMatch) {
            const item = rationaleMatch[2].trim();
            if (item) rationaleItems.push(item);
            continue;
          }

          if (currentSection === 'improved' && trimmed && !trimmed.startsWith('2)')) {
            out.improvedPrompt = `${out.improvedPrompt} ${trimmed}`.trim();
          } else if (currentSection === 'negative' && trimmed && !trimmed.startsWith('3)')) {
            out.negativePrompt = `${out.negativePrompt} ${trimmed}`.trim();
          }
        }

        out.rationale = rationaleItems.slice(0, 5);
      }
    }
    
    out.improvedPrompt = String(out.improvedPrompt || prompt || '').trim();
    out.negativePrompt = String(out.negativePrompt || '').trim();
    out.rationale = Array.isArray(out.rationale) ? out.rationale : [];
    return out;
  }

  /**
   * Generate a clean, single prompt suggestion based on current settings.
   * Returns a concise instruction for either image or short video generation.
   */
  async generateRandomPrompt({ mode = 'image', style, aspectRatio = '16:9', resolution, brandKit, styleId }) {
    const constraints = [
      `Aspect ratio: ${aspectRatio}.`,
      mode === 'video' && resolution ? `Resolution: ${resolution}.` : null,
      mode === 'video' ? 'Keep within 8 seconds (2–4 shots max).' : null,
      brandKit?.colors?.length ? `Palette hints: ${(brandKit.colors || []).join(', ')}.` : null,
      brandKit?.font ? `If text appears, use typography that matches the style of ${brandKit.font} but never mention the font name.` : null,
      'Avoid listing technical specs in the content; do not mention brand or font names.'
    ].filter(Boolean).join(' ');

    const purpose = style ? `Purpose: ${style}.` : '';
    const instruction = [
      'Create one vivid, self-contained prompt for generative media.',
      'Prefer concrete subjects, composition, lighting, mood, and style.',
      'Do not return JSON or bullets. Output a single paragraph only.'
    ].join(' ');

    const sys = `You are an expert prompt crafter for ${mode === 'video' ? 'short-form video' : 'image'} generation. ${instruction}`;

    const parts = [
      { text: sys },
      { text: `${purpose} ${constraints} ${styleId && styleId !== 'freeform' ? 'A style preset is selected. Do not add extra quality/camera/film modifiers beyond the preset.' : ''} ${styleId && styleId !== 'bold_graphic_ad' ? 'Do not include embedded text, slogans, or taglines unless explicitly requested; leave negative space for copy instead.' : 'Avoid inventing brand slogans; only use literal words if specified.'}` }
    ];

    const { candidates } = await this.genAI.models.generateContent({
      model: MODELS.text,
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 200 }
    });

    const text = candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim();
    if (text && text.length) return text;
    // Fallback basic prompt
    return mode === 'video'
      ? `Up to 8s ${aspectRatio}${resolution ? ` ${resolution}` : ''} video: dynamic shots of a product in a clean setting, tasteful brand color accents, crisp lighting, clear hero moment, end on a strong composition.`
      : `High-quality ${aspectRatio} image of a product in a clean, well-lit scene with tasteful brand color accents, balanced composition, professional commercial style.`;
  }

  /**
   * Ask a lightweight text model to rewrite a user's prompt for optimal video generation (Veo-3).
   * The rewrite preserves intent, is concise, and explicitly encodes duration, AR/resolution,
   * and optional brand guidance.
   *
   * @param {string} prompt
   * @param {Object} options
   * @param {Object} [options.brandKit] - { colors?: string[], font?: string | null }
   * @param {string} [options.aspectRatio] - e.g. '16:9' | '9:16'
   * @param {string} [options.resolution] - '720p' | '1080p'
   * @param {boolean} [options.includeFont]
   * @param {boolean} [options.includeColors]
   * @returns {Promise<string>}
   */
  async rewritePromptForVideoTask(prompt, options = {}) {
    const brandKit = options.brandKit || {};
    const includeFont = Boolean(options.includeFont && brandKit.font);
    const includeColors = Boolean(options.includeColors && Array.isArray(brandKit.colors) && brandKit.colors.length > 0);
    const ar = options.aspectRatio || '16:9';
    const res = options.resolution || '720p';

    const systemGuidance = [
      'You are a prompt optimizer for a short-form video generation model (Veo-3).',
      'Rewrite the user prompt into a single concise sentence (max 240 chars), no bullets/lists/quotes.',
      'Preserve intent; do not invent new subjects not implied.',
      'Include subject, setting, motion and pacing (1–3 cuts), lighting, and style when relevant.',
      `Explicitly encode: duration up to 8 seconds, aspect ratio ${ar}, resolution ${res}.`,
      includeColors ? `Incorporate these brand colors tastefully when suitable: ${(brandKit.colors || []).join(', ')}.` : 'Do not mention brand colors unless provided.',
      includeFont ? `For on-screen titles/captions, use typography that matches the style of ${brandKit.font} but do not mention the font name in the output.` : 'Only mention typography if text overlays are implied.',
      'Never include placeholders like [brand colors] or [brand font]. Output the final instruction only.'
    ].filter(Boolean).join(' ');

    try {
      const { candidates } = await this.genAI.models.generateContent({
        model: MODELS.text,
        contents: [
          { role: 'user', parts: [{ text: systemGuidance }] },
          { role: 'user', parts: [{ text: `User prompt: ${prompt}` }] }
        ]
      });

      const text = candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim();
      if (text && text.length > 0) {
        return text;
      }
    } catch (err) {
      console.warn('Video prompt rewrite failed, using fallback:', err.message);
    }
    // Fallback: append constraints
    return `${prompt} — up to 8s, ${ar} ${res}.`;
  }

  /**
   * Generate a video using Veo 3. Supports text-to-video or image-to-video.
   * @param {Object} params
   * @param {string} params.prompt - Text prompt
   * @param {string} [params.negativePrompt] - What to avoid
   * @param {('16:9'|'9:16')} [params.aspectRatio='16:9'] - Video aspect ratio
   * @param {('720p'|'1080p')} [params.resolution='720p'] - Resolution (1080p only for 16:9)
   * @param {('allow_all'|'allow_adult'|'dont_allow')} [params.personGeneration] - Person generation policy
   * @param {string} [params.imageUrl] - Optional reference image URL for image-to-video
   * @returns {Promise<{ filename: string, filepath: string, aspectRatio: string, resolution: string }>}
   */
  async generateVideoVeo3(params) {
    console.log('Veo3 generation started with params:', JSON.stringify(params, null, 2));
    const prompt = params.prompt || '';
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt is required');
    }

    const aspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';
    const resolution = params.resolution === '1080p' && aspectRatio === '16:9' ? '1080p' : '720p';
    const negativePrompt = params.negativePrompt || undefined;
    const personGeneration = params.personGeneration || undefined;

    // Optional: load image/video bytes if imageUrl or videoUrl provided
    const VIDEO_REF_WARN_BYTES = 20 * 1024 * 1024;  // 20MB — soft warning
    const VIDEO_REF_MAX_BYTES = 100 * 1024 * 1024;   // 100MB — hard cap
    let imagePart = undefined;
    let videoPart = undefined;
    let videoRefWarning = undefined;
    if (params.videoUrl) {
      console.log('Processing video reference for video generation:', params.videoUrl);
      const url = params.videoUrl;
      if (url.startsWith('data:')) {
        const match = url.match(/^data:(.+?);base64,(.*)$/);
        if (match) {
          const [, mt, b64] = match;
          const sizeBytes = Math.ceil(b64.length * 3 / 4);
          if (sizeBytes > VIDEO_REF_MAX_BYTES) {
            throw new Error(`Video reference is too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maximum is ${VIDEO_REF_MAX_BYTES / 1024 / 1024}MB. Use a shorter or lower-resolution clip.`);
          }
          if (sizeBytes > VIDEO_REF_WARN_BYTES) {
            videoRefWarning = `Video reference is ${(sizeBytes / 1024 / 1024).toFixed(1)}MB. Veo only uses the last second of the clip for scene extension — consider using a shorter clip for faster processing.`;
            console.warn(videoRefWarning);
          }
          videoPart = { videoBytes: b64, mimeType: mt };
          console.log('Using data URL video for video generation');
        }
      } else {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        if (buffer.length > VIDEO_REF_MAX_BYTES) {
          throw new Error(`Video reference is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum is ${VIDEO_REF_MAX_BYTES / 1024 / 1024}MB. Use a shorter or lower-resolution clip.`);
        }
        if (buffer.length > VIDEO_REF_WARN_BYTES) {
          videoRefWarning = `Video reference is ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Veo only uses the last second of the clip for scene extension — consider using a shorter clip for faster processing.`;
          console.warn(videoRefWarning);
        }
        videoPart = { videoBytes: buffer.toString('base64'), mimeType: 'video/mp4' };
        console.log('Downloaded video reference for video generation, size:', buffer.length, 'bytes');
      }
    } else if (params.imageUrl) {
      console.log('Processing image for video generation:', params.imageUrl);
      const url = params.imageUrl;
      if (url.startsWith('data:')) {
        const match = url.match(/^data:(.+?);base64,(.*)$/);
        if (match) {
          const [, mt, b64] = match;
          imagePart = { imageBytes: b64, mimeType: mt };
          console.log('Using data URL image for video generation');
        }
      } else {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        const mimeType = mime.lookup(url) || 'image/png';
        imagePart = { imageBytes: buffer.toString('base64'), mimeType };
        console.log('Downloaded image for video generation, size:', buffer.length, 'bytes');
      }
    } else {
      console.log('No image or video provided for video generation - text-to-video mode');
    }

    // Step 1: kick off generation with optional image or video input
    const requestParams = {
      model: MODELS.video,
      prompt: `You're an IQ 200 specialist in brand / product marketing. Never include font names, brand names, or technical specifications in the visual content. ${prompt}`,
      config: {
        aspectRatio,
        ...(negativePrompt ? { negativePrompt } : {})
      },
      ...(videoPart ? { video: videoPart } : imagePart ? { image: imagePart } : {})
    };
    console.log('Veo3 request params:', JSON.stringify({
      ...requestParams,
      image: requestParams.image ? `[image: ${requestParams.image.mimeType}, ${requestParams.image.imageBytes?.length || 0} chars]` : undefined,
      video: requestParams.video ? `[video: ${requestParams.video.mimeType}, ${requestParams.video.videoBytes?.length || 0} chars]` : undefined
    }, null, 2));
    
    let operation = await this.genAI.models.generateVideos(requestParams);
    console.log('Veo3 operation started:', operation.name);

    // Step 2: poll until done
    const startedAt = Date.now();
    const maxMs = 15 * 60 * 1000; // 15 minutes (Veo-3 can take 10-15+ minutes)
    let pollCount = 0;
    while (!operation.done) {
      if (Date.now() - startedAt > maxMs) {
        throw new Error('Video generation timed out');
      }
      pollCount++;
      console.log(`Veo3 polling attempt ${pollCount}, elapsed: ${Math.round((Date.now() - startedAt) / 1000)}s`);
      await new Promise((r) => setTimeout(r, 10000));
      operation = await this.genAI.operations.getVideosOperation({ operation });
      console.log(`Veo3 polling update: done=${operation.done}, hasResponse=${!!operation.response}, generatedCount=${operation.response?.generatedVideos?.length || 0}`);
    }

    // Debug: log final operation structure for troubleshooting (safe fields only)
    try {
      const dbg = {
        done: operation?.done,
        error: operation?.error || null,
        hasResponse: !!operation?.response,
        generatedCount: operation?.response?.generatedVideos?.length || 0,
        raiFiltered: operation?.response?.raiMediaFilteredCount || 0,
        raiReasons: operation?.response?.raiMediaFilteredReasons || []
      };
      console.log('Veo3 final operation:', JSON.stringify(dbg));
    } catch (_) {}

    if (operation?.error) {
      throw new Error(`Veo 3 operation error: ${JSON.stringify(operation.error)}`);
    }

    const videos = operation?.response?.generatedVideos || [];
    const videoFileRef = videos[0]?.video;
    if (!videoFileRef) {
      const filtered = operation?.response?.raiMediaFilteredCount;
      const reasons = operation?.response?.raiMediaFilteredReasons;
      if (filtered && filtered > 0) {
        throw new Error(`No video returned (filtered by RAI). Reasons: ${Array.isArray(reasons) ? reasons.join(', ') : 'unknown'}`);
      }
      const details = {
        done: operation?.done,
        hasResponse: !!operation?.response,
        generatedCount: videos.length,
        raiFiltered: filtered || 0,
        raiReasons: reasons || []
      };
      throw new Error(`No video returned from Veo 3${videos.length === 0 ? ' (no outputs present)' : ''}. Details: ${JSON.stringify(details)}`);
    }

    // Select a writable download directory:
    // - Cloud Run filesystem is read-only except /tmp
    // - If GCS is configured we don't need a local static file; /tmp is fine
    const isCloudRun = !!process.env.K_SERVICE;
    const preferTmp = isCloudRun || !!process.env.GCS_BUCKET;

    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const absUploadsDir = preferTmp ? '/tmp' : path.resolve(uploadsDir);

    if (!fs.existsSync(absUploadsDir)) {
      fs.mkdirSync(absUploadsDir, { recursive: true });
    }

    // Unique filename
    const filename = `veo3_${Date.now()}.mp4`;
    const filepath = path.join(absUploadsDir, filename);

    console.log('Downloading video to:', filepath);
    console.log('Directory exists:', fs.existsSync(absUploadsDir));
    console.log('Directory is writable:', (() => { try { fs.accessSync(absUploadsDir, fs.constants.W_OK); return true; } catch { return false; } })());

    // Robust download with retries for rare partial writes
    async function downloadWithVerify(fileRef, destPath, minBytes = 200 * 1024, maxAttempts = 5) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Clean any previous partial file
          try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
          await new Promise(r => setTimeout(r, attempt === 1 ? 0 : 250 * attempt)); // small backoff

          await (async () => {
            await this.genAI.files.download({ file: fileRef, downloadPath: destPath });
          })();

          // Ensure disk flush settles
          await new Promise(r => setTimeout(r, 150));

          if (!fs.existsSync(destPath)) {
            throw new Error(`Missing file after download (attempt ${attempt})`);
          }
          const stats = fs.statSync(destPath);
          if (stats.size < minBytes) {
            throw new Error(`File too small (${stats.size} bytes) on attempt ${attempt}`);
          }

          // MIME sniff to ensure it's a valid MP4
          const buffer = fs.readFileSync(destPath, { start: 0, end: 1023 });
          const hasValidMP4Header = buffer.includes('ftyp') || buffer.includes('moov') || buffer.includes('mdat');
          if (!hasValidMP4Header) {
            throw new Error(`File doesn't appear to be a valid MP4 (attempt ${attempt})`);
          }

          console.log(`Video file verified: ${destPath} (${stats.size} bytes)`);
          return;
        } catch (e) {
          console.warn(`Download verify failed: ${e.message}`);
          if (attempt === maxAttempts) {
            throw new Error(`Failed after ${maxAttempts} attempts: ${e.message}`);
          }
        }
      }
    }

    try {
      await downloadWithVerify.call(this, videoFileRef, filepath);
    } catch (downloadError) {
      console.error('Video download failed:', downloadError.message);
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    return { filename, filepath, aspectRatio, resolution, videoRefWarning };
  }

  /**
   * Generate an image from text prompt
   * @param {string} prompt - Text description of the image
   * @param {string} style - Style preference (photorealistic, artistic, etc.)
   * @param {string} aspectRatio - Aspect ratio for the image (e.g., '16:9', '1:1', 'auto')
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(prompt, style = 'photorealistic', aspectRatio = '16:9', styleId = 'freeform') {
    try {
      const enhancedPrompt = styleId && styleId !== 'freeform' ? String(prompt) : this.enhancePrompt(prompt, style);

      const config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: aspectRatio !== 'auto' ? {
          aspectRatio: aspectRatio
        } : undefined
      };

      const systemInstruction = this.buildSystemPrompt({
        basePrompt: '',
        styleId
      });

      const contents = [
        { role: 'user', parts: [{ text: `${systemInstruction}\n\n${enhancedPrompt}` }] }
      ];

      const response = await this.genAI.models.generateContentStream({
        model: MODELS.image,
        config,
        contents,
      });

      let imageData = null;
      let textResponse = '';

      // Process the streaming response
      for await (const chunk of response) {
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }

        const parts = chunk.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!imageData) {
        throw new Error('No image data found in response');
      }

      // Best effort: attempt to infer dimensions from simple ratios when server sets defaults
      let inferredWidth = 1024;
      let inferredHeight = 1024;
      if (config && config.imageConfig && config.imageConfig.aspectRatio && config.imageConfig.aspectRatio !== 'auto') {
        const [w, h] = String(config.imageConfig.aspectRatio).split(':').map(Number);
        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          const base = 1024; // heuristic display size
          const ratio = w / h;
          if (ratio >= 1) {
            inferredWidth = base;
            inferredHeight = Math.round(base / ratio);
          } else {
            inferredHeight = base;
            inferredWidth = Math.round(base * ratio);
          }
        }
      }

      // Persist to GCS if configured; otherwise keep data URL (local dev)
      let url = `data:image/png;base64,${imageData}`;
      let thumbUrl = url;
      if (process.env.GCS_BUCKET) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        // Note: userId will be passed from the calling route
        const userId = global.currentUserId || 'anonymous';
        const key = `users/${userId}/generated/images/${y}/${m}/generate_${Date.now()}.png`;
        const buf = Buffer.from(imageData, 'base64');
        url = await uploadBuffer(buf, key, 'image/png', { customTime: new Date().toISOString() });
        thumbUrl = url;
      }

      return {
        id: `generate_${Date.now()}`,
        title: prompt,
        url,
        thumbnail: thumbUrl,
        source: 'AI Generated (Gemini)',
        width: inferredWidth,
        height: inferredHeight,
        prompt: enhancedPrompt,
        style,
        textResponse: textResponse || null
      };
    } catch (error) {
      console.error('Gemini image generation error:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Perform image-to-image operations with context
   * @param {string} prompt - Natural language instruction
   * @param {Array} images - Array of image objects with URLs
   * @param {string} aspectRatio - Aspect ratio for the image (e.g., '16:9', '1:1', 'auto')
   * @returns {Promise<Object>} Generated image data
   */
  async remixImagesWithContext(prompt, images, aspectRatio = '16:9', styleId = 'freeform') {
    try {
      // Download and convert images to base64
      const imageDataParts = await this.prepareImagesForRemix(images);
      
      const config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: aspectRatio !== 'auto' ? {
          aspectRatio: aspectRatio
        } : undefined
      };
      
      const systemInstruction = this.buildSystemPrompt({ basePrompt: '', styleId });
      
      // For non-text-heavy styles, add explicit negative instruction
      let finalPrompt = prompt;
      if (styleId !== 'bold_graphic_ad') {
        // More aggressive text suppression for product advertisements
        finalPrompt = `${prompt}\n\nCRITICAL: Do not add any text, labels, brand names, or letters anywhere in the image. Keep all product labels completely blank. Use solid colors or abstract shapes instead of any text. This is a visual-only advertisement without any embedded text.`;
      }

      const contents = [
        {
          role: 'user',
          parts: [
            ...imageDataParts,
            { text: `${systemInstruction}\n\n${finalPrompt}` },
          ],
        },
      ];

      const response = await this.genAI.models.generateContentStream({
        model: MODELS.image,
        config,
        contents,
      });

      let imageData = null;
      let textResponse = '';

      for await (const chunk of response) {
        console.log('Gemini response chunk:', JSON.stringify(chunk, null, 2));
        
        if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
          continue;
        }

        const parts = chunk.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data;
            console.log('Found image data, length:', imageData.length);
          } else if (part.text) {
            textResponse += part.text;
            console.log('Found text response:', part.text);
          }
        }
      }

      if (!imageData) {
        console.log('No image data found. Text response:', textResponse);
        throw new Error('No image data found in response for remix');
      }

      let url = `data:image/png;base64,${imageData}`;
      let thumbUrl = url;
      if (process.env.GCS_BUCKET) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        // Note: userId will be passed from the calling route
        const userId = global.currentUserId || 'anonymous';
        const key = `users/${userId}/generated/remix/${y}/${m}/remix_${Date.now()}.png`;
        const buf = Buffer.from(imageData, 'base64');
        url = await uploadBuffer(buf, key, 'image/png', { customTime: new Date().toISOString() });
        thumbUrl = url;
      }
      return {
        id: `remix_${Date.now()}`,
        title: prompt,
        url,
        thumbnail: thumbUrl,
        source: 'AI Remix (Gemini)',
        width: 512,
        height: 512,
        prompt: prompt,
        textResponse: textResponse || null
      };
    } catch (error) {
      console.error('Gemini remix image generation error:', error);
      throw new Error(`Failed to remix images: ${error.message}`);
    }
  }

  /**
   * Enhance user prompt using Gemini 2.5 Flash to create high-precision, marketing-oriented JSON prompt
   * @param {string} userPrompt - Original user prompt
   * @param {string} purpose - Output purpose (e.g., 'Product-Focused Advertisement', 'Social Media Lifestyle Post')
   * @param {Object} brandKit - Brand kit information
   * @returns {Promise<Object>} Enhanced prompt as structured JSON
   */
  async enhancePromptWithGemini(userPrompt, purpose, brandKit = {}, aspectRatio = null) {
    const systemPrompt = `You are a marketing prompt specialist. Transform user prompts into high-precision, marketing-oriented JSON prompts for AI image generation.

Your task:
1. Analyze the user's intent and the specified output purpose
2. Create a structured JSON prompt that optimizes for the marketing goal
3. Include specific visual elements, composition, lighting, and style that align with the purpose
4. Consider brand elements when provided
5. Ensure the prompt is actionable for an AI image generator

Output format (JSON):
{
  "visual_description": "Detailed visual description of the main subject and scene",
  "composition": "Specific composition instructions (rule of thirds, centered, etc.)",
  "lighting": "Lighting requirements (natural, studio, dramatic, etc.)",
  "style": "Visual style (photorealistic, artistic, commercial, etc.)",
  "mood": "Emotional tone and atmosphere",
  "brand_elements": "How to incorporate brand colors/fonts if applicable",
  "technical_specs": "Technical requirements (resolution, aspect ratio, etc.)",
  "marketing_focus": "How the image should support the marketing purpose"
}

Purpose contexts:
- "Product-Focused Advertisement": Clean, professional, product-centric with clear CTAs
- "Social Media Lifestyle Post": Engaging, lifestyle-focused, mobile-optimized, shareable
- "Website Hero Image": Wide format, editorial quality, space for text overlay

Keep descriptions concise but specific. Focus on visual elements that drive marketing goals.`;

    const userMessage = `User prompt: "${userPrompt}"
Output purpose: "${purpose}"
Brand kit: ${JSON.stringify(brandKit)}
${aspectRatio ? `Desired aspect ratio: "${aspectRatio}"` : ''}

Transform this into a high-precision marketing prompt. If an aspect ratio is provided, include it explicitly in technical_specs and avoid conflicting ratios.`;

    try {
      const { candidates } = await this.genAI.models.generateContent({
        model: MODELS.text,
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: userMessage }] }
        ]
      });

      const responseText = candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim();
      
      if (responseText) {
        try {
          // Try to parse as JSON
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON response, using fallback:', parseError.message);
        }
      }
    } catch (error) {
      console.warn('Gemini prompt enhancement failed, using fallback:', error.message);
    }

    // Fallback to simple enhancement
    return {
      visual_description: userPrompt,
      composition: "professional composition",
      lighting: "natural lighting",
      style: "photorealistic",
      mood: "professional",
      brand_elements: "",
      technical_specs: "high quality",
      marketing_focus: `Optimized for ${purpose}`
    };
  }

  /**
   * Enhance prompt with style preferences and purpose
   * @param {string} prompt - Original prompt
   * @param {string} style - Style preference
   * @param {string} purpose - Output purpose for system prompt
   * @returns {string} Enhanced prompt
   */
  enhancePrompt(prompt, style, purpose = null) {
    const styleEnhancements = {
      photorealistic: 'high quality, photorealistic, detailed, professional photography',
      artistic: 'artistic, creative, stylized, painterly, expressive',
      cartoon: 'cartoon style, colorful, fun, animated',
      sketch: 'pencil sketch, hand-drawn, artistic line work',
      vintage: 'vintage style, retro, classic, timeless'
    };

    const enhancement = styleEnhancements[style] || styleEnhancements.photorealistic;
    
    // Include purpose in the system prompt context
    const purposeContext = purpose ? `, optimized for ${purpose}` : '';
    
    return `${prompt}, ${enhancement}${purposeContext}`;
  }
}

module.exports = GeminiService;
