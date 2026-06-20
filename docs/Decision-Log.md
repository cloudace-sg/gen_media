---
tags: [decisions, git-history, dev-log]
status: updated
---

# Git History & Key Decisions

The gen_media project evolved from a basic Gemini image generation tool (March 2026) through multi-source media search, video support, reference image/video workflows, and a series of GCS/auth infrastructure fixes — with the most active development occurring in May–June 2026. Key inflection points were the addition of Veo video generation, the discovery that Veo 3.1 rejects inline encoded video bytes and requires GCS URIs, and the decision to use referenceImageUrls (style reference) rather than imageUrl (start frame) for image refs passed to video generation.

## Commit Timeline & Feature Progression

| Date | Commit | Type | Description |
|------|--------|------|-------------|
| 2026-03-02 | dd6e170 | init | Initial commit |
| 2026-03-03 | 181a4ed | init | Docker image scaffolding |
| 2026-05-06 | c051a0d | docs | AGENTS.md — Cursor Cloud dev instructions; GCS fallback notes |
| 2026-05-06 | 6313cdb | infra | cloudbuild.yaml for Cloud Run deployment |
| 2026-05-14 | 5dfcb11 | feat | Replace deprecated Google Custom Search with Pexels API |
| 2026-05-14 | 0666934 | feat | Multi-source search: Pexels + Unsplash + Pixabay for images & videos |
| 2026-05-18 | e06370d | feat | Wire video search to frontend (`/api/search/videos`) |
| 2026-05-18 | 759823f | fix | Video search: add `mediaType` field so frontend renders video player |
| 2026-05-18 | 6986642 | fix | Video thumbnails + grid layout |
| 2026-05-22 | 4cf6eb0 | feat | Veo endpoint migration, Gemini model updates, thinking support |
| 2026-05-22 | 68f1743 | fix | Duplicate `videoUrl` declaration crashing server on startup |
| 2026-05-22 | f39bb0e | fix | Video reference handling in generation and remix flows |
| 2026-05-22 | 46c0e20 | feat | Video thumbnail support with play button + staging |
| 2026-06-05 | 565a7cf | feat | Video reference staging + centralized model config |
| 2026-06-09 | f247ecd | feat | Upload MP4/WebM/MOV as user-supplied video references |
| 2026-06-09 | 2024af9 | feat | Use saved GCS assets (images & videos) as references |
| 2026-06-09 | eb1427d | feat | Size check and warning for large video references |
| 2026-06-09 | 41448d1 | feat | Ingredients to Video — reference images for character consistency |
| 2026-06-09 | f8b909b | feat | Extract video frame as reference image |
| 2026-06-12 | b024d77 | feat/fix | Fix all 4 reference workflows (search/upload/generated/brand); proxy external URLs via `/uploads/save-url`; switch generate to POST; unify generate/remix in PromptDrawer |
| 2026-06-12 | e167185 | fix | Remove hardcoded `GCS_BUCKET` from Dockerfile startup — was overriding Cloud Run env var |
| 2026-06-15 | 7a79794 | fix | Skip video refs for Veo 3.1 (encodedVideo rejected with INVALID_ARGUMENT); SDK 1.22→2.6; model upgrades |
| 2026-06-15 | d21a270 | fix | Enable Veo video input via GCS URI (download → upload to GCS → pass `gs://` URI) |
| 2026-06-15 | c5a0ba8 | feat | Merge: enable video references for Veo via GCS URI upload |
| 2026-06-15 | 803fd91 | fix | My Files UX; image refs as `referenceImageUrls` (style) not `imageUrl` (start frame) |
| 2026-06-15 | 576ab1a | fix | Bake `REACT_APP_FIREBASE_*` vars into React build for production auth |
| 2026-06-15 | 18fe474 | docs | 3-Layer Query Rule added to CLAUDE.md |
| 2026-06-15 | bb2298c | chore | Optimize hooks — remove noisy Read hook, add PostToolUse Obsidian auto-update |
| 2026-06-15 | 1effca1 | fix | post-bash hook — correct regex, absolute paths, proper try/except |
| 2026-06-15 | ac52e86 | fix | insert new commit rows directly after last table row (no stray blank lines) |
| 2026-06-15 | c2c52ea | chore | remove noisy PreToolUse hook; filter PostToolUse in bash before spawning Python |
| 2026-06-15 | 19c3d4d | fix | use temp file in PostToolUse hook to avoid bash variable escaping issues |
| 2026-06-16 | 0fdf824 | fix | drop mimeType from Veo video ref — SDK maps it to encoding field which Veo rejects |
| 2026-06-16 | `fda4186` | docs | sync Obsidian vault — clean Decision-Log rows, remove duplicate deploy entry |
| 2026-06-16 | `09368cc` | fix | upload video reference via Gemini Files API instead of GCS |
| 2026-06-16 | `f28398c` | fix | use {name} not {file} in files.get() — wrong param key crashed formatMap |
| 2026-06-16 | `4c7a434` | fix | restrict video reference to Veo-generated videos only |
| 2026-06-16 | `d5f5a01` | feat | extract last frame from non-Veo videos for image-to-video |
| 2026-06-16 | `f2ddba6` | fix | video playback + use ingredients mode for non-Veo video refs |
| 2026-06-16 | `1e69342` | docs | sync Obsidian vault — video reference fixes, playback, generation mode |
| 2026-06-16 | `5407342` | fix | video thumbnail display + pointer-events on hover buttons |
| 2026-06-16 | `b5a5ad0` | docs | sync Obsidian vault — thumbnail fix deployment log |
| 2026-06-16 | `d393d31` | docs | sync Obsidian vault — deployment log for b5a5ad0 |
| 2026-06-17 | `c547c36` | docs | sync Obsidian vault — pre-deploy docs sync |
| 2026-06-17 | `0ef8a77` | feat | add Extend button to video cards in My Files (SOW-8) |
| 2026-06-17 | `e8d7eaf` | docs | sync Obsidian vault — SOW-8 Extend button complete |
| 2026-06-17 | `222f669` | feat | native 4K resolution for Veo video generation (SOW-4) |
| 2026-06-17 | `6e844ac` | feat | allow 1080p and 4K for all aspect ratios (SOW-4) |
| 2026-06-17 | `fe9cbe5` | fix | retry on transient 503 UNAVAILABLE during Veo polling |
| 2026-06-17 | `e4b0f10` | fix | resolution fallback chain for Veo code 13 errors (SOW-4) |
| 2026-06-17 | `5f22465` | feat | migrate Veo model to veo-3.1-generate-001 GA (SOW-0) |
| 2026-06-17 | `a388441` | fix | remove duplicate let operation declaration crashing Express |
| 2026-06-17 | `05c03fd` | fix | auto-grant default role to trusted domain users on postSignIn |
| 2026-06-17 | `af0a708` | docs | sync Obsidian vault — full session sync Jun 17 2026 |
| 2026-06-18 | —        | fix | Firestore settings/auth corrupted — exceptions stored as JSON string instead of map array; fixed directly in DB |
| 2026-06-18 | —        | fix | Firebase apiKey was empty string in deployed bundle; triggered Cloud Build rebuild to bake config correctly |
| 2026-06-18 | `cbc86e0` | docs | sync Obsidian vault — session sync Jun 18 2026 |
| 2026-06-18 | `2d346d1` | docs | update Authentication.md with postSignIn trusted domain logic and Firestore incident |
| 2026-06-18 | `8b30acd` | docs | sync Decision-Log and Infrastructure with Jun 18 session entries |
| 2026-06-18 | `0c3506e` | docs | add Decision-Log entry for commit 8b30acd |
| 2026-06-18 | —        | chore | save point created — stable state after Jun 18 session |
| 2026-06-18 | —        | research | Veo 3.1 audio capability investigation — native audio generation support confirmed |
| 2026-06-18 | `752a30e` | docs | log save point and Veo 3.1 audio research for Jun 18 session |
| 2026-06-18 | `8d917af` | feat | analyzeReferenceImages — inject Gemini vision analysis into Veo prompt for Ingredients mode |
| 2026-06-18 | `d1c7446` | fix | revert Veo model to veo-3.1-generate-preview — GA model is Vertex AI only |
| 2026-06-18 | `009c5ee` | fix | dual Veo model fallback — try GA (4K) first, fall back to preview on API rejection |
| 2026-06-18 | `b1d7faa` | fix | allow full resolution chain on Veo preview fallback — let resolution step-down handle 4K rejection |
| 2026-06-18 | `939c954` | feat | migrate video generation to Vertex AI SDK for veo-3.1-generate-001 GA + 4K support |
| 2026-06-18 | `b1cb990` | fix | friendly error message for Veo RAI input image rejection (code 3) |
| 2026-06-18 | `9ba7d31` | fix | wire personGeneration into Veo config; default allow_adult for reference image mode |
| 2026-06-18 | `f2e7e84` | fix | Vertex AI video download — handle GCS URI and HTTPS URI from Veo GA response |
| 2026-06-18 | `b166637` | fix | prevent sign-out on deploy restart; fix silent email send failure |
| 2026-06-18 | `9e0899b` | fix | auto-retry without reference images when Veo RAI blocks face photo input |
| 2026-06-18 | `580d03f` | feat | Ingredients to Video workflow UI + fix Vertex AI video download URI detection |
| 2026-06-18 | `2011174` | feat | add camera movement/angle chip panel to video prompt UI |
| 2026-06-18 | `2bba155` | docs | sync Obsidian vault — Jun 18 PM session (Vertex AI, Ingredients UI, camera chips) |
| 2026-06-18 | `1f9ae8d` | docs | hook entries for 2bba155 push |
| 2026-06-18 | `a32acbc` | docs | add SOW_STATUS tracker — full 32-item audit with new additions |
| 2026-06-20 | `14f1c32` | debug | log videoFileRef shape to diagnose download failure |
| 2026-06-21 | `129c5bd` | feat | add My Files picker + fix upload response parsing in Brand Assets |
| 2026-06-21 | `90e786e` | fix | eliminate auth initialization race — isInitialized starts true if auth is ready |
| 2026-06-21 | `07ae1f0` | fix | My Files picker now loads from /api/files correctly |
| 2026-06-21 | `9d392f5` | fix | unwrap generateImages response correctly in Brand Assets |
| 2026-06-21 | `fe6bdf5` | fix | contact sheet shows preview modal before staging, not auto-navigate |

---

## Phase 1 — Foundation (March–May 2026)

The project started as a Dockerised Node/React app for Gemini-based image generation. Early work (May 2026) replaced Google Custom Search (deprecated) with Pexels, then expanded to multi-source search across Pexels, Unsplash, and Pixabay for both images and videos.

## Phase 2 — Video Search & Veo (May 2026)

Video search was wired to a dedicated `/api/search/videos` endpoint. Several quick-fix commits addressed broken video thumbnails, a missing `mediaType` field, and a fatal server crash caused by a duplicate `videoUrl` variable declaration. Veo integration was introduced alongside Gemini model upgrades and the addition of thinking support on `improvePrompt`.

## Phase 3 — Reference Workflows (June 2026)

A major feature arc added reference image/video staging: users can stage assets from search results, uploaded files, previously generated outputs, or brand assets, and those refs are forwarded to Gemini/Veo at generation time. The "Ingredients to Video" workflow specifically uses reference images for character consistency across frames. A frame-extraction feature lets users pull a still from any video to use as an image reference.

## Phase 4 — Reference Workflow Bug Fixes (June 12 2026)

Commit `b024d77` fixed all four reference workflows simultaneously:
- **Search refs**: external URLs were not fetchable by Gemini, so they are now proxied and saved to GCS first via `POST /uploads/save-url`.
- **Generate flow**: switched from GET to POST to avoid URL-length limits; added `referenceImages` array parameter; routes to `remixImagesWithContext` when refs are present.
- **PromptDrawer**: unified generate and remix into a single `handleGenerate` path that always passes staged images as refs.
- **Brand Assets**: added a "Use as reference" (+) button on logo cards.

## Phase 5 — GCS, Veo, and Auth Fixes (June 15 2026)

A cascade of infrastructure and API-contract fixes:

1. **`encodedVideo` not supported by Veo 3.1** (`7a79794`): Veo 3.1 rejects inline video bytes entirely. First workaround: skip video refs and use only image refs (extracted frames still work as image-to-video starters).
2. **GCS URI as the correct Veo video input** (`d21a270`, merged as `c5a0ba8`): The proper solution — download the video ref, upload it to GCS, and pass the `gs://` URI to Veo. Falls back with a warning when GCS is not configured.
3. **`referenceImageUrls` vs `imageUrl`** (`803fd91`): Image refs were being sent as `imageUrl` (the Veo "start frame" field), which locked the first frame but let the rest of the video drift from the prompt. Switching to `referenceImageUrls` treats the image as a style/character reference throughout the clip.
4. **Hardcoded `GCS_BUCKET` in Dockerfile** (`e167185`): A `export GCS_BUCKET=...` line baked into the Dockerfile startup script was silently overriding the Cloud Run environment variable, routing all storage writes to the wrong bucket.
5. **Firebase auth silent failure in production** (`576ab1a`): Create React App bakes `REACT_APP_*` vars at build time, not runtime. The vars were not passed during the Docker build step in `cloudbuild.yaml`, so Firebase never initialised and both email-link and Google sign-in silently failed. Fixed by forwarding `--build-arg` values in `cloudbuild.yaml` and exposing them as `ARG`/`ENV` in the Dockerfile.

## Phase 6 — Vertex AI Migration, Ingredients UI, and Camera Controls (June 18 2026)

A major capability and UX session:

1. **`analyzeReferenceImages`** (`8d917af`): New method on `GeminiService` that passes up to 3 staged reference images to `gemini-3.5-flash` (text model with vision) and returns a compact visual description. The description is injected into the Veo prompt as `"Reference subject details: ..."` for better character/scene consistency. Uses `MODELS.text`, not the image model (Nano Banana).

2. **Vertex AI migration for Veo GA** (`939c954`): `veo-3.1-generate-001` GA is Vertex AI only — it returns a 404 on the Gemini Developer API. The fix initialises a second `GoogleGenAI` client with `{ vertexai: true, project: GCP_PROJECT_ID, location: GCP_LOCATION }`. Video generation uses this client when `GCP_PROJECT_ID` is set; falls back to Developer API + `veo-3.1-generate-preview` for local dev. No infrastructure changes needed — `GCP_PROJECT_ID` was already set as a Cloud Run env var and the service account already had `roles/aiplatform.user`.

3. **Vertex AI video download** (`f2e7e84`, `580d03f`): Vertex AI returns a GCS URI (`gs://...`) not a Files API reference. The download handler was extended to detect URI type and route accordingly: GCS URI → `@google-cloud/storage` SDK download; HTTPS URI → axios stream; fallback → `genAI.files.download`. Commit `580d03f` further hardened this with `extractVideoUri()` — checks all known field names (`uri`, `videoUri`, `downloadUri`, `gcsUri`, `fileUri`, `name`) plus a one-level deep object scan, and logs the full `videoFileRef` shape for debugging future API changes.

4. **`personGeneration` wiring** (`9ba7d31`): The param was being read from request body but never added to `requestParams.config`. Now included. Auto-defaults to `allow_adult` when reference images are present.

5. **Veo RAI face photo block + auto-retry** (`9e0899b`): `veo-3.1-generate-001` blocks real human face photos as Ingredients INPUT (anti-deepfake policy, operation error code 3). Cannot be bypassed with `personGeneration`. Auto-retry implemented: on code 3, strips all referenceImages from config and retries as text-to-video using the visual description already extracted by `analyzeReferenceImages`. User sees a warning but gets a video. Clean workaround: generate the person with Nano Banana first, then use the AI-generated image as ingredient.

6. **Firebase sign-out on deploy restart** (`b166637`): `postSignIn` was returning 5xx during Cloud Run cold start after deploy, which triggered `firebaseSignOut`. Fixed — only 401/403 sign the user out; 5xx and network errors log a warning and keep the session. Also fixed `signInWithEmail` silently returning when Firebase not initialised — now sets a visible error message.

7. **Ingredients to Video workflow UI** (`580d03f`): PromptDrawer gains three video sub-mode tabs — **Standard / Ingredients / Extend**. In Ingredients mode, three labeled slots (Character, Product, Scene) each support upload or AI generation via Nano Banana. Per-slot prompts call `generateImages()` (1×1:1 image), fill the slot thumbnail, and add a workspace row. Filled slot URLs become `referenceImageUrls` sent to Veo. In Extend mode, the UI shows whether a Veo video is staged and routes to scene extension.

8. **Camera chip panel** (`2011174`): Collapsible Camera section below the negative prompt field in video + create mode. Three chip groups: Movement (13 options including static, zoom, dolly, pan, tracking, handheld, aerial), Angle (7 options), Shot (5 options). Selected chips are appended to the final prompt string at generation time — the prompt textarea stays clean. Active chip count shown as a badge on the collapsed header.

## SOW Completion (as of 2026-06-18)

4 of 32 SOW items complete (13%) + 6 new additions beyond original scope. See [[SOW_STATUS]] for full tracker.

Done: SOW-0 (Veo GA migration), SOW-2 (Ingredients + analyzeReferenceImages), SOW-4 (4K resolution), SOW-8 (video scene extension).
Partial: SOW-7 (staging works; GCS metadata tagging missing).
New additions: Ingredients UI, Camera chips, RAI auto-retry, Vertex AI download hardening, Firebase session resilience, personGeneration wiring.

## Key Decisions
- Use GCS URI (gs://) instead of inline encodedVideo bytes when passing video references to Veo 3.1 — the API rejects encodedVideo with INVALID_ARGUMENT; GCS URI is the only supported video input method.
- Use referenceImageUrls (style/character reference array) instead of imageUrl (start-frame field) when forwarding staged image refs to Veo video generation, so the reference influences the whole clip rather than locking just the first frame.
- Proxy external search-result URLs through POST /uploads/save-url before staging them as references, because Gemini cannot reliably fetch arbitrary third-party URLs — GCS-hosted copies are always accessible.
- Switch the /generate route from GET to POST to avoid HTTP URL-length limits when reference image arrays are included in the request.
- REACT_APP_FIREBASE_* environment variables must be injected at Docker build time (not runtime) because Create React App inlines them during the webpack build — passing them only as Cloud Run env vars means Firebase never initialises.
- Remove any hardcoded GCS_BUCKET export from the Dockerfile startup script — baked-in values silently override Cloud Run environment variables and route storage writes to the wrong bucket.
- Extracted video frames (images) are the recommended path for image-to-video character consistency; raw video refs are supported via GCS URI but treated as style references, not frame-accurate controls.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/gemini.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/generate.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/uploads.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/PromptDrawer.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/Workspace.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/pages/MyFilesPage.jsx`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/pages/BrandAssetsPage.jsx`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/services/api.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/Dockerfile`
- `/home/angieng/CloudAceSG/Projects/gen_media/cloudbuild.yaml`

## Related
- [[Veo 3.1 API contract — supported input types (GCS URI vs encodedVideo vs imageUrl vs referenceImageUrls)]]
- [[Google Cloud Storage as media relay for Vertex AI / Gemini API calls]]
- [[Create React App build-time vs runtime environment variables]]
- [[Cloud Run environment variable precedence vs Dockerfile ENV/ARG]]
- [[Multi-source media search (Pexels, Unsplash, Pixabay) aggregation]]
- [[Reference image workflows for character consistency in video generation]]
- [[Firebase authentication initialisation in containerised React apps]]
