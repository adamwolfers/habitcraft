# Plan: Migrate Backend to EC2 with Terraform

**Status:** Pending
**Branch:** `feature/ec2-terraform`
**Created:** 2026-01-03

## Summary

Migrate the backend from AWS Lightsail Container Service to EC2 instances managed by Terraform. This provides:

1. **Infrastructure as Code** - Version-controlled, reproducible infrastructure
2. **Greater flexibility** - Custom instance types, networking, and scaling configurations
3. **Cost optimization** - Reserved instances, spot instances, and right-sizing options
4. **Consistency** - Same Terraform patterns can manage RDS, networking, and future services

**Estimated monthly cost:** ~$53/mo (vs ~$27/mo current) — premium for IaC flexibility and standard AWS services.

---

## Architecture Overview

### Current State (Lightsail)

```
Users (HTTPS)
    │
    ├─→ www.habitcraft.org (CNAME) → Lightsail Frontend Container
    │
    └─→ api.habitcraft.org (CNAME) → Lightsail Backend Container → RDS PostgreSQL
```

### Target State (EC2 + Terraform)

```
Users (HTTPS)
    │
    ├─→ www.habitcraft.org → Route53 → ALB ─┬─→ EC2 (Frontend)  ─┐
    │                                        │                    │ Public Subnets
    └─→ api.habitcraft.org → Route53 → ALB ─┴─→ EC2 (Backend) ───┤ (no NAT Gateway)
                                                     │            │
                                                     ▼            │
                                              RDS PostgreSQL ─────┘ Private Subnets
```

*EC2 instances have public IPs but security groups only allow traffic from ALB.*

### Component Mapping

| Current (Lightsail) | Target (EC2/Terraform) |
|---------------------|------------------------|
| Lightsail Container Service | EC2 + Docker or ECS on EC2 |
| Lightsail built-in LB | Application Load Balancer (ALB) |
| Lightsail VPC peering | VPC with public subnets (no NAT Gateway) |
| Lightsail SSL certs | AWS Certificate Manager (ACM) |
| IONOS DNS | Route53 (optional) or keep IONOS |
| Manual scaling | Auto Scaling Groups (optional) |
| $7/mo Nano container | t3.micro/t3.small EC2 |

---

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| IaC Tool | Terraform | Industry standard, excellent AWS provider, state management |
| Container Runtime | Docker on EC2 | Simple, matches current setup, no additional orchestration complexity |
| Load Balancer | ALB | Layer 7, path-based routing, native ACM integration |
| SSL/TLS | ACM | Free, auto-renewal, ALB integration |
| Compute | t3.micro or t3.small | Burstable, cost-effective for low-traffic |
| AMI | Amazon Linux 2023 | Official AWS support, security updates |
| DNS | Route53 (recommended) | Native AWS integration, or keep IONOS |

### Alternative: ECS on EC2 vs Plain Docker

**Plain Docker on EC2 (Recommended for MVP):**
- Simpler setup, fewer moving parts
- Easier debugging (SSH directly to instance)
- Lower learning curve

**ECS on EC2 (Future consideration):**
- Better container orchestration
- Rolling deployments built-in
- Service discovery
- More complex setup

---

## Part 1: Terraform Project Structure

### Directory Layout

```
infrastructure/
├── terraform/
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── terraform.tfvars
│   │   └── prod/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       └── terraform.tfvars
│   ├── modules/
│   │   ├── networking/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── compute/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── alb/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── rds/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── ecr/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   └── shared/
│       └── backend.tf          # S3 backend configuration
```

### Step 1: Create Terraform Backend (S3 + DynamoDB)

**File:** `infrastructure/terraform/shared/backend.tf`

```hcl
# Run this once manually to bootstrap the backend
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "habitcraft-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "habitcraft-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

- [ ] Create S3 bucket for Terraform state
- [ ] Create DynamoDB table for state locking
- [ ] Enable versioning and encryption on S3 bucket

---

## Part 2: Networking Module (No NAT Gateway)

This architecture places EC2 instances in **public subnets** to avoid NAT Gateway costs (~$32/mo savings). Security is maintained through strict security group rules that only allow ingress from the ALB.

### Step 1: VPC and Subnets

**File:** `infrastructure/terraform/modules/networking/main.tf`

```hcl
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project}-vpc"
    Environment = var.environment
  }
}

# Public subnets (for ALB and EC2 instances)
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project}-public-${var.availability_zones[count.index]}"
  }
}

# Private subnets (for RDS only - no internet access needed)
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project}-private-${var.availability_zones[count.index]}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project}-igw"
  }
}

# Public route table (for ALB and EC2)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project}-public-rt"
  }
}

# Private route table (for RDS - no internet route)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # No default route - RDS doesn't need internet access

  tags = {
    Name = "${var.project}-private-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

- [ ] Define VPC with public subnets (for ALB + EC2) and private subnets (for RDS)
- [ ] Create Internet Gateway for public subnets
- [ ] Configure route tables (no NAT Gateway needed)

---

## Part 3: Security Groups

### Step 1: Define Security Groups

**File:** `infrastructure/terraform/modules/networking/security_groups.tf`

```hcl
# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP for redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-alb-sg"
  }
}

# Backend EC2 Security Group
resource "aws_security_group" "backend" {
  name        = "${var.project}-backend-sg"
  description = "Security group for backend EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH from bastion (optional)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-backend-sg"
  }
}

# Frontend EC2 Security Group
resource "aws_security_group" "frontend" {
  name        = "${var.project}-frontend-sg"
  description = "Security group for frontend EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 3100
    to_port         = 3100
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH from bastion (optional)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-frontend-sg"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from backend"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  tags = {
    Name = "${var.project}-rds-sg"
  }
}
```

- [ ] Create ALB security group (443, 80 ingress)
- [ ] Create backend security group (3000 from ALB only)
- [ ] Create frontend security group (3100 from ALB only)
- [ ] Create RDS security group (5432 from backend only)

---

## Part 4: ECR Repository

### Step 1: Create ECR Repositories

**File:** `infrastructure/terraform/modules/ecr/main.tf`

```hcl
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project}-backend"
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project}-frontend"
    Environment = var.environment
  }
}

# Lifecycle policy to clean up old images
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}
```

- [ ] Create ECR repository for backend images
- [ ] Create ECR repository for frontend images
- [ ] Configure lifecycle policies to manage storage

---

## Part 5: Application Load Balancer

### Step 1: ALB with Target Groups

**File:** `infrastructure/terraform/modules/alb/main.tf`

```hcl
resource "aws_lb" "main" {
  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod"

  tags = {
    Name        = "${var.project}-alb"
    Environment = var.environment
  }
}

# Backend target group
resource "aws_lb_target_group" "backend" {
  name     = "${var.project}-backend-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project}-backend-tg"
  }
}

# Frontend target group
resource "aws_lb_target_group" "frontend" {
  name     = "${var.project}-frontend-tg"
  port     = 3100
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project}-frontend-tg"
  }
}

# HTTPS listener (api.habitcraft.org)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener rule for API
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = ["api.habitcraft.org"]
    }
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

- [ ] Create Application Load Balancer in public subnets
- [ ] Create target groups for backend and frontend
- [ ] Configure HTTPS listener with ACM certificate
- [ ] Add listener rules for host-based routing
- [ ] Configure HTTP to HTTPS redirect

---

## Part 6: ACM Certificate

### Step 1: Request Certificate

**File:** `infrastructure/terraform/modules/alb/acm.tf`

```hcl
resource "aws_acm_certificate" "main" {
  domain_name               = "habitcraft.org"
  subject_alternative_names = ["*.habitcraft.org"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project}-cert"
    Environment = var.environment
  }
}

# If using Route53
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
```

- [ ] Request ACM certificate for habitcraft.org and *.habitcraft.org
- [ ] Validate certificate via DNS (Route53 or manual IONOS)

---

## Part 7: EC2 Compute

### Step 1: IAM Role for EC2

**File:** `infrastructure/terraform/modules/compute/iam.tf`

```hcl
resource "aws_iam_role" "ec2" {
  name = "${var.project}-ec2-role"

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

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "ecr" {
  name = "${var.project}-ecr-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project}-ec2-profile"
  role = aws_iam_role.ec2.name
}
```

### Step 2: Launch Template

**File:** `infrastructure/terraform/modules/compute/main.tf`

```hcl
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_launch_template" "backend" {
  name_prefix   = "${var.project}-backend-"
  image_id      = data.aws_ami.amazon_linux_2023.id
  instance_type = var.backend_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2.name
  }

  network_interfaces {
    associate_public_ip_address = true  # Public subnet, but SG restricts ingress to ALB only
    security_groups             = [var.backend_security_group_id]
  }

  user_data = base64encode(templatefile("${path.module}/user_data_backend.sh", {
    ecr_repo_url     = var.backend_ecr_repo_url
    aws_region       = var.aws_region
    db_host          = var.db_host
    db_port          = var.db_port
    db_name          = var.db_name
    db_user          = var.db_user
    db_password      = var.db_password
    jwt_secret       = var.jwt_secret
    frontend_url     = var.frontend_url
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.project}-backend"
      Environment = var.environment
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_launch_template" "frontend" {
  name_prefix   = "${var.project}-frontend-"
  image_id      = data.aws_ami.amazon_linux_2023.id
  instance_type = var.frontend_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2.name
  }

  network_interfaces {
    associate_public_ip_address = true  # Public subnet, but SG restricts ingress to ALB only
    security_groups             = [var.frontend_security_group_id]
  }

  user_data = base64encode(templatefile("${path.module}/user_data_frontend.sh", {
    ecr_repo_url = var.frontend_ecr_repo_url
    aws_region   = var.aws_region
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.project}-frontend"
      Environment = var.environment
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

### Step 3: User Data Scripts

**File:** `infrastructure/terraform/modules/compute/user_data_backend.sh`

```bash
#!/bin/bash
set -e

# Install Docker
dnf update -y
dnf install -y docker
systemctl start docker
systemctl enable docker

# Login to ECR
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_repo_url}

# Pull and run backend container
docker pull ${ecr_repo_url}:latest

docker run -d \
  --name habitcraft-backend \
  --restart always \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_HOST=${db_host} \
  -e DB_PORT=${db_port} \
  -e DB_NAME=${db_name} \
  -e DB_USER=${db_user} \
  -e DB_PASSWORD=${db_password} \
  -e JWT_SECRET=${jwt_secret} \
  -e FRONTEND_URL=${frontend_url} \
  ${ecr_repo_url}:latest
```

**File:** `infrastructure/terraform/modules/compute/user_data_frontend.sh`

```bash
#!/bin/bash
set -e

# Install Docker
dnf update -y
dnf install -y docker
systemctl start docker
systemctl enable docker

# Login to ECR
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_repo_url}

# Pull and run frontend container
docker pull ${ecr_repo_url}:latest

docker run -d \
  --name habitcraft-frontend \
  --restart always \
  -p 3100:3100 \
  ${ecr_repo_url}:latest
```

### Step 4: Auto Scaling Group (Optional)

```hcl
resource "aws_autoscaling_group" "backend" {
  name                = "${var.project}-backend-asg"
  desired_capacity    = 1
  max_size            = 2
  min_size            = 1
  target_group_arns   = [var.backend_target_group_arn]
  vpc_zone_identifier = var.public_subnet_ids  # Public subnets (SG restricts ingress)

  launch_template {
    id      = aws_launch_template.backend.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "${var.project}-backend"
    propagate_at_launch = true
  }
}
```

- [ ] Create IAM role for EC2 with ECR pull permissions
- [ ] Create launch templates for backend and frontend
- [ ] Write user data scripts to install Docker and run containers
- [ ] Configure Auto Scaling Groups (optional for HA)

---

## Part 8: RDS (Import Existing or Create New)

### Option A: Import Existing RDS

```hcl
# Import existing RDS instance
import {
  to = aws_db_instance.main
  id = "habitcraft-db"
}

resource "aws_db_instance" "main" {
  identifier           = "habitcraft-db"
  engine               = "postgres"
  engine_version       = "14"
  instance_class       = "db.t4g.micro"
  allocated_storage    = 20
  storage_type         = "gp3"
  db_name              = "habitcraft"
  username             = var.db_username
  password             = var.db_password

  vpc_security_group_ids = [var.rds_security_group_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  skip_final_snapshot     = false
  final_snapshot_identifier = "habitcraft-final-snapshot"

  storage_encrypted = true
  publicly_accessible = false
}
```

### Option B: Create New RDS

```hcl
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier           = "${var.project}-db"
  engine               = "postgres"
  engine_version       = "14"
  instance_class       = var.db_instance_class
  allocated_storage    = 20
  storage_type         = "gp3"

  db_name  = "habitcraft"
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [var.rds_security_group_id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period   = 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final-snapshot"

  storage_encrypted   = true
  publicly_accessible = false
  multi_az            = var.environment == "prod"

  tags = {
    Name        = "${var.project}-db"
    Environment = var.environment
  }
}
```

- [ ] Decide: import existing RDS or create new with data migration
- [ ] Create DB subnet group in private subnets
- [ ] Configure RDS with encryption and backups

---

## Part 9: Route53 (Optional)

### If Migrating DNS to Route53

```hcl
resource "aws_route53_zone" "main" {
  name = "habitcraft.org"
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.habitcraft.org"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.habitcraft.org"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

### If Keeping IONOS DNS

After ALB is created, update IONOS CNAME records to point to ALB DNS name.

- [ ] Decide: migrate to Route53 or keep IONOS
- [ ] Create DNS records pointing to ALB

---

## Part 10: Production Environment

### Step 1: Production Variables

**File:** `infrastructure/terraform/environments/prod/terraform.tfvars`

```hcl
project     = "habitcraft"
environment = "prod"
aws_region  = "us-west-2"

vpc_cidr           = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b"]

backend_instance_type  = "t3.small"
frontend_instance_type = "t3.micro"
db_instance_class      = "db.t4g.micro"

# Secrets managed via AWS Secrets Manager or environment variables
```

### Step 2: Main Configuration

**File:** `infrastructure/terraform/environments/prod/main.tf`

```hcl
terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket         = "habitcraft-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "habitcraft-terraform-locks"
    encrypt        = true
  }

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
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "networking" {
  source = "../../modules/networking"

  project            = var.project
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  ssh_allowed_cidrs  = var.ssh_allowed_cidrs
}

module "ecr" {
  source = "../../modules/ecr"

  project     = var.project
  environment = var.environment
}

module "alb" {
  source = "../../modules/alb"

  project               = var.project
  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  acm_certificate_arn   = module.alb.acm_certificate_arn
}

module "rds" {
  source = "../../modules/rds"

  project               = var.project
  environment           = var.environment
  private_subnet_ids    = module.networking.private_subnet_ids
  rds_security_group_id = module.networking.rds_security_group_id
  db_instance_class     = var.db_instance_class
  db_username           = var.db_username
  db_password           = var.db_password
}

module "compute" {
  source = "../../modules/compute"

  project                   = var.project
  environment               = var.environment
  aws_region                = var.aws_region
  public_subnet_ids         = module.networking.public_subnet_ids  # EC2 in public subnets (no NAT needed)
  backend_security_group_id = module.networking.backend_security_group_id
  frontend_security_group_id = module.networking.frontend_security_group_id
  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn
  backend_ecr_repo_url      = module.ecr.backend_repo_url
  frontend_ecr_repo_url     = module.ecr.frontend_repo_url
  backend_instance_type     = var.backend_instance_type
  frontend_instance_type    = var.frontend_instance_type

  # Database connection
  db_host     = module.rds.endpoint
  db_port     = 5432
  db_name     = "habitcraft"
  db_user     = var.db_username
  db_password = var.db_password

  # Application secrets
  jwt_secret   = var.jwt_secret
  frontend_url = "https://www.habitcraft.org"
}
```

- [ ] Create production environment configuration
- [ ] Configure S3 backend for state management
- [ ] Wire up all modules together

---

## Part 11: CI/CD Updates

### Update GitHub Actions Workflow

**File:** `.github/workflows/ci.yml` (deployment section)

```yaml
deploy-backend:
  needs: [backend-unit-tests, backend-integration-tests, frontend-unit-tests, e2e-tests]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Copy schema for migrations
      run: cp shared/database/schema.sql backends/node/

    - name: Build, tag, and push backend image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: habitcraft-backend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        cd backends/node
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

    - name: Deploy to EC2 via SSM
      run: |
        aws ssm send-command \
          --document-name "AWS-RunShellScript" \
          --targets "Key=tag:Name,Values=habitcraft-backend" \
          --parameters 'commands=["docker pull ${{ steps.login-ecr.outputs.registry }}/habitcraft-backend:latest", "docker stop habitcraft-backend || true", "docker rm habitcraft-backend || true", "docker run -d --name habitcraft-backend --restart always -p 3000:3000 -e NODE_ENV=production -e PORT=3000 -e DB_HOST=${{ secrets.DB_HOST }} -e DB_PORT=5432 -e DB_NAME=habitcraft -e DB_USER=${{ secrets.DB_USER }} -e DB_PASSWORD=${{ secrets.DB_PASSWORD }} -e JWT_SECRET=${{ secrets.JWT_SECRET }} -e FRONTEND_URL=${{ secrets.FRONTEND_URL }} ${{ steps.login-ecr.outputs.registry }}/habitcraft-backend:latest"]'
```

- [ ] Update CI/CD workflow to push to ECR
- [ ] Add SSM-based deployment commands
- [ ] Update GitHub secrets for ECR/EC2 deployment

---

## Migration Strategy

### Phase 1: Prepare (No Downtime)

1. [ ] Set up Terraform state backend (S3 + DynamoDB)
2. [ ] Create ECR repositories
3. [ ] Push current Docker images to ECR
4. [ ] Apply networking module (VPC, subnets, security groups)
5. [ ] Request and validate ACM certificate

### Phase 2: Deploy Parallel Infrastructure

1. [ ] Create ALB with target groups
2. [ ] Launch EC2 instances with containers
3. [ ] Verify health checks pass
4. [ ] Test via ALB DNS name directly

### Phase 3: Database (Choose One)

**Option A: Keep Existing RDS**
- [ ] Import RDS into Terraform state
- [ ] Update RDS security group for new backend SG
- [ ] Verify connectivity from EC2

**Option B: Create New RDS + Migrate Data**
- [ ] Create new RDS via Terraform
- [ ] Use `pg_dump`/`pg_restore` for data migration
- [ ] Plan brief maintenance window

### Phase 4: DNS Cutover (Brief Downtime ~5 min)

1. [ ] Lower DNS TTL to 60 seconds (1 day before)
2. [ ] Update DNS records to point to new ALB
3. [ ] Monitor traffic shift
4. [ ] Verify application works

### Phase 5: Cleanup

1. [ ] Delete Lightsail container services
2. [ ] Delete Lightsail VPC peering
3. [ ] Update documentation

---

## Cost Comparison

| Component | Lightsail (Current) | EC2 (Target) |
|-----------|---------------------|--------------|
| Frontend compute | $7/mo (Nano) | ~$7.50/mo (t3.micro) |
| Backend compute | $7/mo (Nano) | ~$15/mo (t3.small) |
| Load balancer | Included | ~$16/mo (ALB) |
| RDS | $13/mo | $13/mo (same) |
| ECR storage | N/A | ~$1/mo |
| **Total** | **~$27/mo** | **~$53/mo** |

*Note: This architecture uses public subnets for EC2 instances (no NAT Gateway), saving ~$32/mo while maintaining security through strict security group rules.*

### Further Cost Optimization Options

1. **Graviton (ARM)**: t4g instances are 20% cheaper than t3 (~$4/mo savings)
2. **Reserved Instances**: 1-year no-upfront commitment saves ~30%
3. **Spot Instances**: For non-prod environments (up to 90% savings)
4. **Single EC2 instance**: Run both containers on one instance (~$7/mo savings)

---

## Security Considerations

1. **Secrets Management**
   - Store DB password, JWT secret in AWS Secrets Manager
   - Reference secrets in Terraform via data source
   - Never commit secrets to version control

2. **Network Security (Public Subnet Architecture)**
   - EC2 instances in public subnets with public IPs
   - **Security maintained via strict security groups:**
     - Backend SG: Only allows port 3000 from ALB security group
     - Frontend SG: Only allows port 3100 from ALB security group
     - No direct internet access to application ports
   - All user traffic via ALB with TLS termination
   - RDS remains in private subnets (no internet access)
   - SSH access restricted to specific CIDRs (or disabled entirely with SSM)

3. **IAM Least Privilege**
   - EC2 role only has ECR pull and SSM permissions
   - CI/CD user only has ECR push and SSM send-command
   - Separate roles for different functions

4. **Encryption**
   - RDS storage encryption enabled
   - S3 state bucket encrypted
   - TLS 1.3 on ALB

---

## Monitoring

### CloudWatch Alarms (Terraform Managed)

```hcl
resource "aws_cloudwatch_metric_alarm" "backend_cpu" {
  alarm_name          = "${var.project}-backend-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Backend CPU > 80%"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.backend.name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

- [ ] Create CloudWatch alarms for EC2 metrics
- [ ] Create alarms for ALB metrics (5xx errors, latency)
- [ ] Set up SNS topic for email notifications

---

## Rollback Plan

If issues arise during migration:

1. **DNS Rollback**: Change DNS back to Lightsail URLs
2. **Keep Lightsail Running**: Don't delete until EC2 is verified stable
3. **Database**: Keep RDS unchanged during initial migration

---

## Files to Create

| File | Purpose |
|------|---------|
| `infrastructure/terraform/shared/backend.tf` | S3/DynamoDB backend bootstrap |
| `infrastructure/terraform/modules/networking/*.tf` | VPC, subnets, security groups |
| `infrastructure/terraform/modules/ecr/*.tf` | ECR repositories |
| `infrastructure/terraform/modules/alb/*.tf` | ALB, target groups, ACM |
| `infrastructure/terraform/modules/compute/*.tf` | Launch templates, ASG |
| `infrastructure/terraform/modules/rds/*.tf` | RDS configuration |
| `infrastructure/terraform/environments/prod/*.tf` | Production environment |
| `.github/workflows/ci.yml` | Updated CI/CD for ECR/EC2 |

---

## Files to Modify

| File | Changes |
|------|---------|
| `docs/AWS_ARCHITECTURE.md` | Update architecture docs |
| `.github/workflows/ci.yml` | Replace Lightsail deploy with ECR/EC2 |
| `infrastructure/iam-policies/*.json` | Add ECR and SSM permissions |

---

## Testing Checklist

- [ ] Terraform plan shows expected resources
- [ ] ECR push succeeds from CI/CD
- [ ] EC2 instances pull images successfully
- [ ] Health checks pass on ALB
- [ ] Backend can connect to RDS
- [ ] Frontend can reach backend API
- [ ] SSL certificate valid and working
- [ ] DNS resolves correctly
- [ ] Existing user sessions work (JWT compatibility)
- [ ] New registrations work
- [ ] Habit CRUD operations work
- [ ] E2E tests pass against new infrastructure
