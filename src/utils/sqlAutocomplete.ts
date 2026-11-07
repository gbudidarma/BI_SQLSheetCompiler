import { TableSchema, DataType } from '../types';

export type SuggestionType = 'keyword' | 'function' | 'table' | 'column' | 'snippet';

export interface SqlSuggestion {
  label: string;
  insertText: string;
  type: SuggestionType;
  detail?: string;
  documentation?: string;
  dataType?: DataType;
  cursorOffset?: number; // Cursor relative offset from end of insertText
}

export const SQL_KEYWORDS: { label: string; detail: string }[] = [
  { label: 'SELECT', detail: 'Retrieve rows from table(s)' },
  { label: 'DISTINCT', detail: 'Eliminate duplicate rows' },
  { label: 'FROM', detail: 'Specify source table(s)' },
  { label: 'WHERE', detail: 'Filter rows by condition' },
  { label: 'GROUP BY', detail: 'Group rows by expression' },
  { label: 'HAVING', detail: 'Filter grouped rows' },
  { label: 'ORDER BY', detail: 'Sort output records' },
  { label: 'ASC', detail: 'Ascending sort order' },
  { label: 'DESC', detail: 'Descending sort order' },
  { label: 'LIMIT', detail: 'Constrain number of returned rows' },
  { label: 'OFFSET', detail: 'Skip initial rows' },
  { label: 'JOIN', detail: 'Combine rows from multiple tables' },
  { label: 'INNER JOIN', detail: 'Rows matching in both tables' },
  { label: 'LEFT JOIN', detail: 'All rows from left table' },
  { label: 'RIGHT JOIN', detail: 'All rows from right table' },
  { label: 'ON', detail: 'Join key equality condition' },
  { label: 'AS', detail: 'Alias table or column' },
  { label: 'AND', detail: 'Logical AND' },
  { label: 'OR', detail: 'Logical OR' },
  { label: 'NOT', detail: 'Logical NOT' },
  { label: 'IN', detail: 'Value in set or subquery' },
  { label: 'LIKE', detail: 'Pattern matching' },
  { label: 'BETWEEN', detail: 'Value range test' },
  { label: 'IS NULL', detail: 'Check for null values' },
  { label: 'IS NOT NULL', detail: 'Check for non-null values' },
  { label: 'CASE', detail: 'Conditional expression' },
  { label: 'WHEN', detail: 'Condition branch in CASE' },
  { label: 'THEN', detail: 'Result branch in CASE' },
  { label: 'ELSE', detail: 'Default branch in CASE' },
  { label: 'END', detail: 'End CASE expression' },
  { label: 'UNION', detail: 'Combine results of multiple queries' },
  { label: 'UNION ALL', detail: 'Combine results retaining duplicates' },
  { label: 'CREATE TABLE', detail: 'Create a new table' },
  { label: 'INSERT INTO', detail: 'Insert rows into table' },
  { label: 'UPDATE', detail: 'Modify existing rows' },
  { label: 'SET', detail: 'Assign column values in UPDATE' },
  { label: 'DELETE FROM', detail: 'Delete rows from table' },
  { label: 'DROP TABLE', detail: 'Remove table from database' },
];

export const SQL_FUNCTIONS: { label: string; insertText: string; detail: string; cursorOffset: number }[] = [
  { label: 'COUNT(*)', insertText: 'COUNT(*)', detail: 'Count matching rows', cursorOffset: 0 },
  { label: 'COUNT(col)', insertText: 'COUNT()', detail: 'Count non-null values', cursorOffset: -1 },
  { label: 'SUM(col)', insertText: 'SUM()', detail: 'Sum of numeric values', cursorOffset: -1 },
  { label: 'AVG(col)', insertText: 'AVG()', detail: 'Average of numeric values', cursorOffset: -1 },
  { label: 'MIN(col)', insertText: 'MIN()', detail: 'Minimum value', cursorOffset: -1 },
  { label: 'MAX(col)', insertText: 'MAX()', detail: 'Maximum value', cursorOffset: -1 },
  { label: 'ROUND(num, dec)', insertText: 'ROUND(, 2)', detail: 'Round numeric value', cursorOffset: -4 },
  { label: 'UPPER(str)', insertText: 'UPPER()', detail: 'Convert string to uppercase', cursorOffset: -1 },
  { label: 'LOWER(str)', insertText: 'LOWER()', detail: 'Convert string to lowercase', cursorOffset: -1 },
  { label: 'COALESCE(a, b)', insertText: 'COALESCE(, )', detail: 'First non-null argument', cursorOffset: -3 },
  { label: 'DATE(val)', insertText: 'DATE()', detail: 'Parse or format date', cursorOffset: -1 },
  { label: 'CONCAT(a, b)', insertText: 'CONCAT(, )', detail: 'Concatenate strings', cursorOffset: -3 },
];

/**
 * Extracts table aliases defined in the query (e.g., "sales_orders AS o" or "FROM sales_orders o")
 */
export function extractAliases(sql: string, tables: TableSchema[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  const tableNames = tables.map((t) => t.name);

  // Pattern: tableName (AS)? alias
  tableNames.forEach((tbl) => {
    const regex = new RegExp(`\\b${tbl}\\b(?:\\s+AS)?\\s+([a-zA-Z0-9_]+)`, 'gi');
    let match;
    while ((match = regex.exec(sql)) !== null) {
      const alias = match[1];
      const upperAlias = alias.toUpperCase();
      // Avoid SQL keywords treated as aliases
      if (!['JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'WHERE', 'GROUP', 'ORDER', 'LIMIT', 'SET'].includes(upperAlias)) {
        aliases[alias.toLowerCase()] = tbl;
      }
    }
  });

  return aliases;
}

/**
 * Parses the current word and any table qualifier before the cursor.
 */
export function getContextAtCursor(
  text: string,
  cursorPos: number
): {
  prefix: string;
  qualifier?: string; // e.g. "orders."
  tokenStart: number;
} {
  const textBefore = text.substring(0, cursorPos);

  // Match identifier or qualified identifier right before cursor (e.g. "sal", "orders.pr", "o.")
  const match = textBefore.match(/([a-zA-Z0-9_]+)?(?:\.([a-zA-Z0-9_]*))?$/);

  if (!match) {
    return { prefix: '', tokenStart: cursorPos };
  }

  const fullMatched = match[0];
  const tokenStart = cursorPos - fullMatched.length;

  if (fullMatched.includes('.')) {
    const parts = fullMatched.split('.');
    return {
      qualifier: parts[0],
      prefix: parts[1] || '',
      tokenStart,
    };
  }

  return {
    prefix: fullMatched,
    tokenStart,
  };
}

/**
 * Generates matching suggestions based on cursor position and active table catalog.
 */
export function getSuggestions(
  text: string,
  cursorPos: number,
  tables: TableSchema[]
): {
  suggestions: SqlSuggestion[];
  tokenStart: number;
  prefix: string;
  qualifier?: string;
} {
  const { prefix, qualifier, tokenStart } = getContextAtCursor(text, cursorPos);
  const lowerPrefix = prefix.toLowerCase();
  const lowerQualifier = qualifier ? qualifier.toLowerCase() : undefined;

  const aliases = extractAliases(text, tables);
  const suggestions: SqlSuggestion[] = [];

  // Case 1: User typed a qualifier like "sales_orders." or "o." -> suggest only columns of that table
  if (lowerQualifier) {
    const targetTableName = aliases[lowerQualifier] || lowerQualifier;
    const matchedTable = tables.find(
      (t) => t.name.toLowerCase() === targetTableName
    );

    if (matchedTable) {
      matchedTable.columns.forEach((col) => {
        const colLower = col.name.toLowerCase();
        // Only suggest if prefix is empty (just typed dot) or column is incomplete
        if (!lowerPrefix || (colLower.startsWith(lowerPrefix) && colLower !== lowerPrefix)) {
          suggestions.push({
            label: col.name,
            insertText: col.name,
            type: 'column',
            detail: `${matchedTable.name}.${col.name} (${col.type})`,
            dataType: col.type,
          });
        }
      });
    }

    return {
      suggestions,
      tokenStart,
      prefix,
      qualifier,
    };
  }

  // Case 2: General context (unqualified)
  // Only suggest if prefix is at least 1 character or user explicitly requested
  if (lowerPrefix.length === 0) {
    // If empty prefix but right after FROM or JOIN, suggest tables
    const textBefore = text.substring(0, cursorPos);
    if (/\b(FROM|JOIN|INTO|TABLE|UPDATE)\s+$/i.test(textBefore)) {
      tables.forEach((tbl) => {
        suggestions.push({
          label: tbl.name,
          insertText: tbl.name,
          type: 'table',
          detail: `${tbl.rowCount} rows · ${tbl.columns.length} cols`,
        });
      });
      return { suggestions, tokenStart, prefix, qualifier };
    }

    // If after WHERE, ON, AND, OR, SET, HAVING, SELECT, suggest columns
    if (/\b(WHERE|ON|AND|OR|SET|HAVING|SELECT)\s+$/i.test(textBefore)) {
      tables.forEach((tbl) => {
        tbl.columns.forEach((col) => {
          if (!suggestions.some((s) => s.label === col.name)) {
            suggestions.push({
              label: col.name,
              insertText: col.name,
              type: 'column',
              detail: `${tbl.name}.${col.name} (${col.type})`,
              dataType: col.type,
            });
          }
        });
      });
      return { suggestions: suggestions.slice(0, 10), tokenStart, prefix, qualifier };
    }

    return { suggestions: [], tokenStart, prefix, qualifier };
  }

  // 1. Match Table Names (only when incomplete)
  tables.forEach((tbl) => {
    const tblLower = tbl.name.toLowerCase();
    if (tblLower.startsWith(lowerPrefix) && tblLower !== lowerPrefix) {
      suggestions.push({
        label: tbl.name,
        insertText: tbl.name,
        type: 'table',
        detail: `${tbl.rowCount} rows · ${tbl.columns.length} cols`,
      });
    }
  });

  // 2. Match Columns across all active tables (only when incomplete)
  tables.forEach((tbl) => {
    tbl.columns.forEach((col) => {
      const colLower = col.name.toLowerCase();
      if (colLower.startsWith(lowerPrefix) && colLower !== lowerPrefix) {
        // avoid duplicates if column exists in multiple tables
        if (!suggestions.some((s) => s.type === 'column' && s.label === col.name)) {
          suggestions.push({
            label: col.name,
            insertText: col.name,
            type: 'column',
            detail: `${tbl.name} (${col.type})`,
            dataType: col.type,
          });
        }
      }
    });
  });

  // 3. Match SQL Functions (suggest function signature / templates)
  SQL_FUNCTIONS.forEach((fn) => {
    const fnLower = fn.label.toLowerCase();
    if (fnLower.startsWith(lowerPrefix) && fn.insertText.toLowerCase() !== lowerPrefix) {
      suggestions.push({
        label: fn.label,
        insertText: fn.insertText,
        type: 'function',
        detail: fn.detail,
        cursorOffset: fn.cursorOffset,
      });
    }
  });

  // 4. Match SQL Keywords (only suggest when user has not yet completed the word)
  SQL_KEYWORDS.forEach((kw) => {
    const kwLower = kw.label.toLowerCase();
    if (kwLower.startsWith(lowerPrefix) && kwLower !== lowerPrefix) {
      suggestions.push({
        label: kw.label,
        insertText: `${kw.label} `,
        type: 'keyword',
        detail: kw.detail,
      });
    }
  });

  // Rank suggestions:
  // Exact start-with matches first, then shorter labels, then tables & columns
  suggestions.sort((a, b) => {
    const aStarts = a.label.toLowerCase().startsWith(lowerPrefix);
    const bStarts = b.label.toLowerCase().startsWith(lowerPrefix);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Prioritize tables and columns if matching
    const typePriority: Record<SuggestionType, number> = {
      table: 1,
      column: 2,
      keyword: 3,
      function: 4,
      snippet: 5,
    };
    if (typePriority[a.type] !== typePriority[b.type]) {
      return typePriority[a.type] - typePriority[b.type];
    }

    return a.label.length - b.label.length;
  });

  return {
    suggestions: suggestions.slice(0, 10), // Limit to top 10 relevant candidates
    tokenStart,
    prefix,
    qualifier,
  };
}
