# Plan: Host HabitCraft on Google Cloud Platform

**Status:** Pending
**Branch:** `feature/gcp-hosting`
**Created:** 2026-01-09

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

- [ ] Create GCP project
- [ ] Enable required APIs
- [ ] Set up billing account

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

- [ ] Create CI/CD service account
- [ ] Create Cloud Run service accounts
- [ ] Configure IAM permissions

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

- [ ] Create GCS bucket for Terraform state
- [ ] Enable versioning on state bucket

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

- [ ] Create Artifact Registry repository
- [ ] Configure cleanup policies

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

- [ ] Create secrets in Secret Manager
- [ ] Grant Cloud Run access to secrets

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

- [ ] Create Cloud SQL PostgreSQL instance
- [ ] Create database and user

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
# Map custom domains (run after Cloud Run services are deployed)
gcloud run domain-mappings create --service=habitcraft-backend \
  --domain=api.habitcraft.org --region=us-central1

gcloud run domain-mappings create --service=habitcraft-frontend \
  --domain=www.habitcraft.org --region=us-central1

# Also map apex domain to frontend
gcloud run domain-mappings create --service=habitcraft-frontend \
  --domain=habitcraft.org --region=us-central1
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

- [ ] Create backend Cloud Run service
- [ ] Create frontend Cloud Run service
- [ ] Configure Cloud SQL connectivity
- [ ] Set up secrets access
- [ ] Configure public access (allUsers invoker)
- [ ] Set up custom domain mappings
- [ ] Update DNS records

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

- [ ] Create scheduler service account
- [ ] Grant invoker permissions
- [ ] Create Cloud Scheduler job

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
        run: cp shared/database/schema.sql backends/node/

      - name: Build and push backend image
        run: |
          cd backends/node
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
          cd frontends/nextjs
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

- [ ] Set up Workload Identity Federation
- [ ] Create GitHub Actions workflow
- [ ] Configure GitHub secrets
- [ ] Create database migration Cloud Run Job

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

- [ ] Create notification channels
- [ ] Set up error rate alerting
- [ ] Set up latency alerting
- [ ] Set up Cloud SQL CPU and disk alerts
- [ ] Configure uptime checks

---

## Migration Strategy

### Phase 1: Prepare (No Downtime)

1. [ ] Create GCP project and enable APIs
2. [ ] Set up Terraform state backend (GCS)
3. [ ] Create Artifact Registry repository
4. [ ] Set up Secret Manager with secrets
5. [ ] Create service accounts with IAM permissions

### Phase 2: Database Migration

**Option A: Parallel Database (Recommended for safety)**

1. [ ] Create Cloud SQL instance
2. [ ] Export data from RDS: `pg_dump -h rds-host -U user habitcraft > backup.sql`
3. [ ] Import to Cloud SQL: `psql -h cloud-sql-ip -U user habitcraft < backup.sql`
4. [ ] Verify data integrity

**Option B: Database Migration Service**

1. [ ] Use Google Database Migration Service for continuous replication
2. [ ] Cutover when ready with minimal downtime

### Phase 3: Deploy Application

1. [ ] Push Docker images to Artifact Registry
2. [ ] Deploy Cloud Run services
3. [ ] Test with Cloud Run URLs directly
4. [ ] Verify database connectivity
5. [ ] Run E2E tests against GCP environment

### Phase 4: Domain Mapping and DNS

1. [ ] Create Cloud Run domain mappings for all services
2. [ ] Wait for SSL certificate provisioning (~15-30 min)
3. [ ] Lower DNS TTL to 60 seconds (24 hours before cutover)
4. [ ] Update DNS CNAME records to point to Cloud Run
5. [ ] Monitor traffic migration

### Phase 5: Cleanup

1. [ ] Verify all traffic on GCP (check AWS logs)
2. [ ] Keep AWS running for 1 week as rollback
3. [ ] Delete Lightsail container services
4. [ ] Delete RDS instance (after confirming GCP stable)
5. [ ] Update documentation

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

If issues arise during or after migration:

1. **DNS Rollback**: Change DNS back to AWS Lightsail URLs (TTL dependent)
2. **Keep AWS Running**: Don't delete AWS resources until GCP is verified stable
3. **Database**: Keep RDS snapshot for point-in-time recovery

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

- [ ] Terraform plan shows expected resources
- [ ] Images push to Artifact Registry successfully
- [ ] Cloud Run services deploy and pass health checks
- [ ] Backend connects to Cloud SQL via Auth Proxy
- [ ] Domain mappings configured correctly
- [ ] SSL certificates valid for all domains
- [ ] DNS resolves to Cloud Run services
- [ ] User registration and login work
- [ ] Habit CRUD operations work
- [ ] E2E tests pass against GCP environment
- [ ] Monitoring alerts configured and tested
- [ ] Database migrations run successfully
