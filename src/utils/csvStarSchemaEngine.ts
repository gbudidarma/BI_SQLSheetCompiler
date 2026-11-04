/**
 * csvStarSchemaEngine.ts
 * Browser-based Star Schema & Slowly Changing Dimension (SCD Type 1 & 2) Engine.
 * 100% Client-side CSV transformation without external database dependencies.
 */

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  ColumnRole,
  ColumnRoleConfig,
  DataType,
  DimensionConfig,
  GeneratedDimension,
  GeneratedFactTable,
  ScdRowStatus,
  StarSchemaBuildResult,
  SurrogateKeyFormat,
} from '../types';
import { inferDataType } from './excelParser';
import {
  tryNormalizeDate,
  isDateColumnName,
  isSampleValuesDate,
  normalizeRowsDateColumn,
} from './dateNormalizer';

/**
 * Robust CSV parser that handles quoted strings, escaped quotes, commas, and multiline text.
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: Record<string, any>[] } {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [] };
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push final cell
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = lines[0].map((h, idx) => (h && h.trim() ? h.trim() : `column_${idx + 1}`));
  // Deduplicate headers
  const headers: string[] = [];
  const headerCounts: Record<string, number> = {};
  rawHeaders.forEach((h) => {
    const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!headerCounts[clean]) {
      headerCounts[clean] = 1;
      headers.push(clean);
    } else {
      headerCounts[clean]++;
      headers.push(`${clean}_${headerCounts[clean]}`);
    }
  });

  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rowArray = lines[i];
    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      let rawVal: any = rowArray[colIdx] ?? '';
      // Attempt numeric parsing
      if (rawVal !== '' && !isNaN(Number(rawVal))) {
        rawVal = Number(rawVal);
      }
      rowObj[h] = rawVal;
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

export interface ParsedSheetInfo {
  sheetName: string;
  headers: string[];
  rows: Record<string, any>[];
}

/**
 * Parses an Excel (.xlsx, .xls) buffer into sheets with headers and rows
 */
export function parseExcelWorkbookBuffer(buffer: ArrayBuffer): ParsedSheetInfo[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const sheets: ParsedSheetInfo[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (!rawData || rawData.length === 0) return;

    const rawHeaders = (rawData[0] || []).map((h, idx) =>
      h && String(h).trim() ? String(h).trim() : `col_${idx + 1}`
    );

    const headers: string[] = [];
    const headerCounts: Record<string, number> = {};
    rawHeaders.forEach((h) => {
      const clean = String(h).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!headerCounts[clean]) {
        headerCounts[clean] = 1;
        headers.push(clean);
      } else {
        headerCounts[clean]++;
        headers.push(`${clean}_${headerCounts[clean]}`);
      }
    });

    const rows: Record<string, any>[] = [];
    for (let i = 1; i < rawData.length; i++) {
      const rowArr = rawData[i];
      if (!rowArr || rowArr.length === 0) continue;
      const rowObj: Record<string, any> = {};
      let hasData = false;
      headers.forEach((h, colIdx) => {
        let val = rowArr[colIdx];
        if (val !== null && val !== undefined && val !== '') {
          hasData = true;
          const isDateCol = isDateColumnName(h);
          const normalizedDate = tryNormalizeDate(val, isDateCol);

          if (normalizedDate !== null) {
            val = normalizedDate;
          } else if (typeof val === 'number') {
            // Already numeric
          } else if (typeof val === 'string') {
            const trimmed = val.trim();
            // Only convert string to number if it's purely digits/decimals and not a date
            if (/^-?\d+(\.\d+)?$/.test(trimmed) && !isDateCol) {
              val = Number(trimmed);
            }
          }
        }
        rowObj[h] = val;
      });
      if (hasData) {
        rows.push(rowObj);
      }
    }

    if (headers.length > 0 && rows.length > 0) {
      sheets.push({ sheetName, headers, rows });
    }
  });

  return sheets;
}

/**
 * Universally parses either a CSV or Excel file into headers and rows
 */
export async function parseFileToTableData(
  file: File
): Promise<{ fileName: string; sheets: ParsedSheetInfo[] }> {
  const isExcel =
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel';

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const sheets = parseExcelWorkbookBuffer(buffer);
    return { fileName: file.name, sheets };
  } else {
    // Treat as CSV or text
    const text = await file.text();
    const { headers, rows } = parseCsvText(text);
    return {
      fileName: file.name,
      sheets: [
        {
          sheetName: file.name.replace(/\.[^/.]+$/, ''),
          headers,
          rows,
        },
      ],
    };
  }
}

/**
 * Exports data to CSV string format
 */
export function formatDataToCsv(data: Record<string, any>[], columns: string[]): string {
  if (!data || data.length === 0 || !columns || columns.length === 0) return '';

  const headerLine = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
  const rowLines = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Downloads a raw string as a .csv file in the browser
 */
export function downloadCsvFile(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fast deterministic 32-bit hash function (FNV-1a) formatted as short hex
 */
export function deterministicHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a surrogate key based on chosen format
 */
export function generateSurrogateKey(
  format: SurrogateKeyFormat,
  index: number,
  naturalKeyVal: string
): string | number {
  if (format === 'auto_increment') {
    return index + 1;
  }
  return `sk_${deterministicHash(String(naturalKeyVal))}`;
}

/**
 * Smart automatic role classification for raw CSV columns
 */
export function autoDetectColumnRoles(
  headers: string[],
  rows: Record<string, any>[]
): ColumnRoleConfig[] {
  return headers.map((colName) => {
    const nameLower = colName.toLowerCase();
    const values = rows.map((r) => r[colName]);
    const inferredType = inferDataType(values);
    let effectiveType = inferredType;
    const isDate = isDateColumnName(nameLower) || isSampleValuesDate(values, colName) || inferredType === 'DATE';

    // If detected as date, normalize all values in the input rows in-place to clean YYYY-MM-DD
    if (isDate) {
      effectiveType = 'DATE';
      for (const r of rows) {
        if (r[colName] !== null && r[colName] !== undefined && r[colName] !== '') {
          const norm = tryNormalizeDate(r[colName], true);
          if (norm !== null) {
            r[colName] = norm;
          }
        }
      }
    }

    const updatedValues = rows.map((r) => r[colName]);
    const nonNullVals = updatedValues.filter((v) => v !== null && v !== undefined && v !== '');
    const uniqueSet = new Set(nonNullVals.map((v) => String(v)));
    const nullCount = updatedValues.length - nonNullVals.length;
    const samples = Array.from(uniqueSet).slice(0, 4);

    let role: ColumnRole = 'dimension_attr';

    // 1. Date/Time Key
    if (isDate) {
      role = 'date_key';
    }
    // 2. Degenerate Key (transaction-level identifier that stays on Fact)
    else if (
      nameLower === 'order_id' ||
      nameLower === 'invoice_no' ||
      nameLower === 'invoice_id' ||
      nameLower === 'transaction_id' ||
      nameLower === 'receipt_id' ||
      nameLower === 'order_number' ||
      nameLower === 'tracking_number'
    ) {
      role = 'degenerate_key';
    }
    // 3. Fact (Measure): numeric attributes
    else if (
      (inferredType === 'FLOAT' || inferredType === 'INTEGER') &&
      (nameLower.includes('amount') ||
        nameLower.includes('price') ||
        nameLower.includes('qty') ||
        nameLower.includes('quantity') ||
        nameLower.includes('discount') ||
        nameLower.includes('total') ||
        nameLower.includes('cost') ||
        nameLower.includes('tax') ||
        nameLower.includes('fee') ||
        nameLower.includes('revenue') ||
        nameLower.includes('sales') ||
        nameLower.includes('profit') ||
        nameLower.includes('margin') ||
        nameLower.includes('rate') ||
        nameLower.includes('score'))
    ) {
      role = 'fact_measure';
    }
    // 4. Natural Business Key: Entity unique identifiers
    else if (
      nameLower.endsWith('_code') ||
      nameLower.endsWith('_sku') ||
      nameLower.endsWith('_key') ||
      nameLower.endsWith('_id') ||
      nameLower === 'customer_id' ||
      nameLower === 'cust_id' ||
      nameLower === 'product_id' ||
      nameLower === 'prod_id' ||
      nameLower === 'item_id' ||
      nameLower === 'employee_id' ||
      nameLower === 'store_id' ||
      nameLower === 'vendor_id' ||
      nameLower === 'supplier_id' ||
      nameLower === 'customer_code' ||
      nameLower === 'product_sku'
    ) {
      role = 'natural_key';
    }
    // 5. Default string / categorical attributes
    else {
      role = 'dimension_attr';
    }

    return {
      name: colName,
      role,
      type: effectiveType,
      uniqueCount: uniqueSet.size,
      nullCount,
      samples,
    };
  });
}

/**
 * Builds a single Dimension table according to entity grouping and SCD rules
 */
export function buildDimensionTable(
  dimConfig: DimensionConfig,
  flatRows: Record<string, any>[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): GeneratedDimension {
  const {
    id,
    tableName,
    naturalKeyCol,
    attributeCols,
    surrogateKeyName,
    surrogateKeyFormat,
    scdMode,
    scdType,
    existingCsvRows,
  } = dimConfig;

  // 1. Group and deduplicate newly uploaded flat rows by Natural Business Key
  const incomingMap = new Map<string, Record<string, any>>();

  flatRows.forEach((row) => {
    const nkVal = row[naturalKeyCol];
    if (nkVal === null || nkVal === undefined || nkVal === '') return;
    const nkString = String(nkVal);

    // Keep the latest attributes seen in the file for this natural key
    const attrValues: Record<string, any> = {};
    attributeCols.forEach((col) => {
      attrValues[col] = row[col] ?? null;
    });

    incomingMap.set(nkString, attrValues);
  });

  const rowStatuses: Record<string | number, ScdRowStatus> = {};
  const resultRows: Record<string, any>[] = [];

  const columns = [
    surrogateKeyName,
    naturalKeyCol,
    ...attributeCols,
    'effective_start_date',
    'effective_end_date',
    'is_current',
  ];

  let addedCount = 0;
  let updatedCount = 0;
  let expiredCount = 0;
  let unchangedCount = 0;

  // ==========================================
  // MODE A: INITIAL LOAD MODE (Clean Star Dim)
  // ==========================================
  if (scdMode === 'initial' || !existingCsvRows || existingCsvRows.length === 0) {
    let index = 0;
    incomingMap.forEach((attrs, nkString) => {
      const sk = generateSurrogateKey(surrogateKeyFormat, index, nkString);
      const row: Record<string, any> = {
        [surrogateKeyName]: sk,
        [naturalKeyCol]: nkString,
        ...attrs,
        effective_start_date: asOfDate,
        effective_end_date: null,
        is_current: true,
      };

      rowStatuses[sk] = 'added';
      resultRows.push(row);
      addedCount++;
      index++;
    });

    return {
      id,
      tableName,
      naturalKeyCol,
      surrogateKeyName,
      columns,
      rows: resultRows,
      rowStatuses,
      stats: {
        total: resultRows.length,
        added: addedCount,
        updated: 0,
        expired: 0,
        unchanged: 0,
      },
    };
  }

  // ==========================================
  // MODE B: INCREMENTAL SCD MERGER (Type 1 or 2)
  // ==========================================

  // Determine existing surrogate keys and max auto-increment counter
  let maxIntSk = 0;
  existingCsvRows.forEach((r) => {
    const rawSk = r[surrogateKeyName];
    if (typeof rawSk === 'number') {
      maxIntSk = Math.max(maxIntSk, rawSk);
    } else if (typeof rawSk === 'string' && /^\d+$/.test(rawSk)) {
      maxIntSk = Math.max(maxIntSk, parseInt(rawSk, 10));
    }
  });

  let nextSkIndex = maxIntSk > 0 ? maxIntSk : existingCsvRows.length;

  // Process existing rows
  const existingByNk = new Map<string, Record<string, any>[]>();
  existingCsvRows.forEach((r) => {
    const nk = String(r[naturalKeyCol] ?? '');
    if (!existingByNk.has(nk)) {
      existingByNk.set(nk, []);
    }
    existingByNk.get(nk)!.push({ ...r });
  });

  const processedIncomingNks = new Set<string>();

  // Compare each existing entity with incoming entity
  existingByNk.forEach((existingRowsForNk, nk) => {
    const incomingAttrs = incomingMap.get(nk);

    if (!incomingAttrs) {
      // Natural Key not present in this incoming batch -> preserve existing history untouched
      existingRowsForNk.forEach((row) => {
        const sk = row[surrogateKeyName];
        rowStatuses[sk] = 'unchanged';
        resultRows.push(row);
        unchangedCount++;
      });
      return;
    }

    processedIncomingNks.add(nk);

    // Find currently active record in existing CSV
    const currentActiveRowIndex = existingRowsForNk.findIndex(
      (r) => r.is_current === true || r.is_current === 'true' || r.is_current === 1 || r.is_current === '1'
    );
    const currentActiveRow =
      currentActiveRowIndex !== -1 ? existingRowsForNk[currentActiveRowIndex] : existingRowsForNk[existingRowsForNk.length - 1];

    // Check if any attributes changed
    let hasAttributeChanges = false;
    attributeCols.forEach((col) => {
      const oldVal = currentActiveRow[col] !== undefined && currentActiveRow[col] !== null ? String(currentActiveRow[col]).trim() : '';
      const newVal = incomingAttrs[col] !== undefined && incomingAttrs[col] !== null ? String(incomingAttrs[col]).trim() : '';
      if (oldVal !== newVal) {
        hasAttributeChanges = true;
      }
    });

    if (!hasAttributeChanges) {
      // Entity has not changed -> keep all rows for this entity untouched
      existingRowsForNk.forEach((row) => {
        const sk = row[surrogateKeyName];
        rowStatuses[sk] = 'unchanged';
        resultRows.push(row);
        unchangedCount++;
      });
      return;
    }

    // ------------------------------------
    // SCD Type 1: In-Place Overwrite
    // ------------------------------------
    if (scdType === 1) {
      existingRowsForNk.forEach((row, idx) => {
        if (idx === currentActiveRowIndex || (currentActiveRowIndex === -1 && idx === existingRowsForNk.length - 1)) {
          // Overwrite changed attributes in place
          const updatedRow: Record<string, any> = {
            ...row,
            ...incomingAttrs,
            is_current: true,
          };
          const sk = updatedRow[surrogateKeyName];
          rowStatuses[sk] = 'updated';
          resultRows.push(updatedRow);
          updatedCount++;
        } else {
          // Historical inactive row kept untouched
          const sk = row[surrogateKeyName];
          rowStatuses[sk] = 'unchanged';
          resultRows.push(row);
          unchangedCount++;
        }
      });
      return;
    }

    // ------------------------------------
    // SCD Type 2: History Row Versioning
    // ------------------------------------
    if (scdType === 2) {
      // 1. Expire the previous active record
      existingRowsForNk.forEach((row, idx) => {
        if (idx === currentActiveRowIndex || (currentActiveRowIndex === -1 && idx === existingRowsForNk.length - 1)) {
          const expiredRow: Record<string, any> = {
            ...row,
            effective_end_date: asOfDate,
            is_current: false,
          };
          const oldSk = expiredRow[surrogateKeyName];
          rowStatuses[oldSk] = 'expired';
          resultRows.push(expiredRow);
          expiredCount++;
        } else {
          const sk = row[surrogateKeyName];
          rowStatuses[sk] = 'unchanged';
          resultRows.push(row);
          unchangedCount++;
        }
      });

      // 2. Append new version with new surrogate key and active flag
      nextSkIndex++;
      const newSk = generateSurrogateKey(surrogateKeyFormat, nextSkIndex, `${nk}_${Date.now()}`);
      const newVersionRow: Record<string, any> = {
        [surrogateKeyName]: newSk,
        [naturalKeyCol]: nk,
        ...incomingAttrs,
        effective_start_date: asOfDate,
        effective_end_date: null,
        is_current: true,
      };

      rowStatuses[newSk] = 'updated';
      resultRows.push(newVersionRow);
      updatedCount++;
    }
  });

  // Process completely NEW Natural Keys not found in existing CSV
  incomingMap.forEach((incomingAttrs, nk) => {
    if (processedIncomingNks.has(nk)) return;

    nextSkIndex++;
    const sk = generateSurrogateKey(surrogateKeyFormat, nextSkIndex, nk);
    const newEntityRow: Record<string, any> = {
      [surrogateKeyName]: sk,
      [naturalKeyCol]: nk,
      ...incomingAttrs,
      effective_start_date: asOfDate,
      effective_end_date: null,
      is_current: true,
    };

    rowStatuses[sk] = 'added';
    resultRows.push(newEntityRow);
    addedCount++;
  });

  return {
    id,
    tableName,
    naturalKeyCol,
    surrogateKeyName,
    columns,
    rows: resultRows,
    rowStatuses,
    stats: {
      total: resultRows.length,
      added: addedCount,
      updated: updatedCount,
      expired: expiredCount,
      unchanged: unchangedCount,
    },
  };
}

/**
 * Builds the centralized Fact table by replacing descriptive natural keys with Dimension Surrogate Keys
 */
export function buildFactTable(
  flatRows: Record<string, any>[],
  columnConfigs: ColumnRoleConfig[],
  generatedDimensions: GeneratedDimension[]
): GeneratedFactTable {
  if (!flatRows || flatRows.length === 0) {
    return {
      tableName: 'fact_table',
      columns: [],
      rows: [],
      stats: { inputRows: 0, factRows: 0, columnReduction: 0, unmatchedLookups: 0 },
    };
  }

  // Pre-index current active surrogate keys for each dimension: NK -> SK
  const dimActiveLookup = new Map<string, Map<string, string | number>>();

  generatedDimensions.forEach((dim) => {
    const nkMap = new Map<string, string | number>();
    dim.rows.forEach((r) => {
      const isCurrent =
        r.is_current === true || r.is_current === 'true' || r.is_current === 1 || r.is_current === '1';
      if (isCurrent) {
        const nk = String(r[dim.naturalKeyCol] ?? '');
        nkMap.set(nk, r[dim.surrogateKeyName]);
      }
    });
    dimActiveLookup.set(dim.id, nkMap);
  });

  // Determine Fact Columns:
  // 1. Dimension Surrogate Keys (e.g. customer_sk, product_sk)
  // 2. Date/Time Key (e.g. order_date)
  // 3. Degenerate Keys (e.g. order_id, invoice_no)
  // 4. Fact Measures (e.g. quantity, unit_price, total_amount)
  const factColumns: string[] = [];

  // Add SKs from all dimensions
  generatedDimensions.forEach((dim) => {
    if (!factColumns.includes(dim.surrogateKeyName)) {
      factColumns.push(dim.surrogateKeyName);
    }
  });

  // Add Date Keys
  columnConfigs
    .filter((c) => c.role === 'date_key')
    .forEach((c) => {
      if (!factColumns.includes(c.name)) factColumns.push(c.name);
    });

  // Add Degenerate Keys
  columnConfigs
    .filter((c) => c.role === 'degenerate_key')
    .forEach((c) => {
      if (!factColumns.includes(c.name)) factColumns.push(c.name);
    });

  // Add Measures
  columnConfigs
    .filter((c) => c.role === 'fact_measure')
    .forEach((c) => {
      if (!factColumns.includes(c.name)) factColumns.push(c.name);
    });

  let unmatchedLookups = 0;

  const factRows: Record<string, any>[] = flatRows.map((rawRow) => {
    const rowObj: Record<string, any> = {};

    // 1. Look up Surrogate Keys for each dimension
    generatedDimensions.forEach((dim) => {
      const nkVal = String(rawRow[dim.naturalKeyCol] ?? '');
      const lookup = dimActiveLookup.get(dim.id);
      const sk = lookup ? lookup.get(nkVal) : null;

      if (sk !== undefined && sk !== null) {
        rowObj[dim.surrogateKeyName] = sk;
      } else {
        // Fallback for unmatched lookups (surrogate key -1 or blank)
        rowObj[dim.surrogateKeyName] = -1;
        unmatchedLookups++;
      }
    });

    // 2. Copy Date Keys
    columnConfigs
      .filter((c) => c.role === 'date_key')
      .forEach((c) => {
        rowObj[c.name] = rawRow[c.name] ?? null;
      });

    // 3. Copy Degenerate Keys
    columnConfigs
      .filter((c) => c.role === 'degenerate_key')
      .forEach((c) => {
        rowObj[c.name] = rawRow[c.name] ?? null;
      });

    // 4. Copy Measures
    columnConfigs
      .filter((c) => c.role === 'fact_measure')
      .forEach((c) => {
        const val = rawRow[c.name];
        rowObj[c.name] = val !== null && val !== undefined && val !== '' ? val : 0;
      });

    return rowObj;
  });

  const originalColCount = columnConfigs.length;
  const factColCount = factColumns.length;
  const columnReduction =
    originalColCount > 0 ? Math.round(((originalColCount - factColCount) / originalColCount) * 100) : 0;

  return {
    tableName: 'fact_table',
    columns: factColumns,
    rows: factRows,
    stats: {
      inputRows: flatRows.length,
      factRows: factRows.length,
      columnReduction: Math.max(0, columnReduction),
      unmatchedLookups,
    },
  };
}

/**
 * Builds the entire Star Schema model (Dimensions + Fact)
 */
export function executeStarSchemaBuild({
  flatRows,
  columnConfigs,
  dimensions,
}: {
  flatRows: Record<string, any>[];
  columnConfigs: ColumnRoleConfig[];
  dimensions: DimensionConfig[];
}): StarSchemaBuildResult {
  const generatedDimensions = dimensions.map((dim) => buildDimensionTable(dim, flatRows));
  const factTable = buildFactTable(flatRows, columnConfigs, generatedDimensions);

  return {
    dimensions: generatedDimensions,
    factTable,
  };
}

/**
 * Bundles all generated Star Schema tables into a single .zip file for 1-click download
 */
export async function downloadAllStarSchemaZip(
  buildResult: StarSchemaBuildResult,
  zipFileName = 'star_schema_csv_bundle.zip'
): Promise<void> {
  const zip = new JSZip();

  // Add Fact CSV
  const factCsv = formatDataToCsv(buildResult.factTable.rows, buildResult.factTable.columns);
  zip.file(`${buildResult.factTable.tableName}.csv`, factCsv);

  // Add Dimension CSVs
  buildResult.dimensions.forEach((dim) => {
    const dimCsv = formatDataToCsv(dim.rows, dim.columns);
    zip.file(`${dim.tableName}.csv`, dimCsv);
  });

  // Add Readme / Star Schema Data Dictionary
  const readmeContent = `# Star Schema & SCD Data Dictionary
Generated by CSV Star Schema & SCD Builder on ${new Date().toISOString()}

## Fact Table: ${buildResult.factTable.tableName}.csv
- Total Rows: ${buildResult.factTable.rows.length.toLocaleString()}
- Total Columns: ${buildResult.factTable.columns.length}
- Columns:
${buildResult.factTable.columns.map((c) => `  - ${c}`).join('\n')}

## Dimension Tables (${buildResult.dimensions.length} total)
${buildResult.dimensions
  .map(
    (dim) => `### ${dim.tableName}.csv
- Natural Key: ${dim.naturalKeyCol}
- Surrogate Key: ${dim.surrogateKeyName}
- Total Records: ${dim.rows.length} (Added: ${dim.stats.added}, Updated: ${dim.stats.updated}, Expired: ${dim.stats.expired}, Unchanged: ${dim.stats.unchanged})
- Columns: ${dim.columns.join(', ')}`
  )
  .join('\n\n')}
`;
  zip.file('SCHEMA_README.txt', readmeContent);

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', zipFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// BUILT-IN SAMPLE SALES CSV DATASET
// ==========================================

export const SAMPLE_FLAT_SALES_CSV_TEXT = `order_id,order_date,customer_code,customer_name,customer_city,customer_segment,product_sku,product_name,product_category,unit_price,quantity,discount_amount,total_amount,payment_method,sales_region
ORD-9001,2024-03-01,CUST-101,Sophia Martinez,Austin,Enterprise,PROD-A101,Ergonomic Chair,Office Furniture,299.00,2,29.90,568.10,Credit Card,South
ORD-9002,2024-03-01,CUST-102,Liam Chen,Seattle,Consumer,PROD-B205,UltraWide Monitor,Electronics,849.00,1,0.00,849.00,PayPal,West
ORD-9003,2024-03-02,CUST-103,Elena Rostova,Boston,Corporate,PROD-C309,Mechanical Keyboard,Electronics,129.50,3,15.00,373.50,Credit Card,East
ORD-9004,2024-03-02,CUST-101,Sophia Martinez,Austin,Enterprise,PROD-C309,Mechanical Keyboard,Electronics,129.50,1,0.00,129.50,Credit Card,South
ORD-9005,2024-03-03,CUST-104,Marcus Brody,Chicago,Corporate,PROD-D412,Noise-Cancel Pods,Audio,249.00,2,25.00,473.00,Apple Pay,Midwest
ORD-9006,2024-03-03,CUST-105,Amara Okafor,Denver,Enterprise,PROD-A101,Ergonomic Chair,Office Furniture,299.00,4,60.00,1136.00,Wire Transfer,West
ORD-9007,2024-03-04,CUST-102,Liam Chen,Seattle,Consumer,PROD-E501,Standing Desk,Office Furniture,650.00,1,50.00,600.00,PayPal,West
ORD-9008,2024-03-04,CUST-106,Lucas Silva,Miami,Consumer,PROD-F602,Precision Desk Mat,Accessories,45.00,5,5.00,220.00,Credit Card,South
ORD-9009,2024-03-05,CUST-107,Zoe Vance,New York,Enterprise,PROD-B205,UltraWide Monitor,Electronics,849.00,2,100.00,1598.00,Credit Card,East
ORD-9010,2024-03-05,CUST-103,Elena Rostova,Boston,Corporate,PROD-A101,Ergonomic Chair,Office Furniture,299.00,1,0.00,299.00,Credit Card,East
ORD-9011,2024-03-06,CUST-108,Kenji Sato,San Francisco,Enterprise,PROD-G704,USB-C Docking Hub,Electronics,180.00,3,20.00,520.00,Wire Transfer,West
ORD-9012,2024-03-06,CUST-109,Clara Dupont,Portland,Consumer,PROD-D412,Noise-Cancel Pods,Audio,249.00,1,0.00,249.00,Credit Card,West
ORD-9013,2024-03-07,CUST-104,Marcus Brody,Chicago,Corporate,PROD-E501,Standing Desk,Office Furniture,650.00,2,70.00,1230.00,Apple Pay,Midwest
ORD-9014,2024-03-07,CUST-110,Tariq Al-Mansoor,Dallas,Consumer,PROD-F602,Precision Desk Mat,Accessories,45.00,2,0.00,90.00,Credit Card,South
ORD-9015,2024-03-08,CUST-105,Amara Okafor,Denver,Enterprise,PROD-B205,UltraWide Monitor,Electronics,849.00,1,0.00,849.00,Wire Transfer,West
ORD-9016,2024-03-08,CUST-107,Zoe Vance,New York,Enterprise,PROD-C309,Mechanical Keyboard,Electronics,129.50,4,30.00,488.00,Credit Card,East
ORD-9017,2024-03-09,CUST-101,Sophia Martinez,Austin,Enterprise,PROD-G704,USB-C Docking Hub,Electronics,180.00,2,10.00,350.00,Credit Card,South
ORD-9018,2024-03-09,CUST-106,Lucas Silva,Miami,Consumer,PROD-A101,Ergonomic Chair,Office Furniture,299.00,1,15.00,284.00,Credit Card,South
ORD-9019,2024-03-10,CUST-108,Kenji Sato,San Francisco,Enterprise,PROD-E501,Standing Desk,Office Furniture,650.00,3,100.00,1850.00,Wire Transfer,West
ORD-9020,2024-03-10,CUST-110,Tariq Al-Mansoor,Dallas,Consumer,PROD-D412,Noise-Cancel Pods,Audio,249.00,1,0.00,249.00,Credit Card,South`;

/**
 * Built-in existing dimension CSV to simulate SCD Type 1 and Type 2 updates
 * (Customer Sophia Martinez lived in Houston previously, now lives in Austin;
 * Liam Chen was SMB segment previously, now Consumer).
 */
export const SAMPLE_EXISTING_CUSTOMER_CSV_TEXT = `customer_sk,customer_code,customer_name,customer_city,customer_segment,effective_start_date,effective_end_date,is_current
1,CUST-101,Sophia Martinez,Houston,Enterprise,2023-01-01,,true
2,CUST-102,Liam Chen,Seattle,SMB,2023-02-15,,true
3,CUST-103,Elena Rostova,Boston,Corporate,2023-03-10,,true
4,CUST-104,Marcus Brody,Chicago,Corporate,2023-04-01,,true
5,CUST-199,David Miller,Phoenix,Consumer,2023-05-20,,true`;

/**
 * Reads an Excel workbook (ArrayBuffer) and returns available sheet names and sheet parsing helper
 */
export function parseExcelWorkbook(buffer: ArrayBuffer): {
  sheetNames: string[];
  getSheetData: (sheetName?: string) => { headers: string[]; rows: Record<string, any>[] };
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const sheetNames = workbook.SheetNames || [];

  const getSheetData = (targetSheet?: string) => {
    const selectedSheetName = targetSheet && sheetNames.includes(targetSheet) ? targetSheet : sheetNames[0];
    if (!selectedSheetName) return { headers: [], rows: [] };

    const worksheet = workbook.Sheets[selectedSheetName];
    if (!worksheet) return { headers: [], rows: [] };

    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (rawData.length === 0) return { headers: [], rows: [] };

    // First row is header
    const rawHeaders: string[] = rawData[0].map((h, i) =>
      h !== null && h !== undefined && String(h).trim() !== '' ? String(h).trim() : `column_${i + 1}`
    );

    // Clean and deduplicate headers
    const headers: string[] = [];
    const headerCounts: Record<string, number> = {};
    rawHeaders.forEach((h) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!headerCounts[clean]) {
        headerCounts[clean] = 1;
        headers.push(clean);
      } else {
        headerCounts[clean]++;
        headers.push(`${clean}_${headerCounts[clean]}`);
      }
    });

    const rows: Record<string, any>[] = [];
    for (let r = 1; r < rawData.length; r++) {
      const rowArr = rawData[r];
      const hasVal = rowArr && rowArr.some((c: any) => c !== null && c !== undefined && c !== '');
      if (!hasVal) continue;

      const rowObj: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        let val = rowArr[colIdx] ?? '';
        if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
          val = Number(val);
        }
        rowObj[h] = val;
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  };

  return { sheetNames, getSheetData };
}

export interface StarSchemaSqlScripts {
  ddl: string;
  dml: string;
  selectStarQuery: string;
  selectHistoricalScdQuery: string;
  completeScript: string;
}

/**
 * Generates production-grade DDL, DML, and Star Schema analytical queries
 */
export function generateStarSchemaSqlScripts(
  buildResult: StarSchemaBuildResult,
  columnConfigs: ColumnRoleConfig[]
): StarSchemaSqlScripts {
  // 1. DDL (CREATE TABLE)
  const ddlLines: string[] = [
    '-- ==========================================================================',
    '-- STAR SCHEMA DDL: TABLE DEFINITIONS & RELATIONSHIPS',
    '-- ==========================================================================',
    '',
  ];

  // Dimension tables DDL
  buildResult.dimensions.forEach((dim) => {
    ddlLines.push(`DROP TABLE IF EXISTS ${dim.tableName};`);
    ddlLines.push(`CREATE TABLE ${dim.tableName} (`);

    const colDefs: string[] = [];
    dim.columns.forEach((col) => {
      if (col === dim.surrogateKeyName) {
        colDefs.push(`  ${col} INT PRIMARY KEY`);
      } else if (col === dim.naturalKeyCol) {
        colDefs.push(`  ${col} VARCHAR(100) NOT NULL`);
      } else if (col === 'effective_start_date') {
        colDefs.push(`  ${col} DATE NOT NULL`);
      } else if (col === 'effective_end_date') {
        colDefs.push(`  ${col} DATE`);
      } else if (col === 'is_current') {
        colDefs.push(`  ${col} BOOLEAN NOT NULL DEFAULT TRUE`);
      } else {
        // Attribute column
        const cfg = columnConfigs.find((c) => c.name === col);
        let sqlType = 'VARCHAR(255)';
        if (cfg?.type === 'INTEGER') sqlType = 'INT';
        else if (cfg?.type === 'FLOAT') sqlType = 'DECIMAL(12, 2)';
        else if (cfg?.type === 'DATE') sqlType = 'DATE';
        colDefs.push(`  ${col} ${sqlType}`);
      }
    });

    ddlLines.push(colDefs.join(',\n'));
    ddlLines.push(');\n');
  });

  // Fact table DDL
  ddlLines.push(`DROP TABLE IF EXISTS ${buildResult.factTable.tableName};`);
  ddlLines.push(`CREATE TABLE ${buildResult.factTable.tableName} (`);
  const factColDefs: string[] = [];

  buildResult.factTable.columns.forEach((col) => {
    const matchingDim = buildResult.dimensions.find((d) => d.surrogateKeyName === col);
    if (matchingDim) {
      factColDefs.push(`  ${col} INT NOT NULL`);
    } else {
      const cfg = columnConfigs.find((c) => c.name === col);
      if (cfg?.role === 'date_key' || cfg?.type === 'DATE') {
        factColDefs.push(`  ${col} DATE NOT NULL`);
      } else if (cfg?.role === 'degenerate_key') {
        factColDefs.push(`  ${col} VARCHAR(100) NOT NULL`);
      } else if (cfg?.type === 'INTEGER') {
        factColDefs.push(`  ${col} INT`);
      } else if (cfg?.type === 'FLOAT') {
        factColDefs.push(`  ${col} DECIMAL(12, 2)`);
      } else {
        factColDefs.push(`  ${col} VARCHAR(255)`);
      }
    }
  });

  // Foreign key constraints
  buildResult.dimensions.forEach((dim) => {
    factColDefs.push(
      `  CONSTRAINT fk_${buildResult.factTable.tableName}_${dim.surrogateKeyName} FOREIGN KEY (${dim.surrogateKeyName}) REFERENCES ${dim.tableName} (${dim.surrogateKeyName})`
    );
  });

  ddlLines.push(factColDefs.join(',\n'));
  ddlLines.push(');\n');

  const ddlString = ddlLines.join('\n');

  // 2. DML (INSERT STATEMENTS)
  const dmlLines: string[] = [
    '-- ==========================================================================',
    '-- STAR SCHEMA DML: BULK INSERT STATEMENTS',
    '-- ==========================================================================',
    '',
  ];

  const escapeSqlVal = (val: any): string => {
    if (val === null || val === undefined || val === '') return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  // Dimensions DML
  buildResult.dimensions.forEach((dim) => {
    if (dim.rows.length === 0) return;
    dmlLines.push(`-- Inserts for ${dim.tableName} (${dim.rows.length} records)`);
    dmlLines.push(`INSERT INTO ${dim.tableName} (${dim.columns.join(', ')}) VALUES`);

    const rowValLines = dim.rows.map((r) => {
      const vals = dim.columns.map((c) => escapeSqlVal(r[c]));
      return `  (${vals.join(', ')})`;
    });

    dmlLines.push(rowValLines.join(',\n') + ';\n');
  });

  // Fact DML
  if (buildResult.factTable.rows.length > 0) {
    dmlLines.push(
      `-- Inserts for ${buildResult.factTable.tableName} (${buildResult.factTable.rows.length} records)`
    );
    dmlLines.push(
      `INSERT INTO ${buildResult.factTable.tableName} (${buildResult.factTable.columns.join(
        ', '
      )}) VALUES`
    );

    const factValLines = buildResult.factTable.rows.map((r) => {
      const vals = buildResult.factTable.columns.map((c) => escapeSqlVal(r[c]));
      return `  (${vals.join(', ')})`;
    });

    dmlLines.push(factValLines.join(',\n') + ';\n');
  }

  const dmlString = dmlLines.join('\n');

  // 3. ANALYTICAL SELECT STAR SCHEMA QUERY
  const selectLines: string[] = [
    '-- ==========================================================================',
    '-- ANALYTICAL STAR SCHEMA JOIN & AGGREGATION QUERY (SELECT)',
    '-- ==========================================================================',
    '',
    'SELECT',
  ];

  const selectCols: string[] = [];
  const groupByCols: string[] = [];

  // Group by dimension descriptive columns
  buildResult.dimensions.forEach((dim, idx) => {
    const alias = `d${idx + 1}`;
    const attrs = dim.columns.filter(
      (c) =>
        c !== dim.surrogateKeyName &&
        c !== dim.naturalKeyCol &&
        c !== 'effective_start_date' &&
        c !== 'effective_end_date' &&
        c !== 'is_current'
    );
    attrs.slice(0, 2).forEach((attr: string) => {
      selectCols.push(`  ${alias}.${attr}`);
      groupByCols.push(`  ${alias}.${attr}`);
    });
  });

  // Add date key if present
  const dateCol = columnConfigs.find((c) => c.role === 'date_key');
  if (dateCol) {
    selectCols.push(`  f.${dateCol.name}`);
    groupByCols.push(`  f.${dateCol.name}`);
  }

  // Add Degenerate count
  const degenCol = columnConfigs.find((c) => c.role === 'degenerate_key');
  if (degenCol) {
    selectCols.push(`  COUNT(DISTINCT f.${degenCol.name}) AS total_transactions`);
  } else {
    selectCols.push(`  COUNT(*) AS total_records`);
  }

  // Aggregate measures
  const measureCols = columnConfigs.filter((c) => c.role === 'fact_measure');
  if (measureCols.length > 0) {
    measureCols.forEach((m) => {
      if (
        m.name.includes('total') ||
        m.name.includes('sales') ||
        m.name.includes('amount') ||
        m.name.includes('revenue')
      ) {
        selectCols.push(`  ROUND(SUM(f.${m.name}), 2) AS total_${m.name}`);
      } else if (m.name.includes('qty') || m.name.includes('quantity')) {
        selectCols.push(`  SUM(f.${m.name}) AS total_units_sold`);
      } else {
        selectCols.push(`  ROUND(AVG(f.${m.name}), 2) AS avg_${m.name}`);
      }
    });
  }

  selectLines.push(selectCols.join(',\n'));
  selectLines.push(`FROM ${buildResult.factTable.tableName} AS f`);

  // Joins
  buildResult.dimensions.forEach((dim, idx) => {
    const alias = `d${idx + 1}`;
    selectLines.push(
      `INNER JOIN ${dim.tableName} AS ${alias} ON f.${dim.surrogateKeyName} = ${alias}.${dim.surrogateKeyName} AND ${alias}.is_current = TRUE`
    );
  });

  if (groupByCols.length > 0) {
    selectLines.push('GROUP BY');
    selectLines.push(groupByCols.join(',\n'));
    selectLines.push('ORDER BY 1, 2;');
  } else {
    selectLines.push(';');
  }

  const selectStarQuery = selectLines.join('\n');

  // 4. POINT-IN-TIME SCD HISTORICAL QUERY
  const primaryDim = buildResult.dimensions[0];
  const primaryAttrs = primaryDim
    ? primaryDim.columns.filter(
        (c) =>
          c !== primaryDim.surrogateKeyName &&
          c !== primaryDim.naturalKeyCol &&
          c !== 'effective_start_date' &&
          c !== 'effective_end_date' &&
          c !== 'is_current'
      )
    : [];

  const histLines: string[] = [
    '-- ==========================================================================',
    '-- POINT-IN-TIME SCD TYPE 2 AUDIT & TIME-TRAVEL QUERY (SELECT)',
    '-- ==========================================================================',
    '',
    primaryDim
      ? `SELECT 
  d.${primaryDim.naturalKeyCol},
  ${primaryAttrs.map((a: string) => `d.${a}`).join(', ')},
  d.effective_start_date,
  d.effective_end_date,
  d.is_current,
  COUNT(f.${columnConfigs.find((c) => c.role === 'degenerate_key')?.name || '*' as string}) AS transaction_count,
  ROUND(SUM(f.${columnConfigs.find((c) => c.role === 'fact_measure')?.name || '1' as string}), 2) AS aggregated_volume
FROM ${primaryDim.tableName} AS d
LEFT JOIN ${buildResult.factTable.tableName} AS f ON d.${primaryDim.surrogateKeyName} = f.${primaryDim.surrogateKeyName}
GROUP BY 
  d.${primaryDim.naturalKeyCol}, 
  ${primaryAttrs.map((a: string) => `d.${a}`).join(', ')},
  d.effective_start_date, 
  d.effective_end_date, 
  d.is_current
ORDER BY d.${primaryDim.naturalKeyCol}, d.effective_start_date ASC;`
      : '-- No dimensions available for SCD query',
  ];

  const selectHistoricalScdQuery = histLines.join('\n');

  const completeScript = [
    ddlString,
    dmlString,
    selectStarQuery,
    '',
    selectHistoricalScdQuery,
  ].join('\n\n');

  return {
    ddl: ddlString,
    dml: dmlString,
    selectStarQuery,
    selectHistoricalScdQuery,
    completeScript,
  };
}
