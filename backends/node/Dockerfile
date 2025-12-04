# Node.js Backend Dockerfile (Production)
# For development, use docker-compose which overrides CMD with 'npm run dev'

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Copy schema for migrations (copied from shared/database during build)
COPY schema.sql ./

# Make entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 3000

# Health check using /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["./entrypoint.sh"]
