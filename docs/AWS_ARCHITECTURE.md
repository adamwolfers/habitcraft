# HabitCraft AWS Architecture (EKS)

This document outlines the AWS architecture for deploying HabitCraft on Amazon Elastic Kubernetes Service (EKS).

## Table of Contents

1. [Application Overview](#application-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Kubernetes Manifests](#kubernetes-manifests)
5. [Cost Estimates](#cost-estimates)
6. [Implementation Guide](#implementation-guide)

---

## Application Overview

| Component | Technology | Container Port |
|-----------|------------|----------------|
| Frontend | Next.js 16, React 19, TypeScript | 3100 |
| Backend | Node.js 20, Express 5 | 3000 |
| Database | PostgreSQL 14 | 5432 |
| Auth | JWT (HttpOnly cookies) | - |

---

## Architecture Diagram

### Production Architecture (EKS)

```
                                    ┌─────────────────────────────────────────────────────────────────┐
                                    │                           AWS Cloud                             │
                                    │                                                                 │
    ┌──────────┐                    │  ┌─────────────┐                                               │
    │          │                    │  │             │                                               │
    │  Users   │─────HTTPS──────────┼─▶│  CloudFront │                                               │
    │          │                    │  │    (CDN)    │                                               │
    └──────────┘                    │  │             │                                               │
                                    │  └──────┬──────┘                                               │
                                    │         │                                                       │
    ┌──────────┐                    │         │         ┌───────────────────────────────────────────┐│
    │ Route 53 │◀───DNS─────────────┼─────────┘         │              VPC (10.0.0.0/16)            ││
    │   (DNS)  │                    │                   │                                           ││
    └──────────┘                    │                   │  ┌─────────────────────────────────────┐  ││
                                    │                   │  │        Public Subnets (x3 AZs)      │  ││
                                    │                   │  │                                     │  ││
                                    │                   │  │  ┌───────────────────────────────┐  │  ││
                                    │                   │  │  │  AWS Load Balancer Controller │  │  ││
                                    │                   │  │  │         (ALB Ingress)         │  │  ││
                                    │                   │  │  │          :443 HTTPS           │  │  ││
                                    │                   │  │  └───────────────┬───────────────┘  │  ││
                                    │                   │  │                  │                  │  ││
                                    │                   │  └──────────────────┼──────────────────┘  ││
                                    │                   │                     │                     ││
                                    │                   │  ┌──────────────────┼──────────────────┐  ││
                                    │                   │  │       Private Subnets (x3 AZs)      │  ││
                                    │                   │  │                  │                  │  ││
                                    │                   │  │  ┌───────────────────────────────┐  │  ││
                                    │                   │  │  │         EKS Cluster           │  │  ││
                                    │                   │  │  │                               │  │  ││
                                    │                   │  │  │  ┌─────────┐    ┌─────────┐   │  │  ││
                                    │                   │  │  │  │Frontend │    │ Backend │   │  │  ││
                                    │                   │  │  │  │  Pods   │    │  Pods   │   │  │  ││
                                    │                   │  │  │  │ (HPA)   │    │  (HPA)  │   │  │  ││
                                    │                   │  │  │  └─────────┘    └────┬────┘   │  │  ││
                                    │                   │  │  │                      │        │  │  ││
                                    │                   │  │  └──────────────────────┼────────┘  │  ││
                                    │                   │  │                         │           │  ││
                                    │                   │  │                         ▼           │  ││
                                    │                   │  │                  ┌────────────┐     │  ││
                                    │  ┌──────────┐     │  │                  │    RDS     │     │  ││
                                    │  │   ECR    │     │  │                  │ PostgreSQL │     │  ││
                                    │  │(registry)│     │  │                  │ (Multi-AZ) │     │  ││
                                    │  └──────────┘     │  │                  └────────────┘     │  ││
                                    │                   │  │                                     │  ││
                                    │  ┌──────────┐     │  └─────────────────────────────────────┘  ││
                                    │  │ Secrets  │     │                                           ││
                                    │  │ Manager  │     └───────────────────────────────────────────┘│
                                    │  └──────────┘                                                  │
                                    │                                                                │
                                    └────────────────────────────────────────────────────────────────┘
```

### Kubernetes Cluster Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EKS Cluster                                         │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Control Plane (AWS Managed)                          │  │
│  │    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │  │
│  │    │ API Server  │    │  Scheduler  │    │ Controller  │    │    etcd     │      │  │
│  │    │             │    │             │    │   Manager   │    │             │      │  │
│  │    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           Worker Nodes (Managed Node Group)                       │  │
│  │                                                                                   │  │
│  │   Node 1 (us-east-1a)        Node 2 (us-east-1b)        Node 3 (us-east-1c)      │  │
│  │   ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐      │  │
│  │   │ ┌─────────────┐ │        │ ┌─────────────┐ │        │ ┌─────────────┐ │      │  │
│  │   │ │  frontend   │ │        │ │  frontend   │ │        │ │  backend    │ │      │  │
│  │   │ │    pod      │ │        │ │    pod      │ │        │ │    pod      │ │      │  │
│  │   │ └─────────────┘ │        │ └─────────────┘ │        │ └─────────────┘ │      │  │
│  │   │ ┌─────────────┐ │        │ ┌─────────────┐ │        │ ┌─────────────┐ │      │  │
│  │   │ │  backend    │ │        │ │  backend    │ │        │ │  frontend   │ │      │  │
│  │   │ │    pod      │ │        │ │    pod      │ │        │ │    pod      │ │      │  │
│  │   │ └─────────────┘ │        │ └─────────────┘ │        │ └─────────────┘ │      │  │
│  │   └─────────────────┘        └─────────────────┘        └─────────────────┘      │  │
│  │                                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                  Namespaces                                       │  │
│  │                                                                                   │  │
│  │   habitcraft (app)          kube-system              monitoring                   │  │
│  │   ┌─────────────────┐       ┌─────────────────┐      ┌─────────────────┐         │  │
│  │   │ - Deployments   │       │ - CoreDNS       │      │ - Prometheus    │         │  │
│  │   │ - Services      │       │ - AWS LB Ctrl   │      │ - Grafana       │         │  │
│  │   │ - ConfigMaps    │       │ - EBS CSI       │      │ - AlertManager  │         │  │
│  │   │ - Secrets       │       │ - Secrets CSI   │      │                 │         │  │
│  │   │ - HPA           │       │                 │      │                 │         │  │
│  │   └─────────────────┘       └─────────────────┘      └─────────────────┘         │  │
│  │                                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                    Request Flow                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘

  User Request (habitcraft.example.com)
       │
       ▼
  ┌─────────┐
  │ Route53 │──── DNS Resolution
  │         │
  └────┬────┘
       │
       ▼
  ┌─────────────┐
  │ CloudFront  │──── Edge caching for static assets (/_next/static/*)
  │    (CDN)    │──── SSL termination
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │     ALB     │──── Created by AWS Load Balancer Controller
  │  (Ingress)  │──── Path-based routing
  └──────┬──────┘
         │
         ├──────────────────────────────────────┐
         │                                      │
         ▼                                      ▼
  ┌─────────────┐                        ┌─────────────┐
  │  Frontend   │   /api/* requests      │   Backend   │
  │   Service   │ ─────────────────────▶ │   Service   │
  │  (ClusterIP)│   (internal routing)   │ (ClusterIP) │
  └──────┬──────┘                        └──────┬──────┘
         │                                      │
         ▼                                      ▼
  ┌─────────────┐                        ┌─────────────┐
  │  Frontend   │                        │   Backend   │
  │    Pods     │                        │    Pods     │
  │  (Next.js)  │                        │  (Express)  │
  └─────────────┘                        └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │     RDS     │
                                         │ PostgreSQL  │
                                         └─────────────┘
```

---

## Component Details

### 1. EKS Cluster

```yaml
Cluster:
  Name: habitcraft-cluster
  Version: 1.29
  Endpoint Access: Private + Public (restricted)

  Add-ons:
    - CoreDNS
    - kube-proxy
    - vpc-cni
    - aws-ebs-csi-driver
    - secrets-store-csi-driver

  Logging:
    - api
    - audit
    - authenticator
    - controllerManager
    - scheduler
```

### 2. Node Groups

```yaml
Managed Node Group:
  Name: habitcraft-workers
  Instance Types:
    - t3.medium (2 vCPU, 4GB) - default
    - t3.large (2 vCPU, 8GB) - scaling

  Scaling:
    Min: 2
    Desired: 3
    Max: 10

  Labels:
    role: worker
    environment: production

  Taints: []

  AMI: Amazon Linux 2 (EKS optimized)
```

### 3. Networking

```yaml
VPC:
  CIDR: 10.0.0.0/16

  Subnets:
    Public (3 AZs):
      - 10.0.1.0/24 (us-east-1a) - ALB, NAT Gateway
      - 10.0.2.0/24 (us-east-1b) - ALB
      - 10.0.3.0/24 (us-east-1c) - ALB

    Private (3 AZs):
      - 10.0.10.0/24 (us-east-1a) - EKS nodes, RDS
      - 10.0.20.0/24 (us-east-1b) - EKS nodes, RDS
      - 10.0.30.0/24 (us-east-1c) - EKS nodes

  VPC Endpoints:
    - com.amazonaws.region.ecr.api (Interface)
    - com.amazonaws.region.ecr.dkr (Interface)
    - com.amazonaws.region.s3 (Gateway)
    - com.amazonaws.region.secretsmanager (Interface)
    - com.amazonaws.region.sts (Interface)
```

### 4. Database (RDS)

```yaml
RDS Instance:
  Identifier: habitcraft-db
  Engine: PostgreSQL 14.10
  Instance Class: db.t3.medium
  Storage: 100GB gp3
  Multi-AZ: true

  Network:
    Subnet Group: habitcraft-db-subnets (private)
    Security Group: Allow 5432 from EKS node SG

  Backup:
    Retention: 7 days
    Window: 03:00-04:00 UTC
    Snapshot on delete: true

  Encryption: AWS KMS (aws/rds)

  Parameters:
    max_connections: 200
    shared_buffers: 256MB
    log_statement: ddl
```

### 5. Load Balancer Controller

```yaml
AWS Load Balancer Controller:
  Version: 2.7.x
  Installation: Helm chart

  Service Account:
    Name: aws-load-balancer-controller
    IAM Role: AmazonEKSLoadBalancerControllerRole

  Features:
    - ALB Ingress provisioning
    - NLB Service provisioning
    - Target Group binding
    - WAF integration
```

---

## Kubernetes Manifests

### Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: habitcraft
  labels:
    app.kubernetes.io/name: habitcraft
```

### Backend Deployment

```yaml
# k8s/backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: habitcraft
  labels:
    app: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      serviceAccountName: habitcraft-backend
      containers:
        - name: backend
          image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-backend:latest
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
                  name: db-credentials
                  key: host
            - name: DB_PORT
              value: "5432"
            - name: DB_NAME
              value: "habitcraft"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: secret
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
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
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: backend
```

### Backend Service

```yaml
# k8s/backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: habitcraft
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
      protocol: TCP
```

### Frontend Deployment

```yaml
# k8s/frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: habitcraft
  labels:
    app: frontend
spec:
  replicas: 2
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
          image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/habitcraft-frontend:latest
          ports:
            - containerPort: 3100
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "https://habitcraft.example.com/api/v1"
          resources:
            requests:
              cpu: 200m
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
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: frontend
```

### Frontend Service

```yaml
# k8s/frontend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: habitcraft
spec:
  type: ClusterIP
  selector:
    app: frontend
  ports:
    - port: 3100
      targetPort: 3100
      protocol: TCP
```

### Ingress (ALB)

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: habitcraft-ingress
  namespace: habitcraft
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:<account>:certificate/<cert-id>
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS13-1-2-2021-06
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "15"
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: "5"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"
spec:
  rules:
    - host: habitcraft.example.com
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

### Horizontal Pod Autoscaler

```yaml
# k8s/backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: habitcraft
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
---
# k8s/frontend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: habitcraft
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Secrets (External Secrets Operator)

```yaml
# k8s/secrets/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: habitcraft
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials
  data:
    - secretKey: host
      remoteRef:
        key: habitcraft/db-credentials
        property: host
    - secretKey: username
      remoteRef:
        key: habitcraft/db-credentials
        property: username
    - secretKey: password
      remoteRef:
        key: habitcraft/db-credentials
        property: password
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: jwt-secret
  namespace: habitcraft
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: jwt-secret
  data:
    - secretKey: secret
      remoteRef:
        key: habitcraft/jwt-secret
        property: secret
```

---

## Cost Estimates

### EKS Architecture (Monthly)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| EKS Control Plane | 1 cluster | $73 |
| EC2 (Node Group) | 3× t3.medium On-Demand | ~$100 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$65 |
| ALB | 1 ALB + LCUs | ~$25 |
| CloudFront | 100GB transfer + 10M requests | ~$15 |
| NAT Gateway | 2× (hourly + data) | ~$65 |
| ECR | 10GB images | ~$1 |
| Secrets Manager | 3 secrets | ~$1.50 |
| Route 53 | 1 hosted zone | ~$0.50 |
| CloudWatch | Logs + Metrics | ~$20 |
| **Total** | | **~$365/month** |

### Cost Optimization

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Spot Instances | ~70% on EC2 | Use Karpenter with spot |
| Reserved Instances | ~30% on EC2 | 1-year commitment |
| Savings Plans | ~20% compute | Flexible commitment |
| Single NAT Gateway | ~$32/month | Non-prod only |
| Graviton (ARM) | ~20% on EC2 | Use t4g instances |

---

## Implementation Guide

### Prerequisites

```bash
# Install tools
brew install awscli kubectl eksctl helm terraform

# Configure AWS
aws configure
aws sts get-caller-identity
```

### Step 1: Create EKS Cluster

```bash
# Using eksctl
eksctl create cluster \
  --name habitcraft-cluster \
  --version 1.29 \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed \
  --with-oidc \
  --alb-ingress-access \
  --external-dns-access

# Update kubeconfig
aws eks update-kubeconfig --name habitcraft-cluster --region us-east-1
```

### Step 2: Install AWS Load Balancer Controller

```bash
# Create IAM policy
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=habitcraft-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::<account-id>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=habitcraft-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Step 3: Create RDS Database

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name habitcraft-db-subnets \
  --db-subnet-group-description "Subnets for HabitCraft RDS" \
  --subnet-ids subnet-xxx subnet-yyy

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier habitcraft-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 14 \
  --master-username habituser \
  --master-user-password <strong-password> \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --db-subnet-group-name habitcraft-db-subnets \
  --vpc-security-group-ids sg-xxx \
  --db-name habitcraft \
  --backup-retention-period 7 \
  --storage-encrypted
```

### Step 4: Create Secrets in AWS Secrets Manager

```bash
# JWT Secret
aws secretsmanager create-secret \
  --name habitcraft/jwt-secret \
  --secret-string '{"secret":"'$(openssl rand -base64 64)'"}'

# Database credentials
aws secretsmanager create-secret \
  --name habitcraft/db-credentials \
  --secret-string '{"host":"habitcraft-db.xxx.us-east-1.rds.amazonaws.com","username":"habituser","password":"<password>"}'
```

### Step 5: Build and Push Container Images

```bash
# Create ECR repositories
aws ecr create-repository --repository-name habitcraft-frontend
aws ecr create-repository --repository-name habitcraft-backend

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

### Step 6: Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace

# Apply secrets
kubectl apply -f k8s/secrets/

# Deploy applications
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml

# Verify deployment
kubectl get pods -n habitcraft
kubectl get ingress -n habitcraft
```

### Step 7: Run Database Migrations

```bash
# Port-forward to RDS or use a bastion/jump host
kubectl run psql-client --rm -it --image=postgres:14 -- \
  psql "postgresql://habituser:<password>@habitcraft-db.xxx.rds.amazonaws.com:5432/habitcraft" \
  -f /path/to/init.sql
```

### Step 8: Configure CloudFront

```bash
# Create CloudFront distribution pointing to ALB
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

---

## GitOps with ArgoCD (Optional)

```yaml
# argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: habitcraft
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/habitcraft-k8s
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: habitcraft
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## Monitoring & Observability

### Prometheus + Grafana Stack

```bash
# Install kube-prometheus-stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace
```

### Key Metrics

| Component | Metrics |
|-----------|---------|
| Pods | CPU, Memory, Restarts |
| Services | Request rate, Latency, Error rate |
| Ingress | Request count, 4xx/5xx errors |
| RDS | Connections, CPU, Storage |

### Alerts

```yaml
# alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: habitcraft-alerts
  namespace: habitcraft
spec:
  groups:
    - name: habitcraft
      rules:
        - alert: HighErrorRate
          expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: High error rate detected

        - alert: PodCrashLooping
          expr: increase(kube_pod_container_status_restarts_total{namespace="habitcraft"}[1h]) > 3
          for: 5m
          labels:
            severity: warning
```

---

## Security Checklist

- [ ] Enable EKS cluster encryption (secrets at rest)
- [ ] Configure Pod Security Standards (restricted)
- [ ] Use AWS WAF with ALB
- [ ] Enable VPC Flow Logs
- [ ] Configure Network Policies
- [ ] Enable RDS encryption at rest
- [ ] Use IRSA for pod IAM permissions
- [ ] Enable CloudTrail for audit logging
- [ ] Scan container images with ECR scanning
- [ ] Rotate secrets automatically

---

## Disaster Recovery

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Database | 1 hour | 5 minutes | Multi-AZ + PITR |
| Application | 5 minutes | 0 | Multi-AZ pods |
| Cluster | 4 hours | 0 | Infrastructure as Code |

### Backup Commands

```bash
# Manual RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier habitcraft-db \
  --db-snapshot-identifier habitcraft-$(date +%Y%m%d)

# Export Kubernetes resources
kubectl get all -n habitcraft -o yaml > backup-$(date +%Y%m%d).yaml
```
