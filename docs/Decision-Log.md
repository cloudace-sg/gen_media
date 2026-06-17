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
| 2026-06-17 | `05c03fd` | fix | auto-grant default role to trusted domain users on postSignIn |

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
