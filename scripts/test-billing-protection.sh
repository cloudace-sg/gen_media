#!/usr/bin/env bash
# test-billing-protection.sh
# Test all 3 layers of billing protection with fake payloads.
# Usage: ./scripts/test-billing-protection.sh <PROJECT_ID> <TEST_TARGET>
#
# TEST_TARGET options:
#   spend-limit       Test spendLimit.js middleware (hit daily cap)
#   circuit-breaker   Test Cloud Function with fake Pub/Sub budget alert
#   all               Run all tests
#
# Prerequisites:
#   - Server running locally: cd server && npm run dev
#   - Firebase Auth ID token in TEST_TOKEN env var (or pass --token flag)
#   - gcloud auth login

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <PROJECT_ID> <TEST_TARGET>}"
TEST_TARGET="${2:-all}"
SERVER_URL="${SERVER_URL:-http://localhost:3001}"
PUBSUB_TOPIC="${PUBSUB_TOPIC:-billing-alerts}"

# ── Helpers ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; }
info() { echo -e "${YELLOW}INFO${NC} $1"; }

require_token() {
  if [ -z "${TEST_TOKEN:-}" ]; then
    echo ""
    info "TEST_TOKEN not set. Get one by running in the browser console:"
    echo "    firebase.auth().currentUser.getIdToken().then(t => console.log(t))"
    echo ""
    info "Then export it: export TEST_TOKEN=<paste token here>"
    echo ""
    exit 1
  fi
}

# ── Test 1: spendLimit middleware ─────────────────────────────────────────────
test_spend_limit() {
  echo ""
  echo "═══ TEST: spendLimit middleware ═══"
  require_token

  LIMIT="${GEMINI_DAILY_LIMIT_PER_USER:-50}"
  info "Will make $((LIMIT + 2)) requests to /api/generate — expect 429 after $LIMIT"
  echo ""

  blocked=0
  allowed=0

  for i in $(seq 1 $((LIMIT + 2))); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      "$SERVER_URL/api/generate?prompt=test+payload+$i&imageCount=1" \
      --max-time 10 2>/dev/null || echo "000")

    if [ "$STATUS" = "429" ]; then
      blocked=$((blocked + 1))
      if [ "$blocked" -eq 1 ]; then
        pass "Request $i → 429 (blocked as expected after $allowed allowed)"
      fi
    elif [ "$STATUS" = "200" ] || [ "$STATUS" = "202" ]; then
      allowed=$((allowed + 1))
      echo "  [$i] → $STATUS (allowed)"
    else
      info "  [$i] → $STATUS (unexpected — server may not be running or token expired)"
    fi
  done

  echo ""
  echo "Results: $allowed allowed, $blocked blocked"
  if [ "$blocked" -gt 0 ]; then
    pass "spendLimit is working — requests blocked after daily cap"
  else
    fail "No requests were blocked — check GEMINI_DAILY_LIMIT_PER_USER and middleware wiring"
  fi

  echo ""
  info "To reset the counter (for re-testing), delete the Firestore doc:"
  echo "  Firebase Console → Firestore → userSpend/<uid>/daily/$(date +%Y-%m-%d)"
}

# ── Test 2: Cloud Function — fake billing alert via Pub/Sub ──────────────────
test_circuit_breaker() {
  echo ""
  echo "═══ TEST: billing circuit breaker Cloud Function ═══"

  # Helper: publish a fake billing budget alert
  publish_fake_alert() {
    local THRESHOLD="$1"
    local LABEL="$2"
    local PAYLOAD
    PAYLOAD=$(cat <<EOF
{
  "budgetDisplayName": "gemini-spend-guard-test",
  "alertThresholdExceeded": $THRESHOLD,
  "costAmount": $(echo "$THRESHOLD * 100" | bc),
  "costIntervalStart": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "budgetAmount": 100.0,
  "budgetAmountType": "SPECIFIED_AMOUNT",
  "currencyCode": "USD"
}
EOF
)
    local B64
    B64=$(echo "$PAYLOAD" | base64 -w 0)
    info "Publishing fake $LABEL threshold alert ($THRESHOLD) to $PUBSUB_TOPIC..."
    gcloud pubsub topics publish "$PUBSUB_TOPIC" \
      --project="$PROJECT_ID" \
      --message="$B64" \
      --attribute="budget=test"
  }

  # Test 70% — should log only, no action
  echo ""
  echo "── Sub-test 2a: 70% alert (log only, no key disable) ──"
  publish_fake_alert 0.70 "70%"
  sleep 3
  info "Check Cloud Function logs:"
  echo "  gcloud functions logs read billing-circuit-breaker --project=$PROJECT_ID --region=asia-southeast1 --limit=5"
  pass "Message published. Verify logs show 'alert-only at 70%'"

  # Test 90% — should log only, no action
  echo ""
  echo "── Sub-test 2b: 90% alert (log only) ──"
  publish_fake_alert 0.90 "90%"
  sleep 3
  pass "Message published. Verify logs show 'alert-only at 90%'"

  # Test 100% — this WILL try to disable the API key if KEY_NAME is set
  echo ""
  echo "── Sub-test 2c: 100% alert (KEY DISABLE) ──"
  if [ -z "${GOOGLE_GEMINI_KEY_NAME:-}" ]; then
    info "GOOGLE_GEMINI_KEY_NAME not set — skipping live 100% test (would disable real key)"
    info "To test safely: set GOOGLE_GEMINI_KEY_NAME to a TEST key resource name, then re-run"
    info "  export GOOGLE_GEMINI_KEY_NAME=projects/$PROJECT_ID/locations/global/keys/<TEST_KEY_ID>"
  else
    info "WARNING: this will disable the API key at $GOOGLE_GEMINI_KEY_NAME"
    read -rp "  Proceed? (yes/no): " CONFIRM
    if [ "$CONFIRM" = "yes" ]; then
      publish_fake_alert 1.00 "100%"
      sleep 5
      info "Check Cloud Function logs:"
      echo "  gcloud functions logs read billing-circuit-breaker --project=$PROJECT_ID --region=asia-southeast1 --limit=5"
      info "To re-enable key: Cloud Console → APIs & Services → Credentials → restore restrictions"
    else
      info "Skipped — run manually when ready"
    fi
  fi
}

# ── Test 3: Local Cloud Function (no deployment needed) ──────────────────────
test_circuit_breaker_local() {
  echo ""
  echo "═══ TEST: Cloud Function locally (no Pub/Sub, no deployment) ═══"

  FUNCTION_DIR="$(dirname "$0")/../functions/billingCircuitBreaker"

  if [ ! -f "$FUNCTION_DIR/index.js" ]; then
    fail "functions/billingCircuitBreaker/index.js not found"
    return
  fi

  info "Running function locally with fake 100% threshold payload..."
  echo ""

  node - <<'NODEEOF'
process.env.PROJECT_ID = process.env.PROJECT_ID || 'test-project';
process.env.GOOGLE_GEMINI_KEY_NAME = process.env.GOOGLE_GEMINI_KEY_NAME || '';

const { billingAlert } = require('./functions/billingCircuitBreaker/index.js');

const fakePayloads = [
  { label: '70% threshold (alert-only)',  data: { alertThresholdExceeded: 0.70, costAmount: 70,  budgetAmount: 100 } },
  { label: '90% threshold (alert-only)',  data: { alertThresholdExceeded: 0.90, costAmount: 90,  budgetAmount: 100 } },
  { label: '100% threshold (key disable)', data: { alertThresholdExceeded: 1.00, costAmount: 100, budgetAmount: 100 } },
];

(async () => {
  for (const { label, data } of fakePayloads) {
    console.log(`\n── ${label} ──`);
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64');
    await billingAlert({ data: encoded }, {}).catch(e => console.error('Error:', e.message));
  }
})();
NODEEOF
}

# ── Runner ────────────────────────────────────────────────────────────────────
echo "==> Billing Protection Tests | Project: $PROJECT_ID | Target: $TEST_TARGET"

case "$TEST_TARGET" in
  spend-limit)
    test_spend_limit
    ;;
  circuit-breaker)
    test_circuit_breaker
    ;;
  circuit-breaker-local)
    test_circuit_breaker_local
    ;;
  all)
    test_spend_limit
    test_circuit_breaker
    ;;
  *)
    echo "Unknown test target: $TEST_TARGET"
    echo "Options: spend-limit | circuit-breaker | circuit-breaker-local | all"
    exit 1
    ;;
esac

echo ""
echo "==> Done"
