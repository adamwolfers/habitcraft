# -----------------------------------------------------------------------------
# CI/CD Infrastructure - GitHub Actions via Workload Identity Federation
# -----------------------------------------------------------------------------
# This configures secure, keyless authentication for GitHub Actions to deploy
# to GCP. No service account keys are needed - GitHub's OIDC tokens are
# exchanged for short-lived GCP credentials.

# -----------------------------------------------------------------------------
# CI Service Account
# -----------------------------------------------------------------------------

resource "google_service_account" "ci" {
  account_id   = "github-actions-ci"
  display_name = "GitHub Actions CI/CD"
  description  = "Service account for GitHub Actions deployments via Workload Identity Federation"
}

# -----------------------------------------------------------------------------
# Workload Identity Federation
# -----------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions OIDC"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow GitHub Actions to impersonate the CI service account
resource "google_service_account_iam_member" "ci_workload_identity" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# -----------------------------------------------------------------------------
# CI Service Account Permissions
# -----------------------------------------------------------------------------

# Artifact Registry - push container images
resource "google_project_iam_member" "ci_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# Cloud Run - deploy services
resource "google_project_iam_member" "ci_cloud_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# Cloud Run - act as service accounts (needed to deploy services that use other SAs)
resource "google_project_iam_member" "ci_service_account_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# Cloud SQL - create backups before migrations
resource "google_project_iam_member" "ci_cloudsql_admin" {
  project = var.project_id
  role    = "roles/cloudsql.admin"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# -----------------------------------------------------------------------------
# Outputs for GitHub Actions Configuration
# -----------------------------------------------------------------------------

output "ci_service_account_email" {
  description = "Service account email for GitHub Actions (use in GCP_SERVICE_ACCOUNT secret)"
  value       = google_service_account.ci.email
}

output "workload_identity_provider" {
  description = "Workload Identity Provider (use in GCP_WORKLOAD_IDENTITY_PROVIDER secret)"
  value       = google_iam_workload_identity_pool_provider.github.name
}
