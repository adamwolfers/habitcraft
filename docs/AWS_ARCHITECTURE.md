# HabitCraft AWS Architecture (k3s + Terraform)

Lightweight Kubernetes deployment using k3s, Terraform for IaC, and AWS Secrets Manager.

## Overview

| Component | Technology |
|-----------|------------|
| Orchestration | k3s (lightweight Kubernetes) |
| Infrastructure | Terraform |
| Secrets | AWS Secrets Manager |
| Database | RDS PostgreSQL |
| Ingress | Traefik (included with k3s) |
| SSL | Let's Encrypt (via Traefik) |

---

## Architecture Diagram

```
                                    ┌──────────────────────────────────────────────────┐
                                    │                    AWS Cloud                      │
                                    │                                                   │
    ┌──────────┐                    │  ┌─────────────────────────────────────────────┐ │
    │          │                    │  │              VPC (10.0.0.0/16)              │ │
    │  Users   │────HTTPS───────────┼─▶│                                             │ │
    │          │                    │  │  ┌───────────────────────────────────────┐  │ │
    └──────────┘                    │  │  │         Public Subnet (10.0.1.0/24)   │  │ │
                                    │  │  │                                       │  │ │
                                    │  │  │  ┌─────────────────────────────────┐  │  │ │
                                    │  │  │  │      EC2 Instance (t3.small)    │  │  │ │
                                    │  │  │  │                                 │  │  │ │
                                    │  │  │  │  ┌───────────────────────────┐  │  │  │ │
                                    │  │  │  │  │          k3s              │  │  │  │ │
                                    │  │  │  │  │                           │  │  │  │ │
                                    │  │  │  │  │  ┌─────────────────────┐  │  │  │  │ │
                                    │  │  │  │  │  │ Traefik Ingress     │  │  │  │  │ │
                                    │  │  │  │  │  │ :80 :443            │  │  │  │  │ │
                                    │  │  │  │  │  └──────────┬──────────┘  │  │  │  │ │
                                    │  │  │  │  │             │             │  │  │  │ │
                                    │  │  │  │  │  ┌──────────┴──────────┐  │  │  │  │ │
                                    │  │  │  │  │  │                     │  │  │  │  │ │
                                    │  │  │  │  │  ▼                     ▼  │  │  │  │ │
                                    │  │  │  │  │ ┌────────┐    ┌────────┐  │  │  │  │ │
                                    │  │  │  │  │ │Frontend│    │Backend │  │  │  │  │ │
                                    │  │  │  │  │ │  Pod   │    │  Pod   │  │  │  │  │ │
                                    │  │  │  │  │ │ :3100  │    │ :3000  │──┼──┼──┼──┼─┼─┐
                                    │  │  │  │  │ └────────┘    └────────┘  │  │  │  │ │ │
                                    │  │  │  │  │                           │  │  │  │ │ │
                                    │  │  │  │  └───────────────────────────┘  │  │  │ │ │
                                    │  │  │  │                                 │  │  │ │ │
                                    │  │  │  └─────────────────────────────────┘  │  │ │ │
                                    │  │  │                                       │  │ │ │
                                    │  │  └───────────────────────────────────────┘  │ │ │
                                    │  │                                             │ │ │
                                    │  │  ┌───────────────────────────────────────┐  │ │ │
                                    │  │  │       Private Subnet (10.0.2.0/24)    │  │ │ │
                                    │  │  │                                       │  │ │ │
                                    │  │  │        ┌─────────────────────┐        │  │ │ │
                                    │  │  │        │   RDS PostgreSQL    │◀───────┼──┼─┘ │
                                    │  │  │        │   (db.t4g.micro)    │        │  │   │
                                    │  │  │        └─────────────────────┘        │  │   │
                                    │  │  │                                       │  │   │
                                    │  │  └───────────────────────────────────────┘  │   │
                                    │  │                                             │   │
                                    │  └─────────────────────────────────────────────┘   │
                                    │                                                    │
                                    │  ┌──────────────────┐                              │
                                    │  │  Secrets Manager │ ◀── JWT_SECRET, DB creds     │
                                    │  └──────────────────┘                              │
                                    │                                                    │
                                    └────────────────────────────────────────────────────┘
```

---

## Cost Estimate (Monthly)

| Service | Configuration | Cost |
|---------|---------------|------|
| EC2 | t3.small (2 vCPU, 2GB) | ~$15 |
| RDS | db.t4g.micro, 20GB | ~$13 |
| Secrets Manager | 2 secrets | ~$1 |
| EBS | 30GB gp3 | ~$3 |
| Data Transfer | ~10GB | ~$1 |
| **Total** | | **~$33/month** |

---

## Project Structure

```
infrastructure/
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── vpc.tf
│   ├── ec2.tf
│   ├── rds.tf
│   ├── secrets.tf
│   └── terraform.tfvars.example
└── k8s/
    ├── namespace.yaml
    ├── secrets.yaml
    ├── backend/
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── frontend/
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ingress.yaml
```

---

## Terraform Configuration

### main.tf

```hcl
terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "habitcraft"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

### variables.tf

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "ssh_allowed_ip" {
  description = "IP address allowed to SSH (your IP)"
  type        = string
}
```

### vpc.tf

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "habitcraft-vpc" }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "habitcraft-igw" }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "habitcraft-public" }
}

# Private Subnet
resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}a"

  tags = { Name = "habitcraft-private" }
}

# Private Subnet 2 (required for RDS subnet group)
resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "${var.aws_region}b"

  tags = { Name = "habitcraft-private-2" }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "habitcraft-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
```

### ec2.tf

```hcl
# Security Group for EC2
resource "aws_security_group" "k3s" {
  name        = "habitcraft-k3s"
  description = "Security group for k3s server"
  vpc_id      = aws_vpc.main.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${var.ssh_allowed_ip}/32"]
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Kubernetes API (optional, for remote kubectl)
  ingress {
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    cidr_blocks = ["${var.ssh_allowed_ip}/32"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "habitcraft-k3s-sg" }
}

# IAM Role for EC2 (to access Secrets Manager)
resource "aws_iam_role" "k3s" {
  name = "habitcraft-k3s-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "secrets-access"
  role = aws_iam_role.k3s.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        aws_secretsmanager_secret.db_credentials.arn,
        aws_secretsmanager_secret.jwt_secret.arn
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "k3s" {
  name = "habitcraft-k3s-profile"
  role = aws_iam_role.k3s.name
}

# Key Pair
resource "aws_key_pair" "k3s" {
  key_name   = "habitcraft-k3s"
  public_key = file("~/.ssh/id_rsa.pub")
}

# EC2 Instance
resource "aws_instance" "k3s" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.small"
  key_name               = aws_key_pair.k3s.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.k3s.id]
  iam_instance_profile   = aws_iam_instance_profile.k3s.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install k3s
    curl -sfL https://get.k3s.io | sh -s - \
      --write-kubeconfig-mode 644 \
      --tls-san ${var.domain_name}

    # Wait for k3s to be ready
    until kubectl get nodes; do sleep 5; done

    # Install AWS CLI
    yum install -y awscli jq

    echo "k3s installation complete"
  EOF

  tags = { Name = "habitcraft-k3s" }
}

# Latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}
```

### rds.tf

```hcl
# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "habitcraft-rds"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.k3s.id]
  }

  tags = { Name = "habitcraft-rds-sg" }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "habitcraft-db-subnets"
  subnet_ids = [aws_subnet.private.id, aws_subnet.private_2.id]

  tags = { Name = "habitcraft-db-subnet-group" }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "habitcraft-db"

  engine         = "postgres"
  engine_version = "14"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "habitcraft"
  username = "habituser"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  skip_final_snapshot     = false
  final_snapshot_identifier = "habitcraft-final-snapshot"

  multi_az               = false
  publicly_accessible    = false
  storage_encrypted      = true

  tags = { Name = "habitcraft-db" }
}
```

### secrets.tf

```hcl
# Database Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "habitcraft/db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    host     = aws_db_instance.main.address
    port     = 5432
    database = "habitcraft"
    username = "habituser"
    password = var.db_password
  })
}

# JWT Secret
resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "habitcraft/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = jsonencode({
    secret = var.jwt_secret
  })
}
```

### outputs.tf

```hcl
output "k3s_public_ip" {
  description = "Public IP of k3s server"
  value       = aws_instance.k3s.public_ip
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.address
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/id_rsa ec2-user@${aws_instance.k3s.public_ip}"
}

output "kubeconfig_command" {
  description = "Command to get kubeconfig"
  value       = "scp ec2-user@${aws_instance.k3s.public_ip}:/etc/rancher/k3s/k3s.yaml ./kubeconfig && sed -i '' 's/127.0.0.1/${aws_instance.k3s.public_ip}/g' ./kubeconfig"
}
```

---

## Kubernetes Manifests

### k8s/namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: habitcraft
```

### k8s/secrets.yaml

```yaml
# This secret is populated by a setup script that pulls from AWS Secrets Manager
apiVersion: v1
kind: Secret
metadata:
  name: habitcraft-secrets
  namespace: habitcraft
type: Opaque
stringData:
  DB_HOST: "PLACEHOLDER"
  DB_PORT: "5432"
  DB_NAME: "habitcraft"
  DB_USER: "habituser"
  DB_PASSWORD: "PLACEHOLDER"
  JWT_SECRET: "PLACEHOLDER"
```

### k8s/backend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: habitcraft
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/your-org/habitcraft-backend:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: DB_HOST
            - name: DB_PORT
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: DB_PORT
            - name: DB_NAME
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: DB_NAME
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: DB_USER
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: DB_PASSWORD
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: habitcraft-secrets
                  key: JWT_SECRET
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### k8s/backend/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: habitcraft
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
```

### k8s/frontend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: habitcraft
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: ghcr.io/your-org/habitcraft-frontend:latest
          ports:
            - containerPort: 3100
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "https://your-domain.com/api/v1"
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /
              port: 3100
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 3100
            initialDelaySeconds: 5
            periodSeconds: 5
```

### k8s/frontend/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: habitcraft
spec:
  selector:
    app: frontend
  ports:
    - port: 3100
      targetPort: 3100
```

### k8s/ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: habitcraft-ingress
  namespace: habitcraft
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
spec:
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 3100
```

---

## Deployment Guide

### 1. Initialize Terraform

```bash
cd infrastructure/terraform

# Create tfvars file
cat > terraform.tfvars << EOF
aws_region     = "us-east-1"
environment    = "production"
domain_name    = "habitcraft.example.com"
db_password    = "$(openssl rand -base64 24)"
jwt_secret     = "$(openssl rand -base64 64)"
ssh_allowed_ip = "YOUR_IP_ADDRESS"
EOF

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 2. Configure kubectl

```bash
# Get kubeconfig from server
scp ec2-user@$(terraform output -raw k3s_public_ip):/etc/rancher/k3s/k3s.yaml ./kubeconfig

# Update server address
sed -i '' "s/127.0.0.1/$(terraform output -raw k3s_public_ip)/g" ./kubeconfig

export KUBECONFIG=./kubeconfig
kubectl get nodes
```

### 3. Configure Traefik for Let's Encrypt

```bash
# SSH into server
ssh ec2-user@$(terraform output -raw k3s_public_ip)

# Create Traefik config
sudo tee /var/lib/rancher/k3s/server/manifests/traefik-config.yaml << EOF
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    additionalArguments:
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/data/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
EOF
```

### 4. Sync Secrets from AWS

```bash
# SSH into server and run:
#!/bin/bash

# Fetch secrets from AWS Secrets Manager
DB_CREDS=$(aws secretsmanager get-secret-value --secret-id habitcraft/db-credentials --query SecretString --output text)
JWT_CREDS=$(aws secretsmanager get-secret-value --secret-id habitcraft/jwt-secret --query SecretString --output text)

# Create Kubernetes secret
kubectl create namespace habitcraft --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic habitcraft-secrets \
  --namespace=habitcraft \
  --from-literal=DB_HOST=$(echo $DB_CREDS | jq -r .host) \
  --from-literal=DB_PORT=$(echo $DB_CREDS | jq -r .port) \
  --from-literal=DB_NAME=$(echo $DB_CREDS | jq -r .database) \
  --from-literal=DB_USER=$(echo $DB_CREDS | jq -r .username) \
  --from-literal=DB_PASSWORD=$(echo $DB_CREDS | jq -r .password) \
  --from-literal=JWT_SECRET=$(echo $JWT_CREDS | jq -r .secret) \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 5. Deploy Application

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Verify
kubectl get pods -n habitcraft
kubectl get ingress -n habitcraft
```

### 6. Run Database Migrations

```bash
# Port-forward to run migrations
kubectl run psql-client --rm -it --image=postgres:14 -n habitcraft -- \
  psql "postgresql://habituser:PASSWORD@RDS_ENDPOINT:5432/habitcraft"

# Or run from local with SSH tunnel
ssh -L 5432:RDS_ENDPOINT:5432 ec2-user@EC2_IP
psql -h localhost -U habituser -d habitcraft -f shared/database/init.sql
```

---

## Operations

### View Logs

```bash
kubectl logs -f deployment/backend -n habitcraft
kubectl logs -f deployment/frontend -n habitcraft
```

### Update Deployment

```bash
# Build and push new image, then:
kubectl rollout restart deployment/backend -n habitcraft
kubectl rollout restart deployment/frontend -n habitcraft
```

### Scale (if needed)

```bash
kubectl scale deployment/backend --replicas=2 -n habitcraft
```

### Backup Database

```bash
aws rds create-db-snapshot \
  --db-instance-identifier habitcraft-db \
  --db-snapshot-identifier habitcraft-$(date +%Y%m%d)
```

---

## Scaling Path

When you outgrow this setup:

1. **Upgrade EC2** - t3.medium or t3.large for more pods
2. **Add worker nodes** - k3s supports multi-node clusters
3. **Enable RDS Multi-AZ** - For database reliability
4. **Migrate to EKS** - When you need managed control plane
   - K8s manifests will work with minimal changes
   - Terraform can be extended for EKS

---

## Container Build & Push

### Option A: Amazon ECR

```bash
# Add to terraform/ecr.tf
resource "aws_ecr_repository" "backend" {
  name                 = "habitcraft-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "habitcraft-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}
```

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push backend
cd backends/node
docker build -t habitcraft-backend .
docker tag habitcraft-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-backend:latest

# Build and push frontend
cd frontends/nextjs
docker build -t habitcraft-frontend .
docker tag habitcraft-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-frontend:latest
```

### Option B: GitHub Container Registry (ghcr.io)

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build and push
docker build -t ghcr.io/your-org/habitcraft-backend:latest ./backends/node
docker push ghcr.io/your-org/habitcraft-backend:latest

docker build -t ghcr.io/your-org/habitcraft-frontend:latest ./frontends/nextjs
docker push ghcr.io/your-org/habitcraft-frontend:latest
```

### Dockerfiles

**backends/node/Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
```

**frontends/nextjs/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3100

ENV PORT=3100

CMD ["node", "server.js"]
```

---

## Monitoring & Observability

### CloudWatch Agent (Lightweight)

Install CloudWatch agent on EC2 for basic metrics and logs:

```bash
# SSH into EC2 instance
ssh ec2-user@$(terraform output -raw k3s_public_ip)

# Install CloudWatch agent
sudo yum install -y amazon-cloudwatch-agent

# Create config
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "metrics": {
    "namespace": "HabitCraft",
    "metrics_collected": {
      "cpu": { "measurement": ["cpu_usage_active"] },
      "mem": { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["disk_used_percent"] }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/containers/*.log",
            "log_group_name": "habitcraft-k3s",
            "log_stream_name": "{instance_id}/containers"
          }
        ]
      }
    }
  }
}
EOF

# Start agent
sudo systemctl enable amazon-cloudwatch-agent
sudo systemctl start amazon-cloudwatch-agent
```

### Add IAM Policy for CloudWatch

```hcl
# Add to ec2.tf
resource "aws_iam_role_policy" "cloudwatch_access" {
  name = "cloudwatch-access"
  role = aws_iam_role.k3s.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}
```

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| CPU Usage | EC2 / CloudWatch | > 80% for 5 min |
| Memory Usage | CloudWatch Agent | > 85% for 5 min |
| Disk Usage | CloudWatch Agent | > 80% |
| RDS CPU | RDS / CloudWatch | > 80% for 5 min |
| RDS Connections | RDS / CloudWatch | > 80% of max |
| RDS Storage | RDS / CloudWatch | < 20% free |

### CloudWatch Alarms (Terraform)

```hcl
# Add to terraform/monitoring.tf
resource "aws_cloudwatch_metric_alarm" "ec2_cpu" {
  alarm_name          = "habitcraft-ec2-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU utilization is high"

  dimensions = {
    InstanceId = aws_instance.k3s.id
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "habitcraft-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is high"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "habitcraft-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 4000000000  # 4GB
  alarm_description   = "RDS free storage is low"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }
}
```

### View Logs

```bash
# Kubernetes pod logs
kubectl logs -f deployment/backend -n habitcraft
kubectl logs -f deployment/frontend -n habitcraft

# CloudWatch logs (via AWS CLI)
aws logs tail habitcraft-k3s --follow
```

---

## Security Checklist

### Infrastructure Security

- [ ] SSH key pair secured (400 permissions, not shared)
- [ ] SSH access restricted to specific IP (`ssh_allowed_ip` variable)
- [ ] RDS not publicly accessible
- [ ] RDS in private subnet
- [ ] RDS storage encryption enabled
- [ ] Security groups follow least-privilege principle
- [ ] VPC flow logs enabled (optional, adds cost)

### Application Security

- [ ] JWT secret is strong (64+ random bytes)
- [ ] Database password is strong (24+ random characters)
- [ ] Secrets stored in AWS Secrets Manager (not in code/env files)
- [ ] HTTPS enforced via Traefik
- [ ] HttpOnly cookies for JWT tokens
- [ ] CORS configured for specific origins (not wildcard in production)

### Kubernetes Security

- [ ] k3s kubeconfig secured (not publicly accessible)
- [ ] Kubernetes API (6443) restricted to admin IP
- [ ] Resource limits set on all pods
- [ ] Liveness/readiness probes configured
- [ ] Container images scanned for vulnerabilities (ECR scan or Trivy)

### Secrets Management

- [ ] No secrets in git repository
- [ ] No secrets in Terraform state (use remote backend with encryption)
- [ ] Secrets Manager configured with least-privilege IAM
- [ ] terraform.tfvars in .gitignore

### Terraform State Security

```hcl
# Recommended: Use S3 backend with encryption
terraform {
  backend "s3" {
    bucket         = "habitcraft-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "habitcraft-terraform-locks"
  }
}
```

### Regular Maintenance

- [ ] Keep k3s updated (`curl -sfL https://get.k3s.io | sh -`)
- [ ] Keep container base images updated
- [ ] Review CloudWatch alarms weekly
- [ ] Test backup restoration quarterly
- [ ] Rotate secrets annually (or on suspected compromise)

---

## Disaster Recovery

### Recovery Objectives

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Application | 15 min | 0 | Re-deploy from container registry |
| Database | 1 hour | 5 min | RDS automated backups + PITR |
| Infrastructure | 30 min | 0 | Terraform (re-apply) |
| Secrets | 5 min | 0 | AWS Secrets Manager (multi-AZ) |

### Backup Strategy

**Database (RDS)**
- Automated daily backups (7-day retention)
- Point-in-time recovery (PITR) enabled
- Manual snapshots before major changes

```bash
# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier habitcraft-db \
  --db-snapshot-identifier habitcraft-manual-$(date +%Y%m%d-%H%M)

# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier habitcraft-db \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' \
  --output table
```

**Kubernetes Resources**
```bash
# Export all resources
kubectl get all -n habitcraft -o yaml > backup-k8s-$(date +%Y%m%d).yaml

# Export secrets (careful with storage!)
kubectl get secrets -n habitcraft -o yaml > backup-secrets-$(date +%Y%m%d).yaml
```

**Terraform State**
- Use S3 backend with versioning enabled
- State automatically backed up on each apply

### Recovery Procedures

**Scenario 1: Pod Crash / Application Issue**
```bash
# Check pod status
kubectl get pods -n habitcraft
kubectl describe pod <pod-name> -n habitcraft

# Restart deployment
kubectl rollout restart deployment/backend -n habitcraft

# Roll back to previous version
kubectl rollout undo deployment/backend -n habitcraft
```

**Scenario 2: EC2 Instance Failure**
```bash
# Terraform will recreate the instance
terraform apply

# Re-sync secrets from AWS Secrets Manager
# (run sync script from Step 4 in Deployment Guide)

# Re-apply Kubernetes manifests
kubectl apply -f k8s/
```

**Scenario 3: Database Corruption**
```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier habitcraft-db-restored \
  --db-snapshot-identifier habitcraft-manual-20240101 \
  --db-instance-class db.t4g.micro \
  --db-subnet-group-name habitcraft-db-subnets \
  --vpc-security-group-ids <rds-sg-id>

# Or use point-in-time recovery
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier habitcraft-db \
  --target-db-instance-identifier habitcraft-db-restored \
  --restore-time 2024-01-15T10:00:00Z
```

**Scenario 4: Complete Environment Rebuild**
```bash
# 1. Ensure Terraform state is available
# 2. Re-apply all infrastructure
terraform init
terraform apply

# 3. Wait for RDS to be available (~10 min)
# 4. Configure k3s (may need to SSH and verify)
# 5. Sync secrets
# 6. Deploy application
kubectl apply -f k8s/

# 7. Restore database from snapshot if needed
```

### Testing Recovery

Schedule quarterly recovery tests:

1. **Backup verification**: Restore RDS snapshot to test instance
2. **Application recovery**: Terminate EC2, verify Terraform recreates it
3. **Deployment rollback**: Practice `kubectl rollout undo`
4. **Full DR drill**: Rebuild entire environment from scratch
