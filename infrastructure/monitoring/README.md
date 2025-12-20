# HabitCraft CloudWatch Monitoring

Scripts to set up CloudWatch Alarms for HabitCraft infrastructure.

## Quick Start

```bash
cd infrastructure/monitoring

# Make scripts executable
chmod +x *.sh

# Run the master setup script
./setup-alarms.sh your-email@example.com
```

**Important:** After running, check your email and confirm the SNS subscription.

## What Gets Created

### SNS Topic
- **Topic Name:** `habitcraft-alerts`
- **Purpose:** Sends email notifications when alarms trigger

### Lightsail Container Alarms (3 alarms)

| Alarm | Metric | Threshold | Duration |
|-------|--------|-----------|----------|
| `habitcraft-backend-cpu-high` | CPU | > 80% | 10 min |
| `habitcraft-backend-cpu-sustained` | CPU | > 60% | 30 min |
| `habitcraft-frontend-cpu-high` | CPU | > 80% | 10 min |

### RDS Database Alarms (5 alarms)

| Alarm | Metric | Threshold | Duration |
|-------|--------|-----------|----------|
| `habitcraft-db-cpu-high` | CPU | > 80% | 10 min |
| `habitcraft-db-connections-high` | Connections | > 80 | 10 min |
| `habitcraft-db-storage-low` | Free Storage | < 2 GB | 5 min |
| `habitcraft-db-read-latency-high` | Read Latency | > 20 ms | 15 min |
| `habitcraft-db-write-latency-high` | Write Latency | > 20 ms | 15 min |

## Individual Scripts

Run scripts individually if needed:

```bash
# Set up SNS topic only
./setup-sns.sh your-email@example.com

# Set up Lightsail alarms (requires SNS_TOPIC_ARN)
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:habitcraft-alerts"
./setup-lightsail-alarms.sh

# Set up RDS alarms (requires SNS_TOPIC_ARN)
./setup-rds-alarms.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-west-2` | AWS region |
| `SNS_TOPIC_ARN` | (required) | SNS topic for notifications |
| `RDS_INSTANCE_ID` | `habitcraft-db` | RDS instance identifier |

## Viewing Alarms

**AWS Console:**
https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#alarmsV2:

**AWS CLI:**
```bash
# List all HabitCraft alarms
aws cloudwatch describe-alarms \
    --alarm-name-prefix "habitcraft-" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' \
    --output table

# Get alarm history
aws cloudwatch describe-alarm-history \
    --alarm-name habitcraft-backend-cpu-high \
    --history-item-type StateUpdate
```

## Testing Alarms

Manually trigger an alarm to test notifications:

```bash
aws cloudwatch set-alarm-state \
    --alarm-name habitcraft-backend-cpu-high \
    --state-value ALARM \
    --state-reason "Testing alarm notification"
```

The alarm will automatically return to OK state on the next evaluation period.

## Modifying Thresholds

Edit the threshold values in the respective scripts and re-run them. The `put-metric-alarm` command will update existing alarms.

## Deleting Alarms

```bash
# Delete all HabitCraft alarms
aws cloudwatch delete-alarms --alarm-names \
    habitcraft-backend-cpu-high \
    habitcraft-backend-cpu-sustained \
    habitcraft-frontend-cpu-high \
    habitcraft-db-cpu-high \
    habitcraft-db-connections-high \
    habitcraft-db-storage-low \
    habitcraft-db-read-latency-high \
    habitcraft-db-write-latency-high

# Delete SNS topic
aws sns delete-topic --topic-arn "$SNS_TOPIC_ARN"
```

## Cost

- **Standard alarms:** $0.10/alarm/month
- **Free tier:** 10 alarms free (perpetual)
- **This setup:** 8 alarms = **$0/month** (under free tier)

## Adding More Notifications

### Additional Email
```bash
aws sns subscribe \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint another@example.com
```

### Slack (via AWS Chatbot)
See [AWS Chatbot documentation](https://docs.aws.amazon.com/chatbot/latest/adminguide/slack-setup.html)

### PagerDuty
```bash
aws sns subscribe \
    --topic-arn "$SNS_TOPIC_ARN" \
    --protocol https \
    --notification-endpoint "https://events.pagerduty.com/integration/YOUR_KEY/enqueue"
```
