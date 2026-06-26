const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

// Full resource name: projects/<PROJECT_ID>/locations/global/keys/<KEY_ID>
// Injected by Terraform via GOOGLE_GEMINI_KEY_NAME env var.
const KEY_NAME = process.env.GOOGLE_GEMINI_KEY_NAME;

// Gen2 Cloud Functions receive Pub/Sub messages as CloudEvents.
exports.billingAlert = async (cloudEvent) => {
  const raw = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('[circuit-breaker] invalid Pub/Sub payload:', raw);
    return;
  }

  const threshold   = data.alertThresholdExceeded;
  const costAmount  = data.costAmount;
  const budgetAmount = data.budgetAmount;

  console.log(`[circuit-breaker] threshold=${threshold} cost=${costAmount} budget=${budgetAmount}`);

  // At 100% budget: remove all API targets from the key → every Gemini call returns 403.
  // Only Gemini stops — Cloud Run, Firebase, GCS, and the website stay up.
  // To re-enable: restore api_targets in Cloud Console or re-run terraform apply.
  if (threshold >= 1.0) {
    if (!KEY_NAME) {
      console.error('[circuit-breaker] GOOGLE_GEMINI_KEY_NAME not set — cannot disable key');
      return;
    }

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const apikeys = google.apikeys({ version: 'v2', auth });

      await apikeys.projects.locations.keys.patch({
        name: KEY_NAME,
        updateMask: 'restrictions',
        requestBody: {
          restrictions: {
            apiTargets: [], // empty = no APIs allowed = key blocked
          },
        },
      });

      console.log(`[circuit-breaker] KEY DISABLED at ${threshold * 100}% threshold. Key: ${KEY_NAME}`);
    } catch (err) {
      console.error('[circuit-breaker] failed to disable key:', err.message);
    }
  } else {
    console.log(`[circuit-breaker] alert-only at ${threshold * 100}% — no action taken`);
  }
};
