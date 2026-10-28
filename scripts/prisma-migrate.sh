#!/bin/bash

# Migrate the database
npx prisma migrate dev "$@"
