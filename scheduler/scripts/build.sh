#!/bin/bash
# Fail immediately if any command exits with a non-zero status
set -e

echo "⚠️ Skipping ESLint (typescript-eslint does not support TypeScript 7.0 AST yet)"

echo "🧪 Running Tests..."
npm run test

echo "🏗️ Compiling TypeScript..."
npx tsc
npx tsc-alias

echo "✅ Build successful! 🎉"
