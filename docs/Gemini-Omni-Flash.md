---
tags: [research, gemini, omni, video-generation, api]
status: updated
---

# Gemini Omni Flash — Research Notes

Last updated: 2026-07-02

Research conducted Jul 1–2, 2026. Sources: Google AI for Developers official docs, VentureBeat, PixVerse, WaveSpeed, OpusClip.

---

## What It Is

Gemini Omni Flash is a new model family separate from Veo 3.1, announced at Google I/O 2026 (May 19) and released to API on June 30, 2026. It is not a replacement for Veo — it is complementary: Veo generates, Omni edits.

**Model ID:** `gemini-omni-flash-preview`
**Status:** Preview as of Jun 30 2026
**Context window:** 1,048,576 tokens

---

## Output Specs

| Spec | Value |
|---|---|
| Resolution | 720p only (hard ceiling) |
| Frame rate | 24 FPS |
| Duration | 3–10 seconds |
| Format | MP4 with native audio |
| Aspect ratios | 16:9 (default) or 9:16 |
| Delivery | Base64 (<4MB) or URI polling (>4MB) |
| Watermark | SynthID (invisible, baked into pixels) |

---

## Pricing

$0.10/second of 720p video output (billed at 5,792 tokens/second at $17.50 per 1M output tokens).

Comparison: Veo 3.1 standard = $0.40/s. Omni Flash is 4× cheaper per second.

---

## Full Capability List

### Generation modes
- **Text → Video** — generate from text prompt with native audio
- **Image → Video** — animate a reference image; model interprets role from prompt
- **Subject reference → Video** — multiple images with `<IMAGE_REF_N>` tags, each a distinct subject (product + person + scene), combined into one generation
- **Audio → Video** — provide a voiceover/audio file, model generates video that syncs to its rhythm, pacing, and cuts
- **Video → Video (editing)** — pass existing video via Files API + edit prompt; model edits while preserving unmentioned elements

### Video editing operations
- Add objects to a scene
- Remove objects from a scene
- Change background
- Change lighting / atmosphere
- Apply style transfer (e.g. "make it anime")
- Modify text or signage visible in the scene
- Add new visual effects

### Conversational / stateful editing (Interactions API)
- Multi-turn editing via `previous_interaction_id`
- Each turn builds on the previous video output
- Model preserves what you don't mention
- Designed for iterative creative refinement: generate → tweak → tweak → finalise
- Works across multiple sessions of the same generation thread

### Native text rendering
- Readable captions, titles, labels baked into video pixels
- Cross-frame coherence (text stays consistent across frames)
- Languages: English, Chinese, Japanese, Korean
- Supports animation styles in prompt ("fade in", "typewriter")

### Audio generation
- Every video gets auto-generated audio by default
- Describe desired audio in prompt: music style, SFX, ambience
- Audio-first workflow: provide recorded voiceover → model generates video synced to it
- Dialogue and music both supported in generation

### Timing and shot control
- Timecode syntax: `[0-3s] action [3-6s] action [6-10s] action`
- Natural language timing: "After 3 seconds..."
- Rapid-fire sequences at half-second intervals
- Single continuous shot / no scene cuts constraints

### Image role tagging
- `<FIRST_FRAME>` — designates the starting frame image
- `<IMAGE_REF_N>` — designates a reference subject image (can use multiple)

---

## What Omni Flash Can Do That Veo 3.1 Cannot

| Capability | Omni Flash | Veo 3.1 |
|---|---|---|
| Edit an existing video | ✅ | ❌ |
| Stateful multi-turn editing | ✅ Interactions API | ❌ |
| Remove/add objects to existing video | ✅ | ❌ |
| Style transfer on existing video | ✅ | ❌ |
| Audio-first (audio → video sync) | ✅ | ❌ |
| Multiple tagged subject references | ✅ `<IMAGE_REF_N>` | Limited |
| Cost per second | ✅ $0.10 | $0.40 (standard) |

## What Veo 3.1 Can Do That Omni Flash Cannot

| Capability | Veo 3.1 | Omni Flash |
|---|---|---|
| 1080p / 4K output | ✅ | ❌ 720p only |
| Lip-synced dialogue (speech in `"quotes"`) | ✅ | ❌ |
| Negative prompts | ✅ | ❌ |
| System instructions / temperature / top_p | ✅ | ❌ |
| Higher generation quality | ✅ premium | Flash-tier |

---

## Real Human Video Editing — Policy

**What works:**
- Upload real-world video via Files API (≤10 seconds, must hold rights)
- Edit background, lighting, objects, style around the person
- Person's appearance stays intact — you're editing the scene, not the person

**Blocked:**
- **Speech/audio editing** — cannot change what a real person is saying. Google's own launch post: *"we are still working to test this and better understand how we can bring this capability to users responsibly."* Hard block.
- **Recognizable/public figures** — classifier-based, not a fixed list
- **Minors** — blocked EEA/UK/Switzerland; implied globally restricted
- **Entire feature** — unavailable in EEA, Switzerland, UK

**Practical implication for this project:** Editing backgrounds, adding brand overlays, restyling scenes around a real spokesperson is in the allowed zone. Changing what they say or look like is not.

---

## Voiceover + Captions — What Actually Works

**The direction is reversed from what you might expect:**

| Workflow | Supported |
|---|---|
| Script/audio → generate new synced video | ✅ Audio-first generation |
| Captions baked into new generated video | ✅ Native text rendering |
| Add voiceover to existing uploaded video | ❌ Not supported |
| Add captions to existing uploaded video (edit) | 🟡 May work via edit prompt — not documented |
| Voice editing (change existing speech) | ❌ Explicitly blocked |

**For post-production dubbing on existing video:** Use ffmpeg to mux a TTS-generated audio track (Google Cloud TTS or ElevenLabs) onto the video. Zero AI cost, deterministic, works at any resolution.

---

## Hard Limitations

| Limitation | Notes |
|---|---|
| 720p ceiling | No 1080p/4K path |
| Max 10s per clip | Stitch with Scene Extension for longer |
| No negative prompts | Prompt-only control |
| No system instructions / temperature / top_p | Non-configurable model |
| No audio reference input | Text description only |
| No video references >3s | Not correctly processed |
| No multiple video inputs | One video at a time |
| No voice/speech editing | Safety restriction |
| No video extensions/interpolation | Not supported |
| EEA/Switzerland/UK blocked | For uploaded video editing |

---

## Recommended Pipeline for This Project

| Use case | Tool |
|---|---|
| Generate new product video | Veo 3.1 |
| Apply branding to generated video | Omni Flash (video-to-video) |
| Iterative video refinement | Omni Flash (Interactions API) |
| Style transfer on existing video | Omni Flash |
| Lip-synced spokesperson video | Veo 3.1 |
| 1080p/4K output | Veo 3.1 |
| Precise logo watermark on video | ffmpeg |
| Add voiceover to finished video | ffmpeg + TTS |
| Audio-first video (script → visuals) | Omni Flash |
| Apply branding to generated image | Gemini 3.1 Flash Image (Nano Banana 2) |

The natural two-step pipeline: **Veo 3.1 generates → Omni Flash edits/brands**.

---

## UI Ideas Mapped to Capabilities

| UI Feature | Omni Capability | SOW Alignment |
|---|---|---|
| "Apply Branding" button on My Files video | Video-to-video + image ref | New item |
| "Edit This Video" drawer on My Files | Video-to-video editing | SOW-29 |
| Conversation thread (chat-style refinement) | Interactions API stateful | SOW-29 full |
| "Restyle" picker (anime, cinematic, etc.) | Style transfer | New |
| Text overlay editor (captions, CTAs) | Native text rendering | SOW-16 partial |
| Quick edit chips on video player | Video editing | SOW-29 |
| Multi-subject reference slots | `<IMAGE_REF_N>` tagging | SOW-2 extension |
| Audio-first generation (script → video) | Audio → Video | New |
| Timing/shot script editor | Timecode prompt syntax | SOW-6 adjacent |

---

## SOW Implications

- **SOW-29** (Progressive Refinement / Chat-Style) — Omni Flash's Interactions API is the exact implementation path. Previously this was architecture TBD; now it's a concrete model + API pattern.
- **SOW-16** (Text & CTA Overlay Editor) — Omni Flash native text rendering reduces this to a prompt-engineering problem rather than ffmpeg post-process.
- **SOW-33** (Talking Avatar) — Veo 3.1 remains the right model (lip-sync); Omni Flash cannot do speech.
- **New item needed** — "Apply Branding to Video" (Omni Flash video-to-video + brand kit integration) not covered in current SOW.
- **New item needed** — "Audio-first generation" (script/voiceover → synced video) not covered in current SOW.

---

## Related
- [[AI-Services]] — model catalogue and generation pipeline
- [[Session-Jul02]] — research session
- [[SOW_STATUS]] — feature tracker
- [[SOW_DETAILED]] — SOW-29, SOW-16, SOW-33 specs
