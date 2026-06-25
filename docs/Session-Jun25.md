---
tags: [dev-log, bug-fix, upload-pipeline, my-files]
status: deployed
---

# Session Jun 25 — Upload Pipeline & My Files Fix

## What We Did

### Root Cause: My Files Always Empty in Production

**Bug:** `GET /api/files` silently fell back to `listLocalFiles()` on Cloud Run, returning an empty list even though files were in GCS.

**Root cause:** `storage.getBuckets()` was used as a credentials preflight check, but this requires project-level `roles/storage.Admin`. The Cloud Run service account (`gen-media-runner@...`) only has `roles/storage.objectAdmin` (object-level, not bucket-level). Every production request threw → caught → fell back to local disk listing → empty.

**Fix (`cca848e`):** Replace `storage.getBuckets()` with `storage.bucket(bucketName).getMetadata()`, which tests credentials on the specific bucket the service account actually has access to.

**Confirmed via gsutil:** Files were in GCS all along (`users/angie.ng@cloud-ace.com/uploads/2026/06/...`). Upload was always working; only listing was broken.

---

### Upload Pipeline Fixes (also in `cca848e`)

| Bug | Fix |
|-----|-----|
| Local dev — My Files empty | `GET /api/files` now calls `listLocalFiles()` directly when `!bucketName` (removed `ensureGcsConfigured` gate) |
| Type filter mismatch in local dev | Added `typeFilterMap` to normalise client filter names (`uploads`, `generated_images`, etc.) to internal `fileType` strings before comparing |
| Uploaded files not auto-staged | `stageImage()` now called for each result after successful upload — no more manual hover-click "+" |
| Silent upload failure | Added `catch` block in `handleFilesSelected` to update the row with an error and call `setErrorMsg()` |
| No error badge on failed upload rows | Added `{row.error && <span className="text-red-700 ...">}` in Workspace |

---

### Sort Dropdown for My Files (`1334d69`)

Added a second dropdown next to the type filter:
- **Newest first** (default)
- **Oldest first**
- **Name A → Z**
- **Name Z → A**

Sorting is purely client-side on the already-fetched items (`useMemo` on `[items, sortBy]`). No extra API call. Sort resets on type filter change since items are re-fetched.

---

## Deployments

| Commit | Build | Status | Notes |
|--------|-------|--------|-------|
| `cca848e` | `dadaeb1a` | ✅ SUCCESS | Upload pipeline + My Files fix |
| `1334d69` | `3bdcd667` | ✅ SUCCESS | Sort dropdown |

## Key Learnings

- `storage.getBuckets()` ≠ a safe credential check unless you have `storage.Admin` project-wide. Always test on the specific resource the service account targets.
- When `ASSET_PUBLIC=public`, uploaded files are made public via `makePublic()` in `uploadBuffer`, so URLs are direct `https://storage.googleapis.com/...` — no signed URL needed.
- Zustand store is in-memory only (no `persist` middleware) — staged images survive route changes but not page refreshes.

---

## Billing Protection — Completion Session (same day, PM)

All 5 layers of the billing protection stack set up, tested, and verified.

### What was done

| Step | Action | Result |
|---|---|---|
| Setup script | `setup-billing-protection.sh` run against `019F64-418A79-6241FB` | Billing Budget + Pub/Sub topic + circuit breaker redeployed |
| Cloud Run env vars | `GOOGLE_GEMINI_KEY_NAME` + `GEMINI_DAILY_LIMIT_PER_USER=50` set on `gen-media-demo` | Layer 4 now knows which key to disable |
| Circuit breaker env var | `GOOGLE_GEMINI_KEY_NAME` set on `billing-circuit-breaker` Cloud Run service | Required for the function to call API Keys Admin API |
| Duplicate budget | Deleted `af8000d9` — kept `3d7cf30d` | One budget remains |
| Spike alert | Created `Gemini API Request Spike` (>200 req/5 min) in Cloud Monitoring | Layer 5 now active |

### Bugs fixed in test script (`test-billing-protection.sh`)

1. **Double base64 encoding** — script was base64-encoding the payload then passing it to `gcloud pubsub topics publish --message`, which encodes again. Fix: pass raw JSON, let Pub/Sub encode.
2. **`bc` not installed** — `costAmount` field was empty in payload. Fix: replaced `$(echo "$THRESHOLD * 100" | bc)` with `$(awk "BEGIN {printf \"%.0f\", $THRESHOLD * 100}")`.

### New file: `scripts/test-spend-limit-unit.js`

Unit test for `spendLimit.js` middleware using an in-memory Firestore mock — no server or Firebase token needed. Tests 3 allowed → 2 blocked (429) → admin bypass.

### Test results

| Layer | Test | Result |
|---|---|---|
| Layer 2 — spendLimit | Unit test (`test-spend-limit-unit.js`) | ✅ 6/6 passed |
| Layer 4 — circuit breaker 70/90% | Pub/Sub → deployed function | ✅ Logs `alert-only` |
| Layer 4 — circuit breaker 100% | Pub/Sub → throwaway key disabled | ✅ `KEY DISABLED` confirmed in logs |
| Layer 5 — spike alert | Policy verified via CLI | ✅ Active |

### GCP state after this session

- Billing Budget: `gemini-spend-guard-strong-kit-475107-k1` (`3d7cf30d`) — 70/90/100/120% → Pub/Sub `billing-alerts`
- Circuit breaker function: `billing-circuit-breaker` — `GOOGLE_GEMINI_KEY_NAME` = `genmedia` key
- Spike alert policy: `14386171872176596674` — `>200 Gemini req/5 min`

## Related Notes

- [[Billing-Protection]] — full runbook
- [[Infrastructure]] — Cloud Run, GCS, IAM setup
- [[Decision-Log]] — commit history
