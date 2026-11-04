import * as XLSX from 'xlsx';
import { inferDataType } from './excelParser';

/**
 * Downloads query results or table data as an Excel file (.xlsx)
 */
export function exportToExcel(
  data: Record<string, any>[],
  columns: string[],
  fileName = 'query_result'
): void {
  if (!data || data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Downloads data as a CSV file
 */
export function exportToCsv(
  data: Record<string, any>[],
  columns: string[],
  fileName = 'query_result'
): void {
  if (!data || data.length === 0) return;

  const headerLine = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
  const rowLines = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  const csvContent = [headerLine, ...rowLines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies data to clipboard as formatted JSON
 */
export async function copyAsJson(data: Record<string, any>[]): Promise<boolean> {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(jsonString);
    return true;
  } catch (err) {
    console.error('Failed to copy JSON:', err);
    return false;
  }
}

/**
 * Copies data to clipboard as Markdown table
 */
export async function copyAsMarkdown(
  data: Record<string, any>[],
  columns: string[]
): Promise<boolean> {
  try {
    if (!data.length || !columns.length) return false;
    const headerRow = `| ${columns.join(' | ')} |`;
    const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`;
    const rows = data.slice(0, 100).map((r) => {
      return `| ${columns.map((c) => String(r[c] ?? '')).join(' | ')} |`;
    });
    const markdown = [headerRow, separatorRow, ...rows].join('\n');
    await navigator.clipboard.writeText(markdown);
    return true;
  } catch (err) {
    console.error('Failed to copy markdown:', err);
    return false;
  }
}

export interface InsertScriptOptions {
  tableName?: string;
  includeCreateTable?: boolean;
  batchSize?: number; // rows per INSERT statement, default 50
  format?: 'multi-row' | 'single-row';
}

/**
 * Formats a single JS value into a SQL literal.
 */
function formatSqlLiteral(val: any): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 'NULL' : String(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (val instanceof Date) {
    return `'${val.toISOString().split('T')[0]}'`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Maps inferred data types to SQL DDL types.
 */
function getSqlType(type: string): string {
  switch (type) {
    case 'INTEGER':
      return 'INT';
    case 'FLOAT':
      return 'NUMERIC(12, 2)';
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'DATE':
      return 'DATE';
    case 'TEXT':
    default:
      return 'VARCHAR(255)';
  }
}

/**
 * Generates an SQL INSERT script from tabular data and columns.
 */
export function generateInsertScript(
  data: Record<string, any>[],
  columns: string[],
  options: InsertScriptOptions = {}
): string {
  if (!data || data.length === 0 || !columns || columns.length === 0) {
    return '-- No records found to generate INSERT script';
  }

  const tableName = (options.tableName || 'exported_table')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const includeCreateTable = options.includeCreateTable ?? true;
  const format = options.format || 'multi-row';
  const batchSize = Math.max(1, options.batchSize || 50);

  const lines: string[] = [];

  lines.push(`-- ==============================================================`);
  lines.push(`-- SQL INSERT SCRIPT FOR TABLE: ${tableName}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Total Records: ${data.length}`);
  lines.push(`-- ==============================================================\n`);

  // Optional CREATE TABLE DDL
  if (includeCreateTable) {
    lines.push(`DROP TABLE IF EXISTS ${tableName};\n`);
    lines.push(`CREATE TABLE ${tableName} (`);

    const colDefs = columns.map((col, idx) => {
      const sampleVals = data.slice(0, 30).map((r) => r[col]);
      const inferred = inferDataType(sampleVals);
      const sqlType = getSqlType(inferred);
      const comma = idx < columns.length - 1 ? ',' : '';
      return `  ${col} ${sqlType}${comma}`;
    });

    lines.push(colDefs.join('\n'));
    lines.push(`);\n`);
  }

  const colList = columns.join(', ');

  if (format === 'single-row') {
    // Individual INSERT statements
    data.forEach((row) => {
      const valList = columns.map((c) => formatSqlLiteral(row[c])).join(', ');
      lines.push(`INSERT INTO ${tableName} (${colList}) VALUES (${valList});`);
    });
  } else {
    // Multi-row batched INSERT statements
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      lines.push(`INSERT INTO ${tableName} (${colList}) VALUES`);

      const valRows = batch.map((row, rIdx) => {
        const valList = columns.map((c) => formatSqlLiteral(row[c])).join(', ');
        const isLastInBatch = rIdx === batch.length - 1;
        return `  (${valList})${isLastInBatch ? ';' : ','}`;
      });

      lines.push(valRows.join('\n'));
      lines.push(''); // blank line between batches
    }
  }

  return lines.join('\n');
}

/**
 * Downloads SQL script content as a .sql file
 */
export function downloadSqlScript(sqlContent: string, fileName = 'insert_script'): void {
  const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.sql`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports query results into a multi-sheet Excel workbook:
 * - Sheet 1 ('Data_Results'): Tabular results with header row
 * - Sheet 2 ('SQL_Insert_Script'): The complete SQL CREATE TABLE & INSERT statements
 */
export function exportExcelWithScript(
  data: Record<string, any>[],
  columns: string[],
  sqlScript: string,
  fileName = 'query_result_with_script'
): void {
  if (!data || data.length === 0) return;

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Results Data
  const dataSheet = XLSX.utils.json_to_sheet(data, { header: columns });
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data_Results');

  // Sheet 2: SQL Insert Script line-by-line
  const scriptLines = sqlScript.split('\n').map((line) => ({ 'SQL Script': line }));
  const scriptSheet = XLSX.utils.json_to_sheet(scriptLines, { header: ['SQL Script'] });
  scriptSheet['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(workbook, scriptSheet, 'SQL_Insert_Script');

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

