terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
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
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "monitoring.googleapis.com",
    "billingbudgets.googleapis.com",
    "apikeys.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "eventarc.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# ─── Firestore ────────────────────────────────────────────────────────────────
# Used by spendLimit middleware to track per-user daily call counts.

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# Allow the Cloud Run service account to read/write Firestore counters.
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${var.cloud_run_service_account_email}"
}

# ─── Pub/Sub topic for billing alerts ────────────────────────────────────────
# Cloud Billing publishes budget threshold events here; the circuit breaker
# Cloud Function subscribes and disables the Gemini API key at 100%.

resource "google_pubsub_topic" "billing_alerts" {
  name    = "billing-alerts"
  project = var.project_id

  depends_on = [google_project_service.apis]
}

# Cloud Billing service agent must be able to publish to the topic.
resource "google_pubsub_topic_iam_member" "billing_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.billing_alerts.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-billing.iam.gserviceaccount.com"
}

# ─── Billing budget + email alerts ───────────────────────────────────────────

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "Gemini Billing Alert"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

resource "google_billing_budget" "gemini_guard" {
  billing_account = var.billing_account_id
  display_name    = "gemini-spend-guard-${var.project_id}"

  budget_filter {
    projects = ["projects/${data.google_project.project.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }

  threshold_rules { threshold_percent = 0.7 }
  threshold_rules { threshold_percent = 0.9 }
  threshold_rules { threshold_percent = 1.0; spend_basis = "CURRENT_SPEND" }
  threshold_rules { threshold_percent = 1.2; spend_basis = "CURRENT_SPEND" }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.billing_alerts.id
    monitoring_notification_channels = [google_monitoring_notification_channel.email.name]
    disable_default_iam_recipients   = false
  }
}

# ─── Circuit Breaker Cloud Function ──────────────────────────────────────────
# Listens to billing-alerts Pub/Sub. At 100% budget, patches the Gemini API
# key restrictions to block all calls (app stays up; only Gemini 403s).

resource "google_service_account" "circuit_breaker" {
  project      = var.project_id
  account_id   = "billing-circuit-breaker"
  display_name = "Billing Circuit Breaker SA"
}

# The function needs to patch (disable) the Gemini API key.
resource "google_project_iam_member" "circuit_breaker_apikeys" {
  project = var.project_id
  role    = "roles/serviceusage.apiKeysAdmin"
  member  = "serviceAccount:${google_service_account.circuit_breaker.email}"
}

# Allow Eventarc to invoke the Cloud Run service backing the Gen2 function.
resource "google_project_iam_member" "circuit_breaker_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.circuit_breaker.email}"
}

resource "google_storage_bucket" "function_source" {
  name                        = "${var.project_id}-gcf-source"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.apis]
}

data "archive_file" "circuit_breaker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/function"
  output_path = "${path.module}/.terraform/circuit-breaker.zip"
}

resource "google_storage_bucket_object" "circuit_breaker_source" {
  name   = "circuit-breaker-${data.archive_file.circuit_breaker_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.circuit_breaker_zip.output_path
}

resource "google_cloudfunctions2_function" "circuit_breaker" {
  name     = "billing-circuit-breaker"
  location = var.region
  project  = var.project_id

  build_config {
    runtime     = "nodejs20"
    entry_point = "billingAlert"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.circuit_breaker_source.name
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 1
    available_memory      = "256M"
    timeout_seconds       = 60
    service_account_email = google_service_account.circuit_breaker.email
    environment_variables = {
      GOOGLE_GEMINI_KEY_NAME = google_apikeys_key.gemini.id
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.billing_alerts.id
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
    service_account_email = google_service_account.circuit_breaker.email
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.circuit_breaker_apikeys,
    google_project_iam_member.circuit_breaker_run_invoker,
  ]
}

# ─── Gemini API key (API-restricted) ─────────────────────────────────────────
# Restricted to Generative Language API only. Server-side Cloud Run usage
# doesn't support static IP/referrer restriction, so API-only restriction
# is applied. Circuit breaker empties api_targets at 100% budget to block all calls.

resource "google_apikeys_key" "gemini" {
  name         = "gemini-api-key"
  display_name = "Gemini API Key"
  project      = var.project_id

  restrictions {
    api_targets {
      service = "generativelanguage.googleapis.com"
    }
  }

  depends_on = [google_project_service.apis]
}

# ─── Cloud Monitoring spike alert ────────────────────────────────────────────
# Fires if Gemini request rate exceeds 200 in any 5-minute window.

resource "google_monitoring_alert_policy" "gemini_spike" {
  project      = var.project_id
  display_name = "Gemini API Request Spike"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Gemini requests > 200 in 5 min"
    condition_threshold {
      filter          = join(" AND ", [
        "resource.type=\"consumed_api\"",
        "metric.type=\"serviceruntime.googleapis.com/api/request_count\"",
        "resource.labels.service=\"generativelanguage.googleapis.com\"",
      ])
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 200

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  depends_on            = [google_project_service.apis]
}
