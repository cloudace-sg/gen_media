---
tags: [dev-log, session, security, terraform, gcp]
status: updated
---

# Session — 3 July 2026

Focus: Security research day. Deep dive into proactive Gemini API abuse prevention across all application types. No code written — research, planning, and documentation only.

---

## What Was Covered

### 1. Terraform Module Review

Reviewed both existing Terraform modules:

- `terraform/billing-protection/` — client app guard (Firestore, Pub/Sub, billing budget, API key circuit breaker, spendLimit middleware, spike alert)
- `terraform/usage-guard/` — CloudAce ops guard (billing budget, circuit breaker disables entire Gemini API at 120%, alerts our team)

**Key finding:** Both modules are reactive — they trigger after money has already been spent. The circuit breaker at 100%/120% is a damage limiter, not a prevention layer.

---

### 2. Proactive Abuse Prevention Research

Identified that the current stack has no pre-spend defenses. Researched GCP-native proactive controls:

**Most impactful finding: Workload Identity eliminates the biggest single risk**
- Current: `GOOGLE_GEMINI_API_KEY` in Cloud Run env var — can leak via logs, supply chain, DevTools
- Fix: Remove the key entirely. Cloud Run ADC authenticates automatically via service account. Nothing to steal.

**Controls identified (all GCP-native, no Firebase App Check):**

| Control | What It Prevents | Cost |
|---|---|---|
| Workload Identity | Credential theft — no key exists | Free |
| Gemini QPM Quota | Any volume abuse — Google-enforced hard cap | Free |
| Cloud Armor | Bot attacks, IP flooding, geo-based attacks | $6–15/mo |
| Cloud Run max-instances | Blast radius ceiling on concurrent calls | Free |
| Video concurrency lock (code) | Race condition burst on video generation | Free |
| Agent iteration cap (code) | Infinite tool-call loops | Free |
| Webhook signature verify (code) | WhatsApp/Slack spoofing and replay | Free |
| Secret Manager | Secrets off env vars, audit-logged | <$1/mo |
| Billing circuit breaker | Post-breach cost cap (existing) | Free |
| Org Policy (Scenario B) | Enforces all of above at org level | Free |

---

### 3. All Gemini Application Types Mapped

Attack surface mapped for all common Gemini application types:

- Public chatbot web app
- OCR / document processing
- Video & image generator (Veo, Imagen)
- AI agent (tool-calling, multi-step)
- Gemini Enterprise (Google Workspace)
- Generic web app with Gemini API
- Connector app (WhatsApp, Slack, Zapier, CRM)

Each type has unique attack vectors beyond the common ones. Full detail in [[Gemini-API-Security]].

---

### 4. Third-Party Connector Risks

Key finding: GCP can rate-limit connector webhooks at the IP level (Cloud Armor) but **cannot inspect payload content**. WhatsApp messages, Slack events, and CRM field values are signed/encrypted — prompt injection inside those payloads must be handled in application code.

WhatsApp-specific gap: messages arrive from Meta's IP range. Cloud Armor cannot rate-limit by WhatsApp sender ID — blocking Meta blocks all real messages. QPM quota and per-sender logic in app code are the only stops.

---

### 5. Two Deployment Scenarios

**Scenario A (client owns project):** CloudAce needs `roles/editor` + `roles/iam.securityAdmin` + `roles/run.admin` + `roles/compute.securityAdmin`. Client can undo our controls. Org Policy not available.

**Scenario B (CloudAce hosts):** We control everything. Org Policy enforces no SA keys, domain restriction, LB-only ingress. Client cannot accidentally disable protections. Client effort: fill in a form.

**Gemini credential protection in both scenarios:** Workload Identity means no API key exists at all. Even if a client somehow inspects all network traffic, there is nothing to steal.

---

### 6. Recovery Playbook

Full 12-step recovery playbook documented:
- Detection: Cloud Monitoring spike alert (<5 min) or billing alert (~30 min)
- Auto-containment: circuit breaker already fires
- Investigation: Cloud Logging queries to identify attacker account and IP
- Re-enable: restore IAM binding, restore max-instances
- Hardening: ban account, block IP in Cloud Armor, tighten limits

---

## Documents Created / Updated

| File | Change |
|---|---|
| `docs/Gemini-API-Security.md` | New — comprehensive security plan with 10 tables covering all attack vectors, app types, defenses, coverage matrix, connector controls, two scenarios, implementation plan, recovery playbook, cost summary, gaps |
| `docs/Session-Jul03.md` | This file |
| `docs/Decision-Log.md` | Jul 3 entry added |

---

## Key Decisions Made

1. **Workload Identity is the highest-priority change** — removes the API key attack surface entirely. Must be applied to all future client projects.
2. **QPM quota is the most critical proactive control** — Google-enforced, independent of billing, fires before spend accumulates. Every client project must have this set.
3. **The two existing Terraform modules should be merged** into a single `terraform/gemini-protection/` module using the GCP-only Workload Identity approach.
4. **Cloud Armor is the only paid proactive control** — $6–15/month. Everything else is free.
5. **Connector apps need app-code controls** — GCP cannot inspect webhook payload content. Signature verification is mandatory before any Gemini call.

---

## Next Actions (Not Yet Started)

- [ ] Rewrite Terraform modules into unified `terraform/gemini-protection/` with Workload Identity
- [ ] Create `terraform.tfvars.example` for client onboarding
- [ ] Add video concurrency lock to gen_media server
- [ ] Update circuit breaker function to revoke IAM instead of patching API key
- [ ] Add veo-specific spike alert to Terraform

---

## Related

- [[Gemini-API-Security]] — full security plan (all 10 tables)
- [[AI-Services]] — model catalogue
- [[SOW_STATUS]] — feature tracker
- [[Session-Jul02]] — previous session (Omni Flash research)
