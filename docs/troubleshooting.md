# Troubleshooting Guide

This guide provides practical remediation steps for common production and deployment issues.

> [!CAUTION]
> **Production Safety**
> Never execute destructive commands (like `docker compose down -v` or `terraform destroy`) against the production environment unless you are explicitly executing a total Disaster Recovery scenario.

---

## 1. CI/CD & Deployment Failures

### GitHub Actions Firewall Timeout (TCP 22: i/o timeout)
- **Symptoms:** The CD pipeline stalls during the `Copy docker-compose.yaml to Droplet` or `Execute deployment` steps and eventually fails with a TCP 22 timeout.
- **Likely Causes:** The dynamic `doctl` IP injection failed, or the DigitalOcean API experienced a transient delay in applying the firewall rule.
- **Checks:** Verify the GitHub Actions logs to ensure the `Authorize Runner IP in DO Firewall` step executed successfully.
- **Safe Remediation:** 
  1. Simply re-run the failed GitHub Actions job. 
  2. If the issue persists continually, manually log into the DO Console, navigate to the Cloud Firewall, and ensure the `/32` rule is not stuck in a conflicting state.

### DOCR Authentication Failure
- **Symptoms:** The deployment fails at `docker login registry.digitalocean.com`.
- **Likely Causes:** The `DO_REGISTRY_TOKEN` secret has expired or was revoked.
- **Safe Remediation:** Generate a new Registry Token in the DigitalOcean console and update the `DO_REGISTRY_TOKEN` secret in GitHub.

---

## 2. Docker & Container Health

### Container Constantly Restarting
- **Symptoms:** `docker compose ps` shows `Restarting` for `server` or `worker`.
- **Likely Causes:** Application crash on boot (e.g., missing environment variable, syntax error).
- **Checks:** Run `docker compose logs -f server` to capture the stack trace.
- **Safe Remediation:** If the failure is due to a missing `.env` variable (e.g., `SMTP_HOST`), SSH into the Droplet, update `/opt/alua-academy-management-server/.env`, and run `docker compose up -d`. If it's a code issue, push a hotfix and release a new `v*` tag.

### Container Marked Unhealthy
- **Symptoms:** `docker compose ps` shows `Up X minutes (unhealthy)`.
- **Likely Causes:** For `server`, this strictly means the `/health` endpoint is returning `HTTP 503` due to a PostgreSQL or Valkey timeout. For `worker`, this means the Node process is technically deadlocked despite the PID existing.
- **Checks:** 
  1. `docker inspect --format='{{json .State.Health}}' alua-academy-management-server`
  2. `curl https://api.alua-academy-management.com/health` (To identify which dependency failed).
- **Safe Remediation:** Resolve the underlying dependency issue (e.g., check DO console for database maintenance). The container will automatically heal and return to `healthy` once the dependency responds.

---

## 3. Database & Migrations

### db-migrator Fails to Start
- **Symptoms:** The CD pipeline completes, but the `server` never boots. `docker compose ps -a` shows `db-migrator` exited with `Code 1`.
- **Likely Causes:** The Prisma migration failed to apply due to a syntax error or a destructive/conflicting schema change.
- **Checks:** `docker compose logs db-migrator`
- **Safe Remediation:** Because `db-migrator` is an initialization gate (`condition: service_completed_successfully`), the core services will safely refuse to boot against a broken schema. Fix the migration locally, push a new tag, and redeploy.

### Prisma Timeout / Connection Refused
- **Symptoms:** `server` logs show `PrismaClientInitializationError: Can't reach database server`.
- **Likely Causes:** Managed PostgreSQL is down, or the `DATABASE_URL` is incorrect.
- **Safe Remediation:** Verify the `DATABASE_URL` in `.env` uses the correct internal VPC routing (if applicable) and that the Managed Database hasn't exceeded its connection limit.

---

## 4. Let's Encrypt & Nginx

### Expired TLS Certificate
- **Symptoms:** Browsers report `NET::ERR_CERT_DATE_INVALID` when visiting the API.
- **Likely Causes:** The `certbot.timer` failed to execute, or Nginx failed to reload after renewal.
- **Checks:** 
  1. `systemctl status certbot.timer`
  2. `journalctl -u certbot.service`
- **Safe Remediation:** SSH into the droplet and force a manual renewal:
  ```bash
  sudo certbot renew --force-renewal
  sudo systemctl reload nginx
  ```
