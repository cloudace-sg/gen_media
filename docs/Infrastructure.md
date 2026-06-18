---
tags: [infra, gcs, cloud-run, dev-log]
status: updated
---

# Infrastructure & Storage

The gen_media project uses a single Google Cloud Storage bucket (configured via GCS_BUCKET env var, with project strong-kit-475107-k1) for all media assets. Files uploaded via `uploadBuffer` are always made public, while `uploadFile` supports both public and signed-URL modes. Cloud Build performs a 3-step pipeline (Docker build → push to Artifact Registry → Cloud Run deploy) using a multi-stage Dockerfile. The GCS CORS config permits all origins for read operations. A hardcoded bucket name was removed from the Dockerfile startup script in favour of runtime env injection.

# Infrastructure & Storage — gen_media

## GCS Bucket Setup

- **Bucket name**: set at runtime via `GCS_BUCKET` environment variable (previously `gen-media-demo-assets-sg` was hardcoded; that was removed in commit `e167185`).
- **GCP Project**: `strong-kit-475107-k1` (visible in Firebase config baked into the build).
- **SDK init**: `new Storage()` with no explicit credentials — relies on ADC (Workload Identity / Cloud Run service account) at runtime.
- **Graceful degradation**: if `GCS_BUCKET` is unset the module warns and returns `null` from `getBucket()`, allowing local dev without GCS.

## How `uploadBuffer` Makes Files Public

```js
await file.save(buffer, { contentType, resumable: false, metadata: { cacheControl: 'no-cache, no-store, must-revalidate' } });
await file.makePublic().catch(() => {});
return `https://storage.googleapis.com/${bucket.name}/${destination}`;
```

- `file.makePublic()` is called unconditionally after every buffer save (errors are silently swallowed).
- Returns a permanent public URL (no expiry). This approach was chosen for brand assets specifically to avoid signed-URL expiration problems.
- `cacheControl` is set to `no-cache` for buffer uploads (brand assets / references that change), vs `public, max-age=31536000, immutable` for `uploadFile` (generated output).

## `uploadFile` — Conditional Public vs Signed URL

- If `ASSET_PUBLIC=public`, `file.makePublic()` is called and a permanent URL is returned.
- Otherwise, `signedReadUrl()` is called with TTL from `SIGNED_URL_TTL` env var (default 86400 s / 24 h).
- The Dockerfile startup script hard-sets `ASSET_PUBLIC=public`, so Cloud Run always uses public URLs.

## CORS Configuration (`infra/gcs-cors.json`)

- **Allowed origins**: Cloud Run URLs (`gen-media-poc-*`), `http://localhost:3000`, and `*` wildcard.
- **Methods**: `GET`, `HEAD`, `OPTIONS` only (read-only; no upload via browser directly to GCS).
- **Exposed headers**: standard CORS + `x-goog-meta-*` for GCS custom metadata.
- **maxAgeSeconds**: 0 — no preflight caching (each OPTIONS request hits GCS).

## Cloud Build Deployment Pipeline (`cloudbuild.yaml`)

3 sequential steps:

1. **Docker build** — tags image as `asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/gen_media/gen-media-demo:$COMMIT_SHA`. Firebase client-side config is passed as `--build-arg` and baked into the React bundle at build time.
2. **Docker push** — pushes the SHA-tagged image to Artifact Registry.
3. **Cloud Run update** — `gcloud run services update gen-media-demo` with the new image in `asia-southeast1`. Notably uses `update` (not `deploy`), meaning the service must already exist; env vars and secrets remain as previously configured on the service.

Logging: `CLOUD_LOGGING_ONLY` (no local log bucket).

## Docker Multi-Stage Build (`Dockerfile`)

**Stage 1 — `node:18-alpine` (build)**:
- Receives Firebase `REACT_APP_*` build args, sets them as ENV, then builds the React client with `npm run build`.
- Also copies the server source.

**Stage 2 — `nginx:alpine` (production)**:
- Copies React build output to `/usr/share/nginx/html`.
- Copies server files to `/usr/share/nginx/server`.
- Installs Node.js and npm into the nginx container (via `apk`).
- Generates `/start.sh` at build time which:
  - Starts the Express API on port 3001 in the background.
  - Sets `ASSET_PUBLIC=public` and `CLIENT_URL=http://localhost:8080`.
  - Waits 3 s, then starts nginx in the foreground.
- Exposes port 8080 (Cloud Run default).

## Cloud Run Environment Variables Required

From `server/env.example` and startup script analysis, the following must be set on the Cloud Run service (not baked into the image):

| Variable | Purpose |
|---|---|
| `GCS_BUCKET` | GCS bucket name for asset storage |
| `GOOGLE_GEMINI_API_KEY` | Gemini API for image/video generation |
| `PEXELS_API_KEY` | Stock image search |
| `UNSPLASH_ACCESS_KEY` | Stock image search |
| `PIXABAY_API_KEY` | Stock image/video search |
| `GCP_PROJECT_ID` | GCP project for Veo/BigQuery calls |
| `BILLING_BQ_PROJECT_ID` | BigQuery billing export project |
| `BILLING_BQ_DATASET` | BigQuery dataset name |
| `BILLING_BQ_TABLE` | BigQuery table name |
| `BILLING_CREDIT_LIMIT_USD` | Budget cap for billing alerts |
| `SIGNED_URL_TTL` | (optional) signed URL lifetime in seconds |

Variables set inside the container at startup (not needed externally):
- `PORT=3001`, `CLIENT_URL=http://localhost:8080`, `ALLOWED_ORIGINS=...`, `ASSET_PUBLIC=public`

## Why the Old Bucket Reference Was Replaced

Commit `e167185` (`fix: remove hardcoded GCS_BUCKET from Dockerfile startup script`) removed a literal bucket name that had been embedded in the container startup script. The fix moves bucket configuration entirely to a Cloud Run env var (`GCS_BUCKET`), making the image environment-agnostic and allowing the bucket to be changed without rebuilding the image. This also follows the 12-factor principle of externalising config.

## Key Decisions
- uploadBuffer always calls makePublic() and returns a permanent public URL — chosen to eliminate signed-URL expiration issues for brand assets and reference images.
- uploadFile conditionally uses makePublic() or signedReadUrl() depending on ASSET_PUBLIC env var, with a default TTL of 86400 s for signed URLs.
- Firebase client config is baked into the React bundle at Docker build time via --build-arg, since these are public client-side values with no security risk.
- Cloud Build uses 'gcloud run services update' (not deploy) — the Cloud Run service must pre-exist; env vars and secrets are managed separately on the service.
- GCS CORS maxAgeSeconds is set to 0, disabling preflight caching — prioritises correctness over performance for cross-origin reads.
- The bucket name was moved from a hardcoded Dockerfile string to the GCS_BUCKET runtime env var (commit e167185) to decouple the image from any specific bucket.
- Node.js is installed inside the nginx:alpine production image rather than using a separate sidecar, keeping the deployment as a single container on Cloud Run.
- ASSET_PUBLIC=public is hardcoded in the container startup script, so all Cloud Run deployments always serve public GCS URLs without needing an external env var override.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/storage.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/cloudbuild.yaml`
- `/home/angieng/CloudAceSG/Projects/gen_media/Dockerfile`
- `/home/angieng/CloudAceSG/Projects/gen_media/infra/gcs-cors.json`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/env.example`

## Related
- [[Cloud Run service configuration and secret management]]
- [[Workload Identity / ADC for GCS authentication in Cloud Run]]
- [[GCS uniform bucket-level access vs per-object ACLs (makePublic uses legacy ACLs)]]
- [[Artifact Registry image lifecycle and cleanup policies]]
- [[Firebase Authentication integration with Cloud Run backend]]
- [[BigQuery billing export schema for cost monitoring]]
- [[Veo video generation via GCS URI input]]
- [[nginx reverse proxy configuration for API routing]]

## Deployments
- **2026-06-18** `2bba155`: pushed to GitHub
- **2026-06-18** `2011174`: Cloud Build → Cloud Run ✅ SUCCESS (build ff1e0d95) — camera movement/angle chip panel
- **2026-06-18** `580d03f`: Cloud Build → Cloud Run ✅ SUCCESS (build 0ad832ec) — Ingredients to Video UI + extractVideoUri download fix
- **2026-06-18** `9e0899b`: Cloud Build → Cloud Run ✅ SUCCESS — RAI auto-retry (face photo → text-to-video fallback)
- **2026-06-18** `b166637`: Cloud Build → Cloud Run ✅ SUCCESS — prevent sign-out on deploy restart
- **2026-06-18** `8d917af`: Cloud Build → Cloud Run ❌ FAILED
- **2026-06-18** `cbc86e0`: pushed to GitHub
- **2026-06-18** `af0a708`: Cloud Build → Cloud Run ✅ SUCCESS (build ada5ca4a) — fix empty Firebase apiKey in bundle (rebuild)
- **2026-06-18** —: Firestore settings/auth fixed directly in DB — exceptions field was JSON string, now proper map array; angie.ng@cloud-ace.com granted admin role
- **2026-06-17** `05c03fd`: Cloud Build → Cloud Run ✅ SUCCESS — auth: trusted domain auto-role
- **2026-06-17** `05c03fd`: pushed to GitHub
- **2026-06-17** `a388441`: Cloud Build → Cloud Run ✅ SUCCESS — fix duplicate let operation syntax error
- **2026-06-17** `5f22465`: Cloud Build → Cloud Run ✅ SUCCESS — Veo GA model migration
- **2026-06-17** `e4b0f10`: Cloud Build → Cloud Run ✅ SUCCESS — resolution fallback chain
- **2026-06-17** `fe9cbe5`: Cloud Build → Cloud Run ✅ SUCCESS — transient 503 poll retry
- **2026-06-17** `6e844ac`: Cloud Build → Cloud Run ✅ SUCCESS — 1080p/4K all aspect ratios
- **2026-06-17** `222f669`: Cloud Build → Cloud Run ✅ SUCCESS — native 4K resolution
- **2026-06-17** `e8d7eaf`: pushed to GitHub
- **2026-06-17** `0ef8a77`: Cloud Build → Cloud Run ✅ SUCCESS (build 86c0d657) — Extend button
- **2026-06-17** `0ef8a77`: pushed to GitHub
- **2026-06-17** `c547c36`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-17** `c547c36`: pushed to GitHub
- **2026-06-16** `d393d31`: pushed to GitHub
- **2026-06-16** `b5a5ad0`: pushed to GitHub
- **2026-06-16** `5407342`: Cloud Build → Cloud Run ✅ SUCCESS (build 01b3787f, 7m7s)
- **2026-06-16** `5407342`: pushed to GitHub
- **2026-06-16** `f2ddba6`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-16** `d5f5a01`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-16** `4c7a434`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-16** `f28398c`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-16** `09368cc`: Cloud Build → Cloud Run ✅ SUCCESS
- **2026-06-16** `fda4186`: pushed to GitHub
- **2026-06-16** `0fdf824`: Cloud Build → Cloud Run ✅ SUCCESS
