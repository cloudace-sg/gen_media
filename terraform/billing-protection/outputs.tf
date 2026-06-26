output "gemini_api_key" {
  description = "Gemini API key string — set as GOOGLE_GEMINI_API_KEY on Cloud Run"
  value       = google_apikeys_key.gemini.key_string
  sensitive   = true
}

output "gemini_key_resource_name" {
  description = "Gemini key resource name — used internally by circuit breaker"
  value       = google_apikeys_key.gemini.id
}

output "firestore_database" {
  description = "Firestore database name"
  value       = google_firestore_database.default.name
}

output "circuit_breaker_function" {
  description = "Circuit breaker Cloud Function name"
  value       = google_cloudfunctions2_function.circuit_breaker.name
}

output "pubsub_topic" {
  description = "Pub/Sub topic receiving billing budget alerts"
  value       = google_pubsub_topic.billing_alerts.id
}

# Print the exact gcloud command to wire env vars into the client's Cloud Run service.
output "cloud_run_update_command" {
  description = "Run this after terraform apply to wire env vars into Cloud Run"
  value       = <<-EOT

    ── Step: update Cloud Run env vars ──────────────────────────────────────────
    Run the following command (requires roles/run.admin on the project):

    GEMINI_KEY=$(terraform -chdir=${path.module} output -raw gemini_api_key)

    gcloud run services update ${var.cloud_run_service_name} \
      --region ${var.region} \
      --project ${var.project_id} \
      --update-env-vars \
        GEMINI_DAILY_LIMIT_PER_USER=${var.gemini_daily_limit_per_user},\
        GOOGLE_GEMINI_API_KEY=$GEMINI_KEY,\
        GOOGLE_GEMINI_KEY_NAME=${google_apikeys_key.gemini.id}

    ─────────────────────────────────────────────────────────────────────────────
    Step: copy middleware into your server

    The middleware/ folder next to this Terraform module contains:
      middleware/auth.js          — Firebase ID token verification
      middleware/spendLimit.js    — per-user daily Gemini call counter
      middleware/firebaseAdmin.js — Firebase Admin SDK init

    Copy to your server:
      cp -r ${path.module}/middleware <YOUR_SERVER_SRC>/middleware

    Install the one dependency (if not already present):
      npm install firebase-admin

    Wire into Express (add authenticate + spendLimit before every Gemini route):
      const { authenticate } = require('./middleware/auth');
      const { spendLimit }   = require('./middleware/spendLimit');

      app.use('/api/generate', authenticate, spendLimit, generateRoutes);
      app.use('/api/video',    authenticate, spendLimit, videoRoutes);
      // add any other Gemini-calling routes here
    ─────────────────────────────────────────────────────────────────────────────
  EOT
}
