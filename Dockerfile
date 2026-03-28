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
RUN apk add --no-cache python3 make g++ curl \
    && npm install --no-save better-sqlite3 \
    || true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Copy built server + client from builder
COPY --from=builder /app/dist ./dist

# Copy the initialized (empty) database as a template
COPY --from=builder /app/data.db /app/data.db.template

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check using node (always available in this image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/stats').then(r=>{if(!r.ok)throw r.status;process.exit(0)}).catch(()=>process.exit(1))"

CMD ["/app/entrypoint.sh"]
