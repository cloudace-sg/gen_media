---
tags: [dev-log, session]
status: complete
---

# Session — Jun 23 2026

## Summary

Side discussion session focused on security/billing protection design and implementation. No product feature work.

## What Was Built

### /btw-saves skill (renamed from /btw)
- Built `~/.claude/skills/btw-saves/SKILL.md` — Claude Code slash command that appends dated bullets to `docs/BTW-Notes.md` and commits
- `/btw` renamed to `/btw-saves` so `/btw` remains free for informal questions to Claude
- Registered globally in `~/.claude/CLAUDE.md`
- Backfilled side sessions from Jun 18–20 into `docs/BTW-Notes.md`

### Gemini API Billing Protection
Full implementation across 3 layers. Design-only before this session; now coded and deployed.

**Files created:**
- `server/src/middleware/spendLimit.js` — per-user daily Firestore counter, fail-open, admins bypass
- `functions/billingCircuitBreaker/index.js` — Cloud Function disables Gemini API key at 100% budget
- `functions/billingCircuitBreaker/package.json`
- `scripts/setup-billing-protection.sh` — one-command GCP setup, reusable across projects
- `scripts/test-billing-protection.sh` — fake payload tests for all 3 layers

**Wired into `server/src/index.js`:**
- `authenticate + spendLimit` applied to `/api/generate`, `/api/remix`, `/api/video`, `/api/prompt`

**Documentation:**
- `docs/Billing-Protection.md` — full runbook: setup, testing, reuse on new projects
- `docs/BTW-Notes.md` — full Q&A + design discussion captured

## Key Decisions

| Decision | Reason |
|---|---|
| Project-level controls, not folder/org | Simpler, no org admin access needed |
| Drop SCC Premium | Has cost; replaced with free Cloud Monitoring + log-based metrics |
| Cloud Quotas over Billing Budget for blocking | Quotas enforce at API gateway before cost accrues; Budget kept as alert-only |
| Fail-open in spendLimit.js | Firestore errors must never block legitimate users |
| Disable API key at 100% (not billing) | Cloud Run, GCS, Firebase stay up; only Gemini stops |
| `/btw` renamed to `/btw-saves` | `/btw` reserved for informal questions to Claude |

## Commits This Session

| SHA | Description |
|---|---|
| `677a684` | feat: add /btw skill + BTW-Notes.md |
| `814c014` | btw: backfill side sessions Jun 18–20 |
| `ff4bc59` | btw-saves: security/billing Q&A + Firebase deprecation |
| `e1f801d` | btw-saves: security/billing full design |
| `e188cec` | btw-saves: revise design — project-level, no SCC |
| `935f235` | feat: billing protection — middleware, Cloud Function, scripts |
| `d7ba12b` | docs: Billing-Protection runbook |

## Deployed

`935f235` → Cloud Build ✅ SUCCESS → Cloud Run live with `spendLimit.js`

## Pending (manual steps)

1. Set Cloud Run env vars: `GEMINI_DAILY_LIMIT_PER_USER`, `GOOGLE_GEMINI_KEY_NAME`
2. Run `./scripts/setup-billing-protection.sh` — Billing Budget, Pub/Sub, Cloud Function
3. API key HTTP referrer restriction in Cloud Console
4. Cloud Quotas daily cap in Cloud Console

See [[Billing-Protection]] for exact steps.

## Related

- [[Billing-Protection]] — full runbook
- [[BTW-Notes]] — all Q&A from this session
- [[Gemini-API-Token-Notes]] — token types and runbook
- [[Infrastructure]] — deployment log
