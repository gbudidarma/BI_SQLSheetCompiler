import alasql from 'alasql';
import { PlanStep, QueryPlan, QueryResult, TableSchema } from '../types';
import { parseSheetData, sanitizeSqlIdentifier } from './excelParser';

// Initialize alasql settings
try {
  // Disable warning popups if any
  alasql.options.errorlog = true;
  alasql.options.casesensitive = false;
} catch (e) {
  console.warn('Alasql options initialization note:', e);
}

/**
 * Registers an array of records as a named SQL table in AlaSQL.
 */
export function registerTable(name: string, rows: Record<string, any>[]): void {
  const cleanName = sanitizeSqlIdentifier(name);
  // Deep clone data shallowly to prevent unintended mutation
  const tableData = rows.map((r) => ({ ...r }));

  // Drop table if already exists to refresh
  try {
    alasql(`DROP TABLE IF EXISTS ${cleanName}`);
  } catch {
    // Ignore drop error
  }

  // Create table in alasql and set its data
  alasql(`CREATE TABLE ${cleanName}`);
  if (alasql.tables[cleanName]) {
    alasql.tables[cleanName].data = tableData;
  }
}

/**
 * Removes a table from the AlaSQL engine.
 */
export function dropTableFromEngine(name: string): void {
  const cleanName = sanitizeSqlIdentifier(name);
  try {
    alasql(`DROP TABLE IF EXISTS ${cleanName}`);
  } catch (err) {
    console.error('Error dropping table:', err);
  }
}

/**
 * Analyzes SQL text to build a query compilation plan and AST inspection.
 */
export function analyzeQuery(sql: string, availableTables: string[]): QueryPlan {
  const clean = sql.trim().replace(/;+$/, '');
  const upper = clean.toUpperCase();

  // Determine statement type
  let statementType = 'SELECT';
  if (/^SELECT\b/i.test(clean)) statementType = 'SELECT';
  else if (/^CREATE\s+TABLE\b/i.test(clean)) statementType = 'CREATE TABLE';
  else if (/^INSERT\s+INTO\b/i.test(clean)) statementType = 'INSERT';
  else if (/^UPDATE\b/i.test(clean)) statementType = 'UPDATE';
  else if (/^DELETE\b/i.test(clean)) statementType = 'DELETE';
  else if (/^DROP\s+TABLE\b/i.test(clean)) statementType = 'DROP TABLE';
  else if (/^ALTER\s+TABLE\b/i.test(clean)) statementType = 'ALTER TABLE';
  else if (/^SHOW\b/i.test(clean)) statementType = 'SHOW';

  // Detect tables referenced
  const tablesReferenced: string[] = [];
  availableTables.forEach((tbl) => {
    const regex = new RegExp(`\\b${tbl}\\b`, 'i');
    if (regex.test(clean)) {
      tablesReferenced.push(tbl);
    }
  });

  const hasWhere = /\bWHERE\b/i.test(clean);
  const hasJoin = /\b(JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|OUTER JOIN)\b/i.test(clean);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(clean);
  const hasOrderBy = /\bORDER\s+BY\b/i.test(clean);
  const limitMatch = clean.match(/\bLIMIT\s+(\d+)\b/i);
  const hasLimit = Boolean(limitMatch);
  const limitCount = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

  // Extract projected columns (rough estimate for SELECT queries)
  const columnsProjected: string[] = [];
  if (statementType === 'SELECT') {
    const fromIndex = upper.indexOf(' FROM ');
    if (fromIndex > 6) {
      const selectClause = clean.substring(6, fromIndex).trim();
      if (selectClause === '*') {
        columnsProjected.push('* (All columns)');
      } else {
        selectClause.split(',').forEach((c) => {
          const colClean = c.trim();
          if (colClean) columnsProjected.push(colClean);
        });
      }
    }
  }

  // Construct Plan Steps
  const steps: PlanStep[] = [];
  let stepCounter = 1;

  steps.push({
    step: stepCounter++,
    phase: 'PARSE',
    title: 'Lexical & Syntax Parsing',
    detail: `Parsed ${statementType} statement. Validated grammar and token stream.`,
  });

  if (tablesReferenced.length > 0) {
    steps.push({
      step: stepCounter++,
      phase: 'SCAN',
      title: `Table Scan: ${tablesReferenced.join(', ')}`,
      detail: `In-memory sequential scan over ${tablesReferenced.length} source table(s).`,
      costEstimate: 'O(N)',
    });
  }

  if (hasJoin) {
    steps.push({
      step: stepCounter++,
      phase: 'JOIN',
      title: 'Relational Join Operator',
      detail: 'Hash-based inner/outer join evaluation on declared key conditions.',
      costEstimate: 'O(N + M)',
    });
  }

  if (hasWhere) {
    steps.push({
      step: stepCounter++,
      phase: 'FILTER',
      title: 'Predicate Filtering (WHERE)',
      detail: 'Evaluated boolean row expressions and filtering criteria.',
      costEstimate: 'O(N)',
    });
  }

  if (hasGroupBy) {
    steps.push({
      step: stepCounter++,
      phase: 'GROUP',
      title: 'Hash Aggregation (GROUP BY)',
      detail: 'Bucket partition by group keys; computed aggregates (SUM, COUNT, AVG, etc.).',
      costEstimate: 'O(N log K)',
    });
  }

  if (hasOrderBy) {
    steps.push({
      step: stepCounter++,
      phase: 'SORT',
      title: 'Result Ordering (ORDER BY)',
      detail: 'Timsort over projection columns according to ASC/DESC directions.',
      costEstimate: 'O(K log K)',
    });
  }

  steps.push({
    step: stepCounter++,
    phase: 'PROJECT',
    title: 'Output Projection & Materialization',
    detail: hasLimit
      ? `Materialize top ${limitCount} records and format column types.`
      : 'Materialize result set into tabular records.',
  });

  return {
    statementType,
    tablesReferenced,
    columnsProjected,
    hasWhere,
    hasJoin,
    hasGroupBy,
    hasOrderBy,
    hasLimit,
    limitCount,
    steps,
  };
}

/**
 * Formats and beautifies SQL queries with consistent casing and indentation.
 */
export function formatSql(sql: string): string {
  if (!sql) return '';

  const keywords = [
    'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'JOIN', 'ON',
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'AS', 'UNION ALL', 'UNION',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'LIKE', 'IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL'
  ];

  let formatted = sql.trim();

  // Keyword uppercase replacement (respecting boundary)
  keywords.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi');
    formatted = formatted.replace(reg, kw);
  });

  // Major clauses newline separation
  const majorClauses = [
    'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'JOIN', 'UNION ALL', 'UNION'
  ];

  majorClauses.forEach((clause) => {
    const reg = new RegExp(`\\s+${clause}\\b`, 'g');
    formatted = formatted.replace(reg, `\n${clause}`);
  });

  return formatted;
}

/**
 * Inspects SQL query AST to extract projected columns in the exact user-specified order,
 * properly expanding `table.*` and `*` relative to other projected columns.
 */
export function extractProjectedColumnOrder(
  sql: string,
  availableTables: string[] = []
): string[] | null {
  try {
    const parsed = (alasql as any).parse(sql);
    if (!parsed || !parsed.statements || parsed.statements.length === 0) return null;
    const stmt = parsed.statements[0];
    if (!stmt.columns || !Array.isArray(stmt.columns) || stmt.columns.length === 0) return null;

    // Build map of alias/table name -> canonical table name
    const aliasMap = new Map<string, string>();
    availableTables.forEach((tbl) => {
      aliasMap.set(tbl.toLowerCase(), tbl);
    });

    if (stmt.from && Array.isArray(stmt.from)) {
      stmt.from.forEach((f: any) => {
        if (f.tableid) {
          aliasMap.set(f.tableid.toLowerCase(), f.tableid);
          if (f.as) aliasMap.set(f.as.toLowerCase(), f.tableid);
        }
      });
    }
    if (stmt.joins && Array.isArray(stmt.joins)) {
      stmt.joins.forEach((j: any) => {
        const tid = j.table ? j.table.tableid : j.tableid;
        if (tid) {
          aliasMap.set(tid.toLowerCase(), tid);
          if (j.as) aliasMap.set(j.as.toLowerCase(), tid);
        }
      });
    }

    const getTableColumns = (tableRef: string): string[] => {
      const canonical = aliasMap.get(tableRef.toLowerCase()) || tableRef;
      const tbl = (alasql as any).tables?.[canonical] || (alasql as any).tables?.[canonical.toLowerCase()];
      if (tbl && Array.isArray(tbl.data) && tbl.data.length > 0) {
        return Object.keys(tbl.data[0]);
      }
      return [];
    };

    const ordered: string[] = [];
    stmt.columns.forEach((col: any) => {
      if (col.columnid === '*') {
        if (col.tableid) {
          const tblCols = getTableColumns(col.tableid);
          tblCols.forEach((k) => {
            if (!ordered.includes(k)) ordered.push(k);
          });
        } else {
          // Unqualified * -> all tables in FROM/JOIN order
          aliasMap.forEach((canonicalName) => {
            const tblCols = getTableColumns(canonicalName);
            tblCols.forEach((k) => {
              if (!ordered.includes(k)) ordered.push(k);
            });
          });
        }
      } else {
        const name = col.as || col.columnid;
        if (name && !ordered.includes(name)) {
          ordered.push(name);
        }
      }
    });

    return ordered.length > 0 ? ordered : null;
  } catch {
    return null;
  }
}

/**
 * Finds the closest candidate string to suggest typos/fuzzy matches.
 */
function findClosestMatch(target: string, candidates: string[]): string | null {
  if (!target || !candidates || candidates.length === 0) return null;
  const cleanTarget = target.toLowerCase().replace(/[_\s-]/g, '');

  // Direct normalized match (e.g. custno -> cust_no)
  for (const cand of candidates) {
    const cleanCand = cand.toLowerCase().replace(/[_\s-]/g, '');
    if (cleanCand === cleanTarget) return cand;
  }

  // Substring match
  for (const cand of candidates) {
    const cleanCand = cand.toLowerCase().replace(/[_\s-]/g, '');
    if (cleanCand.includes(cleanTarget) || cleanTarget.includes(cleanCand)) return cand;
  }

  // Character difference
  let bestCand: string | null = null;
  let minDiff = Infinity;
  for (const cand of candidates) {
    const c1 = target.toLowerCase();
    const c2 = cand.toLowerCase();
    if (Math.abs(c1.length - c2.length) > 3) continue;
    let diff = 0;
    const len = Math.min(c1.length, c2.length);
    for (let i = 0; i < len; i++) {
      if (c1[i] !== c2[i]) diff++;
    }
    diff += Math.abs(c1.length - c2.length);
    if (diff <= 3 && diff < minDiff) {
      minDiff = diff;
      bestCand = cand;
    }
  }
  return bestCand;
}

/**
 * Validates query identifiers (tables & columns) before execution to prevent
 * silent 0-row returns caused by typos in WHERE or JOIN ON clauses.
 */
function validateQuerySemantics(
  sql: string,
  availableTables: string[]
): {
  valid: boolean;
  error?: string;
  errorLocation?: { line?: number; column?: number; token?: string };
  errorCategory?: 'syntax' | 'table_not_found' | 'column_not_found' | 'type_mismatch' | 'runtime';
  suggestion?: string;
  autoFix?: { from: string; to: string; description: string };
} {
  let ast: any;
  try {
    ast = (alasql as any).parse(sql);
  } catch (parseErr: any) {
    const rawMsg = parseErr?.message || String(parseErr);
    const lineMatch = rawMsg.match(/line\s+(\d+)/i);
    const colMatch = rawMsg.match(/(?:column|char|position)\s+(\d+)/i);
    const tokenMatch = rawMsg.match(/(?:near|token|got)\s+['"]?([^'"\n\r]+)['"]?/i);

    let calculatedCol: number | undefined;
    const dashMatch = rawMsg.match(/(-+)\^/);
    if (dashMatch) {
      calculatedCol = dashMatch[1].length + 1;
    }

    const token = tokenMatch ? tokenMatch[1].trim() : undefined;
    const firstLine = rawMsg.split('\n')[0].replace(/^SyntaxError:\s*/i, '');

    // Check for AlaSQL reserved words
    const reservedWords = ['TOTAL', 'VALUE', 'OPEN', 'CLOSE', 'USER', 'PERCENT', 'ORDER', 'KEY', 'GROUP', 'DATE'];
    let suggestion: string | undefined;
    let autoFix: { from: string; to: string; description: string } | undefined;

    if (token && reservedWords.includes(token.toUpperCase())) {
      suggestion = `'${token}' is a reserved SQL keyword in AlaSQL. Wrap it in square brackets like [${token}] or backticks \`${token}\` to use it as a column name.`;
      autoFix = {
        from: token,
        to: `[${token}]`,
        description: `Wrap [${token}] in brackets`,
      };
    }

    return {
      valid: false,
      error: firstLine || 'Syntax parsing error',
      errorLocation: {
        line: lineMatch ? parseInt(lineMatch[1], 10) : 1,
        column: colMatch ? parseInt(colMatch[1], 10) : calculatedCol,
        token,
      },
      errorCategory: 'syntax',
      suggestion,
      autoFix,
    };
  }

  if (!ast || !ast.statements || ast.statements.length === 0) {
    return { valid: true };
  }

  const stmt = ast.statements[0];
  if (!stmt.from || !Array.isArray(stmt.from) || stmt.from.length === 0) {
    return { valid: true };
  }

  // Map alias -> real table name
  const aliasToTable = new Map<string, string>();
  const allReferencedTables: string[] = [];

  stmt.from.forEach((f: any) => {
    if (f.tableid) {
      const real = availableTables.find((t) => t.toLowerCase() === f.tableid.toLowerCase()) || f.tableid;
      const alias = (f.as || f.tableid).toLowerCase();
      aliasToTable.set(alias, real);
      aliasToTable.set(real.toLowerCase(), real);
      allReferencedTables.push(real);
    }
  });

  if (stmt.joins && Array.isArray(stmt.joins)) {
    stmt.joins.forEach((j: any) => {
      const tid = j.table ? j.table.tableid : j.tableid;
      if (tid) {
        const real = availableTables.find((t) => t.toLowerCase() === tid.toLowerCase()) || tid;
        const alias = (j.as || tid).toLowerCase();
        aliasToTable.set(alias, real);
        aliasToTable.set(real.toLowerCase(), real);
        allReferencedTables.push(real);
      }
    });
  }

  // 1. Verify that referenced tables exist in catalog
  for (const t of allReferencedTables) {
    const exists =
      availableTables.some((at) => at.toLowerCase() === t.toLowerCase()) ||
      Boolean((alasql as any).tables?.[t] || (alasql as any).tables?.[t.toLowerCase()]);

    if (!exists && !['dual', 'information_schema'].includes(t.toLowerCase())) {
      const match = findClosestMatch(t, availableTables);
      return {
        valid: false,
        error: `Table '${t}' does not exist in the database catalog.`,
        errorLocation: { token: t },
        errorCategory: 'table_not_found',
        suggestion: match
          ? `Did you mean table '${match}'? (Available tables: ${availableTables.join(', ')})`
          : `Available tables in catalog: ${availableTables.join(', ')}`,
        autoFix: match ? { from: t, to: match, description: `Replace '${t}' with '${match}'` } : undefined,
      };
    }
  }

  // 2. Helper to fetch known column names for a table
  const getTableColumns = (tableName: string): string[] => {
    const tbl = (alasql as any).tables?.[tableName] || (alasql as any).tables?.[tableName.toLowerCase()];
    if (tbl && Array.isArray(tbl.data) && tbl.data.length > 0 && typeof tbl.data[0] === 'object' && tbl.data[0] !== null) {
      return Object.keys(tbl.data[0]);
    }
    return [];
  };

  // 3. Inspect AST nodes for column references (especially in WHERE and JOIN ON)
  const checkColumnAst = (node: any): any => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const res = checkColumnAst(item);
        if (res) return res;
      }
      return null;
    }

    if (node.columnid && node.columnid !== '*' && !node.param && typeof node.columnid === 'string') {
      const col = node.columnid;
      if (node.tableid) {
        // Qualified column: e.g. a.cust_no
        const realTable = aliasToTable.get(node.tableid.toLowerCase());
        if (realTable) {
          const cols = getTableColumns(realTable);
          if (cols.length > 0 && !cols.some((c) => c.toLowerCase() === col.toLowerCase())) {
            const match = findClosestMatch(col, cols);
            return {
              valid: false,
              error: `Column '${col}' does not exist in table '${realTable}' (alias '${node.tableid}').`,
              errorLocation: { token: col },
              errorCategory: 'column_not_found',
              suggestion: match
                ? `Did you mean column '${match}'? (Available in ${realTable}: ${cols.join(', ')})`
                : `Available columns in '${realTable}': ${cols.join(', ')}`,
              autoFix: match ? { from: col, to: match, description: `Replace '${col}' with '${match}'` } : undefined,
            };
          }
        }
      } else {
        // Unqualified column in filter or condition: e.g. WHERE cust_no = 1
        let foundInAny = false;
        let checkedAny = false;
        const allCols: string[] = [];

        for (const t of allReferencedTables) {
          const cols = getTableColumns(t);
          if (cols.length > 0) {
            checkedAny = true;
            allCols.push(...cols);
            if (cols.some((c) => c.toLowerCase() === col.toLowerCase())) {
              foundInAny = true;
              break;
            }
          }
        }

        if (checkedAny && !foundInAny) {
          const match = findClosestMatch(col, allCols);
          return {
            valid: false,
            error: `Column '${col}' does not exist in referenced table(s) (${allReferencedTables.join(', ')}).`,
            errorLocation: { token: col },
            errorCategory: 'column_not_found',
            suggestion: match
              ? `Did you mean column '${match}'? (Available columns: ${Array.from(new Set(allCols)).join(', ')})`
              : `Available columns: ${Array.from(new Set(allCols)).join(', ')}`,
            autoFix: match ? { from: col, to: match, description: `Replace '${col}' with '${match}'` } : undefined,
          };
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key !== 'columnid' && key !== 'tableid') {
        const res = checkColumnAst(node[key]);
        if (res) return res;
      }
    }
    return null;
  };

  // Check WHERE clause
  if (stmt.where) {
    const err = checkColumnAst(stmt.where);
    if (err) return err;
  }

  // Check JOIN ON conditions
  if (stmt.joins) {
    for (const j of stmt.joins) {
      if (j.on) {
        const err = checkColumnAst(j.on);
        if (err) return err;
      }
    }
  }

  return { valid: true };
}

/**
 * Executes a SQL query against the in-memory AlaSQL database.
 */
export function executeQuery(
  rawSql: string,
  availableTables: string[]
): QueryResult {
  const sql = rawSql.trim().replace(/;+$/, '');
  const timestamp = Date.now();

  if (!sql) {
    return {
      query: rawSql,
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: 'Query is empty. Please enter a valid SQL query.',
      errorCategory: 'syntax',
      timestamp,
    };
  }

  const startTime = performance.now();
  const plan = analyzeQuery(sql, availableTables);

  // Perform semantic validation first to prevent silent 0-row returns caused by column/table typos
  const semanticCheck = validateQuerySemantics(sql, availableTables);
  if (!semanticCheck.valid) {
    const endTime = performance.now();
    const duration = Math.max(0.1, Number((endTime - startTime).toFixed(2)));
    return {
      query: rawSql,
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: duration,
      error: semanticCheck.error || 'SQL Semantic Error',
      errorLocation: semanticCheck.errorLocation,
      errorCategory: semanticCheck.errorCategory,
      suggestion: semanticCheck.suggestion,
      autoFix: semanticCheck.autoFix,
      plan,
      timestamp,
    };
  }

  try {
    // Execute query in AlaSQL
    const rawResult = alasql(sql);
    const endTime = performance.now();
    const duration = Math.max(0.1, Number((endTime - startTime).toFixed(2)));

    // Handle command vs data result
    let data: Record<string, any>[] = [];
    let columns: string[] = [];
    let affectedRows: number | undefined;
    const isCommand = plan.statementType !== 'SELECT';

    if (Array.isArray(rawResult)) {
      data = rawResult;
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        // Collect all distinct column keys across results
        const colSet = new Set<string>();
        data.forEach((row) => {
          Object.keys(row).forEach((k) => colSet.add(k));
        });
        const actualKeys = Array.from(colSet);

        // Try to respect exact query projected column order (e.g. `custno, a.*, b.customer, net_sales_amount`)
        const projectedOrder = extractProjectedColumnOrder(sql, availableTables);
        if (projectedOrder && projectedOrder.length > 0) {
          // Keep projected order for all keys that actually exist in the result
          const ordered: string[] = [];
          projectedOrder.forEach((col) => {
            if (actualKeys.includes(col) && !ordered.includes(col)) {
              ordered.push(col);
            }
          });
          // Append any remaining keys in result that were not in projected list
          actualKeys.forEach((col) => {
            if (!ordered.includes(col)) {
              ordered.push(col);
            }
          });
          columns = ordered;
        } else {
          columns = actualKeys;
        }

        // Reorder each row's keys to match columns order
        data = data.map((row) => {
          const reordered: Record<string, any> = {};
          columns.forEach((col) => {
            reordered[col] = row[col];
          });
          return reordered;
        });
      }
    } else if (typeof rawResult === 'number') {
      affectedRows = rawResult;
    }

    // If query executed with 0 rows returned on a SELECT query with filters or joins, provide an informative warning
    let warning: string | undefined;
    let errorCategory: QueryResult['errorCategory'] | undefined;
    if (data.length === 0 && !isCommand) {
      if (plan.hasWhere || plan.hasJoin) {
        warning = `Query executed in ${duration}ms, but returned 0 rows. Verify that filter values (case-sensitivity, numbers vs text) and JOIN keys match data in the source tables.`;
        errorCategory = 'zero_rows_warning';
      }
    }

    return {
      query: rawSql,
      success: true,
      data,
      columns,
      rowCount: data.length,
      executionTimeMs: duration,
      affectedRows,
      isCommand,
      plan,
      warning,
      errorCategory,
      timestamp,
    };
  } catch (err: any) {
    const endTime = performance.now();
    const duration = Math.max(0.1, Number((endTime - startTime).toFixed(2)));

    const errMsg = err?.message || String(err) || 'SQL Execution error';

    // Parse potential line & position from error message
    let line: number | undefined;
    let column: number | undefined;
    let token: string | undefined;

    const lineMatch = errMsg.match(/line\s+(\d+)/i);
    const colMatch = errMsg.match(/(?:column|char|position)\s+(\d+)/i);
    const tokenMatch = errMsg.match(/(?:near|token|got)\s+['"]?([^'"\n\r]+)['"]?/i);

    const dashMatch = errMsg.match(/(-+)\^/);
    if (dashMatch) {
      column = dashMatch[1].length + 1;
    }

    if (lineMatch) line = parseInt(lineMatch[1], 10);
    if (colMatch) column = parseInt(colMatch[1], 10);
    if (tokenMatch) token = tokenMatch[1].trim();

    // Check for reserved keyword issues in AlaSQL
    let suggestion: string | undefined;
    let autoFix: { from: string; to: string; description: string } | undefined;
    if (token) {
      const reserved = ['TOTAL', 'VALUE', 'OPEN', 'CLOSE', 'USER', 'PERCENT', 'ORDER', 'KEY', 'GROUP', 'DATE'];
      if (reserved.includes(token.toUpperCase())) {
        suggestion = `'${token}' is a reserved SQL keyword in AlaSQL. Wrap it in square brackets like [${token}] or backticks to use it as an identifier.`;
        autoFix = {
          from: token,
          to: `[${token}]`,
          description: `Wrap [${token}] in brackets`,
        };
      }
    }

    return {
      query: rawSql,
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: duration,
      error: errMsg.split('\n')[0] || errMsg,
      errorLocation: { line, column, token },
      errorCategory: 'runtime',
      suggestion,
      autoFix,
      plan,
      timestamp,
    };
  }
}

/**
 * Checks if the engine has any newly created tables (e.g. from CREATE TABLE query)
 * and extracts their TableSchema so the UI stays synchronized.
 */
export function extractEngineTables(
  existingSchemas: TableSchema[]
): TableSchema[] {
  const existingMap = new Map<string, TableSchema>();
  existingSchemas.forEach((s) => existingMap.set(s.name, s));

  const updated: TableSchema[] = [];
  const engineTableNames = Object.keys(alasql.tables || {});

  engineTableNames.forEach((tblName) => {
    const tbl = (alasql.tables as any)?.[tblName];
    if (!tbl || !Array.isArray(tbl.data)) return;

    const rows = (tbl.data || []) as Record<string, any>[];

    if (existingMap.has(tblName)) {
      // Keep existing metadata but update row count
      const existing = existingMap.get(tblName)!;
      updated.push({
        ...existing,
        rowCount: rows.length,
        previewRows: rows.slice(0, 10),
        allRows: rows,
      });
    } else {
      // New table created via SQL!
      const headers = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null ? Object.keys(rows[0]) : [];
      const arrayRows: any[][] = [headers];
      rows.forEach((r: any) => {
        arrayRows.push(headers.map((h) => r[h]));
      });

      const parsed = parseSheetData(arrayRows, tblName, 'SQL Created', tblName);
      updated.push({
        ...parsed.schema,
        allRows: rows,
      });
    }
  });

  return updated;
}

/**
 * Retrieves all rows for a registered table from the AlaSQL engine.
 */
export function getTableRowsFromEngine(name: string): Record<string, any>[] {
  if (!name) return [];
  const cleanName = sanitizeSqlIdentifier(name);
  if (alasql.tables && (alasql.tables as any)[cleanName] && Array.isArray((alasql.tables as any)[cleanName].data)) {
    return (alasql.tables as any)[cleanName].data;
  }
  // Try case-insensitive lookup
  if (alasql.tables) {
    const foundKey = Object.keys(alasql.tables).find(
      (k) => k.toLowerCase() === cleanName.toLowerCase() || k.toLowerCase() === name.toLowerCase()
    );
    if (foundKey && Array.isArray((alasql.tables as any)[foundKey]?.data)) {
      return (alasql.tables as any)[foundKey].data;
    }
  }
  try {
    const res = alasql(`SELECT * FROM ${cleanName}`);
    if (Array.isArray(res)) return res;
  } catch {
    // Ignore query fallback error
  }
  return [];
}
