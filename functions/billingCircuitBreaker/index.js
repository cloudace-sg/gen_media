const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const PROJECT_ID = process.env.PROJECT_ID;
// Full resource name of the Gemini API key to disable:
// projects/<PROJECT_ID>/locations/global/keys/<KEY_ID>
// Set GOOGLE_GEMINI_KEY_NAME on Cloud Run / the function env vars.
const KEY_NAME = process.env.GOOGLE_GEMINI_KEY_NAME;

exports.billingAlert = async (pubSubEvent, context) => {
  const raw = Buffer.from(pubSubEvent.data, 'base64').toString();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('[circuit-breaker] invalid Pub/Sub payload:', raw);
    return;
  }

  const threshold = data.alertThresholdExceeded;
  const costAmount = data.costAmount;
  const budgetAmount = data.budgetAmount;

  console.log(`[circuit-breaker] threshold=${threshold} cost=${costAmount} budget=${budgetAmount}`);

  // 100% threshold → disable the Gemini API key (surgical — app stays up)
  if (threshold >= 1.0) {
    if (!KEY_NAME) {
      console.error('[circuit-breaker] GOOGLE_GEMINI_KEY_NAME not set — cannot disable key');
      return;
    }

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      const apikeys = google.apikeys({ version: 'v2', auth });

      // Patch the key to remove all API restrictions → effectively blocks usage
      // To re-enable: restore the original restrictions in Cloud Console
      await apikeys.projects.locations.keys.patch({
        name: KEY_NAME,
        updateMask: 'restrictions',
        requestBody: {
          restrictions: {
            apiTargets: [] // empty = no APIs allowed = key is blocked
          }
        }
      });

      console.log(`[circuit-breaker] KEY DISABLED at ${threshold * 100}% threshold. Key: ${KEY_NAME}`);
    } catch (err) {
      console.error('[circuit-breaker] failed to disable key:', err.message);
    }
  } else {
    // 70% or 90% — log only (email alert fires automatically via Budget config)
    console.log(`[circuit-breaker] alert-only at ${threshold * 100}% — no action taken`);
  }
};
