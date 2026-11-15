/**
 * Extracts a city-like token from a freeform address string.
 * Uses the last comma-separated segment when present; otherwise returns the trimmed address.
 *
 * @param {string | null | undefined} address - Freeform address.
 * @returns {string | null} Normalized city token or null when empty.
 */
export const extractCityFromAddress = (
  address: string | null | undefined
): string | null => {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  const city = parts.length > 1 ? parts[parts.length - 1] : trimmed;
  return city.length > 0 ? city : null;
};

/**
 * Derives a short task title from a longer description (first line, max 80 chars).
 *
 * @param {string} description - Full task description.
 * @returns {string} Truncated title suitable for `ProjectTask.title`.
 */
export const deriveTaskTitle = (description: string): string => {
  const firstLine = description.split(/\r?\n/)[0]?.trim() || description.trim();
  if (firstLine.length <= 80) return firstLine;
  return `${firstLine.slice(0, 77)}...`;
};

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
