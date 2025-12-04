# HabitCraft IAM Policies

AWS IAM policies for the HabitCraft application following the principle of least privilege.

## Policies

| Policy File | Purpose | Use Case |
|-------------|---------|----------|
| `habitcraft-cicd-policy.json` | CI/CD deployments | GitHub Actions automated deployments |
| `habitcraft-ops-policy.json` | Operations/Admin | Manual operations, snapshots, monitoring setup |
| `habitcraft-readonly-policy.json` | Read-only access | Dashboards, monitoring, debugging |

## Setup Instructions

### 1. Replace Account ID

Replace `${AWS_ACCOUNT_ID}` with your actual AWS account ID in all policy files:

```bash
# Get your account ID
aws sts get-caller-identity --query Account --output text

# Replace in all files (macOS/Linux)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i '' "s/\${AWS_ACCOUNT_ID}/$ACCOUNT_ID/g" *.json  # macOS
# sed -i "s/\${AWS_ACCOUNT_ID}/$ACCOUNT_ID/g" *.json   # Linux
```

### 2. Create IAM Users

```bash
aws iam create-user --user-name habitcraft-cicd
aws iam create-user --user-name habitcraft-ops
aws iam create-user --user-name habitcraft-readonly
```

### 3. Create and Attach Policies

```bash
# Create policies
aws iam create-policy \
  --policy-name HabitCraftCICD \
  --policy-document file://habitcraft-cicd-policy.json

aws iam create-policy \
  --policy-name HabitCraftOps \
  --policy-document file://habitcraft-ops-policy.json

aws iam create-policy \
  --policy-name HabitCraftReadOnly \
  --policy-document file://habitcraft-readonly-policy.json

# Attach policies (replace ACCOUNT_ID)
aws iam attach-user-policy \
  --user-name habitcraft-cicd \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/HabitCraftCICD

aws iam attach-user-policy \
  --user-name habitcraft-ops \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/HabitCraftOps

aws iam attach-user-policy \
  --user-name habitcraft-readonly \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/HabitCraftReadOnly
```

### 4. Generate Access Keys for CI/CD

```bash
aws iam create-access-key --user-name habitcraft-cicd
```

Store the output in GitHub Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Security Best Practices

- **Enable MFA** for `habitcraft-ops` user (interactive access)
- **Rotate keys** every 90 days for `habitcraft-cicd`
- **Enable CloudTrail** for auditing API calls
- **Review permissions** quarterly and remove unused access
- **Use IAM Access Analyzer** to identify unused permissions

## Policy Details

### CI/CD Policy
Minimal permissions for automated container deployments:
- Push/register container images to Lightsail
- Create container service deployments
- Read deployment status and logs

### Ops Policy
Extended permissions for manual operations:
- All CI/CD permissions
- RDS snapshot management (backup/restore)
- CloudWatch alarm management
- Log access for debugging

### Read-Only Policy
View-only access for monitoring:
- View container service status
- View RDS instance status
- Read CloudWatch metrics and alarms
- Read logs (no modification)
