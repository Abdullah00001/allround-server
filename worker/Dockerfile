# ================================
# Stage 1: Build
# ================================
FROM node:22-bookworm-slim AS base

WORKDIR /app

# Install dumb-init and required shared libraries for Puppeteer bundled Chromium
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init procps unzip \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libcairo2 libpango-1.0-0 fonts-freefont-ttf && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer_cache

# Copy root configurations required for Prisma
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Copy the worker package and tsconfig
COPY worker/package*.json ./
COPY worker/tsconfig.json ./

# Set a dummy DATABASE_URL so prisma generate succeeds during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Install ALL dependencies (including devDependencies) for the build
# Install one managed Chrome explicitly; fail the build if it is unavailable.
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install \
    && npx puppeteer browsers install chrome \
    && node --input-type=module -e "import puppeteer from 'puppeteer'; import { accessSync, constants } from 'node:fs'; accessSync(await puppeteer.executablePath(), constants.R_OK | constants.X_OK); const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']}); await browser.close();"

# Explicitly generate prisma client before building
RUN npx prisma generate

# Copy the rest of the worker code
COPY worker/ ./

# Build the TypeScript project
RUN npm run build

# ================================
# Stage 2: Runner
# ================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init procps unzip \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libcairo2 libpango-1.0-0 fonts-freefont-ttf && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer_cache
# Set a dummy DATABASE_URL so prisma generate succeeds during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Copy necessary files from the build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/prisma.config.ts ./
COPY worker/package*.json ./

# Install ONLY production dependencies.
# Install one managed Chrome explicitly; fail the build if it is unavailable.
RUN PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=dev \
    && npx puppeteer browsers install chrome \
    && node --input-type=module -e "import puppeteer from 'puppeteer'; import { accessSync, constants } from 'node:fs'; accessSync(await puppeteer.executablePath(), constants.R_OK | constants.X_OK); const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']}); await browser.close();"

# Explicitly generate prisma client for the production image
RUN npx prisma generate

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
