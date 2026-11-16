import {
  ActivityType,
  PhaseStatus,
  PhaseType,
  TimeLog,
  TimeLogBreak,
} from '@prisma/client';

export const PHASE_STATUS_PRIORITY: Record<PhaseStatus, number> = {
  [PhaseStatus.IN_PROGRESS]: 1,
  [PhaseStatus.ORDER_CONFIRMED]: 2,
  [PhaseStatus.ENQUIRY]: 3,
  [PhaseStatus.QUOTATION]: 4,
  [PhaseStatus.POSTPONED]: 5,
  [PhaseStatus.COMPLETED]: 6,
};

export const PHASE_TYPE_PRIORITY: Record<PhaseType, number> = {
  [PhaseType.ERECTION]: 1,
  [PhaseType.STANDING]: 2,
  [PhaseType.MAINTENANCE]: 3,
  [PhaseType.DISMANTLING]: 4,
};

/**
 * Selects the primary/active phase for a project card display.
 * Sorts by status priority (IN_PROGRESS > ORDER_CONFIRMED > ENQUIRY > QUOTATION > POSTPONED > COMPLETED),
 * breaking ties by phase type (ERECTION > STANDING > MAINTENANCE > DISMANTLING).
 *
 * @template T
 * @param {T[]} phases - Array of phases belonging to the project.
 * @returns {T} The primary phase.
 */
export const selectPrimaryPhase = <
  T extends { status: PhaseStatus; type: PhaseType }
>(
  phases: T[]
): T => {
  if (phases.length === 1) return phases[0];
  return [...phases].sort((a, b) => {
    const statusDiff =
      (PHASE_STATUS_PRIORITY[a.status] ?? 99) -
      (PHASE_STATUS_PRIORITY[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    const typeDiff =
      (PHASE_TYPE_PRIORITY[a.type] ?? 99) -
      (PHASE_TYPE_PRIORITY[b.type] ?? 99);
    return typeDiff;
  })[0];
};

/**
 * Time log row with breaks included for net-hour calculations.
 */
export type TTimeLogWithBreaks = TimeLog & {
  breaks: TimeLogBreak[];
};

/**
 * Returns the duration of a single break in minutes.
 * Prefers `durationMinutes` when set; otherwise uses end/start timestamps.
 *
 * @param {TimeLogBreak} breakEntry - Break row attached to a time log.
 * @returns {number} Break duration in minutes (0 when open / incomplete).
 */
export const getBreakDurationMinutes = (breakEntry: TimeLogBreak): number => {
  if (breakEntry.durationMinutes != null) {
    return breakEntry.durationMinutes;
  }

  if (!breakEntry.endTime) {
    return 0;
  }

  const ms = breakEntry.endTime.getTime() - breakEntry.startTime.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60);
};

/**
 * Computes net logged hours for one closed time log after subtracting breaks.
 *
 * @param {TTimeLogWithBreaks} timeLog - Approved time log with `endTime` set.
 * @returns {number} Net hours for the log (never negative).
 */
export const getNetLoggedHours = (timeLog: TTimeLogWithBreaks): number => {
  if (!timeLog.endTime) return 0;

  const grossMs = timeLog.endTime.getTime() - timeLog.startTime.getTime();
  if (grossMs <= 0) return 0;

  const grossMinutes = grossMs / (1000 * 60);
  const breakMinutes = timeLog.breaks.reduce(
    (sum, breakEntry) => sum + getBreakDurationMinutes(breakEntry),
    0
  );
  const netMinutes = Math.max(grossMinutes - breakMinutes, 0);
  return netMinutes / 60;
};

/**
 * Aggregates net hours across time logs, grouped by `activityType`.
 *
 * @param {TTimeLogWithBreaks[]} timeLogs - Closed approved logs for a project.
 * @returns {{ totalLoggedHours: number; hoursByActivity: Array<{ activityType: ActivityType; hours: number }> }}
 * Total hours and per-activity buckets for charts.
 */
export const aggregateLoggedHours = (
  timeLogs: TTimeLogWithBreaks[]
): {
  totalLoggedHours: number;
  hoursByActivity: Array<{ activityType: ActivityType; hours: number }>;
} => {
  const byActivity = new Map<ActivityType, number>();

  for (const timeLog of timeLogs) {
    const hours = getNetLoggedHours(timeLog);
    byActivity.set(
      timeLog.activityType,
      (byActivity.get(timeLog.activityType) ?? 0) + hours
    );
  }

  const hoursByActivity = [...byActivity.entries()].map(
    ([activityType, hours]) => ({
      activityType,
      hours: Number(hours.toFixed(2)),
    })
  );

  const totalLoggedHours = Number(
    hoursByActivity
      .reduce((sum, row) => sum + row.hours, 0)
      .toFixed(2)
  );

  return { totalLoggedHours, hoursByActivity };
};

/**
 * Calculates phase duration in days from start/end timestamps.
 *
 * @param {Date} startDate - Phase start date.
 * @param {Date} endDate - Phase end date.
 * @returns {number} Fractional day count `(end - start) / dayMs`.
 */
export const calculateDurationDays = (
  startDate: Date,
  endDate: Date
): number => {
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
};
