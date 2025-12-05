# HabitCraft AWS Architecture (Lightsail Containers + RDS)

Simple, cost-effective deployment using AWS Lightsail Container Service and RDS PostgreSQL.

## Current Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://habitcraft-frontend.yxzyhs04ajgq0.us-west-2.cs.amazonlightsail.com/ |
| **Backend API** | https://habitcraft-backend.yxzyhs04ajgq0.us-west-2.cs.amazonlightsail.com/ |
| **Health Check** | https://habitcraft-backend.yxzyhs04ajgq0.us-west-2.cs.amazonlightsail.com/health |

**Region:** us-west-2

**Planned custom domain:** `habitcraft.org` (see [Custom Domain](#custom-domain-optional) section)

---

## Design Goals

- **Quick setup**: Deploy in under an hour
- **Easy CI/CD**: Push image → auto-deploy
- **Low maintenance**: AWS-managed containers and database
- **Predictable cost**: Fixed monthly pricing
- **Simple monitoring**: Built-in dashboards

---

## Architecture Overview

```
                         ┌────────────────────────────────────────────────────┐
                         │                     AWS Cloud                       │
                         │                                                     │
    ┌──────────┐         │  ┌─────────────────────────────────────────────┐   │
    │          │         │  │          Lightsail Container Services        │   │
    │  Users   │──HTTPS──┼─▶│                                             │   │
    │          │         │  │   ┌─────────────────┐ ┌─────────────────┐   │   │
    └──────────┘         │  │   │    Frontend     │ │     Backend     │   │   │
                         │  │   │    Service      │ │     Service     │   │   │
                         │  │   │                 │ │                 │   │   │
                         │  │   │  ┌───────────┐  │ │  ┌───────────┐  │   │   │
                         │  │   │  │  Next.js  │  │ │  │  Express  │──┼───┼───┼──┐
                         │  │   │  │   :3100   │  │ │  │   :3000   │  │   │   │  │
                         │  │   │  └───────────┘  │ │  └───────────┘  │   │   │  │
                         │  │   │                 │ │                 │   │   │  │
                         │  │   │  $7/mo (Nano)   │ │  $7/mo (Nano)   │   │   │  │
                         │  │   └─────────────────┘ └─────────────────┘   │   │  │
                         │  │                                             │   │  │
                         │  └─────────────────────────────────────────────┘   │  │
                         │                                                     │  │
                         │  ┌─────────────────────────────────────────────┐   │  │
                         │  │                    VPC                       │   │  │
                         │  │                                             │   │  │
                         │  │        ┌─────────────────────────┐          │   │  │
                         │  │        │    RDS PostgreSQL       │◀─────────┼───┼──┘
                         │  │        │    (db.t4g.micro)       │          │   │
                         │  │        │       $13/mo            │          │   │
                         │  │        └─────────────────────────┘          │   │
                         │  │                                             │   │
                         │  └─────────────────────────────────────────────┘   │
                         │                                                     │
                         └─────────────────────────────────────────────────────┘
```

---

## Monthly Cost

| Service | Configuration | Cost |
|---------|---------------|------|
| Lightsail Container (Frontend) | Nano (512MB, 0.25 vCPU) | $7 |
| Lightsail Container (Backend) | Nano (512MB, 0.25 vCPU) | $7 |
| RDS PostgreSQL | db.t4g.micro, 20GB | ~$13 |
| Data Transfer | Included in Lightsail | $0 |
| **Total** | | **~$27/month** |

*Note: First 3 months of Lightsail are free for new AWS accounts.*

---

## Prerequisites

- AWS CLI installed and configured
- Docker installed locally
- Domain name (optional, for custom domain)

---

## Setup Guide

### Step 1: Create RDS Database (~10 min)

```bash
# Create VPC and subnet group (or use default VPC)
aws rds create-db-subnet-group \
  --db-subnet-group-name habitcraft-db-subnets \
  --db-subnet-group-description "HabitCraft DB subnets" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier habitcraft-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 14 \
  --master-username habituser \
  --master-user-password "$(openssl rand -base64 24)" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-name habitcraft \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --storage-encrypted

# Wait for database to be available (~5-10 min)
aws rds wait db-instance-available --db-instance-identifier habitcraft-db

# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier habitcraft-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### Step 2: Create Lightsail Container Services (~5 min)

```bash
# Create backend service
aws lightsail create-container-service \
  --service-name habitcraft-backend \
  --power nano \
  --scale 1

# Create frontend service
aws lightsail create-container-service \
  --service-name habitcraft-frontend \
  --power nano \
  --scale 1

# Wait for services to be ready
aws lightsail get-container-services --service-name habitcraft-backend
aws lightsail get-container-services --service-name habitcraft-frontend
```

### Step 3: Enable VPC Peering for RDS Access (~5 min)

Lightsail containers need VPC peering to reach RDS in a VPC:

```bash
# Enable VPC peering for Lightsail
aws lightsail peer-vpc

# Get the Lightsail VPC peering connection info
aws lightsail get-container-service-powers
```

Update your RDS security group to allow inbound from Lightsail's CIDR (172.26.0.0/16).

### Step 4: Build and Push Container Images (~10 min)

**Backend:**

```bash
cd backends/node

# Build the image
docker build -t habitcraft-backend .

# Push to Lightsail
aws lightsail push-container-image \
  --service-name habitcraft-backend \
  --label backend \
  --image habitcraft-backend:latest
```

**Frontend:**

```bash
cd frontends/nextjs

# Build the image
docker build -t habitcraft-frontend .

# Push to Lightsail
aws lightsail push-container-image \
  --service-name habitcraft-frontend \
  --label frontend \
  --image habitcraft-frontend:latest
```

### Step 5: Deploy Containers (~5 min)

**Deploy Backend:**

```bash
# Get the image URI from the push output, then:
cat > backend-deployment.json << 'EOF'
{
  "serviceName": "habitcraft-backend",
  "containers": {
    "backend": {
      "image": ":habitcraft-backend.backend.latest",
      "ports": {
        "3000": "HTTP"
      },
      "environment": {
        "NODE_ENV": "production",
        "PORT": "3000",
        "DB_HOST": "YOUR_RDS_ENDPOINT",
        "DB_PORT": "5432",
        "DB_NAME": "habitcraft",
        "DB_USER": "habituser",
        "DB_PASSWORD": "YOUR_DB_PASSWORD",
        "JWT_SECRET": "YOUR_JWT_SECRET",
        "FRONTEND_URL": "https://YOUR_FRONTEND_URL"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "backend",
    "containerPort": 3000,
    "healthCheck": {
      "path": "/health",
      "intervalSeconds": 30,
      "timeoutSeconds": 5
    }
  }
}
EOF

aws lightsail create-container-service-deployment \
  --cli-input-json file://backend-deployment.json
```

**Deploy Frontend:**

```bash
cat > frontend-deployment.json << 'EOF'
{
  "serviceName": "habitcraft-frontend",
  "containers": {
    "frontend": {
      "image": ":habitcraft-frontend.frontend.latest",
      "ports": {
        "3100": "HTTP"
      },
      "environment": {
        "NEXT_PUBLIC_API_URL": "https://YOUR_BACKEND_URL/api/v1"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "frontend",
    "containerPort": 3100,
    "healthCheck": {
      "path": "/",
      "intervalSeconds": 30,
      "timeoutSeconds": 5
    }
  }
}
EOF

aws lightsail create-container-service-deployment \
  --cli-input-json file://frontend-deployment.json
```

### Step 6: Run Database Migrations

```bash
# Option 1: Run from local machine with port forwarding
# First, create a Lightsail instance or use EC2 for SSH tunnel to RDS

# Option 2: Use a one-off container (exec into running container)
# Connect to your backend container and run migrations

# Option 3: Include migrations in container startup
# Add to backend Dockerfile or entrypoint script
```

### Step 7: Get Your URLs

```bash
# Get backend URL
aws lightsail get-container-services --service-name habitcraft-backend \
  --query 'containerServices[0].url' --output text

# Get frontend URL
aws lightsail get-container-services --service-name habitcraft-frontend \
  --query 'containerServices[0].url' --output text
```

Your app is now live at the frontend URL!

---

## CI/CD with GitHub Actions

Deployment is integrated into the main CI workflow (`.github/workflows/ci.yml`). The workflow:
1. Skips runs for documentation-only changes (`.md` files, `docs/`, etc.)
2. Runs four test jobs in parallel on every push
3. Uploads code coverage to Codecov
4. Deploys to Lightsail on pushes to `master` (only after all tests pass)

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
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         E2E Tests                               │
│            (Playwright with Docker Compose)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (master branch only)
                              ▼
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────┐                     ┌─────────────────┐
│ Deploy Backend  │                     │ Deploy Frontend │
│ to Lightsail    │                     │ to Lightsail    │
└─────────────────┘                     └─────────────────┘
```

### Test Jobs

| Job | Description |
|-----|-------------|
| `backend-unit-tests` | Runs Jest unit tests with coverage, uploads to Codecov |
| `backend-integration-tests` | Spins up PostgreSQL service container, runs integration tests |
| `frontend-unit-tests` | Runs ESLint and Jest unit tests with coverage, uploads to Codecov |
| `e2e-tests` | Starts full stack via Docker Compose, runs Playwright tests |

### Deployment Jobs

Deployment runs only on pushes to `master` after all tests pass:

```yaml
deploy-backend:
  needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  steps:
    - Configure AWS credentials
    - Install Lightsail plugin
    - Copy schema for migrations
    - Build and push Docker image
    - Deploy to Lightsail Container Service

deploy-frontend:
  needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  steps:
    - Configure AWS credentials
    - Install Lightsail plugin
    - Build image with NEXT_PUBLIC_API_BASE_URL build arg
    - Push and deploy to Lightsail
```

See `.github/workflows/ci.yml` for the complete workflow.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key (from `habitcraft-cicd` user) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `DB_HOST` | RDS endpoint (e.g., `habitcraft-db.xxxxx.us-west-2.rds.amazonaws.com`) |
| `DB_USER` | Database username |
| `DB_PASSWORD` | Database password |
| `JWT_SECRET` | JWT signing secret (64+ random bytes) |
| `FRONTEND_URL` | Frontend URL for CORS (e.g., `https://habitcraft-frontend.xxxxx.amazonlightsail.com`) |
| `API_URL` | Backend base URL **without** `/api/v1` (e.g., `https://habitcraft-backend.xxxxx.amazonlightsail.com`) |
| `CODECOV_TOKEN` | Codecov upload token for coverage reporting (optional but recommended) |

---

## Dockerfiles

### Backend (backends/node/Dockerfile)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Copy schema for auto-migrations (from shared/database)
COPY schema.sql ./

# Entrypoint runs migrations on first deploy, then starts server
RUN chmod +x entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["./entrypoint.sh"]
```

**Note:** Before building, copy the schema file:
```bash
cp shared/database/schema.sql backends/node/
```

### Frontend (frontends/nextjs/Dockerfile)

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# IMPORTANT: NEXT_PUBLIC_* vars are baked in at build time, not runtime!
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100

COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3100/ || exit 1

CMD ["node", "server.js"]
```

**Important:** When building the frontend image, you must pass the API URL as a build argument:

```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.amazonlightsail.com \
  -t habitcraft-frontend:latest .
```

---

## Operations

### View Deployment Status

```bash
# Check service status
aws lightsail get-container-services --service-name habitcraft-backend
aws lightsail get-container-services --service-name habitcraft-frontend

# View deployment history
aws lightsail get-container-service-deployments --service-name habitcraft-backend
```

### View Logs

```bash
# Stream logs
aws lightsail get-container-log \
  --service-name habitcraft-backend \
  --container-name backend \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)
```

Or use the Lightsail console for a visual log viewer.

### Rollback

```bash
# List previous deployments
aws lightsail get-container-service-deployments --service-name habitcraft-backend

# Rollback by redeploying a previous image version
# (Re-run deployment with the previous image label)
```

### Scale Up

```bash
# Increase power (more CPU/RAM)
aws lightsail update-container-service \
  --service-name habitcraft-backend \
  --power micro  # 1GB RAM, 0.5 vCPU, $10/mo

# Increase nodes (horizontal scaling)
aws lightsail update-container-service \
  --service-name habitcraft-backend \
  --scale 2  # Run 2 containers
```

### Database Backup

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier habitcraft-db \
  --db-snapshot-identifier habitcraft-$(date +%Y%m%d)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier habitcraft-db
```

---

## Monitoring

### Built-in Metrics (Lightsail Console)

Lightsail provides these metrics out of the box:
- CPU utilization
- Memory utilization
- Request count
- Response time

Access via: **Lightsail Console → Container Services → [service] → Metrics**

### RDS Metrics (CloudWatch)

- CPU utilization
- Database connections
- Free storage space
- Read/Write IOPS

Access via: **RDS Console → [database] → Monitoring**

### Set Up Alarms (Optional)

```bash
# CPU alarm for backend
aws cloudwatch put-metric-alarm \
  --alarm-name habitcraft-backend-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/Lightsail \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ServiceName,Value=habitcraft-backend
```

---

## Custom Domain (Optional)

**Planned:** `habitcraft.org` with DNS managed at IONOS

### DNS Configuration

For `habitcraft.org`, DNS is managed externally at IONOS (not Lightsail DNS). Create CNAME records pointing to the Lightsail container service URLs:

| Record | Type | Value |
|--------|------|-------|
| `www.habitcraft.org` | CNAME | `habitcraft-frontend.xxxxx.us-west-2.cs.amazonlightsail.com` |
| `api.habitcraft.org` | CNAME | `habitcraft-backend.xxxxx.us-west-2.cs.amazonlightsail.com` |

**Note:** For the apex domain (`habitcraft.org`), configure a redirect to `www.habitcraft.org` in IONOS, since CNAME records cannot be used for apex domains.

### Alternative: Using Lightsail DNS

If you prefer to manage DNS in AWS:

```bash
# Create DNS zone
aws lightsail create-domain --domain-name yourdomain.com

# Create A record pointing to container service
aws lightsail create-domain-entry \
  --domain-name yourdomain.com \
  --domain-entry '{
    "name": "app",
    "type": "A",
    "target": "YOUR_CONTAINER_SERVICE_URL"
  }'
```

### Enable HTTPS with Custom Domain

Lightsail Container Services provide automatic HTTPS on the default `.amazonaws.com` domain. For custom domains, you'll need to:

1. Create a Lightsail certificate
2. Attach it to the container service
3. Update DNS to point to the service

```bash
# Create certificate
aws lightsail create-certificate \
  --certificate-name habitcraft-cert \
  --domain-name app.yourdomain.com

# Validate domain ownership (follow DNS instructions)

# Attach to service
aws lightsail update-container-service \
  --service-name habitcraft-frontend \
  --public-domain-names '{
    "habitcraft-cert": ["app.yourdomain.com"]
  }'
```

---

## Security Checklist

### Infrastructure
- [ ] RDS not publicly accessible
- [ ] RDS storage encryption enabled
- [ ] Strong database password (24+ characters)
- [ ] VPC peering configured correctly
- [ ] IAM user for CI/CD uses scoped policy (see `infrastructure/iam-policies/`)

### Application
- [ ] JWT secret is strong (64+ random bytes)
- [ ] CORS configured for specific frontend URL
- [ ] HttpOnly cookies for JWT tokens
- [ ] Rate limiting enabled on auth endpoints

### CI/CD
- [ ] Secrets stored in GitHub Secrets (not in code)
- [ ] AWS credentials use IAM user (not root)
- [ ] Branch protection on main branch

### IAM Policies

Pre-configured IAM policies are available in [`infrastructure/iam-policies/`](../infrastructure/iam-policies/):

| Policy | Purpose |
|--------|---------|
| `habitcraft-cicd-policy.json` | CI/CD deployments (GitHub Actions) |
| `habitcraft-ops-policy.json` | Manual operations, snapshots, monitoring |
| `habitcraft-readonly-policy.json` | Read-only access for dashboards |

**Quick setup:**

```bash
cd infrastructure/iam-policies

# Replace placeholder with your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i '' "s/\${AWS_ACCOUNT_ID}/$ACCOUNT_ID/g" *.json  # macOS
# sed -i "s/\${AWS_ACCOUNT_ID}/$ACCOUNT_ID/g" *.json   # Linux

# Create CI/CD user and policy
aws iam create-user --user-name habitcraft-cicd
aws iam create-policy --policy-name HabitCraftCICD \
  --policy-document file://habitcraft-cicd-policy.json
aws iam attach-user-policy --user-name habitcraft-cicd \
  --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/HabitCraftCICD

# Generate access keys for GitHub Secrets
aws iam create-access-key --user-name habitcraft-cicd
```

See [`infrastructure/iam-policies/README.md`](../infrastructure/iam-policies/README.md) for complete setup instructions.

---

## Disaster Recovery

### Recovery Objectives

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Application | 5 min | 0 | Redeploy from image registry |
| Database | 30 min | 5 min | RDS automated backups + PITR |

### Restore Database from Snapshot

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier habitcraft-db-restored \
  --db-snapshot-identifier habitcraft-20240101 \
  --db-instance-class db.t4g.micro
```

### Redeploy Application

```bash
# Simply re-run the deployment command
# Images are stored in Lightsail's container registry
aws lightsail create-container-service-deployment \
  --cli-input-json file://backend-deployment.json
```

---

## Scaling Path

When you outgrow this setup:

1. **More power**: Upgrade from Nano ($7) to Micro ($10) or Small ($25)
2. **More instances**: Increase scale from 1 to 2+ nodes
3. **Larger database**: Upgrade RDS instance class
4. **Load balancing**: Lightsail includes load balancing automatically when scale > 1
5. **Migrate to ECS/EKS**: If you need more control, Dockerfiles work as-is

---

## Troubleshooting

### Container won't start

```bash
# Check deployment status
aws lightsail get-container-services --service-name habitcraft-backend

# Check logs
aws lightsail get-container-log --service-name habitcraft-backend --container-name backend
```

### Can't connect to RDS

1. Verify VPC peering is enabled: `aws lightsail peer-vpc`
2. Check RDS security group allows inbound from 172.26.0.0/16
3. Verify DB_HOST environment variable is correct

### Health check failing

1. Verify your `/health` endpoint returns 200
2. Check container logs for startup errors
3. Ensure PORT environment variable matches exposed port

---

## Cost Optimization Tips

1. **Use Nano size**: 512MB is enough for low-traffic apps
2. **Single node**: Don't scale until you need it
3. **Reserved capacity**: Not available for Lightsail, but RDS Reserved Instances save ~30%
4. **Free tier**: New AWS accounts get 3 months free on Lightsail
