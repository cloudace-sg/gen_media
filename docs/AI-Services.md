---
tags: [ai, gemini, veo, dev-log]
status: updated
---

# AI Services & Generation

The gen_media project uses three Gemini models via `@google/genai`: a text model for prompt enhancement, an image model for both text-to-image and reference-guided image generation (remix), and a Veo video model for long-running video generation. All AI logic is centralised in `server/src/services/gemini.js`, with routes in `generate.js`, `remix.js`, and `video.js` acting as thin orchestration layers.

## Models

| Role | Model ID | API Used |
|---|---|---|
| Text (prompt tasks) | `gemini-3.5-flash` | `generateContent` |
| Image generation + remix | `gemini-3.1-flash-image-preview` | `generateContentStream` |
| Video generation | `veo-3.1-generate-preview` | `generateVideos` (long-running operation) |

A code comment explicitly warns that when Gemini Omni Flash ships, it will use `generateContent` (not `generateVideos`), so a new parallel method `generateVideoOmni()` must be added — not a simple model ID swap.

---

## Image Generation (`generateImage`)

- Route: `GET /api/generate` (single or parallel multi-image) and `POST /api/generate` (supports `referenceImages`).
- Uses `generateContentStream` with `responseModalities: ['IMAGE', 'TEXT']`.
- Aspect ratio is passed via `imageConfig.aspectRatio`; `'auto'` skips the field entirely.
- A system prompt is injected via `buildSystemPrompt()`, which enforces brand style presets and suppresses embedded text (logos, slogans, wordmarks) for all style IDs except `bold_graphic_ad`.
- When `styleId` is `freeform`, `enhancePrompt()` appends style descriptor strings (photorealistic, artistic, etc.). For all other style IDs, the user prompt is passed through verbatim.
- GCS upload: if `GCS_BUCKET` is set, the base64 PNG is uploaded to `users/{userId}/generated/images/{year}/{month}/generate_{ts}.png`; otherwise a data URL is returned (local dev).
- Multi-image: parallel `Promise.all` over `requestedCount` (max 4 for POST, unlimited for GET).

---

## Remix / Reference-Guided Image Generation (`remixImagesWithContext`)

- Route: `POST /api/remix` — requires `prompt` and `images[]` array.
- Route: `POST /api/generate` — when `referenceImages` are provided, delegates to `remixImagesWithContext` instead of `generateImage`.
- Downloads each reference image, converts to base64 `inlineData` parts, and prepends them to the `contents` array before the text instruction.
- For all style IDs except `bold_graphic_ad`, an aggressive text-suppression suffix is appended to the prompt: _"CRITICAL: Do not add any text, labels, brand names, or letters..."_.
- Brand logo injection: if the prompt contains `[brand logo]`, the route (`remix.js`) resolves the primary logo URL and appends it as an additional reference image in the `images` array — transparently to the Gemini call.
- GCS path for remix output: `users/{userId}/generated/remix/{year}/{month}/remix_{ts}.png`.
- Returns `{ id, title, url, thumbnail, source, width, height, prompt, textResponse }`.

---

## Veo Video Generation (`generateVideoVeo3`)

- Route: `POST /api/video` — accepts `prompt`, `negativePrompt`, `aspectRatio`, `resolution`, `personGeneration`, `imageUrl`, `videoUrl`, `referenceImageUrls[]`.
- Calls `this.genAI.models.generateVideos(requestParams)` which starts a long-running operation, then polls with `getVideosOperation` every 10 seconds, up to 15 minutes.
- After the operation completes, downloads the video file via `genAI.files.download` with up to 5 retry attempts, each verifying file size (min 200KB) and MP4 header (`ftyp`/`moov`/`mdat`).
- On Cloud Run (`K_SERVICE` env) or when GCS is configured, downloads to `/tmp`; otherwise to `server/uploads/`.
- Output GCS path: `users/{userId}/generated/videos/{year}/{month}/veo3_{ts}.mp4`.

### Four generation modes (selected by priority):

| Priority | Mode | Trigger |
|---|---|---|
| 1 (highest) | Ingredients to Video | `referenceImageUrls[]` present — up to 3 images, passed as `config.referenceImages` with `referenceType: 'asset'` |
| 2 | Scene Extension | `videoUrl` present — requires GCS, uploads to GCS, passes `gs://` URI as `video` param |
| 3 | Image-to-Video | `imageUrl` present — inline base64 bytes, passed as top-level `image` param |
| 4 | Text-to-Video | No media provided |

### Known Veo Limitations

1. **No `encodedVideo` (inline bytes) support**: Veo 3.1 does not accept `videoBytes` inline. Video references must be uploaded to GCS first and passed as a `gs://` URI. Without `GCS_BUCKET` configured, video references are silently skipped with a warning returned to the client.
2. **GCS is a hard requirement for video references**: If `GCS_BUCKET` is unset and `videoUrl` is provided, the reference is dropped; the response includes `videoRefWarning` to inform the client.
3. **Size limits**: Video references have a soft warning at 20MB and a hard cap at 100MB. Reference images are capped at 20MB each. Large video refs trigger a client-visible warning noting that Veo only uses the last second for scene extension.
4. **Resolution constraint**: `1080p` is only available for `16:9` aspect ratio; `9:16` is always capped at `720p`.
5. **RAI filtering**: The operation response may include `raiMediaFilteredCount`/`raiMediaFilteredReasons`; these are surfaced as explicit errors.
6. **No `personGeneration` in current request params**: The param is accepted by the route but not forwarded to Veo config in the current implementation (the `requestParams.config` spread does not include it).

---

## Gemini Omni Flash (`gemini-omni-flash-preview`)

Released Jun 30 2026. A separate model from Veo — complementary, not a replacement. **Veo generates, Omni edits.**

**Not yet integrated into this project.** New method `generateVideoOmni()` must be added to `server/src/services/gemini.js` — it uses `generateContent` (not `generateVideos`), so it is not a simple model ID swap. The Interactions API (`previous_interaction_id`) requires stateful session tracking not present in the current server.

### Key capabilities vs Veo 3.1

| Capability | Omni Flash | Veo 3.1 |
|---|---|---|
| Edit an existing video | ✅ | ❌ |
| Multi-turn conversational editing | ✅ Interactions API | ❌ |
| Add/remove objects in video | ✅ | ❌ |
| Style transfer on existing video | ✅ | ❌ |
| Audio-first (voiceover → synced video) | ✅ | ❌ |
| Multiple tagged subject references | ✅ `<IMAGE_REF_N>` | Limited |
| Cost per second | $0.10 | $0.40 (standard) |
| 1080p / 4K | ❌ 720p only | ✅ |
| Lip-synced dialogue | ❌ | ✅ |
| Negative prompts | ❌ | ✅ |

### Output specs
- 720p, 24 FPS, 3–10s, MP4 with native audio, 16:9 or 9:16
- Delivery: base64 (<4MB) or URI polling (>4MB)
- SynthID watermark on every clip

### Pricing
$0.10/second ($17.50 per 1M output video tokens, billed at 5,792 tokens/s)

### Real human video editing policy
- Allowed: edit background, lighting, objects, scene around a real person
- Blocked: speech/audio editing, changing what a person says
- Blocked: recognizable/public figures (classifier-based), minors
- Blocked entirely in EEA, Switzerland, UK for uploaded video editing

### Voiceover + captions
- **Audio-first generation** ✅ — provide a voiceover audio file, model generates video synced to it
- **Captions baked into video** ✅ — native text rendering (EN, ZH, JA, KO)
- **Adding voiceover to existing video** ❌ — not supported; use ffmpeg + TTS
- **Voice/speech editing** ❌ — explicitly blocked

### Planned integration surface (not yet built)
- "Apply Branding" action on My Files video cards → Omni Flash video-to-video with logo as `<IMAGE_REF_1>`
- "Edit This Video" drawer → freeform edit prompt on existing video
- Conversation thread → Interactions API stateful editing (SOW-29)
- "Restyle" picker → style transfer on existing video
- Text overlay editor → native text rendering as edit step (SOW-16)

Full research: [[Gemini-Omni-Flash]]

---

## Brand Integration (cross-cutting)

All three routes apply brand placeholder resolution before calling the service:
- `[brand colors]` → resolved hex/name list
- `[brand font]` → resolved only when text is implied in the prompt
- `[brand logo]` → semantic description replacement in text; for remix, also injects logo as a reference image

Prompt enhancement for text tasks uses `rewritePromptForImageTask()` (text model) to produce a concise ≤240-character instruction before sending to the image model.

## Standalone Scripts (`scripts/`)

Exploration and one-shot generation scripts for Gemini quality validation and VEO product commercial generation. All read `GOOGLE_GEMINI_API_KEY` from `server/.env` via dotenv.

| Script | Model | Purpose |
|---|---|---|
| `scripts/analyze-video.js` | `gemini-3.5-flash` | Full video understanding — scenes, transcript, events, text overlays, reverse prompt, product swap |
| `scripts/test-veo-generation.js` | `gemini-3.5-flash` (tweak) + `veo-3.1-generate-preview` (generation) | Fire VEO generation from reverse-prompt JSON; `--tweak` applies natural language changes while preserving all product fidelity rules |
| `scripts/generate-newmoon-worldcup.js` | `veo-3.1-generate-preview` | One-shot: New Moon World Cup commercial — Bird's Nest + Essence of Chicken, family at home late night watching match |
| `scripts/generate-birdsnest-lady.js` | `veo-3.1-generate-preview` | One-shot: Bird's Nest single-product video — lady at home late night, uncap → place cap on table → drink |
| `scripts/generate-chicken-essence-lady.js` | `veo-3.1-generate-preview` | One-shot: Essence of Chicken single-product video — same lady, same setting, same cap-off action sequence |

`analyze-video.js` and `test-veo-generation.js` were built Jun 20 as pre-SOW-22 validation. Model upgraded from `gemini-2.5-flash` to `gemini-3.5-flash` on Jun 29. Product commercial scripts were built Jun 30 for New Moon client. Integration path: lift functions into `server/src/services/gemini.js` when SOW-22 starts.

### VEO Safety Filter Notes (Jun 30)

VEO's safety classifier can block product consumption videos. Key patterns observed:

- **Alcohol false-positive**: "pale golden liquid in a transparent glass jar consumed at night" matches alcohol consumption. Fix: add `"traditional Chinese nutritional health food supplement, not an alcoholic beverage"` to the prompt.
- **Reference image count**: Using `image (8).png` (both products uncapped) alongside the Bird's Nest front hero increased filter hit rate. Reducing to 1 reference image (front hero only) resolved it for Bird's Nest.
- **Prompt tone**: Over-engineered prompts with all-caps instruction language (`ABSOLUTE RULE`, `FIDELITY RULES`) increase filter hit rate. Narrative/cinematic style passes more reliably.
- **Filter is stochastic**: the same prompt may pass one attempt and fail the next. Incremental prompt changes + retry is the right approach.
- **Essence of Chicken never filtered**: dark brown opaque liquid does not trigger the alcohol pattern.

### VEO Prompt Engineering Patterns

| Pattern | Effect |
|---|---|
| Numbered sequential actions ("First... Second... Third...") | Reliable ordering of prop state changes (cap on → cap off → cap on table → drink) |
| Hand-relative size anchor ("fits in one palm, fingers wrap around it") | Prevents VEO from generating the jar too large |
| Prop state description at each stage ("the lid is now ON the table, the jar has no lid") | More reliable than describing the motion abstractly |
| Continuous narrative scene (no shot lists, no timings) | Passes safety filter more consistently than structured shot breakdowns |

---

## Key Decisions
- Three-model split: text model handles all prompt manipulation (cheap, fast); image model handles both generate and remix via the same generateContentStream API; video model uses the separate generateVideos long-running operation API — keeping the surface area minimal while allowing independent model upgrades.
- generateContentStream is used for images (not generateContent) to allow incremental chunk processing and avoid timeouts on large responses.
- Video references require GCS URI rather than inline bytes because Veo 3.1 does not support encodedVideo. The workaround is to upload to GCS first then pass gs:// URI.
- When referenceImages are provided to POST /api/generate, the route transparently delegates to remixImagesWithContext instead of generateImage, unifying the two flows under one endpoint.
- Brand logo is injected as an additional reference image (not just a text description) in the remix flow when the prompt contains [brand logo], to maximise visual fidelity.
- Text suppression is applied aggressively in the remix system prompt for all non-bold_graphic_ad styles to prevent the model from hallucinating brand copy or wordmarks onto product images.
- Video download uses up to 5 retries with MP4 header validation (ftyp/moov/mdat check) to guard against partial writes, which have been observed in production.
- On Cloud Run, /tmp is used as the download directory since the container filesystem is read-only; the file is then immediately uploaded to GCS and the local tmp file is left to be reclaimed.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/gemini.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/generate.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/video.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/remix.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/storage.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/brandkit.js`
- `/home/angieng/CloudAceSIG/Projects/gen_media/server/src/services/styles.js`

## Related
- [[Session-Jun30]] — New Moon product videos, VEO safety filter learnings, prompt patterns
- [[Brand kit integration and placeholder resolution]]
- [[GCS storage layer (uploadFile / uploadBuffer)]]
- [[Style presets system (getStyleById / buildSystemPrompt)]]
- [[RAI content filtering handling]]
- [[Reference image workflows (search/upload/generated/brand assets)]]
- [[Veo Omni Flash migration path (future generateVideoOmni method)]]
- [[Multi-image parallel generation and count limits]]
- [[Video frame extraction as image reference workaround for Veo video references]]
