import { TableSchema, JoinRelationship, ModelFilter, ModelOrderBy } from '../types';

interface GenerateSqlParams {
  tables: TableSchema[];
  nodes: {
    tableName: string;
    selectedColumns: string[];
  }[];
  joins: JoinRelationship[];
  filters?: ModelFilter[];
  orderBy?: ModelOrderBy[];
  limit?: number;
}

/**
 * Generates an optimized, formatted SQL query from visual data modeler state.
 */
export function generateSqlFromModel({
  tables,
  nodes,
  joins,
  filters = [],
  orderBy = [],
  limit = 100,
}: GenerateSqlParams): string {
  // If no tables on canvas, return empty string or placeholder
  if (!nodes || nodes.length === 0) {
    return '-- Drag or add tables to the canvas to generate SQL query';
  }

  // Create table alias mapping (a, b, c, ...)
  const aliasMap = new Map<string, string>();
  nodes.forEach((n, idx) => {
    // Generate alias: 'a', 'b', 'c', ... or 't1', 't2'
    const alias = String.fromCharCode(97 + (idx % 26)) + (idx >= 26 ? Math.floor(idx / 26) : '');
    aliasMap.set(n.tableName, alias);
  });

  // Determine projected columns in SELECT
  const selectItems: string[] = [];

  nodes.forEach((n) => {
    const alias = aliasMap.get(n.tableName) || n.tableName;
    if (n.selectedColumns.length === 0) {
      // Nothing selected from this table
      return;
    }

    const tableSchema = tables.find((t) => t.name === n.tableName);
    const allColsCount = tableSchema ? tableSchema.columns.length : 0;

    if (allColsCount > 0 && n.selectedColumns.length === allColsCount) {
      // All columns selected
      selectItems.push(`${alias}.*`);
    } else {
      n.selectedColumns.forEach((col) => {
        selectItems.push(`${alias}.${col}`);
      });
    }
  });

  // If no columns explicitly selected anywhere, default to primary table .* or all tables .*
  if (selectItems.length === 0) {
    const primaryAlias = aliasMap.get(nodes[0].tableName) || nodes[0].tableName;
    selectItems.push(`${primaryAlias}.*`);
  }

  // Primary FROM table
  const primaryTable = nodes[0].tableName;
  const primaryAlias = aliasMap.get(primaryTable) || primaryTable;

  let sql = `SELECT\n  ${selectItems.join(',\n  ')}\nFROM ${primaryTable} ${primaryAlias}`;

  // Process JOINS
  // Track joined tables
  const joinedTables = new Set<string>([primaryTable]);
  const remainingJoins = [...joins];

  // Progressively attach joins where one of the tables is already joined
  let progress = true;
  while (remainingJoins.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remainingJoins.length; i++) {
      const j = remainingJoins[i];
      const sourceJoined = joinedTables.has(j.sourceTable);
      const targetJoined = joinedTables.has(j.targetTable);

      if (sourceJoined && !targetJoined) {
        // Attach targetTable
        const srcAlias = aliasMap.get(j.sourceTable) || j.sourceTable;
        const tgtAlias = aliasMap.get(j.targetTable) || j.targetTable;
        sql += `\n${j.joinType} ${j.targetTable} ${tgtAlias}\n  ON ${srcAlias}.${j.sourceColumn} ${j.operator} ${tgtAlias}.${j.targetColumn}`;
        joinedTables.add(j.targetTable);
        remainingJoins.splice(i, 1);
        progress = true;
        break;
      } else if (!sourceJoined && targetJoined) {
        // Attach sourceTable
        const srcAlias = aliasMap.get(j.sourceTable) || j.sourceTable;
        const tgtAlias = aliasMap.get(j.targetTable) || j.targetTable;
        sql += `\n${j.joinType} ${j.sourceTable} ${srcAlias}\n  ON ${tgtAlias}.${j.targetColumn} ${j.operator} ${srcAlias}.${j.sourceColumn}`;
        joinedTables.add(j.sourceTable);
        remainingJoins.splice(i, 1);
        progress = true;
        break;
      } else if (sourceJoined && targetJoined) {
        // Both already in query; add as extra ON or WHERE condition
        remainingJoins.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  // Any remaining nodes not joined via explicit relationships can be joined with CROSS JOIN or listed
  nodes.forEach((n) => {
    if (!joinedTables.has(n.tableName)) {
      const alias = aliasMap.get(n.tableName) || n.tableName;
      sql += `\nCROSS JOIN ${n.tableName} ${alias}`;
      joinedTables.add(n.tableName);
    }
  });

  // WHERE Filters
  if (filters.length > 0) {
    const filterClauses = filters.map((f) => {
      const alias = aliasMap.get(f.tableName) || f.tableName;
      if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
        return `${alias}.${f.columnName} ${f.operator}`;
      }
      if (f.operator === 'LIKE') {
        return `${alias}.${f.columnName} LIKE '%${f.value}%'`;
      }
      // If value is numeric, output as is, otherwise quote
      const isNum = !isNaN(Number(f.value)) && f.value.trim() !== '';
      const valStr = isNum ? f.value : `'${f.value.replace(/'/g, "''")}'`;
      return `${alias}.${f.columnName} ${f.operator} ${valStr}`;
    });
    sql += `\nWHERE\n  ${filterClauses.join('\n  AND ')}`;
  }

  // ORDER BY
  if (orderBy.length > 0) {
    const orderClauses = orderBy.map((o) => {
      const alias = aliasMap.get(o.tableName) || o.tableName;
      return `${alias}.${o.columnName} ${o.direction}`;
    });
    sql += `\nORDER BY ${orderClauses.join(', ')}`;
  }

  // LIMIT
  if (limit > 0) {
    sql += `\nLIMIT ${limit};`;
  } else {
    sql += ';';
  }

  return sql;
}

/**
 * Heuristically detects potential joins between loaded tables based on column name matching.
 */
export function autoDetectJoins(tables: TableSchema[]): JoinRelationship[] {
  const joins: JoinRelationship[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const tableA = tables[i];
      const tableB = tables[j];

      tableA.columns.forEach((colA) => {
        tableB.columns.forEach((colB) => {
          const nameA = colA.name.toLowerCase();
          const nameB = colB.name.toLowerCase();

          // Condition 1: Exact column name match (e.g. custno === custno, customer_id === customer_id)
          // Condition 2: Table name prefix match (e.g. customer_id in orders === id in customers)
          // Condition 3: Common foreign key variants (e.g. custno <-> customer)
          const isExact = nameA === nameB && (nameA.includes('id') || nameA.includes('no') || nameA.includes('code') || nameA.includes('key'));
          const isFkA = nameA === `${tableB.name}_id` || nameA === `${tableB.name}_no` || (colB.name === 'id' && nameA.includes(tableB.name));
          const isFkB = nameB === `${tableA.name}_id` || nameB === `${tableA.name}_no` || (colA.name === 'id' && nameB.includes(tableA.name));
          const isCustPair = (nameA === 'custno' && (nameB === 'customer' || nameB === 'cust_no' || nameB === 'custno')) ||
                             (nameB === 'custno' && (nameA === 'customer' || nameA === 'cust_no' || nameA === 'custno'));

          if (isExact || isFkA || isFkB || isCustPair) {
            const pairKey = `${tableA.name}.${colA.name}<->${tableB.name}.${colB.name}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              joins.push({
                id: `join_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                sourceTable: tableA.name,
                sourceColumn: colA.name,
                targetTable: tableB.name,
                targetColumn: colB.name,
                joinType: 'LEFT JOIN',
                operator: '=',
              });
            }
          }
        });
      });
    }
  }

  return joins;
}
