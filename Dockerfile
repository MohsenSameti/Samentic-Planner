# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Native C++ compiler tools required by better-sqlite3
RUN apk add --no-cache python3 make g++

# Enable pnpm via Node's corepack
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all dependencies (dev + prod)
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build both backend (tsc + copy migrations) and frontend (vite build)
RUN pnpm build

# Remove development dependencies to keep the runtime image lean
RUN pnpm prune --prod

# ── Stage 2: Production Runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=6798

# Copy production dependencies and compiled artifacts
COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Persistent directory for the SQLite database
RUN mkdir -p /app/backend/data
VOLUME /app/backend/data

EXPOSE 6798

# Run from backend so relative path ../frontend/dist resolves correctly
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
