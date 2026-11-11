/**
 * Parses a `YYYY-MM-DD` calendar date into a UTC midnight `Date`.
 * Used as the canonical day key for crew/vehicle assignments.
 *
 * @param {string} dateStr - Calendar date in `YYYY-MM-DD` format.
 * @returns {Date} UTC midnight for that calendar day.
 */
export const toUtcDayDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/**
 * Returns the inclusive UTC end of a calendar day (23:59:59.999Z).
 *
 * @param {string} dateStr - Calendar date in `YYYY-MM-DD` format.
 * @returns {Date} UTC end-of-day timestamp.
 */
export const toUtcDayEnd = (dateStr: string): Date => {
  const start = toUtcDayDate(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

/**
 * Formats a `Date` as `YYYY-MM-DD` in UTC.
 *
 * @param {Date} date - Date value to format.
 * @returns {string} Calendar date string.
 */
export const formatUtcDay = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};
