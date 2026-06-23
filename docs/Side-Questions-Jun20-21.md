---
tags: [dev-log, side-notes, product-feedback, video-gen]
status: updated
---

# Side Questions & Discussions — Jun 20–21

Quick questions and feedback raised during testing sessions, captured from conversation history.

---

## Product Being Tested

**NMEOC24 TRD Bottle** — reference image used throughout:
`My files/Linux files/NMEOC24_TRD_Bottle_Front_Dec2024.jpg`

Reference video for style/outcome:
`My files/Linux files/video6170137123941787122.mp4`

---

## Video Generation — Recurring Feedback (Jun 20)

User was testing product-to-video generation with the TRD bottle and a human actor. Key pain points raised:

| Feedback | Implication |
|----------|-------------|
| "add one pair of hands when the man interacts with the bottle" | Prompts need explicit hand/interaction instructions |
| "no changes to [product]" / "lock the product bottle shape and size" | Product shape drift is a persistent Veo problem — needs strong locking prompt |
| "the product bottle changed shape, the human has two hands" | Veo struggles to maintain product fidelity across multi-subject scenes |
| "no text / on screen text is wrongly spelt" | Need to suppress on-screen text in all product video prompts |
| "the human unscrew the product — cap is still on" | Veo interprets action instructions loosely; needs very literal prompt phrasing |
| "starting match starts soon text is wrongly spelt" | Hallucinated text overlay — confirmed need for `no text, no captions` in all prompts |
| "give a few variations during generation" | User expects multiple variations per generation run |
| "a Korean young man picks this up from the kitchen table" | Lifestyle/scene context prompts work; subject specifics (ethnicity, setting) are accepted |

---

## Standalone Video Analysis Script (Jun 20)

User tested `scripts/analyze-video.js` with the reference video to break it into 8-second parts and generate Veo prompts for each segment.

**Questions asked:**
- "Which part requires the reference product image?" → Parts involving product close-ups / label shots
- "If I use the project to generate with the prompts — Part 1 uses which function? Part 2? Part 3?" → All use the same Canvas generate flow; product image staged as reference
- "How about continue the frame?" → Use the Extend button (SOW-8, added Jun 17)

**Error encountered:**
```
Failed to download video: Failed after 5 attempts: Could not extract file name from the provided input.
```
Cause: Video file path passed from local Linux file system — server couldn't resolve it. Fixed by using GCS-uploaded URLs instead of local paths.

---

## Hero Asset + ID Grid — Original Feature Request (Jun 21)

User's exact brief that kicked off the Brand Assets overhaul:

> *"Establish a Hero Asset and a 3x3 ID Grid. Generate a Hero Image: Create a flawless, high-resolution lifestyle or studio shot of your product. Create an ID Grid: Compile 4 to 9 varied screenshots of your product (front view, profile, top-down) into a single contact sheet. Upload as a Reference: When generating your video in Veo, upload this contact sheet as a reference."*

This is the intended end-to-end workflow:
1. Upload product photo → generate Hero Image
2. Upload product photo → generate 9 angle shots → stitch into contact sheet
3. Use contact sheet as Veo reference image for consistent product representation across video

---

## Auth — "Why am I logged out?" (Jun 21)

User reported being signed out unexpectedly after previously having persistent sessions.

**Context:** The `postSignIn` endpoint rejects users on 401/403 responses. During a Cloud Run deploy/restart, the server returns 5xx transiently — but the original code signed users out on any `postSignIn` error including transient server errors.

**Fix (commit `b166637`):** Only sign out on explicit 401/403 auth rejections. 5xx and network errors keep the session alive and retry on next navigation.

---

## Product Lock — Open Problem

Across multiple Jun 20 sessions, the product bottle shape/size changed between generations despite reference image. This is a Veo model limitation — product identity is not guaranteed frame-to-frame. Current mitigations:

- `product_id` styleId with explicit "preserve all branding" instruction (added Jun 22)
- Passing master image as `referenceImages` to `remixImagesWithContext`
- ID Grid web research enriches prompt with brand/packaging details

No complete solution yet — worth tracking as a known limitation.
