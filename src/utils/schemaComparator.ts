import {
  TableSchema,
  SchemaDiffResult,
  SchemaDiffColumn,
  DataDiffResult,
  DataDiffRow,
  DataType,
  AggregateDiffResult,
  AggregateDiffRow,
  AggregateFunction,
} from '../types';

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
  const columnDiscrepancies: Record<string, number> = {};
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
            columnDiscrepancies[col] = (columnDiscrepancies[col] || 0) + 1;
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
            columnDiscrepancies[col] = (columnDiscrepancies[col] || 0) + 1;
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
    columnDiscrepancies,
  };
}

/**
 * Generates an ANSI / AlaSQL compatible aggregate reconciliation query
 * grouping by dimensions and comparing measure metrics with discrepancy alerts.
 */
export function generateAggregateReconciliationSql(
  tableAName: string,
  tableBName: string,
  dimensions: string[],
  measureCol: string,
  measureAgg: AggregateFunction = 'SUM',
  tolerance: number = 0
): string {
  const isAllRows = dimensions.length === 0;
  const dimLabels = isAllRows ? 'All Records (Grand Total)' : dimensions.join(', ');
  const aggExpr =
    measureAgg === 'COUNT'
      ? measureCol === '*'
        ? 'COUNT(*)'
        : `COUNT(${measureCol})`
      : `${measureAgg}(${measureCol})`;

  const colA = `${tableAName}_${measureCol === '*' ? 'rows' : measureCol.toLowerCase()}_${measureAgg.toLowerCase()}`;
  const colB = `${tableBName}_${measureCol === '*' ? 'rows' : measureCol.toLowerCase()}_${measureAgg.toLowerCase()}`;

  if (isAllRows) {
    return `/* ==================================================================== */
/* AGGREGATE SUMMARY RECONCILIATION: ${tableAName} vs ${tableBName} */
/* Scope: Overall Totals | Metric: ${aggExpr} */
/* ==================================================================== */
SELECT
  a.agg_val AS ${colA},
  b.agg_val AS ${colB},
  ROUND(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0), 4) AS variance_delta,
  CASE
    WHEN ABS(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0)) <= ${tolerance} THEN 'BALANCED'
    ELSE 'VARIANCE_ALERT'
  END AS reconciliation_status,
  a.row_count AS ${tableAName}_row_count,
  b.row_count AS ${tableBName}_row_count
FROM (
  SELECT 1 AS join_id, ${aggExpr} AS agg_val, COUNT(*) AS row_count
  FROM ${tableAName}
) a
JOIN (
  SELECT 1 AS join_id, ${aggExpr} AS agg_val, COUNT(*) AS row_count
  FROM ${tableBName}
) b
  ON a.join_id = b.join_id;`;
  }

  const dimSelect = dimensions.map((d) => `COALESCE(a.${d}, b.${d}) AS ${d}`).join(',\n  ');
  const dimSubSelectA = dimensions.map((d) => `${d}`).join(', ');
  const dimSubSelectB = dimensions.map((d) => `${d}`).join(', ');
  const joinClause = dimensions.map((d) => `a.${d} = b.${d}`).join('\n AND ');
  const groupBy = dimensions.join(', ');

  return `/* ==================================================================== */
/* AGGREGATE SUMMARY RECONCILIATION: ${tableAName} vs ${tableBName} */
/* Group By: ${dimLabels} | Metric: ${aggExpr} */
/* ==================================================================== */
SELECT
  ${dimSelect},
  a.agg_val AS ${colA},
  b.agg_val AS ${colB},
  ROUND(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0), 4) AS variance_delta,
  CASE
    WHEN a.agg_val IS NULL THEN 'ONLY_IN_${tableBName.toUpperCase()}'
    WHEN b.agg_val IS NULL THEN 'ONLY_IN_${tableAName.toUpperCase()}'
    WHEN ABS(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0)) <= ${tolerance} THEN 'BALANCED'
    ELSE 'VARIANCE_ALERT'
  END AS reconciliation_status,
  a.row_count AS ${tableAName}_row_count,
  b.row_count AS ${tableBName}_row_count
FROM (
  SELECT
    ${dimSubSelectA},
    ${aggExpr} AS agg_val,
    COUNT(*) AS row_count
  FROM ${tableAName}
  GROUP BY ${groupBy}
) a
FULL OUTER JOIN (
  SELECT
    ${dimSubSelectB},
    ${aggExpr} AS agg_val,
    COUNT(*) AS row_count
  FROM ${tableBName}
  GROUP BY ${groupBy}
) b
  ON ${joinClause}
ORDER BY
  CASE
    WHEN a.agg_val IS NULL OR b.agg_val IS NULL THEN 1
    WHEN ABS(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0)) > ${tolerance} THEN 0
    ELSE 2
  END,
  ABS(COALESCE(b.agg_val, 0) - COALESCE(a.agg_val, 0)) DESC;`;
}

interface GroupAcc {
  key: string;
  dimensionValues: Record<string, any>;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
  numericCount: number;
}

/**
 * Compares two datasets by grouping rows along one or more dimensions
 * and evaluating aggregate measures (SUM, COUNT, AVG, MIN, MAX).
 * Flags value variances, computes deltas (Δ) and percentage changes.
 */
export function compareAggregateData(
  tableA: TableSchema,
  dataA: Record<string, any>[],
  tableB: TableSchema,
  dataB: Record<string, any>[],
  dimensions: string[],
  measureCol: string,
  measureAgg: AggregateFunction = 'SUM',
  tolerance: number = 0
): AggregateDiffResult {
  const buildGroupKey = (row: Record<string, any>): { key: string; values: Record<string, any> } => {
    if (dimensions.length === 0) {
      return { key: 'All Records (Grand Total)', values: {} };
    }
    const values: Record<string, any> = {};
    const parts = dimensions.map((dim) => {
      const v = row[dim];
      const strVal = v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : '(null)';
      values[dim] = v;
      return strVal;
    });
    return { key: parts.join(' | '), values };
  };

  const aggregateDataset = (data: Record<string, any>[]): Map<string, GroupAcc> => {
    const map = new Map<string, GroupAcc>();

    data.forEach((row) => {
      const { key, values } = buildGroupKey(row);
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          dimensionValues: values,
          count: 0,
          sum: 0,
          min: null,
          max: null,
          numericCount: 0,
        };
        map.set(key, group);
      }

      group.count++;

      const rawVal = row[measureCol];
      if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
        const num = Number(rawVal);
        if (!isNaN(num)) {
          group.sum += num;
          group.numericCount++;
          group.min = group.min === null ? num : Math.min(group.min, num);
          group.max = group.max === null ? num : Math.max(group.max, num);
        }
      }
    });

    return map;
  };

  const computeFinalValue = (group?: GroupAcc): number | null => {
    if (!group) return null;
    if (measureAgg === 'COUNT') {
      return measureCol === '*' ? group.count : group.numericCount;
    }
    if (group.numericCount === 0) {
      return 0;
    }
    if (measureAgg === 'SUM') {
      return Number(group.sum.toFixed(4));
    }
    if (measureAgg === 'AVG') {
      return Number((group.sum / group.numericCount).toFixed(4));
    }
    if (measureAgg === 'MIN') {
      return group.min !== null ? Number(group.min.toFixed(4)) : null;
    }
    if (measureAgg === 'MAX') {
      return group.max !== null ? Number(group.max.toFixed(4)) : null;
    }
    return Number(group.sum.toFixed(4));
  };

  const mapA = aggregateDataset(dataA);
  const mapB = aggregateDataset(dataB);

  const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

  let balancedGroups = 0;
  let varianceAlerts = 0;
  let onlyInAGroups = 0;
  let onlyInBGroups = 0;
  let totalValA = 0;
  let totalValB = 0;

  const rows: AggregateDiffRow[] = [];

  allKeys.forEach((key) => {
    const grpA = mapA.get(key);
    const grpB = mapB.get(key);

    const valA = computeFinalValue(grpA);
    const valB = computeFinalValue(grpB);

    const countA = grpA ? grpA.count : 0;
    const countB = grpB ? grpB.count : 0;
    const dimensionValues = grpA?.dimensionValues || grpB?.dimensionValues || {};

    if (valA !== null) totalValA += valA;
    if (valB !== null) totalValB += valB;

    if (grpA && !grpB) {
      onlyInAGroups++;
      rows.push({
        dimensionKey: key,
        dimensionValues,
        valA,
        valB: null,
        delta: null,
        percentDelta: null,
        countA,
        countB: 0,
        status: 'only_a',
      });
    } else if (!grpA && grpB) {
      onlyInBGroups++;
      rows.push({
        dimensionKey: key,
        dimensionValues,
        valA: null,
        valB,
        delta: null,
        percentDelta: null,
        countA: 0,
        countB,
        status: 'only_b',
      });
    } else {
      const vA = valA ?? 0;
      const vB = valB ?? 0;
      const delta = Number((vB - vA).toFixed(4));
      const percentDelta =
        vA !== 0
          ? Number((((vB - vA) / Math.abs(vA)) * 100).toFixed(2))
          : vB === 0
          ? 0
          : 100;

      const isBalanced = Math.abs(delta) <= tolerance;

      if (isBalanced) {
        balancedGroups++;
        rows.push({
          dimensionKey: key,
          dimensionValues,
          valA,
          valB,
          delta,
          percentDelta,
          countA,
          countB,
          status: 'balanced',
        });
      } else {
        varianceAlerts++;
        rows.push({
          dimensionKey: key,
          dimensionValues,
          valA,
          valB,
          delta,
          percentDelta,
          countA,
          countB,
          status: 'variance_alert',
        });
      }
    }
  });

  // Sort rows: Alert rows first (highest absolute delta first), then only_a/only_b, then balanced
  rows.sort((a, b) => {
    const priority = (status: AggregateDiffRow['status']) => {
      switch (status) {
        case 'variance_alert': return 0;
        case 'only_a': return 1;
        case 'only_b': return 2;
        case 'balanced': return 3;
      }
    };
    const priDiff = priority(a.status) - priority(b.status);
    if (priDiff !== 0) return priDiff;

    const absDeltaA = a.delta !== null ? Math.abs(a.delta) : 0;
    const absDeltaB = b.delta !== null ? Math.abs(b.delta) : 0;
    if (absDeltaB !== absDeltaA) return absDeltaB - absDeltaA;

    return a.dimensionKey.localeCompare(b.dimensionKey);
  });

  const totalGroups = allKeys.length;
  const matchRate = totalGroups > 0 ? Math.round((balancedGroups / totalGroups) * 100) : 100;
  totalValA = Number(totalValA.toFixed(4));
  totalValB = Number(totalValB.toFixed(4));
  const totalDelta = Number((totalValB - totalValA).toFixed(4));
  const percentTotalDelta =
    totalValA !== 0
      ? Number((((totalValB - totalValA) / Math.abs(totalValA)) * 100).toFixed(2))
      : totalValB === 0
      ? 0
      : null;

  const reconciliationSql = generateAggregateReconciliationSql(
    tableA.name,
    tableB.name,
    dimensions,
    measureCol,
    measureAgg,
    tolerance
  );

  return {
    tableAName: tableA.name,
    tableBName: tableB.name,
    dimensions,
    measureCol,
    measureAgg,
    tolerance,
    rows,
    totalGroups,
    balancedGroups,
    varianceAlerts,
    onlyInAGroups,
    onlyInBGroups,
    matchRate,
    totalValA,
    totalValB,
    totalDelta,
    percentTotalDelta,
    reconciliationSql,
  };
}

