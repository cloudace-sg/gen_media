---
tags: [btw, side-notes]
status: living
---

# BTW Notes

Informal questions, observations, and side discussions captured mid-session.

## 2026-06-18

- SOW phases 1–6 reviewed — only Phase 1 and 2 have work done; Phases 3–6 untouched. Low-hanging fruits identified: SOW-5 (native audio UI, 0.5d) and SOW-3 (multiple output variations, 1d). SOW-5 needs only a text field in PromptDrawer, no backend changes.
- Created git tag `pre-sow5` at commit `8b30acd` as a named save point before starting audio work. Command to revert: `git reset --hard pre-sow5`.
- Veo 3.1 audio research: only one API param — `generateAudio: true` (boolean, omit or true to enable, false to suppress). Audio is always-on by default for `veo-3.1-generate-001`. No sub-fields for dialogue, SFX, or music control — Google controls the mix.

## 2026-06-19

- Installed `find-skills` skill globally (from vercel-labs/agent-skills via `npx skills add`). After initial per-project install, moved to `~/.claude/skills/` so it's available across all projects. Works by listing available skills in the current session.
- Video analysis standalone exploration: user wanted to explore `scripts/analyze-video.js` as a standalone capability separate from the main app, with the idea of adding it as a feature (SOW-22). Built `scripts/analyze-video.js` and `scripts/test-veo-generation.js` in this session.
- OAuth token paste issue: user tried to paste `AQ.Ab8...` as `GOOGLE_GEMINI_API_KEY` — it worked for that session but expires in ~1h. See [[Gemini-API-Token-Notes]] for full rundown.

## 2026-06-20

- TRD bottle video session (`dd03d86f`, `d6eda1c4`): generated 3 VEO prompt variations (tired-to-energised, stadium-hero, handheld-energy) using the bottle image + reference video. Videos saved to `~/newmoon-*.mp4`. Key insight: need `--variations N` flag on the script and always add `no text, no captions` to suppress hallucinated overlays. See [[Side-Questions-Jun20-21]] for full feedback log.
- Product placement principle from user: "the product logo cannot be tainted, upside down or edited — product placement is very important". Became the core requirement driving `product_id` styleId (added Jun 22).

## 2026-06-23

- Built the `/btw` save skill (`~/.claude/skills/btw/SKILL.md`) — a Claude Code slash command that appends a dated bullet to `docs/BTW-Notes.md` and commits it. Triggered by user asking to capture side discussions that kept getting lost between sessions.
- `/btw` with no args will scan the current conversation for informal detours and offer to save them. `/btw <text>` saves immediately. Registered globally in `~/.claude/CLAUDE.md`.
- The pattern that prompted this: user had been using side Claude windows (/btw) for quick questions (Gemini OAuth tokens, video analysis, TRD bottle feedback) and those discussions weren't being captured in Obsidian alongside the main session work.
