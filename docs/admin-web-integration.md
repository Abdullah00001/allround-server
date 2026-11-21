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
| `GET /admin/profile` | Yes | Self-profile (`firstName`, `lastName`, `email`, `phone`, `avatarUrl`, `role`, `language`, `createdAt`) |
| `PATCH /admin/profile` | Yes | Self-update: optional `firstName`, `lastName`, `phone`, `avatarUrl`, `language` (≥1 field) |
| `POST /admin/settings/password` | Yes | Change password; clears Redis sessions + cookies — re-login required |
| `GET /admin/settings/company` | Yes | Branding + access policies (`CompanyProfile`) |
| `PATCH /admin/settings/company` | Yes | Save Settings (displayName, logoUrl, siteManagerAccessRule, …) |
| `GET /admin/settings/languages` | Yes | Available languages grid (all 18 + enabled/default) |
| `PATCH /admin/settings/languages` | Yes | Update `defaultLanguage` / `enabledLanguages` |

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
| `GET` | `/admin/inspections` | `page`, `limit`, optional `status`, `customerId`, `search` (customer name), optional `startDate`+`endDate` (appointmentDate window; Calendar day panel) |
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

OpenAPI tag: **`AdminProjectManagement`** — same surface as mobile **`MobileProjectManagement`** (list/create/detail/settings, employees, tasks, measurements, notes, phase dates, attachments, history). Auth is cookie + `x-csrf-token` instead of Bearer.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/projects` | Phase cards + `tabCounts`. Tabs: `ALL` \| `ACTIVE` \| `INSPECTION` \| `URGENT` \| `COMPLETED`. Mobile-parity filters: `phaseTypes` / `phaseStatuses` / `priorities` / `categories` (CSV), `lat`+`lng`+`radiusKm`, `sortBy=NEWEST\|NEXT_INSPECTION\|NAME_AZ`. Legacy single `phaseType` / `status` / `priority` still work. |
| `POST` | `/admin/projects` | Same body as mobile create; **`siteManagerId` required**. Returns `MobileProjectDetailDTO` |
| `GET` | `/admin/projects/:id` | Mobile hub DTO (Overview): `scheduleData`, `scaffoldSpecification`, hours, crew, `attachmentCounts`, `nextSafetyInspection` |
| `PATCH` | `/admin/projects/:id` | Edit Master Data: `name`, `address`, `city`, `coordinates`, budget/`scaffoldArea`/`scaffoldSpecification.area`, site access, optional primary-phase fields + `safetyInspectionComplete` |
| `DELETE` | `/admin/projects/:id` | Soft delete (`deletedAt`) |
| `GET` | `/admin/schedule` | Calendar month dots — same as mobile (`startDate`+`endDate` required) → `{ date, phases[] }` day buckets |
| `GET` | `/admin/map` | Project map pins — same as mobile; optional `type` + `page&limit` |
| `GET` | `/admin/crew-time` | Crew time for a project — same as mobile; **required** `projectId`, optional `date` + `page&limit` |
| `GET` | `/admin/phases` | Phase board / Kanban columns: optional `column=ENQUIRY\|ERECTION\|DISMANTLING\|STANDING` + `page&limit` → `MobileManagedPhaseDTO[]` |
| `POST` | `/admin/projects/:id/phases` | Kanban phase create |
| `PATCH` | `/admin/phases/:phaseId/status` | Kanban drag-and-drop; optional `safetyInspectionComplete` |
| `PATCH` | `/admin/projects/:projectId/phases/:phaseId/dates` | Dates tab (same body as mobile) |
| `GET` | `/admin/projects/:projectId/employees` | Task assignee picker (`?search&page&limit`) → same as mobile (`id`, `firstName`, `lastName`, `avatarUrl`, `role`) |
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

#### Create project — EXISTING vs NEW customer

`POST /admin/projects` uses the same `customer` discriminated union as mobile. Differences vs mobile: cookie + CSRF auth, and **`siteManagerId` is required** (admin is not a site manager).

`contact` is **always required** (both modes).  
`status` must be a real `PhaseStatus` (`ENQUIRY` …) — no `PLANNED` / `NOT_STARTED` (UI “Planned” → `ENQUIRY`).

**Existing customer**

```http
POST /api/v1/admin/projects
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "name": "Goltstein Complex",
  "coordinates": { "lat": 50.9082, "lng": 6.9723 },
  "placeLabel": "Goltsteinstraße 12, Köln",
  "scaffoldSpecification": { "area": 450, "height": 15, "type": "Modular scaffold" },
  "priority": "MEDIUM",
  "phaseType": "ERECTION",
  "status": "ENQUIRY",
  "siteManagerId": "<site-manager-user-uuid>",
  "customer": {
    "mode": "EXISTING",
    "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  },
  "contact": {
    "name": "Andreas Weber",
    "phone": "+49654515151",
    "email": "abc@yopmail.com",
    "role": "Project lead"
  },
  "scheduleData": [
    {
      "type": "erection",
      "startDate": "2026-11-14T18:00:00.000Z",
      "endDate": "2026-11-18T08:30:00.000Z",
      "durationDays": 3
    },
    {
      "type": "dismantling",
      "startDate": "2026-11-29T08:30:00.000Z",
      "endDate": "2026-12-02T08:30:00.000Z",
      "durationDays": 3
    }
  ]
}
```

- Links project to `customerId`
- Upserts a new primary `CustomerContact` from `contact`
- Do **not** send `customer.name` / `customer.category`

**New customer**

```http
POST /api/v1/admin/projects
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "name": "Goltstein Complex",
  "coordinates": { "lat": 50.9082, "lng": 6.9723 },
  "placeLabel": "Goltsteinstraße 12, Köln",
  "scaffoldSpecification": { "area": 450, "height": 15, "type": "Modular scaffold" },
  "priority": "MEDIUM",
  "phaseType": "ERECTION",
  "status": "ENQUIRY",
  "siteManagerId": "<site-manager-user-uuid>",
  "customer": {
    "mode": "NEW",
    "name": "Hochtief AG",
    "category": "COMMERCIAL"
  },
  "contact": {
    "name": "Andreas Weber",
    "phone": "+49654515151",
    "email": "abc@yopmail.com",
    "role": "Project lead"
  },
  "scheduleData": [
    {
      "type": "erection",
      "startDate": "2026-11-14T18:00:00.000Z",
      "endDate": "2026-11-18T08:30:00.000Z",
      "durationDays": 3
    }
  ]
}
```

- Creates `Customer` (`name` required; `category` optional, default `COMMERCIAL`)
- Creates primary contact from `contact`
- Customer geo/address from project `coordinates` / `placeLabel`
- Do **not** send `customerId`

| | EXISTING | NEW |
| --- | --- | --- |
| `customer.mode` | `"EXISTING"` | `"NEW"` |
| Required | `customerId` | `name` |
| Optional | — | `category` |
| Do **not** send | `name` / `category` | `customerId` |
| Always | `siteManagerId`, `contact` | `siteManagerId`, `contact` |

#### Enums for admin dropdowns (same as mobile)

Use these exact strings (also in OpenAPI `MobileEnumsDTO` / `CreateMobileProjectRequest`):

| Field | Values |
| --- | --- |
| `status` / phase status | `ENQUIRY`, `QUOTATION`, `ORDER_CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `POSTPONED` |
| `phaseType` | `ERECTION`, `DISMANTLING`, `STANDING`, `MAINTENANCE` |
| `priority` | `HIGH`, `MEDIUM`, `LOW` |
| `customer.category` | `COMMERCIAL`, `MUNICIPALITY`, `ARCHITECT`, `PRIVATE` |
| `scheduleData[].type` | `erection`, `dismantling`, `standing`, `other` (lowercase) |
| Note `category` | `SITE_ACCESS`, `CUSTOMER_REQUEST`, `OPEN_POINTS`, `AGREEMENTS`, `SPECIAL_REQUIREMENTS`, `LOCAL_CONTACT`, `GENERAL`, `SAFETY`, `INTERNAL` |
| Attachment `category` | `PHOTO`, `PDF_PLAN`, `OTHER` |
| Measurement `unit` | `M`, `M2`, `PCS` |

OpenAPI: `POST /api/v1/admin/projects` requestBody examples `existingCustomer` / `newCustomer`.

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

### 3.6 Admin self-profile

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/profile` | Cookie + CSRF; returns `AdminProfileDTO` |
| `PATCH` | `/admin/profile` | Patchable: `firstName`, `lastName`, `phone` (no format), `avatarUrl` (URL or `null`), `language` |

### 3.6a Change password

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/admin/settings/password` | Cookie + CSRF; body `{ currentPassword, newPassword }` |

`newPassword`: 8–32 chars, ≥1 upper, ≥1 lower, ≥1 digit, ≥1 special. Wrong/reused current → **400** (unified message). On success, all admin Redis sessions are revoked and auth cookies cleared — redirect to login.

```http
POST /api/v1/admin/settings/password
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

### 3.6b Settings → Available languages

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/settings/languages` | Full catalog (18) + `defaultLanguage` + `enabledLanguages` |
| `PATCH` | `/admin/settings/languages` | Body may include `defaultLanguage` and/or `enabledLanguages` (≥1 field). Default is always kept in the enabled list. |

```http
GET /api/v1/admin/settings/languages
Cookie: access_token=...
x-csrf-token: ...

PATCH /api/v1/admin/settings/languages
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "defaultLanguage": "DE",
  "enabledLanguages": ["DE", "EN", "PL", "TR"]
}
```

Response `data`: `{ defaultLanguage, enabledLanguages, languages: [{ code, displayCode, name, locale, enabled, isDefault }] }`.

Mobile bootstrap already exposes the same company flags via `GET /mobile/config` → `defaultLanguage` / `enabledLanguages`. Localized APIs honor preference / `x-locale` / `?locale=` against the 18 supported locales and return alua `localization` meta (`sourceLocale`, `displayedLocale`, `isTranslated`, `translationStatus`) on translated entities. Publishing legal content pre-translates into every enabled language. Auth/recover routes are excluded.

### 3.6c Settings → Legal (LegalContent)

Admin **Legal** tab (Privacy Policy / Terms & Conditions rich-text + **Publish**). Same pattern as alua-academy-management.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/legal/:type` | Load editor; empty `content` + `updatedAt: null` if never published |
| `PATCH` | `/admin/legal/:type` | Publish — body `{ "content": "<html or markdown>" }` (min 1 char) |
| `GET` | `/legal/:type` | Public (no auth) — **404** if unpublished |

**`:type` values** (`LegalContentType`):

| UI label | `:type` |
| --- | --- |
| Privacy Policy | `PRIVACY_AND_POLICY` |
| Terms & Conditions | `TERMS_AND_CONDITION` |
| About Us | `ABOUT_US` |
| Data Protection | `DATA_PROTECTION` |

```http
GET /api/v1/admin/legal/PRIVACY_AND_POLICY
Cookie: access_token=...
x-csrf-token: ...

PATCH /api/v1/admin/legal/TERMS_AND_CONDITION
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{ "content": "<p>Updated terms…</p>" }
```

Response `data`: `{ legalContentType, content, updatedAt }`. Mobile already receives the same rows via `GET /mobile/config` → `legalContents[]`.

```http
PATCH /api/v1/admin/profile
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "firstName": "Admin",
  "lastName": "User",
  "phone": "+491234567890",
  "avatarUrl": "https://cdn.example.com/admin.jpg",
  "language": "DE"
}
```

Not patchable: `email`, `role`, `status`, `password`. Upload avatar via `POST /media` first. `language` upserts `UserPreference`.

### 3.7 Settings & access policies

System & company settings UI maps to:

| Tab / action | API |
| --- | --- |
| General branding + Access policies (Save Settings) | `GET` / `PATCH /admin/settings/company` |
| Languages (18) | `GET` / `PATCH /admin/settings/languages` |
| Legal | `GET` / `PATCH /admin/legal/:type` |
| Sync overview / Clear local cache & re-sync | Client-only (no server route) |
| Export all projects | `GET /admin/settings/export/projects` → CSV download |
| Export time logs | `GET /admin/settings/export/time-logs` → CSV download |
| Export customers | `GET /admin/settings/export/customers` → CSV download |
| Company logo upload | `POST /media` → then `PATCH` with `logoUrl` |

```http
GET /api/v1/admin/settings/export/projects
Cookie: access_token=...
x-csrf-token: ...
```

Response: `Content-Type: text/csv; charset=utf-8` + `Content-Disposition: attachment; filename="projects-YYYY-MM-DD.csv"`. Same pattern for `/customers` and `/time-logs`.

```http
GET /api/v1/admin/settings/company
Cookie: access_token=...
x-csrf-token: ...

PATCH /api/v1/admin/settings/company
Cookie: access_token=...
x-csrf-token: ...
Content-Type: application/json

{
  "displayName": "Allround Cockpit",
  "officialName": "Allround Gerüstbau GmbH",
  "taxId": "HRB 88412 - Köln",
  "headOffice": "Gottfriedstraße 12, 50968 Köln",
  "logoUrl": "https://cdn.example.com/logo.png",
  "siteManagerAccessRule": "RESTRICT_TO_ASSIGNED",
  "allowEmployeeManualTime": true,
  "allowSiteManagerCreateProject": false,
  "requireReasonForTimeEdit": false
}
```

`data`: `{ displayName, officialName, taxId, headOffice, logoUrl, siteManagerAccessRule, allowEmployeeManualTime, allowSiteManagerCreateProject, requireReasonForTimeEdit, updatedAt }`.

| Field | UI | Enforcement |
| --- | --- | --- |
| `siteManagerAccessRule` | Restrict / Grant global access | Mobile SM project scope |
| `allowEmployeeManualTime` | Employees can log manual time | Employee manual timer → 403 when false |
| `allowSiteManagerCreateProject` | SMs can create projects from the field | `POST /mobile/projects` → 403 when false |
| `requireReasonForTimeEdit` | Require reason when editing logged hours | Admin time-log PATCH |

Mobile reads the flags via `GET /mobile/config`.

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
