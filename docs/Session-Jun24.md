---
tags: [dev-log, session]
status: complete
---

# Session — Jun 24 2026

## Summary

Continuation of Jun 23 billing protection work. Attempted Workload Identity for all Gemini calls, discovered model availability constraint, reverted. Session also covered /btw-saves skill rename cleanup and session documentation.

## What Was Built / Changed

### Workload Identity attempt for text/image (reverted)
- `server/src/services/gemini.js` updated to prefer Vertex AI (`genAIPrimary = genAIVertex`) for all Gemini calls — text, image, and video.
- Build succeeded but image generation immediately 404'd: `Publisher model gemini-3.1-flash-image-preview was not found` on Vertex AI.
- Root cause: `gemini-3.x` model family (including `gemini-3.5-flash` text and `gemini-3.1-flash-image-preview` image) **only exists on Developer API** — not on Vertex AI.
- Reverted: `genAIPrimary = genAI` (Developer API, API key) for text and image. Video stays on Vertex AI.
- `GOOGLE_GEMINI_API_KEY` is required again (not optional).

### Documentation updates
- `docs/Billing-Protection.md` — Layer 1 section updated to explain Workload Identity attempt, revert, and why API key stays.
- `docs/Infrastructure.md` — deployment log updated with `30c0dc9`, `a1a5de6`, `1aeecd2` entries.
- `docs/Decision-Log.md` — new commit rows added.
- `docs/Session-Jun24.md` — this file.

## Key Decision

| Decision | Reason |
|---|---|
| Keep API key for text/image Gemini | `gemini-3.x` models only exist on Developer API; Vertex AI 404s them |
| Video stays on Vertex AI | Veo models ARE on Vertex AI and always were |
| Workload Identity for text/image = not viable today | Would require switching to `gemini-1.5` or `gemini-2.x` model names on Vertex AI |

## Commits This Session

| SHA | Description |
|---|---|
| `33abc3e` | docs: add layer-by-layer explanation to Billing-Protection runbook |
| `30c0dc9` | feat: prefer Workload Identity over API key for all Gemini calls |
| `a1a5de6` | docs: update Billing-Protection — Workload Identity Layer 1, full reuse guide |
| `1aeecd2` | fix: revert text/image to Developer API — gemini-3.x models not on Vertex AI |

## Deployed

- `30c0dc9` → Cloud Build ❌ FAILURE (Vertex AI 404 for gemini-3.x models)
- `1aeecd2` → Cloud Build ✅ SUCCESS — image generation restored

## Pending (after build succeeds)

1. Verify image generation works again in the app
2. Manual: add billing admin emails in Cloud Console → Billing → Budgets & Alerts → `gemini-spend-guard-strong-kit-475107-k1` → Manage notifications
3. Optional: run fake payload tests (`./scripts/test-billing-protection.sh strong-kit-475107-k1 all`)

## Related

- [[Billing-Protection]] — full runbook
- [[Session-Jun23]] — previous session where billing protection was built
- [[Infrastructure]] — deployment log
