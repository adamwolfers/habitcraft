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
  targets = ["backend-test", "frontend-test"]
}

target "backend-test" {
  context = "."
  dockerfile = "./backend/Dockerfile.dev"
  tags = ["habitcraft-backend-test:latest"]
}

target "frontend-test" {
  context = "."
  dockerfile = "./frontend/Dockerfile.dev"
  tags = ["habitcraft-frontend-test:latest"]
}
