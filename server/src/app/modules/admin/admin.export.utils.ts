/**
 * Escapes a single CSV cell (RFC 4180-style quotes when needed).
 *
 * @param {unknown} value - Cell value.
 * @returns {string} Escaped CSV field.
 */
export const escapeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object'
        ? String(value)
        : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

/**
 * Builds a CSV document from a header row and data rows.
 *
 * @param {string[]} headers - Column headers.
 * @param {unknown[][]} rows - Data rows aligned to headers.
 * @returns {string} CSV text with UTF-8 BOM for Excel.
 */
export const buildCsvDocument = (
  headers: string[],
  rows: unknown[][]
): string => {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  // BOM helps Excel open UTF-8 (German umlauts, etc.) correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
};

/**
 * Builds a dated export filename.
 *
 * @param {string} prefix - File stem prefix (e.g. `projects`).
 * @returns {string} Filename like `projects-2026-11-21.csv`.
 */
export const buildExportFilename = (prefix: string): string => {
  const day = new Date().toISOString().slice(0, 10);
  return `${prefix}-${day}.csv`;
};
