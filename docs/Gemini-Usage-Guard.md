---
tags: [billing, terraform, gemini, delivery]
status: current
---

# Gemini Usage Guard — Terraform Module

Reusable Terraform module that protects any client GCP project from Gemini API cost overruns. Deployed once by the client; notifies all CloudAce billing admins automatically.

See also: [[Billing-Protection]] (full 5-layer stack for gen_media), [[New-Project-Setup-Guide]]

---

## What it does

| Threshold | Action |
|---|---|
| 100% of monthly budget | Email all billing admins |
| 120% of monthly budget | Email all billing admins + disable Gemini API for the project |

At 120%, the Cloud Function calls Google's Service Usage API to disable `generativelanguage.googleapis.com`. Every Gemini call immediately returns `403 API not enabled`, regardless of how the client authenticates (API key, Workload Identity, service account).

Only Gemini stops — Cloud Run, Firebase, Firestore, Cloud Storage, and the app itself stay up.

---

## Fixed Billing Admins

Hardcoded in `main.tf` — applies to every client project, no variable needed:

```
admin@sg.cloud-ace.com
angie.ng@cloud-ace.com
manfred.chong@cloud-ace.com
sean.teo@cloud-ace.com
```

Source: `gcloud billing accounts get-iam-policy 019F64-418A79-6241FB`

---

## Module location

```
terraform/usage-guard/
  variables.tf          ← 3 required inputs (no billing admin emails var — hardcoded)
  main.tf               ← APIs, Pub/Sub, budget, notification channels, Cloud Function
  outputs.tf            ← budget name, function name, re-enable command
  function/
    index.js            ← Gen2 Cloud Function: disables generativelanguage.googleapis.com at 120%
    package.json
```

---

## Who runs the Terraform

**The client** — they need Owner/Editor + Billing Admin on their own project.

CloudAce only has billing admin access and cannot run this Terraform (creating Cloud Functions, Pub/Sub topics, service accounts, and storage buckets all require project-level roles we don't have).

---

## Terraform commands

### Deploy (client runs once per project)

```bash
cd terraform/usage-guard
terraform init
terraform apply \
  -var="project_id=CLIENT_PROJECT_ID" \
  -var="billing_account_id=XXXXXX-XXXXXX-XXXXXX" \
  -var="monthly_budget_usd=200"
```

`monthly_budget_usd` has no default — must always be set explicitly per project. Billing admins are hardcoded; no email variable needed.

To get the client's billing account ID:
```bash
gcloud billing accounts list
```

### Re-enable Gemini after a 120% pause

When the client resolves the spend issue, any project Owner/Editor runs:

```bash
gcloud services enable generativelanguage.googleapis.com --project=CLIENT_PROJECT_ID
```

Terraform also prints this command in its output after `apply`.

---

## Caveats

### 1. Billing data is delayed up to 24 hours

Google Cloud billing data is not real-time. The budget alert fires based on data that can be 12–24 hours behind actual spend. If the project crosses 120% at 2pm, the Cloud Function might not fire until the following morning.

This means the shutdown is not instant — it is a safety net, not a real-time kill switch.

### 2. Only blocks the standard Gemini API

Disabling `generativelanguage.googleapis.com` stops calls made through the standard Gemini API. If the client's app calls Gemini through **Vertex AI** (`aiplatform.googleapis.com`) instead, those calls are not blocked.

Disabling `aiplatform.googleapis.com` would stop Vertex AI Gemini calls but also disables all other Vertex AI features, which is more disruptive. Clarify with the client which API they use before deploying.

### 3. Budget covers all project spend (not Gemini only)

The budget tracks total project spend. If a non-Gemini service (e.g. BigQuery, Cloud Storage) causes the 120% breach, the Cloud Function will still disable Gemini — even though Gemini was not the cause.

---

## What it provisions

| Resource | Purpose |
|---|---|
| `google_monitoring_notification_channel` (×4) | One email channel per billing admin |
| `google_pubsub_topic` | Event bus: billing budget → Cloud Function |
| Billing publisher IAM | Allows Cloud Billing to post to Pub/Sub |
| `google_billing_budget` | Tracks spend; fires at 100% and 120% |
| `google_service_account` | Identity for the Cloud Function (minimal permissions) |
| `roles/serviceusage.serviceUsageAdmin` | Only permission: enable/disable APIs |
| `google_storage_bucket` | Hosts the Cloud Function source zip |
| `google_cloudfunctions2_function` | Circuit breaker — disables Gemini at 120% |
