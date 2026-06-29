---
tags: [dev-log, session, billing, terraform, delivery]
status: updated
---

# Session — 29 June 2026

Focus: Gemini API cost protection for client project delivery. Clarified access model, simplified the Terraform approach, finalised billing admin handover docs.

---

## Key Decisions

### 1. Delivery model is different from gen_media

The billing protection work done in gen_media assumed we control the project. For client deliveries the model is:
- **Client builds their own app** — we don't touch their codebase
- **Client has Owner/Editor** on their own GCP project
- **We only have billing admin** — no project visibility, can't deploy, can't run Terraform

This changed what we needed to build.

### 2. What billing admin can actually do

With `roles/billing.admin` on the billing account only:
- Can create/edit billing budgets in Cloud Console
- Can set spend thresholds and email notifications
- **Cannot** enable APIs, create Cloud Functions, Pub/Sub, service accounts, or storage
- **Cannot** see anything in the client's GCP project console

The one unilateral action: manually create the billing budget via **Cloud Console → Billing → Budgets & alerts → Create budget**.

### 3. Terraform is a client-run tool, not something we run

The `terraform/usage-guard/` module is a deliverable we hand to the client. They run it with their Owner/Editor access. We cannot run it ourselves.

### 4. Simplified from full 5-layer stack to usage-guard

The full `terraform/billing-protection/` module (Firestore, spend limit middleware, API key management, spike alerts) was designed for gen_media where we control everything. For client delivery, a much simpler module was needed:

- **100%** → email all billing admins
- **120%** → email + disable `generativelanguage.googleapis.com` for the project

Disabling the API service (not an API key) was the right call — it stops all Gemini calls regardless of how the client authenticates (API key, Workload Identity, service account).

### 5. Billing admins are fixed across all projects

Pulled from `gcloud billing accounts get-iam-policy 019F64-418A79-6241FB`:
```
admin@sg.cloud-ace.com
angie.ng@cloud-ace.com
manfred.chong@cloud-ace.com
sean.teo@cloud-ace.com
```

Hardcoded in `terraform/usage-guard/main.tf` as a local — no variable, no risk of forgetting someone.

### 6. monthly_budget_usd has no default

Every client project has a different agreed budget. Removed the default from `monthly_budget_usd` so Terraform errors if it's not explicitly set — prevents accidentally deploying with a wrong cap.

### 7. Middleware files — what client needs to edit

If clients use `auth.js` and `spendLimit.js` as reference code, only two things need changing:
1. **Import paths** — adjust `./firebaseAdmin` to match where they put the files
2. **Admin role check** — `req.user?.role || req.user?.claims?.role === 'admin'` must match their Firebase custom claims structure. If no admin users, delete the check entirely.

Everything else works as-is on Cloud Run (Application Default Credentials picked up automatically).

---

## What Was Built This Session

| Artifact | Location | Purpose |
|---|---|---|
| `terraform/usage-guard/` | `terraform/usage-guard/` | Simplified billing protection — 3 vars, 4 hardcoded admins |
| `terraform/usage-guard/function/index.js` | same | Gen2 Cloud Function: disables Gemini API at 120% |
| `terraform/billing-protection/middleware/` | same | Reference middleware files for client delivery |
| `docs/Gemini-Usage-Guard.md` | docs | Full runbook for usage-guard module |
| `docs/New-Project-Setup-Guide.md` | docs | End-to-end handover guide — developer vs client steps |

Committed as `7159d82`, pushed, Cloud Build completed (builds `eb20e056`, `4930aeae` — both SUCCESS).

---

## Caveats Documented

1. **Billing data delay** — up to 24h. The 120% shutdown is not instant; it fires when billing data catches up.
2. **Vertex AI not covered** — disabling `generativelanguage.googleapis.com` only stops the standard Gemini API. Vertex AI calls (`aiplatform.googleapis.com`) are unaffected.
3. **All-project budget scope** — the budget tracks total project spend, not just Gemini. If another service causes the 120% breach, Gemini still gets disabled.

---

## Terraform Cheat Sheet (for reference)

### Deploy (client runs)
```bash
cd terraform/usage-guard
terraform init
terraform apply \
  -var="project_id=CLIENT_PROJECT_ID" \
  -var="billing_account_id=XXXXXX-XXXXXX-XXXXXX" \
  -var="monthly_budget_usd=200"
```

### Re-enable Gemini after 120% pause (client runs)
```bash
gcloud services enable generativelanguage.googleapis.com --project=CLIENT_PROJECT_ID
```

### Get client's billing account ID
```bash
gcloud billing accounts list
```

---

## Related
- [[Gemini-Usage-Guard]] — full runbook
- [[New-Project-Setup-Guide]] — end-to-end client handover
- [[Billing-Protection]] — full 5-layer stack for gen_media itself
