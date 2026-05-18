# Gen Media AI Studio — Consolidated Product Roadmap

## Platform Vision

**From:** "AI image and video generator"
**To:** "Creative intelligence platform — understands what works, generates on-brand campaign assets at scale, and learns from every interaction."

**One-line pitch:** From product photo to campaign-ready collateral in minutes, not days.

---

## Current State (May 2026)

| Component | Status |
|-----------|--------|
| Image generation | ✅ Working (Gemini 2.5 Flash Image) |
| Video generation | ✅ Working (Veo 3.1 Preview — needs migration to GA) |
| Image remix/compositing | ✅ Working |
| Brand kit (manual) | ✅ Working |
| Reference image search | ✅ Working (Pexels + Unsplash + Pixabay) |
| Video reference search | ✅ Working |
| Prompt improvement | ✅ Working |
| User auth (Firebase) | ✅ Working |
| GCS asset storage | ✅ Working |
| My Files page | ✅ Basic listing |

---

## Customer Feedback (Abbott Medical)

| Priority | Issue | Satisfaction |
|----------|-------|-------------|
| 1 | Video generation quality — 3-4 attempts needed | 3/5 |
| 2 | Uploaded references not accurately reflected in outputs | Low |
| 3 | Style presets too limiting | Low |
| 4 | Must download/re-upload to reuse generated videos | Friction |

---

## Model Migration (PREREQUISITE)

| Current | Target | Urgency |
|---------|--------|---------|
| `veo-3.1-generate-preview` | `veo-3.1-generate-001` | ⚠️ CRITICAL — preview deprecated April 2026 |
| `gemini-2.5-flash` | `gemini-3.1-flash` (or `gemini-3.1-flash-lite`) | Medium — performance/cost improvement |
| `gemini-2.5-flash-image` | `gemini-3.1-flash-image-preview` (Nano Banana 2) | Medium — better inpainting, 4K output |

---

## Phase 1: Core Quality & Accuracy (10 days)

*Goal: Fix Abbott's top 2 complaints — output quality and reference accuracy.*

| # | Feature | Description | Effort | Abbott Impact |
|---|---------|-------------|--------|---------------|
| 0 | **Veo endpoint migration** | Change model string to `veo-3.1-generate-001` | 0.5d | Prerequisite |
| 1 | **Automatic Quality Loop (Director)** | Generate → Gemini scores output vs. prompt + references → auto-retry with refined prompt if below threshold. User only sees the best result. | 4d | Eliminates 3-4 manual attempts |
| 2 | **Reference Image Accuracy (Ingredients to Video)** | Pass up to 3 reference images via VEO 3.1 `referenceImages` API with `referenceType: "asset"`. Also: Gemini analyzes references and injects composition details into enriched prompt. | 2d | Fixes "uploaded images not reflected" |
| 3 | **Multiple Output Variations** | Generate 2-4 video variations per request via `sampleCount`. User picks the best. | 1d | More choice, fewer retries |
| 4 | **Native 4K Resolution** | Add `resolution: "4k"` option (native VEO 3.1 support). Falls back to 1080p if unavailable. | 0.5d | Professional quality output |
| 5 | **Native Audio UI** | Add audio description field. Guide users to describe sound. VEO already generates audio natively. | 0.5d | Complete videos out of the box |
| 6 | **Layout-Aware Generation** | Prompt engineering for text-safe zones: "product left, negative space right for copy." UI indicator showing safe areas. | 1.5d | Collaterals usable without Canva |

**Phase 1 Total: 10 days**

---

## Phase 2: Workflow & Creative Intelligence (12 days)

*Goal: Fix Abbott's remaining complaints + make platform smart enough to suggest and learn.*

### Workflow Efficiency

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 7 | **Video as Reference (No Download)** | Every generated asset tagged with prompt metadata in GCS. "Use as Reference" button in My Files → populates Creative Controls instantly. | 3d |
| 8 | **Video Scene Extension** | Extract last frame (ffmpeg) → pass to VEO as starting frame → seamless continuation. Build 30-60s sequences by chaining clips. | 2d |
| 9 | **Golden Prompts Library** | Save successful prompts as reusable templates. Tag by campaign/product/style. Share across team. One-click regenerate. | 2d |

### Creative Intelligence

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 10 | **Automated Brand Profile Detection** | Paste brand URL → Gemini + Google Search grounding extracts: colors, fonts, visual tone, mood. Saves as active Brand Profile. Auto-applied to all generations. | 2.5d |
| 11 | **Reverse-Engineer to Prompt** | Upload any image/video → AI generates the prompt + settings that would recreate it. One-click to generate. | 1.5d |
| 12 | **A/B Comparison View** | Side-by-side comparison of 2-4 generated variations with one-click winner selection. | 1d |

**Phase 2 Total: 12 days**

---

## Phase 3: Product Marketing Power Tools (14 days)

*Goal: Make the platform purpose-built for product marketing collateral at scale.*

### Product-Centric Generation

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 13 | **Product Photo Studio** | Upload product (any background) → AI removes background → places in lifestyle scenes, studio setups, or contextual environments. Preset scenes: "on desk", "in hand", "clinical", "retail shelf", "flat lay". | 3d |
| 14 | **Product Consistency Lock** | Upload product once as a permanent asset. VEO Ingredients API locks its appearance across all future generations. AI checks generated output vs. original for accuracy. | 3d |
| 15 | **Multi-Format Campaign Export** | One hero image → auto-generates: 1:1 (Instagram feed), 9:16 (Stories), 4:5 (Facebook), 16:9 (YouTube), 1.91:1 (LinkedIn) — with intelligent subject repositioning. | 2d |
| 16 | **Text & CTA Overlay** | Add headlines, subheadlines, CTAs, prices on canvas with brand fonts. Smart positioning suggestions. Export as final collateral. | 4d |
| 17 | **Product Line Variations** | Same ad concept → swap product across entire product line. Same composition, same style — different product in each. | 2d |

**Phase 3 Total: 14 days**

---

## Phase 4: Scale & Automation (15 days)

*Goal: Enable batch production and autonomous creative workflows.*

### Production at Scale

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 18 | **Campaign Brief → All Assets** | Structured input form (product, message, audience, channels, tone) → generates complete set: hero image, social variations, product video, email header. One click. | 4d |
| 19 | **Bulk Variation Generator** | Base prompt + variable matrix (5 products × 3 taglines × 4 backgrounds) → batch-generate all combinations. Tagged for A/B testing. | 3d |
| 20 | **A/B Ad Variation Generator** | One concept → auto-vary: background, text position, color accents, CTA copy. Tag each variation for performance tracking. | 3d |
| 21 | **Regional Re-Generation (In-painting)** | Draw highlight on specific error in generated video frame → Nano Banana 2 inpaints correction → corrected frame feeds back to VEO for targeted regeneration. | 5d |

**Phase 4 Total: 15 days**

---

## Phase 5: Content Intelligence & Trend Agent (12 days)

*Goal: Platform understands content, suggests what to create, learns over time.*

### Visual Understanding

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 22 | **Upload & Analyze Any Content** | Upload competitor ad or inspiration → AI breakdown: composition, palette, pacing, tone, text placement. Structured report. | 2d |
| 23 | **"Why Does This Work?" Explainer** | For any asset, AI explains creative principles: hook strength, attention curve, brand alignment scoring. | 1.5d |
| 24 | **Post-Generation Quality Gate** | User-facing confidence score on every output: "92% match — minor: product partially occluded in frame 3." | 1d |
| 25 | **Product Accuracy Check** | AI compares generated product vs. original photo: shape, color, label, proportion accuracy scores. Flags before export. | 1.5d |

### Trend Research Agent

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 26 | **Industry Trend Feed** | Weekly curated feed: "Trending in your industry: X aesthetic, Y format, Z composition." Each with one-click generate. | 3d |
| 27 | **Competitor Visual Watch** | Add competitor URLs → agent scans visual content weekly → reports patterns + differentiation suggestions. | 2.5d |
| 28 | **"Create This" Suggestions** | Based on brand + trends + calendar + usage history, proactively suggests ready-to-generate concepts. | 1.5d |

**Phase 5 Total: 12 days**

---

## Phase 6: Collaboration & Platform (10 days)

*Goal: Multi-user workflows, agency-ready infrastructure.*

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 29 | **Progressive Refinement (Chat-Style)** | After generation, follow-up: "make background darker", "remove person on left" — multi-turn editing without starting over. | 2.5d |
| 30 | **Share & Annotate for Review** | Share asset via link. Reviewer pins comments directly on image/video. Agency → client review workflow. | 3d |
| 31 | **Project Folders** | Organize generations into campaigns. Attach brief. All generations inherit brief context. | 2d |
| 32 | **Collateral Templates** | Save successful layouts as templates. Future: swap product + text, keep composition. | 2.5d |

**Phase 6 Total: 10 days**

---

## Summary Timeline

| Phase | Focus | Days | Cumulative |
|-------|-------|------|-----------|
| **Phase 1** | Core quality + accuracy | 10 | 10 |
| **Phase 2** | Workflow + creative intelligence | 12 | 22 |
| **Phase 3** | Product marketing tools | 14 | 36 |
| **Phase 4** | Scale + automation | 15 | 51 |
| **Phase 5** | Content intelligence + trend agent | 12 | 63 |
| **Phase 6** | Collaboration + platform | 10 | 73 |

---

## Abbott Trial Deadline: June 9, 2026

**Available working days (May 19 → June 9): ~15 days**

| Deliverable | Fits? |
|-------------|-------|
| Phase 1 (10 days) | ✅ Yes |
| Phase 2 partial: Items 7, 9, 10, 12 (6.5 days) | ⚠️ Tight — need prioritization |
| Phase 2 full (12 days) | ❌ Won't fit with Phase 1 |

**Recommended for Abbott trial (16.5 days → needs parallel work or scope cut):**
- Phase 1 full (10 days)
- Item 7: Video as reference (3 days)
- Item 10: Auto brand detection (2.5 days)
- Item 12: A/B comparison view (1 day)

**Cut from trial if short on time:**
- Item 8 (scene extension) — nice but not Abbott's top complaint
- Item 9 (golden prompts) — deferred to post-trial
- Item 11 (reverse-engineer) — deferred

---

## Technology Stack Required

| Capability | Technology | Status |
|-----------|-----------|--------|
| Image generation | Gemini 3.1 Flash Image (`gemini-3.1-flash-image-preview`) | Needs migration |
| Video generation | VEO 3.1 GA (`veo-3.1-generate-001`) | Needs migration |
| Prompt enrichment / scoring | Gemini 3.1 Flash (or Flash-Lite) | Needs migration |
| Visual understanding | Gemini vision (multimodal input) | ✅ Available |
| Trend grounding | Gemini + Google Search grounding | ✅ Available |
| Video frame extraction | ffmpeg | Needs Docker addition |
| Image processing | Sharp | ✅ Already installed |
| Canvas/mask drawing | Konva.js / react-konva | ✅ Already installed |
| Asset storage | Google Cloud Storage | ✅ Already working |
| Usage/billing data | BigQuery | ✅ Already working |
| Reference image search | Pexels + Unsplash + Pixabay APIs | ✅ Implemented |

---

## Prerequisites Checklist

- [ ] Migrate `veo-3.1-generate-preview` → `veo-3.1-generate-001`
- [ ] Confirm VEO 3.1 GA access on project `strong-kit-475107-k1`
- [ ] Verify `@google/genai` SDK supports `referenceImages` parameter
- [ ] Enable Google Search grounding on Gemini API key
- [ ] Add ffmpeg to Dockerfile (`RUN apk add --no-cache ffmpeg`)
- [ ] Upgrade GCS service account to Storage Object Admin (done)
- [ ] Remove hardcoded GCS_BUCKET from Dockerfile start.sh (done)

---

## What Is Explicitly NOT in Scope

| Item | Reason |
|------|--------|
| LoRA fine-tuning | VEO/Gemini are closed models — no weight access |
| ControlNet/ControlNeXt | Open-source diffusion adapters — incompatible with Google APIs |
| Full drag-and-drop video editor | Out of scope — scene extension (Item 8) covers the core need |
| Multi-tenant agency workspaces | Post-trial architecture — builds on single-brand foundation |
| White-label platform | Sales/packaging concern, not product feature for trial |
| Direct publishing to ad platforms | Future integration — export formats come first |

---

## Competitive Differentiation

| Competitor | What they do | What you do better |
|-----------|-------------|-------------------|
| Midjourney | Best image quality | No video, no brand controls, no product workflow |
| Runway / Sora | Best video generation | No brand intelligence, no product accuracy, no collateral workflow |
| Adobe GenStudio | Full enterprise suite | Expensive, complex — you're faster to value |
| Canva AI | Easy templates + text | Weak generation quality, no video intelligence |
| XGen.pro | Product photography | No video, no campaign workflows, no intelligence |

**Your unique position:** The only platform that combines product-accurate generation + video + brand intelligence + content understanding + multi-format export in a single workflow. From product photo to campaign-ready collateral without leaving the platform.

---

## Success Metrics

| Metric | Current (Abbott) | Target (Post-Phase 1) | Target (Post-Phase 2) |
|--------|-----------------|----------------------|----------------------|
| Attempts to acceptable output | 3-4 | 1-2 | 1 (auto-refined) |
| Reference accuracy satisfaction | Low | High | Very High |
| Creative flexibility satisfaction | 3/5 | 4/5 | 5/5 |
| Time from brief to complete asset set | Hours | 30 mins | 10 mins |
| Manual steps post-generation | 5+ (resize, text, export) | 2-3 | 0-1 |
