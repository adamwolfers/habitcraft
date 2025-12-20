#!/bin/bash
# Setup SNS topic for CloudWatch alarm notifications
# Usage: ./setup-sns.sh <email-address>

set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
TOPIC_NAME="habitcraft-alerts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for email argument
if [ $# -lt 1 ]; then
    log_error "Usage: $0 <email-address>"
    exit 1
fi

EMAIL="$1"

# Validate email format (basic check)
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
    log_error "Invalid email format: $EMAIL"
    exit 1
fi

log_info "Setting up SNS topic in region: $REGION"

# Check if topic already exists
EXISTING_TOPIC=$(aws sns list-topics --region "$REGION" --query "Topics[?ends_with(TopicArn, ':${TOPIC_NAME}')].TopicArn" --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_TOPIC" ]; then
    log_warn "SNS topic already exists: $EXISTING_TOPIC"
    TOPIC_ARN="$EXISTING_TOPIC"
else
    # Create SNS topic
    log_info "Creating SNS topic: $TOPIC_NAME"
    TOPIC_ARN=$(aws sns create-topic \
        --name "$TOPIC_NAME" \
        --region "$REGION" \
        --query 'TopicArn' \
        --output text)
    log_info "Created topic: $TOPIC_ARN"
fi

# Check if email subscription already exists
EXISTING_SUB=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$TOPIC_ARN" \
    --region "$REGION" \
    --query "Subscriptions[?Endpoint=='${EMAIL}'].SubscriptionArn" \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_SUB" ] && [ "$EXISTING_SUB" != "PendingConfirmation" ]; then
    log_warn "Email subscription already exists: $EMAIL"
else
    # Subscribe email to topic
    log_info "Subscribing email: $EMAIL"
    aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "$EMAIL" \
        --region "$REGION" \
        --output text > /dev/null

    log_warn "IMPORTANT: Check your email and confirm the subscription!"
fi

# Output the topic ARN for use in other scripts
echo ""
log_info "SNS Topic ARN: $TOPIC_ARN"
echo ""
echo "Export this for use with alarm scripts:"
echo "  export SNS_TOPIC_ARN=\"$TOPIC_ARN\""
