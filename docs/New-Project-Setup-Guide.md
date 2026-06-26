---
tags: [delivery, billing-protection, setup-guide]
status: current
---

# New Project Setup Guide — Gemini App Delivery

Full end-to-end steps for deploying a Gemini-powered app to a new client GCP project, with the full 5-layer billing protection stack.

**Roles:**
- **You (CloudAce)** — billing admin access only on the client project
- **Client** — Owner or Editor + Billing Admin on their own project

---

## Part A — What You Do (Developer)

### Phase 1: Build the App

#### 1. Scaffold the project

```bash
mkdir my-new-project && cd my-new-project
npm init -y
```

Standard structure:
```
server/
  src/
    middleware/
      auth.js
      spendLimit.js
      firebaseAdmin.js
    routes/
      generate.js       ← your Gemini route(s)
    index.js            ← Express entry point
  package.json
```

#### 2. Install server dependencies

```bash
npm install express firebase-admin @google/generative-ai
```

#### 3. Copy the middleware files

Copy the three files from `terraform/billing-protection/middleware/` into `server/src/middleware/`:

```bash
cp terraform/billing-protection/middleware/auth.js          server/src/middleware/
cp terraform/billing-protection/middleware/spendLimit.js    server/src/middleware/
cp terraform/billing-protection/middleware/firebaseAdmin.js server/src/middleware/
```

These files are ready to use as-is — no changes needed. They reference each other with relative paths.

#### 4. Wire middleware into Express

In `server/src/index.js`, apply `authenticate` + `spendLimit` to **every route that calls Gemini**:

```js
const express = require('express');
const { authenticate } = require('./middleware/auth');
const { spendLimit }   = require('./middleware/spendLimit');
const generateRoutes   = require('./routes/generate');

const app = express();
app.use(express.json());

// Every Gemini-calling route must have both middleware in this order:
app.use('/api/generate', authenticate, spendLimit, generateRoutes);
app.use('/api/video',    authenticate, spendLimit, videoRoutes);
// add others here

app.listen(process.env.PORT || 8080);
```

`authenticate` blocks unauthenticated requests (Layer 1).
`spendLimit` blocks users who exceed their daily limit (Layer 2).

#### 5. Configure the Gemini client

Use the API key from the environment variable. The client will set this after running Terraform:

```js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
```

#### 6. Create a `.env.example` template

```bash
# Set by client after running Terraform:
GOOGLE_GEMINI_API_KEY=

# Set per deployment:
GEMINI_DAILY_LIMIT_PER_USER=50

# Firebase project config (from Firebase Console):
FIREBASE_PROJECT_ID=
```

Do **not** commit `.env` — add it to `.gitignore`.

#### 7. Create a `Dockerfile`

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server/src/index.js"]
```

#### 8. Test locally

```bash
# Export a Firebase service account key for local testing only
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
export GOOGLE_GEMINI_API_KEY=your-test-key
export GEMINI_DAILY_LIMIT_PER_USER=5

node server/src/index.js
```

Confirm:
- Unauthenticated requests to `/api/generate` return `401`
- Authenticated requests succeed
- After 5 calls in a day, requests return `429`

---

### Phase 2: Prepare the Terraform Module

#### 9. Include the Terraform module in your repo

The `terraform/billing-protection/` folder from this project is the deliverable. Copy it into the new project repo:

```bash
cp -r /path/to/gen_media/terraform/billing-protection ./terraform/
```

The module includes:
```
terraform/billing-protection/
  variables.tf          ← 8 input params (project, budget, email, etc.)
  main.tf               ← all GCP infrastructure
  outputs.tf            ← API key + gcloud update command + copy instructions
  function/
    index.js            ← circuit breaker (Gen2 Cloud Function)
    package.json
  middleware/
    auth.js             ← copy of the middleware (already done in step 3)
    spendLimit.js
    firebaseAdmin.js
```

#### 10. Adjust defaults if needed

Edit `terraform/billing-protection/variables.tf`:
- `region` default is `asia-southeast1` — change if client is in a different region
- `monthly_budget_usd` default is `100` — adjust per client's agreed budget cap

---

### Phase 3: Hand Over to Client

#### 11. Send the client this information

Give the client:
1. The app source code (or container image if building for them)
2. The `terraform/billing-protection/` folder
3. Your `alert_email` to add to the budget (`Ng.jing.wen@outlook.com`)
4. The client steps from Part B below

#### 12. After client runs Terraform — add your email to the budget

Ask the client to do Step 20 (below), or do it yourself if they give you Console access:

Cloud Console → Billing → Budgets & alerts → `gemini-spend-guard-THEIR_PROJECT` → Manage notifications → Add `Ng.jing.wen@outlook.com`

This is the one step Terraform cannot do for you (billing notification channels are account-scoped, not project IAM).

---

---

## Part B — What the Client Does

**Prerequisites:** Client has Owner or Editor role + Billing Admin on their GCP project.

---

### Phase 1: GCP and Firebase Project Setup

#### 1. Create a GCP project

```bash
gcloud projects create PROJECT_ID --name="Project Display Name"
gcloud config set project PROJECT_ID
```

Or via Cloud Console: console.cloud.google.com → New Project.

#### 2. Link the project to a billing account

```bash
# List billing accounts
gcloud billing accounts list

# Link
gcloud billing projects link PROJECT_ID \
  --billing-account=XXXXXX-XXXXXX-XXXXXX
```

Or via Cloud Console: Billing → My Projects → Link project.

#### 3. Create a Firebase project linked to the same GCP project

Go to console.firebase.google.com → Add project → select the existing GCP project (do not create a new one).

#### 4. Enable Firebase Authentication

Firebase Console → Build → Authentication → Get started → Enable:
- Email/Password (minimum)
- Google Sign-In (recommended)

---

### Phase 2: Create a Service Account for Cloud Run

#### 5. Create the service account

```bash
gcloud iam service-accounts create cloud-run-sa \
  --display-name="Cloud Run Service Account" \
  --project=PROJECT_ID
```

Note the email — it will be `cloud-run-sa@PROJECT_ID.iam.gserviceaccount.com`.

#### 6. Grant it the roles the app needs

```bash
SA=cloud-run-sa@PROJECT_ID.iam.gserviceaccount.com

# Read/write Firestore (for spendLimit counters)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$SA" --role="roles/datastore.user"

# Call Firebase Auth (for token verification in auth.js)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:$SA" --role="roles/firebase.sdkAdminServiceAgent"
```

Terraform will also grant `roles/datastore.user` automatically — running both is harmless.

---

### Phase 3: Build and Deploy the App

#### 7. Enable Cloud Run and Cloud Build APIs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  --project=PROJECT_ID
```

#### 8. Build the container image with Cloud Build

From the project root:

```bash
gcloud builds submit \
  --tag asia-southeast1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/app-name:latest \
  --project=PROJECT_ID
```

Or use Cloud Build triggers connected to GitHub — that's the standard setup.

#### 9. Deploy to Cloud Run (initial deploy, without Gemini key yet)

```bash
gcloud run deploy APP_NAME \
  --image=asia-southeast1-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/app-name:latest \
  --region=asia-southeast1 \
  --project=PROJECT_ID \
  --service-account=cloud-run-sa@PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars=FIREBASE_PROJECT_ID=PROJECT_ID \
  --allow-unauthenticated \
  --platform=managed
```

The app will start but Gemini calls will fail until Step 14 wires the API key.

---

### Phase 4: Run Terraform (Full Billing Protection Stack)

#### 10. Install Terraform

```bash
# macOS
brew install terraform

# Linux
sudo apt-get install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | \
  sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
  https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

Verify: `terraform --version` (needs >= 1.5)

#### 11. Authenticate gcloud

```bash
gcloud auth application-default login
gcloud config set project PROJECT_ID
```

#### 12. Get your billing account ID

```bash
gcloud billing accounts list
```

Note the ID in `XXXXXX-XXXXXX-XXXXXX` format.

#### 13. Navigate to the Terraform module

```bash
cd terraform/billing-protection
terraform init
```

Expected output: `Terraform has been successfully initialized!`

#### 14. Run terraform apply

```bash
terraform apply \
  -var="project_id=PROJECT_ID" \
  -var="billing_account_id=XXXXXX-XXXXXX-XXXXXX" \
  -var="alert_email=your-ops@company.com" \
  -var="monthly_budget_usd=100" \
  -var="cloud_run_service_name=APP_NAME" \
  -var="cloud_run_service_account_email=cloud-run-sa@PROJECT_ID.iam.gserviceaccount.com" \
  -var="gemini_daily_limit_per_user=50"
```

Review the plan and type `yes` when prompted.

This provisions:
- Firestore database (for spendLimit counters)
- Pub/Sub topic (`billing-alerts`)
- Billing budget with 70/90/100/120% thresholds + email alerts
- Circuit breaker Cloud Function (disables Gemini key at 100%)
- Gemini API key (restricted to Generative Language API)
- Cloud Monitoring spike alert (>200 requests in 5 min)

Expect ~5 minutes.

#### 15. Run the gcloud command from Terraform output

At the end of `terraform apply`, the output prints an `── Step: update Cloud Run env vars ──` block. Copy and run those two commands exactly as printed:

```bash
# Step 1 — capture the API key
GEMINI_KEY=$(terraform output -raw gemini_api_key)

# Step 2 — wire all env vars into Cloud Run (exact command is in Terraform output)
gcloud run services update APP_NAME \
  --region asia-southeast1 \
  --project PROJECT_ID \
  --update-env-vars \
    GEMINI_DAILY_LIMIT_PER_USER=50,\
    GOOGLE_GEMINI_API_KEY=$GEMINI_KEY,\
    GOOGLE_GEMINI_KEY_NAME=$(terraform output -raw gemini_key_resource_name)
```

The app is now fully protected.

---

### Phase 5: Finalize

#### 16. Add the developer's monitoring email to the budget

Cloud Console → Billing → Budgets & alerts → `gemini-spend-guard-PROJECT_ID` → Manage notifications → Add `Ng.jing.wen@outlook.com`

This ensures CloudAce gets alerts at the same thresholds you do.

#### 17. Verify the stack end to end

**Auth middleware:**
```bash
# Should return 401
curl https://YOUR_CLOUD_RUN_URL/api/generate -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
```

**Spend limit:**
Make authenticated requests and check response headers:
- `X-Spend-Count: 1` on the first call
- `429` with `"Daily generation limit reached"` after hitting the limit

**Budget alerts:**
Cloud Console → Billing → Budgets & alerts → confirm the budget shows your project's spend.

**Circuit breaker (optional dry-run):**
Cloud Console → Cloud Functions → `billing-circuit-breaker` → Testing → Trigger manually with a Pub/Sub message. Confirm the Gemini API key's allowed APIs list goes empty in Cloud Console → APIs & Services → Credentials.

---

## Summary Table

| Step | Who | Access needed | What it sets up |
|---|---|---|---|
| 1–8 | You | None | App code with auth + spend limit middleware |
| 9–10 | You | None | Terraform module prepared |
| 11–12 | Client | Owner/Editor | Dockerfile, Firebase Auth |
| 13–15 | Client | Owner/Editor | Service account + IAM |
| 16–17 | Client | Owner/Editor | App deployed to Cloud Run |
| 18–23 | Client | Owner/Editor + Billing Admin | Full Terraform stack |
| 24 | Client | Billing Admin | Add developer email to budget |

**Result:** 5-layer billing protection active. Gemini calls require Firebase Auth. Daily per-user limit enforced. Budget alerts fire at 70/90/100/120%. Circuit breaker auto-disables the key at 100%. Spike alert fires on unusual traffic.

---

*See also: [[Billing-Protection]] (full layer runbook), [[Infrastructure]] (gen_media deployment reference)*
