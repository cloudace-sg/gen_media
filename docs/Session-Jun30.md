---
tags: [dev-log, session, veo, new-moon, video-generation]
status: updated
---

# Session — 30 June 2026

Focus: New Moon product video generation for Bird's Nest and Essence of Chicken using VEO 3.1. Prompt engineering for product fidelity, cap removal action sequence, and VEO safety filter navigation.

---

## Context

Following the Jun 29 session (World Cup commercial + model upgrade), the client requested two separate single-product videos:
- A woman at home late at night watching TV, picking up and drinking the Bird's Nest product
- Same woman, same setting, doing the same with Essence of Chicken
- Both videos require: pick up → uncap → place cap on table → drink without cap

Reference assets are in `/home/angieng/images/` (18 images total, excluding `image (11).png` which is AI-generated with garbled text).

---

## Scripts Built This Session

| Script | Purpose | Output |
|---|---|---|
| `scripts/generate-birdsnest-lady.js` | Bird's Nest single-product video | `~/veo-birdsnest-lady-v5.mp4` |
| `scripts/generate-chicken-essence-lady.js` | Essence of Chicken single-product video | `~/veo-chicken-essence-lady-v3.mp4` |

Both read `GOOGLE_GEMINI_API_KEY` from `server/.env` via dotenv. Both use `veo-3.1-generate-preview` with `personGeneration: 'allow_all'`, `aspectRatio: '9:16'`, `durationSeconds: 8`.

---

## Reference Image Strategy

VEO hard limit: 3 reference images maximum. Selection rationale:

**Bird's Nest** — 1 image (see Safety Filter section below):
- `20250328_BNWF_LS_Bottle_Front.jpg` — front hero, capped, red label + gold lid

**Essence of Chicken** — 3 images:
- `NMEOC24_TRD_Bottle_Front_Dec2024.jpg` — front hero, capped, green cap + green label
- `images (7).jpeg` — real hands mid-uncap (green cap being lifted off bottle)
- `image (10).png` — additional EOC angle, no Bird's Nest in frame

### Asset Map (full `/home/angieng/images/` catalogue)

| File | Product | State | Notes |
|---|---|---|---|
| `20250328_BNWF_LS_Bottle_Front.jpg` | Bird's Nest | Capped | Front hero, gold lid, red label |
| `20250328_BNWF_LS_6sBox_AngleFront_hi.jpg` | Bird's Nest | Capped | 6-bottle box shot, not useful for VEO |
| `image (9).png` | Bird's Nest | Capped | Transparent jar, golden liquid visible through glass |
| `image (6).png` | Bird's Nest | Capped | Back label, gold lid on |
| `WhatsApp Image 2026-06-29 at 15.29.27.jpeg` | Bird's Nest | Capped | Back label, nutrition info |
| `WhatsApp Image 2026-06-29 at 15.29.27 (1).jpeg` | Bird's Nest | Capped | Back, slightly different angle |
| `WhiteBG_Thumbnail_Less-Sweet_White-Fungus-Rock-Sugar_20s_WhiteBG_06.jpg` | Bird's Nest | Capped | Back/side, white background |
| `13208346_BXL1_20211123.webp` | Bird's Nest | Capped | Back/side angle |
| `NMEOC24_TRD_Bottle_Front_Dec2024.jpg` | Essence of Chicken | Capped | Front hero, green cap, green label |
| `image (10).png` | Essence of Chicken | Capped | Front, darker angle |
| `image (12).png` | Essence of Chicken | Capped | Back label |
| `image (7).png` | Essence of Chicken | Capped | Back label, cap visible |
| `WhatsApp Image 2026-06-29 at 15.05.21.jpeg` | Essence of Chicken | Capped | Back, green cap |
| `WhatsApp Image 2026-06-29 at 15.05.36.jpeg` | Essence of Chicken | Capped | Back, different angle |
| `New-Moon-Black-Boned-Chicken-Essence-68ml-x-8-bottles-Bottle-Back2.jpg` | Essence of Chicken | Capped | Back label |
| `images (7).jpeg` | Essence of Chicken | Uncapping | Hands removing green cap mid-motion — key action shot |
| `image (8).png` | Both | Uncapped | Both products side by side, caps removed beside each |
| `image (11).png` | — | — | AI-generated generic jar, garbled text — excluded always |

---

## VEO Safety Filter Learnings

The Bird's Nest video triggered VEO's safety filter multiple times. Root cause identified: **"pale golden liquid in a transparent glass jar, consumed late at night"** pattern-matches alcohol consumption in VEO's classifier.

### What triggered the filter
- Over-engineered prompts with `ABSOLUTE RULE` caps-lock instruction language
- Multiple reference images including `image (8).png` (both products together) — the combined image seemed to increase filter hit rate
- Detailed clinical language about "liquid flowing into mouth" and "level decreasing"

### What resolved it
1. **Explicit non-alcoholic framing** — adding the phrase `"traditional Chinese nutritional health food supplement, not an alcoholic beverage"` to the prompt
2. **Single reference image only** — `image (8).png` was the likely secondary trigger; dropping to 1 image (front hero only) resolved the blocking pattern
3. **Narrative/cinematic style** — describing the scene as a continuous story rather than shot-by-shot instructions
4. **Avoid `ABSOLUTE RULE` language** — overly coercive prompt language increases filter hit rate

### Filter is stochastic
The identical prompt passed on one attempt and failed on the next. Multiple retries with incremental changes are normal. The Essence of Chicken video (dark brown liquid, clearly not alcohol) never triggered the filter.

---

## Prompt Engineering Patterns

### Effective: numbered sequential actions
Describing each physical action as "First... Second... Third..." gives VEO a clear ordered script for the prop state at each moment. Most useful for the cap-removal sequence where the prop state must change (cap ON → cap OFF → cap on table → bottle held without cap).

### Effective: hand-relative size anchors
VEO tends to generate the Bird's Nest jar too large. Grounding the size description relative to the human hand works well:
> *"small enough that one hand wraps fully around the glass body... NOT a large jar... her hand should almost fully wrap around it"*

### Effective: prop state at each stage
Rather than describing the action abstractly, describing what each physical prop looks like at each moment is more reliable:
> *"The gold lid is now ON the table. The jar in her hands has no lid — the top of the jar is open."*

### Less effective
- Long numbered shot lists with second counts (VEO ignores timing)
- Repeated product fidelity rules in every shot description (dilutes the key action instructions)
- Multiple reference images when the safety filter is actively triggering

---

## Product Descriptions (for future prompt reuse)

### New Moon Premium Bird's Nest with White Fungus
- **Jar shape**: compact wide-mouth cylindrical transparent glass jar, 150g
- **Size**: small — fits in one palm, fingers wrap around the circumference
- **Lid**: flat wide circular metallic gold screw cap (disc-shaped, NOT a tall cap), with red "OPEN 旋开" arrows on the rim
- **Label**: glossy red, gold fretwork border, yellow crescent moon logo + "NewMoon Since 1959", large 燕窝 calligraphy centred, "Premium Bird's Nest with White Fungus" below, green "LESS SWEET 少糖" badge at bottom
- **Contents**: pale golden translucent liquid, suspended bird's nest strands and white fungus pieces visible through the transparent glass

### New Moon Essence of Chicken
- **Bottle shape**: small squat dark amber glass bottle, 68ml, wider at shoulder narrowing toward base
- **Cap**: bright vivid green ribbed plastic screw cap, prominent vertical ribbing for grip
- **Label**: solid green background, white+gold header "NewMoon SINCE 1959" with yellow crescent moon logo left, bold white "ESSENCE of CHICKEN 鸡精" centre, red heartbeat ECG pulse line behind text, Halal certification seal bottom-left
- **Contents**: dark brown opaque liquid

---

## Versions Generated

| File | Version | Notes |
|---|---|---|
| `~/veo-birdsnest-lady.mp4` | v1 | First successful lady video (with text overlays) |
| `~/veo-birdsnest-lady-v4.mp4` | v4 | Size-corrected (hand-relative anchor) |
| `~/veo-birdsnest-lady-v5.mp4` | v5 | Latest — no text, continuous narrative, cap-off sequence |
| `~/veo-chicken-essence-lady.mp4` | v1 | First successful EOC lady video |
| `~/veo-chicken-essence-lady-v2.mp4` | v2 | Locked label/logo |
| `~/veo-chicken-essence-lady-v3.mp4` | v3 | Latest — detailed product lock, numbered action sequence |

---

## Related
- [[AI-Services]] — standalone scripts section, VEO generation modes
- [[Session-Jun29]] — World Cup commercial, model upgrade 2.5→3.5 Flash
- [[Decision-Log]]
