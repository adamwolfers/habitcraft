# Plan: Host HabitCraft on Google Cloud Platform

**Status:** Complete (Cutover 2026-01-14 UTC, AWS cleanup completed 2026-01-28)
**Branch:** `master`
**Created:** 2026-01-09 (UTC)
**Last Updated:** 2026-01-28 (UTC)

### Current Deployment

| Resource | URL |
|----------|-----|
| Frontend | https://habitcraft-frontend-iz7ggma5ga-uc.a.run.app |
| Backend | https://habitcraft-backend-iz7ggma5ga-uc.a.run.app |
| Artifact Registry | us-central1-docker.pkg.dev/habitcraft-prod/habitcraft-containers |

## Summary

Deploy HabitCraft to Google Cloud Platform using a serverless-first architecture that minimizes costs for low-traffic while providing seamless scalability. This approach leverages Cloud Run's scale-to-zero capability to keep baseline costs near zero when the app isn't being used.

**Key benefits:**
1. **Pay-per-request pricing** - Cloud Run charges only when handling requests
2. **Automatic scaling** - Handles traffic spikes without manual intervention
3. **Managed infrastructure** - No servers to patch or maintain
4. **Infrastructure as Code** - Terraform for reproducible deployments
5. **Simple operations** - Fewer moving parts than EC2/VM-based architecture

**Estimated monthly cost:** ~$12-22/mo (low traffic) vs ~$27/mo current AWS Lightsail

---

## Architecture Overview

### Current State (AWS Lightsail)

```
Users (HTTPS)
    |
    +-> www.habitcraft.org (CNAME) -> Lightsail Frontend Container ($7/mo)
    |
    +-> api.habitcraft.org (CNAME) -> Lightsail Backend Container ($7/mo)
                                              |
                                              v
                                      RDS PostgreSQL ($13/mo)
```

### Target State (GCP Cloud Run)

```
Users (HTTPS)
    |
    +-> www.habitcraft.org -> Cloud Run (Frontend) [with domain mapping]
    |
    +-> api.habitcraft.org -> Cloud Run (Backend)  [with domain mapping]
                                    |
                                    v
                             Cloud SQL PostgreSQL
                              (via Auth Proxy)
                                    ^
                                    |
              Cloud Scheduler ------+ [direct invocation for email reminders]
```

### Component Mapping

| Current (AWS)            | Target (GCP)                    | Notes                          |
| ------------------------ | ------------------------------- | ------------------------------ |
| Lightsail Containers     | Cloud Run                       | Serverless, scale-to-zero      |
| RDS PostgreSQL           | Cloud SQL PostgreSQL            | Managed, via Auth Proxy        |
| Lightsail built-in LB    | Cloud Run domain mapping        | Built-in, no separate LB needed |
| Lightsail SSL            | Google-managed SSL certificates | Auto-renewal via domain mapping |
| IONOS DNS                | Cloud DNS (optional)            | Or keep IONOS                  |
| CloudWatch               | Cloud Monitoring + Cloud Trace  | Logging, metrics, tracing      |
| GitHub Actions + AWS CLI | GitHub Actions + gcloud CLI     | CI/CD pipeline                 |
| N/A                      | Artifact Registry               | Container image storage        |
| N/A                      | Cloud Scheduler                 | Direct Cloud Run invocation    |
| N/A                      | Secret Manager                  | Secure secrets storage         |

---

## Technology Choices

| Component          | Choice                          | Rationale                                   |
| ------------------ | ------------------------------- | ------------------------------------------- |
| Compute            | Cloud Run                       | Serverless, scale-to-zero, per-request cost |
| Database           | Cloud SQL PostgreSQL            | Managed, automatic backups, HA options      |
| DB Connectivity    | Cloud SQL Auth Proxy            | No VPC needed, IAM auth, simpler setup      |
| Container Registry | Artifact Registry               | GCP-native, integrated with Cloud Build     |
| Custom Domains     | Cloud Run domain mapping        | Built-in SSL, no separate LB needed         |
| SSL Certificates   | Google-managed certificates     | Free, auto-renewal via domain mapping       |
| Secrets            | Secret Manager                  | Secure, versioned, IAM-controlled           |
| CI/CD              | GitHub Actions + gcloud CLI     | Familiar workflow, minimal changes          |
| Scheduled Jobs     | Cloud Scheduler                 | Direct Cloud Run invocation, simple         |
| Monitoring         | Cloud Monitoring + Cloud Logging| Built-in, free tier generous                |
| IaC                | Terraform                       | Same tooling as AWS plan                    |
| DNS                | Cloud DNS (optional)            | Or keep IONOS with CNAMEs                   |

### Why Cloud Run over Compute Engine (VMs)?

| Factor         | Cloud Run                      | Compute Engine             |
| -------------- | ------------------------------ | -------------------------- |
| Scaling        | Automatic, instant, to zero    | Manual or Managed Instance Groups |
| Cost at idle   | $0 (scale to zero)             | ~$10-25/mo minimum         |
| Operations     | Zero server management         | Patching, updates, SSH     |
| Cold starts    | ~500ms-2s (mitigated with min instances) | None                |
| Complexity     | Low                            | Medium                     |
| Customization  | Limited (container only)       | Full OS access             |

**Recommendation:** Cloud Run is ideal for this low-traffic app with occasional usage spikes.

---

## Part 1: GCP Project Setup

### Step 1: Create GCP Project and Enable APIs

```bash
# Create project
gcloud projects create habitcraft-prod --name="HabitCraft Production"

# Set as default
gcloud config set project habitcraft-prod

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com
```

- [x] Create GCP project
- [x] Enable required APIs
- [x] Set up billing account

### Step 2: Create Service Accounts

```bash
# CI/CD service account (for GitHub Actions)
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# Backend service account (for Cloud Run)
gcloud iam service-accounts create backend-service \
  --display-name="Backend Cloud Run Service"

# Grant permissions
gcloud projects add-iam-policy-binding habitcraft-prod \
  --member="serviceAccount:github-actions@habitcraft-prod.iam.gserviceaccount.com" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding habitcraft-prod \
  --member="serviceAccount:github-actions@habitcraft-prod.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding habitcraft-prod \
  --member="serviceAccount:backend-service@habitcraft-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding habitcraft-prod \
  --member="serviceAccount:backend-service@habitcraft-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

- [x] Create CI/CD service account
- [x] Create Cloud Run service accounts
- [x] Configure IAM permissions

---

## Part 2: Terraform Project Structure

### Directory Layout

We use a flat structure initially for simplicity. Extract modules only when adding environments or when files exceed ~500 lines.

```
infrastructure/
├── terraform/
│   └── gcp/
│       └── prod/
│           ├── main.tf           # All resources (Cloud Run, Cloud SQL, etc.)
│           ├── variables.tf      # Input variables
│           ├── outputs.tf        # Output values
│           ├── terraform.tfvars  # Variable values (not committed)
│           └── backend.tf        # GCS state configuration
```

**Note on dev environment:** For local development, use Docker Compose to avoid doubling cloud costs. A separate GCP dev environment can be added later by duplicating the `prod/` directory if full cloud parity is needed for testing.

### Step 1: Terraform State Backend (GCS)

**File:** `infrastructure/terraform/gcp/prod/backend.tf`

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Create GCS bucket for Terraform state
resource "google_storage_bucket" "terraform_state" {
  name          = "habitcraft-terraform-state"
  location      = "US"
  force_destroy = false

  versioning {
    enabled = true
  }

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }
}
```

- [x] Create GCS bucket for Terraform state
- [x] Enable versioning on state bucket

---

## Part 3: Artifact Registry

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "${var.project}-containers"
  description   = "Docker repository for HabitCraft"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }
}

output "repository_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
```

- [x] Create Artifact Registry repository
- [x] Configure cleanup policies

---

## Part 4: Secret Manager

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"

  replication {
    auto {}
  }
}

# Grant Cloud Run service account access to secrets
resource "google_secret_manager_secret_iam_member" "backend_jwt" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.backend_service_account}"
}

resource "google_secret_manager_secret_iam_member" "backend_db" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.backend_service_account}"
}
```

- [x] Create secrets in Secret Manager
- [x] Grant Cloud Run access to secrets

---

## Part 5: Cloud SQL PostgreSQL

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
resource "google_sql_database_instance" "main" {
  name             = "${var.project}-db"
  database_version = "POSTGRES_14"
  region           = var.region

  settings {
    tier              = "db-f1-micro"  # Smallest instance, ~$9/mo
    availability_type = "ZONAL"        # Single zone for cost savings
    disk_size         = 10             # 10GB minimum
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    # Use Cloud SQL Auth Proxy - no VPC needed, simpler setup
    ip_configuration {
      ipv4_enabled = true
      require_ssl  = true
    }

    maintenance_window {
      day  = 7  # Sunday
      hour = 3  # 3 AM
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "habitcraft" {
  name     = "habitcraft"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "habitcraft"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
```

### Why Cloud SQL Auth Proxy?

We use the Auth Proxy approach (built into Cloud Run) rather than Private IP + VPC:

- **No VPC required** - Saves ~$7/mo on Serverless VPC Access connector
- **Simpler setup** - No VPC, subnets, or firewall rules to manage
- **IAM authentication** - Uses service account identity, no password in connection string
- **Encrypted connection** - TLS by default
- **Works out of the box** - Cloud Run has native support via volume mounts

- [x] Create Cloud SQL PostgreSQL instance
- [x] Create database and user

---

## Part 6: Cloud Run Services

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
# Backend API Service
resource "google_cloud_run_v2_service" "backend" {
  name     = "${var.project}-backend"
  location = var.region

  template {
    service_account = var.backend_service_account

    scaling {
      min_instance_count = 0   # Scale to zero
      max_instance_count = 10  # Max scaling
    }

    containers {
      image = "${var.artifact_registry_url}/backend:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true  # CPU only allocated during requests (cost savings)
      }

      # Environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "DB_HOST"
        value = "/cloudsql/${var.cloud_sql_connection_name}"
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_NAME"
        value = "habitcraft"
      }
      env {
        name  = "DB_USER"
        value = "habitcraft"
      }
      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url
      }

      # Secrets from Secret Manager
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = "db-password"
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "jwt-secret"
            version = "latest"
          }
        }
      }

      # Cloud SQL connection
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloud_sql_connection_name]
      }
    }

    # Request timeout
    timeout = "60s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "${var.project}-frontend"
  location = var.region

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "${var.artifact_registry_url}/frontend:latest"

      ports {
        container_port = 3100
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      startup_probe {
        http_get {
          path = "/"
          port = 3100
        }
        initial_delay_seconds = 5
        period_seconds        = 10
      }
    }

    timeout = "30s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow unauthenticated access (public API)
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}
```

### Cold Start Strategy

**Initial approach:** Start with `min_instance_count = 0` (scale to zero) and monitor.

Cold starts typically add ~500ms-2s latency. For a habit tracker where users check at predictable times (morning/evening), occasional cold starts are acceptable.

**When to add minimum instances:**

Monitor Cloud Run latency metrics in Cloud Monitoring. If p99 latency is consistently >2s and users report sluggishness, add minimum instances:

```hcl
scaling {
  min_instance_count = 1   # Always keep 1 instance warm (~$15/mo per service)
  max_instance_count = 10
}
```

**Cost tradeoff:** Each always-on instance adds ~$15/mo. Only add if cold starts become a real UX problem.

### Custom Domain Mapping

Instead of a load balancer, use Cloud Run's built-in domain mapping:

```bash
# Verify domain ownership first (opens browser)
gcloud domains verify habitcraft.org

# Map custom domains (requires beta command for fully managed Cloud Run)
gcloud beta run domain-mappings create --service=habitcraft-backend \
  --domain=api.habitcraft.org --region=us-central1

gcloud beta run domain-mappings create --service=habitcraft-frontend \
  --domain=www.habitcraft.org --region=us-central1

# Also map apex domain to frontend
gcloud beta run domain-mappings create --service=habitcraft-frontend \
  --domain=habitcraft.org --region=us-central1

# Check mapping status
gcloud beta run domain-mappings list --region=us-central1
```

This provides:
- Free Google-managed SSL certificates (auto-renewed)
- No load balancer cost (~$3+/mo saved)
- Simpler setup than External Application Load Balancer

**DNS Configuration:** After mapping, update IONOS DNS with the CNAME records shown in `gcloud run domain-mappings describe`.

**When to add a Load Balancer later:** Only add an External Application Load Balancer if you need:
- Cloud CDN for global caching
- Cloud Armor for WAF/DDoS protection
- Multi-region deployment with global load balancing

- [x] Create backend Cloud Run service
- [x] Create frontend Cloud Run service
- [x] Configure Cloud SQL connectivity
- [x] Set up secrets access
- [x] Configure public access (allUsers invoker)
- [x] Set up custom domain mappings
- [x] Update DNS records

---

## Part 7: Scheduled Email Reminders

Cloud Scheduler invokes Cloud Run directly - no Cloud Tasks needed for simple scheduled jobs.

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
# Service account for scheduler
resource "google_service_account" "scheduler" {
  account_id   = "scheduler-service"
  display_name = "Cloud Scheduler Service"
}

# Grant scheduler permission to invoke Cloud Run
resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

# Cloud Scheduler job to trigger reminder processing
resource "google_cloud_scheduler_job" "process_reminders" {
  name        = "process-reminders"
  description = "Trigger reminder processing every 5 minutes"
  schedule    = "*/5 * * * *"  # Every 5 minutes
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend.uri}/api/v1/internal/process-reminders"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = google_cloud_run_v2_service.backend.uri
    }
  }

  retry_config {
    retry_count = 3
  }
}
```

**Why no Cloud Tasks?**

Cloud Tasks is useful for fan-out workloads (distributing work to many workers) or delayed task execution. For a simple "run every 5 minutes" job, Cloud Scheduler can invoke Cloud Run directly, which is simpler and has fewer moving parts.

- [x] Create scheduler service account
- [x] Grant invoker permissions
- [x] Create Cloud Scheduler job

---

## Part 8: CI/CD with GitHub Actions

**File:** `.github/workflows/deploy-gcp.yml`

```yaml
name: Deploy to GCP

on:
  push:
    branches: [master]
  workflow_dispatch:

env:
  PROJECT_ID: habitcraft-prod
  REGION: us-central1
  BACKEND_SERVICE: habitcraft-backend
  FRONTEND_SERVICE: habitcraft-frontend
  ARTIFACT_REGISTRY: us-central1-docker.pkg.dev/habitcraft-prod/habitcraft-containers

jobs:
  test:
    # ... existing test jobs ...

  deploy-backend:
    needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Copy schema for migrations
        run: cp shared/database/schema.sql backend/

      - name: Build and push backend image
        run: |
          cd backend
          docker build -t ${{ env.ARTIFACT_REGISTRY }}/backend:${{ github.sha }} .
          docker tag ${{ env.ARTIFACT_REGISTRY }}/backend:${{ github.sha }} ${{ env.ARTIFACT_REGISTRY }}/backend:latest
          docker push ${{ env.ARTIFACT_REGISTRY }}/backend:${{ github.sha }}
          docker push ${{ env.ARTIFACT_REGISTRY }}/backend:latest

      - name: Run database migrations
        run: |
          # Run migrations using Cloud Run Jobs (one-time execution)
          gcloud run jobs execute habitcraft-migrations \
            --region ${{ env.REGION }} \
            --wait

      - name: Deploy to Cloud Run
        id: deploy-backend
        run: |
          gcloud run deploy ${{ env.BACKEND_SERVICE }} \
            --image ${{ env.ARTIFACT_REGISTRY }}/backend:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed

      - name: Verify backend health
        run: |
          BACKEND_URL=$(gcloud run services describe ${{ env.BACKEND_SERVICE }} \
            --region ${{ env.REGION }} --format='value(status.url)')
          # Wait for health check to pass
          for i in {1..10}; do
            if curl -sf "${BACKEND_URL}/health" > /dev/null; then
              echo "Backend is healthy"
              exit 0
            fi
            echo "Waiting for backend... (attempt $i/10)"
            sleep 5
          done
          echo "Backend health check failed"
          exit 1

  deploy-frontend:
    needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and push frontend image
        run: |
          cd frontend
          docker build \
            --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.habitcraft.org \
            -t ${{ env.ARTIFACT_REGISTRY }}/frontend:${{ github.sha }} .
          docker tag ${{ env.ARTIFACT_REGISTRY }}/frontend:${{ github.sha }} ${{ env.ARTIFACT_REGISTRY }}/frontend:latest
          docker push ${{ env.ARTIFACT_REGISTRY }}/frontend:${{ github.sha }}
          docker push ${{ env.ARTIFACT_REGISTRY }}/frontend:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.FRONTEND_SERVICE }} \
            --image ${{ env.ARTIFACT_REGISTRY }}/frontend:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed
```

### Workload Identity Federation (Recommended)

Set up keyless authentication from GitHub Actions:

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Grant access
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions@habitcraft-prod.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_ORG/habitcraft"
```

- [x] Set up Workload Identity Federation
- [x] Create GitHub Actions workflow
- [x] Configure GitHub secrets

### Rollback Procedure

Cloud Run keeps previous revisions, making rollback straightforward:

```bash
# List recent revisions
gcloud run revisions list --service=habitcraft-backend --region=us-central1

# Rollback to a specific revision
gcloud run services update-traffic habitcraft-backend \
  --region=us-central1 \
  --to-revisions=habitcraft-backend-00005-abc=100

# Or rollback to the previous revision
gcloud run services update-traffic habitcraft-backend \
  --region=us-central1 \
  --to-revisions=PREVIOUS_REVISION_NAME=100
```

**Important:** Database migrations are not automatically rolled back. If a migration causes issues:
1. Rollback the Cloud Run service to the previous revision
2. Manually revert the database migration if needed
3. Fix the issue and redeploy

---

## Part 9: Monitoring and Alerting

Add to `infrastructure/terraform/gcp/prod/main.tf`:

```hcl
# Notification channel (email)
resource "google_monitoring_notification_channel" "email" {
  display_name = "HabitCraft Alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# Alert: High error rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run 5xx errors"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  alert_strategy {
    auto_close = "604800s"  # 7 days
  }
}

# Alert: High latency
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "High Latency"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Run p99 latency > 2s"

    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2000  # 2 seconds

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Alert: Cloud SQL high CPU
resource "google_monitoring_alert_policy" "db_high_cpu" {
  display_name = "Database High CPU"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL CPU > 80%"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Alert: Cloud SQL disk usage
resource "google_monitoring_alert_policy" "db_disk_usage" {
  display_name = "Database Disk Usage High"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL disk > 80%"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/disk/utilization\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Uptime check
resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "API Health Check"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = "443"
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "api.habitcraft.org"
    }
  }
}
```

- [x] Create notification channels
- [x] Set up error rate alerting
- [x] Set up latency alerting
- [x] Set up Cloud SQL CPU and disk alerts
- [x] Configure uptime checks

---

## Migration Strategy

### Phase 1: Prepare (No Downtime) ✅

1. [x] Create GCP project and enable APIs
2. [x] Set up Terraform state backend (GCS)
3. [x] Create Artifact Registry repository
4. [x] Set up Secret Manager with secrets
5. [x] Create service accounts with IAM permissions

### Phase 2: Database Migration 🔄

**Approach:** Maintenance Window (~30 min downtime)

**Prerequisites:**
- [x] Create Cloud SQL instance
- [x] Set up bastion host for RDS access (see below)
- [x] Clean up test data from GCP database (replaced with production data during trial)
- [x] Run trial migration to validate process and timing
- [x] Store RDS password in AWS Secrets Manager (see Secure Credential Handling below)

#### Secure Credential Handling

**⚠️ Never put passwords directly in commands** - they will be stored in shell history.

**Solution:** Retrieve passwords from Secrets Manager at runtime into environment variables.

**One-time setup: Store RDS password in AWS Secrets Manager**

```bash
# Store the RDS password (only need to do this once)
aws secretsmanager create-secret \
  --name habitcraft/rds-password \
  --description "HabitCraft RDS database password" \
  --secret-string "<your-rds-password>" \
  --region us-west-2
```

**At migration time: Load passwords into environment variables**

```bash
# Load RDS password from AWS Secrets Manager
export RDS_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id habitcraft/rds-password \
  --query 'SecretString' --output text \
  --region us-west-2)

# Load Cloud SQL password from GCP Secret Manager
export GCP_PASSWORD=$(gcloud secrets versions access latest \
  --secret=db-password \
  --project=habitcraft-prod)

# Verify (shows only first/last chars)
echo "RDS_PASSWORD: ${RDS_PASSWORD:0:3}...${RDS_PASSWORD: -3}"
echo "GCP_PASSWORD: ${GCP_PASSWORD:0:3}...${GCP_PASSWORD: -3}"
```

Now use `$RDS_PASSWORD` and `$GCP_PASSWORD` in commands instead of literal passwords.

**Security notes:**
- Environment variables are not saved to shell history
- Close terminal after migration to clear env vars from memory
- AWS Secrets Manager access is logged in CloudTrail for auditing

#### Database Access via Bastion Host

RDS is not publicly accessible (for security). To run `pg_dump` for the migration, use an EC2 bastion host in the same VPC.

**One-time setup (~10 min):**

```bash
# 1. Get the VPC and subnet info from RDS
aws rds describe-db-instances --db-instance-identifier habitcraft-db \
  --query 'DBInstances[0].DBSubnetGroup.Subnets[0].{SubnetId:SubnetIdentifier,VpcId:SubnetAvailabilityZone}' \
  --region us-west-2

# 2. Create a key pair for SSH access
aws ec2 create-key-pair --key-name habitcraft-bastion \
  --query 'KeyMaterial' --output text --region us-west-2 > ~/.ssh/habitcraft-bastion.pem
chmod 400 ~/.ssh/habitcraft-bastion.pem

# 3. Create security group for bastion (SSH from your IP only)
BASTION_SG=$(aws ec2 create-security-group \
  --group-name habitcraft-bastion-sg \
  --description "Bastion host for DB access" \
  --vpc-id <vpc-id> \
  --region us-west-2 \
  --query 'GroupId' --output text)

# 4. Allow SSH from your IP
MY_IP=$(curl -s ifconfig.me)
aws ec2 authorize-security-group-ingress \
  --group-id $BASTION_SG \
  --protocol tcp --port 22 \
  --cidr ${MY_IP}/32 \
  --region us-west-2

# 5. Allow bastion to connect to RDS (add to RDS security group)
aws ec2 authorize-security-group-ingress \
  --group-id sg-012c04e0fae1b10de \
  --protocol tcp --port 5432 \
  --source-group $BASTION_SG \
  --region us-west-2

# 6. Launch bastion instance (Amazon Linux 2023, t3.micro = free tier eligible)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.micro \
  --key-name habitcraft-bastion \
  --security-group-ids $BASTION_SG \
  --subnet-id <subnet-id> \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=habitcraft-bastion}]' \
  --region us-west-2

# 7. Wait for instance to be running, then get public IP
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=habitcraft-bastion" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text --region us-west-2
```

**Using the bastion for database operations:**

```bash
# SSH tunnel: forward local port 5433 to RDS port 5432
ssh -i ~/.ssh/habitcraft-bastion.pem \
  -L 5433:habitcraft-db.cb40wqc283y5.us-west-2.rds.amazonaws.com:5432 \
  -N ec2-user@<bastion-public-ip> &

# Now connect to RDS via localhost:5433
PGPASSWORD='<password>' psql -h localhost -p 5433 -U habituser -d habitcraft

# Export data via the tunnel
PGPASSWORD='<password>' pg_dump -h localhost -p 5433 -U habituser -d habitcraft \
  -F c -f habitcraft_backup.dump
```

**Cleanup after migration:**

```bash
# Terminate bastion instance
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=habitcraft-bastion" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text --region us-west-2)
aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region us-west-2

# Delete security group (after instance terminates)
aws ec2 delete-security-group --group-id $BASTION_SG --region us-west-2

# Remove bastion access from RDS security group
aws ec2 revoke-security-group-ingress \
  --group-id sg-012c04e0fae1b10de \
  --protocol tcp --port 5432 \
  --source-group $BASTION_SG \
  --region us-west-2

# Delete key pair
aws ec2 delete-key-pair --key-name habitcraft-bastion --region us-west-2
rm ~/.ssh/habitcraft-bastion.pem
```

#### Cloud SQL Access via Auth Proxy

Cloud SQL is not publicly accessible (for security). Use the Cloud SQL Auth Proxy for secure local access.

**Why Auth Proxy instead of Authorized Networks?**

| Approach | Security | Setup |
|----------|----------|-------|
| **Auth Proxy** (recommended) | No network exposure, uses IAM auth, auto-encrypted | Install proxy, run locally |
| **Authorized Networks** | Opens DB to your IP, same risks as public RDS | Quick but risky |

**One-time setup (~5 min):**

```bash
# 1. Install Cloud SQL Auth Proxy (macOS)
brew install cloud-sql-proxy

# Or download directly:
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/

# 2. Ensure you're authenticated with gcloud
gcloud auth application-default login
```

**Using the Auth Proxy for database operations:**

```bash
# Start proxy in background (local port 5434 -> Cloud SQL)
cloud-sql-proxy --port 5434 habitcraft-prod:us-central1:habitcraft-db &

# Now connect to Cloud SQL via localhost:5434
PGPASSWORD='<password>' psql -h localhost -p 5434 -U habitcraft -d habitcraft
```

**Get Cloud SQL password from Secret Manager:**

```bash
gcloud secrets versions access latest --secret=db-password --project=habitcraft-prod
```

#### Data Migration Approach

**⚠️ Important: `pg_restore --disable-triggers` does not work on Cloud SQL**

Cloud SQL is a managed service that restricts superuser privileges. The `--disable-triggers` flag fails with "permission denied: system trigger" errors, causing foreign key constraint violations when tables are restored in the wrong order.

**Solution: Export/import tables using COPY in foreign key order**

Tables must be imported in this order to satisfy foreign key constraints:
1. `users` (no dependencies)
2. `habits` (depends on users)
3. `completions` (depends on habits)
4. `refresh_tokens` (depends on users)

**Export from RDS (via bastion tunnel on port 5433):**

```bash
# Export each table as CSV (uses $RDS_PASSWORD from Secrets Manager)
PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
  -c "COPY users TO STDOUT WITH CSV HEADER" > tmp/users.csv

PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
  -c "COPY habits TO STDOUT WITH CSV HEADER" > tmp/habits.csv

PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
  -c "COPY completions TO STDOUT WITH CSV HEADER" > tmp/completions.csv

PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
  -c "COPY refresh_tokens TO STDOUT WITH CSV HEADER" > tmp/refresh_tokens.csv
```

**Import to Cloud SQL (via Auth Proxy on port 5434):**

```bash
# Truncate existing data first (uses $GCP_PASSWORD from Secret Manager)
PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
  -c "TRUNCATE users, habits, completions, refresh_tokens CASCADE;"

# Import in foreign key order
PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
  -c "COPY users FROM STDIN WITH CSV HEADER" < tmp/users.csv

PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
  -c "COPY habits FROM STDIN WITH CSV HEADER" < tmp/habits.csv

PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
  -c "COPY completions FROM STDIN WITH CSV HEADER" < tmp/completions.csv

PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
  -c "COPY refresh_tokens FROM STDIN WITH CSV HEADER" < tmp/refresh_tokens.csv
```

#### Trial Migration (before maintenance window)

Run a trial migration to validate the process and measure timing:

1. [x] Set up bastion host for RDS access (one-time)
2. [x] Install Cloud SQL Auth Proxy (one-time)
3. [x] Start SSH tunnel to RDS (port 5433)
4. [x] Start Cloud SQL Auth Proxy (port 5434)
5. [x] Export tables from RDS as CSV (in order)
6. [x] Record export time: **6 seconds** (31KB total)
7. [x] Truncate Cloud SQL tables
8. [x] Import tables to Cloud SQL (in foreign key order)
9. [x] Record import time: **4 seconds**
10. [x] Verify row counts match between RDS and Cloud SQL
11. [x] Test API calls against GCP backend
12. [x] Document total time: **~10 seconds** (data transfer only)

**Trial Migration Results (2026-01-12):**

| Metric | Value |
|--------|-------|
| Export time | 6 seconds |
| Import time | 4 seconds |
| Data size | 31KB (4 CSV files) |
| Users migrated | 8 |
| Habits migrated | 24 |
| Completions migrated | 133 |
| Refresh tokens migrated | 100 |

**Notes:**
- CSV export/import approach works around Cloud SQL's superuser restrictions
- Tables must be imported in foreign key order: users → habits → completions, refresh_tokens
- GCP backend successfully queries migrated data (verified via health check and login endpoint)
- Bastion host IP: `34.219.2.26` (instance: `i-015cb43f2f75f8ee9`)

**Connection Details:**

| Database | Host | Port | User | Database | Access Method |
|----------|------|------|------|----------|---------------|
| RDS | `localhost` | `5433` | `habituser` | `habitcraft` | SSH tunnel via bastion |
| Cloud SQL | `localhost` | `5434` | `habitcraft` | `habitcraft` | Cloud SQL Auth Proxy |

**Scheduled Maintenance Window:** Jan 13, 2026 10:00-11:59pm UTC

**1. Preparation (before maintenance window)**
- [x] Announce scheduled maintenance to users (PostHog banner enabled 2026-01-13)
- [x] Lower apex domain TTL to 300s at IONOS (1-2h before cutover)
- [ ] Prepare rollback plan (see Rollback Plan section below)

**2. During maintenance window**

- [x] Put AWS backend in maintenance mode (return 503 to all requests)
- [x] Wait 1-2 minutes for in-flight requests to complete
- [x] Start SSH tunnel to RDS (via bastion at `34.219.2.26`):
  ```bash
  ssh -i ~/.ssh/habitcraft-bastion.pem \
    -L 5433:habitcraft-db.cb40wqc283y5.us-west-2.rds.amazonaws.com:5432 \
    -N -f ec2-user@34.219.2.26
  ```
- [x] Start Cloud SQL Auth Proxy:
  ```bash
  cloud-sql-proxy --port 5434 habitcraft-prod:us-central1:habitcraft-db &
  ```
- [x] Load credentials from Secrets Manager (see Secure Credential Handling above):
  ```bash
  export RDS_PASSWORD=$(aws secretsmanager get-secret-value \
    --secret-id habitcraft/rds-password --query 'SecretString' --output text --region us-west-2)
  export GCP_PASSWORD=$(gcloud secrets versions access latest \
    --secret=db-password --project=habitcraft-prod)
  ```
- [x] Export data from RDS as CSV (via tunnel on port 5433):
  ```bash
  PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
    -c "COPY users TO STDOUT WITH CSV HEADER" > tmp/users.csv
  PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
    -c "COPY habits TO STDOUT WITH CSV HEADER" > tmp/habits.csv
  PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
    -c "COPY completions TO STDOUT WITH CSV HEADER" > tmp/completions.csv
  PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
    -c "COPY refresh_tokens TO STDOUT WITH CSV HEADER" > tmp/refresh_tokens.csv
  ```
- [x] Truncate Cloud SQL tables (via Auth Proxy on port 5434):
  ```bash
  PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
    -c "TRUNCATE users, habits, completions, refresh_tokens CASCADE;"
  ```
- [x] Import to Cloud SQL in foreign key order:
  ```bash
  PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
    -c "COPY users FROM STDIN WITH CSV HEADER" < tmp/users.csv
  PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
    -c "COPY habits FROM STDIN WITH CSV HEADER" < tmp/habits.csv
  PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
    -c "COPY completions FROM STDIN WITH CSV HEADER" < tmp/completions.csv
  PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
    -c "COPY refresh_tokens FROM STDIN WITH CSV HEADER" < tmp/refresh_tokens.csv
  ```

**3. Data Verification (before DNS cutover)**

Verify migrated data via direct database queries (tunnels still open):

- [x] Compare row counts per table (run on both ports 5433 and 5434):
  ```sql
  SELECT 'users' as table_name, COUNT(*) FROM users
  UNION ALL SELECT 'habits', COUNT(*) FROM habits
  UNION ALL SELECT 'completions', COUNT(*) FROM completions
  UNION ALL SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
  ORDER BY table_name;
  ```
- [x] Verify row counts match between RDS (port 5433) and Cloud SQL (port 5434)
- [x] Actual counts at cutover: users=8, habits=24, completions=137, refresh_tokens=105

**4. DNS Cutover**
- [x] Lower apex domain TTL to 300s at IONOS (1-2 hours before cutover)
- [x] Update DNS records at IONOS to point to GCP (see DNS Records table below)
- [x] Verify DNS propagation: `dig +short api.habitcraft.org`
- [x] Wait for SSL certificate provisioning (~15-30 min)
- [x] Verify site loads via custom domains

**5. Post-Cutover Verification**
- [x] Verify GCP backend is receiving traffic (check Cloud Logging)
- [x] Run E2E smoke tests: `npx playwright test --config=playwright.gcp.config.ts`
  - Note: Some tests fail due to registration rate limits from repeated test runs
  - See `docs/plans/up-next/smoke-test-cleanup.md` for test user cleanup plan
- [x] Monitor for errors in Cloud Logging
  - Found: `trust proxy` not enabled, causing rate limiter warnings
  - Fixed: Added `app.set('trust proxy', true)` in commit 82f7345
- [x] End maintenance window
- [x] Notify users maintenance is complete (disabled PostHog banner)

### Phase 3: Deploy Application ✅

1. [x] Push Docker images to Artifact Registry
2. [x] Deploy Cloud Run services
3. [x] Test with Cloud Run URLs directly
4. [x] Verify database connectivity
5. [x] Run E2E tests against GCP environment

### Phase 4: Domain Mapping and DNS ✅

1. [x] Create Cloud Run domain mappings for all services (2026-01-12 UTC)
2. [x] Verify domain ownership with Google Search Console
3. [x] Lower apex domain TTL to 300s (1-2 hours before cutover - see note below)
4. [x] Update DNS records at IONOS (see DNS Records below)
5. [x] Wait for SSL certificate provisioning (~15-30 min after DNS update)

**Note on TTL:** The `api` and `www` subdomains already have 300s TTL. Only the apex domain (`habitcraft.org`) has 3600s TTL and needs lowering. Do this 1-2 hours before cutover to avoid breaking the apex domain's IONOS redirect service prematurely.

**DNS Records to Configure at IONOS:**

| Domain | Record Type | Value |
|--------|-------------|-------|
| `api.habitcraft.org` | CNAME | `ghs.googlehosted.com.` |
| `www.habitcraft.org` | CNAME | `ghs.googlehosted.com.` |
| `habitcraft.org` (apex) | A | `216.239.32.21` |
| `habitcraft.org` (apex) | A | `216.239.34.21` |
| `habitcraft.org` (apex) | A | `216.239.36.21` |
| `habitcraft.org` (apex) | A | `216.239.38.21` |

**Note:** Apex domain requires A records (CNAME not allowed at root). SSL certificates will provision automatically after DNS propagation.

### Phase 5: Cleanup 🔄

1. [x] Verify GCP services healthy (2026-01-15 UTC)
   - Cloud Run backend/frontend: Ready, 200-300ms response times
   - Cloud SQL: RUNNABLE, automated backups enabled (daily, 7-day retention)
   - No errors in Cloud Logging
2. [x] Delete Lightsail container services (2026-01-15 UTC)
   - Deleted habitcraft-backend and habitcraft-frontend
3. [x] Remove AWS deployment from CI pipeline (2026-01-15 UTC)
   - CI now only deploys to GCP Cloud Run
4. [x] Delete RDS instance (2026-01-28, final snapshot: habitcraft-db-final-2026-01-28)
5. [x] Terminate bastion host and cleanup AWS resources (2026-01-28)
   ```bash
   # Terminate bastion instance
   aws ec2 terminate-instances --instance-ids i-015cb43f2f75f8ee9 --region us-west-2

   # Wait for termination, then delete security group
   aws ec2 delete-security-group --group-id sg-0c00ab3f9774369d1 --region us-west-2

   # Remove bastion access from RDS security group
   aws ec2 revoke-security-group-ingress \
     --group-id sg-012c04e0fae1b10de \
     --protocol tcp --port 5432 \
     --source-group sg-0c00ab3f9774369d1 \
     --region us-west-2

   # Delete key pair
   aws ec2 delete-key-pair --key-name habitcraft-bastion --region us-west-2
   rm ~/.ssh/habitcraft-bastion.pem
   ```
6. [x] Delete local tmp/ folder with CSV exports
7. [x] Update documentation (2026-01-28) - Created GCP_ARCHITECTURE.md, archived AWS doc

### Phase 6: Smoke Test Cleanup ✅

The GCP smoke tests create orphan test users that accumulate in production and cause rate limit failures.

**Problem:**
- Tests create `gcp-smoke-{timestamp}@example.com` users each run
- Users are NOT deleted afterward
- Login rate limit (5/15min) is hit after multiple test runs

**Solution:** Implemented in two phases:

#### Phase 6a: DELETE Endpoint (2026-01-15)

**Backend Changes:**
1. [x] Add `DELETE /api/v1/users/me` endpoint
   - Requires authentication and password confirmation
   - Deletes user's completions, habits, refresh_tokens, then user
   - Uses transaction for atomicity
   - Add `ACCOUNT_DELETED` security event
   - Rate limited (5 attempts per 15 minutes)
2. [x] Add tests for the new endpoint

**Files Modified:**
- `backend/routes/users.js` - Add DELETE endpoint
- `backend/routes/users.test.js` - Add tests
- `backend/utils/securityLogger.js` - Add ACCOUNT_DELETED event
- `backend/middleware/rateLimiter.js` - Add accountDeleteLimiter

#### Phase 6b: Playwright Setup Project Pattern (2026-01-16)

Refactored tests to use Playwright's recommended setup project pattern, which:
- Runs setup once before all tests (creates user, saves auth state)
- Uses stored auth state for authenticated tests (no repeated logins)
- Runs teardown after all tests (deletes user via API)
- Reduces login attempts from ~8 to ~2 per test run

**Architecture:**
```
[setup] → create user, save auth state
    ↓
[chromium] → run tests with stored auth state
    ↓
[teardown] → delete user via API
```

**E2E Changes:**
1. [x] Create `gcp-auth.setup.ts` - Creates test user and saves auth state
2. [x] Create `gcp-auth.teardown.ts` - Deletes test user with JWT auth
3. [x] Update `playwright.gcp.config.ts` - Setup/teardown project pattern
4. [x] Refactor `gcp-smoke.spec.ts`:
   - Unauthenticated tests use `storageState: { cookies: [], origins: [] }`
   - Authenticated tests use stored auth state from setup
   - Fixed habit card selectors (use heading + xpath instead of article)
   - Combined login/logout into single test to reduce login attempts
5. [x] Add `.auth/` to `.gitignore`

**Files Created:**
- `frontend/e2e/gcp-auth.setup.ts`
- `frontend/e2e/gcp-auth.teardown.ts`

**Files Modified:**
- `frontend/playwright.gcp.config.ts`
- `frontend/playwright.config.ts` (exclude new files)
- `frontend/e2e/gcp-smoke.spec.ts`
- `.gitignore`

**Rate Limiting Note:**
The backend has rate limiting on login endpoints (5 attempts per 15 minutes).
These tests are designed for running once per deployment, not repeatedly.
If you hit rate limits during development, wait 15 minutes before retrying.

---

## Cost Estimate

### Low Traffic Scenario (~1000 requests/day)

| Component               | Monthly Cost | Notes                              |
| ----------------------- | ------------ | ---------------------------------- |
| Cloud Run (Backend)     | ~$0-5        | Scale to zero, pay per request     |
| Cloud Run (Frontend)    | ~$0-5        | Scale to zero, pay per request     |
| Cloud SQL (db-f1-micro) | ~$9          | Smallest instance                  |
| Cloud SQL backups       | ~$1          | ~$0.08/GB/mo for PITR backups      |
| Artifact Registry       | ~$0.50       | Storage for container images       |
| Network egress          | ~$1-2        | Outbound traffic                   |
| Secret Manager          | ~$0.10       | 6 secret versions, 10K accesses    |
| Cloud Monitoring        | $0           | Free tier covers basic monitoring  |
| **Total**               | **~$12-22**  |                                    |

### Medium Traffic Scenario (~10,000 requests/day)

| Component               | Monthly Cost | Notes                              |
| ----------------------- | ------------ | ---------------------------------- |
| Cloud Run (Backend)     | ~$10-15      | Moderate request volume            |
| Cloud Run (Frontend)    | ~$5-10       | Static assets cached by browser    |
| Cloud SQL (db-f1-micro) | ~$9          | May need db-g1-small (~$25) later  |
| Cloud SQL backups       | ~$1-2        | Grows with data size               |
| Network egress          | ~$3-5        | More outbound traffic              |
| **Total**               | **~$28-42**  |                                    |

### If Cold Starts Become an Issue

Add minimum instances to keep services warm:

| Additional Cost         | Monthly Cost | Notes                              |
| ----------------------- | ------------ | ---------------------------------- |
| Backend min instance    | ~$15         | 1 always-on instance               |
| Frontend min instance   | ~$15         | 1 always-on instance               |

### Cost Optimization Options

1. **Committed Use Discounts**: 1-year commit for Cloud SQL saves ~25%
2. **Cloud SQL Maintenance**: Stop database during known idle periods (dev only)
3. **Regional vs Multi-region**: Stay single-region for cost savings
4. **CPU Allocation**: Use `cpu_idle = true` for bursty workloads (already enabled)

---

## Comparison with AWS Options

| Factor                  | GCP Cloud Run | AWS Lightsail (Current) | AWS EC2 (Planned) |
| ----------------------- | ------------- | ----------------------- | ----------------- |
| Monthly cost (low traffic) | ~$12-22    | ~$27                    | ~$53              |
| Scale to zero           | Yes           | No                      | No                |
| Cold starts             | ~500ms-2s     | None                    | None              |
| Server management       | None          | Minimal                 | Full              |
| Auto-scaling            | Automatic     | Manual                  | ASG required      |
| Terraform support       | Excellent     | Limited                 | Excellent         |
| Complexity              | Low           | Low                     | Medium-High       |

---

## Security Considerations

1. **Secret Management**
   - All secrets in Secret Manager (not environment variables)
   - IAM-based access control per service
   - Automatic secret rotation possible

2. **Network Security**
   - Cloud SQL via Auth Proxy (IAM authentication, encrypted connection)
   - Cloud Run with HTTPS-only domain mappings
   - All traffic encrypted in transit

3. **IAM Best Practices**
   - Dedicated service accounts per service
   - Least privilege permissions
   - Workload Identity Federation (no service account keys)

4. **Data Encryption**
   - Cloud SQL encryption at rest (default)
   - HTTPS encryption in transit
   - Secret Manager encryption

---

## Rollback Plan

**Goal:** Zero user data loss in all scenarios.

### Prerequisites (before migration)

- [x] RDS instance remains running (do NOT stop or delete)
- [x] AWS Lightsail containers remain deployed
- [x] DNS TTL lowered to 60 seconds (24h before migration)
- [x] RDS automated snapshot available (`rds:habitcraft-db-2026-01-14-06-42`)
- [x] Bastion host remains running (instance: `i-015cb43f2f75f8ee9`, IP: `34.219.2.26`)
- [x] SSH key available at `~/.ssh/habitcraft-bastion.pem`
- [x] Cloud SQL Auth Proxy installed locally

### Scenario 1: Rollback DURING maintenance window (before DNS switch)

No user data on GCP yet - simple abort.

1. Abort the migration
2. Restart AWS backend (remove maintenance mode)
3. Verify AWS is healthy
4. No DNS changes needed
5. Investigate and reschedule

### Scenario 2: Rollback AFTER go-live

Users may have written data to GCP. **Requires a second maintenance window to preserve all data.**

1. **Announce maintenance window** (or extend if issues found quickly)

2. **Put GCP backend in maintenance mode** (stop new writes)

3. **Start tunnels and load credentials**:
   ```bash
   # SSH tunnel to RDS via bastion
   ssh -i ~/.ssh/habitcraft-bastion.pem \
     -L 5433:habitcraft-db.cb40wqc283y5.us-west-2.rds.amazonaws.com:5432 \
     -N -f ec2-user@34.219.2.26

   # Cloud SQL Auth Proxy
   cloud-sql-proxy --port 5434 habitcraft-prod:us-central1:habitcraft-db &

   # Load credentials from Secrets Manager
   export RDS_PASSWORD=$(aws secretsmanager get-secret-value \
     --secret-id habitcraft/rds-password --query 'SecretString' --output text --region us-west-2)
   export GCP_PASSWORD=$(gcloud secrets versions access latest \
     --secret=db-password --project=habitcraft-prod)
   ```

4. **Export all data from Cloud SQL as CSV** (via Auth Proxy on port 5434):
   ```bash
   PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
     -c "COPY users TO STDOUT WITH CSV HEADER" > tmp/gcp_users.csv
   PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
     -c "COPY habits TO STDOUT WITH CSV HEADER" > tmp/gcp_habits.csv
   PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
     -c "COPY completions TO STDOUT WITH CSV HEADER" > tmp/gcp_completions.csv
   PGPASSWORD="$GCP_PASSWORD" psql -h localhost -p 5434 -U habitcraft -d habitcraft \
     -c "COPY refresh_tokens TO STDOUT WITH CSV HEADER" > tmp/gcp_refresh_tokens.csv
   ```

5. **Merge GCP data into RDS** (via tunnel on port 5433):

   For new records created after migration, use INSERT with ON CONFLICT:
   ```bash
   # Import users (skip existing)
   PGPASSWORD="$RDS_PASSWORD" psql -h localhost -p 5433 -U habituser -d habitcraft \
     -c "CREATE TEMP TABLE tmp_users (LIKE users); COPY tmp_users FROM STDIN WITH CSV HEADER; INSERT INTO users SELECT * FROM tmp_users ON CONFLICT (id) DO NOTHING;" < tmp/gcp_users.csv

   # Repeat for other tables...
   ```

   Or manually compare and merge if data volumes are small.

6. **Verify RDS has all data** (row counts should be >= GCP counts)

7. **Restart AWS Lightsail backend**

8. **Update DNS to point back to AWS**

9. **End maintenance window**

### Rollback Decision Checklist

Before rolling back after go-live, verify:
- [ ] AWS Lightsail containers are still deployed
- [ ] RDS instance is running and accessible
- [ ] You have time for a maintenance window (~30-60 min)
- [ ] Data export/merge scripts are ready

---

## Files to Create

| File                                                    | Purpose                       |
| ------------------------------------------------------- | ----------------------------- |
| `infrastructure/terraform/gcp/prod/main.tf`             | All GCP resources             |
| `infrastructure/terraform/gcp/prod/variables.tf`        | Input variables               |
| `infrastructure/terraform/gcp/prod/outputs.tf`          | Output values                 |
| `infrastructure/terraform/gcp/prod/backend.tf`          | GCS state backend             |
| `.github/workflows/deploy-gcp.yml`                      | GCP deployment workflow       |

## Files to Modify

| File                        | Changes                          |
| --------------------------- | -------------------------------- |
| `docs/AWS_ARCHITECTURE.md`  | Add GCP section or create new doc |
| `.github/workflows/ci.yml`  | Add GCP deployment option        |

---

## Testing Checklist

- [x] Terraform plan shows expected resources
- [x] Images push to Artifact Registry successfully
- [x] Cloud Run services deploy and pass health checks
- [x] Backend connects to Cloud SQL via Auth Proxy
- [x] Domain mappings configured correctly
- [x] SSL certificates valid for all domains
- [x] DNS resolves to Cloud Run services
- [x] User registration and login work
- [x] Habit CRUD operations work
- [ ] E2E tests pass against GCP environment (some failing due to rate limits - see smoke-test-cleanup.md)
- [x] Monitoring alerts configured and tested
- [x] Database migrations run successfully (data migrated via CSV export/import)

**Note on E2E Tests:** UI E2E tests cannot run before DNS cutover because:
1. Frontend is built with `NEXT_PUBLIC_API_BASE_URL=https://api.habitcraft.org`
2. Backend CORS only allows `https://www.habitcraft.org`

GCP smoke tests are available at `frontend/playwright.gcp.config.ts` for use after DNS cutover:
```bash
npx playwright test --config=playwright.gcp.config.ts
```

---

## Manual Testing Results

### Health Endpoint (2026-01-12 UTC)

```bash
curl -s https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/health
```

```json
{
  "service": "habittracker-api",
  "version": "1.0.0",
  "status": "healthy",
  "timestamp": "2026-01-12T00:36:00.106Z",
  "database": "connected"
}
```

**Verified:**
- Cloud Run backend is running
- Cloud SQL Auth Proxy connectivity working
- Database connection established

### Authentication Endpoints (2026-01-12 UTC)

**Registration** - `POST /api/v1/auth/register`

```bash
curl -s -X POST https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "gcptest12345@example.com", "password": "TestPass123", "name": "GCP Test User"}'
```

```json
{
  "user": {
    "id": "1f4206b3-0310-4444-bffd-0bc7fa3b9cb3",
    "email": "gcptest12345@example.com",
    "name": "GCP Test User",
    "createdAt": "2026-01-12T00:39:26.541Z"
  }
}
```

**Login** - `POST /api/v1/auth/login`

```bash
curl -s -X POST https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "gcptest12345@example.com", "password": "TestPass123"}'
```

Response includes:
- User data in JSON body
- `accessToken` cookie (15 min TTL, HttpOnly, Secure, SameSite=Strict)
- `refreshToken` cookie (7 days TTL, HttpOnly, Secure, SameSite=Strict)
- Rate limiting headers (`ratelimit-limit: 5` per 15 min window)

**Security Headers Verified:**
- `content-security-policy`: Restrictive CSP with `default-src 'self'`
- `strict-transport-security`: HSTS enabled with `includeSubDomains`
- `x-content-type-options`: `nosniff`
- `x-frame-options`: `SAMEORIGIN`
- `access-control-allow-origin`: `https://www.habitcraft.org`
- `access-control-allow-credentials`: `true`

### Habit CRUD Endpoints (2026-01-12 UTC)

All tests performed with authenticated session (cookie-based JWT).

| Operation | Endpoint | Result |
|-----------|----------|--------|
| **Create** | `POST /api/v1/habits` | ✅ Returns new habit with ID |
| **Read (list)** | `GET /api/v1/habits` | ✅ Returns array of habits |
| **Read (single)** | `GET /api/v1/habits/:id` | ❌ 404 (not implemented) |
| **Update** | `PUT /api/v1/habits/:id` | ✅ Requires `frequency` field |
| **Delete** | `DELETE /api/v1/habits/:id` | ✅ Returns 204 No Content |
| **Completions** | `POST /api/v1/habits/:id/completions` | ✅ Records habit completion |

**Create Habit:**

```bash
curl -s -b cookies.txt -X POST https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/api/v1/habits \
  -H "Content-Type: application/json" \
  -d '{"name": "Morning Exercise", "description": "30 minutes of cardio", "frequency": "daily"}'
```

```json
{
  "id": "5c44d92e-383e-470d-8261-66b4d998efa9",
  "userId": "1f4206b3-0310-4444-bffd-0bc7fa3b9cb3",
  "name": "Morning Exercise",
  "description": "30 minutes of cardio",
  "frequency": "daily",
  "targetDays": [],
  "color": "#3B82F6",
  "icon": "⭐",
  "status": "active",
  "createdAt": "2026-01-12T00:45:09.532Z",
  "updatedAt": "2026-01-12T00:45:09.532Z"
}
```

**Update Habit:**

```bash
curl -s -b cookies.txt -X PUT https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/api/v1/habits/:id \
  -H "Content-Type: application/json" \
  -d '{"name": "Morning Workout", "description": "45 minutes", "frequency": "daily"}'
```

**Record Completion:**

```bash
curl -s -b cookies.txt -X POST https://habitcraft-backend-iz7ggma5ga-uc.a.run.app/api/v1/habits/:id/completions \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-12"}'
```

```json
{
  "id": "95833b21-7543-4cf6-82d1-056b00121709",
  "habitId": "5c44d92e-383e-470d-8261-66b4d998efa9",
  "date": "2026-01-12",
  "notes": null,
  "createdAt": "2026-01-12T00:46:20.630Z"
}
```

**Note:** Single habit GET (`/api/v1/habits/:id`) returns 404 - this is by design as the frontend uses the list endpoint.
