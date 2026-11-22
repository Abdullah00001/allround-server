# Flutter Mobile Integration Guide

Integration contract for the **Flutter iOS/Android app** against the Allround backend.

| Item | Value |
| --- | --- |
| API base | `https://allround.localbox.online/api/v1` |
| OpenAPI / Swagger UI | `https://allround.localbox.online/api-docs` |
| Auth model | Bearer JWT + device session (`deviceId` claim) |
| Spec source of truth | [`openapi.yaml`](../openapi.yaml) |

**Seed users (after `npm run prisma:seed`):**

| Role | Email | Password |
| --- | --- | --- |
| Site Manager | `manager@allround.com` | `Manager123!` |
| Employee | `employee@allround.com` | `Employee123!` |

> **How to use this doc:**  
> Sections **1–2** are shared (auth + envelopes).  
> Then jump to **§3 Employee** or **§4 Site Manager** for role-specific screens and APIs.  
> Section **§5** is Site Manager–only advanced project management (project list tabs/filters, tasks, measurements, notes, settings, media).  
> Sections **6–8** (offline sync, notifications/Socket/FCM, localization) apply to **both** roles.

---

## 1. Shared Authentication (Bearer JWT)

Mobile auth is **stateless Bearer**, not cookies. There is **no mobile refresh endpoint**. When the access JWT or device session expires, the user must **login again**.

### Tokens

| Step | Token field | Use |
| --- | --- | --- |
| `POST /auth/signup` | `data.token` | **OTP page JWT** for verify/resend only |
| `POST /auth/verify` | `data.accessToken` | App access JWT |
| `POST /auth/login` | `data.token` | App access JWT |

Persist the access JWT with **`flutter_secure_storage`**. Never store it in plain SharedPreferences.

### Device identity & FCM

Every login/verify must send a stable **`deviceIdentifier`** (install UUID) plus:

- `platform`: `ANDROID` \| `IOS`
- `lat`, `lng`
- optional `fcmToken`

The access JWT embeds `deviceId`. Protected mobile routes validate that device session (`ACTIVE`, not expired/revoked).

**There is no `x-device-id` header.** Device identity is JWT + body fields only.

### Signup → verify

```http
POST /api/v1/auth/signup
{
  "firstName": "Anna",
  "lastName": "Schmidt",
  "email": "employee@allround.com",
  "role": "EMPLOYEE",
  "password": "Employee123!",
  "phone": "1234567890"
}
```

Use `"role": "SITE_MANAGER"` for site-manager signup.

Then:

```http
POST /api/v1/auth/verify
Authorization: Bearer <otpPageToken>
{
  "otp": "123456",
  "deviceIdentifier": "<stable-uuid>",
  "platform": "ANDROID",
  "lat": 50.92,
  "lng": 6.95,
  "fcmToken": "<fcm>"
}
```

### Login (must send the correct `role`)

```http
POST /api/v1/auth/login
{
  "email": "employee@allround.com",
  "password": "Employee123!",
  "role": "EMPLOYEE",
  "deviceIdentifier": "<stable-uuid>",
  "platform": "ANDROID",
  "lat": 50.92,
  "lng": 6.95,
  "fcmToken": "<fcm>",
  "rememberMe": true
}
```

Site manager login uses the same shape with `"role": "SITE_MANAGER"`.

`rememberMe: true` → longer JWT/session (~30d). `false` → ~7d.

Store `data.user.role` from the login response and route the user into the **Employee** or **Site Manager** navigation shell.

### Session heartbeat

```http
POST /api/v1/auth/check
Authorization: Bearer <accessJwt>
{
  "deviceIdentifier": "<stable-uuid>",
  "platform": "ANDROID",
  "lat": 50.92,
  "lng": 6.95,
  "fcmToken": "<rotated-fcm-if-any>"
}
```

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessJwt>
```

JWT is blacklisted; FCM cleared; device marked logged out. Clear secure storage + disconnect sockets.

### Dio interceptor (shared)

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();
final dio = Dio(BaseOptions(
  baseUrl: 'https://allround.localbox.online/api/v1',
  connectTimeout: const Duration(seconds: 20),
));

dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await storage.read(key: 'access_token');
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  },
  onError: (error, handler) async {
    if (error.response?.statusCode == 401) {
      // TOKEN_*, SESSION_*, DEVICE_* → force re-login (no refresh API)
      await storage.delete(key: 'access_token');
    }
    handler.next(error);
  },
));
```

**Critical:** After login/verify, save the JWT **and** register/refresh FCM via login/verify/`/auth/check`.

---

## 2. Shared Response Envelopes

- Success: `{ success, message, data?, meta?, traceId }`
- **List pagination** (same as admin / alua): every mobile **list** GET accepts `?page=1&limit=10` (max `100`) and returns `meta: { total, totalPages, links }` plus the page window in `data`.
  - Array lists → `data: T[]`
  - Dashboard → `data: { stats, upcomingTasks, mapPins }` (`meta` uses `max(upcomingTasks, mapPins)` totals; both arrays sliced)
  - Crew-time → aggregates stay full-window; `data.logs` is paginated (`meta.total` = log count)
  - Measurements → `data: { items, totalArea }` (`totalArea` = all rows; `meta` on item count)
  - Tasks → omit `status` → `{ open, completed }` both sliced; or `status=OPEN|COMPLETED` → flat `data: T[]`
- Errors: `{ success: false, message, errorType?, errors?, traceId }`

Common mobile `errorType`s: `ACTIVE_TIMER_EXISTS`, `TIMELOG_NOT_FOUND`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `DEVICE_NOT_FOUND`, `DEVICE_NOT_OWNED`, `ACCESS_DENIED`, `FORBIDDEN`, `BAD_REQUEST`.

All `/mobile/*` routes require:

```text
Authorization: Bearer <accessJwt>
(+ ACTIVE user + valid device session)
```

---

## 3. EMPLOYEE Role — Full Flow & APIs

Use this section when `user.role === "EMPLOYEE"`.

### 3.1 What an Employee can do

1. Boot config / legal / languages  
2. See personal dashboard, own projects, profile  
3. Start / stop timer, optional manual time, view own time logs  
4. Offline sync of own time segments  
5. Notifications inbox + Socket.IO / FCM  

### 3.2 What an Employee must NOT call

These routes return **403** for employees (`checkSiteManagerRoleMiddleware`):

| Path | Why blocked |
| --- | --- |
| `GET /mobile/schedule` | Site Manager only (employees use `/mobile/employee/schedule`) |
| `GET /mobile/map` | Site Manager only |
| `GET /mobile/crew-time` | Site Manager only |
| `GET /mobile/inspections` | Site Manager only |
| `GET /mobile/inspections/:id` | Site Manager only |
| `PATCH /mobile/inspections/:id/complete` | Site Manager only |
| `GET /mobile/phases` | Site Manager only |
| `PATCH /mobile/phases/:id/status` | Site Manager only |
| `PATCH /mobile/projects/:projectId` | Site Manager only |
| `GET` / `POST` `/mobile/projects/:projectId/tasks` | Site Manager only |
| `PATCH /mobile/tasks/:taskId/toggle` | Site Manager only |
| `DELETE /mobile/tasks/:taskId` | Site Manager only |
| `GET` / `POST` `/mobile/projects/:projectId/measurements` | Site Manager only |
| `DELETE /mobile/projects/:projectId/measurements/:id` | Site Manager only |
| `GET` / `POST` `/mobile/projects/:projectId/notes` | Site Manager only |
| `DELETE /mobile/projects/:projectId/notes/:id` | Site Manager only |
| `PATCH /mobile/projects/:projectId/phases/:phaseId/dates` | Site Manager only |
| `GET /mobile/projects/:projectId` | Site Manager only (detail hub) — employees use `/mobile/employee/projects/:projectId` |
| `GET/POST /mobile/projects/:projectId/attachments` | Site Manager only — employees use `/mobile/employee/projects/:projectId/photos` |
| `GET /mobile/projects/:projectId/history` | Site Manager only |
| `DELETE /mobile/projects/:projectId/attachments/:id` | Site Manager only |

**Do not render** Schedule, Map, Crew Time, Inspections, Phase Board, or SM Project Management write tabs for employees. Use **Employee Project Detail** APIs below for Assignment / Project Details.

### 3.3 Employee screen flow

```text
Login (role=EMPLOYEE)
  → GET /mobile/config
  → GET /mobile/dashboard
  → GET /mobile/employee/schedule        (My Plan)
  → GET /mobile/employee/projects/:projectId   (Assignment / Project Detail)
  → GET /mobile/employee/projects/:projectId/photos
  → GET /mobile/employee/projects/:projectId/tasks
  → GET /mobile/employee/time-tracking/summary
  → GET /mobile/employee/time-tracking/projects
  → POST /mobile/employee/timer/start    ({ projectId, activityType })
  → POST /mobile/employee/timer/stop     (Active Timer → Save Entry)
  → POST /mobile/employee/timer/manual
  → GET /mobile/employee/time-logs?period=WEEK
  → (offline) queue locally → POST /mobile/sync
  → GET /mobile/profile
  → GET /mobile/notifications
```

### 3.4 Employee API reference

#### Bootstrap

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/config` | `defaultLanguage`, `enabledLanguages`, `allowEmployeeManualTime`, `allowSiteManagerCreateProject`, `legalContents[]`, **`enums`** (all API enum catalogs) |

If `allowSiteManagerCreateProject === false`, hide Site Manager “create project” UI (`POST /mobile/projects` → **403**).

If `allowEmployeeManualTime === false`, hide the “Add manual time” UI.

**`data.enums` (source of truth for dropdowns):** bind forms to these arrays — do **not** invent values (e.g. `PLANNED` / `NOT_STARTED` are invalid).

| Key | Values |
| --- | --- |
| `phaseStatus` | `ENQUIRY`, `QUOTATION`, `ORDER_CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `POSTPONED` |
| `phaseType` | `ERECTION`, `DISMANTLING`, `STANDING`, `MAINTENANCE` |
| `priority` | `HIGH`, `MEDIUM`, `LOW` |
| `activityType` | `ERECTION`, `DISMANTLING`, `TRANSPORT`, `MAINTENANCE`, `OTHER` |
| `customerCategory` | `COMMERCIAL`, `MUNICIPALITY`, `ARCHITECT`, `PRIVATE` |
| `inspectionStatus` | `PENDING`, `SURVEY_DONE`, `CONVERTED` |
| `timeLogStatus` | `PENDING_APPROVAL`, `APPROVED`, `REJECTED` |
| `projectNoteCategory` | `SITE_ACCESS`, `CUSTOMER_REQUEST`, `OPEN_POINTS`, `AGREEMENTS`, `SPECIAL_REQUIREMENTS`, `LOCAL_CONTACT`, `GENERAL`, `SAFETY`, `INTERNAL` |
| `attachmentCategory` | `PHOTO`, `PDF_PLAN`, `OTHER` |
| `measurementUnit` | `M`, `M2`, `PCS` |
| `scheduleDataType` | `erection`, `dismantling`, `standing`, `other` (lowercase — for `scheduleData[].type`) |
| `role` | `ADMIN`, `SITE_MANAGER`, `EMPLOYEE` |
| `language` | `DE`, `EN`, … |

UI label **“Not Started” / “Planned”** → send `status: "ENQUIRY"` (or omit `status`; create defaults to `ENQUIRY`).

#### Home / work

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/dashboard` | `?page&limit` → `stats` + paginated `upcomingTasks[]` / `mapPins[]` |
| `GET` | `/mobile/projects` | `?page&limit` (+ tabs/filters) — phase cards |
| `GET` | `/mobile/profile` | Identity + `language` + `weeklyHoursTarget`, `hoursThisWeek`, project counts. Also enqueues a dummy `SYSTEM_ALERT` test notification (alua-style) when the worker is running |
| `PATCH` | `/mobile/profile` | Self-update: optional `firstName`, `lastName`, `phone`, `avatarUrl` (null clears), `language` (≥1 field). Same response as GET |
| `GET` | `/mobile/employee/schedule` | **My Plan** — `startDate`/`endDate` day buckets from **your** crew assignments |
| `POST` | `/settings/password` | Change password (EMPLOYEE + SITE_MANAGER). Revokes other devices; keeps current session |
| `POST` | `/settings/language` | **Preferred** language picker path (alua). Body `{ "language": "RO" }` → upserts `UserPreference`; profile `language` + localization follow |

**PATCH body notes:** no phone format validation; upload avatar via `POST /media` then pass URL. Not patchable: `email`, `role`, `status`, `password`, `weeklyHoursTarget`.

**Change password body:** `{ "currentPassword": "...", "newPassword": "..." }`. `newPassword`: 8–32 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 special. Wrong/reused → **400** unified message. Other active devices get `RevokeReason.PASSWORD_CHANGED`.

**My Schedule / My Plan (EMPLOYEE UI you shared):** use **`GET /mobile/employee/schedule`** only.  
OpenAPI tag: **`EmployeeMySchedule`**. Built from **your** `CrewAssignment` days (`siteManagers`, `assignedHours`, type legend).  
Do **not** use SM `GET /mobile/schedule` for this screen — that is a different Site Manager calendar.

Employee project DTOs **do not** expose site-manager financial fields (`budgetedHours` / profitability). Those appear only for site managers.

#### Assignment / Project Detail (Employee-only)

OpenAPI tag: **`EmployeeProjectDetail`**. Read-only; requires crew/PM assignment (**403** otherwise).

| Screen | Method | Path | Notes |
| --- | --- | --- | --- |
| Assignment Detail / Project Details | `GET` | `/mobile/employee/projects/:projectId` | phase badge, name, address/coords, site access, SM contact+phone, scaffold area/label, photo+task previews, `localization` |
| Photos → View All | `GET` | `/mobile/employee/projects/:projectId/photos` | `?page&limit` PHOTO only |
| Tasks list | `GET` | `/mobile/employee/projects/:projectId/tasks` | own tasks only; optional `status=OPEN\|COMPLETED` |
| Start New Timer | `POST` | `/mobile/employee/timer/start` | use `projectId` (or `phase.id` from detail) |
| Active Timer / Save Entry | `GET` summary + `POST` stop | `/mobile/employee/time-tracking/summary`, `/mobile/employee/timer/stop` | `activeTimer` + `{ timeLogId }` |

Do **not** call SM `GET /mobile/projects/:projectId` for this UI.

#### Time Tracking tab (Employee-only)

OpenAPI tag: **`EmployeeTimeTracking`**. All under `/mobile/employee/*` — do **not** reuse SM `/mobile/timer/*` for this UI.

| Step | Method | Path | Notes |
| --- | --- | --- | --- |
| Header card | `GET` | `/mobile/employee/time-tracking/summary` | today/week hours, target, week label, `activeTimer` |
| Assigned Project dropdown | `GET` | `/mobile/employee/time-tracking/projects` | `{ id, name, phaseId, phaseType }` |
| Start New Timer | `POST` | `/mobile/employee/timer/start` | `{ projectId, activityType }` |
| Stop | `POST` | `/mobile/employee/timer/stop` | `{ timeLogId }` |
| + Add Time | `POST` | `/mobile/employee/timer/manual` | `{ projectId, activityType, startTime, endTime, breakMinutes }` → **`PENDING_APPROVAL`** |
| Recent Logs | `GET` | `/mobile/employee/time-logs` | `period=WEEK` \| `MONTH` — includes `project` + `synced` |
| Offline | `POST` | `/mobile/sync` | Shared sync — see **§6** |

`activityType`: `ERECTION` \| `DISMANTLING` \| `TRANSPORT` \| `MAINTENANCE` \| `OTHER`.

**409** `ACTIVE_TIMER_EXISTS` if a timer is already open. Manual **403** when `allowEmployeeManualTime` is false.

#### Notifications (employee)

| Method | Path |
| --- | --- |
| `GET` | `/mobile/notifications?page&limit` → `{ items, unreadCount }` |
| `PATCH` | `/mobile/notifications/read-all` |
| `PATCH` | `/mobile/notifications/:id/read` |

**Which activities send push:** see **[Mobile Push Notifications](mobile-push-notifications.md)** (Employee vs Site Manager event matrix).

### 3.5 Employee checklist

1. Login with `"role": "EMPLOYEE"`.  
2. Build **Employee** navigation only (no SM tabs).  
3. Load `/mobile/config` and respect `allowEmployeeManualTime`.  
4. Implement timer + offline sync with stable `clientSyncId`.  
5. Connect Socket.IO + FCM for notifications.  
6. Treat 403 on SM routes as a programming error (wrong role shell).

---

## 4. SITE MANAGER Role — Full Flow & APIs

Use this section when `user.role === "SITE_MANAGER"`.

### 4.1 What a Site Manager can do

Everything an employee can do for **their own** time tracking, **plus**:

1. Schedule calendar  
2. Map of projects / active phases  
3. Crew-time overview per project  
4. Inspection survey inbox + complete survey (optional convert-to-project)  
5. Phase board (status updates)  
6. Richer project DTO (budget / hours / profitability fields)  
7. **Full project management** on accessible projects — deep filters, tasks, measurements, notes, dates/settings, PHOTO / PDF_PLAN attachments (see **§5**)

### 4.2 Access rule (`siteManagerAccessRule`)

Stored on `CompanyProfile` (`id: "global"`):

| Value | Effect |
| --- | --- |
| `RESTRICT_TO_ASSIGNED` (seed default) | Dashboard / projects / schedule / map limited to projects with a `ProjectManagerAssignment` for this SM |
| `GLOBAL_ACCESS` | SM can **see** all non-deleted projects on dashboard/projects/schedule/map |

**Important nuances:**

- Inspections are **always** filtered by `siteManagerId` (assignment), even under `GLOBAL_ACCESS`.  
- `GET /mobile/phases` lists phases on projects where the SM has a **ProjectManagerAssignment** (assignment-based list).  
- Crew-time / phase status writes allow `GLOBAL_ACCESS` **or** project/phase assignment via middleware.

### 4.3 Site Manager screen flow

```text
Login (role=SITE_MANAGER)
  → GET /mobile/config
  → GET /mobile/dashboard          (stats: pendingInspections, standingActiveSites, erection/dismantling planned+running)
  → GET /mobile/schedule           (Calendar month dots / phases)
  → GET /mobile/inspections?status=PENDING&startDate&endDate  (Calendar day list)
  → GET /mobile/map                (project pins)
  → GET /mobile/projects?tab&search&phaseTypes&phaseStatuses&priorities&categories&lat&lng&radiusKm&sortBy
  → POST /mobile/projects  (create; coordinates from map)
       → one card per phase (MobileProjectPhaseCardDTO)
       → GET /mobile/projects/:projectId   (detail hub / Overview)
       → GET /mobile/crew-time?projectId=...
       → GET /mobile/phases?column=ENQUIRY|ERECTION|DISMANTLING|STANDING
       → PATCH /mobile/phases/:id/status
       → GET/POST /mobile/projects/:projectId/tasks
       → PATCH /mobile/tasks/:taskId/toggle  |  DELETE /mobile/tasks/:taskId
       → GET/POST /mobile/projects/:projectId/measurements
       → PATCH/DELETE /mobile/projects/:projectId/measurements/:id
       → GET/POST /mobile/projects/:projectId/notes
       → PATCH/DELETE /mobile/projects/:projectId/notes/:id
       → PATCH /mobile/projects/:projectId
       → PATCH /mobile/projects/:projectId/phases/:phaseId/dates
       → GET /mobile/projects/:projectId/attachments?category=PHOTO|PDF_PLAN
       → POST /media  →  POST /mobile/projects/:projectId/attachments
       → DELETE /mobile/projects/:projectId/attachments/:id
       → GET /mobile/projects/:projectId/history
  → GET /mobile/inspections?status=PENDING|COMPLETED
       → GET /mobile/inspections/:id
       → PATCH /mobile/inspections/:id/complete  (notes + photos + optional convertToProject → projectId)
  → Own timer / time-logs / sync   (same as employee)
  → GET /mobile/notifications
```

### 4.4 Shared APIs Site Managers also use

Same as employee — call these freely:

| Method | Path |
| --- | --- |
| `GET` | `/mobile/config` |
| `GET` | `/mobile/dashboard` |
| `GET` | `/mobile/projects` |
| `GET` / `PATCH` | `/mobile/profile` |
| `POST` | `/settings/password` |
| `POST` | `/mobile/timer/start` | `phaseId` required (SM/shared) |
| `POST` | `/mobile/timer/stop` |
| `POST` | `/mobile/timer/manual` | `phaseId` required |
| `GET` | `/mobile/time-logs` |
| `POST` | `/mobile/sync` |
| `GET` / `PATCH` | `/mobile/notifications...` |

Employee-only Time / My Plan live under `/mobile/employee/*` — SM must not use those routes.

Site managers are **not** blocked by `allowEmployeeManualTime` for manual entries.

Project list cards for SM may include `budgetedHours`, `totalLoggedHours`, `isProfitable`.

Dashboard `stats` for SM also includes `standingActiveSites` and per-type `{ planned, running }` for `erection` / `dismantling`.

### 4.5 Site Manager–only API reference

#### Schedule & map (SM Calendar)

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/mobile/schedule` | **required** `startDate`, `endDate` + `page&limit` → day buckets `{ date, phases[] }` (SM only) |
| `GET` | `/mobile/map` | optional `type` + `page&limit` → project pins |

**Calendar screen:**

| UI | API |
| --- | --- |
| Month dots Erection / Dismantling / Half-day | `GET /mobile/schedule` → `phases[].type` (`ERECTION` / `DISMANTLING` / `STANDING`\|`MAINTENANCE`) |
| Day list under “SCHEDULE FOR …” / “No inspections assigned” | `GET /mobile/inspections?status=PENDING&startDate=<day>&endDate=<day>` |

Do **not** expect inspections on schedule day buckets.

#### Crew time

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/mobile/crew-time` | **required** `projectId`, optional `date` + `page&limit` |

Returns `totalProjectHours`, `hoursByActivity[]`, `crewBreakdown[]`, paginated `logs[]` (`meta` = log count).

#### Inspections (assigned to this SM)

| Method | Path | Query / Body |
| --- | --- | --- |
| `GET` | `/mobile/inspections` | `status=PENDING` (default) or `COMPLETED` + `page&limit`; optional `startDate`+`endDate` (appointmentDate window; Calendar day panel) |
| `GET` | `/mobile/inspections/:id` | Detail (must be assigned); includes `projectId` when converted |
| `PATCH` | `/mobile/inspections/:id/complete` | See **§5.7 Survey Completion** (scaffold specs + notes + photos + optional `convertToProject`) |

#### Phase board

| Method | Path | Query / Body |
| --- | --- | --- |
| `GET` | `/mobile/phases` | optional `column=ENQUIRY\|ERECTION\|DISMANTLING\|STANDING` + `page&limit` |
| `PATCH` | `/mobile/phases/:id/status` | `status`: `IN_PROGRESS` \| `COMPLETED` \| `POSTPONED` |

`column=ENQUIRY` filters `status=ENQUIRY` (UI label **Preconstruction**). Other columns filter by phase `type`.

Project-management CRUD (filters, detail hub, tasks, measurements, notes, settings, attachments, history) is documented in **§5**.

### 4.6 Site Manager checklist

1. Login with `"role": "SITE_MANAGER"`.  
2. Build **Site Manager** navigation (Schedule, Map, Crew Time, Inspections, Phases, Project Detail PM tabs + own Timer).  
3. Handle 403 if assignment/global rule denies a project.  
4. Complete inspections only when status is `PENDING`.  
5. Wire project-detail tabs to **§5** (Overview detail GET / tasks / measurements / notes / dates / attachments / history).  
6. Use same offline sync + Socket/FCM stack as employees.  

---

## 5. Site Manager: Advanced Project Management

Use this section when building the **project detail** screens for `user.role === "SITE_MANAGER"`.

Site Managers have **full CRUD** on these project sub-resources for every project they can access (`GLOBAL_ACCESS` **or** `ProjectManagerAssignment`). Employees must **not** call these routes (403).

OpenAPI tag: **`MobileProjectManagement`**.

> **Auth:** All routes below require Site Manager role + valid Bearer/device session.  
> Project-scoped routes also require the project to exist (`deletedAt: null`) and pass `checkSiteManagerProjectAccessMiddleware`.


### 5.0 Create project (map location)

Site Managers create projects via `POST /mobile/projects`. **Address is taken from the map** as required `coordinates: { lat, lng }`. Optional `placeLabel` (place name from the map picker) is stored as the DB address; if omitted the server stores `"lat, lng"`.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/mobile/projects` | SM only → returns project detail hub (`201`) |

```http
POST /api/v1/mobile/projects
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "name": "Goltstein Complex",
  "coordinates": { "lat": 50.9375, "lng": 6.9603 },
  "placeLabel": "Goltsteinstrasse, Köln",
  "scaffoldSpecification": { "area": 450, "height": 8.2, "type": "Fassadengerüst" },
  "priority": "HIGH",
  "phaseType": "ERECTION",
  "status": "ENQUIRY",
  "customer": { "mode": "EXISTING", "customerId": "<uuid>" },
  "contact": {
    "name": "Tim Muller",
    "phone": "+0325654514",
    "email": "you33@gmail.com"
  },
  "scheduleData": [
    {
      "type": "erection",
      "startDate": "2026-09-18T07:00:00.000Z",
      "endDate": "2026-09-20T19:00:00.000Z",
      "durationDays": 2.5
    },
    {
      "type": "dismantling",
      "startDate": "2026-09-25T07:00:00.000Z",
      "endDate": "2026-09-25T07:00:00.000Z",
      "durationDays": 0
    }
  ],
  "note": { "category": "SITE_ACCESS", "content": "Gate code 4821" },
  "photos": [{ "url": "https://cdn.example.com/a.jpg", "fileType": "image/jpeg", "isCover": true }]
}
```

New client: `"customer": { "mode": "NEW", "name": "Acme GmbH", "category": "COMMERCIAL" }`.  
`siteManagerId` optional (defaults to the authenticated SM). Upload files with `POST /media` first, then pass URLs in `photos`.

**Scaffold specification:** send `scaffoldSpecification: { area, height?, type? }`. Detail `GET /mobile/projects/:id` returns the same shape — `area` from `Project.scaffoldArea`, `height`/`type` from the seeded initial measurement (same pattern as inspection convert). Legacy `scaffoldArea` alone still works as area-only.

### 5.1 Project list (phase cards), tabs, filters & sort

Filter-modal option lists are **hardcoded in Flutter** (no `filter-options` endpoint).  
Location is exposed as `coordinates: { lat, lng }`. Project `address` / `city` / site-contact fields are **not** returned on mobile project APIs (contacts via `customer.primaryContact`).

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/projects` | **One card per phase** + tabs/filters/sort/search/geo + `page&limit` + `meta` |
| `GET` | `/mobile/projects/:projectId` | Detail hub — coordinates, scaffoldSpecification, `scheduleData[]`, nextSafetyInspection, labor, customer, phases, attachment counts |

#### `scheduleData` flow (create ↔ detail) — same shape, no magic

| Field | Create (POST body) | Detail (GET response) | Where stored |
| --- | --- | --- | --- |
| `type` | required lowercase | same lowercase | `ProjectPhase.type` (`erection`→`ERECTION`, `other`→`MAINTENANCE`) |
| `startDate` | required | returned | `ProjectPhase.startDate` |
| `endDate` | optional (or computed) | returned | `ProjectPhase.endDate` |
| `durationDays` | optional if `endDate` sent | returned | `ProjectPhase.durationDays` |
| `id` | not sent | returned (phase UUID) | `ProjectPhase.id` |

**Server rules on create:** `startDate` required; send **`endDate` and/or `durationDays`**.  
- only `durationDays` → `endDate = startDate + durationDays`  
- only `endDate` → `durationDays` derived  
- both → both stored (`endDate` as given)

**Detail** reads those columns back into `scheduleData[]` — nothing invented beyond that mapping. Full phase rows also live in `phases[]` (status, priority, safety flag).

`scheduleData[].type`: `erection` \| `dismantling` \| `standing` \| `other`  
UI: Scaffold Erection→`erection`, Dismantling→`dismantling`, Standing→`standing`, Other Activity→`other`.

Each list row includes `phaseId`, `type`, `status`, `priority`, dates, `projectId` / `projectName`, `coordinates`, `customer`, `assigneeName`, and (SM only) budget / logged hours / `isProfitable`. Contact comes from `customer` (not duplicated).

#### Tab (`tab`)

| Value | Server filter |
| --- | --- |
| `ALL` (default) | Non-deleted projects in the user’s visibility scope |
| `ACTIVE` | Has a phase in `IN_PROGRESS` or `ORDER_CONFIRMED` |
| `MY_PROJECTS` | User is a project manager **or** has a crew assignment on a phase |
| `THIS_WEEK` | Has a phase whose `startDate` or `endDate` falls in the current UTC ISO week |
| `INSPECTION` | Linked customer has at least one `PENDING` inspection |

#### Filter modal (CSV or repeated query params)

| Query | Filters on |
| --- | --- |
| `search` | Case-insensitive contains on project `name` |
| `phaseTypes` | Phase rows of these `PhaseType`s — **CSV multi-select** (e.g. `ERECTION,DISMANTLING`) |
| `phaseStatuses` | Phase rows of these `PhaseStatus`s — use `COMPLETED` for the Completed filter |
| `lat` + `lng` | Geo center (both required together); refined with Haversine |
| `radiusKm` | Geo radius in km (default `25`) |
| `priorities` | Phase rows of these `Priority`s — **CSV multi-select** |
| `categories` | `customer.category` `IN (...)` — **CSV multi-select** |

Coordinates on cards/detail/map are always `{ "lat": number, "lng": number } | null` (never separate latitude/longitude fields).

UI label **Preconstruction** maps to phase status `ENQUIRY` (do not invent a `PhaseType`).

#### Sort (`sortBy`)

| Value | Behavior |
| --- | --- |
| `NEWEST` (default) | Parent project `createdAt` descending |
| `NEXT_INSPECTION` | Earliest pending customer `appointmentDate` first |
| `NAME_AZ` | Project name ascending |

```http
GET /api/v1/mobile/projects?tab=ACTIVE&search=haupt&phaseTypes=ERECTION,DISMANTLING&priorities=HIGH,MEDIUM&categories=COMMERCIAL,PRIVATE&lat=50.94&lng=6.96&radiusKm=30&sortBy=NAME_AZ
Authorization: Bearer <accessJwt>
```

Employees may still call `GET /mobile/projects` (assignment-scoped, no financial fields). Tabs/filters/sort are available on the same endpoint for both roles when params are sent.

### 5.2 Task Management

Site Managers can list, create, toggle completion, and delete project tasks. Assignees must be an active `EMPLOYEE` or `SITE_MANAGER`.

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/mobile/projects/:projectId/employees` | `?search&page&limit` → assignee picker (`id`, `firstName`, `lastName`, `avatarUrl`, `role`) + `meta` |
| `GET` | `/mobile/projects/:projectId/tasks` | `?page&limit` (+ optional `status=OPEN\|COMPLETED`) → `{ open, completed }` or flat array + `meta` |
| `POST` | `/mobile/projects/:projectId/tasks` | `description`, `employeeId`, `priority`, optional `dueDate` |
| `PATCH` | `/mobile/tasks/:taskId/toggle` | — (flips `isCompleted`) |
| `DELETE` | `/mobile/tasks/:taskId` | — → `{ id }` |

**Assign Employee dropdown:** call `GET /mobile/projects/:projectId/employees` before create. Use a row’s `id` as `employeeId` on `POST .../tasks`. Optional `search` filters first/last name.

```http
GET /api/v1/mobile/projects/<projectId>/employees?search=Tim&page=1&limit=20
Authorization: Bearer <accessJwt>

POST /api/v1/mobile/projects/<projectId>/tasks
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "description": "Check scaffold anchors on north facade",
  "employeeId": "<user-uuid>",
  "priority": "HIGH",
  "dueDate": "2026-11-20T17:00:00.000Z"
}
```

`title` is derived server-side from the first line of `description` (no separate title field in the payload).

List response shape:

```json
{
  "open": [ /* MobileProjectTaskDTO */ ],
  "completed": [ /* MobileProjectTaskDTO */ ]
}
```

Each task includes `employee: { id, firstName, lastName, avatarUrl }` (nullable if unassigned historically).

### 5.3 Measurements

Line items store `length`, `height`, `quantity`, optional `position` / `remark`, and `unit` (`M` \| `M2` \| `PCS`, default `M`).

**Area formula:** `area = length × height × quantity`  
Creating, updating, or deleting a line item **recalculates** `Project.scaffoldArea` as the sum of remaining measurement areas.

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/mobile/projects/:projectId/measurements` | `?page&limit` → `{ items, totalArea }` (`totalArea` = all rows) + `meta` |
| `POST` | `/mobile/projects/:projectId/measurements` | `length`, `height`, `quantity`, optional `position`, `unit`, `remark` |
| `PATCH` | `/mobile/projects/:projectId/measurements/:id` | Any of create fields (≥1 required); recalculates `area` + `scaffoldArea` |
| `DELETE` | `/mobile/projects/:projectId/measurements/:id` | — → `{ id }` |

```http
POST /api/v1/mobile/projects/<projectId>/measurements
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "position": "Facade A",
  "length": 12.5,
  "height": 8.0,
  "quantity": 1,
  "unit": "M",
  "remark": "North wall"
}
```

### 5.4 Project Notes

Categorized notes store author + timestamp. Site Managers can list, create, update, and delete.

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/mobile/projects/:projectId/notes` | `?page&limit` → note[] (newest first) + `meta` |
| `POST` | `/mobile/projects/:projectId/notes` | `category`, `content` |
| `PATCH` | `/mobile/projects/:projectId/notes/:id` | optional `category`, `content` (≥1 required) |
| `DELETE` | `/mobile/projects/:projectId/notes/:id` | — → `{ id }` |

`category` enum (mobile Zod; legacy `SAFETY` / `INTERNAL` remain in DB but are not accepted on create/update):

| Value | Typical UI label |
| --- | --- |
| `SITE_ACCESS` | Site Access |
| `CUSTOMER_REQUEST` | Customer Request |
| `OPEN_POINTS` | Open Points |
| `AGREEMENTS` | Agreements |
| `SPECIAL_REQUIREMENTS` | Special Requirements |
| `LOCAL_CONTACT` | Local Contact |
| `GENERAL` | General |

```http
POST /api/v1/mobile/projects/<projectId>/notes
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "category": "SITE_ACCESS",
  "content": "Gate code 4821. Call site contact on arrival."
}
```

### 5.5 Dates & Project Settings

#### Edit project details / primary phase fields

| Method | Path | Body |
| --- | --- | --- |
| `PATCH` | `/mobile/projects/:projectId` | Elaborate project fields **except customer** (≥1 required) |

Allowed body fields:

- Project: `name`, `coordinates` (`{ lat, lng }` or `null`), `budgetedHours`, `scaffoldArea`, `siteAccessCode`, `siteAccessNotes`
- Primary phase (most recently updated): `phaseType`, `status`, `priority`, `startDate`, `endDate`, `durationDays`, `safetyInspectionComplete`

Customer linkage cannot be changed from mobile.

```http
PATCH /api/v1/mobile/projects/<projectId>
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "name": "Scaffold Site A",
  "coordinates": { "lat": 50.9375, "lng": 6.9603 },
  "budgetedHours": 120,
  "siteAccessCode": "4821",
  "siteAccessNotes": "Use rear gate",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "phaseType": "ERECTION",
  "startDate": "2026-11-18T07:00:00.000Z",
  "endDate": "2026-11-22T16:00:00.000Z",
  "durationDays": 5
}
```

#### Edit phase schedule / safety inspection

| Method | Path | Body |
| --- | --- | --- |
| `PATCH` | `/mobile/projects/:projectId/phases/:phaseId/dates` | Any of: `startDate`, `endDate`, `durationDays`, `safetyInspectionComplete` (≥1 required) |

```http
PATCH /api/v1/mobile/projects/<projectId>/phases/<phaseId>/dates
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "startDate": "2026-11-18T07:00:00.000Z",
  "endDate": "2026-11-22T16:00:00.000Z",
  "durationDays": 5,
  "safetyInspectionComplete": true
}
```

### 5.6 Media & PDFs (Attachments) + History

Attachments **do not** upload binary through the mobile project routes. Follow the existing shared Media flow, then register the URL on the project.

1. **Upload file(s) to S3** via `POST /api/v1/media` (multipart `files`, max 10). Response returns public URL string(s).  
2. **List / register / delete** on the project:

| Method | Path | Body / Query |
| --- | --- | --- |
| `GET` | `/mobile/projects/:projectId/attachments` | optional `category=PHOTO\|PDF_PLAN` + `page&limit` → includes `isCover` |
| `POST` | `/mobile/projects/:projectId/attachments` | `url`, `fileType`, `category`, optional `fileName`, `fileSize`, `isCover` |
| `PATCH` | `/mobile/projects/:projectId/attachments/:id/cover` | Sets this PHOTO as cover; clears other project photo covers |
| `DELETE` | `/mobile/projects/:projectId/attachments/:id` | — → `{ id }` (DB row only; S3 object is not deleted) |
| `GET` | `/mobile/projects/:projectId/history` | `?page&limit` AuditLog timeline + `meta` |

`category` for project attachments:

| Value | Use |
| --- | --- |
| `PHOTO` | Site / progress photos |
| `PDF_PLAN` | Plan PDFs / drawings |

```http
POST /api/v1/mobile/projects/<projectId>/attachments
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "url": "https://cdn.example.com/uploads/plan-a.pdf",
  "fileType": "application/pdf",
  "category": "PDF_PLAN",
  "fileName": "plan-a.pdf",
  "fileSize": 245760
}
```

Use the same Media upload endpoint as admin (`POST /media`); then choose `PHOTO` vs `PDF_PLAN` when registering so the Flutter UI can bucket galleries vs plans.

### 5.7 Survey Completion

`PATCH /mobile/inspections/:id/complete` still requires a **PENDING** inspection assigned to the Site Manager. It now accepts survey notes, photo URLs, and an optional convert-to-project action (the red “Convert to Project” button).

| Field | Required | Notes |
| --- | --- | --- |
| `scaffoldArea` | ✅ | positive number |
| `scaffoldHeight` | ✅ | positive number |
| `scaffoldType` | ✅ | non-empty string |
| `siteAccessInstructions` | optional | saved on the inspection |
| `specialRequirements` | optional | saved on the inspection |
| `photos` | optional | `[{ url, fileType }]` — stored as `Attachment` rows linked to the **inspection** (`category: PHOTO`) |
| `convertToProject` | optional | default `false`. When `true`, creates Project + Measurement + Phase, assigns SM as PM, sets status **`CONVERTED`**, sets `inspection.projectId` |
| `projectName` | optional | used when converting (defaults to `siteTitle`) |
| `phaseType` | optional | initial phase when converting (defaults to `ERECTION`) |

```http
PATCH /api/v1/mobile/inspections/<id>/complete
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "scaffoldArea": 120.5,
  "scaffoldHeight": 8.2,
  "scaffoldType": "Fassade",
  "siteAccessInstructions": "Gate code 1234",
  "specialRequirements": "No weekend work",
  "photos": [
    {
      "url": "https://cdn.example.com/uploads/survey-1.jpg",
      "fileType": "image/jpeg"
    }
  ],
  "convertToProject": true,
  "projectName": "Köln Hauptbahnhof Scaffold",
  "phaseType": "ERECTION"
}
```

**Status outcomes:**

| `convertToProject` | Resulting `status` |
| --- | --- |
| `false` / omitted | `SURVEY_DONE` |
| `true` | `CONVERTED` (+ optional `data.convertedProject: { id, name }`) |

Upload survey photos with `POST /media` first, then pass the returned URLs in `photos[]` (same pattern as project attachments).

### 5.8 Flutter implementation notes

1. Gate **all §5 routes** behind the Site Manager shell.  
2. On project open, load tasks / measurements / notes in parallel; refresh after each create/delete/toggle.  
3. After measurement create/delete, refresh any UI that shows total scaffold area (server owns the sum).  
4. Treat 403 on project-scoped routes as “not assigned / no global access” — show empty state or navigate back.  
5. Prefer OpenAPI schemas under tag `MobileProjectManagement` for codegen.

---

## 6. Offline Sync (`POST /mobile/sync`) — Both Roles

When the device is offline, queue completed timer segments locally. On reconnect:

```http
POST /api/v1/mobile/sync
Authorization: Bearer <accessJwt>
Content-Type: application/json

{
  "logs": [
    {
      "clientSyncId": "550e8400-e29b-41d4-a716-446655440000",
      "phaseId": "<uuid>",
      "activityType": "ERECTION",
      "startTime": "2026-11-12T08:00:00.000Z",
      "endTime": "2026-11-12T12:00:00.000Z",
      "breakMinutes": 30
    }
  ]
}
```

`phaseId` must be a real `ProjectPhase` UUID (from schedule / assigned-projects / timer APIs). **Do not send `projectId` as `phaseId`.**

### Server pipeline

1. Auth + device session  
2. Zod body validation (`422` on bad shape)  
3. **`checkSyncTimeLogPhasesMiddleware`** — every distinct `logs[].phaseId` must exist; otherwise **`404 PHASE_NOT_FOUND`** (no inserts)  
4. Service — create new logs / skip known `clientSyncId`

### Idempotency rule

- Generate a **stable UUID `clientSyncId` per offline log** when the log is first created on device.  
- Persist it until the server acknowledges creation **or** skip.  
- Resubmitting the same `clientSyncId` is **safe** — duplicates are skipped (`clientSyncId` is unique).

### Response `data` (`200`)

```json
{
  "created": 1,
  "skipped": 1,
  "logs": [ /* newly created MobileTimeLogDTO only */ ]
}
```

Synced rows are stored as `isManual: false`, `status: APPROVED`.

### Errors

| Status | `errorType` | When |
| --- | --- | --- |
| `404` | `PHASE_NOT_FOUND` | Any `logs[].phaseId` missing / deleted — whole batch rejected before inserts |
| `422` | validation | Invalid UUID, empty `logs`, `endTime` ≤ `startTime`, etc. |

On `404`, fix or drop the bad offline queue row; retries with the same invalid `phaseId` will keep failing.

**Critical:** Never regenerate `clientSyncId` on retry — that creates duplicate payroll hours.

---

## 7. Notifications, Socket.IO & FCM — Both Roles

Event matrix (which activity pushes to Employee vs SM): **[mobile-push-notifications.md](mobile-push-notifications.md)**.

### REST

| Method | Path |
| --- | --- |
| `GET` | `/mobile/notifications?page&limit` → `{ items, unreadCount }` + `meta` |
| `PATCH` | `/mobile/notifications/read-all` |
| `PATCH` | `/mobile/notifications/:id/read` |

### Socket.IO (foreground)

| Item | Value |
| --- | --- |
| Namespace | `/api/v1/notification` |
| Auth | `auth: { token: <accessJwt> }` |
| Room | Auto `user:{userId}` |

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

late IO.Socket socket;

Future<void> connectNotificationSocket(String accessToken) async {
  socket = IO.io(
    'https://allround.localbox.online/api/v1/notification',
    IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': accessToken})
        .enableAutoConnect()
        .build(),
  );

  socket.onConnect((_) {
    socket.emit('notification:count');
  });

  socket.on('notification:count-response', (data) {
    // data['count'] → badge
  });

  socket.on('notification:new', (data) {
    // { id, type, title, message, link, isRead, createdAt }
  });

  socket.on('notification:read', (data) {});
  socket.on('notification:all-read', (data) {});
  socket.on('error:server', (err) {});
}
```

Client → server: `notification:mark-read` `{ notificationId }`, `notification:mark-all-read`.

### FCM (background / killed)

1. **Foreground:** Prefer Socket.IO; optional local notification from FCM.  
2. **Background / terminated:** `firebase_messaging` handlers; on tap open notifications + `GET /mobile/notifications`.  
3. **Token refresh:** send via `POST /auth/check` or next login.  
4. **Logout:** server clears FCM; delete token locally too.

Worker data keys typically include `title`, `body`/`message`, `type`, `click_action: FLUTTER_NOTIFICATION_CLICK`.

---

## 8. Localization — Both Roles

1. After auth, call **`GET /mobile/config`**.  
2. Build language picker from `enabledLanguages` / `defaultLanguage` (catalog has **20** codes incl. optional `HU`; company typically enables the client **19**: DE, EN, TR, PL, RO, FR, ES, IT, NL, PT, RU, UK, BG, HR, SR, SQ, EL, HI, AR). Use `preferredLanguage` (from `UserPreference`) as the selected UI language. Locales: `hi` (Hindi), `ar` (Arabic).  
3. Change language with **`POST /settings/language`** `{ "language": "RO" }` (alua path; Flutter picker) — or **`PATCH /mobile/profile`** `{ "language": "RO" }`. Both upsert `UserPreference`; do **not** rely on `x-locale` alone or profile will keep showing the old `language`.
4. Cache **`data.enums`** and validate dropdowns against those lists (never invent statuses like `PLANNED`).  
5. Render Privacy / Terms from `legalContents` — bodies follow the user’s preferred language after auth (Translation pipeline). Public `GET /legal/:type` still needs `x-locale` (no user session).  
6. Optional override: send `x-locale` / `?locale=` to force a locale for one request (wins over preference).  
7. **Alua `localization` meta (full system)** — every client-facing **employee / SM / admin** API that returns dynamic entity text includes:

```json
"localization": {
  "sourceLocale": "de",
  "displayedLocale": "en",
  "isTranslated": true,
  "translationStatus": "READY"
}
```

   **Excluded:** `/auth/*`, `/recover/*`, password change, media binary, CSV exports, id-only deletes, static enums.  
   Nested objects (customer on project, user on timelog, etc.) carry their own `localization` when they have translatable fields. Use `translationStatus` (`PENDING` / `PROCESSING` / `READY` / `FAILED`) to know when to refresh.

---

## Quick comparison (cheat sheet)

| Feature | Employee | Site Manager |
| --- | --- | --- |
| Login `role` | `EMPLOYEE` | `SITE_MANAGER` |
| `/mobile/config` | ✅ | ✅ |
| `/mobile/dashboard` | ✅ | ✅ (+ pending inspections count for SM) |
| `/mobile/projects` | ✅ | ✅ (+ budget fields + tabs/filters/sort) |
| Project tasks / measurements / notes | ❌ 403 | ✅ full CRUD |
| Project settings + phase dates | ❌ 403 | ✅ |
| Project attachments (`PHOTO` / `PDF_PLAN`) | ❌ 403 | ✅ |
| `/mobile/profile` GET/PATCH | ✅ | ✅ |
| `/settings/password` | ✅ | ✅ |
| `/settings/language` | ✅ | ✅ |
| Timer start/stop/manual/logs/sync | ✅ | ✅ |
| `/mobile/employee/schedule` | ✅ | ❌ 403 |
| `/mobile/employee/time-tracking/*` + `/mobile/employee/timer/*` | ✅ | ❌ 403 |
| `/mobile/schedule` | ❌ 403 | ✅ |
| `/mobile/map` | ❌ 403 | ✅ |
| `/mobile/crew-time` | ❌ 403 | ✅ |
| `/mobile/inspections*` | ❌ 403 | ✅ (+ convertToProject on complete) |
| `/mobile/phases*` | ❌ 403 | ✅ |
| Notifications + Socket + FCM | ✅ | ✅ |

---

## Quick start checklist

### Shared
1. Persist install `deviceIdentifier` + JWT in secure storage.  
2. Login/verify with FCM; heartbeat via `/auth/check`.  
3. Branch UI on `user.role`.  
4. Offline queue with immutable `clientSyncId` → `/mobile/sync`.  
5. Connect Socket.IO `/api/v1/notification`; handle FCM in background.  
6. On any session 401 → clear tokens and re-login (no refresh API).

### Employee shell
- Screens: Dashboard, Projects, Time (`/mobile/employee/time-tracking/*` + timer), My Plan (`/mobile/employee/schedule`), Profile, Notifications, Settings/Legal.  
- Never call SM-only endpoints (`/mobile/schedule`, map, crew-time, inspections, phases, project PM CRUD).

### Site Manager shell
- All employee screens **plus** Schedule, Map, Crew Time, Inspections, Phase Board, and Project Management tabs (filters, tasks, measurements, notes, dates/settings, media).  
- Respect assignment / `GLOBAL_ACCESS` behavior and 403s.  
- See **§5** for project sub-resource CRUD contracts.
