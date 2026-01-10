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

**Estimated monthly cost:** ~$15-25/mo (low traffic) vs ~$27/mo current AWS Lightsail

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
    +-> www.habitcraft.org -> Cloud Load Balancer -> Cloud Run (Frontend)
    |                               |
    +-> api.habitcraft.org ---------+-------------> Cloud Run (Backend)
                                                          |
                                                          v
                                                   Cloud SQL PostgreSQL
                                                          ^
                                                          |
    Cloud Scheduler -> Cloud Tasks ---> Cloud Run (Worker) [for email reminders]
```

### Component Mapping

| Current (AWS)            | Target (GCP)                    | Notes                          |
| ------------------------ | ------------------------------- | ------------------------------ |
| Lightsail Containers     | Cloud Run                       | Serverless, scale-to-zero      |
| RDS PostgreSQL           | Cloud SQL PostgreSQL            | Managed PostgreSQL             |
| Lightsail built-in LB    | Cloud Load Balancing            | Global HTTPS load balancer     |
| Lightsail SSL            | Google-managed SSL certificates | Auto-renewal                   |
| IONOS DNS                | Cloud DNS (optional)            | Or keep IONOS                  |
| CloudWatch               | Cloud Monitoring + Cloud Trace  | Logging, metrics, tracing      |
| GitHub Actions + AWS CLI | Cloud Build or GitHub Actions   | CI/CD pipeline                 |
| N/A                      | Artifact Registry               | Container image storage        |
| N/A                      | Cloud Scheduler + Cloud Tasks   | For scheduled email reminders  |
| N/A                      | Secret Manager                  | Secure secrets storage         |

---

## Technology Choices

| Component        | Choice                            | Rationale                                   |
| ---------------- | --------------------------------- | ------------------------------------------- |
| Compute          | Cloud Run                         | Serverless, scale-to-zero, per-request cost |
| Database         | Cloud SQL PostgreSQL              | Managed, automatic backups, HA options      |
| Container Registry | Artifact Registry               | GCP-native, integrated with Cloud Build     |
| Load Balancer    | External Application Load Balancer | Global, Cloud CDN ready, managed SSL       |
| SSL Certificates | Google-managed certificates       | Free, auto-renewal                          |
| Secrets          | Secret Manager                    | Secure, versioned, IAM-controlled           |
| CI/CD            | GitHub Actions + gcloud CLI       | Familiar workflow, minimal changes          |
| Scheduled Jobs   | Cloud Scheduler + Cloud Tasks     | Serverless, reliable delivery               |
| Monitoring       | Cloud Monitoring + Cloud Logging  | Built-in, free tier generous                |
| IaC              | Terraform                         | Same tooling as AWS plan                    |
| DNS              | Cloud DNS (optional)              | Or keep IONOS with CNAMEs                   |

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
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  certificatemanager.googleapis.com \
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

```
infrastructure/
├── terraform/
│   ├── gcp/
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   │   ├── main.tf
│   │   │   │   ├── variables.tf
│   │   │   │   ├── outputs.tf
│   │   │   │   └── terraform.tfvars
│   │   │   └── prod/
│   │   │       ├── main.tf
│   │   │       ├── variables.tf
│   │   │       ├── outputs.tf
│   │   │       └── terraform.tfvars
│   │   ├── modules/
│   │   │   ├── artifact-registry/
│   │   │   ├── cloud-run/
│   │   │   ├── cloud-sql/
│   │   │   ├── load-balancer/
│   │   │   ├── secrets/
│   │   │   └── scheduler/
│   │   └── shared/
│   │       └── backend.tf
```

### Step 1: Terraform State Backend (GCS)

**File:** `infrastructure/terraform/gcp/shared/backend.tf`

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

**File:** `infrastructure/terraform/gcp/modules/artifact-registry/main.tf`

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

**File:** `infrastructure/terraform/gcp/modules/secrets/main.tf`

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

**File:** `infrastructure/terraform/gcp/modules/cloud-sql/main.tf`

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

    ip_configuration {
      ipv4_enabled = false           # No public IP
      private_network = var.vpc_id   # Private connectivity only

      # Alternative: Allow Cloud Run via Cloud SQL Auth Proxy (no VPC needed)
      # ipv4_enabled = true
      # require_ssl  = true
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

output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}
```

### Cloud SQL Connection Options

**Option A: Cloud SQL Auth Proxy (Recommended for simplicity)**
- No VPC required
- Automatic IAM authentication
- Encrypted connection
- Works out of the box with Cloud Run

**Option B: Private IP + VPC Connector**
- Lower latency
- More complex setup
- Requires Serverless VPC Access connector (~$7/mo)

- [ ] Create Cloud SQL PostgreSQL instance
- [ ] Create database and user
- [ ] Choose connection method (Auth Proxy vs Private IP)

---

## Part 6: Cloud Run Services

**File:** `infrastructure/terraform/gcp/modules/cloud-run/main.tf`

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

### Cold Start Mitigation

For low-latency requirements, configure minimum instances:

```hcl
scaling {
  min_instance_count = 1   # Always keep 1 instance warm (~$15/mo per service)
  max_instance_count = 10
}
```

- [ ] Create backend Cloud Run service
- [ ] Create frontend Cloud Run service
- [ ] Configure Cloud SQL connectivity
- [ ] Set up secrets access
- [ ] Configure public access (allUsers invoker)

---

## Part 7: Load Balancer with Custom Domain

**File:** `infrastructure/terraform/gcp/modules/load-balancer/main.tf`

```hcl
# Reserve static IP
resource "google_compute_global_address" "main" {
  name = "${var.project}-lb-ip"
}

# SSL Certificate (Google-managed)
resource "google_compute_managed_ssl_certificate" "main" {
  name = "${var.project}-cert"

  managed {
    domains = ["www.habitcraft.org", "api.habitcraft.org", "habitcraft.org"]
  }
}

# Backend service for Cloud Run (Frontend)
resource "google_compute_backend_service" "frontend" {
  name                  = "${var.project}-frontend-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  timeout_sec           = 30
  enable_cdn            = true  # Enable Cloud CDN for static assets

  backend {
    group = google_compute_region_network_endpoint_group.frontend.id
  }

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    serve_while_stale            = 86400
  }
}

# Backend service for Cloud Run (API)
resource "google_compute_backend_service" "backend" {
  name        = "${var.project}-backend-backend"
  protocol    = "HTTPS"
  port_name   = "http"
  timeout_sec = 60
  enable_cdn  = false  # No caching for API

  backend {
    group = google_compute_region_network_endpoint_group.backend.id
  }
}

# Serverless NEG for Frontend
resource "google_compute_region_network_endpoint_group" "frontend" {
  name                  = "${var.project}-frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = var.frontend_service_name
  }
}

# Serverless NEG for Backend
resource "google_compute_region_network_endpoint_group" "backend" {
  name                  = "${var.project}-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = var.backend_service_name
  }
}

# URL Map (routing rules)
resource "google_compute_url_map" "main" {
  name            = "${var.project}-lb"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = ["api.habitcraft.org"]
    path_matcher = "api"
  }

  host_rule {
    hosts        = ["www.habitcraft.org", "habitcraft.org"]
    path_matcher = "frontend"
  }

  path_matcher {
    name            = "api"
    default_service = google_compute_backend_service.backend.id
  }

  path_matcher {
    name            = "frontend"
    default_service = google_compute_backend_service.frontend.id
  }
}

# HTTPS Proxy
resource "google_compute_target_https_proxy" "main" {
  name             = "${var.project}-https-proxy"
  url_map          = google_compute_url_map.main.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]
}

# HTTP Proxy (for redirect)
resource "google_compute_target_http_proxy" "redirect" {
  name    = "${var.project}-http-redirect"
  url_map = google_compute_url_map.redirect.id
}

# Redirect URL Map
resource "google_compute_url_map" "redirect" {
  name = "${var.project}-http-redirect"

  default_url_redirect {
    https_redirect = true
    strip_query    = false
  }
}

# Global Forwarding Rules
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.project}-https"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.main.id
  ip_address            = google_compute_global_address.main.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.project}-http"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.main.id
}

output "load_balancer_ip" {
  value = google_compute_global_address.main.address
}
```

- [ ] Reserve static IP address
- [ ] Create Google-managed SSL certificate
- [ ] Create backend services with serverless NEGs
- [ ] Configure URL map for host-based routing
- [ ] Set up HTTPS and HTTP (redirect) forwarding rules
- [ ] Enable Cloud CDN for frontend

---

## Part 8: Scheduled Email Reminders

**File:** `infrastructure/terraform/gcp/modules/scheduler/main.tf`

```hcl
# Cloud Tasks queue for reliable delivery
resource "google_cloud_tasks_queue" "reminders" {
  name     = "email-reminders"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 5
    max_backoff        = "3600s"
    min_backoff        = "10s"
    max_doublings      = 4
  }

  stackdriver_logging_config {
    sampling_ratio = 1.0
  }
}

# Cloud Scheduler job to trigger reminder processing
resource "google_cloud_scheduler_job" "process_reminders" {
  name        = "process-reminders"
  description = "Trigger reminder processing every 5 minutes"
  schedule    = "*/5 * * * *"  # Every 5 minutes
  time_zone   = "UTC"

  http_target {
    http_method = "POST"
    uri         = "${var.backend_url}/api/v1/internal/process-reminders"

    oidc_token {
      service_account_email = var.scheduler_service_account
      audience              = var.backend_url
    }
  }

  retry_config {
    retry_count = 3
  }
}

# Service account for scheduler
resource "google_service_account" "scheduler" {
  account_id   = "scheduler-service"
  display_name = "Cloud Scheduler Service"
}

# Grant scheduler permission to invoke Cloud Run
resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  location = var.region
  name     = var.backend_service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}
```

- [ ] Create Cloud Tasks queue
- [ ] Create Cloud Scheduler job
- [ ] Configure service account for scheduler
- [ ] Grant invoker permissions

---

## Part 9: CI/CD with GitHub Actions

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

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.BACKEND_SERVICE }} \
            --image ${{ env.ARTIFACT_REGISTRY }}/backend:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed

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

---

## Part 10: Monitoring and Alerting

**File:** `infrastructure/terraform/gcp/modules/monitoring/main.tf`

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

# Alert: Database connection failures
resource "google_monitoring_alert_policy" "db_connection_failures" {
  display_name = "Database Connection Failures"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL connection failures"

    condition_threshold {
      filter          = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/network/connections\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

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

### Phase 4: Load Balancer and DNS

1. [ ] Create load balancer with SSL certificate
2. [ ] Wait for SSL certificate provisioning (~15-30 min)
3. [ ] Lower DNS TTL to 60 seconds (24 hours before cutover)
4. [ ] Update DNS to point to GCP load balancer IP
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
| Load Balancer           | ~$3          | Minimum forwarding rule charge     |
| Artifact Registry       | ~$0.50       | Storage for container images       |
| Cloud Monitoring        | $0           | Free tier covers basic monitoring  |
| Secret Manager          | ~$0.10       | 6 secret versions, 10K accesses    |
| **Total**               | **~$18-23**  |                                    |

### Medium Traffic Scenario (~10,000 requests/day)

| Component               | Monthly Cost | Notes                              |
| ----------------------- | ------------ | ---------------------------------- |
| Cloud Run (Backend)     | ~$10-15      | Moderate request volume            |
| Cloud Run (Frontend)    | ~$5-10       | With Cloud CDN caching             |
| Cloud SQL (db-f1-micro) | ~$9          | May need db-g1-small (~$25) later  |
| Load Balancer           | ~$5          | More traffic through LB            |
| Cloud CDN               | ~$2          | Egress for cached content          |
| **Total**               | **~$31-41**  |                                    |

### Cost Optimization Options

1. **Committed Use Discounts**: 1-year commit for Cloud SQL saves ~25%
2. **Cloud SQL Maintenance**: Stop database during known idle periods (dev only)
3. **Regional vs Multi-region**: Stay single-region for cost savings
4. **CPU Allocation**: Use `cpu_idle = true` for bursty workloads

---

## Comparison with AWS Options

| Factor                  | GCP Cloud Run | AWS Lightsail (Current) | AWS EC2 (Planned) |
| ----------------------- | ------------- | ----------------------- | ----------------- |
| Monthly cost (low traffic) | ~$18-23    | ~$27                    | ~$53              |
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
   - Cloud SQL with private IP only (no public exposure)
   - Cloud Run services behind load balancer
   - All traffic over HTTPS

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
| `infrastructure/terraform/gcp/shared/backend.tf`        | GCS state backend             |
| `infrastructure/terraform/gcp/modules/*/`               | Terraform modules             |
| `infrastructure/terraform/gcp/environments/prod/*.tf`   | Production environment        |
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
- [ ] Backend connects to Cloud SQL
- [ ] Load balancer routes traffic correctly
- [ ] SSL certificate valid for all domains
- [ ] DNS resolves to GCP load balancer
- [ ] User registration and login work
- [ ] Habit CRUD operations work
- [ ] E2E tests pass against GCP environment
- [ ] Monitoring alerts configured and tested
