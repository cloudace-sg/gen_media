---
tags: [dev-log, architecture]
status: updated
---

# Session — 29 September 2026

Focus: SOW-11 (Reverse-Engineer to Prompt) — closed the image-analysis gap in the standalone script, then ported the full pipeline into the app (backend service + route + frontend UI), including product-swap support.

---

## What Was Done

### 1. Image support in `scripts/analyze-video.js`

The Jun 29–30 prototype only handled video (uploads via Gemini Files API, `gemini-3.5-flash` vision). Extended it to auto-detect images by file extension and analyze them inline (base64, no upload/poll needed):

- `IMAGE_ANALYSIS_PROMPT` — image analog of the video structured-analysis schema (summary, subject, composition, palette, lighting, mood, text overlays)
- `IMAGE_REVERSE_PROMPT_PROMPT` — pulls the app's real style presets from `server/src/services/styles.js` (`getPublicStyles()`) so the model's `suggested_style_id` maps to an actual preset the app can apply, not an invented one
- `reverseImagePrompt()` / `analyzeImage()` — mirror the video functions, reusing `describeProduct()` (product swap) and `proofreadTexts()` (text QA pass)
- CLI now dispatches to `analyzeImage` or `analyzeVideo` based on extension

Tested live against `test.png` in both `--reverse-prompt` and `--all` modes — correct JSON, correct style match (`flat_illustration` for a flat color swatch).

### 2. Backend port — `GeminiService.reverseEngineerPrompt()`

Ported the script logic into `server/src/services/gemini.js` following the existing pattern set by `analyzeReferenceImages()`:

- `describeProductForReverseEngineering(imageUrl)` — product-swap description, accepts data: URL or remote URL
- `proofreadTextOverlays(overlays)` — text QA pass
- `reverseEngineerVideoPrompt(mediaUrl, productDescription)` — downloads the video, uploads via Files API, polls to `ACTIVE` (same pattern as the existing `generateVideoVeo3` video-reference handling), then generates the Veo prompt + shot breakdown
- `reverseEngineerImagePrompt(mediaUrl, productDescription)` — downloads and inlines the image, generates prompt + style match
- `reverseEngineerPrompt({ mediaUrl, mediaType, productImageUrl })` — public entrypoint; infers image vs. video from the URL extension if `mediaType` isn't passed

New route: `POST /api/prompt/reverse` in `server/src/routes/prompt.js`. No new mounting needed — `/api/prompt` already has `authenticate` + `spendLimit` applied in `index.js`.

Verified three ways: direct method call, full `GeminiService` instantiation, and a live HTTP request through the actual Express route (bypassing only auth middleware for the smoke test) — all returned `200` with correct JSON.

### 3. Frontend — "Recreate This" flow

- `client/src/services/api.js` — `reverseEngineerPrompt({ mediaUrl, mediaType, productImageUrl })`
- `client/src/store/useStore.js` — `recreatePanel` state (open/loading/error/result/mediaType/sourceImage) + actions; one-shot `pendingRecreate` consumed by `PromptDrawer`
- `client/src/components/RecreatePanel.js` (new) — right-side drawer: source thumbnail, loading/error states, generated prompt, style tags, aspect ratio/duration/style-match/camera info, shot-by-shot breakdown (product interactions + text overlays), confidence notes, "Use this prompt" button
- `client/src/components/ImageViewer.js` — "Recreate" button added to both image and video viewer headers
- `client/src/pages/MyFilesPage.jsx` — "Recreate" action added to card hover actions and the details panel
- `client/src/components/layout/AppShell.js` — mounts `<RecreatePanel />` app-wide (not just Canvas) so it works from My Files too
- `client/src/components/PromptDrawer.js` — new `useEffect` consumes `pendingRecreate`: fills the prompt textarea, sets aspect ratio (image or video setter based on media type), sets style preset for images

### 4. Product swap in the panel

Added a "Swap Product" file picker inside `RecreatePanel.js` — uploading an image re-runs `reverseEngineerPrompt` with `productImageUrl` set, regenerating the prompt with the new product's fidelity rules substituted in. A "Reset" button reverts to the original (no-swap) analysis. Loading state shown inline without tearing down the existing result.

---

## Verification

- `node -c` syntax checks on all touched server files
- Live Gemini calls against `test.png` (script) and via the actual `POST /api/prompt/reverse` HTTP route (server) — both returned correct structured JSON
- `npx eslint` on all changed/new frontend files — zero new warnings (all pre-existing warnings untouched)
- `npm run build` — production build compiles successfully

---

## Key Decisions

1. **No ffmpeg needed** — the original SOW-11 spec assumed frame extraction via ffmpeg for video analysis. The actual implementation uploads the full video to Gemini's Files API and lets Gemini watch it natively, which is simpler and doesn't need the ffmpeg dependency at all.
2. **Image style match uses real app presets** — the reverse-engineered image prompt asks Gemini to pick from the actual `getPublicStyles()` list, not invent a style, so `suggested_style_id` is directly usable by `setStyleId()`.
3. **`RecreatePanel` mounted at `AppShell` level**, not per-page — it's triggered from both Canvas (`ImageViewer`) and My Files, so it needs to be available across routes rather than duplicated per page.
4. **Product swap re-runs the full analysis** rather than patching the existing result client-side — keeps fidelity-rule generation server-side and consistent with the non-swap path.

---

## SOW Status Change

| Item | Change |
|---|---|
| SOW-11 (Reverse-Engineer to Prompt) | 🟡 Partial → ✅ Done |
| SOW Total | 4 done (11%) → 5 done (14%); 3 partial (8%) → 2 partial (6%) |

---

## Related
- [[SOW_STATUS]] — full tracker, SOW-11 now marked Done
- [[Video Analysis Pipeline]] — original Jun 29–30 prototype this session built on
- [[Session-Jul01]] — when SOW-11 was first marked Partial

---

## 5. Deploy troubleshooting — eslint build break

First Cloud Build deploy attempt (commit `2748f73`, build `a8eb92a8`) failed on `Failed to compile` / `Environment key "jest/globals" is unknown`. Root cause: no `package-lock.json` in `client/`, so Cloud Build's fresh `npm install` resolved a newer `eslint-plugin-jest` than what's installed locally, which no longer registers the `jest/globals` ESLint environment that `eslint-config-react-app`'s `react-app/jest` override still requires. Since the project has zero test files, dropped `react-app/jest` from `client/package.json`'s `eslintConfig.extends` — verified locally (background build, exit 0), committed as `4655c10`, redeployed successfully (build `d34442c9`, revision `gen-media-demo-00389-8qd`).

The deploy-logging hook briefly mis-recorded this as two `FAILED` entries in `docs/Infrastructure.md` (it only sees the immediate tool-call result, not the background build's actual outcome) — corrected manually.

---

## 6. Token-discipline retrospective

User asked for a review of this session's Claude Code token usage. No live token-metering tool exists for self-inspection (`/cost` is the real number, run by the user), so this was a qualitative audit of the transcript instead. Concrete finding: `PromptDrawer.js` (1299 lines), `ImageViewer.js` (639 lines), and `useStore.js` (323 lines) were each read in full for orientation, when this project's own `graphify explain "<name>"` already gives callers/callees/file:line in ~15 lines — the project's existing 3-Layer Query Rule (in `CLAUDE.md`) was underused this session.

**Changes made:**
- `CLAUDE.md` — strengthened rule 3 of the 3-Layer Query Rule with an explicit "don't read cold" callout, and added a new "Efficient Tool Usage" section: filter noisy build/deploy output before it lands in context, use `offset`/`limit` reads, use narrow `ToolSearch` queries (`select:<name>` over vague keywords), fork log-heavy investigation. Committed as `72c8505`.
- Cross-session memory `feedback_token_discipline.md` saved to the auto-memory system, so this applies automatically in future sessions on this project without being re-explained.

**Why this matters:** the project already has tooling (graphify) that solves the "get oriented in a large codebase" problem cheaply; the fix here is behavioral (use it consistently) not infrastructural (nothing new to build).
