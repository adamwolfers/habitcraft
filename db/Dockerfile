# Database Migration Container
# Uses dbmate for language-agnostic SQL migrations
#
# Usage (local with DATABASE_URL):
#   docker build -t habitcraft-migrations ./db
#   docker run --rm -e DATABASE_URL=... habitcraft-migrations
#
# Usage (GCP with component env vars):
#   Terraform passes DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
#   entrypoint.sh constructs DATABASE_URL from these

FROM ghcr.io/amacneil/dbmate:2

# Copy migration files
COPY migrations /db/migrations

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["up"]
