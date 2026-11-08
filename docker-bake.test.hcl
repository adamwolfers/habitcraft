# Docker Buildx Bake configuration for test environment
# Enables GitHub Actions cache for faster CI builds
#
# Usage in CI (with GHA cache):
#   docker buildx bake -f docker-compose.test.yml -f docker-bake.test.hcl \
#     --set *.cache-from=type=gha --set *.cache-to=type=gha,mode=max --load
#
# Usage locally (no GHA cache):
#   docker buildx bake -f docker-compose.test.yml -f docker-bake.test.hcl --load

group "default" {
  targets = ["db-migrate-test", "backend-test", "server-test", "frontend-test"]
}

# The server image's API-only target, which runs "habitcraft migrate"
target "db-migrate-test" {
  context = "."
  dockerfile = "./server/Dockerfile"
  target = "migrate"
  tags = ["habitcraft-db-migrate-test:latest"]
}

target "backend-test" {
  context = "."
  dockerfile = "./backend/Dockerfile.dev"
  tags = ["habitcraft-backend-test:latest"]
}

target "server-test" {
  context = "."
  dockerfile = "./server/Dockerfile"
  tags = ["habitcraft-server-test:latest"]
}

target "frontend-test" {
  context = "."
  dockerfile = "./frontend/Dockerfile.dev"
  tags = ["habitcraft-frontend-test:latest"]
}
