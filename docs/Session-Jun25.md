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

## Related Notes

- [[Infrastructure]] — Cloud Run, GCS, IAM setup
- [[Decision-Log]] — commit history
