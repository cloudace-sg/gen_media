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
- No `/recap` skill exists — discussed whether to build one that shows today's BTW bullets. No decision made yet.
- **Q: How to mitigate Gemini API token hacking leading to cost increase?** → 7 steps: API key restrictions (HTTP referrer + API scope), quota limits, server-side rate limiting, never expose key client-side, Firebase Auth on every Gemini route, Cloud Monitoring spike alerts, Secret Manager + 90-day rotation.
- **Q: How to implement an automated Cloud Billing Circuit Breaker?** → Billing Budget → Pub/Sub → Cloud Function. Option A: disable billing entirely (nuclear, full outage). Option B (recommended): disable only the Gemini API key via API Keys Admin API so other services stay up.
- **Q: How to add server-side spend tracking?** → `spendLimit.js` Express middleware using Firestore per-user counters (hourly + daily). Firestore transaction for atomic increment. Admins bypass. Fail open on errors so legitimate users are never blocked.
- **Q: Does the 70/90/100/120% tiered threshold make sense?** → Yes. 70%: email alert only. 90%: throttle per-user limits via dynamic Firestore flag. 100%: block all Gemini calls via Cloud Quotas (429 to callers, services stay up). 120%: disable Gemini API key only (not billing — Cloud Run, GCS, Firebase all stay up).
- **Q: How to implement a Firestore spend-control flag across all projects?** → Single dedicated "control" project hosts `systemFlags/spendStatus`. All projects read from it via cross-project IAM with Workload Identity Federation (no JSON key files). `spendLimit.js` uses a separate `controlDb = new Firestore({ projectId: 'control-project' })`. Per-user spend counters stay in each project's own Firestore.
- **Q: Is Cloud Quotas better than Billing Budget for circuit breaking?** → Yes for this use case: Cloud Quotas enforce at the Google API gateway before cost accrues, no service termination, set at folder level to cascade across all projects. Billing Budgets kept as alert-only, never used to terminate.
- **Q: Best setup to cover all hacking and cost anomaly scenarios?** → 5-layer stack: (1) Identity — Workload Identity, Secret Manager, VPC SC, Org Policy; (2) API/Network — Cloud Armor WAF, Cloud Quotas, API key restrictions; (3) App — Firebase Auth, `spendLimit.js`, Cloud Run instance limits; (4) Detection — SCC Premium ETD, Cloud Audit Logs, Monitoring alerts, Billing Budgets as alerts; (5) Recovery — surgical circuit breaker, 90-day key rotation, separate projects per env, incident runbook.
- **Q: Is SCC useful for Gemini API token hacking detection?** → Yes for detection: SCC Premium Event Threat Detection catches credential exfiltration, anomalous API usage, container compromise. Gap: SCC does not monitor Gemini token consumption or spending and cannot block calls. Pair with Cloud Quotas (prevention) and Billing Budgets (cost alerting).
- **Q: Is Firebase deprecating?** → Firebase Studio (browser IDE, formerly Project IDX) is shutting down — new workspaces stopped 22 Jun 2026, full shutdown 22 Mar 2027. Firebase backend platform (Auth, Firestore, Admin SDK, App Check) is NOT deprecated and actively maintained. gen_media is unaffected — it uses Firebase as backend, not as IDE.
- **Security/Billing Design (design-only, not implemented):**
  - **Tiered thresholds:** 70% → email alert only; 90% → throttle per-user via Firestore flag; 100% → Cloud Quotas block Gemini (429, services stay up); 120% → disable Gemini API key via API Keys Admin API (not billing — app stays up).
  - **spendLimit.js middleware:** Firestore per-user counters (`users/{uid}/spend/{YYYY-MM-DD}`), atomic transaction increment, hourly+daily limits, admins bypass, fail open on Firestore errors.
  - **Cloud Quotas (preferred circuit breaker):** enforces at Google API gateway before cost accrues, set at folder level to cascade across all projects. Billing Budgets used as alert-only at each tier, never to terminate.
  - **Cross-project Firestore control flag:** dedicated "control" project hosts `systemFlags/spendStatus` (`ok` / `throttled` / `blocked`). App projects read via cross-project IAM + Workload Identity Federation — no JSON key files. `const controlDb = new Firestore({ projectId: 'control-project-id' })`.
  - **5-layer defence stack:** (1) Identity — Workload Identity, Secret Manager 90-day rotation, VPC SC, Org Policy; (2) API/Network — Cloud Armor WAF, Cloud Quotas folder-level, API key referrer+scope restrictions; (3) App — Firebase Auth on all routes, spendLimit.js, Cloud Run max-instances; (4) Detection — SCC Premium ETD, Cloud Audit Logs, Monitoring alerts, Billing Budgets as alerts; (5) Recovery — surgical key disable (not billing), key rotation, separate projects per env, incident runbook.
  - **SCC gap:** catches credential exfiltration + anomalous API usage but cannot monitor Gemini spend or block calls — pair with Cloud Quotas for prevention.
  - **Implementation order (if building):** (1) API key restrictions in Cloud Console (zero code); (2) Cloud Monitoring spend alert; (3) Billing Budget tiers; (4) spendLimit.js (1–2d); (5) Cloud Quotas folder cap; (6) cross-project Firestore flag (1d); (7) Secret Manager migration (0.5d); (8) SCC Premium (cost — evaluate separately).
