# Allround Server

Welcome to the **Allround Server** project! This repository contains the complete backend infrastructure and application code for the Allround platform.

This is a **Docker-centric** backend. The application relies on a multi-service architecture where separate containers handle specific responsibilities, backed by robust managed cloud infrastructure.

- **Local Development**: Strictly uses Docker Compose. Do **NOT** run the Node.js services directly on your host machine.
- **Application Services**: Runs `server`, `worker`, and `scheduler` as completely isolated containers.
- **Relational Database**: PostgreSQL (with PostGIS extensions) serves as the primary data store.
- **Caching & Queues**: Valkey (Redis) handles in-memory caching, background job queues, and WebSocket pub/sub.
- **Data Access**: Prisma ORM provides strict type-safe database queries.
- **Background Jobs**: BullMQ handles offloaded tasks like emails and push notifications.
- **Realtime**: Socket.IO handles bidirectional real-time WebSocket communication.

---

## 🚀 Start Here

The Allround Server backend is deeply documented. Please use the following map to find exactly what you need.

| I want to... | Read |
| --- | --- |
| Get started as a new developer | [Developer Workflow & Onboarding](docs/developer-workflow.md) |
| Understand the overall architecture | [System Architecture](docs/architecture.md) |
| Understand the database and Prisma | [Database Architecture](docs/database.md) |
| Understand background jobs, queues, or Redis | [Services & Integrations](docs/services.md) |
| Understand auth, roles, and security | [Security Architecture](docs/security.md) |
| Configure my `.env` variables safely | [Environment Variables](docs/environment.md) |
| Understand healthchecks and logs | [Observability & Reliability](docs/observability.md) |
| Deploy changes to production | [Production Deployment & CI/CD](docs/production-deployment.md) |
| Troubleshoot a production or local issue | [Troubleshooting Guide](docs/troubleshooting.md) |
| Create a new release version | [Release Management](docs/release-management.md) |
| Guide an AI Coding Agent | [AI Agent Guide](docs/ai-agent-guide.md) |
| Review AI Agent Constraints | [.agent/rules.md](.agent/rules.md) |

---

## 👨‍💻 New Developer? Start Here

Welcome to the team! Local development is vastly different from production deployment. Your first objective is to run the API locally on your machine.

**Your Recommended Path:**
1. Read this entire README.
2. Read the full [Developer Workflow](docs/developer-workflow.md).
3. Install required tools (Docker, Docker Compose, Node.js).
4. Configure your `.env` securely by duplicating `.env.example`.
5. Start the local stack via `docker compose up -d --build`.
6. Verify PostgreSQL and Valkey booted successfully.
7. Generate and sync your Prisma client using `npm run prisma:migrate` && `npm run prisma:sync`.
8. Verify the `server`, `worker`, and `scheduler` containers are healthy.
9. Review the [Architecture](docs/architecture.md) document to understand how requests flow.
10. Start coding!

> [!IMPORTANT]
> A new developer should **never** begin by attempting to run Terraform, executing Ansible playbooks, SSH'ing into the VPS, or manipulating GitHub Actions. Leave production infrastructure alone until you are completely familiar with the core application.

---

## 🚀 Production / DevOps

Production infrastructure is rigorously separated from daily application development. 

The baseline infrastructure (Firewalls, VPC, Spaces, Droplet) is managed by **Terraform**. Server provisioning (Docker setup, Nginx, SSH hardening) is managed by **Ansible**. Application deployments are entirely managed by **GitHub Actions**.

> [!CAUTION]
> **DO NOT manually SSH into production to pull code, restart containers, or change `.env` files for normal deployments.**

The strict, automated release path is:

1. **Code**: Develop features locally.
2. **Commit**: Merge approved PRs into `main`.
3. **Version Bump**: Update `package.json` version.
4. **Git Tag**: Create an immutable tag (e.g., `v1.0.15`).
5. **GitHub Actions**: The CI/CD pipeline triggers automatically.
6. **Build Images**: Docker images are built via Buildx.
7. **Push Images**: Immutable versioned images are pushed to DOCR.
8. **Temporary Firewall Whitelist**: The CI runner's dynamic IP is temporarily allowed into the DO Cloud Firewall.
9. **Deploy**: The runner SSHs in and updates the `IMAGE_TAG`.
10. **Migration**: The `db-migrator` container initializes and applies Prisma schemas.
11. **Health Verification**: Production services boot sequentially.
12. **Firewall Cleanup**: The dynamic IP is strictly revoked.

For details, read [Production Deployment](docs/production-deployment.md).

---

## 📦 Release & Versioning

The project enforces strict versioning. Currently, version bumping is a **manual** process that must be coordinated before creating a Git tag.

**Versioning Policy**: Semantic Versioning (`MAJOR.MINOR.PATCH`).

**The Authoritative Source**: The **Git Tag** (e.g., `v1.0.15`) is the absolute source of truth for deployments. GitHub Actions uses the Git tag to label Docker images (`IMAGE_TAG`) in DigitalOcean Container Registry. While the root `package.json` should be manually kept in sync with the tag, the CI/CD pipeline purely respects the Git tag.

**How to Release Safely**:
1. Update root `package.json` version to match your target release.
2. Update `package-lock.json` consistently (`npm install`).
3. Commit the version bump to `main`.
4. Create the precise Git tag: `git tag vX.Y.Z` (e.g., `git tag v1.0.15`).
5. Push the commit and the tag to GitHub: `git push origin main && git push origin vX.Y.Z`.
6. GitHub Actions takes over and deploys.

**Rollbacks**:
Because Docker images are immutable and tagged via Git, rolling back is instantaneous. You merely revert the `IMAGE_TAG` to the previous version and restart containers.
*Limitation*: Prisma database migrations are **forward-only**. Application image rollback does not automatically rollback the database schema. Ensure migrations are forward-compatible.

---

## 📦 Services

The application consists of the following distinct microservices sharing a central database:

- **`server`**: The core Node.js Express API. Handles HTTP REST requests and Socket.IO realtime traffic.
- **`worker`**: The BullMQ background daemon. Consumes asynchronous jobs from Valkey (e.g., emails, push notifications, heavy crunching).
- **`scheduler`**: A lightweight cron daemon. Acts purely as a producer to enqueue scheduled jobs into Valkey.
- **`db-migrator`**: An ephemeral container that runs exclusively during production deployments to execute `prisma migrate deploy` before the persistent services boot.

---

## 💾 Database Development

We use Prisma as our ORM. The workflow is highly structured to accommodate Docker:

1. **Modify Schema**: Edit `prisma/schema.prisma`.
2. **Migration**: Run `npm run prisma:migrate` (Applies changes to the local DB and updates the host client).
3. **Container Sync**: Run `npm run prisma:sync` (Compiles the Alpine Linux Prisma binaries inside the running Docker containers).
4. **Service Usage**: Services can now safely query the new schema.

Read [Database Architecture](docs/database.md) for details on PostGIS and migrations.

---

## 📂 Project Structure

```text
.
├── .github/          # GitHub Actions CI/CD workflows
├── docker/           # Production and Local docker-compose files
├── docs/             # Comprehensive documentation knowledge base
├── infrastructure/   # IaC (Terraform and Ansible playbooks)
├── prisma/           # Database schema and historical migrations
├── scheduler/        # Scheduler microservice source code
├── scripts/          # Root bash/node scripts for automation
├── server/           # Express API microservice source code
├── worker/           # Background BullMQ worker source code
├── .env.example      # Safe environment variable template
├── package.json      # Root dependencies and custom generator scripts
└── README.md         # You are here
```
*(Note: The `.agent/` directory is planned but not yet implemented.)*

---

## 📚 Documentation Map

The `docs/` folder contains detailed implementation guides.

| Document | Purpose |
|---|---|
| `developer-workflow.md` | Local developer onboarding and setup |
| `architecture.md` | System architecture, networking, and request lifecycle |
| `database.md` | PostgreSQL, PostGIS, Prisma, and migrations |
| `services.md` | Server, worker, scheduler, BullMQ, and external queues |
| `security.md` | Security architecture, Auth, RBAC, and Firewalls |
| `environment.md` | Safe reference for all required environment variables |
| `observability.md` | Healthchecks, Docker logging, and system reliability |
| `production-deployment.md` | Production deployment, CI/CD, IaC, and rollback |
| `troubleshooting.md` | Common failures and remediation procedures |
| `adr.md` | Architecture Decision Records and system limitations |
| `README.md` (docs) | Docs directory index |
| `release-management.md` | Versioning, release, and rollback workflows |
| `disaster-recovery.md` | *(TODO) Total system recovery procedures* |
| `commit-convention.md` | Git Commit Convention & Template |
| `ai-agent-guide.md` | Human guide for steering AI coding agents |
| `.agent/rules.md` | Strict Agent behavioral rules |
| `.agent/workflow.md` | Agent deployment workflow |
| `.agent/architecture.md`| AI architecture context |

---

## 🧭 Source of Truth

To prevent confusion and configuration drift, respect the following strict ownership boundaries:

- **Application behavior** → Source code (`server`, `worker`, `scheduler`).
- **Database schema** → `prisma/schema.prisma`.
- **Database migration history** → `prisma/migrations/`.
- **Local orchestration** → `docker-compose.yaml`.
- **Permanent infrastructure** → `infrastructure/terraform/`.
- **Server provisioning** → `infrastructure/ansible/`.
- **Deployment automation** → `.github/workflows/deploy.yaml`.
- **Production release identity** → The precise Git Tag (`vX.Y.Z`).
- **Detailed operational procedures** → `docs/`.
- **AI coding constraints** → `.agent/`.

Documentation describes the implementation; it must never become a competing source of truth.

---

## 🤖 AI / Agentic Development

We fully support AI coding agents collaborating on this repository. However, AI agents **must** follow repository-specific constraints.

**AI agents must follow [docs/developer-workflow.md](docs/developer-workflow.md) exactly and must use existing repository scripts/generators whenever applicable.**

Agents and developers must abide by the rules defined in:
- [docs/ai-agent-guide.md](docs/ai-agent-guide.md)
- [.agent/rules.md](.agent/rules.md)
- [docs/commit-convention.md](docs/commit-convention.md)

**Source of Truth Principle:** Existing repository documentation and tooling take precedence over an AI agent's preferred workflow.

**The Required Agent Workflow:**
AI agents are strictly bound to an **18-step mandatory workflow** (see [.agent/workflow.md](.agent/workflow.md)). The most critical requirements are:
1. **NO GUESSING**: If requirements are missing or ambiguous, the AI must STOP and ask.
2. **IMPLEMENTATION PLAN**: The AI must provide a detailed implementation plan before modifying any files.
3. **EXPLICIT APPROVAL GATE**: The AI MUST WAIT for explicit human approval (e.g., "Proceed") before executing any state-changing action.

**Strict Agent Prohibitions:**
AI agents must **NOT** casually:
- Modify production containers.
- Execute `terraform apply` or `ansible-playbook` against production.
- Modify DO Cloud Firewall rules manually.
- Rotate secrets or rewrite `.env` blindly.
- Alter production database data.
- Push Git tags or create releases.
- Modify CI/CD security parameters.
- Execute destructive `rm -rf` or `down -v` commands.

---

## ⚠️ Security Warning

- **NEVER** commit secrets, API keys, or private SSH keys.
- **NEVER** place the production `.env` file in Git.
- **NEVER** expose the internal PostgreSQL (`5432`) or Valkey (`6379`) ports to the public internet.
- **NEVER** re-open SSH (`22`) to `0.0.0.0/0` as a permanent solution; always use the CI/CD dynamic whitelist or VPN.
- **NEVER** perform destructive Prisma operations (`prisma db push`, `prisma migrate reset`) against the production database.

---

## 🛠 Quick Commands

We utilize custom generator scripts to enforce strict typing and eliminate boilerplate.

### Local Development
- **Start Stack**: `docker compose up -d --build`
- **View Logs**: `docker compose logs -f server`

### Prisma / Database
- **Migrate Local DB**: `npm run prisma:migrate`
- **Sync Docker Containers**: `npm run prisma:sync`
- **Generate Local Client**: `npm run prisma:generate`

### Generators
- **API Module**: `npm run create:module <name>`
- **API Endpoint**: `npm run create:endpoint`
- **Worker Queue**: `npm run create:queue <name>`
- **Worker Job**: `npm run create:queue-job <queue> <job>`
- **Scheduler Job**: `npm run create:job <name>`
- **Email Template**: `npm run create:emailTemp`

### Validation
- **Lint & Format**: Pre-commit hooks run automatically via `husky` and `lint-staged`.

---

## 🔄 Common Workflows

Need to do something? Go directly to the source:

- **I need to add an API feature** → Read [Developer Workflow](docs/developer-workflow.md) + [Architecture](docs/architecture.md).
- **I need to change DB schema** → Read [Database](docs/database.md).
- **I need to add a BullMQ job** → Read [Services](docs/services.md) + Generator commands.
- **I need to deploy** → Read [Production Deployment](docs/production-deployment.md).
- **I need to release vX.Y.Z** → Read [Release Management](docs/release-management.md) or Section 5 above.
- **Production is broken!** → Read [Troubleshooting](docs/troubleshooting.md) → Check Observability → Rollback if necessary.
- **I want AI to modify code** → Read [.agent/rules.md](.agent/rules.md) and instruct the AI strictly.
