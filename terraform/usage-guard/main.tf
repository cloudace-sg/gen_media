terraform {
  required_version = ">= 1.5"
  required_providers {
    google  = { source = "hashicorp/google", version = "~> 5.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "project" {
  project_id = var.project_id
}

# ─── Enable required APIs ─────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "billingbudgets.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "eventarc.googleapis.com",
    "monitoring.googleapis.com",
    "serviceusage.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ─── Email notification channels ─────────────────────────────────────────────
# Fixed billing admin list — applies to every client project.

locals {
  billing_admin_emails = [
    "admin@sg.cloud-ace.com",
    "angie.ng@cloud-ace.com",
    "manfred.chong@cloud-ace.com",
    "sean.teo@cloud-ace.com",
  ]
}

resource "google_monitoring_notification_channel" "billing_admin" {
  for_each     = toset(local.billing_admin_emails)
  project      = var.project_id
  display_name = "Gemini Billing Admin — ${each.value}"
  type         = "email"
  labels       = { email_address = each.value }
  depends_on   = [google_project_service.apis]
}

# ─── Pub/Sub topic: budget → circuit breaker ─────────────────────────────────

resource "google_pubsub_topic" "usage_alerts" {
  name       = "gemini-usage-alerts"
  project    = var.project_id
  depends_on = [google_project_service.apis]
}

# Cloud Billing service agent must be able to publish budget events.
resource "google_pubsub_topic_iam_member" "billing_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.usage_alerts.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-billing.iam.gserviceaccount.com"
}

# ─── Billing budget ───────────────────────────────────────────────────────────
# 100% → email only
# 120% → email + Pub/Sub → circuit breaker disables Gemini API

resource "google_billing_budget" "usage_guard" {
  billing_account = var.billing_account_id
  display_name    = "gemini-usage-guard-${var.project_id}"

  budget_filter {
    projects = ["projects/${data.google_project.project.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  threshold_rules { threshold_percent = 1.0 }
  threshold_rules { threshold_percent = 1.2; spend_basis = "CURRENT_SPEND" }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.usage_alerts.id
    monitoring_notification_channels = values(google_monitoring_notification_channel.billing_admin)[*].name
    disable_default_iam_recipients   = false
  }
}

# ─── Circuit breaker service account ─────────────────────────────────────────
# Minimal permissions: only allowed to disable/enable GCP services.

resource "google_service_account" "usage_guard" {
  project      = var.project_id
  account_id   = "gemini-usage-guard"
  display_name = "Gemini Usage Guard"
}

resource "google_project_iam_member" "usage_guard_serviceusage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = "serviceAccount:${google_service_account.usage_guard.email}"
}

resource "google_project_iam_member" "usage_guard_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.usage_guard.email}"
}

# ─── Circuit breaker Cloud Function (Gen2) ────────────────────────────────────
# At 120%: disables generativelanguage.googleapis.com for the project.
# Effect: all Gemini API calls return 403, regardless of auth method.
# To re-enable: gcloud services enable generativelanguage.googleapis.com --project=PROJECT_ID

resource "google_storage_bucket" "function_source" {
  name                        = "${var.project_id}-usage-guard-src"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
  depends_on                  = [google_project_service.apis]
}

data "archive_file" "usage_guard_zip" {
  type        = "zip"
  source_dir  = "${path.module}/function"
  output_path = "${path.module}/.terraform/usage-guard.zip"
}

resource "google_storage_bucket_object" "usage_guard_source" {
  name   = "usage-guard-${data.archive_file.usage_guard_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.usage_guard_zip.output_path
}

resource "google_cloudfunctions2_function" "usage_guard" {
  name     = "gemini-usage-guard"
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "nodejs20"
    entry_point = "billingAlert"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.usage_guard_source.name
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 1
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.usage_guard.email
    environment_variables = {
      PROJECT_ID = var.project_id
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.usage_alerts.id
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
    service_account_email = google_service_account.usage_guard.email
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.usage_guard_serviceusage,
    google_project_iam_member.usage_guard_run_invoker,
  ]
}
