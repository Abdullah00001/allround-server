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
