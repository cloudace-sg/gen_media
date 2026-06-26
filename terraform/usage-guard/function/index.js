const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const PROJECT_ID = process.env.PROJECT_ID;

// Gen2 Cloud Functions receive Pub/Sub messages as CloudEvents.
exports.billingAlert = async (cloudEvent) => {
  const raw = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('[usage-guard] invalid Pub/Sub payload:', raw);
    return;
  }

  const threshold  = data.alertThresholdExceeded;
  const cost       = data.costAmount;
  const budget     = data.budgetAmount;

  console.log(`[usage-guard] threshold=${threshold} cost=${cost} budget=${budget}`);

  // 100% → email only (handled by billing budget notification channel, no action here)
  // 120% → disable the Gemini API for the entire project
  if (threshold >= 1.2) {
    if (!PROJECT_ID) {
      console.error('[usage-guard] PROJECT_ID env var not set');
      return;
    }

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const serviceusage = google.serviceusage({ version: 'v1', auth });

      await serviceusage.services.disable({
        name: `projects/${PROJECT_ID}/services/generativelanguage.googleapis.com`,
        requestBody: { disableDependentServices: false },
      });

      console.log(`[usage-guard] Gemini API DISABLED at ${threshold * 100}% budget. Re-enable with:`);
      console.log(`  gcloud services enable generativelanguage.googleapis.com --project=${PROJECT_ID}`);
    } catch (err) {
      console.error('[usage-guard] failed to disable Gemini API:', err.message);
    }
  }
};
