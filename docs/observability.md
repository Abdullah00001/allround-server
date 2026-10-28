# Observability & Reliability

## 1. Application Health (`/health`)

The `server` container exposes a deep health check endpoint at `/health` that validates continuous application readiness and dependency connectivity.

### Exact Behavior
- **Database Check**: Executes `SELECT 1` against PostgreSQL via Prisma.
- **Valkey Check**: Executes `PING` against the Valkey server via `ioredis`.
- **Timeout**: The endpoint is aggressively constrained by a `3000ms` `Promise.race` wrapper. If any dependency hangs for >3s, it is forced into a failure state.
- **Safe Responses**:
  - If all checks pass: Returns `HTTP 200` with `{"status":"ok", "dependencies":{"database":"up","redis":"up"}}`.
  - If any check fails/timeouts: Returns `HTTP 503` (Service Unavailable) with `status: degraded`. Error details are safely logged internally and are **never** leaked in the HTTP response.
- **TraceID**: Every response guarantees a unique `traceId` injected by global middleware for log correlation.

> [!NOTE]
> There is no separate `/health/live` vs `/health/ready` endpoint. The single `/health` endpoint serves both purposes.

---

## 2. Docker Healthchecks

The production `docker-compose.yaml` utilizes Docker-native healthchecks to constantly monitor process integrity.

### Configuration
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start Period**: 15s

### Service Implementations
- **server**: Executes `wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/health`. Docker will mark the container `unhealthy` if PostgreSQL or Valkey crash (due to the `HTTP 503` logic).
- **worker**: Executes `pidof node > /dev/null || exit 1`. Verifies that the worker event loop hasn't completely exited. (Note: A strictly deadlocked Node process might still report healthy if the PID exists, which is a known architectural limitation).
- **scheduler**: Executes `pidof node > /dev/null || exit 1`.

### Healthcheck != Restart Policy
> [!WARNING]
> **Important Distinction**
> An `unhealthy` Docker state **does not** automatically restart the container. Container restarts are strictly governed by the `restart: unless-stopped` policy, which only triggers if the main Node.js process natively crashes or exits. The `unhealthy` flag serves solely to alert monitoring tools and prevent traffic routing during degraded states.

---

## 3. Logging Strategy

### Docker Container Logs
All persistent containers (`server`, `worker`, `scheduler`) natively log to `stdout` and `stderr`.
- **Driver**: `json-file`
- **Rotation**: Configured globally on the host daemon (via Ansible in `/etc/docker/daemon.json`) with `max-size: 20m` and `max-file: 3`. This strictly prevents application logs from causing infinite disk exhaustion on the Droplet.

### Application Logging Quality
- The Express.js application utilizes **Morgan** for standard HTTP access logging (recording Method, URL, Status, Response Time, and `traceId`).
- Internal errors are logged via `console.error` (which Docker captures).
- Currently, logs are **not** centralized into an external provider (e.g., Datadog, ELK). They must be viewed locally via `docker compose logs -f server`.

### Nginx Logs
- Raw access and error logs are maintained locally at `/var/log/nginx/`.
- Nginx log rotation is handled automatically by Ubuntu's default `logrotate` daemon configuration.
