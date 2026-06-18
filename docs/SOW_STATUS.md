---
tags: [sow, status, roadmap]
status: updated
---

# SOW Status Tracker

Last updated: 2026-06-18

Quick-reference audit of all 32 SOW items plus new additions built beyond the original scope. Source of truth for feature completion.

---

## Phase 1 — Core Quality & Accuracy

| # | Feature | Status | Commits |
|---|---------|--------|---------|
| SOW-0 | Veo Endpoint Migration | ✅ Done | `5f22465`, `939c954` |
| SOW-1 | Automatic Quality Loop (The Director) | ❌ Pending | — |
| SOW-2 | Reference Image Accuracy (Ingredients) | ✅ Done | `41448d1`, `8d917af`, `580d03f` |
| SOW-3 | Multiple Output Variations | ❌ Pending | — |
| SOW-4 | Native 4K Resolution | ✅ Done | `222f669`, `6e844ac`, `e4b0f10` |
| SOW-5 | Native Audio UI Field | ❌ Pending | — |
| SOW-6 | Layout-Aware Generation | ❌ Pending | — |

**SOW-0 detail:** GA model `veo-3.1-generate-001` via Vertex AI SDK (`939c954`). Fallback to `veo-3.1-generate-preview` on Developer API when `GCP_PROJECT_ID` unset (local dev). Text model updated to `gemini-3.5-flash`, image to `gemini-3.1-flash-image-preview`.

**SOW-2 detail:** Up to 3 reference images via Veo `referenceImages` parameter with `referenceType: "asset"`. `analyzeReferenceImages()` sends images to `gemini-3.5-flash` vision and injects a compact description into the Veo prompt as `"Reference subject details: ..."`. URL and data URL inputs both supported. Dedicated Ingredients UI with 3 labeled slots (Character / Product / Scene) added in `580d03f` — each slot supports upload or Nano Banana AI generation.

**SOW-4 detail:** `"4k"` resolution option in UI dropdown. Resolution fallback chain 4K → 1080p → 720p on Veo code 13. Restriction removed that previously capped 1080p to 16:9 only.

---

## Phase 2 — Workflow & Creative Intelligence

| # | Feature | Status | Commits |
|---|---------|--------|---------|
| SOW-7 | Video as Reference (No Download) | 🟡 Partial | `803fd91` |
| SOW-8 | Video Scene Extension | ✅ Done | `0ef8a77`, `580d03f` |
| SOW-9 | Golden Prompts Library | ❌ Pending | — |
| SOW-10 | Brand Profile Auto-Detection | ❌ Pending | — |
| SOW-11 | Reverse-Engineer to Prompt | ❌ Pending | — |
| SOW-12 | A/B Comparison View | ❌ Pending | Blocked on SOW-3 |

**SOW-7 partial:** Staging and "Use as Reference" button work for all asset types. Missing: custom GCS metadata tagging at upload time — file cards don't display the original prompt. This blocks SOW-31 (project folders).

**SOW-8 detail:** "Extend" button on My Files video cards (`0ef8a77`). Extend sub-mode tab in PromptDrawer (`580d03f`). Veo-generated videos use `videoUrl` path (last-frame scene extension). Non-Veo videos extract last frame client-side as image reference.

---

## Phase 3 — Product Marketing Power Tools

| # | Feature | Status |
|---|---------|--------|
| SOW-13 | Product Photo Studio | ❌ Pending |
| SOW-14 | Product Consistency Lock | ❌ Pending |
| SOW-15 | Multi-Format Campaign Export | ❌ Pending |
| SOW-16 | Text & CTA Overlay Editor | ❌ Pending |
| SOW-17 | Product Line Variations | ❌ Pending — blocked on SOW-14 |

---

## Phase 4 — Scale & Automation

| # | Feature | Status |
|---|---------|--------|
| SOW-18 | Campaign Brief → All Assets | ❌ Pending |
| SOW-19 | Bulk Variation Generator | ❌ Pending |
| SOW-20 | A/B Ad Variation Generator | ❌ Pending — blocked on SOW-3 |
| SOW-21 | Regional Re-Generation (Inpainting) | ❌ Pending |

---

## Phase 5 — Content Intelligence & Trend Agent

| # | Feature | Status |
|---|---------|--------|
| SOW-22 | Upload & Analyze Content | ❌ Pending |
| SOW-23 | "Why Does This Work?" Explainer | ❌ Pending — blocked on SOW-22 |
| SOW-24 | Post-Generation Quality Gate | ❌ Pending — blocked on SOW-1 |
| SOW-25 | Product Accuracy Check | ❌ Pending — blocked on SOW-14, SOW-24 |
| SOW-26 | Industry Trend Feed | ❌ Pending |
| SOW-27 | Competitor Visual Watch | ❌ Pending |
| SOW-28 | "Create This" Suggestions | ❌ Pending — blocked on SOW-10, SOW-26 |

---

## Phase 6 — Collaboration & Platform

| # | Feature | Status |
|---|---------|--------|
| SOW-29 | Progressive Refinement (Chat-Style) | ❌ Pending |
| SOW-30 | Share & Annotate for Review | ❌ Pending |
| SOW-31 | Project Folders | ❌ Pending — blocked on SOW-7 metadata |
| SOW-32 | Collateral Templates | ❌ Pending |

---

## New Additions (Beyond Original SOW)

Built during Jun 18 2026 session. Not in original scope.

| Feature | Commit | Description |
|---------|--------|-------------|
| Ingredients to Video UI | `580d03f` | 3-slot panel (Character / Product / Scene) in video Create mode. Each slot: upload image file, or AI-generate via Nano Banana with a per-slot text prompt. Slot images sent to Veo as `referenceImageUrls`. |
| Camera Controls Chip Panel | `2011174` | Collapsible chip panel below negative prompt in video Create mode. Movement group (13 chips: static, zoom, dolly, pan, tilt, tracking, handheld, aerial, crane), Angle group (7 chips), Shot group (5 chips). Chips appended to final prompt at generation time — textarea stays clean. |
| Veo RAI Auto-Retry | `9e0899b` | On Veo error code 3 (real face photo blocked as input — anti-deepfake policy), strips reference images and retries as text-to-video using the visual description from `analyzeReferenceImages`. User sees a warning but receives a video. |
| Vertex AI Download Hardening | `580d03f` | `extractVideoUri()` checks all known Vertex AI response field names plus a one-level object scan. Eliminates "could not extract file name" when Veo returns the GCS URI in an unexpected field. Full `videoFileRef` JSON now logged. |
| Firebase Session Resilience | `b166637` | Only signs out on 401/403. 5xx and network errors (e.g. Cloud Run cold start after deploy) keep the session alive. Eliminates forced logout on every deploy. |
| personGeneration Auto-Default | `9ba7d31` | Auto-sets `allow_adult` when reference images are present. Previously the param was read from request body but never added to `requestParams.config` — silently dropped. |

---

## Completion Summary

| Phase | Total | ✅ Done | 🟡 Partial | ❌ Pending |
|-------|-------|--------|-----------|-----------|
| Phase 1 | 7 | 3 | 0 | 4 |
| Phase 2 | 6 | 1 | 1 | 4 |
| Phase 3 | 5 | 0 | 0 | 5 |
| Phase 4 | 4 | 0 | 0 | 4 |
| Phase 5 | 7 | 0 | 0 | 7 |
| Phase 6 | 4 | 0 | 0 | 4 |
| **SOW Total** | **32** | **4 (13%)** | **1 (3%)** | **27 (84%)** |
| New additions | 6 | 6 | — | — |

---

## Priority Order for Next Work

Based on effort, unblocking value, and user impact:

1. **SOW-5** — Native Audio UI Field (0.5 days, zero risk, immediate UX lift)
2. **SOW-7 completion** — GCS metadata tagging (unblocks SOW-31)
3. **SOW-1** — Quality loop / Director (highest satisfaction impact, unblocks SOW-24/25)
4. **SOW-3** — Multiple output variations (unblocks SOW-12, SOW-20)
5. **SOW-6** — Layout-aware generation (text-safe zones for marketing collateral)

## Related Notes
- [[SOW_DETAILED]] — original specification with effort estimates
- [[Decision-Log]] — commit history and architectural decisions
- [[Session-Jun18-PM]] — technical details of Jun 18 PM session
