# Developer Workflow & Onboarding

Welcome to the ALUA Academy Management Server project! This document outlines how to get up and running with the codebase as a new developer.

## The Onboarding Path

To start developing, follow this exact sequence:

`CLONE` → `ENVIRONMENT` → `DOCKER` → `DATABASE` → `PRISMA` → `START SERVICES` → `VERIFY` → `START DEVELOPMENT`

> [!IMPORTANT]
> **AI AGENT RULE**: AI agents are strictly bound to this exact developer workflow. AI agents must use the existing tooling, generators, and Docker configurations defined here. They are not permitted to invent a separate AI workflow.

---

## 1. Prerequisites (Host Machine)

This project relies heavily on Docker. You must install the following tools on your local machine before starting:

- **Git**: For version control.
- **Node.js (v22 strictly)**: Used **only** to run the root automation scripts (like Prisma migrations and code generators). The actual application runs inside Alpine Linux Docker containers.
- **npm (latest)**: Node package manager.
- **Docker & Docker Compose**: The core orchestration engine. Ensure the Docker daemon is running.

## 2. Clone & Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Abdullah00001/alua-academy-management-server.git
   cd alua-academy-management-server
   ```
2. **Install root dependencies:**
   *(Executes on Host)*
   ```bash
   npm install
   ```

## 3. Environment Configuration

You must configure local environment variables to allow the services to boot.

1. **Copy the template:**
   *(Executes on Host)*
   ```bash
   cp .env.example .env
   ```
2. **Configure sensitive keys:**
   The `DATABASE_URL` and `REDIS_URL` are pre-configured to work with the local Docker containers out of the box.
   **Crucially**, you must provide valid (or placeholder sandbox) credentials for `SMTP_*` and `FIREBASE_*`, otherwise the `worker` service will crash immediately on boot.

## 4. Docker Infrastructure

Do **NOT** install PostgreSQL or Redis on your host machine. We run all dependencies via Docker Compose.

1. **Build and start the stack:**
   *(Executes on Host)*
   ```bash
   docker compose up -d --build
   ```
2. This command downloads the PostGIS and Redis images, builds the `server`, `worker`, and `scheduler` Node.js images, and starts everything in the background.

## 5. Database & Prisma Initialization

Because the database runs in Docker but we edit our schema on the host, we use a two-step synchronization process.

1. **Migrate the Database:**
   *(Executes on Host, connects to Docker)*
   ```bash
   npm run prisma:migrate
   ```
   *This applies the `schema.prisma` to the local PostGIS container and generates the host's Prisma client.*

2. **Sync the Containers:**
   *(Executes from Host, runs inside Docker)*
   ```bash
   npm run prisma:sync
   ```
   *This securely executes `npx prisma generate` inside the running Docker containers so they compile the correct Alpine Linux query engine binaries.*

> [!IMPORTANT]
> Always run both commands sequentially whenever you change `prisma/schema.prisma`!

## 6. Verify Services

Check that all containers are healthy and running.

*(Executes on Host)*
```bash
docker compose ps
```
Ensure `server`, `worker`, `scheduler`, `postgres`, and `redis` are marked as **Up** or **healthy**.

You can also view the logs of any specific service:
```bash
docker compose logs -f server
```

## 7. Start Development (Generators)

You are now ready to develop! All code inside `server/`, `worker/`, and `scheduler/` will hot-reload automatically via `nodemon` when you save a file.

We provide custom NPM scripts to eliminate boilerplate. Run these from the **Host** machine:

### API Development (server)
- `npm run create:version <version_name>`: Initializes a new API version.
- `npm run create:module <module_name>`: Scaffolds a complete 8-file API module.
- `npm run create:endpoint`: Interactively generates a strictly-typed controller, service, and auto-wires the route.

### Background Jobs (worker)
- `npm run create:queue <queue_name>`: Scaffolds a new BullMQ queue and mirrors it to the producers.
- `npm run create:queue-job <queue_name> <job_name>`: Generates a perfectly typed job handler.
- `npm run create:emailTemp`: Scaffolds a new HTML email template string.

### Cron Jobs (scheduler)
- `npm run create:job <job_name>`: Scaffolds a new scheduled chron job.

## 8. Validation (Tests, Linting, Building)

Before committing code, you must validate your changes.

- **Linting & Formatting**: Enforced automatically on `git commit` via Husky and `lint-staged`.
- **Manual Build Validation**: To ensure TypeScript compiles successfully (especially for strict types):
  ```bash
  cd server && npm run build
  cd ../worker && npm run build
  cd ../scheduler && npm run build
  ```

## 9. Naming Conventions

To maintain consistency and adhere to JavaScript best practices, please follow these rules:
- **File Names, Variables, and Functions**: Must use `camelCase` (e.g., `sendSignupSuccessEmail.job.ts`).
- **Scripts**: Any files within `./scripts/` directories must use `kebab-case` (e.g., `create-queue-job.sh`), as this is the industry standard for executable scripts.
- **Queue Jobs**: When generating a job via `npm run create:queue-job`, provide the name in `camelCase`. The generator will automatically convert it to `kebab-case` for the internal job string and `UPPER_SNAKE_CASE` for the registry key.

## 10. Common Errors

### "PrismaClient did not initialize yet"
**Cause:** You changed the schema but forgot to sync the container.
**Fix:** Run `npm run prisma:sync`.

### ESLint failing on commit
**Fix:** Run `npm run format` and `npm run lint` inside the specific service directory (e.g., `cd worker`). Fix the strict typing errors (no `any` allowed).

### Ports already in use
**Fix:** Ensure you don't have local Postgres (5440) or Redis (6382) instances running on your host machine fighting the Docker containers for port bindings.

## 11. Where to Read Next

Now that you have the environment running:
- Read [System Architecture](architecture.md) to understand how traffic flows.
- Read [Services & Integrations](services.md) to understand how the worker queues function.
- Read [Security Architecture](security.md) to understand authentication and JWTs.
