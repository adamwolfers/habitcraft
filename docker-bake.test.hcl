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
  targets = ["backend-node-test", "frontend-nextjs-test"]
}

target "backend-node-test" {
  context = "."
  dockerfile = "./backends/node/Dockerfile.dev"
  tags = ["habitcraft-backend-node-test:latest"]
}

target "frontend-nextjs-test" {
  context = "."
  dockerfile = "./frontends/nextjs/Dockerfile.dev"
  tags = ["habitcraft-frontend-nextjs-test:latest"]
}
