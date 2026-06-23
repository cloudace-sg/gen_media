---
tags: [dev-log, video-analysis, sow-22]
status: updated
---

# Session Jun 20 — Gemini Video Analysis Standalone + VEO Prompt Pipeline

## What Was Built

Standalone video intelligence pipeline in `scripts/` — explore and validate Gemini full-video understanding before integrating as SOW-22.

---

## Scripts

### `scripts/analyze-video.js`
Full video understanding via Gemini 2.5 Flash File API. Upload once, reuse for all operations.

**Modes:**
```bash
node scripts/analyze-video.js <video>                                        # full structured analysis
node scripts/analyze-video.js <video> --reverse-prompt                       # VEO prompt to recreate video
node scripts/analyze-video.js <video> --reverse-prompt --product-image <img> # swap in own product
node scripts/analyze-video.js <video> --all                                  # analysis + reverse prompt
node scripts/analyze-video.js <video> --question "..."                       # ask specific question
```

**Analysis output fields:**
- `summary`, `scenes[]` (start_time, end_time, description, objects, actions)
- `transcript` (full verbatim speech)
- `events[]` (timestamp + notable event)
- `visual_style` (color_palette, lighting, pacing, composition_notes)
- `emotional_tone`, `key_themes[]`
- `text_overlays[]` (timestamp, text, position, style, covers_full_screen)

**Env:** reads from `server/.env` automatically — no manual export needed.

---

### `scripts/test-veo-generation.js`
Fires VEO 3.1 generation from a reverse prompt JSON. Polls until done, downloads video to `/tmp/`.

**Modes:**
```bash
node scripts/test-veo-generation.js --prompt-file /tmp/reverse-prompt.json [--product-image <img>]
node scripts/test-veo-generation.js --prompt-file /tmp/reverse-prompt.json --tweak "make it outdoor"
node scripts/test-veo-generation.js --prompt "..." [--aspect 9:16]
```

**`--tweak` behaviour:**
- Sends original prompt + natural language change to Gemini
- Gemini modifies ONLY the requested aspect
- All product fidelity CAPS notes remain word-for-word
- Tweaked prompt saved to `/tmp/veo-tweaked-prompt.json` for chaining
- Chain tweaks: use `--prompt-file /tmp/veo-tweaked-prompt.json --tweak "..."`

**Model:** `veo-3.1-generate-preview` (Developer API, no GCP project needed for testing)

---

## Product Fidelity Rules (enforced in every generated prompt)

All 6 rules are embedded in `describeProduct()`, `REVERSE_PROMPT_PROMPT`, and the product swap instruction:

1. **SHAPE & SIZE LOCKED** — product dimensions identical in every scene, never resize or morph
2. **LOGO LOCKED** — logo design, colours, layout pixel-identical to reference image in every frame
3. **CAP REMOVAL REALISTIC** — cap must physically rotate and lift off continuously on screen, no teleport/dissolve
4. **CONSUMPTION REALISTIC** — liquid visibly flows from bottle to mouth, bottle level decreases, never cut away before completion
5. **LABEL INTEGRITY** — upright, fully legible, facing camera in every scene
6. **CROSS-SCENE CONSISTENCY** — product looks identical across all scenes

---

## Text Overlay Rules (enforced in every generated prompt)

- Only text from the original video — no invented text
- All taglines run through `proofreadTexts()` — Gemini checks spelling, spacing, grammar before going into VEO prompt
- Each overlay is a short discrete line — never fills the full screen
- High contrast, legible, must not overlap product label
- Random or filler text explicitly prohibited
- Output includes `text_overlay_scenes[]` with timestamp, exact text, position, style, and rule

---

## Tested With

- **Reference video:** `video6170137123941787122.mp4` (NewMoon Essence of Chicken football ad, 18s, 9:16)
- **Product image:** `NMEOC24_TRD_Bottle_Front_Dec2024.jpg`
- **API key:** stored in `server/.env` as `GOOGLE_GEMINI_API_KEY`

---

## Integration Path → SOW-22

When integrating as `POST /api/analyze`:

| Standalone function | Maps to |
|---|---|
| `uploadVideo()` | File API upload in `gemini.js` |
| `describeProduct()` | New `analyzeProductImage()` method |
| `reversePrompt()` | New `reverseEngineerPrompt()` method (already planned in SOW) |
| `proofreadTexts()` | New `proofreadTextOverlays()` method |
| `--tweak` in `applyTweak()` | New `refinePRompt()` method or extend existing |

**Files to create/modify per SOW-22:**
- New: `server/src/routes/analyze.js`
- Modified: `server/src/services/gemini.js` (add 4 methods above)
- Modified: `server/src/index.js` (register route)
- New: `client/src/components/AnalysisReport.js`

---

## Known Limitations

- VEO still struggles with text legibility during fast hand motion — FFmpeg post-processing needed for guaranteed text accuracy
- FFmpeg not yet installed in dev environment (`sudo apt-get install -y ffmpeg` needed)
- Logo and label fidelity improved by prompt rules but not guaranteed — `referenceType: "asset"` anchors this further when integrated into the full app
- VEO Developer API (`veo-3.1-generate-preview`) used for testing — production will use Vertex AI GA model via GCP project
