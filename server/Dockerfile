# Go server Dockerfile
# A static binary on alpine, with the web app (web/) embedded beside the API.
# docker-compose.test.yml runs it as server-test, the Go target of the
# acceptance suite (habitcraft-8ml9). The build context is the repo root, for
# web/; Dockerfile.dockerignore beside this file keeps it to server/ and web/.
# The spec is embedded in internal/api/api.gen.go and the migrations in package schema,
# so nothing else is needed.
#
# --target migrate builds the same binary without the web app, to run
# "habitcraft migrate": both compose files' migrate services use it, so they
# skip the Node stage. It carries psql too, for the test stack's fixtures.

FROM node:24-alpine AS web

WORKDIR /src/web

# Dependencies first, so a code change does not reinstall them
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
# Writes the bundle into ../server/cmd/habitcraft/spa/dist (vite.config.ts)
RUN npm run build

FROM golang:1.25-alpine AS source

WORKDIR /src

# Modules first, so a code change does not re-download them
COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./

# The API alone, for the migrate target
FROM source AS build-api
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -o /out/habitcraft ./cmd/habitcraft

FROM alpine:3.22 AS migrate
RUN apk add --no-cache postgresql-client
COPY --from=build-api /out/habitcraft /usr/local/bin/habitcraft
USER nobody
ENTRYPOINT ["habitcraft", "migrate"]

# The default target, last, so a build without --target still gets it
FROM source AS build
COPY --from=web /src/server/cmd/habitcraft/spa/dist ./cmd/habitcraft/spa/dist
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
