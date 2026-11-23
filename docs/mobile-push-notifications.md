# Mobile Push Notifications — Employee & Site Manager

Source of truth: server/scheduler `triggerPushNotification` / `triggerRawPushNotification` call sites + Prisma `NotificationType`.

Delivery path: API/scheduler → BullMQ `send-push-notification` → worker creates `Notification` row (source locale) → pre-translates **all enabled company languages** → FCM + Socket.IO use each recipient’s `UserPreference.language`.

Clients read inbox via `GET /mobile/notifications` (localized to preferred language; sync translate if not READY yet). Mark read via existing notification routes.

**Excluded:** Admin web has no FCM push from these mobile events (admin uses cookie session; these payloads target mobile `userId`s).

---

## Notification types (`NotificationType`)

| Type | Used for |
| --- | --- |
| `PROJECT_ASSIGNED` | Crew day assignment |
| `TIME_LOG_APPROVED` | Admin approved a time log |
| `TIME_LOG_REJECTED` | Admin rejected a time log |
| `INSPECTION_SCHEDULED` | Inspection → project convert **and** day-before inspection reminder |
| `SYSTEM_ALERT` | Timer auto-close, absence reminder, profile test push |

---

## EMPLOYEE — when they get a push

| # | Activity / trigger | Type | i18n keys | Recipient | When |
| --- | --- | --- | --- | --- | --- |
| 1 | Admin assigns them to a phase/day (Planning → Assign Crew) | `PROJECT_ASSIGNED` | `notification.project_assigned.*` | Assigned `userId` | Immediate on `POST` assign-crew |
| 2 | Admin approves their time log | `TIME_LOG_APPROVED` | `notification.time_log_approved.*` | `timeLog.userId` | Immediate on approve |
| 3 | Admin rejects their time log | `TIME_LOG_REJECTED` | `notification.time_log_rejected.*` | `timeLog.userId` | Immediate on reject |
| 4 | Open timer still running at end of Berlin day | `SYSTEM_ALERT` | `notification.timer_auto_closed.*` | Timer owner | Cron `59 23 * * *` |
| 5 | Registered absence overlaps tomorrow | `SYSTEM_ALERT` | `notification.absence_reminder.*` | Absence `userId` | Cron `0 18 * * *` |
| 6 | `GET /mobile/profile` (test hook) | `SYSTEM_ALERT` | literal EN title/body (localized on inbox read) | Caller | Immediate |

**Employee does not receive:** inspection convert / inspection reminder (those go to `siteManagerId`).

---

## SITE_MANAGER — when they get a push

| # | Activity / trigger | Type | i18n keys | Recipient | When |
| --- | --- | --- | --- | --- | --- |
| 1 | Admin assigns them as crew on a phase/day | `PROJECT_ASSIGNED` | `notification.project_assigned.*` | Assigned `userId` | Immediate (SM can be crew) |
| 2 | Admin approves **their own** time log | `TIME_LOG_APPROVED` | `notification.time_log_approved.*` | `timeLog.userId` | Immediate |
| 3 | Admin rejects **their own** time log | `TIME_LOG_REJECTED` | `notification.time_log_rejected.*` | `timeLog.userId` | Immediate |
| 4 | Inspection converted to project (they are assigned SM) | `INSPECTION_SCHEDULED` | `notification.inspection_scheduled.*` | `inspection.siteManagerId` | Immediate on convert |
| 5 | Pending inspection appointment is tomorrow | `INSPECTION_SCHEDULED` | `notification.inspection_reminder.*` | `inspection.siteManagerId` | Cron `0 8 * * *` |
| 6 | Their open timer auto-closed EOD | `SYSTEM_ALERT` | `notification.timer_auto_closed.*` | Timer owner | Cron `59 23 * * *` |
| 7 | Their absence overlaps tomorrow | `SYSTEM_ALERT` | `notification.absence_reminder.*` | Absence `userId` | Cron `0 18 * * *` |
| 8 | `GET /mobile/profile` test hook | `SYSTEM_ALERT` | literal EN title/body (localized on inbox read) | Caller | Immediate |

**Site Manager does not get a push when:** an employee on their project submits/stops a timer (no “new time log pending” push today).

---

## Copy templates (EN)

| Key | Title | Body |
| --- | --- | --- |
| `project_assigned` | Project assignment | You have been assigned to `{projectName}` (`{phaseType}`) on `{date}`. |
| `time_log_approved` | Time log approved | Your time entry for `{date}` was approved. |
| `time_log_rejected` | Time log rejected | Your time entry for `{date}` was rejected. |
| `inspection_scheduled` | Inspection converted | Inspection "{siteTitle}" was converted to project "{projectName}". |
| `inspection_reminder` | Inspection tomorrow | You have an inspection at "{siteTitle}" on `{date}`. |
| `timer_auto_closed` | Timer auto-closed | Your open timer was closed at end of day and awaits approval. |
| `absence_reminder` | Absence tomorrow | Reminder: you have a registered absence starting `{date}`. |

German authored copy lives in `server/src/app/i18n/index.ts` (`deDictionary`). Push body is stored in company **source** locale; inbox localizes on `GET /mobile/notifications`.

---

## Quick matrix

| Event | EMPLOYEE | SITE_MANAGER |
| --- | --- | --- |
| Crew assigned to phase/day | Yes (if assigned) | Yes (if assigned as crew) |
| Time log approved / rejected | Yes (own logs) | Yes (own logs only) |
| Inspection → project convert | No | Yes (if `siteManagerId`) |
| Inspection reminder (D-1) | No | Yes (if `siteManagerId`) |
| Timer auto-close EOD | Yes (if timer open) | Yes (if timer open) |
| Absence reminder (D-1) | Yes (if absence) | Yes (if absence) |
| Profile GET test push | Yes | Yes |
| Vehicle assign | No | No |
| Employee starts/stops timer | No push to SM | — |

---

## Client checklist

1. Register FCM token on the active device session.
2. Connect Socket.IO notification namespace for live `notification:new` / unread count.
3. Inbox: `GET /mobile/notifications` — use `data[].type` + `localization` meta.
4. Deep-link by `type` (optional `link` field may be null today).
5. Do not expect SM alerts for employee timer submissions until a new event is added.

---

## Code map

| Trigger | Location |
| --- | --- |
| Assign crew | `server/.../planning/planning.services.ts` → `assignCrewService` |
| Approve / reject time | `server/.../timelog/timelog.services.ts` |
| Convert inspection | `server/.../inspection/inspection.services.ts` → `convertInspectionToProjectService` |
| Inspection reminder | `scheduler/.../inspection-reminders/` |
| Timer auto-close | `scheduler/.../auto-close-dangling-timers/` |
| Absence reminder | `scheduler/.../absence-reminders/` |
| Profile test push | `server/.../mobile/mobile.services.ts` → profile GET |
| Worker delivery + pre-translate | `worker/.../notification/jobs/sendPushNotification.job.ts` |
| Inbox localize (sync if needed) | `server/.../notification/notification.services.ts` → `localizeNotification` |
