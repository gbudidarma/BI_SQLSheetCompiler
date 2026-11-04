import * as XLSX from 'xlsx';
import { ColumnInfo, DataType, TableSchema } from '../types';

/**
 * Sanitizes a string into a clean SQL identifier (e.g., column or table name).
 */
export function sanitizeSqlIdentifier(name: string, fallbackPrefix = 'col'): string {
  if (!name || typeof name !== 'string') {
    return `${fallbackPrefix}_1`;
  }

  let cleaned = name
    .trim()
    .toLowerCase()
    // replace special symbols with friendly names or underscores
    .replace(/%/g, '_pct')
    .replace(/\$/g, '_usd')
    .replace(/#/g, '_num')
    .replace(/@/g, '_at')
    .replace(/[^a-z0-9_]/g, '_')
    // collapse consecutive underscores
    .replace(/_+/g, '_')
    // strip leading/trailing underscores
    .replace(/^_+|_+$/g, '');

  if (!cleaned) {
    cleaned = fallbackPrefix;
  }

  // SQL identifiers starting with a number are awkward in queries; prefix with t_ or col_
  if (/^[0-9]/.test(cleaned)) {
    cleaned = `${fallbackPrefix}_${cleaned}`;
  }

  return cleaned;
}

/**
 * Ensures unique column names within a table by appending _2, _3 if duplicates exist.
 */
export function deduplicateColumnNames(names: string[]): string[] {
  const seen: Record<string, number> = {};
  return names.map((name, index) => {
    let clean = sanitizeSqlIdentifier(name, `col_${index + 1}`);
    if (seen[clean] !== undefined) {
      seen[clean] += 1;
      clean = `${clean}_${seen[clean]}`;
    } else {
      seen[clean] = 1;
    }
    return clean;
  });
}

/**
 * Infers data type from an array of sample values.
 */
export function inferDataType(values: any[]): DataType {
  const nonNulls = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNulls.length === 0) return 'TEXT';

  let hasInt = false;
  let hasFloat = false;
  let hasBool = false;
  let hasDate = false;
  let hasText = false;

  for (const val of nonNulls) {
    if (typeof val === 'boolean') {
      hasBool = true;
      continue;
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
      hasDate = true;
      continue;
    }

    if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        hasInt = true;
      } else {
        hasFloat = true;
      }
      continue;
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      const lower = trimmed.toLowerCase();

      if (lower === 'true' || lower === 'false') {
        hasBool = true;
        continue;
      }

      // Check numeric strings (e.g., "123", "45.67", "-89")
      if (/^-?\d+$/.test(trimmed)) {
        hasInt = true;
        continue;
      }
      if (/^-?\d+\.\d+$/.test(trimmed)) {
        hasFloat = true;
        continue;
      }

      // Check standard ISO / YYYY-MM-DD date strings
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed)) {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed)) {
          hasDate = true;
          continue;
        }
      }

      hasText = true;
    } else {
      hasText = true;
    }
  }

  if (hasText) return 'TEXT';
  if (hasFloat) return 'FLOAT';
  if (hasInt) return 'INTEGER';
  if (hasDate) return 'DATE';
  if (hasBool) return 'BOOLEAN';

  return 'TEXT';
}

/**
 * Normalizes values to appropriate JavaScript primitive types.
 */
function normalizeCellValue(val: any, type: DataType): any {
  if (val === null || val === undefined || val === '') {
    return null;
  }

  if (type === 'INTEGER') {
    if (typeof val === 'number') return Math.floor(val);
    const parsed = parseInt(String(val).replace(/,/g, ''), 10);
    return isNaN(parsed) ? null : parsed;
  }

  if (type === 'FLOAT') {
    if (typeof val === 'number') return Number(val);
    const parsed = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(parsed) ? null : Number(parsed.toFixed(4));
  }

  if (type === 'BOOLEAN') {
    if (typeof val === 'boolean') return val;
    const str = String(val).toLowerCase().trim();
    if (str === 'true' || str === '1' || str === 'yes') return true;
    if (str === 'false' || str === '0' || str === 'no') return false;
    return Boolean(val);
  }

  if (type === 'DATE') {
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number') {
      // Excel date serial number handling
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        const m = String(date.m).padStart(2, '0');
        const d = String(date.d).padStart(2, '0');
        return `${date.y}-${m}-${d}`;
      }
    }
    return String(val);
  }

  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

/**
 * Parses raw 2D array data into a TableSchema and structured row objects.
 * "first excel always header": Row 0 is guaranteed and strictly mapped as headers.
 */
export function parseSheetData(
  sheetRows: any[][],
  tableName: string,
  sourceFileName: string,
  sheetName: string
): { schema: TableSchema; rows: Record<string, any>[] } {
  if (!sheetRows || sheetRows.length === 0) {
    return {
      schema: {
        id: tableName,
        name: tableName,
        sourceFileName,
        sheetName,
        rowCount: 0,
        columns: [],
        previewRows: [],
      },
      rows: [],
    };
  }

  // First row is ALWAYS header as requested
  const rawHeaders: string[] = sheetRows[0].map((h, i) =>
    h !== null && h !== undefined && String(h).trim() !== ''
      ? String(h).trim()
      : `column_${i + 1}`
  );

  const cleanColNames = deduplicateColumnNames(rawHeaders);

  // Subsequent rows are data
  const dataRowsRaw = sheetRows.slice(1);

  // Extract column value arrays for type inference
  const colValues: Record<string, any[]> = {};
  cleanColNames.forEach((col) => {
    colValues[col] = [];
  });

  dataRowsRaw.forEach((row) => {
    // Only include rows that have at least one non-empty cell
    const hasData = row.some((cell) => cell !== null && cell !== undefined && cell !== '');
    if (!hasData) return;

    cleanColNames.forEach((col, idx) => {
      colValues[col].push(row[idx]);
    });
  });

  // Analyze columns
  const columns: ColumnInfo[] = cleanColNames.map((colName, idx) => {
    const rawName = rawHeaders[idx];
    const values = colValues[colName];
    const inferredType = inferDataType(values);

    let nullCount = 0;
    const distinctSet = new Set<string>();

    values.forEach((v) => {
      if (v === null || v === undefined || v === '') {
        nullCount++;
      } else {
        distinctSet.add(String(v));
      }
    });

    const sample = values
      .filter((v) => v !== null && v !== undefined && v !== '')
      .slice(0, 5);

    return {
      name: colName,
      originalName: rawName,
      type: inferredType,
      nullCount,
      distinctCount: distinctSet.size,
      sampleValues: sample,
    };
  });

  // Construct normalized rows
  const normalizedRows: Record<string, any>[] = [];

  dataRowsRaw.forEach((row) => {
    const hasData = row.some((cell) => cell !== null && cell !== undefined && cell !== '');
    if (!hasData) return;

    const rowObj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      const rawCell = row[idx];
      rowObj[col.name] = normalizeCellValue(rawCell, col.type);
    });
    normalizedRows.push(rowObj);
  });

  const schema: TableSchema = {
    id: tableName,
    name: tableName,
    sourceFileName,
    sheetName,
    rowCount: normalizedRows.length,
    columns,
    previewRows: normalizedRows.slice(0, 10),
    allRows: normalizedRows,
  };

  return { schema, rows: normalizedRows };
}

/**
 * Reads an Excel file buffer and produces tables for all worksheets.
 */
export async function parseExcelFile(
  file: File
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const results: { schema: TableSchema; rows: Record<string, any>[] }[] = [];
  const baseFileName = file.name.replace(/\.[^/.]+$/, '');

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Convert sheet to 2D array: header: 1 means array of arrays
    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawData.length === 0) return;

    // Format SQL table name based on Sheet Name (or file name if single sheet)
    let tableName: string;
    if (workbook.SheetNames.length === 1) {
      tableName = sanitizeSqlIdentifier(baseFileName, 'excel_table');
    } else {
      tableName = sanitizeSqlIdentifier(`${baseFileName}_${sheetName}`, `sheet_${index + 1}`);
    }

    const parsed = parseSheetData(rawData, tableName, file.name, sheetName);
    results.push(parsed);
  });

  return results;
}
