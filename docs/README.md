# ALUA Academy Management Documentation Index

Welcome to the central documentation knowledge base for the ALUA Academy Management backend.

## 🧭 Source of Truth Boundaries

Before reading, understand the strict repository boundaries:
- **Application behavior** → TypeScript source code (`server`, `worker`, `scheduler`)
- **Database schema** → `prisma/schema.prisma`
- **Database history** → `prisma/migrations/`
- **Local orchestration** → `docker/docker-compose.yaml`
- **Permanent cloud infrastructure** → `infrastructure/terraform/`
- **Server configuration** → `infrastructure/ansible/`
- **CI/CD** → `.github/workflows/`
- **Release identity** → Git tags
- **Documentation** → `docs/`
- **AI operating rules** → `.agent/`

---

## 🗺 Documentation Map

### GETTING STARTED
- **[Developer Workflow & Onboarding](developer-workflow.md)**: The strict, step-by-step path from `git clone` to starting development.

### ARCHITECTURE
- **[System Architecture](architecture.md)**: Network topology, Request Lifecycle, and Nginx reverse proxy configuration.

### DEVELOPMENT & GIT WORKFLOW
- **[Environment Variables](environment.md)**: Comprehensive, safe reference for `.env` variables and GitHub Actions secrets.
- **[Git Commit Convention](commit-convention.md)**: The strict Conventional Commits specification, formatting rules, and AI agent commit rules.
- *(Also see [Developer Workflow](developer-workflow.md) for custom generator scripts).*

### DATABASE
- **[Database Architecture](database.md)**: PostgreSQL, PostGIS, Prisma ORM, and the `db-migrator` Docker deployment lifecycle.

### SERVICES
- **[Services & Integrations](services.md)**: Valkey (Redis), BullMQ workers, Socket.IO, and external third-party integrations (S3, FCM).

### SECURITY
- **[Security Architecture](security.md)**: JWT Authentication, Role-Based Access Control (RBAC), firewall isolation, and secret management.

### OBSERVABILITY
- **[Observability & Reliability](observability.md)**: The `/health` endpoint, Docker native healthchecks vs restart policies, and logging strategy.

### DEPLOYMENT
- **[Production Deployment & IaC](production-deployment.md)**: DigitalOcean Terraform infrastructure, Ansible provisioning, and the automated GitHub Actions pipeline.

### RELEASE
- **[Release Management](release-management.md)**: Semantic Versioning, manual `package.json` bumping, immutable Git tags, and rollback procedures.

### TROUBLESHOOTING
- **[Troubleshooting Guide](troubleshooting.md)**: Practical remediation for common CI/CD failures, Docker container crashes, and database connection issues.
- **[ADRs & Limitations](adr.md)**: Architecture Decision Records explaining *why* the system is built this way, and known future technical debt.

### HUMAN DEVELOPMENT
- **[Developer Workflow & Onboarding](developer-workflow.md)**: The strict, step-by-step path from `git clone` to starting development.
- **[Git Commit Convention](commit-convention.md)**: The strict Conventional Commits specification.
- **[Release Management](release-management.md)**: Semantic Versioning and manual `package.json` bumping.

### AI / AGENTIC DEVELOPMENT
- **[AI Agent Guide](ai-agent-guide.md)**: Human-oriented instructions on how developers should steer AI coding assistants.
- **[.agent/rules.md](../.agent/rules.md)**: Strict behavioral constraints injected into AI contexts.
- **[.agent/workflow.md](../.agent/workflow.md)**: The mandatory AI workflow requiring agent inspection of human tools.
- **[.agent/architecture.md](../.agent/architecture.md)**: Machine-optimized system map.

**Source of Truth Principle:** Existing repository documentation and tooling take precedence over an AI agent's preferred workflow.
