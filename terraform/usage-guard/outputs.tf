output "budget_name" {
  description = "Billing budget display name"
  value       = google_billing_budget.usage_guard.display_name
}

output "circuit_breaker_function" {
  description = "Circuit breaker Cloud Function name"
  value       = google_cloudfunctions2_function.usage_guard.name
}

output "re_enable_command" {
  description = "Run this to re-enable Gemini after a 120% pause"
  value       = "gcloud services enable generativelanguage.googleapis.com --project=${var.project_id}"
}
