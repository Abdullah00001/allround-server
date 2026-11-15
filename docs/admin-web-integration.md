# Admin Web Integration Guide

Integration contract for the **React / Next.js Admin Dashboard** against the Allround backend.

| Item | Value |
| --- | --- |
| API base | `https://allround.localbox.online/api/v1` |
| OpenAPI / Swagger UI | `https://allround.localbox.online/api-docs` |
| Health | `https://allround.localbox.online/health` |
| Auth model | HTTP-only cookies + CSRF double-submit |
| Spec source of truth | [`openapi.yaml`](../openapi.yaml) |

**Seed admin (after `npm run prisma:seed`):**

| Email | Password |
| --- | --- |
| `admin@allround.com` | `Admin123!` |

---

## 1. Authentication Flow (Cookie + CSRF)

Admin sessions **do not** use `Authorization: Bearer`. After login the API sets three cookies and returns a readable CSRF token.

### Cookies set on login / refresh

| Cookie | `httpOnly` | Purpose |
| --- | --- | --- |
| `access_token` | yes | Short-lived admin JWT (~15 minutes) |
| `refresh_token` | yes | Session renewal (`3d`, or `30d` if `rememberMe`) |
| `admin_csrf_token` | **no** | Double-submit CSRF value (JS can read it) |

### Login request

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "admin@allround.com",
  "password": "Admin123!",
  "rememberMe": false
}
```

**Success (200):**

```json
{
  "success": true,
  "message": "...",
  "data": {
    "admin": {
      "id": "...",
      "fullName": "...",
      "email": "admin@allround.com",
      "phone": null,
      "avatarUrl": null,
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  },
  "csrfToken": "<same value as admin_csrf_token cookie>",
  "traceId": "..."
}
```

### Protected admin calls

Every CRM route under `/api/v1/admin/*` (except login) requires:

1. Browser / Axios **`withCredentials: true`** so cookies are sent.
2. Header **`x-csrf-token`** equal to the `admin_csrf_token` cookie / login `csrfToken`.

Mismatch → **403** with `errorType: "FORBIDDEN"`.

### Session lifecycle

| Endpoint | CSRF required | Notes |
| --- | --- | --- |
| `POST /admin/auth/login` | No | Sets cookies + returns `csrfToken` |
| `POST /admin/auth/check` | Yes | Returns current admin session |
| `POST /admin/auth/refresh` | Yes | Rotates access/refresh/csrf cookies; returns new `csrfToken` |
| `POST /admin/auth/logout` | Yes | Clears cookies + blacklists access JWT |

**Critical:** Refresh before the access cookie expires (~15m). Store the latest `csrfToken` from login **and** refresh responses.

### Axios interceptor example

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL, // e.g. https://allround.localbox.online/api/v1
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('csrfToken') : null;

export function setCsrfToken(token: string) {
  csrfToken = token;
  localStorage.setItem('csrfToken', token);
}

api.interceptors.request.use((config) => {
  const isLogin = config.url?.includes('/admin/auth/login');
  if (!isLogin && csrfToken) {
    config.headers['x-csrf-token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const next = response.data?.csrfToken;
    if (typeof next === 'string' && next.length > 0) {
      setCsrfToken(next);
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const errorType = error.response?.data?.errorType;

    // One silent refresh attempt on expired access token
    if (
      status === 401 &&
      (errorType === 'TOKEN_EXPIRED' || errorType === 'TOKEN_INVALID') &&
      !original._retry &&
      !original.url?.includes('/admin/auth/refresh')
    ) {
      original._retry = true;
      try {
        const refresh = await api.post('/admin/auth/refresh');
        if (refresh.data?.csrfToken) setCsrfToken(refresh.data.csrfToken);
        return api(original);
      } catch {
        // Force re-login in the UI
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Critical:** Next.js browser calls to a different origin need CORS allowlist + `credentials`. Local whitelist lives in `server/src/const.ts` (`corsWhiteList`). Add your Next origin there for local/staging.

---

## 2. Response Envelopes

### Success

```json
{
  "success": true,
  "message": "Customers fetched successfully.",
  "data": {},
  "traceId": "uuid"
}
```

Paginated lists also include:

```json
{
  "meta": {
    "total": 42,
    "totalPages": 5,
    "links": {
      "currentPage": "...",
      "nextPage": "...",
      "previousPage": "...",
      "firstPage": "...",
      "lastPage": "..."
    }
  }
}
```

### Domain / auth errors

```json
{
  "success": false,
  "message": "Customer not found",
  "errorType": "CUSTOMER_NOT_FOUND",
  "traceId": "uuid"
}
```

Common `errorType` values: `TOKEN_EXPIRED`, `TOKEN_INVALID`, `TOKEN_BLACKLISTED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `ACCESS_DENIED`, `USER_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, `INSPECTION_NOT_FOUND`, `INSPECTION_ALREADY_CONVERTED`, `PROJECT_NOT_FOUND`, `PHASE_NOT_FOUND`, `TIMELOG_NOT_FOUND`, `NOTIFICATION_NOT_FOUND`, `BAD_REQUEST`.

### Validation errors (422)

```json
{
  "success": false,
  "message": "Request body validation failed",
  "errors": [{ "field": "email", "message": "Invalid email" }],
  "traceId": "uuid"
}
```

---

## 3. Core Flow & API Reference

All paths below are relative to `/api/v1` and require **cookies + `x-csrf-token`** unless noted.

### 3.0 Admin home dashboard

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | `page`, `limit` (paginate **today's operations** only) |

**`data` shape**

| Field | Content |
| --- | --- |
| `stats` | `plannedErections`, `erectionInProgress`, `standingScaffolds`, `plannedDismantling`, `dismantlingInProgress`, `inspectionDue` |
| `map.counts` | Legend badges: `erection`, `standing`, `dismantling` (from active pins) |
| `map.pins[]` | `{ projectId, name, coordinates: { lat, lng } \| null, phaseType }` — one pin per project with an active phase |
| `todaysOperations[]` | `{ phaseId, projectId, projectName, customerName, managerName, phaseType, crewCount }` for **UTC today** (same overlap rules as daily planning) |

`meta` is built from `todaysOperations` total. Planned = `ENQUIRY` / `QUOTATION` / `ORDER_CONFIRMED`; in-progress = `IN_PROGRESS`; standing scaffolds = distinct projects with an active `STANDING` phase; `inspectionDue` = global `PENDING` inspections.

### 3.1 CRM → Pre-Sales → Project conversion

**Recommended UI sequence**

1. Create / search a **Customer**.
2. Optionally add **contacts**.
3. Create an **Inspection** for that customer (assign a site manager).
4. After survey work, **convert** the inspection into a **Project** + first phase.

#### Customers

| Method | Path | Body / query |
| --- | --- | --- |
| `POST` | `/admin/customers` | `name`, `category` (`COMMERCIAL` \| `MUNICIPALITY` \| `ARCHITECT` \| `PRIVATE`), `address`, optional `latitude`/`longitude`, optional `contacts[]` |
| `GET` | `/admin/customers` | `page`, `limit`, optional `search`, `category` |
| `GET` | `/admin/customers/:id` | — |
| `PATCH` | `/admin/customers/:id` | any of `name`, `category`, `address`, `latitude`, `longitude` (≥1 field) |
| `POST` | `/admin/customers/:id/contacts` | `name`, `role`, optional `phone`/`email`, `isPrimary` |

There is **no** admin delete-customer route today.

#### Inspections (admin ↔ mobile parity)

Status tabs map to the same Prisma enums the app uses: `PENDING` (Awaiting Survey), `SURVEY_DONE`, `CONVERTED`.

| Method | Path | Body / query |
| --- | --- | --- |
| `POST` | `/admin/inspections` | See create body below → **201** |
| `GET` | `/admin/inspections` | `page`, `limit`, optional `status`, `customerId`, `search` (customer name) |
| `GET` | `/admin/inspections/:id` | — |
| `PATCH` | `/admin/inspections/:id` | optional site/scaffold/notes; `photos` replaces PHOTO attachments (max 6); optional `contact` |
| `DELETE` | `/admin/inspections/:id` | soft delete; **409** if `CONVERTED` |
| `POST` | `/admin/inspections/:id/convert` | `projectName`, `phaseType` → **201** (also assigns SM as PM, like mobile) |

**List `data`:** `{ items[], stats, tabCounts }` + pagination `meta`.

| `stats` | Meaning |
| --- | --- |
| `totalInspections` | Non-deleted (respects `search` / `customerId`) |
| `totalSpecsArea` | Sum of `scaffoldArea` |
| `avgScaffoldHeight` | Avg of non-null `scaffoldHeight` |
| `awaitingSurvey` | `PENDING` count |
| `surveysCompleted` | `SURVEY_DONE` count |

`tabCounts`: `{ all, pending, surveyDone, converted }` (same search scope).

**Create body (aligned with mobile project NEW customer + survey fields):**

- `customer`: `{ mode: "EXISTING", customerId }` **or** `{ mode: "NEW", name, category? }`
- Required site: `siteTitle`, `address`, `appointmentDate`
- Optional: `siteManagerId`, `postalCode`, `city`, `scaffoldArea` / `scaffoldHeight` / `scaffoldType`
- Optional notes (same columns mobile complete writes): `siteAccessInstructions`, `specialRequirements`
- Optional `contact` → upserts primary `CustomerContact`
- Optional `photos[]` max **6** `{ url, fileType }` after `POST /media` (mobile complete allows up to 20)

**DTO extras (parity):** `projectId`, `siteAccessInstructions`, `specialRequirements`, `photos[]`, `photoCount`.

**Convert `data.project`:** `{ id, name, address, client, scaffoldArea, specs }` + `phase` + full `inspection`.

Convert/delete errors: `INSPECTION_NOT_FOUND`, `INSPECTION_ALREADY_CONVERTED`.

### 3.2 Projects CRM (parity with mobile)

Admin Projects reuses the same Prisma graph and mobile services for detail hub + child tabs. No synthetic `PRJ-…` codes — use UUID `id` / `projectId`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/projects` | Phase cards + `tabCounts`. Query: `page`, `limit`, `search`, `tab` (`ALL` \| `ACTIVE` \| `INSPECTION` \| `URGENT` \| `COMPLETED`), optional `phaseType` / `status` / `priority` |
| `POST` | `/admin/projects` | Same body as mobile create; **`siteManagerId` required**. Returns `MobileProjectDetailDTO` |
| `GET` | `/admin/projects/:id` | Mobile hub DTO (Overview): `scheduleData`, `scaffoldSpecification`, hours, crew, `attachmentCounts`, `nextSafetyInspection` |
| `PATCH` | `/admin/projects/:id` | Edit Master Data: `name`, `address`, `city`, `coordinates`, budget/scaffold/site access, optional primary-phase fields + `safetyInspectionComplete` |
| `DELETE` | `/admin/projects/:id` | Soft delete (`deletedAt`) |
| `POST` | `/admin/projects/:id/phases` | Kanban phase create |
| `PATCH` | `/admin/phases/:phaseId/status` | Kanban drag-and-drop; optional `safetyInspectionComplete` |
| `PATCH` | `/admin/projects/:projectId/phases/:phaseId/dates` | Dates tab (same body as mobile) |
| `GET`/`POST` | `/admin/projects/:projectId/tasks` | Tasks tab; query `status=OPEN\|COMPLETED` optional |
| `PATCH` | `/admin/tasks/:taskId/toggle` | Complete / reopen |
| `DELETE` | `/admin/tasks/:taskId` | Delete task |
| `GET`/`POST` | `/admin/projects/:projectId/measurements` | Measurement lines; area = L×H×qty |
| `PATCH`/`DELETE` | `/admin/projects/:projectId/measurements/:id` | Edit / delete line |
| `GET`/`POST` | `/admin/projects/:projectId/notes` | Notes (categories: Site Access, …) |
| `PATCH`/`DELETE` | `/admin/projects/:projectId/notes/:id` | Edit / delete note |
| `GET`/`POST` | `/admin/projects/:projectId/attachments` | Photos / PDF plans (`category`, `isCover`) |
| `PATCH` | `/admin/projects/:projectId/attachments/:id/cover` | Set cover photo |
| `DELETE` | `/admin/projects/:projectId/attachments/:id` | Delete attachment |
| `GET` | `/admin/projects/:projectId/history` | Audit timeline |

**List `data`:** `{ items: AdminProjectPhaseCardDTO[], tabCounts: { all, active, inspection, urgent, completed } }`.

**Card fields:** phase + project identity, address/city, customer `{ id, name, category }`, `coverUrl`, `assignedCrew[]` (initials), `budgetedHours` / `totalLoggedHours` / `isProfitable` (APPROVED hours).

Child list/create bodies match mobile (`docs/flutter-mobile-integration.md` project hub). Upload files via `POST /media` then register with attachment `url`.

### 3.3 Daily Planning (crew & vehicles)

| Method | Path | Body / query |
| --- | --- | --- |
| `GET` | `/admin/plannings/daily` | **required** `date=YYYY-MM-DD` |
| `GET` | `/admin/plannings/available-resources` | **required** `date`, optional `phaseId` |
| `POST` | `/admin/plannings/assign-crew` | `phaseId`, `userId`, `date`, `hours` (>0) → **201** |
| `POST` | `/admin/plannings/assign-vehicle` | `phaseId`, `userId`, `vehicleId`, `date` → **201** |

Typical UI flow: load daily board → fetch available resources → assign crew/vehicle.

### 3.4 Time Tracking (approve pending logs)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/time-logs` | Filter: `page`, `limit`, optional `projectId`, `userId`, `status` (`PENDING_APPROVAL` \| `APPROVED`), `startDate`/`endDate` |
| `POST` | `/admin/time-logs` | Admin manual entry: `userId`, `phaseId`, `activityType`, `startTime`, `endTime`, `breakMinutes` |
| `PATCH` | `/admin/time-logs/:id/approve` | Only when pending |
| `PATCH` | `/admin/time-logs/:id/reject` | Only when pending |
| `PATCH` | `/admin/time-logs/:id` | Edit fields; may require `reason` if company policy `requireReasonForTimeEdit` is on |
| `DELETE` | `/admin/time-logs/:id` | Soft/remove per service rules |

Non-pending approve/reject → **400** `BAD_REQUEST`.

### 3.5 Related workforce modules

| Area | Paths |
| --- | --- |
| Users | `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id` |
| Vehicles | `GET/POST /admin/vehicles`, `PATCH/DELETE /admin/vehicles/:id` |
| Absences | `GET/POST /admin/absences`, `DELETE /admin/absences/:id` |
| Notifications | `GET /admin/notifications`, `PATCH /admin/notifications/read-all`, `PATCH /admin/notifications/:id/read` |

Notification list `data` shape:

```json
{
  "items": [
    {
      "id": "...",
      "type": "PROJECT_ASSIGNED",
      "title": "...",
      "message": "...",
      "link": null,
      "isRead": false,
      "createdAt": "..."
    }
  ],
  "unreadCount": 3
}
```

### 3.6 Settings & access policies

**There is no admin REST settings controller today.** Company policies such as:

- `siteManagerAccessRule` (`RESTRICT_TO_ASSIGNED` \| `GLOBAL_ACCESS`)
- `allowEmployeeManualTime`
- `requireReasonForTimeEdit`
- `defaultLanguage` / `enabledLanguages`

are stored on `CompanyProfile` (`id: "global"`) and enforced by the API / seeded via Prisma. Mobile apps read a subset through `GET /mobile/config` (mobile bearer auth only).

Until an admin settings API ships, change policies via DB/seed/admin tooling—not via a dashboard HTTP route.

Media uploads (shared): `POST /api/v1/media`, `DELETE /api/v1/media` (see OpenAPI `Media` tag; follow the auth chain documented there).

---

## 4. Socket.IO Integration (Admin)

Realtime notifications use the **notification namespace**, Redis-backed across server replicas.

| Item | Value |
| --- | --- |
| Namespace | `/api/v1/notification` |
| Socket URL | `https://allround.localbox.online/api/v1/notification` |
| Auth | Browser sends the HttpOnly `access_token` cookie (`withCredentials: true`) |
| Room | Server auto-joins `user:{adminUserId}` |

### Client setup

```ts
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://allround.localbox.online/api/v1/notification', {
  withCredentials: true, // sends access_token cookie
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('notification socket connected', socket.id);
  socket.emit('notification:count');
});

socket.on('notification:count-response', (payload: { count: number }) => {
  // Update bell badge
});

socket.on('notification:new', (notification) => {
  // { id, type, title, message, link, isRead, createdAt }
  // Prepend to inbox + increment unread badge
});

socket.on('notification:read', ({ notificationId }) => {
  // Mark local row read
});

socket.on('notification:all-read', () => {
  // Clear unread badge
});

socket.on('error:server', (err) => {
  console.error('socket error', err);
});
```

### Events cheat sheet

| Direction | Event | Payload |
| --- | --- | --- |
| C→S | `notification:count` | — |
| C→S | `notification:mark-read` | `{ notificationId }` |
| C→S | `notification:mark-all-read` | — |
| S→C | `notification:count-response` | `{ count }` |
| S→C | `notification:new` | Notification DTO |
| S→C | `notification:read` | `{ notificationId }` |
| S→C | `notification:all-read` | `{ count }` |

**Critical:** Socket auth still requires a valid **ACTIVE** admin user and non-blacklisted JWT. After logout, disconnect the socket and clear CSRF storage.

Also keep REST polling/`GET /admin/notifications` as a fallback if the socket drops.

---

## Quick start checklist

1. Login → persist `csrfToken` → always send `x-csrf-token`.
2. Enable Axios `withCredentials`.
3. Refresh access session before 15 minutes elapse.
4. Implement CRM → Inspection → Convert → Kanban → Planning → Time approval.
5. Connect Socket.IO notification namespace with credentials for the bell.
6. Treat OpenAPI (`/api-docs`) as the live contract for field-level schemas.
