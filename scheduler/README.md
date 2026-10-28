# Scheduler Service

The `scheduler` service handles scheduled and recurring background tasks.

> [!WARNING]
> **This is a highly Docker-heavy project.**
> Do not attempt to run this project or install local service dependencies on your host machine to run services natively. The environment is strictly containerized. Always follow the instructions below and run the project using Docker Compose.

## Responsibilities

- scheduler startup and lifecycle management
- registration of recurring jobs
- periodic maintenance and scheduled workflows
- Redis and PostgreSQL access for job coordination

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

- `build`: creates a production build. *Note: strictly enforces linting and testing via `scripts/build.sh` before compiling.*
- `test`: placeholder for testing.
- `start`: runs the compiled scheduler service.
- `dev`: starts the service in development mode with nodemon.
- `format`: formats the source code.
- `lint`: checks for lint issues.

## Adding New Jobs

The scheduler uses a **dynamic registry** for node-cron jobs. You do not need to manually import or register new jobs. 

To create a new background job, run the following command from the **project root**:

```bash
npm run create:job my-new-job
```

This will automatically generate a fully-typed boilerplate module in `src/app/jobs/my-new-job/` containing `.types.ts` and `.tasks.ts`. The scheduler will automatically discover and execute it based on the schedule provided.

## Development Notes

- The service is meant to stay running continuously when scheduled workflows are needed.
- It depends on Redis and PostgreSQL for runtime state and coordination.
- It mirrors the worker startup pattern so that background jobs can be managed consistently.

## Useful Commands

```bash
docker compose logs -f scheduler
docker compose restart scheduler
docker compose exec scheduler sh
```
