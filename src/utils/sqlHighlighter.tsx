import React from 'react';

// VS Code Dark+ standard color palette
export const VSCODE_COLORS = {
  keyword: '#569CD6',    // Blue for SQL clauses (SELECT, FROM, WHERE, JOIN, GROUP BY, etc.)
  secondary: '#569CD6',  // Blue for SQL keywords (AS, AND, OR, NOT, IN, LIKE, ON, etc.)
  function: '#DCDCAA',   // Yellow for functions (COUNT, SUM, AVG, ROUND, etc.)
  table: '#4EC9B0',      // Teal for tables (sales_orders, product_catalog, etc.)
  column: '#9CDCFE',     // Light Blue for variables/columns (unit_price, customer_name, etc.)
  string: '#CE9178',     // Warm Coral for strings ('Office Furniture')
  number: '#B5CEA8',     // Soft Green for numbers (1001, 189.99)
  comment: '#6A9955',    // Muted Olive Green for comments (-- comment)
  operator: '#D4D4D4',   // Light Gray for operators (=, <>, +, -, *)
  punctuation: '#808080',// Gray for commas, semicolons, dots
  bracket: '#FFD700',    // Gold for parentheses and brackets
  default: '#D4D4D4',    // Default text color
};

// VS Code Light+ standard color palette
export const VSCODE_LIGHT_COLORS = {
  keyword: '#0000FF',    // Classic blue for SQL clauses
  secondary: '#0000FF',  // Blue for SQL keywords
  function: '#795E26',   // Brown/amber for functions (COUNT, SUM)
  table: '#267F99',      // Dark teal for tables
  column: '#001080',     // Dark navy blue for variables/columns
  string: '#A31515',     // Dark red for strings
  number: '#098658',     // Rich green for numbers
  comment: '#008000',    // Forest green for comments
  operator: '#383838',   // Charcoal for operators
  punctuation: '#222222',// Dark gray for commas, semicolons, dots
  bracket: '#0451A5',    // Navy for parentheses and brackets
  default: '#0f172a',    // Dark slate text color
};

const CLAUSE_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'ALL', 'EXISTS', 'CREATE', 'TABLE', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'DROP', 'ALTER'
]);

const SECONDARY_KEYWORDS = new Set([
  'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'IS', 'NULL', 'ON',
  'DISTINCT', 'BETWEEN', 'ASC', 'DESC', 'TRUE', 'FALSE', 'WITH', 'AS'
]);

const BUILTIN_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'UPPER', 'LOWER', 'COALESCE',
  'DATE', 'CONCAT', 'LENGTH', 'TRIM', 'SUBSTR', 'SUBSTRING', 'NOW', 'XLSX',
  'CSV', 'STRFTIME', 'IFNULL', 'CAST', 'REPLACE'
]);

/**
 * Highlights a string of SQL with rich VS Code Dark+ or Light+ color tokens.
 */
export function highlightSql(
  sql: string,
  tableNamesOrTheme?: string[] | 'dark' | 'bright',
  columnNames: string[] = [],
  theme: 'dark' | 'bright' = 'dark'
): React.ReactNode[] {
  if (!sql) return [];

  let effectiveTheme: 'dark' | 'bright' = theme;
  let effectiveTables: string[] = [];
  const effectiveColumns: string[] = columnNames;

  if (typeof tableNamesOrTheme === 'string') {
    effectiveTheme = tableNamesOrTheme === 'bright' ? 'bright' : 'dark';
  } else if (Array.isArray(tableNamesOrTheme)) {
    effectiveTables = tableNamesOrTheme;
  }

  const colors = effectiveTheme === 'bright' ? VSCODE_LIGHT_COLORS : VSCODE_COLORS;

  const tableSet = new Set(effectiveTables.map((t) => t.toLowerCase()));
  const columnSet = new Set(effectiveColumns.map((c) => c.toLowerCase()));

  // Token regex for SQL elements
  const tokenRegex = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|[a-zA-Z_][a-zA-Z0-9_]*|[<>=!+\-*/%]+|[(),.;]|\s+|[^\s\w])/g;

  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = tokenRegex.exec(sql)) !== null) {
    const token = match[0];
    const upper = token.toUpperCase();
    const lower = token.toLowerCase();

    // 1. Comments
    if (token.startsWith('--') || token.startsWith('/*')) {
      nodes.push(
        <span
          key={keyIndex++}
          style={{ color: colors.comment, fontStyle: 'italic' }}
        >
          {token}
        </span>
      );
      continue;
    }

    // 2. Strings
    if (token.startsWith("'") || token.startsWith('"')) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.string }}>
          {token}
        </span>
      );
      continue;
    }

    // 3. Numbers
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.number }}>
          {token}
        </span>
      );
      continue;
    }

    // 4. Clause Keywords (SELECT, FROM, WHERE, etc.)
    if (CLAUSE_KEYWORDS.has(upper)) {
      nodes.push(
        <span
          key={keyIndex++}
          style={{ color: colors.keyword, fontWeight: 600 }}
        >
          {token}
        </span>
      );
      continue;
    }

    // 5. Secondary Keywords (AND, OR, AS, IS NULL, etc.)
    if (SECONDARY_KEYWORDS.has(upper)) {
      nodes.push(
        <span
          key={keyIndex++}
          style={{ color: colors.secondary, fontWeight: 500 }}
        >
          {token}
        </span>
      );
      continue;
    }

    // 6. Functions (COUNT, SUM, AVG, etc.)
    if (BUILTIN_FUNCTIONS.has(upper)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.function }}>
          {token}
        </span>
      );
      continue;
    }

    // 7. Known Tables
    if (tableSet.has(lower)) {
      nodes.push(
        <span
          key={keyIndex++}
          style={{ color: colors.table, fontWeight: 600 }}
          title={`Table: ${token}`}
        >
          {token}
        </span>
      );
      continue;
    }

    // 8. Known Columns
    if (columnSet.has(lower)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.column }}>
          {token}
        </span>
      );
      continue;
    }

    // 9. Parentheses / Brackets
    if (token === '(' || token === ')' || token === '[' || token === ']') {
      nodes.push(
        <span
          key={keyIndex++}
          style={{ color: colors.bracket, fontWeight: 600 }}
        >
          {token}
        </span>
      );
      continue;
    }

    // 10. Operators
    if (/^[<>=!+\-*/%]+$/.test(token)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.operator }}>
          {token}
        </span>
      );
      continue;
    }

    // 11. Punctuation
    if (/^[.,;]$/.test(token)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.punctuation }}>
          {token}
        </span>
      );
      continue;
    }

    // Default identifier (variable/column)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      nodes.push(
        <span key={keyIndex++} style={{ color: colors.column }}>
          {token}
        </span>
      );
      continue;
    }

    // Whitespace or unmatched characters
    nodes.push(
      <span key={keyIndex++} style={{ color: colors.default }}>
        {token}
      </span>
    );
  }

  // Trailing newline spacer so empty last line doesn't collapse
  if (sql.endsWith('\n')) {
    nodes.push(' ');
  }

  return nodes;
}
