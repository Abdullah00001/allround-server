# Database Architecture

## 1. PostgreSQL & Prisma

Allround Server uses a Managed PostgreSQL database. The schema is entirely managed through the **Prisma ORM**.

### Prisma Schema (`prisma/schema.prisma`)
The schema acts as the single source of truth for the data model, enforcing strict referential integrity and type safety across the TypeScript backend.

- **PostGIS Extensions:** The schema explicitly loads `postgis`, `fuzzystrmatch`, `postgis_tiger_geocoder`, and `postgis_topology` to support advanced location-based queries (e.g. project sites, coordinates, and geofencing).
- **Core Models:**
  - `User` / `Device` / `UserPreference`: Core identity, roles (`ADMIN`, `SITE_MANAGER`, `EMPLOYEE`), and session devices.
  - `Customer` / `CustomerContact`: Client companies and primary contacts.
  - `Inspection`: Pre-sales scaffold surveys and site inspections.
  - `Project` / `ProjectPhase` / `ProjectTask` / `ProjectNote` / `ProjectMeasurement`: Real estate project lifecycle and phases.
  - `CrewAssignment` / `Vehicle` / `VehicleAssignment`: Operations, resource allocation, and fleet management.
  - `TimeLog` / `TimeLogBreak`: Mobile GPS time tracking and supervisor approvals.
  - `Absence` / `CompanyProfile` / `SystemSetting`: HR leave tracking and company configurations.
  - `Attachment` / `Notification` / `AuditLog`: Media management, in-app alerts, and system audit history.

### Referential Integrity
All relations heavily utilize `@relation(..., onDelete: Cascade)` or `@relation(..., onDelete: Restrict)` where business rules require data preservation. For example, deleting a `Project` will cascade and remove its child phases, tasks, notes, and measurements, while customer links are safeguarded to prevent orphaned data.

---

## 2. Migrations & Workflow

Database changes in Prisma are **forward-only**. 

> [!WARNING]
> **No Automatic Database Rollback**
> If a production deployment fails, rolling back the application `IMAGE_TAG` to a previous version is trivial. However, Prisma does **not** automatically rollback database schema changes. Migrations must be carefully authored to be forward-compatible.

### Local Development Workflow
When a developer modifies `schema.prisma`:
1. Run `npm run prisma:migrate`. This generates the migration SQL file, applies it to the local PostGIS container, and generates the Prisma client for the host OS.
2. Run `npm run prisma:sync`. This executes `npx prisma generate` inside the running Docker containers so they compile the engine binary required for Alpine Linux.

### Production Migration Sequence (`db-migrator`)
In production, the database is never migrated manually. The migration sequence is governed by a strict initialization gate in Docker Compose.

1. **db-migrator Container Starts:** During deployment, Docker Compose boots an ephemeral container (`db-migrator`) that uses the exact same `allround-server-server` image but overrides the entrypoint to run `npx prisma migrate deploy`.
2. **Execution:** The migrator connects to the managed PostgreSQL database and applies any pending `.sql` migration files stored in `prisma/migrations/`.
3. **Graceful Exit:** If successful, the `db-migrator` exits with code `0`.
4. **Service Boot:** The `server`, `worker`, and `scheduler` containers are strictly configured with `depends_on: db-migrator: condition: service_completed_successfully`. They remain paused until the migrator finishes. Once the migrator exits with `0`, the continuous services boot safely against a fully synchronized database schema.
