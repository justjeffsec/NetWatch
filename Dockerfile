# ============================================
#  NetWatch Dashboard — Multi-stage Docker Build
# ============================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY script/ ./script/
COPY drizzle.config.ts tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js components.json ./

# Initialize DB schema and build production bundle
RUN npx drizzle-kit push && npm run build

# --- Stage 2: Production ---
FROM node:20-alpine AS production

WORKDIR /app

# better-sqlite3 requires native compilation tools
# curl is kept for the health check
RUN apk add --no-cache curl python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && apk del python3 make g++

# Copy built server + client from builder
COPY --from=builder /app/dist ./dist

# Copy the initialized (empty) database as a template
COPY --from=builder /app/data.db /app/data.db.template

# Create entrypoint inline to avoid Windows line-ending issues
RUN echo '#!/bin/sh' > /app/entrypoint.sh \
    && echo 'if [ ! -f data.db ]; then' >> /app/entrypoint.sh \
    && echo '  echo "Initializing database from template..."' >> /app/entrypoint.sh \
    && echo '  cp data.db.template data.db' >> /app/entrypoint.sh \
    && echo 'fi' >> /app/entrypoint.sh \
    && echo 'exec node dist/index.cjs' >> /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check using curl
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -sf http://localhost:8080/api/stats || exit 1

CMD ["/app/entrypoint.sh"]
