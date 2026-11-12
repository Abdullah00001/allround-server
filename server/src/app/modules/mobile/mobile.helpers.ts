/**
 * Returns the UTC Monday 00:00:00.000 for the ISO week containing `reference`.
 *
 * @param {Date} [reference=new Date()] - Reference instant.
 * @returns {Date} Start of the current UTC ISO week (Monday).
 */
export const getUtcWeekStart = (reference: Date = new Date()): Date => {
  const date = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate()
    )
  );
  const day = date.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const daysFromMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date;
};

/**
 * Returns the exclusive UTC end of the ISO week (next Monday 00:00).
 *
 * @param {Date} weekStart - Week start from `getUtcWeekStart`.
 * @returns {Date} Exclusive upper bound for the week range.
 */
export const getUtcWeekEndExclusive = (weekStart: Date): Date => {
  return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
};

/**
 * Returns the UTC start of the calendar day for `reference`.
 *
 * @param {Date} [reference=new Date()] - Reference instant.
 * @returns {Date} UTC midnight for that calendar day.
 */
export const getUtcDayStart = (reference: Date = new Date()): Date => {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate()
    )
  );
};

/**
 * Returns the exclusive UTC end of the calendar day (next midnight).
 *
 * @param {Date} dayStart - Day start from `getUtcDayStart`.
 * @returns {Date} Exclusive upper bound for the day range.
 */
export const getUtcDayEndExclusive = (dayStart: Date): Date => {
  return new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
};

/**
 * Returns the UTC start of the calendar month for `reference`.
 *
 * @param {Date} [reference=new Date()] - Reference instant.
 * @returns {Date} UTC midnight on the 1st of the month.
 */
export const getUtcMonthStart = (reference: Date = new Date()): Date => {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)
  );
};

/**
 * Returns the exclusive UTC end of the calendar month (1st of next month).
 *
 * @param {Date} monthStart - Month start from `getUtcMonthStart`.
 * @returns {Date} Exclusive upper bound for the month range.
 */
export const getUtcMonthEndExclusive = (monthStart: Date): Date => {
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
};

/**
 * Resolves a half-open UTC `[start, end)` range for a mobile time-log period filter.
 *
 * @param {'TODAY' | 'WEEK' | 'MONTH'} period - Requested period key.
 * @param {Date} [reference=new Date()] - Reference instant.
 * @returns {{ start: Date; endExclusive: Date }} Inclusive start and exclusive end.
 */
export const getPeriodRange = (
  period: 'TODAY' | 'WEEK' | 'MONTH',
  reference: Date = new Date()
): { start: Date; endExclusive: Date } => {
  if (period === 'TODAY') {
    const start = getUtcDayStart(reference);
    return { start, endExclusive: getUtcDayEndExclusive(start) };
  }
  if (period === 'WEEK') {
    const start = getUtcWeekStart(reference);
    return { start, endExclusive: getUtcWeekEndExclusive(start) };
  }
  const start = getUtcMonthStart(reference);
  return { start, endExclusive: getUtcMonthEndExclusive(start) };
};
