# Gen Media AI Studio — Statement of Work (SOW)

## Project Overview

**Project Name:** Gen Media AI Studio — Platform Enhancement Program
**Client Trial:** Abbott Medical (ends June 9, 2026)
**Platform:** React + Express.js on Google Cloud Run
**AI Stack:** Google Gemini API (image/text) + VEO 3.1 (video)

---

## Scope of Work

### Phase 1: Core Quality & Accuracy Fixes

**Objective:** Resolve Abbott's highest-priority feedback — output quality (3/5 satisfaction, 3-4 attempts needed) and reference image accuracy.

---

#### SOW-0: VEO Endpoint Migration (Prerequisite)

**Description:**
Migrate the video generation model string from the deprecated `veo-3.1-generate-preview` to the GA release `veo-3.1-generate-001`. This is a prerequisite for all other work — the preview endpoint was deprecated April 2, 2026, and may stop functioning at any time.

**Deliverables:**
- Update model string in `server/src/services/gemini.js`
- Update Gemini text/image model strings to `gemini-3.1-flash` and `gemini-3.1-flash-image-preview`
- Regression test: text-to-video, image-to-video, and text-to-image all produce output
- Deploy to Cloud Run and verify production functionality

**Files Modified:**
- `server/src/services/gemini.js` (3 model string changes)

**Effort:** 0.5 days
**Dependencies:** None
**Risk:** If GA model is not enabled on GCP project, requires Vertex AI Model Garden activation.

---

#### SOW-1: Automatic Quality Loop (The Director)

**Description:**
Implement an automated generation-review-retry loop that produces the best possible output without user intervention. After the user hits Generate, the system:
1. Enriches the prompt using Gemini (text model)
2. Generates the video using VEO 3.1
3. Extracts a representative frame from the generated video
4. Scores the frame against the original prompt and reference images using Gemini vision
5. If quality score is below threshold (configurable, default 7/10), refines the prompt based on the scoring reason and retries (max 2 auto-retries)
6. Returns only the highest-scoring result to the user

The prompt enrichment method (`rewritePromptForImageTask`) already exists in the codebase but is not called for video generation. Wiring it in is the single highest-impact change.

**Deliverables:**
- New method: `scoreGeneratedOutput(frame, prompt, references)` in GeminiService
- New method: `refinePromptFromScore(originalPrompt, scoreReason)` in GeminiService
- Modified method: `generateVideoVeo3()` wrapped in retry loop
- ffmpeg integration for frame extraction from generated video
- Configurable quality threshold via environment variable (`QUALITY_THRESHOLD=7`)
- Logging: all attempts, scores, and refinements logged for debugging
- UI: progress indicator shows "Generating..." → "Reviewing..." → "Refining..." (optional)

**Files Modified:**
- `server/src/services/gemini.js` (add scoring + refinement methods, wrap video generation)
- `server/src/routes/video.js` (pass references to generation method)
- `Dockerfile` (add ffmpeg: `RUN apk add --no-cache ffmpeg`)
- `client/src/components/PromptDrawer.js` (optional: progress state)

**Effort:** 4 days
- Day 1: Frame extraction + scoring method implementation
- Day 2: Prompt refinement method + retry loop logic
- Day 3: Wire into video route, connect existing prompt enrichment
- Day 4: Testing, threshold tuning, edge cases (RAI filtering, timeouts)

**Dependencies:** SOW-0 (model migration)
**Risk:** Video generation takes 2-5 minutes per attempt. With 2 retries, worst case is 15 minutes. UI must handle long-running operations gracefully.

---

#### SOW-2: Reference Image Accuracy (VEO 3.1 Ingredients API)

**Description:**
Enable users to pass up to 3 reference images as visual "ingredients" that VEO 3.1 preserves in the generated video. Currently only 1 image is passed as a starting frame — the remaining images are ignored entirely.

Additionally, before generation begins, Gemini vision analyzes each reference image and extracts: subject description, dominant colors, spatial composition, key textures, and notable elements. These are automatically injected into the enriched prompt to reinforce accuracy.

**Deliverables:**
- Modified method: `generateVideoVeo3()` accepts array of reference images (up to 3)
- Each reference passed via VEO API `referenceImages` parameter with `referenceType: "asset"`
- New method: `analyzeReferenceImages(images)` — Gemini vision extracts visual details
- Extracted details injected into the generation prompt before VEO call
- Frontend: multiple image selection in "Refs" panel passes all selected to video route
- Support for both image URLs and base64 data as reference input

**Files Modified:**
- `server/src/services/gemini.js` (add reference analysis, modify `generateVideoVeo3` signature)
- `server/src/routes/video.js` (accept `referenceImages[]` array in request body)
- `client/src/components/PromptDrawer.js` (pass all staged images to video generation API)
- `client/src/services/api.js` (update `generateVideo` function signature)

**Effort:** 2 days
- Day 1: Backend — reference analysis method + VEO referenceImages integration
- Day 2: Frontend — wire staged images to video API, test multi-reference generation

**Dependencies:** SOW-0 (model migration)
**Risk:** The `@google/genai` Node.js SDK may not yet support `referenceImages` parameter in `generateVideos()`. Fallback: call Vertex AI REST API directly. Add 0.5 days if fallback needed.

---

#### SOW-3: Multiple Output Variations

**Description:**
Enable generation of 2-4 video variations simultaneously in a single API call using VEO 3.1's `sampleCount` parameter. The user sees multiple options side by side and selects the best one.

**Deliverables:**
- Backend: pass `sampleCount` parameter (1-4) to VEO API
- Backend: return all generated videos in response (not just first)
- Backend: upload all variations to GCS (with variation index in filename)
- Frontend: video count selector (1/2/3/4) in Generation Settings
- Frontend: display multiple video results in a grid layout
- Frontend: "Select" action on each variation to choose winner

**Files Modified:**
- `server/src/services/gemini.js` (pass `sampleCount` to API, return all videos)
- `server/src/routes/video.js` (process and upload multiple results)
- `client/src/components/PromptDrawer.js` (add count selector, handle multiple results)
- `client/src/store/useStore.js` (store multiple video results per generation)

**Effort:** 1 day
- Morning: Backend param + multi-result handling
- Afternoon: Frontend selector + grid display

**Dependencies:** SOW-0 (model migration)
**Risk:** Cost increases linearly (4 videos = 4x cost per generation). May need per-user quotas.

---

#### SOW-4: Native 4K Resolution

**Description:**
Add 4K resolution option for video generation. VEO 3.1 GA natively supports `resolution: "4k"` as a parameter. This requires no post-processing or external upscaling service.

**Deliverables:**
- Backend: pass `resolution` parameter ("720p" / "1080p" / "4k") to VEO API
- Remove current restriction that limits 1080p to 16:9 only
- Frontend: add "4K" option to Resolution dropdown in Generation Settings
- Display resolution label on generated video card

**Files Modified:**
- `server/src/services/gemini.js` (update resolution parameter logic, line 371)
- `client/src/components/PromptDrawer.js` (add 4K option to resolution selector)

**Effort:** 0.5 days

**Dependencies:** SOW-0 (model migration)
**Risk:** 4K generation may take longer (5-8 min vs 2-5 min for 720p). Ensure timeout is sufficient (already 15 min max).

---

#### SOW-5: Native Audio UI Field

**Description:**
VEO 3.1 generates synchronized audio (dialogue, SFX, ambient sound) natively when audio is described in the prompt. This capability already works but is not surfaced in the UI. Users don't know they can specify audio. This improvement adds a dedicated audio description field with examples.

**Deliverables:**
- Frontend: new "Audio & Sound" text field below the main prompt in video mode
- Frontend: placeholder examples: "Upbeat background music", "Product click sounds", "Narrator voice explaining features"
- Backend: concatenate audio description into the main prompt before sending to VEO (e.g., "Audio: {description}")
- Frontend: toggle to enable/disable audio generation (some users may want silent video)

**Files Modified:**
- `client/src/components/PromptDrawer.js` (add audio field, wire into prompt)
- `server/src/routes/video.js` (accept audioDescription in body, append to prompt)

**Effort:** 0.5 days

**Dependencies:** SOW-0 (model migration)
**Risk:** None — audio generation is already active. This is purely a UX improvement.

---

#### SOW-6: Layout-Aware Generation

**Description:**
Add prompt engineering support for generating images/videos with intentional negative space for text overlay. Marketing collaterals always combine visuals + copy — currently every generated image fills the entire frame, requiring post-production to add text.

**Deliverables:**
- Frontend: "Text-safe zone" toggle/selector with options: "Left third clear", "Right third clear", "Bottom 30% clear", "Top 30% clear", "Center focus with border space"
- Backend: selected layout instruction appended to generation prompt (e.g., "Compose the image with the main subject on the left side, leaving the right third of the frame as clean negative space suitable for text overlay")
- Visual indicator: dashed overlay on generated image showing suggested text placement zone
- Works for both image and video generation

**Files Modified:**
- `client/src/components/PromptDrawer.js` (layout selector UI)
- `server/src/routes/generate.js` (append layout instruction to prompt)
- `server/src/routes/video.js` (append layout instruction to prompt)
- `client/src/components/ImageGrid.js` or workspace component (overlay indicator)

**Effort:** 1.5 days
- Day 1: Backend prompt engineering + frontend selector
- Day 1.5: Visual overlay indicator + testing

**Dependencies:** None
**Risk:** AI may not always respect layout instructions perfectly. Mitigate with strong prompt engineering and quality loop scoring.

---

### Phase 1 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-0 | Veo endpoint migration | 0.5d |
| SOW-1 | Automatic quality loop (Director) | 4d |
| SOW-2 | Reference image accuracy (Ingredients) | 2d |
| SOW-3 | Multiple output variations | 1d |
| SOW-4 | Native 4K resolution | 0.5d |
| SOW-5 | Native audio UI field | 0.5d |
| SOW-6 | Layout-aware generation | 1.5d |
| **Total** | | **10 days** |

---

### Phase 2: Workflow & Creative Intelligence

**Objective:** Eliminate workflow friction, add brand intelligence, and surface creative insights.

---

#### SOW-7: Video as Reference (No Download/Re-upload)

**Description:**
Every generated asset (image or video) is tagged at creation time with its original prompt, generation settings, model version, and style used — stored as custom metadata in Google Cloud Storage. In the My Files library, each card displays the original prompt as its label. A "Use as Reference" button instantly pushes the asset into the Creative Controls reference panel and navigates to the generation page.

**Deliverables:**
- Backend: write custom metadata (prompt, style, aspectRatio, model) to GCS objects at upload time
- Backend: update `/api/files` endpoint to return metadata alongside file listing
- Frontend: display prompt/title on My Files cards instead of raw filenames
- Frontend: "Use as Reference" button on each card
- Frontend: Zustand store action to push My Files asset into staged references
- Frontend: auto-navigate to canvas/generate page after staging

**Files Modified:**
- `server/src/services/storage.js` (add metadata parameter to uploadBuffer/uploadFile)
- `server/src/routes/generate.js` (pass prompt metadata at upload)
- `server/src/routes/video.js` (pass prompt metadata at upload)
- `server/src/routes/files.js` (return metadata in listing response)
- `client/src/pages/MyFilesPage.jsx` (display metadata, add "Use as Reference" button)
- `client/src/store/useStore.js` (add action to stage from My Files)

**Effort:** 3 days
- Day 1: Backend metadata tagging + files API update
- Day 2: Frontend My Files card redesign + "Use as Reference" action
- Day 3: Store integration, navigation, testing

**Dependencies:** None
**Risk:** Existing files in GCS won't have metadata. Handle gracefully (show filename if no metadata).

---

#### SOW-8: Video Scene Extension (Clip Chaining)

**Description:**
Users can extend any previously generated video. The system extracts the final frame using ffmpeg, then passes it as the input image to VEO 3.1 (image-to-video), producing a seamless visual continuation. Users can chain multiple clips to build 30-60 second sequences.

**Deliverables:**
- Backend: new endpoint `POST /api/video/extend` accepting: source video URL + continuation prompt
- Backend: ffmpeg extracts last frame from source video → saves as temp PNG
- Backend: passes extracted frame to VEO as `imageUrl` for image-to-video generation
- Backend: uploads resulting clip to GCS, tagged with parent video reference
- Frontend: "Extend" button on video cards in My Files and workspace
- Frontend: prompt field for continuation description

**Files Modified:**
- `server/src/routes/video.js` (add `/extend` endpoint)
- `server/src/services/gemini.js` (reuse existing image-to-video path)
- `Dockerfile` (ffmpeg already added in SOW-1)
- `client/src/pages/MyFilesPage.jsx` (add "Extend" button)
- `client/src/components/PromptDrawer.js` or new ExtendDialog component

**Effort:** 2 days
- Day 1: Backend ffmpeg frame extraction + extend endpoint
- Day 2: Frontend "Extend" UX + testing chained clips

**Dependencies:** SOW-1 (ffmpeg in Docker), SOW-7 (My Files with metadata)
**Risk:** Visual continuity between clips depends on prompt quality. The Director quality loop from SOW-1 can be applied here too.

---

#### SOW-9: Golden Prompts Library

**Description:**
Allow users to save successful prompts as reusable, tagged templates. Shared across the team within a workspace. One-click to regenerate with new context.

**Deliverables:**
- Backend: new route `GET/POST/DELETE /api/prompts/library`
- Backend: storage in GCS as JSON file per workspace (or per user in dev)
- Backend: schema: `{ id, prompt, negativePrompt, style, tags[], category, createdBy, createdAt, usageCount }`
- Frontend: "Save Prompt" button after successful generation
- Frontend: "Library" tab in Creative Controls showing saved prompts
- Frontend: filter/search by tags, sort by usage count
- Frontend: "Use This" button that populates all generation fields

**Files Modified:**
- New file: `server/src/routes/promptLibrary.js`
- `server/src/index.js` (register new route)
- `client/src/components/PromptDrawer.js` (add Save button + Library tab)
- `client/src/services/api.js` (add prompt library API calls)

**Effort:** 2 days
- Day 1: Backend CRUD + storage
- Day 2: Frontend library UI + save/use flow

**Dependencies:** None
**Risk:** None — self-contained feature.

---

#### SOW-10: Automated Brand Profile Detection

**Description:**
User pastes their company website URL → Gemini with Google Search grounding analyzes the page and automatically extracts: primary color palette (hex codes), typography style, visual tone (modern/classic/playful/corporate), and brand mood descriptors. Results are saved as the active Brand Profile and automatically injected into every subsequent generation prompt.

**Deliverables:**
- Backend: new endpoint `POST /api/brandkit/detect` accepting: `{ url: string }`
- Backend: Gemini + Google Search grounding fetches and analyzes URL
- Backend: structured extraction prompt returns JSON: `{ colors: string[], font: string, tone: string, mood: string[], description: string }`
- Backend: saves detected profile to existing brand kit storage
- Frontend: "Detect from URL" button on Brand Assets page
- Frontend: review/edit detected values before saving
- Frontend: visual preview of detected palette

**Files Modified:**
- `server/src/routes/brandkit.js` (add `/detect` endpoint)
- `server/src/services/gemini.js` (add `detectBrandFromUrl()` method)
- `server/src/services/brandkit.js` (save detected profile)
- `client/src/pages/BrandPage.jsx` or equivalent (add detection UI)
- `client/src/services/api.js` (add brand detection API call)

**Effort:** 2.5 days
- Day 1: Backend Gemini grounding + extraction prompt
- Day 2: Frontend detection UI + review flow
- Day 2.5: Integration with existing brand kit system, testing

**Dependencies:** Google Search grounding enabled on API key
**Risk:** URL analysis quality varies. Some websites may not yield useful brand data. Provide manual override for all detected fields.

---

#### SOW-11: Reverse-Engineer to Prompt

**Description:**
User uploads any image or video → AI generates the exact prompt and style settings that would recreate something similar. One-click to generate a new version.

**Deliverables:**
- Backend: new endpoint `POST /api/prompt/reverse` accepting image (base64 or URL)
- Backend: Gemini vision analyzes the content and produces: suggested prompt, style preset match, aspect ratio, mood descriptors
- Frontend: "Recreate This" button available when viewing any image (uploaded, searched, or generated)
- Frontend: populates all Creative Controls fields from the analysis
- Frontend: user can edit before generating

**Files Modified:**
- `server/src/routes/prompt.js` (add `/reverse` endpoint)
- `server/src/services/gemini.js` (add `reverseEngineerPrompt()` method)
- `client/src/components/ImageGrid.js` or workspace component (add "Recreate" action)
- `client/src/services/api.js` (add reverse-engineer API call)

**Effort:** 1.5 days
- Day 1: Backend vision analysis + prompt generation
- Day 1.5: Frontend "Recreate" button + field population

**Dependencies:** None
**Risk:** None — leverages existing Gemini vision capabilities.

---

#### SOW-12: A/B Output Comparison View

**Description:**
When multiple variations are generated (from SOW-3), display them in a side-by-side comparison view. User can toggle between variations, zoom in, and select the winner with one click.

**Deliverables:**
- Frontend: comparison layout (2-up or 4-up grid) for multi-result generations
- Frontend: highlight/select winner action
- Frontend: "Compare" button to toggle between grid and comparison view
- Frontend: keyboard shortcuts (1/2/3/4 to select, arrow keys to navigate)
- Selected winner is the one that gets added to workspace / stored as primary

**Files Modified:**
- New file: `client/src/components/ComparisonView.js`
- `client/src/components/PromptDrawer.js` or workspace (render comparison on multi-result)
- `client/src/store/useStore.js` (track selected variation)

**Effort:** 1 day

**Dependencies:** SOW-3 (multiple variations)
**Risk:** None — frontend-only feature.

---

### Phase 2 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-7 | Video as reference (no download) | 3d |
| SOW-8 | Video scene extension | 2d |
| SOW-9 | Golden prompts library | 2d |
| SOW-10 | Automated brand profile detection | 2.5d |
| SOW-11 | Reverse-engineer to prompt | 1.5d |
| SOW-12 | A/B comparison view | 1d |
| **Total** | | **12 days** |

---

### Phase 3: Product Marketing Power Tools

**Objective:** Transform the platform from generic image/video generator into a purpose-built product marketing collateral machine.

---

#### SOW-13: Product Photo Studio

**Description:**
Upload a product photo (any background) → AI removes the background and composites the product into professional marketing scenes. User selects from preset scene types or describes a custom scene.

**Deliverables:**
- Backend: new endpoint `POST /api/generate/product-studio`
- Backend: Gemini Flash Image removes background / isolates product
- Backend: composites product into scene via image-to-image generation with scene prompt
- Backend: preset scenes library: "studio white", "lifestyle desk", "in-hand", "clinical environment", "retail shelf", "outdoor natural", "flat lay"
- Frontend: "Product Studio" mode in Creative Controls
- Frontend: product upload area + scene selector + custom scene prompt
- Frontend: display multiple scene results

**Files Modified:**
- New file: `server/src/routes/productStudio.js`
- `server/src/index.js` (register route)
- `server/src/services/gemini.js` (add product isolation + scene composition methods)
- New file: `client/src/components/ProductStudioMode.js`
- `client/src/services/api.js` (add product studio API calls)

**Effort:** 3 days
- Day 1: Backend product isolation + scene composition pipeline
- Day 2: Frontend product studio UI + scene selector
- Day 3: Preset scene library, testing, edge cases

**Dependencies:** Model migration (SOW-0)
**Risk:** Background removal quality varies with product complexity. Some products (glass, transparent items) are harder to isolate.

---

#### SOW-14: Product Consistency Lock

**Description:**
Upload a product photo once → platform stores it as a permanent "product asset." Every future generation referencing that product uses the VEO Ingredients API to maintain exact appearance. Additionally, after generation, AI compares the generated product vs. the original and scores accuracy.

**Deliverables:**
- Backend: product asset registry — stored in GCS with metadata: product name, category, original image, extracted features
- Backend: `POST /api/products` to register new product
- Backend: `GET /api/products` to list registered products
- Backend: registered products automatically included in `referenceImages` when referenced in prompt
- Backend: post-generation accuracy comparison method
- Frontend: "Products" management page
- Frontend: product selector in Creative Controls
- Frontend: accuracy score displayed on generated output

**Files Modified:**
- New file: `server/src/routes/products.js`
- `server/src/index.js` (register route)
- `server/src/services/gemini.js` (add product accuracy scoring)
- `server/src/routes/generate.js` (auto-include product references)
- `server/src/routes/video.js` (auto-include product references)
- New file: `client/src/pages/ProductsPage.jsx`
- `client/src/components/PromptDrawer.js` (product selector)

**Effort:** 3 days
- Day 1: Backend product registry + auto-reference inclusion
- Day 2: Frontend products page + selector integration
- Day 3: Accuracy scoring + display, testing

**Dependencies:** SOW-2 (Ingredients API)
**Risk:** Product appearance consistency depends on VEO reference image handling quality.

---

#### SOW-15: Multi-Format Campaign Export

**Description:**
Generate one hero image → platform automatically produces all required format variations: 1:1, 9:16, 4:5, 16:9, 1.91:1 — with AI-aware subject repositioning (not just dumb cropping).

**Deliverables:**
- Backend: new endpoint `POST /api/export/multi-format` accepting source image + desired formats
- Backend: Gemini vision identifies main subject position and boundaries
- Backend: Sharp performs intelligent crop/resize keeping subject in optimal position per format
- Backend: for extreme ratio changes, regenerate with same prompt + new aspect ratio
- Backend: return all format URLs in response
- Frontend: "Export All Formats" button on any generated image
- Frontend: format checklist (Instagram Feed, Story, Facebook, LinkedIn, YouTube, Display)
- Frontend: preview all formats before download
- Frontend: batch download as ZIP

**Files Modified:**
- New file: `server/src/routes/export.js`
- `server/src/index.js` (register route)
- `server/src/services/gemini.js` (add subject detection for crop guidance)
- New file: `client/src/components/MultiFormatExport.js`
- `client/src/services/api.js` (add export API calls)

**Effort:** 2 days
- Day 1: Backend subject detection + intelligent crop/resize pipeline
- Day 2: Frontend format selector + preview + download

**Dependencies:** None (Sharp already installed)
**Risk:** AI-guided cropping may occasionally cut off important elements. Provide manual adjustment option.

---

#### SOW-16: Text & CTA Overlay Editor

**Description:**
After generating an image, add marketing copy directly on the canvas: headlines, subheadlines, CTA buttons, product names, prices — using brand fonts with smart positioning suggestions.

**Deliverables:**
- Frontend: text overlay mode activated on any generated image
- Frontend: text layers with controls: font (from brand kit), size, color, position, alignment, shadow/outline
- Frontend: CTA button element with rounded rect background + text
- Frontend: drag-to-position on canvas (Konva.js — already installed)
- Frontend: AI suggestion: "Recommended text placement: top-left for this composition" (from Gemini vision)
- Frontend: export with text burned into final image (canvas → PNG)
- Backend: Gemini vision analyzes image and suggests optimal text placement zones

**Files Modified:**
- New file: `client/src/components/TextOverlayEditor.js`
- `client/src/components/editor/CanvasEditor.js` (integrate text layer tools)
- `server/src/routes/generate.js` or new endpoint (text placement suggestion)
- `client/src/services/api.js` (text suggestion API call)

**Effort:** 4 days
- Day 1: Konva text layer implementation + basic positioning
- Day 2: Font/style controls + CTA button element
- Day 3: AI placement suggestion + export with text
- Day 4: Testing, edge cases, responsive handling

**Dependencies:** None (Konva already in stack)
**Risk:** Font rendering consistency across browsers. Use web-safe fonts or load brand fonts via CSS.

---

#### SOW-17: Product Line Variations

**Description:**
User has one approved creative concept and a product line (e.g., 5 different models). Platform generates the same composition with the same style but swaps the product in each variation.

**Deliverables:**
- Backend: new endpoint `POST /api/generate/product-line` accepting: base prompt, style settings, array of product IDs
- Backend: for each product, includes its registered reference image (from SOW-14) and generates with identical prompt + style
- Backend: all variations generated in parallel
- Frontend: "Generate for Product Line" button when products are registered
- Frontend: product line selector (checkboxes for registered products)
- Frontend: results displayed as a grid grouped by product

**Files Modified:**
- `server/src/routes/generate.js` (add product-line endpoint)
- `client/src/components/PromptDrawer.js` (product line selector)
- `client/src/pages/ProductsPage.jsx` (batch generate action)

**Effort:** 2 days
- Day 1: Backend parallel generation for multiple products
- Day 2: Frontend product line selector + results grid

**Dependencies:** SOW-14 (product registry)
**Risk:** Parallel generation may hit API rate limits. Implement sequential fallback with progress indicator.

---

### Phase 3 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-13 | Product photo studio | 3d |
| SOW-14 | Product consistency lock | 3d |
| SOW-15 | Multi-format campaign export | 2d |
| SOW-16 | Text & CTA overlay editor | 4d |
| SOW-17 | Product line variations | 2d |
| **Total** | | **14 days** |

---

### Phase 4: Scale & Automation

**Objective:** Enable batch production workflows and targeted editing for enterprise-scale content operations.

---

#### SOW-18: Campaign Brief → All Assets

**Description:**
Structured campaign intake form that generates a complete asset set from a single brief: hero image, social media variations, product video, and email header — all matching one creative concept.

**Deliverables:**
- Frontend: structured brief form: product, key message, target audience, channels (checkboxes), visual tone, CTA
- Backend: new endpoint `POST /api/campaigns/generate` that orchestrates multiple generation calls
- Backend: generates assets based on selected channels: hero (16:9), Instagram (1:1), Story (9:16), Facebook (4:5), video (16:9), email header (600x200)
- Backend: all assets share same style/prompt base but optimized per format
- Frontend: campaign results page showing all generated assets grouped by channel
- Frontend: bulk download all assets as ZIP

**Files Modified:**
- New file: `server/src/routes/campaigns.js`
- `server/src/index.js` (register route)
- New file: `client/src/pages/CampaignBriefPage.jsx`
- New file: `client/src/components/CampaignResults.js`
- `client/src/routes/AppRoutes.js` (add campaign route)
- `client/src/services/api.js` (add campaign API)

**Effort:** 4 days
- Day 1: Backend campaign orchestration + multi-format generation
- Day 2: Frontend brief form UI
- Day 3: Frontend results page + asset grid
- Day 4: ZIP download, error handling, progress tracking

**Dependencies:** SOW-6 (layout-aware), SOW-4 (resolution options)
**Risk:** Long generation time for full campaign set (5+ assets). Implement streaming progress updates via polling.

---

#### SOW-19: Bulk Variation Generator

**Description:**
User provides one base prompt + a variable matrix (e.g., 5 products × 3 taglines × 2 backgrounds). Platform generates all combinations automatically, tagged for A/B testing.

**Deliverables:**
- Backend: new endpoint `POST /api/generate/batch` accepting: basePrompt, variables (array of arrays)
- Backend: generates all permutations sequentially (with configurable concurrency)
- Backend: tags each output with its variable combination in GCS metadata
- Backend: returns results grouped by variable axis
- Frontend: variable matrix builder (add rows: "Products: A, B, C", "Backgrounds: white, outdoor, clinical")
- Frontend: progress bar showing N/total generated
- Frontend: results grid with filter by variable

**Files Modified:**
- New file: `server/src/routes/batch.js`
- `server/src/index.js` (register route)
- New file: `client/src/pages/BatchGeneratePage.jsx`
- `client/src/routes/AppRoutes.js` (add batch route)
- `client/src/services/api.js` (add batch API)

**Effort:** 3 days
- Day 1: Backend batch generation logic + variable permutation
- Day 2: Frontend matrix builder UI
- Day 3: Progress tracking + results display + filtering

**Dependencies:** None
**Risk:** Large matrices (50+ permutations) will take significant time and cost. Add cost estimate before generation starts.

---

#### SOW-20: A/B Ad Variation Generator

**Description:**
From one approved creative concept, auto-generate testable variations by varying specific elements: background color/scene, text position, CTA copy, color accent. Each variation is tagged for performance tracking.

**Deliverables:**
- Backend: variation generation using prompt modifications for each axis
- Backend: variations tagged with axis labels: "bg_dark", "bg_light", "cta_top", "cta_bottom", etc.
- Frontend: "Generate A/B Variants" button on any approved creative
- Frontend: axis selector (which elements to vary)
- Frontend: variation grid with labels
- Frontend: export variants as an ad set (ZIP with manifest CSV for ad platforms)

**Files Modified:**
- `server/src/routes/generate.js` (add variation endpoint)
- New file: `client/src/components/ABVariationPanel.js`
- `client/src/services/api.js` (add variation API)

**Effort:** 3 days
- Day 1: Backend variation prompt engineering + tagging
- Day 2: Frontend axis selector + variation grid
- Day 3: Export with manifest, testing

**Dependencies:** SOW-3 (multiple variations infrastructure)
**Risk:** None — builds on existing multi-generation capabilities.

---

#### SOW-21: Regional Re-Generation (In-painting)

**Description:**
User draws a highlight region on a generated video frame → types a correction prompt (e.g., "replace with our product logo") → Nano Banana 2 inpaints only the selected region → corrected frame is fed back to VEO 3.1 as starting frame for targeted regeneration.

**Deliverables:**
- Frontend: mask drawing overlay on video frame (Konva.js freeform brush)
- Frontend: frame selector (scrub video to choose which frame to correct)
- Backend: `POST /api/video/inpaint` accepting: frame image, mask, correction prompt
- Backend: Nano Banana 2 (gemini-3.1-flash-image-preview) applies masked inpainting
- Backend: corrected frame passed to VEO as `imageUrl` for regeneration
- Backend: resulting video replaces original in GCS

**Files Modified:**
- New file: `client/src/components/InpaintingEditor.js`
- `server/src/routes/video.js` (add `/inpaint` endpoint)
- `server/src/services/gemini.js` (add `inpaintFrame()` method using Nano Banana 2)
- `Dockerfile` (ffmpeg already present for frame extraction)

**Effort:** 5 days
- Day 1: Backend inpainting method + endpoint
- Day 2: Frontend Konva mask drawing tool
- Day 3: Frame extraction from video + frame selector UI
- Day 4: Full pipeline integration (draw → inpaint → regenerate)
- Day 5: Testing, edge cases, UX polish

**Dependencies:** SOW-0 (model migration to Nano Banana 2), SOW-1 (ffmpeg in Docker)
**Risk:** Most complex feature in the roadmap. Konva mask quality affects inpainting results. May need mask refinement step.

---

### Phase 4 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-18 | Campaign brief → all assets | 4d |
| SOW-19 | Bulk variation generator | 3d |
| SOW-20 | A/B ad variation generator | 3d |
| SOW-21 | Regional re-generation (in-painting) | 5d |
| **Total** | | **15 days** |

---

### Phase 5: Content Intelligence & Trend Agent

**Objective:** Add visual understanding and proactive creative intelligence to the platform.

---

#### SOW-22: Upload & Analyze Any Content

**Description:**
User uploads a competitor ad, existing campaign asset, or inspiration image/video → AI returns a structured analysis: composition, color palette, lighting, pacing (video), text placement, emotional tone, subject positioning.

**Deliverables:**
- Backend: `POST /api/analyze` accepting image or video (URL or upload)
- Backend: Gemini vision analysis with structured JSON output
- Backend: for video — extract 5 key frames (ffmpeg) and analyze sequence
- Frontend: "Analyze" button available for any uploaded/searched asset
- Frontend: analysis report card: visual breakdown with color swatches, composition diagram, tone tags
- Frontend: "Generate Similar" button that populates Creative Controls from analysis

**Files Modified:**
- New file: `server/src/routes/analyze.js`
- `server/src/index.js` (register route)
- New file: `client/src/components/AnalysisReport.js`
- `client/src/services/api.js` (add analyze API)

**Effort:** 2 days
- Day 1: Backend analysis pipeline (Gemini vision + structured output)
- Day 2: Frontend report UI + "Generate Similar" action

**Dependencies:** ffmpeg in Docker (from SOW-1)
**Risk:** None — straightforward Gemini vision application.

---

#### SOW-23: "Why Does This Work?" Explainer

**Description:**
For any uploaded high-performing asset, AI explains the creative principles that make it effective: hook strength, attention flow, color psychology, composition rules applied, CTA placement effectiveness.

**Deliverables:**
- Backend: extends `/api/analyze` with marketing-specific analysis prompt
- Backend: returns: hook_score, attention_curve, composition_rules, color_impact, cta_effectiveness, improvement_suggestions
- Frontend: "Why It Works" tab on analysis report
- Frontend: visual annotations showing key principles on the image/video

**Files Modified:**
- `server/src/routes/analyze.js` (add marketing analysis mode)
- `client/src/components/AnalysisReport.js` (add "Why It Works" tab)

**Effort:** 1.5 days
- Day 1: Marketing-specific analysis prompt engineering
- Day 1.5: Frontend visualization + annotations

**Dependencies:** SOW-22 (analysis infrastructure)
**Risk:** None.

---

#### SOW-24: Post-Generation Quality Gate (User-Facing)

**Description:**
After every generation, display a confidence score to the user: "92% match to your brief. Minor issue: product slightly rotated vs. reference." User can choose to accept or request refinement.

**Deliverables:**
- Backend: scoring method (exists from SOW-1 Director loop) exposed as separate user-facing result
- Frontend: quality badge on every generated asset (score + top issue if below 95%)
- Frontend: "Refine This" button that triggers one more iteration with the identified issue
- Frontend: score breakdown on hover: prompt_adherence, composition, brand_alignment, technical_quality

**Files Modified:**
- `server/src/routes/generate.js` (return score alongside generated result)
- `server/src/routes/video.js` (return score alongside generated result)
- `client/src/components/ImageGrid.js` (display quality badge)
- New file: `client/src/components/QualityBadge.js`

**Effort:** 1 day (most scoring logic exists from SOW-1)

**Dependencies:** SOW-1 (scoring method)
**Risk:** None.

---

#### SOW-25: Product Accuracy Check

**Description:**
Specialized scoring that compares generated product appearance against the original product photo: shape match, color match, label/text accuracy, proportional correctness. Flags issues specific to product marketing.

**Deliverables:**
- Backend: `compareProductAccuracy(generatedImage, originalProductImage)` method
- Backend: returns: shape_score, color_score, label_score, proportion_score, overall, issues[]
- Frontend: product accuracy report shown when product references are used
- Frontend: visual diff highlighting (overlay original vs. generated)

**Files Modified:**
- `server/src/services/gemini.js` (add product comparison method)
- `client/src/components/QualityBadge.js` (extend with product accuracy)

**Effort:** 1.5 days
- Day 1: Backend comparison prompt + scoring
- Day 1.5: Frontend accuracy display + visual diff

**Dependencies:** SOW-14 (product registry), SOW-24 (quality gate infrastructure)
**Risk:** None.

---

#### SOW-26: Industry Trend Feed

**Description:**
A weekly curated feed showing visual trends in the user's industry: "Trending in medical marketing: 3D product renders, clinical blue palettes, patient-first compositions." Each trend includes example visuals and one-click generation.

**Deliverables:**
- Backend: new route `GET /api/trends` — uses Gemini + Google Search grounding
- Backend: scheduled job (or on-demand with 24h cache) that researches industry trends
- Backend: returns structured trend data: trend_name, description, visual_examples[], suggested_prompt
- Frontend: "Trends" page/tab showing curated feed
- Frontend: industry selector (medical, retail, F&B, tech, finance)
- Frontend: "Generate This Trend" one-click button per trend

**Files Modified:**
- New file: `server/src/routes/trends.js`
- `server/src/index.js` (register route)
- New file: `client/src/pages/TrendsPage.jsx`
- `client/src/routes/AppRoutes.js` (add trends route)
- `client/src/services/api.js` (add trends API)

**Effort:** 3 days
- Day 1: Backend trend research via Gemini + Search grounding
- Day 2: Frontend trends page + one-click generation
- Day 3: Caching, industry filtering, testing

**Dependencies:** Google Search grounding enabled
**Risk:** Trend quality depends on Search grounding accuracy. Curate/filter results before displaying.

---

#### SOW-27: Competitor Visual Watch

**Description:**
User adds competitor brand URLs or social handles → agent periodically analyzes their recent visual content → reports patterns, style changes, and differentiation opportunities.

**Deliverables:**
- Backend: `POST /api/competitors` to register competitor URLs
- Backend: `GET /api/competitors/report` — Gemini + Search grounding analyzes competitor visual presence
- Backend: returns: style_patterns, color_trends, composition_preferences, differentiation_suggestions
- Frontend: "Competitors" section in brand settings
- Frontend: competitor analysis report with "Differentiate" one-click generation suggestions

**Files Modified:**
- New file: `server/src/routes/competitors.js`
- `server/src/index.js` (register route)
- New file: `client/src/components/CompetitorReport.js`
- `client/src/services/api.js` (add competitor API)

**Effort:** 2.5 days
- Day 1: Backend competitor analysis pipeline
- Day 2: Frontend competitor management + report display
- Day 2.5: Differentiation suggestions + one-click generation

**Dependencies:** Google Search grounding enabled
**Risk:** Public URL analysis may have limited depth. Best for websites and public social content.

---

#### SOW-28: "Create This" Proactive Suggestions

**Description:**
Based on brand profile + industry trends + content calendar + recent generation history, the platform proactively suggests what to create next — with ready-to-generate prompts.

**Deliverables:**
- Backend: `GET /api/suggestions` — combines brand context, trends, calendar, and usage data
- Backend: suggestion engine: "You haven't created Stories content in 2 weeks. Trending: vertical product demos. Here are 3 concepts."
- Backend: each suggestion includes: title, rationale, pre-filled prompt, suggested style, recommended format
- Frontend: "Suggested for You" card carousel on dashboard/home page
- Frontend: dismiss/save suggestions, one-click generate

**Files Modified:**
- New file: `server/src/routes/suggestions.js`
- `server/src/index.js` (register route)
- `client/src/components/SuggestionCarousel.js` (new component)
- `client/src/pages/CanvasPage.jsx` or dashboard (embed carousel)
- `client/src/services/api.js` (add suggestions API)

**Effort:** 1.5 days
- Day 1: Backend suggestion logic combining multiple signals
- Day 1.5: Frontend carousel + one-click generation

**Dependencies:** SOW-10 (brand profile), SOW-26 (trends)
**Risk:** Cold-start problem — suggestions improve as usage history accumulates.

---

### Phase 5 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-22 | Upload & analyze content | 2d |
| SOW-23 | "Why does this work?" explainer | 1.5d |
| SOW-24 | Post-generation quality gate (user-facing) | 1d |
| SOW-25 | Product accuracy check | 1.5d |
| SOW-26 | Industry trend feed | 3d |
| SOW-27 | Competitor visual watch | 2.5d |
| SOW-28 | "Create This" suggestions | 1.5d |
| **Total** | | **13.5 days** |

---

### Phase 6: Collaboration & Platform

**Objective:** Enable multi-user workflows and establish platform infrastructure for team use.

---

#### SOW-29: Progressive Refinement (Chat-Style Editing)

**Description:**
After generation, user types follow-up instructions that build on the previous output: "make the background darker", "remove the text", "zoom in on the product." Each instruction produces a refined version without starting from scratch.

**Deliverables:**
- Backend: conversation-style image editing using Gemini Flash Image multi-turn API
- Backend: maintain edit history per asset (chain of edits)
- Frontend: chat-style input below generated image
- Frontend: edit history sidebar showing all versions
- Frontend: revert to any previous version

**Files Modified:**
- `server/src/services/gemini.js` (add multi-turn image editing method)
- `server/src/routes/generate.js` or new `server/src/routes/edit.js` (edit endpoint)
- New file: `client/src/components/RefinementChat.js`
- `client/src/services/api.js` (add edit API)

**Effort:** 2.5 days
- Day 1: Backend multi-turn editing via Gemini Flash Image
- Day 2: Frontend chat UI + version history
- Day 2.5: Revert functionality, testing

**Dependencies:** SOW-0 (Nano Banana 2 model)
**Risk:** Multi-turn context window limitations. Some edits may conflict with previous edits.

---

#### SOW-30: Share & Annotate for Review

**Description:**
Share generated assets via a public link. Reviewers can view, pin comments directly on the image/video at specific coordinates, approve or request changes — without needing platform login.

**Deliverables:**
- Backend: `POST /api/reviews/share` generates unique review link with expiry
- Backend: `GET /api/reviews/:id` returns asset + annotations (public, no auth required)
- Backend: `POST /api/reviews/:id/annotate` adds pin comment at x,y coordinates
- Backend: `POST /api/reviews/:id/approve` or `/reject` with comment
- Frontend: review page (standalone, no login required) showing asset + annotation tools
- Frontend: notification in main app when review has new comments

**Files Modified:**
- New file: `server/src/routes/reviews.js`
- `server/src/index.js` (register route)
- New file: `client/src/pages/ReviewPage.jsx` (public review page)
- `client/src/routes/AppRoutes.js` (add review route — unprotected)
- `client/src/services/api.js` (add review APIs)

**Effort:** 3 days
- Day 1: Backend review link generation + annotation storage
- Day 2: Frontend review page with annotation pins
- Day 3: Approve/reject flow + in-app notifications

**Dependencies:** None
**Risk:** Security — review links must expire. Rate-limit annotation endpoint.

---

#### SOW-31: Project Folders

**Description:**
Organize generations into projects (campaigns, product launches, client names). Attach brief context to project. All generations within a project inherit its context automatically.

**Deliverables:**
- Backend: CRUD for projects (name, description, brief, brand settings override)
- Backend: generations tagged with project ID in GCS metadata
- Backend: list files filtered by project
- Frontend: project sidebar/switcher
- Frontend: project settings page (name, brief, default style)
- Frontend: all generations auto-tagged with active project

**Files Modified:**
- New file: `server/src/routes/projects.js`
- `server/src/index.js` (register route)
- `server/src/routes/files.js` (filter by project)
- New file: `client/src/components/ProjectSwitcher.js`
- `client/src/store/useStore.js` (active project state)
- Various generation routes (tag outputs with project ID)

**Effort:** 2 days
- Day 1: Backend project CRUD + generation tagging
- Day 2: Frontend project switcher + settings

**Dependencies:** SOW-7 (GCS metadata tagging)
**Risk:** None.

---

#### SOW-32: Collateral Templates

**Description:**
Save any successful generation as a reusable template: locked composition/style, editable text/product. Future generations from templates swap only the specified elements.

**Deliverables:**
- Backend: template storage (base image, editable zones, prompt template with `{{placeholders}}`)
- Backend: `POST /api/templates` to save, `GET /api/templates` to list, `POST /api/templates/:id/generate` to use
- Frontend: "Save as Template" button on any generated asset
- Frontend: template library page
- Frontend: "Use Template" flow — shows editable fields (product, headline, CTA text)

**Files Modified:**
- New file: `server/src/routes/templates.js`
- `server/src/index.js` (register route)
- New file: `client/src/pages/TemplatesPage.jsx`
- `client/src/services/api.js` (add template APIs)

**Effort:** 2.5 days
- Day 1: Backend template storage + variable substitution logic
- Day 2: Frontend template library + creation flow
- Day 2.5: "Use Template" generation flow, testing

**Dependencies:** None
**Risk:** Template flexibility vs. constraints tradeoff. Over-constrained templates produce repetitive output.

---

### Phase 6 Summary

| Item | Feature | Effort |
|------|---------|--------|
| SOW-29 | Progressive refinement (chat-style) | 2.5d |
| SOW-30 | Share & annotate for review | 3d |
| SOW-31 | Project folders | 2d |
| SOW-32 | Collateral templates | 2.5d |
| **Total** | | **10 days** |

---

## Grand Total

| Phase | Focus | Effort |
|-------|-------|--------|
| Phase 1 | Core Quality & Accuracy | 10 days |
| Phase 2 | Workflow & Creative Intelligence | 12 days |
| Phase 3 | Product Marketing Power Tools | 14 days |
| Phase 4 | Scale & Automation | 15 days |
| Phase 5 | Content Intelligence & Trend Agent | 13.5 days |
| Phase 6 | Collaboration & Platform | 10 days |
| **TOTAL** | **32 features** | **74.5 days** |

---

## Assumptions

1. Single full-stack developer working full days (8 hours/day)
2. GCP project access confirmed with all required APIs enabled
3. `@google/genai` SDK supports `referenceImages` parameter (fallback adds 0.5d to SOW-2)
4. Google Search grounding available on API key
5. No external dependencies beyond existing stack (Node.js, React, GCS, BigQuery, Gemini, VEO)
6. Testing effort included in each SOW estimate
7. Deployment effort (Docker build + Cloud Run deploy) included in each SOW

## Exclusions

- LoRA fine-tuning (closed model — technically impossible)
- ControlNet/ControlNeXt (incompatible with Google APIs)
- Full video timeline editor (scene extension covers core need)
- Multi-tenant workspace architecture (separate project)
- White-label branding (separate project)
- Direct publishing to ad platforms (future integration)
- Mobile app development
- Load testing / performance optimization (separate engagement)
