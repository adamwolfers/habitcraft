# HabitCraft GCP Architecture (Cloud Run + Cloud SQL)

Serverless deployment using Google Cloud Platform with scale-to-zero capability for cost efficiency.

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

- **Pay-per-request pricing** - Cloud Run charges only when handling requests
- **Automatic scaling** - Handles traffic spikes without manual intervention
- **Managed infrastructure** - No servers to patch or maintain
- **Infrastructure as Code** - Terraform for reproducible deployments
- **Simple operations** - Fewer moving parts than VM-based architecture

---

## Architecture Overview

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

### Component Summary

| Component | GCP Service | Configuration |
|-----------|-------------|---------------|
| Frontend | Cloud Run | Scale 0-10, 256MB RAM |
| Backend API | Cloud Run | Scale 0-10, 512MB RAM |
| Database | Cloud SQL PostgreSQL 14 | db-f1-micro, 10GB SSD |
| Secrets | Secret Manager | JWT secret, DB password |
| Scheduled Jobs | Cloud Scheduler | Email reminders every 5 min |
| Container Registry | Artifact Registry | us-central1 |
| SSL Certificates | Google-managed | Auto-renewal via domain mapping |
| DNS | IONOS (external) | CNAMEs to ghs.googlehosted.com |

---

## Monthly Cost

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| Cloud Run (Backend) | ~$0-5 | Scale to zero, pay per request |
| Cloud Run (Frontend) | ~$0-5 | Scale to zero, pay per request |
| Cloud SQL (db-f1-micro) | ~$9 | Smallest instance |
| Cloud SQL backups | ~$1 | PITR enabled, 7-day retention |
| Artifact Registry | ~$0.50 | Container image storage |
| Network egress | ~$1-2 | Outbound traffic |
| Secret Manager | ~$0.10 | Secret versions + accesses |
| Cloud Monitoring | $0 | Free tier |
| **Total** | **~$12-22** | Low traffic scenario |

---

## CI/CD with GitHub Actions

Deployment is integrated into the main CI workflow (`.github/workflows/ci.yml`):

1. All tests run in parallel (backend unit, integration, frontend unit, E2E)
2. On merge to `master`, after tests pass:
   - Database migrations run via Cloud Run Job
   - Backend and frontend images built and pushed to Artifact Registry
   - Cloud Run services updated with new images
3. Health checks verify successful deployment

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider |
| `GCP_SERVICE_ACCOUNT` | Service account for deployments |
| `POSTHOG_KEY` | PostHog analytics key |
| `CODECOV_TOKEN` | Coverage reporting (optional) |

---

## Database Migrations

### Tool: dbmate

We use [dbmate](https://github.com/amacneil/dbmate) for database migrations:

- **Language-agnostic** - Works regardless of backend language (Node, Java, Python)
- **Pure SQL** - Migrations are `.sql` files, portable and easy to review
- **Simple CLI** - `dbmate up`, `dbmate new <name>`
- **Lightweight** - Single Go binary, small container for Cloud Run Job

### Directory Structure

```
db/
├── migrations/           # Migration files (YYYYMMDDHHMMSS_name.sql)
│   ├── 20260116000000_baseline.sql
│   └── ...
└── schema.sql            # Auto-generated schema dump
```

### Rollback Strategy: Forward-Only

We use forward-only migrations (no down migrations):

- Rollbacks with production data are risky and rarely tested
- When something breaks, fix forward with a new migration
- Simpler, safer, less code to maintain
- **Safety net:** Pre-migration backups + Cloud SQL point-in-time recovery

### Local Development

Docker Compose auto-migrates on startup via the `db-migrate` service:

```bash
# Migrations run automatically when you start the stack
docker-compose up

# Or run manually
dbmate up
```

### Production (CI/CD)

Migrations run sequentially before deployment:

1. CI creates a pre-migration backup
2. Cloud Run Job executes `dbmate up`
3. If migration fails, deployment stops
4. On success, new container images deploy

### Creating a New Migration

```bash
# Create a new migration file
dbmate new add_user_preferences

# Edit the generated file in db/migrations/
# Then commit and push - CI handles the rest
```

---

## Operations

### View Logs

```bash
# Stream backend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=habitcraft-backend" \
  --project=habitcraft-prod --limit=50

# Or use Cloud Console: https://console.cloud.google.com/logs
```

### Rollback

Cloud Run keeps previous revisions:

```bash
# List recent revisions
gcloud run revisions list --service=habitcraft-backend --region=us-central1

# Rollback to a specific revision
gcloud run services update-traffic habitcraft-backend \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

**Note:** Database migrations are not automatically rolled back. Fix forward with a new migration.

### Manual Database Access

Use Cloud SQL Auth Proxy for secure local access:

```bash
# Start proxy
cloud-sql-proxy --port 5434 habitcraft-prod:us-central1:habitcraft-db &

# Get password from Secret Manager
gcloud secrets versions access latest --secret=db-password --project=habitcraft-prod

# Connect
PGPASSWORD='<password>' psql -h localhost -p 5434 -U habitcraft -d habitcraft
```

---

## Monitoring & Alerts

Configured via Terraform in `infrastructure/terraform/gcp/prod/`:

| Alert | Condition |
|-------|-----------|
| High Error Rate | >10 5xx errors in 5 min |
| High Latency | p99 >2s for 5 min |
| Database CPU | >80% for 5 min |
| Database Disk | >80% utilization |
| Uptime Check | api.habitcraft.org/health fails |

Notifications go to email via Cloud Monitoring notification channels.

---

## Security

- **Secrets:** All sensitive values in Secret Manager (not environment variables)
- **Database:** Cloud SQL Auth Proxy (IAM auth, encrypted, no public IP)
- **HTTPS:** Google-managed SSL certificates with auto-renewal
- **IAM:** Dedicated service accounts per service with least privilege
- **CI/CD:** Workload Identity Federation (no service account keys)

---

## Cold Starts

Cloud Run scales to zero when idle. Cold starts add ~500ms-2s latency.

**Current config:** `min_instance_count = 0` (scale to zero)

If cold starts become a UX problem, add minimum instances:

```hcl
scaling {
  min_instance_count = 1   # ~$15/mo per service
  max_instance_count = 10
}
```

---

## Related Documentation

- **[Migration Plan](./plans/completed/gcp-cloud-run-migration.md)** - Original migration from AWS
- **[AWS Architecture](./AWS_ARCHITECTURE.md)** - Legacy deployment (archived)
- **[Terraform Config](../infrastructure/terraform/gcp/prod/)** - Infrastructure as Code
