#!/bin/bash
# Setup CloudWatch alarms for Lightsail container services
# Usage: ./setup-lightsail-alarms.sh
# Requires: SNS_TOPIC_ARN environment variable

set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
BACKEND_SERVICE="habitcraft-backend"
FRONTEND_SERVICE="habitcraft-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for SNS topic ARN
if [ -z "${SNS_TOPIC_ARN:-}" ]; then
    log_error "SNS_TOPIC_ARN environment variable is required"
    log_error "Run setup-sns.sh first and export the topic ARN"
    exit 1
fi

log_info "Setting up Lightsail alarms in region: $REGION"
log_info "SNS Topic: $SNS_TOPIC_ARN"

# Function to create or update an alarm
create_alarm() {
    local alarm_name="$1"
    local service_name="$2"
    local metric_name="$3"
    local threshold="$4"
    local comparison="$5"
    local period="$6"
    local eval_periods="$7"
    local description="$8"

    log_info "Creating alarm: $alarm_name"

    aws cloudwatch put-metric-alarm \
        --alarm-name "$alarm_name" \
        --alarm-description "$description" \
        --namespace "AWS/Lightsail" \
        --metric-name "$metric_name" \
        --dimensions "Name=ContainerServiceName,Value=$service_name" \
        --statistic Average \
        --period "$period" \
        --threshold "$threshold" \
        --comparison-operator "$comparison" \
        --evaluation-periods "$eval_periods" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --ok-actions "$SNS_TOPIC_ARN" \
        --region "$REGION"
}

echo ""
log_info "=== Backend Service Alarms ==="

# Backend CPU High (immediate alert)
create_alarm \
    "habitcraft-backend-cpu-high" \
    "$BACKEND_SERVICE" \
    "CPUUtilization" \
    80 \
    "GreaterThanThreshold" \
    300 \
    2 \
    "Backend CPU > 80% for 10 minutes"

# Backend CPU Sustained (warning for prolonged high usage)
create_alarm \
    "habitcraft-backend-cpu-sustained" \
    "$BACKEND_SERVICE" \
    "CPUUtilization" \
    60 \
    "GreaterThanThreshold" \
    300 \
    6 \
    "Backend CPU > 60% for 30 minutes (sustained load)"

echo ""
log_info "=== Frontend Service Alarms ==="

# Frontend CPU High
create_alarm \
    "habitcraft-frontend-cpu-high" \
    "$FRONTEND_SERVICE" \
    "CPUUtilization" \
    80 \
    "GreaterThanThreshold" \
    300 \
    2 \
    "Frontend CPU > 80% for 10 minutes"

echo ""
log_info "Lightsail alarms created successfully!"
log_info "View alarms: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
