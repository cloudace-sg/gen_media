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

## How it works

```
User request
  → authenticate()       Firebase Auth — blocks unauthenticated
  → spendLimit()         Firestore counter — blocks if user hits daily cap (429)
  → Gemini API call

In parallel:
  Billing Budget → Pub/Sub → Cloud Function
    70%  → email alert only
    90%  → email alert only (manual: set Firestore throttle flag)
    100% → Cloud Function disables Gemini API key (app stays up, Gemini 403s)
    120% → email alert (key already disabled)

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

Copy these 4 files into the new project:

```
scripts/setup-billing-protection.sh
scripts/test-billing-protection.sh
server/src/middleware/spendLimit.js
functions/billingCircuitBreaker/          ← whole folder
```

Then follow Part 1 exactly, substituting the new project's `PROJECT_ID`, `BILLING_ACCOUNT_ID`, and Cloud Run service name.

The only project-specific values are:
- `PROJECT_ID` — passed as script argument
- `BILLING_ACCOUNT_ID` — passed as script argument
- `GOOGLE_GEMINI_KEY_NAME` — set as Cloud Run env var (Step 5)
- `GEMINI_DAILY_LIMIT_PER_USER` — set as Cloud Run env var (default: 50)

Everything else (Pub/Sub topic name, function name, Firestore paths) uses the same defaults and can be left as-is.

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
