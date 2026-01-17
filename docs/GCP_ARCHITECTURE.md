# HabitCraft GCP Architecture (Cloud Run + Cloud SQL)

Serverless, pay-per-request deployment using Google Cloud Run and Cloud SQL PostgreSQL.

## Current Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://www.habitcraft.org/ |
| **Backend API** | https://api.habitcraft.org/ |
| **Health Check** | https://api.habitcraft.org/health |

**Region:** us-central1

**Custom domain:** `habitcraft.org` (configured via IONOS DNS + Google-managed SSL certificates)

---

## Design Goals

- **Pay-per-request**: Only pay when handling traffic (scale to zero)
- **Automatic scaling**: Handle traffic spikes without manual intervention
- **Zero server management**: No instances to patch or maintain
- **Simple CI/CD**: Push to master → auto-deploy
- **Built-in observability**: Cloud Logging, Cloud Monitoring, Cloud Trace

---

## Architecture Overview

```
                         ┌─────────────────────────────────────────────────────────┐
                         │                    Google Cloud                          │
                         │                                                          │
    ┌──────────┐         │  ┌────────────────────────────────────────────────────┐ │
    │          │         │  │                  Cloud Run                          │ │
    │  Users   │──HTTPS──┼─▶│                                                    │ │
    │          │         │  │   ┌─────────────────┐   ┌─────────────────┐        │ │
    └──────────┘         │  │   │    Frontend     │   │     Backend     │        │ │
                         │  │   │    Service      │   │     Service     │        │ │
                         │  │   │                 │   │                 │        │ │
                         │  │   │  ┌───────────┐  │   │  ┌───────────┐  │        │ │
                         │  │   │  │  Next.js  │  │   │  │  Express  │──┼────────┼─┼──┐
                         │  │   │  │   :3100   │  │   │  │   :3000   │  │        │ │  │
                         │  │   │  └───────────┘  │   │  └───────────┘  │        │ │  │
                         │  │   │                 │   │                 │        │ │  │
                         │  │   │  Scale to zero  │   │  Scale to zero  │        │ │  │
                         │  │   └─────────────────┘   └─────────────────┘        │ │  │
                         │  │                                                    │ │  │
                         │  └────────────────────────────────────────────────────┘ │  │
                         │                                                          │  │
                         │  ┌────────────────────────────────────────────────────┐ │  │
                         │  │                  Cloud SQL                          │ │  │
                         │  │                                                    │ │  │
                         │  │        ┌─────────────────────────┐                 │ │  │
                         │  │        │      PostgreSQL 14      │◀────────────────┼─┼──┘
                         │  │        │      (db-f1-micro)      │  Auth Proxy     │ │
                         │  │        │         ~$9/mo          │                 │ │
                         │  │        └─────────────────────────┘                 │ │
                         │  │                                                    │ │
                         │  └────────────────────────────────────────────────────┘ │
                         │                                                          │
                         │  ┌────────────────────────────────────────────────────┐ │
                         │  │              Supporting Services                    │ │
                         │  │                                                    │ │
                         │  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │ │
                         │  │  │   Artifact   │  │    Secret    │  │   Cloud   │ │ │
                         │  │  │   Registry   │  │   Manager    │  │ Scheduler │ │ │
                         │  │  └──────────────┘  └──────────────┘  └───────────┘ │ │
                         │  │                                                    │ │
                         │  └────────────────────────────────────────────────────┘ │
                         │                                                          │
                         └──────────────────────────────────────────────────────────┘
```

---

## Monthly Cost

| Service | Configuration | Cost |
|---------|---------------|------|
| Cloud Run (Frontend) | Scale to zero, 256MB | ~$0-5 |
| Cloud Run (Backend) | Scale to zero, 512MB | ~$0-5 |
| Cloud SQL PostgreSQL | db-f1-micro, 10GB | ~$9 |
| Cloud SQL backups | Daily, 7-day retention | ~$1 |
| Artifact Registry | Container images | ~$0.50 |
| Secret Manager | 2 secrets | ~$0.10 |
| Network egress | Outbound traffic | ~$1-2 |
| **Total** | | **~$12-22/month** |

*Note: Costs are for low traffic (~1000 requests/day). Cloud Run scales automatically with traffic.*

---

## Prerequisites

- Google Cloud CLI (`gcloud`) installed and configured
- Docker installed locally
- Domain name (optional, for custom domain)

---

## Component Details

### Cloud Run

Serverless container platform with automatic scaling.

| Setting | Frontend | Backend |
|---------|----------|---------|
| Memory | 256MB | 512MB |
| CPU | 1 vCPU (shared) | 1 vCPU (shared) |
| Min instances | 0 (scale to zero) | 0 (scale to zero) |
| Max instances | 10 | 10 |
| Timeout | 30s | 60s |
| CPU allocation | Request-only | Request-only |

**Cold Start Mitigation:**
- Cold starts typically add ~500ms-2s latency
- For a habit tracker with predictable usage patterns, this is acceptable
- If needed, set `min_instance_count = 1` (~$15/mo per service) to keep warm

### Cloud SQL

Managed PostgreSQL with automatic backups.

| Setting | Value |
|---------|-------|
| Instance | db-f1-micro |
| Engine | PostgreSQL 14 |
| Storage | 10GB SSD (auto-resize) |
| Backups | Daily, 7-day retention |
| Point-in-time recovery | Enabled |
| Availability | Single zone (cost savings) |

### Cloud SQL Auth Proxy

Cloud Run connects to Cloud SQL via the built-in Auth Proxy:

- **No VPC required** - Saves ~$7/mo on Serverless VPC Access connector
- **IAM authentication** - Uses service account identity
- **Encrypted connection** - TLS by default
- **Native support** - Cloud Run has built-in volume mounts for Auth Proxy

### Secret Manager

Secrets are stored securely and accessed via IAM:

| Secret | Purpose |
|--------|---------|
| `jwt-secret` | JWT signing key |
| `db-password` | Cloud SQL password |

### Artifact Registry

Container images are stored in Artifact Registry:

```
us-central1-docker.pkg.dev/habitcraft-prod/habitcraft-containers/
├── backend:latest
├── backend:<sha>
├── frontend:latest
└── frontend:<sha>
```

Cleanup policy keeps the 10 most recent images.

---

## CI/CD with GitHub Actions

Deployment is integrated into the main CI workflow (`.github/workflows/ci.yml`). The workflow:
1. Skips runs for documentation-only changes
2. Runs tests in parallel (unit, integration, E2E)
3. Deploys to GCP Cloud Run on pushes to `master` (only after all tests pass)

### Workflow Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         On Push/PR                              │
│              (skipped for docs-only changes)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Backend Unit    │ │ Backend         │ │ Frontend Unit   │
│ Tests           │ │ Integration     │ │ Tests + Lint    │
│ + Coverage      │ │ Tests           │ │ + Coverage      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    E2E Tests (4 shards)                         │
│              (Playwright with Docker Compose)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (master branch only)
                              ▼
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────┐                     ┌─────────────────┐
│ Deploy Backend  │                     │ Deploy Frontend │
│ to Cloud Run    │                     │ to Cloud Run    │
└─────────────────┘                     └─────────────────┘
```

### Deployment Jobs

```yaml
deploy-backend-gcp:
  needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  steps:
    - Authenticate via Workload Identity Federation
    - Configure Docker for Artifact Registry
    - Copy schema for migrations
    - Build and push Docker image
    - Deploy to Cloud Run

deploy-frontend-gcp:
  needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  steps:
    - Authenticate via Workload Identity Federation
    - Configure Docker for Artifact Registry
    - Build image with NEXT_PUBLIC_API_BASE_URL build arg
    - Push and deploy to Cloud Run
```

### Workload Identity Federation

GitHub Actions authenticates to GCP without service account keys:

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT` | Service account email for deployments |
| `POSTHOG_KEY` | PostHog project API key for analytics |
| `CODECOV_TOKEN` | Codecov upload token for coverage reporting |

---

## Operations

### View Deployment Status

```bash
# Check service status
gcloud run services describe habitcraft-backend --region us-central1
gcloud run services describe habitcraft-frontend --region us-central1

# List revisions
gcloud run revisions list --service habitcraft-backend --region us-central1
```

### View Logs

```bash
# Stream backend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=habitcraft-backend" \
  --limit 100 --format "table(timestamp,textPayload)"

# Or use Cloud Console: Logging → Logs Explorer
```

### Rollback

Cloud Run keeps previous revisions, making rollback straightforward:

```bash
# List recent revisions
gcloud run revisions list --service=habitcraft-backend --region=us-central1

# Rollback to a specific revision
gcloud run services update-traffic habitcraft-backend \
  --region=us-central1 \
  --to-revisions=habitcraft-backend-00005-abc=100
```

### Scale Configuration

```bash
# Set minimum instances (avoid cold starts, ~$15/mo per instance)
gcloud run services update habitcraft-backend \
  --region us-central1 \
  --min-instances 1

# Increase max instances for traffic spikes
gcloud run services update habitcraft-backend \
  --region us-central1 \
  --max-instances 20
```

### Database Operations

```bash
# Connect via Auth Proxy (local development)
cloud-sql-proxy --port 5434 habitcraft-prod:us-central1:habitcraft-db &

# Get password from Secret Manager
gcloud secrets versions access latest --secret=db-password --project=habitcraft-prod

# Connect
PGPASSWORD='<password>' psql -h localhost -p 5434 -U habitcraft -d habitcraft
```

### Database Backup

```bash
# Backups are automatic (daily, 7-day retention)
# List backups
gcloud sql backups list --instance=habitcraft-db

# Create on-demand backup
gcloud sql backups create --instance=habitcraft-db

# Restore from backup
gcloud sql backups restore <backup-id> --restore-instance=habitcraft-db
```

---

## Monitoring

### Built-in Metrics (Cloud Console)

Cloud Run provides these metrics out of the box:
- Request count and latency
- Container instance count
- CPU and memory utilization
- Billable container instance time

Access via: **Cloud Console → Cloud Run → [service] → Metrics**

### Cloud SQL Metrics

- CPU utilization
- Memory utilization
- Disk usage
- Active connections
- Query insights

Access via: **Cloud Console → SQL → [instance] → Insights**

### Alerting Policies

Configured alerts:

| Alert | Condition |
|-------|-----------|
| High Error Rate | >10 5xx errors in 5 minutes |
| High Latency | p99 latency >2s for 5 minutes |
| Database High CPU | >80% CPU for 5 minutes |
| Database Disk Usage | >80% disk utilization |

### Uptime Check

External health check configured:
- URL: `https://api.habitcraft.org/health`
- Interval: 60 seconds
- Timeout: 10 seconds

---

## Custom Domain

**Active:** `habitcraft.org` with DNS managed at IONOS

### DNS Configuration

DNS is managed at IONOS with records pointing to Cloud Run:

| Record | Type | Target |
|--------|------|--------|
| `www.habitcraft.org` | CNAME | `ghs.googlehosted.com.` |
| `api.habitcraft.org` | CNAME | `ghs.googlehosted.com.` |
| `habitcraft.org` | A | `216.239.32.21` |
| `habitcraft.org` | A | `216.239.34.21` |
| `habitcraft.org` | A | `216.239.36.21` |
| `habitcraft.org` | A | `216.239.38.21` |

### SSL Certificates

Google-managed SSL certificates are automatically provisioned and renewed:

```bash
# Check domain mapping status
gcloud beta run domain-mappings list --region us-central1

# View certificate details
gcloud beta run domain-mappings describe --domain www.habitcraft.org --region us-central1
```

---

## Security

### Infrastructure
- [x] Cloud SQL not publicly accessible (Auth Proxy only)
- [x] Cloud SQL storage encryption at rest (default)
- [x] Secrets in Secret Manager (not environment variables)
- [x] Workload Identity Federation (no service account keys)
- [x] IAM least-privilege for service accounts

### Application
- [x] JWT secret stored in Secret Manager
- [x] CORS configured for specific frontend URL
- [x] HttpOnly cookies for JWT tokens
- [x] Rate limiting on auth endpoints
- [x] `trust proxy` enabled for Cloud Run

### CI/CD
- [x] Workload Identity Federation (keyless auth)
- [x] Secrets stored in GitHub Secrets
- [x] Branch protection on master branch

---

## Disaster Recovery

### Recovery Objectives

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Application | 5 min | 0 | Redeploy from Artifact Registry |
| Database | 30 min | 5 min | Cloud SQL automated backups + PITR |

### Restore Database

```bash
# Point-in-time recovery
gcloud sql instances clone habitcraft-db habitcraft-db-restored \
  --point-in-time "2026-01-15T10:00:00Z"

# Or restore from backup
gcloud sql backups restore <backup-id> --restore-instance=habitcraft-db
```

### Redeploy Application

```bash
# Redeploy from latest image
gcloud run deploy habitcraft-backend \
  --image us-central1-docker.pkg.dev/habitcraft-prod/habitcraft-containers/backend:latest \
  --region us-central1
```

---

## Smoke Tests

GCP-specific E2E smoke tests validate the production deployment:

```bash
cd frontends/nextjs
npx playwright test --config=playwright.gcp.config.ts
```

**Architecture:**
- Setup project creates a unique test user
- Tests run with stored auth state (minimizes login attempts)
- Teardown project deletes the test user

**Note:** Rate limiting (5 logins per 15 minutes) means these tests are designed for running once per deployment, not repeatedly.

---

## Comparison with AWS Lightsail

| Factor | GCP Cloud Run | AWS Lightsail |
|--------|---------------|---------------|
| Monthly cost (low traffic) | ~$12-22 | ~$27 |
| Scale to zero | Yes | No |
| Cold starts | ~500ms-2s | None |
| Server management | None | Minimal |
| Auto-scaling | Automatic | Manual |
| Pay model | Per request | Fixed monthly |

---

## Cost Optimization Tips

1. **Scale to zero**: Default configuration, no cost when idle
2. **CPU allocation**: Use `cpu_idle = true` for bursty workloads (default)
3. **Single region**: Stay in us-central1 for lowest latency to Cloud SQL
4. **Committed use discounts**: 1-year commit for Cloud SQL saves ~25%
5. **Right-size memory**: Start with 256MB/512MB, increase only if needed
