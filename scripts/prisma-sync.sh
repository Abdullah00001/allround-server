#!/bin/bash

echo "Syncing generated Prisma client to running Docker services..."

# Sync scheduler container
echo "Syncing allround-server-scheduler..."
docker exec allround-server-scheduler npx prisma generate

# Sync worker container
echo "Syncing allround-server-worker..."
docker exec allround-server-worker npx prisma generate

# Sync server container
echo "Syncing allround-server-server..."
docker exec allround-server-server npx prisma generate

echo "Prisma sync complete!"
