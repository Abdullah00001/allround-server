# Worker Service

The `worker` service handles asynchronous background processing, executing intensive computational tasks, interacting with third-party APIs (like Firebase for push notifications), and sending emails.

> [!WARNING]
> **This is a highly Docker-heavy project.**
> Do not attempt to run this project or install local service dependencies on your host machine to run services natively. The environment is strictly containerized. Always follow the instructions below and run the project using Docker Compose.

> Docker-first note: this service should be started through the root Docker Compose setup so it can use the shared Redis and PostgreSQL containers correctly.

## Responsibilities

- Processing jobs offloaded by `BullMQ` queues.
- Heavy background computations to offload the main API servers.
- Third-party integrations (Firebase Push Notifications, emails).
- Redis and PostgreSQL access for job coordination.
- Graceful shutdown management for interrupted jobs.

## Scripts

From this folder, you can run:

```bash
npm run build
npm run test
npm run start
npm run dev
npm run format
npm run lint
```

### Script details

- `build`: creates a production build. *Note: enforces linting (skipped for TS 7 compatibility currently) and testing via `scripts/build.sh` before compiling.*
- `test`: runs the unit and integration tests.
- `start`: runs the compiled worker service.
- `dev`: starts the service in development mode with nodemon.
- `format`: formats the source code.
- `lint`: checks for lint issues.

- The service is meant to stay running continuously to process incoming queues.
- It depends on **Redis** for the `BullMQ` queues and **PostgreSQL** for runtime state and record updates.
- It utilizes `dumb-init` in Docker to ensure graceful shutdown signals (SIGINT/SIGTERM) are properly caught so that active jobs aren't corrupted mid-process.
- **Strict Typing:** We enforce explicit typing across this microservice. `any` types are strictly forbidden. All BullMQ jobs must utilize `IJobHandler<T>` with an explicit data interface.

## Dynamic Queue Architecture

This service uses an automated discovery system. At startup, the root `worker/src/index.ts` automatically discovers, imports, and launches all worker modules present in `worker/src/app/queues/`. You do not need to manually register workers in a giant array or write massive switch-case statements for job handling. 

### Adding a New Queue

To scaffold a completely typed, robust queue, run from the **root of the project**:

```bash
npm run create:queue <queue_name>
```

This will automatically create a folder in `worker/src/app/queues/<queue_name>` containing:
- The BullMQ queue instance (`.queue.ts`).
- The BullMQ worker wrapper with dynamic job discovery (`.workers.ts`).
- A dedicated types file for your data payload interfaces (`.types.ts`).
- An initial example job.

### Adding a Job to a Queue

Instead of monolithic switch statements, every job belongs in its own file under the target queue's `jobs/` directory.

To auto-generate a properly typed job, run from the **root of the project**:

```bash
npm run create:queue-job <queue_name> <job_name>
```

Example:
```bash
npm run create:queue-job email send-welcome
```

This generates `send-welcome.job.ts` and automatically enforces the explicit payload type definition. The queue's worker will automatically discover this job at boot time based on its `name` property!

## Useful Commands

```bash
docker compose logs -f worker
docker compose restart worker
docker compose exec worker sh
```
