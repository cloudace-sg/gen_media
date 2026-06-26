variable "project_id" {
  description = "GCP project ID of the client project"
  type        = string
}

variable "billing_account_id" {
  description = "GCP billing account ID (format: XXXXXX-XXXXXX-XXXXXX). Run: gcloud billing accounts list"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Function and Firestore"
  type        = string
  default     = "asia-southeast1"
}

variable "alert_email" {
  description = "Email address to receive billing threshold alerts (70/90/100/120%)"
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly Gemini API spend budget cap in USD"
  type        = number
  default     = 100
}

variable "cloud_run_service_name" {
  description = "Name of the Cloud Run service running the app"
  type        = string
}

variable "cloud_run_service_account_email" {
  description = "Email of the service account attached to the Cloud Run service"
  type        = string
}

variable "gemini_daily_limit_per_user" {
  description = "Max Gemini API calls per authenticated user per day (spendLimit middleware)"
  type        = number
  default     = 50
}
