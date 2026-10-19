# Go server Dockerfile
# A static binary on alpine. docker-compose.test.yml runs it as server-test,
# the Go target of the acceptance suite (habitcraft-8ml9). The build context is
# server/ alone: the spec is embedded in api/api.gen.go, so nothing outside it
# is needed.

FROM golang:1.25-alpine AS build

WORKDIR /src

# Modules first, so a code change does not re-download them
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# The build cache persists across builds, so scripts/test-all.sh can rebuild
# this image on every run without paying for a cold compile
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -o /out/habitcraft ./cmd/habitcraft

FROM alpine:3.22

COPY --from=build /out/habitcraft /usr/local/bin/habitcraft

USER nobody
EXPOSE 8080

# Health check using /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["habitcraft"]
