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

# better-sqlite3 needs native compilation
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy built server + client from builder
COPY --from=builder /app/dist ./dist

# Copy the initialized (empty) database as a template
# At runtime, if no data.db exists, the entrypoint copies this in
COPY --from=builder /app/data.db /app/data.db.template

# Entrypoint: use template DB on first run, then start server
RUN printf '#!/bin/sh\n\
if [ ! -f data.db ]; then\n\
  echo "Initializing database from template..."\n\
  cp data.db.template data.db\n\
fi\n\
exec node dist/index.cjs\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["/app/entrypoint.sh"]
