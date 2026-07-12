# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install deps ------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- Stage 2: build --------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 3: runtime ------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# mongodb-database-tools (mongodump) — official binaries per arch.
# Debian 12 arm64 build isn't published, so we use the ubuntu2204 build, which
# is glibc-compatible with bookworm. We detect the host arch with `uname -m`
# because $TARGETARCH isn't set when building natively (e.g. on the Pi itself).
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tini; \
    arch="$(uname -m)"; \
    case "$arch" in \
      aarch64|arm64) pkg="mongodb-database-tools-ubuntu2204-arm64-100.10.0.deb" ;; \
      x86_64|amd64)  pkg="mongodb-database-tools-ubuntu2204-x86_64-100.10.0.deb" ;; \
      *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://fastdl.mongodb.org/tools/db/${pkg}" -o /tmp/mtools.deb; \
    apt-get install -y --no-install-recommends /tmp/mtools.deb; \
    rm -f /tmp/mtools.deb; \
    apt-get purge -y curl gnupg; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    DATA_DIR=/app/data \
    BACKUP_DIR=/app/backups

# Reuse the built-in `node` user (UID/GID 1000) and rename it to `watchy`.
# The base image already ships with node:node at 1000:1000, which matches the
# typical Pi host user for USB-mount friendly perms.
RUN groupmod -n watchy node \
    && usermod -l watchy -d /home/watchy -m node \
    && mkdir -p /app/data /app/backups \
    && chown -R watchy:watchy /app

# Copy the full app (not standalone) so the custom server.js has everything it needs.
COPY --chown=watchy:watchy --from=deps    /app/node_modules ./node_modules
COPY --chown=watchy:watchy --from=builder /app/.next        ./.next
COPY --chown=watchy:watchy --from=builder /app/public       ./public
COPY --chown=watchy:watchy --from=builder /app/package.json ./package.json
COPY --chown=watchy:watchy --from=builder /app/next.config.js ./next.config.js
COPY --chown=watchy:watchy --from=builder /app/server.js    ./server.js

USER watchy

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) +'/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
