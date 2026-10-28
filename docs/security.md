# Authentication & Security Model

## 1. Authentication Flow

ALUA Academy Management utilizes **JSON Web Tokens (JWT)** for stateless, highly scalable authentication.

### Flow
1. A client initiates a login via email/password or OAuth (Google/Apple).
2. The authentication controller validates the request (via Zod), verifies the hashed credentials (via bcrypt), and queries PostgreSQL via Prisma.
3. Upon success, the server generates an opaque JWT signed with a highly secure symmetric key (`JWT_ACCESS_SECRET`).
4. The JWT is transmitted securely to the client.
5. All subsequent protected API requests must include the JWT in the `Authorization: Bearer <token>` header.

### Authorization & Role-Based Access Control (RBAC)
The database enforces strict Roles via the `AccountRole` Enum: `USER`, `ADMIN`, `CLUB_OWNER`.
Auth middlewares intercept HTTP requests, decode the JWT, verify the signature, query the user role, and explicitly reject unauthorized access (`HTTP 403 Forbidden`) before the controller is ever invoked.

---

## 2. Security Infrastructure

### Firewall Isolation
- The DigitalOcean Cloud Firewall prevents direct exposure of the internal Node.js container port (`5000`), the PostgreSQL port (`5432`), and the Valkey port (`6379`) to the public internet.
- Only ports `80` and `443` are publicly accessible.
- SSH (`22`) is restricted purely to `162.4.34.65/32`.

### Application Security Protections
- **Helmet**: Bootstrapped globally to set strict HTTP security headers (XSS filters, nosniff, etc.).
- **Validation**: Incoming payloads are aggressively validated through `zod`. Malformed payloads, SQL injection attempts, and excessive payloads are filtered out before reaching business logic.
- **Passwords**: Stored exclusively via salt and hash using `bcrypt`. Plaintext passwords never enter the database.

### Secret Management
- Development secrets are placed in a `.env` file that is strictly ignored in `.gitignore`.
- Production secrets reside inside GitHub Actions (as Encrypted Secrets) and are injected securely into the Droplet via SSH during the SCP deployment phase, forming an isolated `/opt/alua-academy-management-server/.env` file owned strictly by the `deploy` user.
- **DO NOT** commit `.env`, Terraform output files (`tf_output.json`), or SSH private keys. (A historical incident involving leaked Terraform state serves as a reminder to always verify `.gitignore` boundaries).

---

## 3. GitHub Actions Secrets

The CI/CD pipeline requires the following secrets securely stored in GitHub:
- `DIGITALOCEAN_ACCESS_TOKEN`: The DO API token used by Terraform, Doctl, and firewall manipulation.
- `DO_SSH_PRIVATE_KEY`: The ED25519 private key matching the `deploy` user on the Droplet.
- `DO_REGISTRY_TOKEN`: Required by Docker to pull from the private DO Container Registry.
