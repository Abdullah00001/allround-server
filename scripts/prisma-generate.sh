#!/bin/bash

# Generate the local Prisma client
npx prisma generate "$@"

# ---------------------------------------------------------
# Monorepo IDE Fix:
# Copy the generated Prisma client into each service's 
# node_modules so that VS Code and TypeScript can find 
# the exported types (User, AccountStatus, etc) instead 
# of looking at the empty stubs.
# ---------------------------------------------------------

echo "Copying generated Prisma client to microservices for IDE support..."

# Server
mkdir -p server/node_modules
cp -r node_modules/.prisma server/node_modules/ 2>/dev/null || true
cp -r node_modules/@prisma server/node_modules/ 2>/dev/null || true

# Worker
mkdir -p worker/node_modules
cp -r node_modules/.prisma worker/node_modules/ 2>/dev/null || true
cp -r node_modules/@prisma worker/node_modules/ 2>/dev/null || true

# Scheduler
mkdir -p scheduler/node_modules
cp -r node_modules/.prisma scheduler/node_modules/ 2>/dev/null || true
cp -r node_modules/@prisma scheduler/node_modules/ 2>/dev/null || true

echo "Prisma generation complete!"
