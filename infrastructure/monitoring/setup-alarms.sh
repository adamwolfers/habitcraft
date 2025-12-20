#!/bin/bash
# Master script to set up all CloudWatch alarms for HabitCraft
# Usage: ./setup-alarms.sh <email-address>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="${AWS_REGION:-us-west-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_header() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}\n"; }

# Check for email argument
if [ $# -lt 1 ]; then
    echo "Usage: $0 <email-address>"
    echo ""
    echo "This script sets up CloudWatch alarms for HabitCraft infrastructure:"
    echo "  - SNS topic for email notifications"
    echo "  - Lightsail container alarms (CPU)"
    echo "  - RDS database alarms (CPU, connections, storage, latency)"
    echo ""
    echo "Environment variables:"
    echo "  AWS_REGION        - AWS region (default: us-west-2)"
    echo "  RDS_INSTANCE_ID   - RDS instance ID (default: habitcraft-db)"
    echo ""
    echo "Example:"
    echo "  $0 alerts@example.com"
    exit 1
fi

EMAIL="$1"

# Check AWS CLI is available
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

log_header "HabitCraft CloudWatch Alarms Setup"
log_info "Region: $REGION"
log_info "Email: $EMAIL"

# Step 1: Set up SNS topic
log_header "Step 1: Setting up SNS Topic"
"$SCRIPT_DIR/setup-sns.sh" "$EMAIL"

# Extract topic ARN
TOPIC_ARN=$(aws sns list-topics --region "$REGION" --query "Topics[?ends_with(TopicArn, ':habitcraft-alerts')].TopicArn" --output text)

if [ -z "$TOPIC_ARN" ]; then
    log_error "Failed to get SNS topic ARN"
    exit 1
fi

export SNS_TOPIC_ARN="$TOPIC_ARN"
log_info "Using SNS Topic: $SNS_TOPIC_ARN"

# Step 2: Set up Lightsail alarms
log_header "Step 2: Setting up Lightsail Alarms"
"$SCRIPT_DIR/setup-lightsail-alarms.sh"

# Step 3: Set up RDS alarms
log_header "Step 3: Setting up RDS Alarms"
"$SCRIPT_DIR/setup-rds-alarms.sh"

# Summary
log_header "Setup Complete!"

echo "Alarms created:"
echo ""
aws cloudwatch describe-alarms \
    --alarm-name-prefix "habitcraft-" \
    --region "$REGION" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' \
    --output table

echo ""
log_warn "IMPORTANT: Check your email ($EMAIL) and confirm the SNS subscription!"
echo ""
log_info "View alarms in AWS Console:"
log_info "  https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
echo ""
log_info "To test an alarm (simulate alert):"
log_info "  aws cloudwatch set-alarm-state \\"
log_info "    --alarm-name habitcraft-backend-cpu-high \\"
log_info "    --state-value ALARM \\"
log_info "    --state-reason 'Testing alarm' \\"
log_info "    --region $REGION"
