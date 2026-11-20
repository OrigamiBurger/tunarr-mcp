# tunarr-mcp — multi-stage production image
# Build:  docker build -t tunarr-mcp .
# Run:    docker run -e TUNARR_URL=http://tunarr:8409 -p 3001:3001 tunarr-mcp

# ── Build stage: full toolchain, compiles TS to dist/ ─────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# pnpm via corepack (package.json devEngines requires pnpm ^11.22.0).
RUN corepack enable

# Install dependencies first (layer cache: lockfile unchanged -> no reinstall).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build from source. devEngines makes npx fail with EBADDEVENGINES, so use the
# locally installed compiler.
COPY tsconfig.json ./
COPY src ./src
RUN node_modules/.bin/tsc

# Strip dev dependencies for the runtime stage.
RUN pnpm prune --prod

# ── Runtime stage: minimal image, non-root, no build tooling ─────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S tunarr && adduser -S -G tunarr tunarr

# Only the built output, prod node_modules, and the manifest — never
# src/, tests/, plans/, or the lockfile.
COPY --from=build --chown=tunarr:tunarr /app/dist ./dist
COPY --from=build --chown=tunarr:tunarr /app/node_modules ./node_modules
COPY --from=build --chown=tunarr:tunarr /app/package.json ./package.json

USER tunarr
EXPOSE 3001

# Docker healthcheck against the server's /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/http.js"]
