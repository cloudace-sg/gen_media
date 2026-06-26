variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "billing_account_id" {
  description = "GCP billing account ID (format: XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "region" {
  description = "GCP region for the Cloud Function"
  type        = string
  default     = "asia-southeast1"
}

variable "monthly_budget_usd" {
  description = "Monthly spend cap in USD for this project — email fires at 100%, Gemini paused at 120%. Must be set explicitly per project."
  type        = number
}
