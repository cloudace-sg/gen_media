---
tags: [dev-log, session, research, omni, brand-kit]
status: updated
---

# Session — 2 July 2026

Focus: Research day. Gemini Omni Flash capabilities, brand kit auto-set analysis, brand application to generated assets, SOW expansion with 3 new Omni Flash items.

---

## Research: Gemini Omni Flash

Full research note: [[Gemini-Omni-Flash]]

### Key findings

- **Model ID:** `gemini-omni-flash-preview` — live as of Jun 30, 2026
- **Core differentiator vs Veo 3.1:** video-to-video editing via Interactions API. Veo cannot accept existing video as input. Omni can.
- **Pricing:** $0.10/s vs Veo 3.1 standard $0.40/s — 4× cheaper
- **Output:** 720p only, 3–10s, MP4 with native audio
- **Not a model swap:** uses `generateContent` not `generateVideos` — requires new `generateVideoOmni()` method

### What it unlocks for this project

1. **Apply Branding to Video** — pass My Files video + logo as `<IMAGE_REF_1>` → Omni re-renders with brand applied. First time video-level brand application is possible without ffmpeg-only overlay.
2. **Conversational video editing** — stateful Interactions API enables generate → tweak → tweak → save thread. This is the concrete implementation path for SOW-29.
3. **Audio-first generation** — provide voiceover audio, model generates synced video. New creative workflow not in original SOW.
4. **Style transfer on existing video** — "make it anime", change background, change lighting on a finished clip.
5. **Native text rendering** — captions, CTAs baked into video without ffmpeg. Simplifies SOW-16.

### What it cannot do (relevant limits)
- 720p ceiling — no 1080p/4K
- Cannot add voiceover to existing video — audio-first generates new video around the audio, not dub onto existing
- Voice/speech editing blocked — cannot change what a real person says
- No negative prompts, no system instructions

---

## Research: Brand Kit Auto-Set Analysis

Reviewed `BrandAssetsPage.jsx` and `brandkit.js` to identify what can be auto-populated without user action.

| Auto-set | Trigger | Method | Cost |
|---|---|---|---|
| Color palette | Logo or hero upload | Canvas pixel clustering client-side | Free |
| ID Grid Master = Hero Asset | Hero set | Copy URL to `idGridMaster` | Free |
| Generate all 15 shots | Master confirmed | Single "Generate Everything" CTA | Gemini × 15 |
| Brand description field | Logo/hero upload | `researchProductWithSearch()` once, stored in kit | 1 Gemini + Search |
| Font suggestion | Logo upload | Gemini vision → match Google Fonts list | 1 Gemini call |

### Web research context gap (SOW-10 adjacent)
`gridProductContext` is ephemeral React state — lost on page refresh, never persisted to `brandkit.json`. The `researchProductWithSearch()` call runs repeatedly instead of once. Fix: write `productDescription` field into brand kit, surface as editable text, share across all generation surfaces.

---

## SOW Changes This Session

### New items added

| SOW | Feature | Model | Phase |
|---|---|---|---|
| SOW-34 | Apply Branding to Video | Omni Flash video-to-video | 7 |
| SOW-35 | Conversational Video Editing | Omni Flash Interactions API | 7 |
| SOW-36 | Audio-First Video Generation | Omni Flash audio → video | 7 |

### Existing items updated
- **SOW-29** (Progressive Refinement) — now has a concrete implementation path: Omni Flash Interactions API via SOW-35
- **SOW-16** (Text & CTA Overlay Editor) — Omni native text rendering reduces scope from ffmpeg post-process to prompt engineering

### Totals
33 → 36 SOW items. 4 done, 3 partial, 29 pending.

---

## UI Ideas Identified (not yet specced as SOW)

1. "Apply Branding" button on My Files video cards → Omni Flash brand application
2. "Edit This Video" drawer with quick-action chips (Remove / Add / Restyle / Text / Lighting)
3. Conversation thread UI for iterative editing (generate → tweak → save any version)
4. Restyle picker (anime, cinematic, lo-fi, etc.)
5. Quick edit chips on video player
6. Multi-subject reference slots with `<IMAGE_REF_N>` tagging
7. Audio-first tab in PromptDrawer (upload voiceover → generate synced video)
8. Timing/shot script editor (timecode syntax)

---

## Files Changed

| File | Change |
|---|---|
| `docs/Gemini-Omni-Flash.md` | New — full research note |
| `docs/AI-Services.md` | Added Omni Flash section with capability table, policy, planned integration surface |
| `docs/SOW_STATUS.md` | Added SOW-34/35/36; updated SOW-16 and SOW-29 notes; totals → 36 items |
| `docs/Session-Jul02.md` | This file |

---

## Related
- [[Gemini-Omni-Flash]] — full capability research
- [[AI-Services]] — model catalogue
- [[SOW_STATUS]] — updated tracker
- [[Session-Jul01]] — SOW catchup session
