import { TableSchema, SchemaDiffResult, SchemaDiffColumn, DataDiffResult, DataDiffRow, DataType } from '../types';

/**
 * Compares the schema definitions of two tables or sheets.
 */
export function compareSchemas(tableA: TableSchema, tableB: TableSchema): SchemaDiffResult {
  const mapA = new Map(tableA.columns.map((c) => [c.name.toLowerCase(), c]));
  const mapB = new Map(tableB.columns.map((c) => [c.name.toLowerCase(), c]));

  const allColNames = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const columns: SchemaDiffColumn[] = [];
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const typeMismatches: { column: string; typeA: DataType; typeB: DataType }[] = [];

  let matchScore = 0;

  allColNames.forEach((colKey) => {
    const colA = mapA.get(colKey);
    const colB = mapB.get(colKey);

    const inA = !!colA;
    const inB = !!colB;
    const name = colA?.name || colB?.name || colKey;

    if (inA && inB) {
      const typeMatches = colA!.type === colB!.type;
      if (!typeMatches) {
        typeMismatches.push({
          column: name,
          typeA: colA!.type,
          typeB: colB!.type,
        });
        matchScore += 0.5; // partial credit for name match with type mismatch
      } else {
        matchScore += 1;
      }
    } else if (inA && !inB) {
      onlyInA.push(name);
    } else if (!inA && inB) {
      onlyInB.push(name);
    }

    columns.push({
      name,
      inTableA: inA,
      inTableB: inB,
      typeA: colA?.type,
      typeB: colB?.type,
      nullCountA: colA?.nullCount,
      nullCountB: colB?.nullCount,
      distinctA: colA?.distinctCount,
      distinctB: colB?.distinctCount,
    });
  });

  const maxPossible = allColNames.length || 1;
  const matchRate = Math.round((matchScore / maxPossible) * 100);

  return {
    tableAName: tableA.name,
    tableBName: tableB.name,
    matchRate,
    columns,
    onlyInA,
    onlyInB,
    typeMismatches,
  };
}

/**
 * Automatically chooses the best candidate key column to join/compare data rows.
 */
export function autoDetectKeyColumn(tableA: TableSchema, tableB: TableSchema): string {
  const commonCols = tableA.columns.filter((cA) =>
    tableB.columns.some((cB) => cB.name.toLowerCase() === cA.name.toLowerCase())
  );

  if (commonCols.length === 0) {
    return tableA.columns[0]?.name || '';
  }

  // Priority 1: High distinct count column with 'id', 'no', 'code', 'key'
  const keyCandidate = commonCols.find((c) => {
    const lower = c.name.toLowerCase();
    return (
      (lower.includes('id') || lower.includes('no') || lower.includes('code') || lower.includes('key')) &&
      c.distinctCount > 0
    );
  });
  if (keyCandidate) return keyCandidate.name;

  // Priority 2: Highest distinct count common column
  const sorted = [...commonCols].sort((a, b) => b.distinctCount - a.distinctCount);
  return sorted[0].name;
}

/**
 * Compares data records row-by-row and cell-by-cell between two tables.
 */
/**
 * Compares data records row-by-row and cell-by-cell between two tables.
 * Supports single or multi-column (composite) identity keys (e.g. ['customer', 'order_date']).
 */
export function compareData(
  tableA: TableSchema,
  dataA: Record<string, any>[],
  tableB: TableSchema,
  dataB: Record<string, any>[],
  keyColumn?: string | string[]
): DataDiffResult {
  // Normalize key columns to an array of valid strings
  let keys: string[] = [];
  if (Array.isArray(keyColumn)) {
    keys = keyColumn.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof keyColumn === 'string' && keyColumn.trim()) {
    // Support comma or plus separated e.g. "customer, order_date" or "customer + order_date"
    keys = keyColumn
      .split(/[,+]/)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  if (keys.length === 0) {
    const auto = autoDetectKeyColumn(tableA, tableB);
    if (auto) keys = [auto];
  }

  // Common columns
  const commonCols = tableA.columns
    .map((c) => c.name)
    .filter((colName) =>
      tableB.columns.some((cB) => cB.name.toLowerCase() === colName.toLowerCase())
    );

  const diffRows: DataDiffRow[] = [];
  let identicalCount = 0;
  let modifiedCount = 0;
  let onlyInACount = 0;
  let onlyInBCount = 0;

  if (keys.length === 0) {
    // If no key exists, compare by row index
    const maxRows = Math.max(dataA.length, dataB.length);
    for (let i = 0; i < maxRows; i++) {
      const rowA = dataA[i];
      const rowB = dataB[i];

      if (rowA && !rowB) {
        onlyInACount++;
        diffRows.push({
          key: `Row #${i + 1}`,
          status: 'only_a',
          valuesA: rowA,
        });
      } else if (!rowA && rowB) {
        onlyInBCount++;
        diffRows.push({
          key: `Row #${i + 1}`,
          status: 'only_b',
          valuesB: rowB,
        });
      } else {
        const changedCols: string[] = [];
        commonCols.forEach((col) => {
          const valA = rowA[col];
          const valB = rowB[col];
          if (String(valA ?? '') !== String(valB ?? '')) {
            changedCols.push(col);
          }
        });

        if (changedCols.length === 0) {
          identicalCount++;
          diffRows.push({
            key: `Row #${i + 1}`,
            status: 'identical',
            valuesA: rowA,
            valuesB: rowB,
          });
        } else {
          modifiedCount++;
          diffRows.push({
            key: `Row #${i + 1}`,
            status: 'modified',
            valuesA: rowA,
            valuesB: rowB,
            changedColumns: changedCols,
          });
        }
      }
    }
  } else {
    // Build helper to generate composite row key
    const buildRowKey = (row: Record<string, any>, idx: number): string => {
      const parts = keys.map((k) => {
        const val = row[k];
        return val !== null && val !== undefined ? String(val).trim() : '';
      });
      if (parts.every((p) => p === '')) {
        return `_row_${idx}`;
      }
      return parts.join(' | ');
    };

    // Compare indexed by composite key
    const mapA = new Map<string, Record<string, any>>();
    dataA.forEach((row, idx) => {
      const k = buildRowKey(row, idx);
      mapA.set(k, row);
    });

    const mapB = new Map<string, Record<string, any>>();
    dataB.forEach((row, idx) => {
      const k = buildRowKey(row, idx);
      mapB.set(k, row);
    });

    const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

    allKeys.forEach((k) => {
      const rowA = mapA.get(k);
      const rowB = mapB.get(k);

      if (rowA && !rowB) {
        onlyInACount++;
        diffRows.push({
          key: k,
          status: 'only_a',
          valuesA: rowA,
        });
      } else if (!rowA && rowB) {
        onlyInBCount++;
        diffRows.push({
          key: k,
          status: 'only_b',
          valuesB: rowB,
        });
      } else if (rowA && rowB) {
        const changedCols: string[] = [];
        commonCols.forEach((col) => {
          const valA = rowA[col];
          const valB = rowB[col];
          const strA = valA !== null && valA !== undefined ? String(valA).trim() : '';
          const strB = valB !== null && valB !== undefined ? String(valB).trim() : '';

          if (strA !== strB) {
            changedCols.push(col);
          }
        });

        if (changedCols.length === 0) {
          identicalCount++;
          diffRows.push({
            key: k,
            status: 'identical',
            valuesA: rowA,
            valuesB: rowB,
          });
        } else {
          modifiedCount++;
          diffRows.push({
            key: k,
            status: 'modified',
            valuesA: rowA,
            valuesB: rowB,
            changedColumns: changedCols,
          });
        }
      }
    });
  }

  const totalCompared = dataA.length + dataB.length || 1;
  const matchPercentage = Math.round(
    ((identicalCount * 2) / totalCompared) * 100
  );

  // Generate reconciliation SQL
  const keyLabel = keys.join(' + ');
  const nonKeyCols = commonCols.filter((c) => !keys.includes(c));
  const commonJoinCols = nonKeyCols.map((c) => `a.${c} AS a_${c}, b.${c} AS b_${c}`).join(', ');

  const diffKeySelect = keys.length > 0
    ? keys.map((k) => `COALESCE(a.${k}, b.${k}) AS diff_${k}`).join(',\n  ')
    : 'COALESCE(a.id, b.id) AS diff_key';

  const onClause = keys.length > 0
    ? keys.map((k) => `a.${k} = b.${k}`).join('\n AND ')
    : 'a.id = b.id';

  const caseAddedCondition = keys.length > 0
    ? keys.map((k) => `a.${k} IS NULL`).join(' OR ')
    : 'a.id IS NULL';

  const caseRemovedCondition = keys.length > 0
    ? keys.map((k) => `b.${k} IS NULL`).join(' OR ')
    : 'b.id IS NULL';

  const whereNullClause = keys.length > 0
    ? keys.map((k) => `a.${k} IS NULL\n    OR b.${k} IS NULL`).join('\n    OR ')
    : 'a.id IS NULL OR b.id IS NULL';

  const whereMismatchClause =
    nonKeyCols.slice(0, 3).map((c) => `a.${c} <> b.${c}`).join(' OR ') || 'FALSE';

  const reconciliationSql = `/* Reconciliation Query: ${tableA.name} vs ${tableB.name} */
/* Join Identity: ${keyLabel || 'Row Index'} */
SELECT
  ${diffKeySelect},
  CASE
    WHEN ${caseAddedCondition} THEN 'ADDED_IN_${tableB.name.toUpperCase()}'
    WHEN ${caseRemovedCondition} THEN 'REMOVED_IN_${tableB.name.toUpperCase()}'
    ELSE 'MODIFIED'
  END AS diff_status${commonJoinCols ? ',\n  ' + commonJoinCols : ''}
FROM ${tableA.name} a
FULL OUTER JOIN ${tableB.name} b
  ON ${onClause}
WHERE ${whereNullClause}
   OR ${whereMismatchClause}
LIMIT 100;`;

  return {
    tableAName: tableA.name,
    tableBName: tableB.name,
    keyColumn: keyLabel,
    keyColumns: keys,
    totalRowsA: dataA.length,
    totalRowsB: dataB.length,
    identicalCount,
    modifiedCount,
    onlyInACount,
    onlyInBCount,
    matchPercentage,
    diffRows,
    reconciliationSql,
  };
}
