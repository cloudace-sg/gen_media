---
tags: [security, billing, ops, runbook]
status: active
---

# Billing Protection — Setup, Testing & Reuse Guide

Prevents Gemini API token hacking and cost spikes. Zero extra cost (no SCC). Project-scoped.

## What's Built

| File | What it does |
|---|---|
| `scripts/setup-billing-protection.sh` | One-command GCP setup for any project |
| `server/src/middleware/spendLimit.js` | Express middleware — blocks per-user daily overuse |
| `functions/billingCircuitBreaker/index.js` | Cloud Function — disables Gemini key at 100% budget |
| `scripts/test-billing-protection.sh` | Fake payload tests for all 3 layers |

## How Each Layer Works

### Layer 1 — Workload Identity (no API key) *(implemented in gemini.js)*
Instead of an API key, the Cloud Run service uses its own Google identity (service account) to call Gemini. There is no key string to steal. Access is tied to the Cloud Run service — unusable from outside GCP.

**How it works in code:** `GeminiService` now has `genAIPrimary = genAIVertex (Workload Identity)` when `GCP_PROJECT_ID` is set. Falls back to `genAI (API key)` for local dev. `GOOGLE_GEMINI_API_KEY` is now optional when `GCP_PROJECT_ID` is configured.

**To fully remove the API key** (after verifying Workload Identity works):
```bash
gcloud run services update gen-media-demo \
  --region asia-southeast1 \
  --remove-env-vars GOOGLE_GEMINI_API_KEY
```

**Note:** API key still present as fallback during transition. API restriction to Generative Language API was already applied in Cloud Console.

### Layer 2 — spendLimit.js middleware *(live on Cloud Run)*
Every time a logged-in user calls `/api/generate`, `/api/remix`, `/api/video`, or `/api/prompt`, the server increments a counter in Firestore for that user. Once they hit 50 calls in a day, they get a `429` error and are blocked until tomorrow. This stops one compromised account from hammering Gemini all day. Admins are exempt.

### Layer 3 — Billing Budget alerts *(active — all 4 billing admins notified)*
Google watches your total spend on the project. When it crosses 70%, 90%, 100%, or 120% of your USD 100 budget, it sends an email to all billing admins and fires a message into the `billing-alerts` Pub/Sub topic. The email is for humans to act on; the Pub/Sub message triggers Layer 4 automatically.

### Layer 4 — Circuit Breaker Cloud Function *(deployed)*
Listens to the `billing-alerts` Pub/Sub topic. When a 100% budget message arrives, it automatically calls the Google API and disables your Gemini API key. All Gemini calls immediately start failing with `403`. Critically — only Gemini stops. Cloud Run, Firebase, GCS, and your website all stay up. Re-enable the key manually in Cloud Console once you've investigated.

### How the layers work together

```
Normal user                        → Layer 2 blocks after 50 calls/day
Compromised account hammering      → Layer 2 blocks, Layer 3 alerts at 70%
Stolen API key used externally     → Layer 1 blocks it entirely
Mass attack that bypasses Layer 2  → Layer 3 alerts → Layer 4 auto-kills key at 100%
```

## Architecture Overview

```
User request
  → authenticate()       Firebase Auth — blocks unauthenticated
  → spendLimit()         Firestore counter — blocks if user hits daily cap (429)
  → Gemini API call

In parallel:
  Billing Budget → Pub/Sub → Cloud Function
    70%  → email to all billing admins (alert only)
    90%  → email to all billing admins (alert only)
    100% → Cloud Function disables Gemini API key (app stays up, Gemini 403s)
    120% → email to all billing admins (key already disabled)

Cloud Monitoring → alert if request spike > 200 in 5 min
```

---

## Part 1 — First-Time Setup on a Project

### Prerequisites
```bash
gcloud auth login
gcloud auth application-default login
gcloud components install beta
```

### Step 1 — Run the setup script
```bash
./scripts/setup-billing-protection.sh \
  <PROJECT_ID> \
  <BILLING_ACCOUNT_ID> \
  <ALERT_EMAIL> \
  <MONTHLY_BUDGET_USD>

# Example for this project:
./scripts/setup-billing-protection.sh \
  strong-kit-475107-k1 \
  012345-ABCDEF-012345 \
  angie.ng@cloud-ace.com \
  100
```

To find your billing account ID:
```bash
gcloud billing accounts list
```

The script does steps 1–5 automatically:
- Enables required APIs
- Creates `billing-alerts` Pub/Sub topic
- Creates Billing Budget with 70/90/100/120% thresholds
- Creates Cloud Monitoring spike alert
- Deploys the `billing-circuit-breaker` Cloud Function

### Step 2 — Manual: Restrict the API key *(Cloud Console, ~5 min)*

Cloud Console → APIs & Services → Credentials → your `GOOGLE_GEMINI_API_KEY`:

1. **Application restrictions** → HTTP referrers → add:
   - `https://<your-cloud-run-url>/*`
   - `http://localhost:3001/*`
2. **API restrictions** → Restrict key → select `Generative Language API` only
3. Save

### Step 3 — Manual: Set Cloud Quotas *(Cloud Console, ~5 min)*

Cloud Console → APIs & Services → Quotas & System Limits:
- Search `Generative Language API`
- Set **Requests per day** → `5000` (or your ceiling)
- Set **Requests per minute per user** → `60`

### Step 4 — Wire spendLimit into the Express server

In `server/src/index.js` the middleware is already wired for this project. For a new project, add:

```js
const { authenticate } = require('./middleware/auth');
const { spendLimit } = require('./middleware/spendLimit');

// Apply after existing route declarations — replace these 4 routes:
app.use('/api/generate', authenticate, spendLimit, generateRoutes);
app.use('/api/remix',    authenticate, spendLimit, remixRoutes);
app.use('/api/video',    authenticate, spendLimit, videoRoutes);
app.use('/api/prompt',   authenticate, spendLimit, require('./routes/prompt'));
```

### Step 5 — Set env vars on Cloud Run

```bash
gcloud run services update <SERVICE_NAME> \
  --region asia-southeast1 \
  --update-env-vars GEMINI_DAILY_LIMIT_PER_USER=50,GOOGLE_GEMINI_KEY_NAME=projects/<PROJECT_ID>/locations/global/keys/<KEY_ID>
```

To find your KEY_ID:
```bash
gcloud alpha services api-keys list --project=<PROJECT_ID>
```

---

## Part 2 — Testing with Fake Payloads

Three independent layers to test. Run them in order.

### Layer 1 — spendLimit middleware (local server)

Tests that the per-user daily cap blocks requests after the limit.

**Setup:**
```bash
# Terminal 1 — start the server
cd server && npm run dev

# Terminal 2 — get a Firebase ID token from the browser console:
# firebase.auth().currentUser.getIdToken().then(t => console.log(t))
export TEST_TOKEN=<paste token here>

# Lower the limit so you don't have to make 50 real Gemini calls:
export GEMINI_DAILY_LIMIT_PER_USER=3
```

**Run:**
```bash
./scripts/test-billing-protection.sh strong-kit-475107-k1 spend-limit
```

**What to expect:**
- Requests 1–3 → `200 OK` with headers `X-Spend-Count: 1`, `X-Spend-Count: 2`, `X-Spend-Count: 3`
- Request 4 onwards → `429` with body:
  ```json
  { "error": "Daily generation limit reached. Try again tomorrow.", "limit": 3 }
  ```

**Reset counter between test runs:**
Firebase Console → Firestore → `userSpend/<uid>/daily/<YYYY-MM-DD>` → delete document

Or via CLI:
```bash
firebase firestore:delete "userSpend/<uid>/daily/$(date +%Y-%m-%d)" --project=strong-kit-475107-k1
```

---

### Layer 2 — Circuit breaker Cloud Function (local, no deployment)

Tests the Cloud Function logic with fake billing alert JSON — no Pub/Sub, no GCP needed.

```bash
./scripts/test-billing-protection.sh strong-kit-475107-k1 circuit-breaker-local
```

**What to expect (stdout):**
```
── 70% threshold (alert-only) ──
[circuit-breaker] threshold=0.7 cost=70 budget=100
[circuit-breaker] alert-only at 70% — no action taken

── 90% threshold (alert-only) ──
[circuit-breaker] threshold=0.9 cost=90 budget=100
[circuit-breaker] alert-only at 90% — no action taken

── 100% threshold (key disable) ──
[circuit-breaker] threshold=1 cost=100 budget=100
[circuit-breaker] GOOGLE_GEMINI_KEY_NAME not set — cannot disable key
```

The last line is expected if `GOOGLE_GEMINI_KEY_NAME` is not set — it means the logic ran correctly up to the point of disabling the key.

To test the full key-disable path with a **throwaway test key**:
```bash
# Create a test key just for this test
gcloud alpha services api-keys create \
  --display-name="billing-test-key-DELETE-ME" \
  --project=strong-kit-475107-k1

# Get its resource name
gcloud alpha services api-keys list --project=strong-kit-475107-k1

# Set it and run
export GOOGLE_GEMINI_KEY_NAME=projects/strong-kit-475107-k1/locations/global/keys/<TEST_KEY_ID>
./scripts/test-billing-protection.sh strong-kit-475107-k1 circuit-breaker-local

# Delete test key after
gcloud alpha services api-keys delete <TEST_KEY_ID> --project=strong-kit-475107-k1
```

---

### Layer 3 — Circuit breaker via real Pub/Sub (deployed function)

Tests the deployed Cloud Function end-to-end using a fake budget alert message.

**Safe test — 70% and 90% (no real action taken):**
```bash
./scripts/test-billing-protection.sh strong-kit-475107-k1 circuit-breaker
```

This publishes fake Pub/Sub messages for 70% and 90% thresholds. The function logs `alert-only` and does nothing.

**Check the function actually ran:**
```bash
gcloud functions logs read billing-circuit-breaker \
  --project=strong-kit-475107-k1 \
  --region=asia-southeast1 \
  --limit=10
```

**100% test (DISABLES REAL KEY — use test key):**

The script prompts for confirmation before the 100% payload. Use a throwaway key:
```bash
export GOOGLE_GEMINI_KEY_NAME=projects/strong-kit-475107-k1/locations/global/keys/<TEST_KEY_ID>
./scripts/test-billing-protection.sh strong-kit-475107-k1 circuit-breaker
# When prompted for 100% test, type: yes
```

After the test, re-enable the test key in Cloud Console or delete it.

---

## Part 3 — Reuse on a New Project

### Files to copy (5 files)

```
scripts/setup-billing-protection.sh
scripts/test-billing-protection.sh
server/src/middleware/spendLimit.js
functions/billingCircuitBreaker/          ← whole folder
server/src/services/gemini.js             ← Workload Identity logic already inside
```

### Step-by-step for a new project

**Step 1 — Copy the files above into the new project**

**Step 2 — Wire spendLimit into the new project's Express server**
```js
const { authenticate } = require('./middleware/auth');
const { spendLimit } = require('./middleware/spendLimit');

app.use('/api/generate', authenticate, spendLimit, generateRoutes);
app.use('/api/remix',    authenticate, spendLimit, remixRoutes);
app.use('/api/video',    authenticate, spendLimit, videoRoutes);
app.use('/api/prompt',   authenticate, spendLimit, require('./routes/prompt'));
```

**Step 3 — Run the setup script**
```bash
./scripts/setup-billing-protection.sh \
  <NEW_PROJECT_ID> \
  <BILLING_ACCOUNT_ID> \
  <ALERT_EMAIL> \
  <MONTHLY_BUDGET_USD>
```

**Step 4 — Grant Cloud Run service account permission to call Gemini**
```bash
# Get the Cloud Run service account
gcloud run services describe <SERVICE_NAME> \
  --region asia-southeast1 \
  --project <NEW_PROJECT_ID> \
  --format="value(spec.template.spec.serviceAccountName)"

# Grant Vertex AI access (enables Workload Identity for Gemini)
gcloud projects add-iam-policy-binding <NEW_PROJECT_ID> \
  --member="serviceAccount:<SERVICE_ACCOUNT_EMAIL>" \
  --role="roles/aiplatform.user"
```

**Step 5 — Set Cloud Run env vars**
```bash
gcloud run services update <SERVICE_NAME> \
  --region asia-southeast1 \
  --update-env-vars \
    GEMINI_DAILY_LIMIT_PER_USER=50,\
    GCP_PROJECT_ID=<NEW_PROJECT_ID>,\
    GOOGLE_GEMINI_KEY_NAME=projects/<NEW_PROJECT_ID>/locations/global/keys/<KEY_ID>
```

**Step 6 — Add billing admin emails to budget**
Cloud Console → Billing → Budgets & Alerts → `gemini-spend-guard-<PROJECT_ID>` → Manage notifications

**Step 7 — Restrict the API key in Cloud Console**
APIs & Services → Credentials → key → API restrictions → Generative Language API only

**Step 8 — Verify Workload Identity works, then remove API key**
```bash
# After deploy — test generation features work
# Then remove the key:
gcloud run services update <SERVICE_NAME> \
  --region asia-southeast1 \
  --remove-env-vars GOOGLE_GEMINI_API_KEY
```

### Values that change per project

| Value | Where to set |
|---|---|
| `PROJECT_ID` | Script argument + Cloud Run env var `GCP_PROJECT_ID` |
| `BILLING_ACCOUNT_ID` | Script argument (`gcloud billing accounts list`) |
| `GOOGLE_GEMINI_KEY_NAME` | Cloud Run env var (`gcloud alpha services api-keys list`) |
| `GEMINI_DAILY_LIMIT_PER_USER` | Cloud Run env var (default: 50) |
| Cloud Run `SERVICE_NAME` | Step 4 & 5 commands |

Everything else (Pub/Sub topic name, function name, Firestore paths, middleware code) is identical across all projects.

---

## Runbook — What to do when alerts fire

| Alert | Action |
|---|---|
| 70% budget email | Review Cloud Monitoring — check for unusual spike. No action needed if normal usage. |
| 90% budget email | Log into Cloud Console → check Firestore `userSpend` for any single user consuming most quota. Consider lowering `GEMINI_DAILY_LIMIT_PER_USER` temporarily. |
| 100% — key auto-disabled | Gemini calls return 403. App stays up. Investigate root cause before re-enabling. Re-enable: Cloud Console → APIs & Services → Credentials → restore API restrictions on the key. |
| Monitoring spike alert | Check Cloud Audit Logs for the source IP/user. If bot/scraper, add to Cloud Armor block list. |

## Related

- [[Infrastructure]] — Cloud Run env vars and deployment
- [[Authentication]] — Firebase Auth middleware already in place
- [[BTW-Notes]] — design discussion from 2026-06-23
