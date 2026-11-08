# Database Migration Container (production, the Node stack on Cloud Run)
# Uses dbmate to apply server/schema/migrations/. Every other environment runs
# `habitcraft migrate` instead (habitcraft-vxln.6.1); this image keeps prod on
# dbmate until cutover (habitcraft-vxln.10) retires it, so the move did not
# change prod's migration tool. Both record versions in schema_migrations.
#
# The build context is the repo root, for server/schema/; the
# Dockerfile.dockerignore beside this file keeps it to what is copied.
#
# Usage (local with DATABASE_URL):
#   docker build -t habitcraft-migrations -f db/Dockerfile .
#   docker run --rm -e DATABASE_URL=... habitcraft-migrations
#
# Usage (GCP with component env vars):
#   Terraform passes DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
#   entrypoint.sh constructs DATABASE_URL from these

FROM ghcr.io/amacneil/dbmate:2

# Copy migration files, where dbmate looks by default
COPY server/schema/migrations /db/migrations

# Copy entrypoint script
COPY db/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["up"]
