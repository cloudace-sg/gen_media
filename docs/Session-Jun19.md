---
tags: [dev-log, session, tooling, skills]
status: updated
---

# Session — June 19 2026

Tooling session focused on setting up the Vercel Open Skills CLI for Claude Code.

## What Was Done

### Vercel Open Skills CLI — Global Setup

Installed the `npx skills` ecosystem to extend Claude Code with modular skill packages.

**Skills installed globally** (`~/.agents/skills/`) — available in all projects:

| Skill | Purpose |
|---|---|
| `find-skills` | Meta-skill: discovers and installs skills from the marketplace |
| `deploy-to-vercel` | Vercel deployment workflows |
| `vercel-cli-with-tokens` | Vercel CLI with token-based auth |
| `vercel-composition-patterns` | React compound component patterns |
| `vercel-optimize` | Vercel cost & performance optimization |
| `vercel-react-best-practices` | React/Next.js performance guidelines |
| `vercel-react-native-skills` | React Native / Expo best practices |
| `vercel-react-view-transitions` | React View Transition API |
| `web-design-guidelines` | UI/UX design audit skill |
| `writing-guidelines` | Docs/prose writing audit skill |

**Install commands used:**
```bash
npx skills add vercel-labs/agent-skills --global
npx skills add vercel-labs/skills@find-skills --global
```

Project-level `.agents/skills/` was cleaned out — no per-project duplicates.

### How to Use find-skills

Ask naturally in any project:
- *"Find a skill for Stripe payments"*
- *"Is there a skill for Postgres?"*

The agent invokes `find-skills` automatically and returns the `npx skills add` command.

To search manually:
```bash
npx skills find "topic"
npx skills list
npx skills remove <skill-name>
```

## Key Notes

- PromptScript agent type does not support `--global` — those failures in install output are harmless; Claude Code symlinks correctly
- Skills run with full agent permissions — review `SKILL.md` in `~/.agents/skills/<name>/` before use if in doubt
- `vercel-cli-with-tokens`, `web-design-guidelines`, `writing-guidelines` flagged Medium Risk by Snyk (outbound network calls) — Low Risk by Socket/Gen

## Related Notes
- [[Decision-Log]]
