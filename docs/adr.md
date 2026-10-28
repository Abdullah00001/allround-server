# Architecture Decisions & Limitations

## 1. Architecture Decision Records (ADRs)

### ADR-01: DigitalOcean over AWS
- **Context:** The initial infrastructure design considered AWS, but the operational overhead and egress pricing were disproportionate to the early-stage needs of the platform.
- **Decision:** Shift exclusively to DigitalOcean for compute (Droplets), storage (Spaces), and managed databases.
- **Reason:** Predictable pricing, simplified Terraform logic, and excellent Managed PostgreSQL / Valkey offerings.
- **Current Status:** Accepted and fully implemented.

### ADR-02: Docker Compose over Kubernetes
- **Context:** Orchestrating multi-service Node.js architectures requires a robust container runtime.
- **Decision:** Utilize a single-node Docker Compose stack rather than DigitalOcean Kubernetes (DOKS).
- **Reason:** The operational burden of managing Helm, Ingress Controllers, and Kubernetes RBAC is unnecessary for a platform that can comfortably scale vertically on a single Droplet for its foreseeable lifecycle.
- **Current Status:** Accepted.

### ADR-03: Separation of Server, Worker, and Scheduler
- **Context:** Node.js operates on a single-threaded event loop. Running heavy tasks (like processing image uploads or compiling mass emails) on the main API process causes event loop lag, leading to increased HTTP latency for all users.
- **Decision:** Isolate concerns into three discrete Docker containers (`server`, `worker`, `scheduler`).
- **Reason:** The Express API (`server`) remains incredibly fast and responsive. CPU-intensive operations are offloaded via BullMQ to the `worker`. The `scheduler` remains purely responsible for Cron triggers without being bogged down by job execution.
- **Current Status:** Accepted and fully implemented.

### ADR-04: Immutable Release Tags in DOCR
- **Context:** Pushing `latest` to production frequently leads to unpredictable deployments, as pulling `latest` on a rollback might result in pulling the *broken* image.
- **Decision:** The CI/CD pipeline enforces strict Git tag resolution (e.g., `v1.0.14`).
- **Reason:** Guarantees that every deployment is cryptographically tied to a specific Git commit. Rollbacks are instantaneous and deterministic by simply redefining `IMAGE_TAG`.
- **Current Status:** Accepted and actively enforced by GitHub Actions.

### ADR-05: Ephemeral GitHub Actions Firewall Whitelist
- **Context:** GitHub Actions runners utilize dynamic IPs, making it impossible to whitelist a static IP in the DO Cloud Firewall for SCP/SSH deployment without exposing Port 22 to `0.0.0.0/0`.
- **Decision:** Implement a dynamic API call in the workflow that retrieves the runner's IP, injects it into the Firewall before SCP, and aggressively revokes it via an `if: always()` block post-deployment.
- **Reason:** Maintains strict zero-trust SSH access while fully automating the CD pipeline.
- **Current Status:** Accepted and proven highly reliable in production.

---

## 2. Current Limitations

The following components are intentionally absent from the architecture. They are documented here to prevent confusion and establish a roadmap for Step 12E and beyond.

### High Priority (Must Fix Soon)
- **External Uptime Monitoring**: No external service (e.g., UptimeRobot, Better Stack) is currently pinging `/health`. If the Droplet dies, the engineering team relies on manual discovery.
- **Centralized Error Tracking**: Uncaught exceptions inside the `worker` vanish into the `docker logs`. A tool like Sentry is highly recommended to capture background job failures automatically.

### Medium Priority
- **Web Application Firewall (WAF)**: Nginx is exposed directly to the internet. While robust, it lacks Layer 7 DDoS mitigation and sophisticated rate-limiting heuristics (e.g., Cloudflare).
- **CI/CD Notification Webhooks**: Developers must manually check the GitHub Actions tab to confirm if a `v*` deployment succeeded. A Slack/Discord integration would significantly improve visibility.

### Low Priority (Future Considerations)
- **Multi-Node Horizontal Scaling**: The architecture is currently bound to a single Docker Compose host. While Valkey Pub/Sub is integrated to support Socket.IO horizontal scaling, scaling out would require migrating from Docker Compose to Docker Swarm or Kubernetes.
- **Log Centralization**: Logs are currently rotated and kept locally via `json-file`. They are not shipped to an ELK stack or Datadog.
