/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import alasql from 'alasql';
import { TableSchema, ColumnInfo, DataType } from '../types';

export interface PasteIngestResult {
  tableName: string;
  rows: Record<string, any>[];
  columns: ColumnInfo[];
  schema: TableSchema;
  detectedFormat: 'sql' | 'tsv' | 'csv' | 'json';
  lineCount: number;
}

/**
 * Infer column metadata and data types from an array of record objects
 */
export function inferColumnsFromRows(rows: Record<string, any>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map((colName) => {
    let type: DataType = 'TEXT';
    let nullCount = 0;
    const values: any[] = [];

    for (const row of rows) {
      const val = row[colName];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        values.push(val);
      }
    }

    if (values.length > 0) {
      const allNumbers = values.every((v) => typeof v === 'number');
      const allInts = allNumbers && values.every((v) => Number.isInteger(v));
      const allBooleans = values.every((v) => typeof v === 'boolean');
      const allDates = values.every((v) => {
        if (typeof v !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
      });

      if (allBooleans) type = 'BOOLEAN';
      else if (allInts) type = 'INTEGER';
      else if (allNumbers) type = 'FLOAT';
      else if (allDates) type = 'DATE';
    }

    const distinct = new Set(values).size;

    return {
      name: colName,
      originalName: colName,
      type,
      nullCount,
      distinctCount: distinct,
      sampleValues: values.slice(0, 5),
    };
  });
}

/**
 * Detect format of pasted content: SQL, JSON, TSV, or CSV
 */
export function detectPasteFormat(content: string): 'sql' | 'json' | 'tsv' | 'csv' {
  const trimmed = content.trim();

  // 1. JSON Array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return 'json';
      }
    } catch {
      // not valid json, continue
    }
  }

  // 2. SQL Dump (CREATE TABLE / INSERT INTO)
  const upper = trimmed.slice(0, 1000).toUpperCase();
  if (
    upper.includes('INSERT INTO') ||
    upper.includes('CREATE TABLE') ||
    upper.startsWith('INSERT ') ||
    upper.startsWith('CREATE ')
  ) {
    return 'sql';
  }

  // 3. TSV (Tab separated - typical when copying grid from DBeaver / Snowsight / BigQuery Studio)
  const firstLines = trimmed.split(/\r?\n/).slice(0, 5);
  const tabCounts = firstLines.map((l) => (l.match(/\t/g) || []).length);
  if (tabCounts.length > 0 && tabCounts[0] >= 1 && tabCounts.every((c) => c === tabCounts[0])) {
    return 'tsv';
  }

  // 4. Default: CSV or delimited text
  return 'csv';
}

/**
 * Parse Delimited Text (CSV or TSV)
 */
export function parseDelimitedText(
  text: string,
  delimiter?: string
): { headers: string[]; rows: Record<string, any>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter if not provided
  let sep = delimiter;
  if (!sep) {
    const firstLine = lines[0];
    const tabs = (firstLine.match(/\t/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const pipes = (firstLine.match(/\|/g) || []).length;

    if (tabs >= commas && tabs >= semicolons && tabs > 0) sep = '\t';
    else if (semicolons > commas && semicolons > 0) sep = ';';
    else if (pipes > commas && pipes > 0) sep = '|';
    else sep = ',';
  }

  const rawHeaders = splitDelimitedLine(lines[0], sep).map((h, i) =>
    h.trim().replace(/^["']|["']$/g, '') || `col_${i + 1}`
  );

  // Sanitize header names
  const headers = rawHeaders.map((h) =>
    h.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1').toLowerCase()
  );

  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = splitDelimitedLine(line, sep);
    const row: Record<string, any> = {};

    headers.forEach((h, idx) => {
      let val: any = values[idx] !== undefined ? values[idx].trim().replace(/^["']|["']$/g, '') : null;

      // Type auto-coercion
      if (val === '' || val === null || val === 'NULL' || val === 'null' || val === '\\N') {
        val = null;
      } else if (!isNaN(val as any) && val !== '') {
        val = Number(val);
      } else if (val.toLowerCase() === 'true') {
        val = true;
      } else if (val.toLowerCase() === 'false') {
        val = false;
      }

      row[h] = val;
    });

    rows.push(row);
  }

  return { headers, rows };
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Execute and ingest SQL statements (CREATE TABLE & INSERT INTO) into in-memory AlaSQL
 */
export function parseSqlDump(
  sqlContent: string,
  preferredTableName?: string
): { tableName: string; rows: Record<string, any>[] } {
  // Capture existing AlaSQL tables before running
  const beforeTables = new Set(Object.keys((alasql as any).tables || {}));

  // Clean statements
  const statements = sqlContent
    .split(/;\s*[\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let detectedTableName = preferredTableName || '';

  for (const stmt of statements) {
    // Detect table name from CREATE TABLE or INSERT INTO
    const match = stmt.match(/(?:CREATE\s+TABLE|INSERT\s+INTO)\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
    if (match && !detectedTableName) {
      detectedTableName = match[1];
    }

    try {
      (alasql as any)(stmt);
    } catch {
      // Ignore individual statement errors (e.g. SET, DROP, etc.)
    }
  }

  // Identify new or modified table
  const afterTables = Object.keys((alasql as any).tables || {});
  const newTables = afterTables.filter((t) => !beforeTables.has(t));

  const targetTable =
    detectedTableName ||
    newTables[newTables.length - 1] ||
    preferredTableName ||
    'imported_sql_table';

  let rows: Record<string, any>[] = [];
  if ((alasql as any).tables?.[targetTable]?.data) {
    rows = (alasql as any).tables[targetTable].data;
  } else {
    try {
      rows = (alasql as any)(`SELECT * FROM ${targetTable}`);
    } catch {
      rows = [];
    }
  }

  return {
    tableName: targetTable,
    rows: Array.isArray(rows) ? rows : [],
  };
}

/**
 * Ingest any text pasted from database consoles, query tools, or spreadsheets
 */
export function ingestPastedData(
  content: string,
  customTableName?: string
): PasteIngestResult {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Please paste SQL DDL/INSERT statements, CSV/TSV table grid, or JSON array.');
  }

  const format = detectPasteFormat(trimmed);
  let tableName = customTableName ? customTableName.trim().replace(/[^a-zA-Z0-9_]/g, '_') : '';
  let rows: Record<string, any>[] = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(trimmed);
      rows = Array.isArray(parsed) ? parsed : [parsed];
      if (!tableName) tableName = 'pasted_json_data';
    } catch (err: any) {
      throw new Error(`Invalid JSON format: ${err.message}`);
    }
  } else if (format === 'sql') {
    const parsedSql = parseSqlDump(trimmed, tableName || 'imported_sql_dump');
    tableName = parsedSql.tableName;
    rows = parsedSql.rows;

    if (rows.length === 0) {
      // If alaSQL parsing couldn't extract rows directly, fallback to regex-based insert parsing
      rows = extractRowsFromSqlInserts(trimmed);
    }
  } else if (format === 'tsv') {
    const parsed = parseDelimitedText(trimmed, '\t');
    rows = parsed.rows;
    if (!tableName) tableName = 'pasted_db_grid';
  } else {
    // csv
    const parsed = parseDelimitedText(trimmed);
    rows = parsed.rows;
    if (!tableName) tableName = 'pasted_csv_table';
  }

  if (rows.length === 0) {
    throw new Error(
      'Could not extract any rows from the pasted content. Ensure it contains a valid header row and data.'
    );
  }

  if (!tableName) tableName = 'imported_table';

  const columns = inferColumnsFromRows(rows);
  const lineCount = trimmed.split(/\r?\n/).length;

  const schema: TableSchema = {
    id: `paste_${tableName}_${Date.now()}`,
    name: tableName,
    sourceFileName: `Direct Ingest (${format.toUpperCase()})`,
    sheetName: `${tableName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'postgres', // registers seamlessly in schema
    connectionName: `Direct Ingest [${format.toUpperCase()}: ${rows.length} rows]`,
  };

  return {
    tableName,
    rows,
    columns,
    schema,
    detectedFormat: format,
    lineCount,
  };
}

/**
 * Fallback regex parser for standard INSERT INTO tbl (col1, col2) VALUES (val1, val2);
 */
function extractRowsFromSqlInserts(sql: string): Record<string, any>[] {
  const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]+?);/gi;
  let match;
  const rows: Record<string, any>[] = [];

  while ((match = insertRegex.exec(sql)) !== null) {
    const rawCols = match[2];
    const rawValuesBlock = match[3];

    let columns: string[] = [];
    if (rawCols) {
      columns = rawCols
        .split(',')
        .map((c) => c.trim().replace(/[`"']/g, '').replace(/[^a-zA-Z0-9_]/g, '_'));
    }

    // Split value groups: (val1, val2), (val3, val4)
    const tupleRegex = /\(([\s\S]*?)\)/g;
    let tupleMatch;

    while ((tupleMatch = tupleRegex.exec(rawValuesBlock)) !== null) {
      const vals = splitDelimitedLine(tupleMatch[1], ',').map((v) => {
        const trimmed = v.trim().replace(/^['"]|['"]$/g, '');
        if (trimmed.toUpperCase() === 'NULL') return null;
        if (!isNaN(trimmed as any) && trimmed !== '') return Number(trimmed);
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;
        return trimmed;
      });

      if (columns.length === 0) {
        columns = vals.map((_, idx) => `col_${idx + 1}`);
      }

      const row: Record<string, any> = {};
      columns.forEach((col, idx) => {
        row[col] = vals[idx] !== undefined ? vals[idx] : null;
      });
      rows.push(row);
    }
  }

  return rows;
}
