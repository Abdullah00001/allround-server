# ================================
# Stage 1: Build 
# ================================
FROM node:22-alpine AS base

WORKDIR /app

# Install dumb-init for proper process management
RUN apk add --no-cache dumb-init

# Copy root configurations required for Prisma
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Copy the scheduler package and tsconfig
COPY scheduler/package*.json ./
COPY scheduler/tsconfig.json ./

# Set a dummy DATABASE_URL so prisma generate succeeds during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Install ALL dependencies (including devDependencies) for the build
RUN npm install

# Explicitly generate prisma client before building
RUN npx prisma generate

# Copy the rest of the scheduler code
COPY scheduler/ ./

# Build the TypeScript project
RUN npm run build

# ================================
# Stage 2: Runner
# ================================
FROM node:22-alpine AS runner

WORKDIR /app
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
# Set a dummy DATABASE_URL so prisma generate succeeds during build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Copy necessary files from the build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/prisma.config.ts ./
COPY scheduler/package*.json ./

# Install ONLY production dependencies. 
RUN npm install --omit=dev

# Explicitly generate prisma client for the production image
RUN npx prisma generate

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
