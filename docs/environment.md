# Environment Variables

This document provides a safe reference for all environment variables expected by the ALUA Academy Management infrastructure. 

> [!CAUTION]
> **NEVER expose actual values.** This document uses `<PLACEHOLDER>` tags. Actual values should only be injected via GitHub Actions Secrets or safely copied into a local `.env` file during development.

## 1. Application Variables (`.env`)

These variables are consumed by the Node.js containers (`server`, `worker`, `scheduler`).

| Variable Name | Required | Purpose | Service | Example / Placeholder |
|---------------|----------|---------|---------|------------------------|
| `NODE_ENV` | Yes | Defines the runtime environment mode | All | `production` or `development` |
| `PORT` | Yes | The port Express.js listens on | server | `5000` |
| `DATABASE_URL` | Yes | Connection string for PostgreSQL | All | `postgresql://<user>:<pass>@<host>:25060/db?sslmode=require` |
| `REDIS_URL` | Yes | Connection string for Valkey | All | `redis://default:<pass>@<host>:25061` |
| `JWT_ACCESS_SECRET` | Yes | Symmetric key used to sign JWT access tokens | server | `<HIGH_ENTROPY_STRING>` |
| `SMTP_HOST` | Yes | Email provider hostname | worker | `smtp.resend.com` |
| `SMTP_PORT` | Yes | Email provider port | worker | `465` |
| `SMTP_USER` | Yes | Email username | worker | `resend` |
| `SMTP_PASS` | Yes | Email password/API key | worker | `<RESEND_API_KEY>` |
| `SMTP_FROM` | Yes | Verified sender email address | worker | `no-reply@alua-academy-management.com` |
| `S3_ENDPOINT` | Yes | DO Spaces endpoint | server, worker | `https://sfo3.digitaloceanspaces.com` |
| `S3_BUCKET_NAME` | Yes | DO Spaces bucket name | server, worker | `alua-academy-management-storage` |
| `S3_ACCESS_KEY_ID` | Yes | DO Spaces API Key | server, worker | `<SPACES_ACCESS_KEY>` |
| `S3_SECRET_ACCESS_KEY` | Yes | DO Spaces API Secret | server, worker | `<SPACES_SECRET_KEY>` |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project identifier | worker | `<FIREBASE_PROJECT_ID>` |
| `FIREBASE_PRIVATE_KEY` | Yes | FCM Admin SDK private key | worker | `-----BEGIN PRIVATE KEY-----\n<KEY>\n-----END PRIVATE KEY-----` |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email | worker | `<FIREBASE_CLIENT_EMAIL>` |

---

## 2. Docker Compose Variables

These variables are utilized strictly inside `docker-compose.yaml` interpolation.

| Variable Name | Required | Purpose | Example / Placeholder |
|---------------|----------|---------|-----------------------|
| `DOCKER_USERNAME` | Yes (Prod) | The DOCR registry URL | `registry.digitalocean.com/alua-academy-management-registry` |
| `IMAGE_TAG` | Optional | Specifies the immutable tag to pull. Defaults to `latest`. | `v1.0.14` |

---

## 3. GitHub Actions CI/CD Configuration

These values are required in the GitHub repository settings.

### Secrets (Encrypted)
- `DIGITALOCEAN_ACCESS_TOKEN`: The DigitalOcean API token.
- `DO_SSH_PRIVATE_KEY`: The ED25519 private key for the `deploy` user.
- `DO_REGISTRY_TOKEN`: DigitalOcean Container Registry authentication token.

### Variables (Plaintext)
- `DO_DROPLET_HOST`: The IP address of the production Droplet (e.g., `206.189.250.83`).
- `DO_DROPLET_USER`: The SSH deployment user (`deploy`).
- `DO_ACCOUNT_EMAIL`: The DO account email used for Docker login.
