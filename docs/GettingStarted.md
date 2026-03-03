# Getting Started – Run Locally and Deploy to Cloud Run

This guide walks you through the easiest ways to run the app locally and deploy it to Google Cloud Run. It’s opinionated, copy‑paste friendly, and highlights the minimum you need for a smooth trial.

## At a glance – choose your path
- Easiest local run (no Node setup): use the prebuilt Docker image
- Local development from source: run `server` and `client` with hot reload
- Cloud Run deployment: deploy from Docker image or from source

---

## Prerequisites
- Docker 20.10+ (for container run or building images)
- Node.js 18+ and npm (only for local dev from source)
- gcloud CLI (for Cloud Run deploy)
- A Google Cloud project with billing enabled
- Service account with access to:
  - BigQuery Job User (roles/bigquery.jobUser)
  - BigQuery Data Viewer (roles/bigquery.dataViewer)
  - Storage Object Admin on your media bucket (roles/storage.objectAdmin)

## Required environment variables
Set these for any run mode (local or Cloud Run):

```
GCS_BUCKET=<your-media-bucket>
ASSET_PUBLIC=public
GCP_PROJECT_ID=<your-project-id>
BILLING_BQ_PROJECT_ID=<project-with-bq-export>
BILLING_BQ_DATASET=billing_data
BILLING_BQ_TABLE=<your_bq_export_table>
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json   # inside container; for local dev use an absolute path
```

Tip: For local dev, you can export vars in your shell; for Docker/Cloud Run, pass them as env vars.

---

## Option A) Run locally using the prebuilt Docker image (recommended)

1) Authenticate Docker to Artifact Registry (adjust region if needed):
```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

2) Pull the image:
```bash
IMAGE_PATH=asia-southeast1-docker.pkg.dev/<PROJECT>/<REPO>/gen-media-demo:<TAG>
docker pull $IMAGE_PATH
```

3) Run the container (mount your service account key):
```bash
docker run -p 8080:8080 \
  -e GCS_BUCKET=<bucket> \
  -e ASSET_PUBLIC=public \
  -e GCP_PROJECT_ID=<project> \
  -e BILLING_BQ_PROJECT_ID=<project> \
  -e BILLING_BQ_DATASET=billing_data \
  -e BILLING_BQ_TABLE=<bq_export_table> \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json \
  -v $(pwd)/service-account-key.json:/app/service-account-key.json:ro \
  $IMAGE_PATH
```

Open the app at http://localhost:8080

Notes
- Nginx serves the React app; it reverse‑proxies API requests to the Node server running inside the same container on port 3001.
- Health check: http://localhost:8080/health

---

## Option B) Local development from source (hot reload)

Terminal 1 – API server:
```bash
cd server
npm ci --no-audit --no-fund

export GCS_BUCKET=<bucket>
export ASSET_PUBLIC=public
export GCP_PROJECT_ID=<project>
export BILLING_BQ_PROJECT_ID=<project>
export BILLING_BQ_DATASET=billing_data
export BILLING_BQ_TABLE=<bq_export_table>
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/../service-account-key.json

npm run start
```

Terminal 2 – React client (dev server on 3000, proxied to 3001):
```bash
cd client
npm ci --no-audit --no-fund
npm run start
```

Open http://localhost:3000

Notes
- The client `proxy` is set to `http://localhost:3001`, so API calls go to the server.
- If you prefer the server to serve the built client, run:
  ```bash
  cd client && npm run build
  # then start the server as above and open http://localhost:3001
  ```

---

## Option C) Build your own Docker image

Build and push:
```bash
docker build -t asia-southeast1-docker.pkg.dev/<PROJECT>/<REPO>/gen-media-demo:<TAG> .
docker push asia-southeast1-docker.pkg.dev/<PROJECT>/<REPO>/gen-media-demo:<TAG>
```

Run locally (same as Option A, with your newly built image):
```bash
docker run -p 8080:8080 ... asia-southeast1-docker.pkg.dev/<PROJECT>/<REPO>/gen-media-demo:<TAG>
```

---

## Deploy to Cloud Run

### 1) Using the pushed image
```bash
gcloud run deploy gen-media-demo \
  --image asia-southeast1-docker.pkg.dev/<PROJECT>/<REPO>/gen-media-demo:<TAG> \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=<bucket>,ASSET_PUBLIC=public,GCP_PROJECT_ID=<project>,BILLING_BQ_PROJECT_ID=<project>,BILLING_BQ_DATASET=billing_data,BILLING_BQ_TABLE=<bq_export_table>
```

### 2) From source (Cloud Build builds the Dockerfile)
```bash
gcloud run deploy gen-media-demo \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET=<bucket>,ASSET_PUBLIC=public,GCP_PROJECT_ID=<project>,BILLING_BQ_PROJECT_ID=<project>,BILLING_BQ_DATASET=billing_data,BILLING_BQ_TABLE=<bq_export_table>
```

IAM for the Cloud Run service (recommend Workload Identity):
- Grant the Cloud Run service account:
  - BigQuery Job User
  - BigQuery Data Viewer
  - Storage Object Admin on the media bucket

Cost guardrails (trial):
- Set a project budget (e.g., $300) with 50/80/100% alerts
- Cloud Run: min instances = 0, set a modest max instances (e.g., 2)
- GCS lifecycle rule to auto‑delete old objects if needed

---

## Troubleshooting
- 404 on `/canvas` after deploy: ensure the container serves the built React app (our image uses nginx) and that your Cloud Run service route is correct. Try the base URL and navigate within the app (client‑side routing).
- CORS errors locally: the dev client proxies API to `http://localhost:3001`. If using a different port/origin, align the server CORS settings.
- BigQuery or GCS 403/401: confirm the service account has the roles above and that `GOOGLE_APPLICATION_CREDENTIALS` is mounted/readable (for local/Docker).
- Empty Billing page: verify `BILLING_BQ_*` values and that the export table contains data.

---

## Quick checklist for handover
- App URL (Cloud Run): `https://<service>-<hash>-<region>.run.app`
- Env vars set (see above)
- Service account and roles verified
- Storage bucket created and accessible
- Optional: brand logo/colors added via the app’s Brand Assets page


