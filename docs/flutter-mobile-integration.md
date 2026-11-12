# Flutter Mobile Integration Guide

Integration contract for the **Flutter iOS/Android app** (Site Managers & Employees) against the Allround backend.

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

---

## 1. Authentication Flow (Bearer JWT)

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

### Login

```http
POST /api/v1/auth/login
{
  "email": "manager@allround.com",
  "password": "Manager123!",
  "role": "SITE_MANAGER",
  "deviceIdentifier": "<stable-uuid>",
  "platform": "IOS",
  "lat": 50.92,
  "lng": 6.95,
  "fcmToken": "<fcm>",
  "rememberMe": true
}
```

`rememberMe: true` → longer JWT/session (~30d). `false` → ~7d.

### Session heartbeat

Call periodically (app resume / location tick):

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

Use this to refresh GPS/`lastSeenAt` and rotate FCM on the device row.

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessJwt>
```

JWT is blacklisted; FCM cleared; device marked logged out. Clear secure storage + disconnect sockets.

### Dio interceptor example

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
    final status = error.response?.statusCode;
    final errorType = error.response?.data is Map
        ? error.response?.data['errorType']
        : null;

    if (status == 401) {
      // TOKEN_*, SESSION_*, DEVICE_* → force re-login (no refresh API)
      await storage.delete(key: 'access_token');
    }
    handler.next(error);
  },
));
```

**Critical:** After login/verify, immediately save the JWT **and** register/refresh FCM via the same login/verify/`/auth/check` payloads.

---

## 2. Role-Based Rules (RBAC)

The backend enforces role gates. Do not rely on UI hiding alone.

| Capability | `EMPLOYEE` | `SITE_MANAGER` |
| --- | --- | --- |
| Dashboard / projects / profile / config | Yes | Yes |
| Own timer start/stop/manual*/time-logs/sync | Yes | Yes |
| Schedule / map / crew-time | **403** | Yes |
| Inspections / phase board | **403** | Yes |

\*Manual time (`POST /mobile/timer/manual`) is blocked for employees when `CompanyProfile.allowEmployeeManualTime === false` (read this from `GET /mobile/config`).

### Project visibility for site managers

`CompanyProfile.siteManagerAccessRule`:

- `RESTRICT_TO_ASSIGNED` (seed default): only projects with a `ProjectManagerAssignment` for that user (plus related schedule/map/dashboard scoping).
- `GLOBAL_ACCESS`: site managers can see all non-deleted projects on dashboard/projects/schedule/map; write/crew-time still checks assignment **or** global rule in middleware.

**Inspections are always assigned** via `siteManagerId`—global access does not expand the inspection inbox.

Employees never receive site-manager-only routes.

---

## 3. Offline Sync (`POST /mobile/sync`) — CRITICAL

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
- Persist it locally until the server acknowledges creation **or** skip.
- Resubmitting the same `clientSyncId` is **safe**: the server **skips** duplicates (`clientSyncId` is unique in DB).

### Response `data`

```json
{
  "created": 1,
  "skipped": 1,
  "logs": [ /* newly created MobileTimeLogDTO only */ ]
}
```

Synced rows are stored as `isManual: false`, `status: APPROVED` (server behavior). Remove local queued items that appear in `created` or were counted in `skipped`.

**Critical:** Never regenerate `clientSyncId` on retry—that creates duplicate payroll hours.

---

## 4. Core Flow & API Reference

All `/mobile/*` routes require:

```text
Authorization: Bearer <accessJwt>
(+ ACTIVE user + valid device session)
```

### 4.1 Config & localization bootstrap

Call after login:

```http
GET /api/v1/mobile/config
```

`data` includes:

- `defaultLanguage`, `enabledLanguages[]`
- `allowEmployeeManualTime`
- `legalContents[]` (`legalContentType`, `content`, `updatedAt`) for Privacy / Terms screens

Drive language pickers and legal screens from this payload—not hard-coded lists.

### 4.2 Dashboard, projects, profile

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/mobile/dashboard` | `stats`, `upcomingTasks[]`, `mapPins[]` |
| `GET` | `/mobile/projects` | Assigned/visible projects; SM may receive budget fields |
| `GET` | `/mobile/profile` | Hours targets/this week + project counts |

### 4.3 Time tracking

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/mobile/timer/start` | `phaseId`, `activityType`, optional GPS start |
| `POST` | `/mobile/timer/stop` | `timeLogId`, optional GPS end |
| `POST` | `/mobile/timer/manual` | `phaseId`, `activityType`, `startTime`, `endTime`, `breakMinutes` → **PENDING_APPROVAL** |
| `GET` | `/mobile/time-logs?period=TODAY\|WEEK\|MONTH` | Own logs |
| `POST` | `/mobile/sync` | Offline batch (see §3) |

`activityType`: `ERECTION` \| `DISMANTLING` \| `TRANSPORT` \| `MAINTENANCE` \| `OTHER`.

Start while another timer is open → **409** `ACTIVE_TIMER_EXISTS`.

### 4.4 Site Manager–only surfaces

| Method | Path | Query / body |
| --- | --- | --- |
| `GET` | `/mobile/schedule` | `startDate`, `endDate` (date-time) |
| `GET` | `/mobile/map` | optional `type` phase filter |
| `GET` | `/mobile/crew-time` | **required** `projectId`, optional `date` |
| `GET` | `/mobile/inspections` | Assigned pending/survey-done |
| `GET` | `/mobile/inspections/:id` | Must be assigned SM |
| `PATCH` | `/mobile/inspections/:id/complete` | `scaffoldArea`, `scaffoldHeight`, `scaffoldType` (`PENDING` → `SURVEY_DONE`) |
| `GET` | `/mobile/phases` | Managed phase board |
| `PATCH` | `/mobile/phases/:id/status` | `status`: `IN_PROGRESS` \| `COMPLETED` \| `POSTPONED` |

### 4.5 Notifications REST

| Method | Path |
| --- | --- |
| `GET` | `/mobile/notifications?page&limit` → `{ items, unreadCount }` + `meta` |
| `PATCH` | `/mobile/notifications/read-all` |
| `PATCH` | `/mobile/notifications/:id/read` |

---

## 5. Socket.IO & FCM

### Socket.IO (foreground realtime)

| Item | Value |
| --- | --- |
| Namespace | `/api/v1/notification` |
| Auth | `auth: { token: <accessJwt> }` (or `Authorization` header) |
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
    // Update inbox + local badge
  });

  socket.on('notification:read', (data) {});
  socket.on('notification:all-read', (data) {});
  socket.on('error:server', (err) {});
}
```

Client → server helpers: `notification:mark-read` with `{ notificationId }`, `notification:mark-all-read`.

**Note:** Socket auth checks JWT + ACTIVE user; it does **not** re-run device-session middleware. Still logout/disconnect when REST session dies.

### FCM (background / killed)

The worker persists an in-app `Notification` row, emits Socket.IO `notification:new`, **and** sends FCM multicast to ACTIVE devices with tokens.

Recommended handling:

1. **Foreground:** Prefer Socket.IO for instant UI; optionally still show a local notification from FCM data.
2. **Background / terminated:** Use `firebase_messaging` handlers; on tap, open the notifications screen and call `GET /mobile/notifications`.
3. **Token refresh:** Write the new token via `POST /auth/check` (or next login).
4. **Logout:** Server clears FCM; also delete the token locally.

Typical FCM data keys from the worker include `title`, `body`/`message`, `type`, `click_action: FLUTTER_NOTIFICATION_CLICK`.

---

## 6. Localization

1. After auth, call **`GET /mobile/config`**.
2. Build language settings from `enabledLanguages` / `defaultLanguage`.
3. Render Privacy / Terms from `legalContents` (`PRIVACY_AND_POLICY`, `TERMS_AND_CONDITION`, etc.).
4. Optionally send `x-locale` / `Accept-Language` so server ALS locale aligns with the UI (emails/push already cohort by user preference language).

User preference language is stored server-side on `UserPreference` (seeded `DE` for demo users).

---

## Response envelopes (mobile)

Same as admin:

- Success: `{ success, message, data?, meta?, traceId }`
- Errors: `{ success: false, message, errorType?, errors?, traceId }`

Watch for mobile-specific `errorType`s: `ACTIVE_TIMER_EXISTS`, `TIMELOG_NOT_FOUND`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `DEVICE_NOT_FOUND`, `DEVICE_NOT_OWNED`, `ACCESS_DENIED`, `FORBIDDEN`, `BAD_REQUEST`.

---

## Quick start checklist

1. Persist install `deviceIdentifier` + JWT in secure storage.
2. Login/verify with FCM token; heartbeat via `/auth/check`.
3. Load `/mobile/config` before settings/legal screens.
4. Gate SM-only screens client-side **and** handle 403.
5. Implement offline queue with immutable `clientSyncId` → `/mobile/sync`.
6. Connect Socket.IO `/api/v1/notification` with Bearer token; handle FCM for background.
7. On any session 401, clear tokens and return to login (no refresh API).
