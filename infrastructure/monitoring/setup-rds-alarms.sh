#!/bin/bash
# Setup CloudWatch alarms for RDS PostgreSQL database
# Usage: ./setup-rds-alarms.sh
# Requires: SNS_TOPIC_ARN environment variable

set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
DB_INSTANCE="${RDS_INSTANCE_ID:-habitcraft-db}"

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

log_info "Setting up RDS alarms in region: $REGION"
log_info "DB Instance: $DB_INSTANCE"
log_info "SNS Topic: $SNS_TOPIC_ARN"

# Function to create or update an alarm
create_alarm() {
    local alarm_name="$1"
    local metric_name="$2"
    local threshold="$3"
    local comparison="$4"
    local period="$5"
    local eval_periods="$6"
    local description="$7"
    local statistic="${8:-Average}"

    log_info "Creating alarm: $alarm_name"

    aws cloudwatch put-metric-alarm \
        --alarm-name "$alarm_name" \
        --alarm-description "$description" \
        --namespace "AWS/RDS" \
        --metric-name "$metric_name" \
        --dimensions "Name=DBInstanceIdentifier,Value=$DB_INSTANCE" \
        --statistic "$statistic" \
        --period "$period" \
        --threshold "$threshold" \
        --comparison-operator "$comparison" \
        --evaluation-periods "$eval_periods" \
        --alarm-actions "$SNS_TOPIC_ARN" \
        --ok-actions "$SNS_TOPIC_ARN" \
        --region "$REGION"
}

echo ""
log_info "=== RDS Database Alarms ==="

# CPU High
create_alarm \
    "habitcraft-db-cpu-high" \
    "CPUUtilization" \
    80 \
    "GreaterThanThreshold" \
    300 \
    2 \
    "Database CPU > 80% for 10 minutes"

# Database Connections High
# db.t4g.micro has max_connections ~ 112
create_alarm \
    "habitcraft-db-connections-high" \
    "DatabaseConnections" \
    80 \
    "GreaterThanThreshold" \
    300 \
    2 \
    "Database connections > 80 for 10 minutes (near max for t4g.micro)"

# Free Storage Low (less than 2GB)
# Storage is in bytes: 2GB = 2147483648 bytes
create_alarm \
    "habitcraft-db-storage-low" \
    "FreeStorageSpace" \
    2147483648 \
    "LessThanThreshold" \
    300 \
    1 \
    "Database free storage < 2GB"

# Read Latency High (> 20ms = 0.02 seconds)
create_alarm \
    "habitcraft-db-read-latency-high" \
    "ReadLatency" \
    0.02 \
    "GreaterThanThreshold" \
    300 \
    3 \
    "Database read latency > 20ms for 15 minutes"

# Write Latency High (> 20ms = 0.02 seconds)
create_alarm \
    "habitcraft-db-write-latency-high" \
    "WriteLatency" \
    0.02 \
    "GreaterThanThreshold" \
    300 \
    3 \
    "Database write latency > 20ms for 15 minutes"

echo ""
log_info "RDS alarms created successfully!"
log_info "View alarms: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
