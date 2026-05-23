# syntax=docker/dockerfile:1
# ─── vision-scout · Dockerfile ──────────────────────────────────────────
# Base image ships with Chromium + Firefox + WebKit binaries pre-installed
# and Node 20 LTS. The Playwright npm version in package.json MUST match
# this image tag or the runtime will try to (re)install browsers on first
# launch and fail in a locked container.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install deps in their own layer so source-only changes don't bust cache.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Application source.
COPY . .

ENV NODE_ENV=production
# Render injects PORT at runtime · 3000 is just a sane default for
# `docker run` parity locally.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
