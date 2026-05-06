# Marketing Media Generation – Run & Deploy

Looking for a friendly, step‑by‑step guide? See the new getting started:

- Getting Started (Local + Cloud Run): [docs/GettingStarted.md](docs/GettingStarted.md)

Below is a concise container‑focused reference.

## Prerequisites
- Docker 20.10+
- Access to the Artifact Registry repository that hosts the image
- A Google Cloud service account JSON key with at least:
  - BigQuery Job User (roles/bigquery.jobUser)
  - BigQuery Data Viewer (roles/bigquery.dataViewer)
  - Storage Object Viewer (roles/storage.objectViewer)
- Environment variables (see .env.example):
  - GCS_BUCKET, ASSET_PUBLIC, GCP_PROJECT_ID
  - BILLING_BQ_PROJECT_ID, BILLING_BQ_DATASET, BILLING_BQ_TABLE
  - GOOGLE_APPLICATION_CREDENTIALS points to the JSON key path inside the container

## 1) Authenticate Docker to Artifact Registry
```bash
# Replace REGION if needed (asia-southeast1 shown)
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

## 2) Pull the image
```bash
IMAGE_PATH=asia-southeast1-docker.pkg.dev/int-casg-gen-media-poc/gen-media-demo/gen-media-demo:latest

docker pull $IMAGE_PATH
```

## 3A) Run with docker run
```bash
# Place your service account key at ./service-account-key.json (host)

docker run -p 8080:8080 \
  -e GCS_BUCKET=gen-media-demo-assets \
  -e ASSET_PUBLIC=public \
  -e GCP_PROJECT_ID=int-casg-gen-media-poc \
  -e BILLING_BQ_PROJECT_ID=int-casg-gen-media-poc \
  -e BILLING_BQ_DATASET=billing_data \
  -e BILLING_BQ_TABLE=gcp_billing_export_v1_0189CB_BBF20B_F0BFBF \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json \
  -v $(pwd)/service-account-key.json:/app/service-account-key.json:ro \
  $IMAGE_PATH
```
- App: http://localhost:8080
- API is reverse-proxied by nginx to the Node server on port 3001

## 3B) Run with docker compose (recommended)
Create `docker-compose.yml` like below and a `.env` if you prefer env files.

```yaml
version: '3.8'
services:
  app:
    image: asia-southeast1-docker.pkg.dev/int-casg-gen-media-poc/gen-media-demo/gen-media-demo:latest
    ports:
      - "8080:8080"
    environment:
      GCS_BUCKET: gen-media-demo-assets
      ASSET_PUBLIC: public
      GCP_PROJECT_ID: int-casg-gen-media-poc
      BILLING_BQ_PROJECT_ID: int-casg-gen-media-poc
      BILLING_BQ_DATASET: billing_data
      BILLING_BQ_TABLE: gcp_billing_export_v1_0189CB_BBF20B_F0BFBF
      GOOGLE_APPLICATION_CREDENTIALS: /app/service-account-key.json
    volumes:
      - ./service-account-key.json:/app/service-account-key.json:ro
```

Start:
```bash
docker compose up -d
```

## Environment variables
Minimum required:
- GCS_BUCKET
- ASSET_PUBLIC
- GCP_PROJECT_ID
- BILLING_BQ_PROJECT_ID
- BILLING_BQ_DATASET
- BILLING_BQ_TABLE
- GOOGLE_APPLICATION_CREDENTIALS (path inside the container)


## Troubleshooting
- 403/401 from BigQuery/Storage: verify service account roles and that the key is mounted and readable.
- Billing page shows mock/empty: check BILLING_BQ_* values and that the export table exists with data.
- Port conflict: change the host mapping (e.g. `-p 8081:8080`).

## Health check
- http://localhost:8080/health
