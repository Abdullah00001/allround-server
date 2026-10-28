# AI Agent Architecture Map

This document provides a concise, high-level map of the ALUA Academy Management architecture tailored specifically for AI context ingestion.

## Repository Structure

```text
Repository
 ├── server                # Express.js REST API and Socket.IO handler
 ├── worker                # BullMQ consumer daemon (Emails, FCM, heavy jobs)
 ├── scheduler             # Node-cron daemon (Job producer only)
 ├── prisma                # Database schema and historical migrations
 ├── docker                # Local and production Docker Compose definitions
 ├── scripts               # Root automation and Prisma synchronization scripts
 ├── infrastructure        # Permanent Infrastructure-as-Code
 │    ├── terraform        # DigitalOcean resources (VPC, Spaces, Managed DBs)
 │    └── ansible          # Ubuntu Droplet provisioning and Nginx/Docker setup
 ├── .github/workflows     # CI/CD (GitHub Actions)
 └── docs                  # Comprehensive human documentation
```

## Data Flow & Operations

### Request Flow
**Internet** → **Nginx** (Reverse Proxy / TLS Termination) → **server** (Express/Node.js) → **PostgreSQL** (Managed) / **Valkey** (Redis cache).

### Background Flow
**server** / **scheduler** (Producers) → Enqueue jobs into **Valkey** (BullMQ backend) → **worker** (Consumer process).

### Database Flow
**Prisma** (`schema.prisma`) → Applies schema via `db-migrator` container → **PostgreSQL** (with PostGIS extensions).

### Deployment Lifecycle
1. **Git tag** (e.g., `v1.0.14`) pushed to GitHub.
2. **GitHub Actions** builds immutable Docker images.
3. Images pushed to **DOCR** (DigitalOcean Container Registry).
4. GitHub runner injects dynamic ephemeral IP into **DO Cloud Firewall** (TCP 22).
5. GitHub runner SSHs into **Droplet**.
6. Droplet pulls `IMAGE_TAG` and executes **Docker Compose**.
7. Ephemeral IP is revoked.

## Infrastructure Ownership

- **Permanent Cloud Infra**: Owned completely by `Terraform`.
- **Server Provisioning**: Owned completely by `Ansible`.
- **Application Deployment**: Owned completely by `GitHub Actions` and `Docker Compose`.
- **Database Schema**: Owned completely by `Prisma`.
