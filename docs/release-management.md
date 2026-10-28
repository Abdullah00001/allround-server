# Release Management & Versioning

This document outlines the authoritative release management and versioning workflow for the ALUA Academy Management backend.

## 1. Versioning Strategy

ALUA Academy Management adheres to **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH` (e.g., `v1.0.14`).

- **MAJOR**: Breaking changes to the API schema or significant infrastructural redesigns.
- **MINOR**: New, backward-compatible features and functionality.
- **PATCH**: Backward-compatible bug fixes and maintenance.

## 2. The Source of Truth

> [!IMPORTANT]
> The **Git Tag** (e.g., `v1.0.14`) is the absolute source of truth for deployments. 

While the root `package.json` contains a `version` field, it is currently a **manually managed metadata field**. The `package.json` version does **not** automatically trigger deployments, nor does it control the Docker image tag.

The GitHub Actions CI/CD pipeline purely relies on the pushed Git tag (`github.ref_name`) to label Docker images and deploy them to production.

## 3. The Recommended Release Workflow

Creating a release requires manually synchronizing the `package.json` version and the Git tag. Follow these exact steps to deploy a new version to production:

1. **Finish Feature/Change**: Ensure all PRs are merged into `main` and the code is stable.
2. **Validate Locally**: Run all tests, linting, and local Docker Compose builds to verify stability.
3. **Update `package.json`**: Manually edit the `version` field in the root `package.json` to the target Semantic Version (e.g., `1.0.15`).
4. **Update `package-lock.json`**: Run `npm install` locally to ensure the lockfile reflects the new package version.
5. **Commit the Bump**: Commit the version change to `main`.
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: release v1.0.15"
   ```
6. **Create the Git Tag**: Create an annotated tag matching the version precisely.
   ```bash
   git tag v1.0.15
   ```
7. **Push to Origin**: Push the commit and the tag to GitHub.
   ```bash
   git push origin main
   git push origin v1.0.15
   ```
8. **GitHub Actions Takes Over**: The push of `v*` will trigger the CD pipeline.
9. **Docker Build & Push**: The pipeline builds immutable Docker images (`alua-academy-management-server`, `worker`, `scheduler`) using the exact code at that Git tag. The images are pushed to DigitalOcean Container Registry (DOCR) tagged with the exact version (e.g., `v1.0.15`).
10. **Deployment**: The pipeline SSHs into the production Droplet, updates the `IMAGE_TAG=v1.0.15` environment variable, and restarts the containers.
11. **Verify Production**: Verify that the production `/health` endpoint is healthy and returning correctly.

## 4. Rollback Procedures

Because the deployment relies entirely on **immutable release tags**, rolling back an application update is safe and deterministic.

If `v1.0.15` causes a critical production bug, you can instantly rollback to `v1.0.14`.

### Rollback Process
1. SSH into the production Droplet.
2. Navigate to `/opt/alua-academy-management-server`.
3. Manually override the environment variable:
   ```bash
   export IMAGE_TAG=v1.0.14
   docker compose pull
   docker compose up -d
   ```
4. The previous immutable images will be pulled and instantiated immediately.

### ⚠️ Critical Prisma Limitation
> [!WARNING]
> Prisma database migrations are **forward-only**.
> 
> Rolling back the application Docker images (`IMAGE_TAG`) will **NOT** rollback the database schema. If `v1.0.15` included a destructive database migration (e.g., dropping a column), the older `v1.0.14` application will crash attempting to query the missing column. 
> 
> **Rule of Thumb**: Always make database migrations forward-compatible (e.g., adding nullable columns, avoiding strict renames) to guarantee safe application rollbacks.
