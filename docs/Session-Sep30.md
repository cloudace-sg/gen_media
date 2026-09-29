---
tags: [dev-log, testing, deploy]
status: updated
---

# Session Sep 30 — SOW-11 Deploy Verification + Product-Swap Finding

Follow-up to [[Session-Sep29]]. User asked to test the newly shipped **SOW-11 "Reverse-Engineer to Prompt" / Recreate This** feature.

## 1. Local environment was not runnable

`node_modules` were empty at root, `client/`, and `server/` — nothing had been installed since checkout. `npm run install:all` fixed it. Separately, the client dev server (CRA + webpack-dev-server 4.15.2) failed to boot in this container with `options.allowedHosts[0] should be a non-empty string` — a known CRA issue when `react-dev-utils` can't resolve a LAN IP for `lanUrlForConfig` inside a container with no normal network interface. Worked around with `DANGEROUSLY_DISABLE_HOST_CHECK=true`. Not committed as a fix since it's environment-specific, not a code bug.

## 2. Deploy status check — confirmed live

The Cloud Run service at `gen-media-demo` was suspected stale. Checked with `gcloud`:

- The build for `2748f73` (the original SOW-11 commit) **failed** — same `eslint`/Docker break documented in [[Session-Sep29]] §5, fixed by `4655c10`.
- Current live revision `gen-media-demo-00400-pfn` was built from `be455a2` (build `4b49a968`, SUCCESS, 2026-09-29T14:26–14:33 UTC), serving 100% traffic. `be455a2` is downstream of `2748f73` in git history, so all SOW-11 code is included.
- **Conclusion: SOW-11 is live in production.** User couldn't find it because the "Recreate This" wand-icon button lives on My Files thumbnails / the ImageViewer toolbar / the file detail modal — not on the bare `/canvas` page.

Logged in [[Infrastructure]] deployment log.

## 3. Functional test — reverse-engineer pipeline

No browser automation was available this session (no `chromium-cli`, no local Playwright, Claude-in-Chrome not connected) so the UI click-path itself wasn't driven. Instead verified the underlying `GeminiService.reverseEngineerPrompt()` logic directly via `scripts/analyze-video.js --reverse-prompt` against `test.png` — same code path the `/api/prompt/reverse` route calls.

- ✅ Image reverse-engineering returns well-formed JSON (`prompt`, `text_overlay_scenes`, `style_tags`, `suggested_style_id`, `suggested_aspect_ratio`, `confidence_notes`).
- ✅ `POST /api/prompt/reverse` correctly rejects unauthenticated requests (`"Missing token"`) before body validation runs — auth middleware ordering is correct.

## 4. Finding — product-swap fidelity rules aren't grounded in the input image

Ran `--reverse-prompt --product-image test.png` (test.png is a flat solid-color swatch, no bottle/cap/liquid of any kind). `describeProductForReverseEngineering()` (`gemini.js:516`) still returned "CAP REMOVAL REALISM" and "CONSUMPTION REALISM" fidelity rules describing bottle-opening and drinking motion.

That language does **not** appear in the prompt template at `gemini.js:539-556` (which only asks for 4 generic rules: shape/size, logo, label, cross-scene consistency). It matches near-verbatim wording from the separate `REVERSE_PROMPT_VIDEO_PROMPT` template (`gemini.js:49-54`), suggesting Gemini is pattern-matching to a "product ad" template from training data rather than describing what's actually in the photo.

**Why it matters**: `describeProductForReverseEngineering()`'s output is injected verbatim into the recreate prompt for product-swap (`gemini.js:704-705`, `"Product to use: ${productDescription}"`). For any non-bottle product (box, jar, pouch, tube), the generated prompt could carry irrelevant cap-unscrewing/drinking instructions that confuse the downstream image/video generation. This is an instance of the broader product-fidelity drift problem already tracked as an open issue (recurring across Veo product-shot work).

**Not fixed this session** — flagging for a follow-up: either constrain the product-description prompt to only describe fidelity rules for packaging elements actually visible (no cap → no cap rule), or add a lightweight post-filter that strips rules referencing elements not mentioned in the visual description.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/gemini.js` (`describeProductForReverseEngineering`, `reverseEngineerPrompt`, `reverseEngineerImagePrompt`, `reverseEngineerVideoPrompt`)
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/prompt.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/scripts/analyze-video.js`

## Related
- [[Session-Sep29]] — SOW-11 implementation + original deploy fix
- [[Infrastructure]] — deployment log entry for this verification
- [[Decision-Log]]
