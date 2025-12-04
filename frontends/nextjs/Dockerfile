# Next.js Frontend Dockerfile (Production)
# For development, use docker-compose which overrides CMD with 'npm run dev'

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL (required for NEXT_PUBLIC_* vars)
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100

# Copy standalone build output
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3100/ || exit 1

CMD ["node", "server.js"]
