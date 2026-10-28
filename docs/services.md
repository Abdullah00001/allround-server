# Services & Integration Architecture

## 1. BullMQ / Workers / Scheduler

ALUA Academy Management utilizes a distributed job queue architecture to offload heavy synchronous tasks and schedule recurring crons, maintaining high API responsiveness.

### Architecture Breakdown
- **server (Producer):** Enqueues asynchronous tasks (e.g., sending an email, processing an image) into the BullMQ queues and returns an immediate response to the client.
- **scheduler (Producer):** A lightweight Node.js daemon that runs purely to enqueue recurring or future-dated tasks. It does not process jobs itself.
- **worker (Consumer):** A dedicated, horizontally-scalable Node.js daemon running BullMQ workers. It actively polls Valkey (Redis) to consume and process the queued jobs.

### Job Lifecycle
1. The server or scheduler pushes a job payload into a specific queue (e.g., `emailQueue`) backed by Valkey.
2. The `worker` container, running in a completely isolated process, pulls the job from Valkey.
3. If the worker throws an error during processing, BullMQ automatically handles retries (with exponential backoff) and eventual movement to the dead-letter/failed queue.
4. Worker logic must always remain idempotent to handle retry semantics safely.

---

## 2. Redis / Valkey

ALUA Academy Management leverages **Valkey** (an open-source Redis fork, fully Redis-compatible) as the primary in-memory data store.

### Roles
1. **BullMQ Backend:** All queues, jobs, and retry mechanisms are persisted within Valkey.
2. **Socket.IO Adapter:** Valkey operates as a fast pub/sub mechanism to synchronize Socket.IO events across multiple Node.js server instances (allowing the system to scale horizontally in the future without losing WebSocket synchronization).
3. **Caching:** (If implemented at the application layer) Standard volatile caching for high-read, low-write entities.

### Connection Lifecycle
Connections to Valkey are established immediately during the bootstrap phase (`src/app.ts`). Connection logic is strictly isolated in `src/app/configs/redis.configs.ts`. The application features reconnect/retry mechanisms natively via the `ioredis` library to tolerate transient network drops.

---

## 3. Socket.IO

The system integrates **Socket.IO** for real-time, bi-directional communication.

### Implementation Details
- **Initialization:** Socket.IO runs concurrently alongside the Express.js HTTP server.
- **Nginx Proxying:** Nginx is explicitly configured to upgrade the HTTP request to a WebSocket connection (`Connection: upgrade`, `Upgrade: websocket`), enabling Socket.IO traffic to bypass standard HTTP buffering.
- **Authentication:** Middleware intercepts the connection handshake, extracts the JWT from headers/cookies, and validates the session before admitting the socket connection.

---

## 4. External Services

The ALUA Academy Management backend is deeply integrated with several critical third-party external services.

### DigitalOcean Container Registry (DOCR)
- **Purpose:** Secure, private hosting of our Docker images (`alua-academy-management-server`, `worker`, `scheduler`).
- **Integration:** Authenticated via the `DO_REGISTRY_TOKEN` within GitHub Actions.

### DigitalOcean Spaces (S3 Compatible)
- **Purpose:** Persistent blob storage for Club images, Event thumbnails, and User avatars.
- **Integration:** Handled using the `@aws-sdk/client-s3` library initialized in `server/src/app/configs/s3Client.configs.ts`.

### Firebase Cloud Messaging (FCM)
- **Purpose:** Sending reliable Push Notifications to Android and iOS client devices.
- **Integration:** Managed via the `worker` service queue.

### SMTP Email Provider
- **Purpose:** Transactional emails (OTPs, Welcome Emails, Receipts).
- **Integration:** Standard NodeMailer / SMTP integration managed within the `worker` service. Needs valid `SMTP_*` environment credentials.
