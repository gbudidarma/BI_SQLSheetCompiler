/**
 * dateNormalizer.ts
 * Utility for detecting, parsing, and normalizing Excel, CSV, and JavaScript dates:
 * - Excel Date objects (created by SheetJS cellDates: true)
 * - JavaScript epoch timestamps in milliseconds (e.g., 1788195596000) or seconds
 * - Excel serial date codes (e.g., 45536 -> 2024-09-01)
 * - ISO and localized date strings (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY)
 * Formats reliably as standard YYYY-MM-DD without timezone offset shift.
 */

import * as XLSX from 'xlsx';

/**
 * Checks if a string or column name strongly suggests date/calendar semantics.
 */
export function isDateColumnName(colName: string): boolean {
  if (!colName) return false;
  const lower = colName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return (
    lower.includes('date') ||
    lower.includes('calender') ||
    lower.includes('calendar') ||
    lower.includes('day') ||
    lower.includes('month') ||
    lower.includes('year') ||
    lower.includes('period') ||
    lower.includes('timestamp') ||
    lower.endsWith('_dt') ||
    lower.endsWith('_at') ||
    lower.startsWith('dt_') ||
    lower === 'dob' ||
    lower === 'created' ||
    lower === 'updated'
  );
}

/**
 * Formats a Date object cleanly as YYYY-MM-DD using local calendar year, month, and day
 * to avoid UTC off-by-one timezone day shifts.
 */
export function formatDateToIso(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Attempts to parse any cell value into a clean YYYY-MM-DD date string.
 * Returns null if the value cannot be parsed as a valid date.
 */
export function tryNormalizeDate(val: any, hintIsDateColumn = false): string | null {
  if (val === null || val === undefined || val === '') return null;

  // 1. Native Date instance
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return formatDateToIso(val);
    }
    return null;
  }

  // 2. Number handling: millisecond timestamps vs Excel serial numbers
  if (typeof val === 'number' && !isNaN(val)) {
    // 2a. Millisecond timestamp (e.g. 1788195596000 is year 2026)
    // 300,000,000,000 is ~1979-07-05, up to 3,000,000,000,000 (~2065)
    if (val > 300000000000 && val < 4000000000000) {
      const d = new Date(val);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
        return formatDateToIso(d);
      }
    }

    // 2b. Second timestamp (e.g. 1788195596)
    if (val > 300000000 && val < 4000000000 && hintIsDateColumn) {
      const d = new Date(val * 1000);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
        return formatDateToIso(d);
      }
    }

    // 2c. Excel date serial numbers (e.g. 35000 is ~1995, 45536 is ~2024, 73000 is ~2099)
    if ((val >= 1000 && val <= 85000) || (hintIsDateColumn && val >= 1 && val <= 100000)) {
      try {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed && parsed.y >= 1900 && parsed.y <= 2100) {
          const m = String(parsed.m).padStart(2, '0');
          const d = String(parsed.d).padStart(2, '0');
          return `${parsed.y}-${m}-${d}`;
        }
      } catch {
        // ignore parse error
      }
    }

    // If hint is not date and it's just a number, leave as null
    if (!hintIsDateColumn) return null;
  }

  // 3. String handling
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Check if string is a numeric timestamp (e.g. "1788195596000")
    if (/^\d{12,14}$/.test(trimmed)) {
      const num = Number(trimmed);
      const d = new Date(num);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
        return formatDateToIso(d);
      }
    }

    // Standard ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
      const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      if (y >= 1900 && y <= 2100 && parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12 && parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31) {
        return `${y}-${m}-${d}`;
      }
    }

    // Common MM/DD/YYYY or DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (slashMatch) {
      const part1 = parseInt(slashMatch[1], 10);
      const part2 = parseInt(slashMatch[2], 10);
      const y = parseInt(slashMatch[3], 10);
      let m = part1;
      let d = part2;
      // If part1 > 12, it must be DD/MM/YYYY
      if (part1 > 12 && part2 <= 12) {
        d = part1;
        m = part2;
      }
      if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // JavaScript Date.parse fallback if column name suggests date
    if (hintIsDateColumn && isNaN(Number(trimmed))) {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) {
          return formatDateToIso(d);
        }
      }
    }
  }

  return null;
}

/**
 * Checks if a collection of sample values represents a date column.
 */
export function isSampleValuesDate(values: any[], colName = ''): boolean {
  const nonNulls = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNulls.length === 0) return isDateColumnName(colName);

  const isNameHint = isDateColumnName(colName);
  let dateMatches = 0;

  for (const v of nonNulls.slice(0, 15)) {
    if (v instanceof Date) {
      dateMatches++;
    } else if (tryNormalizeDate(v, isNameHint) !== null) {
      dateMatches++;
    }
  }

  // If column name hints date, require at least 50% matches
  if (isNameHint && dateMatches >= Math.max(1, Math.floor(nonNulls.length * 0.4))) {
    return true;
  }

  // If column name doesn't hint date, require at least 80% matches
  return dateMatches >= Math.max(1, Math.floor(nonNulls.length * 0.8));
}

/**
 * Normalizes an array of records so that the specified column is transformed into YYYY-MM-DD.
 */
export function normalizeRowsDateColumn(
  rows: Record<string, any>[],
  colName: string
): Record<string, any>[] {
  const isHint = isDateColumnName(colName);
  return rows.map((r) => {
    const original = r[colName];
    if (original === null || original === undefined || original === '') {
      return r;
    }
    const normalized = tryNormalizeDate(original, isHint || true);
    if (normalized !== null) {
      return { ...r, [colName]: normalized };
    }
    return r;
  });
}
