# Infrastructure & CI/CD Pipeline

## 1. DigitalOcean Infrastructure Overview

The ALUA Academy Management production environment operates entirely within DigitalOcean.

- **Droplet (Ubuntu)**: The foundational compute node running the Docker Engine, Nginx, and the BullMQ/Express Node.js containers.
- **Cloud Firewall**: An external, stateful firewall completely shielding the Droplet.
- **Container Registry (DOCR)**: A private, secure repository hosting the immutable `alua-academy-management-server`, `worker`, and `scheduler` Docker images.
- **Managed PostgreSQL**: The highly-available database cluster. Backups and PITR (Point-in-Time Recovery) are natively handled by DO.
- **Managed Valkey (Redis)**: The in-memory cache and queue backend.
- **Spaces**: S3-compatible Object Storage for media uploads.

---

## 2. Infrastructure as Code (IaC)

### Terraform
Terraform is strictly responsible for provisioning the *permanent* cloud infrastructure:
- Droplet creation.
- DO Spaces Bucket & CDN.
- Project & Tag assignments.
- The base DO Cloud Firewall (opening `80`/`443` and permanently restricting `22` to the admin's static IP).

> [!CAUTION]
> **What Terraform Intentionally DOES NOT Own**
> Terraform does **not** manage the temporary GitHub Actions runner `/32` firewall rule. If you run `terraform apply` *during* an active GitHub Actions deployment, Terraform's state reconciliation will fight the CI pipeline and aggressively revoke the runner's SSH access, immediately breaking the deployment.

### Ansible
Ansible is strictly responsible for *server configuration*, not application deployment.
- Installs Docker and Docker Compose.
- Creates the `deploy` user and configures passwordless `sudo` and SSH key constraints.
- Disables Root SSH and global password authentication.
- Configures Docker JSON log rotation (`daemon.json`).
- Installs Nginx and initially configures the proxy routing.

---

## 3. CI/CD Architecture (GitHub Actions)

The repository features a fully automated Continuous Integration (CI) and Continuous Deployment (CD) pipeline.

### The CI Pipeline (Trigger: `push` to `main`)
1. Installs Node.js dependencies.
2. Lints the codebase (`eslint`).
3. Executes unit tests (`npm run test`).
4. Compiles the strict TypeScript AST to verify build correctness (`scripts/build.sh`).

### The CD Pipeline (Trigger: `push tag v*`)
1. **Docker Buildx**: Checks out the code and uses Buildx to compile `server`, `worker`, and `scheduler` images based on the specific Git commit.
2. **Registry Push**: Images are tagged strictly with the exact Git tag (e.g., `v1.0.14`) and pushed to DigitalOcean Container Registry.
3. **Dynamic Firewall Whitelist**: The GitHub Runner's dynamic public IP is retrieved and appended to the DO Cloud Firewall on port `22` (via `doctl`).
4. **SCP & SSH Deployment**:
   - `docker-compose.yaml` is copied to the Droplet via SCP using the `deploy` user.
   - The runner SSH's into the Droplet, securely logs into DOCR via `DO_REGISTRY_TOKEN`, exports `IMAGE_TAG=v1.0.14`, and runs `docker compose pull && docker compose up -d`.
5. **Database Migration**: The ephemeral `db-migrator` container boots, applies any pending Prisma schemas, and successfully exits. The core services subsequently boot.
6. **Firewall Cleanup**: An `if: always()` block in GitHub Actions guarantees that the ephemeral runner `/32` IP is securely revoked from the DO Cloud Firewall, regardless of deployment success or failure.

---

## 4. Release Process

To cut a new production release:
1. Complete development locally and merge all PRs into `main`.
2. Ensure the `main` CI pipeline is green.
3. Determine the next Semantic Version (e.g., `v1.0.15`).
4. Create an annotated Git tag on your local machine:
   ```bash
   git tag v1.0.15
   ```
5. Push **only** the tag to origin:
   ```bash
   git push origin v1.0.15
   ```
6. The GitHub Actions CD pipeline will automatically trigger, build the images, and perform the zero-downtime deployment.

---

## 5. Rollback Procedure

Because ALUA Academy Management relies on **immutable release tags**, reverting a faulty deployment is completely deterministic and requires zero rebuilding.

1. Identify the previous stable release tag (e.g., `v1.0.13`).
2. Verify the tag still exists in DigitalOcean Container Registry.
3. SSH into the production Droplet as the `admin` or `deploy` user.
4. Navigate to `/opt/alua-academy-management-server`.
5. Run the rollback sequence explicitly:
   ```bash
   export IMAGE_TAG=v1.0.13
   docker compose pull
   docker compose up -d
   ```

> [!WARNING]
> **Database Migrations Cannot Be Automatically Rolled Back**
> Rolling back the application containers (`IMAGE_TAG`) will immediately restore the old Node.js code. However, Prisma does not downgrade the database schema. Ensure that your Prisma migrations are always forward-compatible (e.g., adding nullable columns rather than renaming columns) to guarantee that an older application image can safely operate on a newer database schema.

---

## 6. Disaster Recovery

ALUA Academy Management maintains robust disaster recovery capabilities.

### Fully Reproducible State
- **Droplet Loss**: If the Droplet is completely destroyed, run `terraform apply` to recreate the VPS, then run the Ansible playbook to reprovision Docker and Nginx. Finally, trigger the GitHub Actions CD pipeline to redeploy the application. Total estimated recovery time: 10 minutes.
- **Database Corruption**: DigitalOcean Managed PostgreSQL automatically maintains automated daily backups and Point-In-Time-Recovery (PITR) for up to 7 days. You can fork the database to a specific minute in time directly from the DO console.

### Manual Actions Still Required
- Restoring a PITR database requires manually updating the `DATABASE_URL` secret in GitHub Actions and the `.env` file on the Droplet to point to the new cluster URI.
- Let's Encrypt certificates are tied to the local Droplet. Recreating the Droplet via Terraform requires running Certbot manually once to provision a new certificate before HTTPS traffic can resume.
