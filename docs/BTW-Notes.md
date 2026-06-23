---
tags: [btw, side-notes]
status: living
---

# BTW Notes

Informal questions, observations, and side discussions captured mid-session.

## 2026-06-23

- Built the `/btw` save skill (`~/.claude/skills/btw/SKILL.md`) — a Claude Code slash command that appends a dated bullet to `docs/BTW-Notes.md` and commits it. Triggered by user asking to capture side discussions that kept getting lost between sessions.
- `/btw` with no args will scan the current conversation for informal detours and offer to save them. `/btw <text>` saves immediately. Registered globally in `~/.claude/CLAUDE.md`.
- The pattern that prompted this: user had been using side Claude windows (/btw) for quick questions (Gemini OAuth tokens, video analysis, TRD bottle feedback) and those discussions weren't being captured in Obsidian alongside the main session work.
