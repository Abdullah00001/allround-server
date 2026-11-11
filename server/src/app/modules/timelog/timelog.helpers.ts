import { TimeLog, TimeLogBreak } from '@prisma/client';

/**
 * Time log row with optional breaks for net-hour calculations.
 */
export type TTimeLogWithBreaks = TimeLog & {
  breaks: TimeLogBreak[];
};

/**
 * Returns total break minutes for a time log.
 * Prefers `durationMinutes`; otherwise uses break end/start timestamps.
 *
 * @param {TimeLogBreak[]} breaks - Break rows attached to the log.
 * @returns {number} Total break minutes (never negative).
 */
export const sumBreakMinutes = (breaks: TimeLogBreak[]): number => {
  return breaks.reduce((sum, breakEntry) => {
    if (breakEntry.durationMinutes != null) {
      return sum + Math.max(breakEntry.durationMinutes, 0);
    }
    if (!breakEntry.endTime) return sum;
    const ms = breakEntry.endTime.getTime() - breakEntry.startTime.getTime();
    if (ms <= 0) return sum;
    return sum + ms / (1000 * 60);
  }, 0);
};

/**
 * Calculates net hours for a closed time log: `(end - start) - breaks`.
 *
 * @param {Pick<TimeLog, 'startTime' | 'endTime'> & { breaks: TimeLogBreak[] }} timeLog - Log with breaks.
 * @returns {number} Net hours rounded to 2 decimal places (0 when incomplete).
 */
export const calculateNetHours = (
  timeLog: Pick<TimeLog, 'startTime' | 'endTime'> & { breaks: TimeLogBreak[] }
): number => {
  if (!timeLog.endTime) return 0;

  const grossMs = timeLog.endTime.getTime() - timeLog.startTime.getTime();
  if (grossMs <= 0) return 0;

  const grossMinutes = grossMs / (1000 * 60);
  const breakMinutes = sumBreakMinutes(timeLog.breaks);
  const netMinutes = Math.max(grossMinutes - breakMinutes, 0);
  return Number((netMinutes / 60).toFixed(2));
};
