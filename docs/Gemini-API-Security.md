---
tags: [security, gemini, gcp, terraform, billing, architecture]
status: updated
---

# Gemini API Security — CloudAce Delivery Framework

Last updated: 2026-07-03

Comprehensive GCP-native security plan for protecting Gemini API usage across all application types. Applies to every client project CloudAce delivers — chatbot, OCR, video/image generator, AI agent, Gemini Enterprise, generic web app, connector app. GCP-only controls (no Firebase App Check, no non-GCP tools).

---

## Table 1 — Attack Vectors

| ID | Attack | How It Works | App Types Affected | Risk |
|---|---|---|---|---|
| A | Direct Endpoint Hit | Cloud Run URL called directly without auth — bypasses frontend entirely | All | High |
| B | Account & Token Spam | Mass fake account creation; each gets full daily quota | Chatbot, Web App, Video/Image | High |
| C | Credential Theft | API key extracted from JS bundle, env var, error logs, or DevTools | All | High |
| D | SSRF to GCP Metadata | Server tricked into fetching `metadata.google.internal` — returns service account token | Web App, Agent | High |
| E | Prompt & Data Injection | Jailbreak overrides system prompt; connector payload poisons Gemini input | Chatbot, Agent, Connector | High |
| F | Input Size Abuse | Huge file uploads (OCR), max video duration, max resolution, 100K-token prompts | OCR, Video/Image, Chatbot | High |
| G | Runaway Execution | Agent stuck in infinite tool-call loop; concurrent video burst race condition | Agent, Video/Image | High |
| H | Connector Spoof & Replay | Fake POST mimicking WhatsApp/Slack; signed payload replayed repeatedly; message flooding | Connector | High |
| I | Supply Chain | Compromised npm package reads `process.env` and exfiltrates secrets | All | Medium |

---

## Table 2 — Attack Surface by Application Type

| Application Type | Unique Attack Vectors | Biggest Cost Risk | What GCP Cannot Block |
|---|---|---|---|
| **Chatbot Web App** | Conversation history bloat (each turn sends full history, token cost grows exponentially), jailbreak, long prompt DoS, mass throwaway accounts | History bloat at scale — 50-turn chat × thousands of users | Jailbreak content inside prompt body |
| **OCR / Doc Processing** | Huge file uploads, batch flooding (500 docs in parallel), malicious document with embedded prompt injection, output poisoning downstream systems | Batch flood — 500 × large file = massive token cost spike | Prompt injection inside PDF text content |
| **Video & Image Generator** | Concurrent burst race condition (50 requests pass rate check simultaneously), max duration/resolution abuse, CSAM attempts, reference image content filter bypass | Concurrent burst — 50 × $4 video = $200 in seconds from one account | CSAM intent — Gemini filters handle it but not GCP infra |
| **AI Agent** | Infinite tool-call loop, recursive tool chain fan-out, prompt injection via tool output (web/DB/email data), context window saturation, exfiltration via tool calls | Infinite loop — no human in the loop, costs accumulate until timeout | Prompt injection inside tool output data |
| **Gemini Enterprise (Workspace)** | Compromised Workspace account, OAuth add-on with excessive scope calls on behalf of all users, insider data exfiltration, overprivileged shared service account | Insider heavy usage — legitimate user, indistinguishable from attack | Insider intent — looks identical to legitimate usage |
| **Generic Web App** | Unprotected endpoints (no auth on `/api/generate`), API key in client JS bundle, CORS misconfiguration, SSRF via user-supplied URLs | Unprotected endpoint — public internet calls freely with no gate | SSRF via application logic — must be validated in code |
| **Connector App (WhatsApp, Slack, Zapier, CRM)** | Webhook spoofing (fake POST from non-Meta IP), signed payload replay, message flooding via connector IPs, prompt injection in connector payload (CRM field, Slack message body), CRM bulk record trigger calling Gemini per-record | Message flooding — 10K WhatsApp messages = 10K Gemini calls | Content inside encrypted webhook payloads — Cloud Armor cannot inspect |

---

## Table 3 — GCP Defense Controls

| # | Control | What It Blocks | Who Deploys | GCP Role Required | Monthly Cost | Client Effort |
|---|---|---|---|---|---|---|
| D1 | **Cloud Armor** | A, B, H — IP rate limit, geo-block, bot detection | CloudAce (Terraform) | `roles/compute.securityAdmin` | $6–15 | Zero |
| D2 | **Workload Identity** | A, B, C, D — no API keys exist; ADC auth on Cloud Run; minimum IAM only | CloudAce (gcloud) | `roles/iam.serviceAccountAdmin` + `roles/run.admin` | Free | Zero |
| D3 | **Cloud Run Limits** | F, G — max-instances=5, concurrency=10, timeout=600s caps blast radius | CloudAce (gcloud) | `roles/run.admin` | Free | Zero |
| D4 | **App Middleware** | B, E, F, G, H — per-user daily limit, video concurrency lock, webhook signature verify, agent iteration cap | CloudAce (code deploy) | `roles/run.admin` | Free | Zero |
| D5 | **Gemini QPM Quota** | F, G — Google-enforced hard project cap, fires before billing, independent of circuit breaker | CloudAce (GCP Console) | `roles/serviceusage.quotaAdmin` | Free | Zero |
| D6 | **Secret Manager** | C, I — all secrets off env vars, every access audit-logged with caller identity | CloudAce (Terraform) | `roles/secretmanager.admin` | <$1 | Zero |
| D7 | **Billing Circuit Breaker** | All — 100% budget revokes Gemini IAM; 120% disables Gemini API entirely | CloudAce (Terraform) | `roles/billing.admin` on billing account | Free | Zero |
| D8 | **Cloud Monitoring** | All — spike alert fires within 5 min, audit logs every API call, anomaly detection | CloudAce (Terraform) | `roles/monitoring.admin` | Free | Zero |
| D9 | **Org Policy Constraints** | C, A — no SA key creation, domain-restrict IAM, force LB ingress, Scenario B only | CloudAce (Terraform, org level) | `roles/orgpolicy.policyAdmin` at org | Free | Zero |

---

## Table 4 — Vector-to-Defense Coverage Matrix

| Attack Vector | D1 Cloud Armor | D2 Workload Identity | D3 Cloud Run Limits | D4 App Middleware | D5 QPM Quota | D6 Secret Manager | D7 Circuit Breaker | D8 Monitoring | D9 Org Policy |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| A — Direct Endpoint Hit | ✅ | ✅ | | | | | | | |
| B — Account & Token Spam | ✅ | ✅ | | ✅ | | | | | |
| C — Credential Theft | | ✅ | | | | ✅ | | | ✅ |
| D — SSRF to Metadata | | ✅ | | | | | | | |
| E — Prompt Injection | | | | ✅ | | | | | |
| F — Input Size Abuse | | | ✅ | ✅ | ✅ | | | | |
| G — Runaway Execution | | | | ✅ | ✅ | | | | |
| H — Connector Spoof & Replay | ✅ | | | ✅ | | | | | |
| I — Supply Chain | | | | | | ✅ | | | |
| Any — post-breach cost explosion | | | | | ✅ | | ✅ | ✅ | |

---

## Table 5 — Connector-Specific Controls

| Connector | GCP-Level Control | Must Be in App Code | Residual Risk |
|---|---|---|---|
| **WhatsApp** | Cloud Armor rate-limit on webhook endpoint | `X-Hub-Signature-256` HMAC verification + timestamp replay check | Flooding via Meta's own IP range (can't block Meta) |
| **Slack** | Cloud Armor rate-limit; whitelist Slack IP ranges | `X-Slack-Signature` HMAC + timestamp replay check | Bot token theft outside your control |
| **Zapier / n8n** | Cloud Armor rate-limit; QPM quota hard stop | Shared secret header verification on trigger webhook | Zapier IPs shared with legitimate traffic |
| **CRM (Salesforce, HubSpot)** | Cloud Armor rate-limit; QPM quota catches bulk record trigger | Per-record call debounce; sanitise field values before Gemini input | Bulk import triggering Gemini per-record |
| **Any webhook** | Cloud Armor rate-limit | Nonce + timestamp validation to prevent replay | Payload content injection (GCP cannot inspect body) |

---

## Table 6 — Two Deployment Scenarios

| Factor | Scenario A — Client Owns Project | Scenario B — CloudAce Hosts |
|---|---|---|
| **Who owns GCP project** | Client | CloudAce |
| **Client GCP access** | Owner / Editor | None |
| **CloudAce access needed from client** | `roles/editor` + `roles/iam.securityAdmin` + `roles/run.admin` + `roles/compute.securityAdmin` | Nothing — we control it |
| **Client can undo our controls** | Yes — if they have Owner | No |
| **Org Policy enforced** | No | Yes |
| **API keys possible** | Yes, unless manually prevented | No — org policy blocks creation |
| **Domain restriction on IAM** | No | Yes — only CloudAce + client domain |
| **Security Command Center** | Per-project only | Across all client projects |
| **How Gemini credentials work** | Workload Identity — no keys, ADC on Cloud Run | Workload Identity — no keys, ADC on Cloud Run |
| **Can client extract Gemini credentials** | No — nothing to extract with Workload Identity | No — nothing to extract with Workload Identity |
| **Overall security posture** | Strong | Maximum |
| **Client effort** | 5 min — grant CloudAce roles via one gcloud command we write | 30 min — fill in a form (project name, budget, connector credentials) |

---

## Table 7 — Step-by-Step Implementation Plan

| Step | Control | Action | Who | GCP Role Required | Monthly Cost | Client Effort |
|---|---|---|---|---|---|---|
| 1 | Workload Identity | Create dedicated SA; grant `roles/aiplatform.user`; attach to Cloud Run; remove `GOOGLE_GEMINI_API_KEY` env var; update SDK to use ADC | CloudAce | `roles/iam.serviceAccountAdmin` + `roles/run.admin` | Free | Zero |
| 2 | Gemini QPM Quota | Set per-project QPM limits in GCP Console: 60 req/min general, 10 req/min video, 1M tokens/min | CloudAce | `roles/serviceusage.quotaAdmin` | Free | Zero |
| 3 | Cloud Armor | Terraform: IP rate limit (30/min per IP), geo-block to client country, managed bot rules | CloudAce | `roles/compute.securityAdmin` | $6–15 | Zero |
| 4 | Cloud Run Hardening | `gcloud run services update --max-instances=5 --concurrency=10 --timeout=600` | CloudAce | `roles/run.admin` | Free | Zero |
| 5 | Secret Manager | Move all secrets (WhatsApp app secret, Slack signing key, CRM API key) out of env vars; grant SA `secretAccessor` | CloudAce | `roles/secretmanager.admin` | <$1 | Zero |
| 6 | Video Concurrency Lock | Add Firestore transaction lock middleware — one active video job per user at a time | CloudAce | `roles/run.admin` (code deploy) | Free | Zero |
| 7 | Agent Iteration Cap | Wrap agent loop with `MAX_TOOL_CALLS=10` and `MAX_SESSION_MINUTES=5` hard limits | CloudAce | `roles/run.admin` (code deploy) | Free | Zero |
| 8 | Webhook Signature Verify | Add `X-Hub-Signature-256` (WhatsApp) and `X-Slack-Signature` HMAC verify before any Gemini call | CloudAce | `roles/run.admin` (code deploy) | Free | Zero |
| 9 | Billing Circuit Breaker | Terraform: billing budget + Pub/Sub + Cloud Function; at 100% revoke IAM; at 120% disable Gemini API | CloudAce | `roles/billing.admin` on billing account ✅ | Free | Zero |
| 10 | Org Policy (Scenario B) | Enforce: no SA key creation, domain restriction, LB-only ingress, no external IPs | CloudAce | `roles/orgpolicy.policyAdmin` at org | Free | Zero |

---

## Table 8 — Recovery Playbook

| Step | Action | Who | Tool | Time |
|---|---|---|---|---|
| **1 — Detection** | Spike alert email fires (Cloud Monitoring, <5 min) or budget alert fires (billing, ~30 min) | Auto | Cloud Monitoring / Billing | Instant |
| **2 — Auto-containment** | Circuit breaker revokes Gemini IAM at 100%, disables API at 120% | Auto | Cloud Function | Instant |
| **3 — Emergency manual stop** | `gcloud services disable aiplatform.googleapis.com --project=PROJECT_ID --force` | CloudAce | gcloud | 1 min |
| **4 — Scale to zero** | `gcloud run services update SERVICE --max-instances=0` | CloudAce | gcloud | 1 min |
| **5 — Identify attacker** | Query Cloud Logging: group requests by `labels.user_id` and `httpRequest.remoteIp` — top 10 each | CloudAce | Cloud Logging | 5 min |
| **6 — Verify spend** | Billing → Cost breakdown → filter SKU "Generative Language API" → per-hour graph | CloudAce | Cloud Console | 2 min |
| **7 — Ban account** | `gcloud identity platform users update UID --disabled` | CloudAce | gcloud | 1 min |
| **8 — Block IP** | Add deny rule to Cloud Armor security policy for attacker IP/range | CloudAce | gcloud / Console | 2 min |
| **9 — Re-enable Gemini** | Re-grant `roles/aiplatform.user` to Cloud Run SA; re-enable API if disabled | CloudAce | gcloud | 2 min |
| **10 — Restore Cloud Run** | `gcloud run services update SERVICE --max-instances=5` | CloudAce | gcloud | 1 min |
| **11 — Tighten limits** | Reduce per-user daily limit env var; lower QPM quota temporarily in Console | CloudAce | gcloud / Console | 5 min |
| **12 — Post-incident note** | Document: what fired, what spend occurred, what was changed | CloudAce | Session doc | 15 min |

---

## Table 9 — Coverage Gaps (Honest)

| Gap | Why | Partial Mitigation |
|---|---|---|
| Slow-burn distributed attack | 1,000 accounts × 1 call/hour — every account stays under daily limit | QPM quota is the only hard stop |
| Prompt injection via connector payload | Webhook body is encrypted/signed — Cloud Armor cannot inspect content | App-level input sanitisation before passing to Gemini |
| Insider threat | Authorised employee looks identical to legitimate usage | Audit log review process (operational, not technical) |
| Supply chain — zero-day in npm | Malicious package reads Workload Identity token from metadata server | `npm audit`, dependency pinning, lockfiles |
| WhatsApp message flooding | Messages come from Meta's IP — blocking Meta blocks all real messages | QPM quota; per-sender rate limit in app code |
| Gemini safety filter bypass | Adversarial inputs that defeat content classifiers | Gemini's own safety filters + model updates from Google |
| GCP billing alert 30-min lag | Fast attack can spend full budget before first billing alert fires | QPM quota prevents this independently of billing |

---

## Table 10 — Total Cost Summary

| Control | One-Time Setup (CloudAce hours) | Monthly Running Cost |
|---|---|---|
| Workload Identity | 0.5 hr | Free |
| Gemini QPM Quota | 5 min | Free |
| Cloud Run Hardening | 5 min | Free |
| Billing Circuit Breaker | 1 hr Terraform | Free |
| Cloud Monitoring Alerts | 0.5 hr Terraform | Free |
| Secret Manager | 0.25 hr | <$1 |
| Cloud Armor | 1 hr Terraform | $6–15 |
| Video Concurrency Lock | 1 hr code | Free |
| Agent Iteration Cap | 0.5 hr code | Free |
| Webhook Signature Verify | 1 hr per connector | Free |
| Org Policy (Scenario B) | 0.5 hr Terraform | Free |
| **Total** | **~1.5–2 days CloudAce** | **$7–16/month** |

---

## Key Architectural Decision — Why Workload Identity Over API Keys

The single most impactful change. With `GOOGLE_GEMINI_API_KEY` in a Cloud Run env var:
- Key can leak via verbose logging
- Key can be extracted if a dependency is compromised
- Key cannot be scoped below the entire project
- Circuit breaker must patch the key to disable it

With Workload Identity (ADC):
- No key exists anywhere — nothing to steal
- Permissions scoped to exactly `roles/aiplatform.user` on one SA
- Circuit breaker simply revokes one IAM binding
- Every Gemini call appears in Cloud Audit Logs with the SA identity
- Works automatically on Cloud Run — zero code change needed in SDK

The SDK picks up ADC when `GOOGLE_GEMINI_API_KEY` is absent. Removing the env var is the only change required.

---

## Terraform Modules (Current State)

Two modules exist in `terraform/`:

| Module | Purpose | Status |
|---|---|---|
| `terraform/billing-protection/` | Client app guard — Firestore, Pub/Sub, billing budget, API key circuit breaker, spike alert, spendLimit middleware | ✅ Built — needs update to Workload Identity (remove API key approach) |
| `terraform/usage-guard/` | CloudAce ops guard — billing budget, circuit breaker disables entire Gemini API at 120%, alerts our team (hardcoded emails) | ✅ Built — apply per new client project |

Next action: merge both into a single `terraform/gemini-protection/` module using the GCP-only stack described in this document.

---

## Related

- [[AI-Services]] — model catalogue and generation pipeline
- [[Session-Jul03]] — research session where this plan was developed
- [[SOW_STATUS]] — feature tracker
- [[Billing-Protection]] — existing runbook (pre-Workload Identity approach)
