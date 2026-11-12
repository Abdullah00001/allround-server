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
> Sections **5–7** (offline sync, notifications/Socket/FCM, localization) apply to **both** roles.

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
| `GET /mobile/schedule` | Site Manager only |
| `GET /mobile/map` | Site Manager only |
| `GET /mobile/crew-time` | Site Manager only |
| `GET /mobile/inspections` | Site Manager only |
| `GET /mobile/inspections/:id` | Site Manager only |
| `PATCH /mobile/inspections/:id/complete` | Site Manager only |
| `GET /mobile/phases` | Site Manager only |
| `PATCH /mobile/phases/:id/status` | Site Manager only |

**Do not render** Schedule, Map, Crew Time, Inspections, or Phase Board tabs for employees.

### 3.3 Employee screen flow

```text
Login (role=EMPLOYEE)
  → GET /mobile/config
  → GET /mobile/dashboard
  → GET /mobile/projects  (pick a phase / job)
  → POST /mobile/timer/start
  → POST /mobile/timer/stop
  → GET /mobile/time-logs?period=TODAY
  → (offline) queue locally → POST /mobile/sync
  → GET /mobile/profile
  → GET /mobile/notifications
```

### 3.4 Employee API reference

#### Bootstrap

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/config` | `defaultLanguage`, `enabledLanguages`, `allowEmployeeManualTime`, `legalContents[]` |

If `allowEmployeeManualTime === false`, hide the “Add manual time” UI.

#### Home / work

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/dashboard` | `stats`, `upcomingTasks[]`, `mapPins[]` (employee-scoped) |
| `GET` | `/mobile/projects` | Projects where the employee has crew assignments / visibility |
| `GET` | `/mobile/profile` | `weeklyHoursTarget`, `hoursThisWeek`, project counts |

Employee project DTOs **do not** expose site-manager financial fields (`budgetedHours` / profitability). Those appear only for site managers.

#### Time tracking (own logs only)

| Method | Path | Body / query |
| --- | --- | --- |
| `POST` | `/mobile/timer/start` | `phaseId`, `activityType`, optional `gpsStartLat` / `gpsStartLng` |
| `POST` | `/mobile/timer/stop` | `timeLogId`, optional GPS end |
| `POST` | `/mobile/timer/manual` | `phaseId`, `activityType`, `startTime`, `endTime`, `breakMinutes` → status **`PENDING_APPROVAL`** |
| `GET` | `/mobile/time-logs` | `?period=TODAY` \| `WEEK` \| `MONTH` |
| `POST` | `/mobile/sync` | Offline batch — see **§5** |

`activityType`: `ERECTION` \| `DISMANTLING` \| `TRANSPORT` \| `MAINTENANCE` \| `OTHER`.

Start while another timer is open → **409** `ACTIVE_TIMER_EXISTS`.

#### Notifications (employee)

| Method | Path |
| --- | --- |
| `GET` | `/mobile/notifications?page&limit` → `{ items, unreadCount }` |
| `PATCH` | `/mobile/notifications/read-all` |
| `PATCH` | `/mobile/notifications/:id/read` |

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
4. Inspection survey inbox + complete survey  
5. Phase board (status updates)  
6. Richer project DTO (budget / hours / profitability fields)

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
  → GET /mobile/dashboard          (stats include pendingInspections for this SM)
  → GET /mobile/schedule           (week view)
  → GET /mobile/map                (project pins)
  → GET /mobile/projects           (open project)
       → GET /mobile/crew-time?projectId=...
       → GET /mobile/phases
       → PATCH /mobile/phases/:id/status
  → GET /mobile/inspections
       → GET /mobile/inspections/:id
       → PATCH /mobile/inspections/:id/complete
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
| `GET` | `/mobile/profile` |
| `POST` | `/mobile/timer/start` |
| `POST` | `/mobile/timer/stop` |
| `POST` | `/mobile/timer/manual` |
| `GET` | `/mobile/time-logs` |
| `POST` | `/mobile/sync` |
| `GET` / `PATCH` | `/mobile/notifications...` |

Site managers are **not** blocked by `allowEmployeeManualTime` for manual entries.

Project list for SM may include `budgetedHours`, `totalLoggedHours`, `isProfitable`.

### 4.5 Site Manager–only API reference

#### Schedule & map

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/mobile/schedule` | **required** `startDate`, `endDate` (date-time) → days with phases |
| `GET` | `/mobile/map` | optional `type` = `ERECTION` \| `DISMANTLING` \| `STANDING` \| `MAINTENANCE` |

#### Crew time

| Method | Path | Query |
| --- | --- | --- |
| `GET` | `/mobile/crew-time` | **required** `projectId`, optional `date` |

Returns `totalProjectHours`, `hoursByActivity[]`, `crewBreakdown[]`, `logs[]`.

#### Inspections (assigned to this SM)

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/mobile/inspections` | List `PENDING` + `SURVEY_DONE` for `siteManagerId = me` |
| `GET` | `/mobile/inspections/:id` | Detail (must be assigned) |
| `PATCH` | `/mobile/inspections/:id/complete` | `scaffoldArea`, `scaffoldHeight`, `scaffoldType` (`PENDING` → `SURVEY_DONE`) |

#### Phase board

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/mobile/phases` | Managed phases |
| `PATCH` | `/mobile/phases/:id/status` | `status`: `IN_PROGRESS` \| `COMPLETED` \| `POSTPONED` |

### 4.6 Site Manager checklist

1. Login with `"role": "SITE_MANAGER"`.  
2. Build **Site Manager** navigation (Schedule, Map, Crew Time, Inspections, Phases + own Timer).  
3. Handle 403 if assignment/global rule denies a project.  
4. Complete inspections only when status is `PENDING`.  
5. Use same offline sync + Socket/FCM stack as employees.  

---

## 5. Offline Sync (`POST /mobile/sync`) — Both Roles

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

### Idempotency rule

- Generate a **stable UUID `clientSyncId` per offline log** when the log is first created on device.  
- Persist it until the server acknowledges creation **or** skip.  
- Resubmitting the same `clientSyncId` is **safe** — duplicates are skipped (`clientSyncId` is unique).

### Response `data`

```json
{
  "created": 1,
  "skipped": 1,
  "logs": [ /* newly created MobileTimeLogDTO only */ ]
}
```

Synced rows are stored as `isManual: false`, `status: APPROVED`.

**Critical:** Never regenerate `clientSyncId` on retry — that creates duplicate payroll hours.

---

## 6. Notifications, Socket.IO & FCM — Both Roles

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

## 7. Localization — Both Roles

1. After auth, call **`GET /mobile/config`**.  
2. Build language settings from `enabledLanguages` / `defaultLanguage`.  
3. Render Privacy / Terms from `legalContents` (`PRIVACY_AND_POLICY`, `TERMS_AND_CONDITION`, …).  
4. Optionally send `x-locale` / `Accept-Language` for server ALS locale.

---

## Quick comparison (cheat sheet)

| Feature | Employee | Site Manager |
| --- | --- | --- |
| Login `role` | `EMPLOYEE` | `SITE_MANAGER` |
| `/mobile/config` | ✅ | ✅ |
| `/mobile/dashboard` | ✅ | ✅ (+ pending inspections count for SM) |
| `/mobile/projects` | ✅ | ✅ (+ budget fields) |
| `/mobile/profile` | ✅ | ✅ |
| Timer start/stop/manual/logs/sync | ✅ | ✅ |
| `/mobile/schedule` | ❌ 403 | ✅ |
| `/mobile/map` | ❌ 403 | ✅ |
| `/mobile/crew-time` | ❌ 403 | ✅ |
| `/mobile/inspections*` | ❌ 403 | ✅ |
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
- Screens: Dashboard, Projects, Timer, Time Logs, Profile, Notifications, Settings/Legal.  
- Never call SM-only endpoints.

### Site Manager shell
- All employee screens **plus** Schedule, Map, Crew Time, Inspections, Phase Board.  
- Respect assignment / `GLOBAL_ACCESS` behavior and 403s.
