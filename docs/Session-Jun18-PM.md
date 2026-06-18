---
tags: [dev-log, session, veo, ingredients, camera]
status: updated
---

# Session — June 18 2026 (PM)

Continuation of the June 18 session. Covered Vertex AI migration for Veo GA, Ingredients to Video UI, and camera controls.

## What Was Built

### analyzeReferenceImages
New `GeminiService` method. Takes up to 3 `referenceImageParts` (same objects passed to Veo), sends them as `inlineData` multimodal parts to `gemini-3.5-flash`, and returns a single sentence describing the subject's dominant colours, material, and visual style. This description is injected into the Veo prompt as `"Reference subject details: ..."` before sending. Lives in `server/src/services/gemini.js`. Uses `MODELS.text` (not the image model).

### Vertex AI Migration
`veo-3.1-generate-001` GA is Vertex AI only — calling it via Gemini Developer API v1beta returns 404.

- Added a second `GoogleGenAI` instance: `new GoogleGenAI({ vertexai: true, project: GCP_PROJECT_ID, location: GCP_LOCATION })`
- `GCP_PROJECT_ID` was already set as Cloud Run env var; service account already had `roles/aiplatform.user`
- Video generation uses Vertex AI client when `GCP_PROJECT_ID` is set; falls back to Developer API + `veo-3.1-generate-preview` for local dev
- Text and image generation stay on Developer API (Vertex AI not needed for those)

**Commit:** `939c954`

### Vertex AI Download Fix
Vertex AI Veo returns a GCS URI (`gs://...`) in the operation response, not a Files API reference. Original download code only checked `fileRef.uri` and `fileRef.videoUri`; if either was absent it fell to `genAI.files.download` which threw "could not extract file name".

- First fix (`f2e7e84`): added multi-path detection (GCS → axios stream → Files API)
- Second fix (`580d03f`): replaced hardcoded field checks with `extractVideoUri()` — scans `uri`, `videoUri`, `downloadUri`, `gcsUri`, `fileUri`, `name`, plus one level of nested objects. Full `videoFileRef` JSON now logged to Cloud Run logs for debugging.

### personGeneration Wiring
`personGeneration` was being read from request body but never added to `requestParams.config`. Now included. Auto-defaults to `allow_adult` when `referenceImageUrls` are present. **Commit:** `9ba7d31`

### Veo RAI Face Photo Block
`veo-3.1-generate-001` blocks real human face photos as Ingredients INPUT (anti-deepfake policy). Operation returns error code 3 with message containing "responsible ai / violates / input image". `personGeneration: allow_adult` does NOT override this — it only controls whether Veo generates people in the output, not whether it accepts face photos as input.

**Auto-retry implemented (`9e0899b`):** On code 3, strips `referenceImages` from config and retries as text-to-video using the visual description already in the prompt from `analyzeReferenceImages`. User receives a warning but gets a video.

**Clean workflow:** Generate the person character using Nano Banana first (`gemini-3.1-flash-image-preview`), then use the AI-generated image as ingredient. Veo has no problem with AI-generated faces as inputs — only real photographs.

### Firebase Sign-Out on Deploy Restart
`postSignIn` returns 5xx during Cloud Run cold start after each deploy. The auth context was calling `firebaseSignOut` on any error, logging out every user on every deploy.

**Fix (`b166637`):** Only sign out on explicit 401/403. 5xx and network errors log a warning and keep the session — the token will be validated on next navigation.

Also fixed `signInWithEmail` silently returning when Firebase not initialised — now sets `emailLinkError` with a visible message.

### Ingredients to Video UI
**Commit:** `580d03f`

PromptDrawer video + create mode now has three tabs: **Standard / Ingredients / Extend**.

**Ingredients mode:**
- Three labeled slots: Character (Users icon), Product (Target icon), Scene (Globe icon)
- Each slot: Upload button (image file → data URL → fills slot) or AI Generate button (expands inline prompt field → calls `generateImages()` 1×1:1 → fills slot + adds workspace row)
- Slot thumbnails shown when filled, with × to clear
- At generation time, filled slot URLs become `referenceImageUrls` (in order: Character, Product, Scene — nulls filtered)

**Extend mode:**
- Shows whether a Veo-generated video is currently staged
- Routes generation to scene extension (videoUrl path)

**Standard mode:** existing staging-area behavior unchanged.

### Camera Movement/Angle Chip Panel
**Commit:** `2011174`

Collapsible **Camera** section below the negative prompt field, visible in video + create mode only.

Three chip groups:
- **Movement:** static shot, slow zoom in/out, dolly in/out, pan left/right, tilt up/down, tracking shot, handheld, aerial drone, crane shot
- **Angle:** eye level, low angle, high angle, bird's eye view, over-the-shoulder, dutch angle, POV
- **Shot:** extreme close-up, close-up, medium shot, wide shot, establishing shot

Selected chips are appended to the prompt as `, <chip1>, <chip2>` at generation time — the prompt textarea stays clean. Active count shown as purple badge on the collapsed header. Clear all button removes all selections.

## Commit Summary

| Commit | Description |
|--------|-------------|
| `8d917af` | analyzeReferenceImages — Gemini vision injection into Veo prompt |
| `939c954` | Vertex AI migration for veo-3.1-generate-001 GA |
| `b1cb990` | Friendly error for Veo RAI input image rejection |
| `9ba7d31` | Wire personGeneration into Veo config |
| `f2e7e84` | Vertex AI download — handle GCS URI and HTTPS URI |
| `b166637` | Prevent sign-out on deploy restart; fix silent email failure |
| `9e0899b` | RAI auto-retry — face photo → text-to-video fallback |
| `580d03f` | Ingredients to Video UI + extractVideoUri download hardening |
| `2011174` | Camera movement/angle chip panel |

## Key Technical Notes

- `@google/genai` v2.6.0 supports both Developer API (`apiKey`) and Vertex AI (`vertexai: true`) via the same SDK — different init, same method signatures
- Vertex AI Veo operation response: `operation.response.generatedVideos[0].video` — the `video` object shape varies; `extractVideoUri()` handles all known field names
- `personGeneration` in Veo config controls OUTPUT person generation, not INPUT image acceptance — anti-deepfake policy is enforced separately at the input level regardless of this setting
- Camera chips append to prompt at call time, not to the textarea — this keeps the textarea editable for subsequent runs without accumulating chip terms

## Related Notes
- [[Decision-Log]]
- [[AI-Services]]
- [[Reference-Workflows]]
