/**
 * Utility for analyzing duplicates in table columns, composite keys,
 * calculating duplication metrics, generating deduplication SQL, and cleaning datasets.
 */

import { ColumnInfo, DataType } from '../types';

export interface DuplicateOptions {
  caseInsensitive?: boolean;
  trimWhitespace?: boolean;
  ignoreNulls?: boolean;
}

export interface DuplicateGroup {
  keyString: string;
  keyValues: Record<string, any>;
  count: number;
  percentage: number;
  rows: Record<string, any>[];
  rowIndices: number[];
}

export interface DuplicationAnalysisResult {
  tableName: string;
  checkedColumns: string[];
  totalRows: number;
  validRows: number;
  nullRowsCount: number;
  uniqueValuesCount: number;
  duplicateValuesCount: number; // Distinct values that appear > 1
  excessDuplicateCount: number; // Extra duplicate rows (total duplicate rows - duplicate values count)
  totalInDuplicateGroupsCount: number; // All rows belonging to duplicate groups
  uniquenessRate: number; // 0 to 100 percentage
  duplicateRate: number; // 0 to 100 percentage
  isCandidatePrimaryKey: boolean; // 100% unique and 0 nulls
  duplicateGroups: DuplicateGroup[];
  allDuplicateRows: {
    row: Record<string, any>;
    rowIndex: number;
    groupKey: string;
    groupCount: number;
    groupColorIndex: number;
  }[];
}

export interface ColumnAuditItem {
  columnName: string;
  originalName: string;
  type: DataType;
  totalRows: number;
  nullCount: number;
  distinctCount: number;
  duplicateCount: number; // Distinct keys that repeat
  excessDuplicateCount: number;
  uniquenessPercentage: number;
  hasDuplicates: boolean;
  isCandidateKey: boolean;
  sampleDuplicates: { value: any; count: number }[];
}

/**
 * Normalizes a column value based on analyzer options
 */
export function normalizeValue(val: any, options?: DuplicateOptions): string {
  if (val === null || val === undefined) {
    return '__NULL_VALUE__';
  }

  let str = String(val);

  if (options?.trimWhitespace) {
    str = str.trim();
  }

  if (options?.caseInsensitive) {
    str = str.toLowerCase();
  }

  return str;
}

/**
 * Creates a unique composite key for a row across one or multiple columns
 */
export function makeCompositeKey(row: Record<string, any>, columnNames: string[], options?: DuplicateOptions): string {
  return columnNames
    .map((col) => {
      const val = row[col];
      return `${col}:::${normalizeValue(val, options)}`;
    })
    .join('|||');
}

/**
 * Checks whether a row is considered null/empty for the given columns
 */
export function isRowNull(row: Record<string, any>, columnNames: string[]): boolean {
  return columnNames.every((col) => row[col] === null || row[col] === undefined || row[col] === '');
}

/**
 * Analyzes duplicate values in specified column(s)
 */
export function analyzeColumnDuplicates(
  rows: Record<string, any>[],
  columnNames: string[],
  tableName: string,
  options: DuplicateOptions = { caseInsensitive: false, trimWhitespace: true, ignoreNulls: false }
): DuplicationAnalysisResult {
  const totalRows = rows.length;
  if (totalRows === 0 || columnNames.length === 0) {
    return {
      tableName,
      checkedColumns: columnNames,
      totalRows: 0,
      validRows: 0,
      nullRowsCount: 0,
      uniqueValuesCount: 0,
      duplicateValuesCount: 0,
      excessDuplicateCount: 0,
      totalInDuplicateGroupsCount: 0,
      uniquenessRate: 100,
      duplicateRate: 0,
      isCandidatePrimaryKey: false,
      duplicateGroups: [],
      allDuplicateRows: [],
    };
  }

  const groupMap = new Map<
    string,
    {
      keyValues: Record<string, any>;
      displayKey: string;
      rows: Record<string, any>[];
      indices: number[];
      isNullGroup: boolean;
    }
  >();

  let nullRowsCount = 0;

  rows.forEach((row, index) => {
    const isNull = isRowNull(row, columnNames);
    if (isNull) {
      nullRowsCount++;
      if (options.ignoreNulls) {
        return;
      }
    }

    const key = makeCompositeKey(row, columnNames, options);
    const existing = groupMap.get(key);

    const keyValues: Record<string, any> = {};
    columnNames.forEach((col) => {
      keyValues[col] = row[col];
    });

    const displayKey = columnNames.map((col) => `${row[col] ?? 'NULL'}`).join(' • ');

    if (!existing) {
      groupMap.set(key, {
        keyValues,
        displayKey,
        rows: [row],
        indices: [index],
        isNullGroup: isNull,
      });
    } else {
      existing.rows.push(row);
      existing.indices.push(index);
    }
  });

  const validRows = options.ignoreNulls ? totalRows - nullRowsCount : totalRows;

  // Process groups
  const duplicateGroups: DuplicateGroup[] = [];
  let duplicateValuesCount = 0;
  let excessDuplicateCount = 0;
  let totalInDuplicateGroupsCount = 0;

  groupMap.forEach((entry, keyString) => {
    const count = entry.rows.length;
    if (count > 1) {
      duplicateValuesCount++;
      excessDuplicateCount += count - 1;
      totalInDuplicateGroupsCount += count;

      duplicateGroups.push({
        keyString: entry.displayKey,
        keyValues: entry.keyValues,
        count,
        percentage: validRows > 0 ? (count / validRows) * 100 : 0,
        rows: entry.rows,
        rowIndices: entry.indices,
      });
    }
  });

  // Sort duplicate groups by count descending
  duplicateGroups.sort((a, b) => b.count - a.count);

  // Flatten duplicate rows with alternating color groups
  const allDuplicateRows: DuplicationAnalysisResult['allDuplicateRows'] = [];
  duplicateGroups.forEach((group, gIdx) => {
    group.rows.forEach((r, rIdx) => {
      allDuplicateRows.push({
        row: r,
        rowIndex: group.rowIndices[rIdx],
        groupKey: group.keyString,
        groupCount: group.count,
        groupColorIndex: gIdx % 2,
      });
    });
  });

  const uniqueValuesCount = groupMap.size;
  const uniquenessRate = validRows > 0 ? Math.max(0, ((validRows - excessDuplicateCount) / validRows) * 100) : 100;
  const duplicateRate = validRows > 0 ? (excessDuplicateCount / validRows) * 100 : 0;
  const isCandidatePrimaryKey = excessDuplicateCount === 0 && nullRowsCount === 0 && totalRows > 0;

  return {
    tableName,
    checkedColumns: columnNames,
    totalRows,
    validRows,
    nullRowsCount,
    uniqueValuesCount,
    duplicateValuesCount,
    excessDuplicateCount,
    totalInDuplicateGroupsCount,
    uniquenessRate: Number(uniquenessRate.toFixed(2)),
    duplicateRate: Number(duplicateRate.toFixed(2)),
    isCandidatePrimaryKey,
    duplicateGroups,
    allDuplicateRows,
  };
}

/**
 * Runs a rapid duplicate audit across every column in a table
 */
export function auditAllColumns(rows: Record<string, any>[], columns: ColumnInfo[]): ColumnAuditItem[] {
  const totalRows = rows.length;

  return columns.map((col) => {
    const colName = col.name;
    const valueCounts = new Map<any, number>();
    let nullCount = 0;

    rows.forEach((r) => {
      const val = r[colName];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      }
      valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
    });

    let duplicateCount = 0; // Values with count > 1
    let excessDuplicateCount = 0;
    const sampleDuplicates: { value: any; count: number }[] = [];

    valueCounts.forEach((cnt, val) => {
      if (cnt > 1) {
        duplicateCount++;
        excessDuplicateCount += cnt - 1;
        if (sampleDuplicates.length < 5) {
          sampleDuplicates.push({ value: val ?? 'NULL', count: cnt });
        }
      }
    });

    sampleDuplicates.sort((a, b) => b.count - a.count);

    const distinctCount = valueCounts.size;
    const uniquenessPercentage = totalRows > 0 ? ((totalRows - excessDuplicateCount) / totalRows) * 100 : 100;
    const isCandidateKey = excessDuplicateCount === 0 && nullCount === 0 && totalRows > 0;

    return {
      columnName: col.name,
      originalName: col.originalName || col.name,
      type: col.type,
      totalRows,
      nullCount,
      distinctCount,
      duplicateCount,
      excessDuplicateCount,
      uniquenessPercentage: Number(uniquenessPercentage.toFixed(1)),
      hasDuplicates: duplicateCount > 0,
      isCandidateKey,
      sampleDuplicates,
    };
  });
}

/**
 * Generates SQL queries for analyzing and deduplicating data
 */
export function generateDeduplicationSql(
  tableName: string,
  columnNames: string[],
  strategy: 'find_counts' | 'view_full_rows' | 'keep_first' | 'keep_last' | 'remove_all_dupes',
  orderByColumn?: string
): string {
  const cols = columnNames.map((c) => `[${c}]`).join(', ');
  const rawCols = columnNames.map((c) => c).join(', ');
  const orderClause = orderByColumn ? ` ORDER BY [${orderByColumn}] ASC` : '';
  const orderClauseDesc = orderByColumn ? ` ORDER BY [${orderByColumn}] DESC` : '';

  switch (strategy) {
    case 'find_counts':
      return `-- 1. Count duplicate occurrences in ${tableName}
SELECT 
  ${cols}, 
  COUNT(*) AS duplicate_count
FROM [${tableName}]
GROUP BY ${cols}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;`;

    case 'view_full_rows':
      return `-- 2. Retrieve all rows that have duplicate ${rawCols}
SELECT a.*
FROM [${tableName}] a
INNER JOIN (
  SELECT ${cols}
  FROM [${tableName}]
  GROUP BY ${cols}
  HAVING COUNT(*) > 1
) dup ON ${columnNames.map((c) => `a.[${c}] = dup.[${c}]`).join(' AND ')}
ORDER BY ${columnNames.map((c) => `a.[${c}]`).join(', ')}${orderClause ? `, a.[${orderByColumn}]` : ''};`;

    case 'keep_first':
      return `-- 3. Deduplicate keeping the FIRST (earliest) record
-- (Creates a clean unique dataset)
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER(PARTITION BY ${cols}${orderClause || ' ORDER BY (SELECT 1)'}) AS _row_rank
  FROM [${tableName}]
) ranked
WHERE _row_rank = 1;`;

    case 'keep_last':
      return `-- 4. Deduplicate keeping the LAST (most recent) record
SELECT *
FROM (
  SELECT *,
    ROW_NUMBER() OVER(PARTITION BY ${cols}${orderClauseDesc || ' ORDER BY (SELECT 1) DESC'}) AS _row_rank
  FROM [${tableName}]
) ranked
WHERE _row_rank = 1;`;

    case 'remove_all_dupes':
      return `-- 5. Isolate only strictly UNIQUE rows (discards ALL rows involved in duplicates)
SELECT a.*
FROM [${tableName}] a
INNER JOIN (
  SELECT ${cols}
  FROM [${tableName}]
  GROUP BY ${cols}
  HAVING COUNT(*) = 1
) unique_keys ON ${columnNames.map((c) => `a.[${c}] = unique_keys.[${c}]`).join(' AND ')};`;

    default:
      return `SELECT * FROM [${tableName}];`;
  }
}

/**
 * Performs client-side deduplication returning the cleaned dataset
 */
export function performDeduplication(
  rows: Record<string, any>[],
  columnNames: string[],
  strategy: 'keep_first' | 'keep_last' | 'remove_all_dupes',
  options: DuplicateOptions = { caseInsensitive: false, trimWhitespace: true }
): {
  cleanedRows: Record<string, any>[];
  removedRows: Record<string, any>[];
  removedCount: number;
} {
  if (rows.length === 0 || columnNames.length === 0) {
    return { cleanedRows: [...rows], removedRows: [], removedCount: 0 };
  }

  const keyMap = new Map<string, Record<string, any>[]>();

  rows.forEach((row) => {
    const key = makeCompositeKey(row, columnNames, options);
    const list = keyMap.get(key) || [];
    list.push(row);
    keyMap.set(key, list);
  });

  const cleanedRows: Record<string, any>[] = [];
  const removedRows: Record<string, any>[] = [];

  keyMap.forEach((matchedRows) => {
    if (matchedRows.length === 1) {
      cleanedRows.push(matchedRows[0]);
    } else {
      // Duplicates exist
      if (strategy === 'keep_first') {
        cleanedRows.push(matchedRows[0]);
        for (let i = 1; i < matchedRows.length; i++) {
          removedRows.push(matchedRows[i]);
        }
      } else if (strategy === 'keep_last') {
        cleanedRows.push(matchedRows[matchedRows.length - 1]);
        for (let i = 0; i < matchedRows.length - 1; i++) {
          removedRows.push(matchedRows[i]);
        }
      } else if (strategy === 'remove_all_dupes') {
        // Discard all
        matchedRows.forEach((r) => removedRows.push(r));
      }
    }
  });

  return {
    cleanedRows,
    removedRows,
    removedCount: removedRows.length,
  };
}
