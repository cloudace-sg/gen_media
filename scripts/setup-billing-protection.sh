#!/usr/bin/env bash
# setup-billing-protection.sh
# Run once per GCP project to wire up Gemini API cost protection.
# Usage: ./scripts/setup-billing-protection.sh <PROJECT_ID> <BILLING_ACCOUNT_ID> <ALERT_EMAIL> [MONTHLY_BUDGET_USD]
#
# Prerequisites:
#   gcloud auth login && gcloud auth application-default login
#   gcloud components install beta (for quotas and billing budgets)

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <PROJECT_ID> <BILLING_ACCOUNT_ID> <ALERT_EMAIL> [MONTHLY_BUDGET_USD]}"
BILLING_ACCOUNT_ID="${2:?Missing BILLING_ACCOUNT_ID}"
ALERT_EMAIL="${3:?Missing ALERT_EMAIL}"
MONTHLY_BUDGET_USD="${4:-100}"

REGION="asia-southeast1"
PUBSUB_TOPIC="billing-alerts"
FUNCTION_NAME="billing-circuit-breaker"
ALERT_POLICY_NAME="gemini-request-spike"

echo "==> Setting up billing protection for project: $PROJECT_ID"
echo "    Budget: USD $MONTHLY_BUDGET_USD/month | Alerts to: $ALERT_EMAIL"
echo ""

# ── Step 1: Enable required APIs ────────────────────────────────────────────
echo "[1/6] Enabling required APIs..."
gcloud services enable \
  monitoring.googleapis.com \
  pubsub.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  billingbudgets.googleapis.com \
  apikeys.googleapis.com \
  --project="$PROJECT_ID"

# ── Step 2: Create Pub/Sub topic for billing alerts ──────────────────────────
echo "[2/6] Creating Pub/Sub topic: $PUBSUB_TOPIC..."
gcloud pubsub topics create "$PUBSUB_TOPIC" \
  --project="$PROJECT_ID" 2>/dev/null || echo "    (topic already exists, skipping)"

# ── Step 3: Create Billing Budget with tiered alert thresholds ───────────────
echo "[3/6] Creating billing budget (USD $MONTHLY_BUDGET_USD) with 70/90/100/120% alerts..."
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="gemini-spend-guard-$PROJECT_ID" \
  --budget-amount="${MONTHLY_BUDGET_USD}USD" \
  --threshold-rule=percent=0.70 \
  --threshold-rule=percent=0.90 \
  --threshold-rule=percent=1.00 \
  --threshold-rule=percent=1.20 \
  --notifications-rule-pubsub-topic="projects/$PROJECT_ID/topics/$PUBSUB_TOPIC" \
  --notifications-rule-monitoring-email-addresses="$ALERT_EMAIL" \
  --filter-projects="projects/$PROJECT_ID"

# ── Step 4: Create Cloud Monitoring alert for Gemini request spike ───────────
echo "[4/6] Creating Cloud Monitoring spike alert (>200 requests in 5 min)..."
gcloud alpha monitoring policies create \
  --project="$PROJECT_ID" \
  --policy='{
    "displayName": "'"$ALERT_POLICY_NAME"'",
    "conditions": [{
      "displayName": "Gemini API request spike",
      "conditionThreshold": {
        "filter": "metric.type=\"serviceruntime.googleapis.com/api/request_count\" resource.type=\"consumed_api\" resource.label.\"service\"=\"generativelanguage.googleapis.com\"",
        "aggregations": [{
          "alignmentPeriod": "300s",
          "perSeriesAligner": "ALIGN_RATE",
          "crossSeriesReducer": "REDUCE_SUM"
        }],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 200,
        "duration": "0s"
      }
    }],
    "notificationChannels": [],
    "alertStrategy": { "autoClose": "604800s" }
  }' 2>/dev/null || echo "    (spike alert may already exist, skipping)"

# ── Step 5: Deploy billing circuit breaker Cloud Function ───────────────────
FUNCTION_DIR="$(dirname "$0")/../functions/billingCircuitBreaker"
if [ -d "$FUNCTION_DIR" ]; then
  echo "[5/6] Deploying billing circuit breaker Cloud Function..."
  gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --runtime=nodejs20 \
    --trigger-topic="$PUBSUB_TOPIC" \
    --entry-point=billingAlert \
    --source="$FUNCTION_DIR" \
    --set-env-vars="PROJECT_ID=$PROJECT_ID" \
    --memory=256MB \
    --timeout=60s \
    --min-instances=0 \
    --max-instances=1
else
  echo "[5/6] SKIP: functions/billingCircuitBreaker/ not found — deploy manually."
fi

# ── Step 6: Print manual steps ───────────────────────────────────────────────
echo ""
echo "[6/6] Manual steps remaining (cannot be scripted):"
echo ""
echo "  A) API key HTTP referrer restriction:"
echo "     Cloud Console → APIs & Services → Credentials → your GOOGLE_GEMINI_API_KEY"
echo "     Application restrictions → HTTP referrers → add your Cloud Run URL"
echo "     API restrictions → Restrict key → Generative Language API only"
echo ""
echo "  B) Set Cloud Quotas per-project cap:"
echo "     Cloud Console → APIs & Services → Quotas → Generative Language API"
echo "     Set 'Requests per day' to your safe ceiling (e.g. 5000)"
echo ""
echo "  C) Add GOOGLE_GEMINI_KEY_NAME to Cloud Run env vars (needed by circuit breaker):"
echo "     gcloud run services update <SERVICE_NAME> --region $REGION \\"
echo "       --update-env-vars GOOGLE_GEMINI_KEY_NAME=projects/$PROJECT_ID/locations/global/keys/<KEY_ID>"
echo ""
echo "  D) Add spendLimit.js middleware to your Express server (see server/src/middleware/spendLimit.js)"
echo "     Wire it after authenticate() on /api/generate, /api/remix, /api/video, /api/prompt"
echo "     Set GEMINI_DAILY_LIMIT_PER_USER env var on Cloud Run (e.g. 50)"
echo ""
echo "==> Setup complete for $PROJECT_ID"
