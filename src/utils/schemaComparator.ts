import alasql from 'alasql';
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
  ColumnMapping,
  KeyPair,
} from '../types';

/**
 * Auto-detects exact case-insensitive column matches between Table A and Table B.
 */
export function autoDetectColumnMappings(tableA: TableSchema, tableB: TableSchema): ColumnMapping[] {
  const mapB = new Map(tableB.columns.map((c) => [c.name.toLowerCase(), c.name]));
  const mappings: ColumnMapping[] = [];

  tableA.columns.forEach((cA) => {
    const matchedB = mapB.get(cA.name.toLowerCase());
    if (matchedB) {
      mappings.push({
        colA: cA.name,
        colB: matchedB,
        isAutoMatched: true,
      });
    }
  });

  return mappings;
}

/**
 * Suggests fuzzy or abbreviation-based pairings for unmapped columns
 * (e.g. 'actual' ↔ 'act', 'material_desc' ↔ 'material_description', 'qty' ↔ 'quantity').
 */
export function suggestFuzzyColumnMappings(
  tableA: TableSchema,
  tableB: TableSchema,
  existingMappings: ColumnMapping[] = []
): ColumnMapping[] {
  const mappedColsA = new Set(existingMappings.map((m) => m.colA.toLowerCase()));
  const mappedColsB = new Set(existingMappings.map((m) => m.colB.toLowerCase()));

  const unmappedA = tableA.columns.filter((c) => !mappedColsA.has(c.name.toLowerCase()));
  const unmappedB = tableB.columns.filter((c) => !mappedColsB.has(c.name.toLowerCase()));

  const normalize = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[\s_\-.]+/g, '')
      .replace(/description/g, 'desc')
      .replace(/actual/g, 'act')
      .replace(/quantity/g, 'qty')
      .replace(/amount/g, 'amt')
      .replace(/number/g, 'num')
      .replace(/customer/g, 'cust')
      .replace(/date/g, 'dt')
      .replace(/identifier/g, 'id');
  };

  const suggestions: ColumnMapping[] = [];
  const usedB = new Set<string>();

  unmappedA.forEach((colA) => {
    const normA = normalize(colA.name);
    for (const colB of unmappedB) {
      if (usedB.has(colB.name.toLowerCase())) continue;
      const normB = normalize(colB.name);

      const isMatch =
        normA === normB ||
        (normA.length > 2 && normB.length > 2 && (normA.startsWith(normB) || normB.startsWith(normA))) ||
        (normA.length > 3 && normB.length > 3 && (normA.includes(normB) || normB.includes(normA)));

      if (isMatch) {
        suggestions.push({
          colA: colA.name,
          colB: colB.name,
          isAutoMatched: false,
        });
        usedB.add(colB.name.toLowerCase());
        break;
      }
    }
  });

  return suggestions;
}

/**
 * Compares the schema definitions of two tables or sheets, optionally taking into account
 * manual column pairings (e.g. actual ↔ act, material_desc ↔ material_description).
 */
export function compareSchemas(
  tableA: TableSchema,
  tableB: TableSchema,
  columnMappings?: ColumnMapping[]
): SchemaDiffResult {
  const mapA = new Map(tableA.columns.map((c) => [c.name.toLowerCase(), c]));
  const mapB = new Map(tableB.columns.map((c) => [c.name.toLowerCase(), c]));

  const mappings =
    columnMappings && columnMappings.length > 0
      ? columnMappings
      : autoDetectColumnMappings(tableA, tableB);

  const columns: SchemaDiffColumn[] = [];
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const typeMismatches: { column: string; typeA: DataType; typeB: DataType }[] = [];

  let matchScore = 0;
  const processedA = new Set<string>();
  const processedB = new Set<string>();

  // Process mapped pairs first
  mappings.forEach((m) => {
    const colA = mapA.get(m.colA.toLowerCase());
    const colB = mapB.get(m.colB.toLowerCase());
    if (colA && colB) {
      processedA.add(colA.name.toLowerCase());
      processedB.add(colB.name.toLowerCase());
      const pairLabel = colA.name === colB.name ? colA.name : `${colA.name} ↔ ${colB.name}`;

      const typeMatches = colA.type === colB.type;
      if (!typeMatches) {
        typeMismatches.push({
          column: pairLabel,
          typeA: colA.type,
          typeB: colB.type,
        });
        matchScore += 0.5;
      } else {
        matchScore += 1;
      }

      columns.push({
        name: pairLabel,
        inTableA: true,
        inTableB: true,
        typeA: colA.type,
        typeB: colB.type,
        nullCountA: colA.nullCount,
        nullCountB: colB.nullCount,
        distinctA: colA.distinctCount,
        distinctB: colB.distinctCount,
      });
    }
  });

  // Remaining unmapped columns in Table A
  tableA.columns.forEach((colA) => {
    if (!processedA.has(colA.name.toLowerCase())) {
      onlyInA.push(colA.name);
      columns.push({
        name: colA.name,
        inTableA: true,
        inTableB: false,
        typeA: colA.type,
        nullCountA: colA.nullCount,
        distinctA: colA.distinctCount,
      });
    }
  });

  // Remaining unmapped columns in Table B
  tableB.columns.forEach((colB) => {
    if (!processedB.has(colB.name.toLowerCase())) {
      onlyInB.push(colB.name);
      columns.push({
        name: colB.name,
        inTableA: false,
        inTableB: true,
        typeB: colB.type,
        nullCountB: colB.nullCount,
        distinctB: colB.distinctCount,
      });
    }
  });

  const totalSlots = mappings.length + onlyInA.length + onlyInB.length || 1;
  const matchRate = Math.round((matchScore / totalSlots) * 100);

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
export function autoDetectKeyColumn(
  tableA: TableSchema,
  tableB: TableSchema,
  columnMappings?: ColumnMapping[]
): string {
  const mappings =
    columnMappings && columnMappings.length > 0
      ? columnMappings
      : autoDetectColumnMappings(tableA, tableB);

  const mappedNamesA = mappings.map((m) => m.colA);

  if (mappedNamesA.length === 0) {
    return tableA.columns[0]?.name || '';
  }

  // Priority 1: Column with 'id', 'no', 'code', 'key'
  const keyCandidate = mappedNamesA.find((name) => {
    const lower = name.toLowerCase();
    return lower.includes('id') || lower.includes('no') || lower.includes('code') || lower.includes('key');
  });
  if (keyCandidate) return keyCandidate;

  // Priority 2: Return first mapped column
  return mappedNamesA[0];
}

/**
 * Compares data records row-by-row and cell-by-cell between two tables.
 * Supports manual column pairings (e.g. 'actual' ↔ 'act', 'material_desc' ↔ 'material_description')
 * and single or multi-column (composite) identity keys.
 */
export function compareData(
  tableA: TableSchema,
  dataA: Record<string, any>[],
  tableB: TableSchema,
  dataB: Record<string, any>[],
  keyColumn?: string | string[] | KeyPair[],
  columnMappings?: ColumnMapping[]
): DataDiffResult {
  const effectiveMappings: ColumnMapping[] =
    columnMappings && columnMappings.length > 0
      ? columnMappings
      : autoDetectColumnMappings(tableA, tableB);

  // Normalize key columns to key pairs
  let keyPairs: KeyPair[] = [];
  if (Array.isArray(keyColumn)) {
    keyColumn.forEach((item) => {
      if (typeof item === 'object' && item !== null && 'colA' in item && 'colB' in item) {
        keyPairs.push(item as KeyPair);
      } else if (typeof item === 'string') {
        const k = item.trim();
        if (k) {
          const mapped = effectiveMappings.find(
            (m) => m.colA.toLowerCase() === k.toLowerCase() || m.colB.toLowerCase() === k.toLowerCase()
          );
          if (mapped) {
            keyPairs.push({ colA: mapped.colA, colB: mapped.colB });
          } else {
            keyPairs.push({ colA: k, colB: k });
          }
        }
      }
    });
  } else if (typeof keyColumn === 'string' && keyColumn.trim()) {
    const rawKeys = keyColumn
      .split(/[,+]/)
      .map((k) => k.trim())
      .filter(Boolean);
    rawKeys.forEach((k) => {
      const mapped = effectiveMappings.find(
        (m) => m.colA.toLowerCase() === k.toLowerCase() || m.colB.toLowerCase() === k.toLowerCase()
      );
      if (mapped) {
        keyPairs.push({ colA: mapped.colA, colB: mapped.colB });
      } else {
        keyPairs.push({ colA: k, colB: k });
      }
    });
  }

  if (keyPairs.length === 0) {
    const auto = autoDetectKeyColumn(tableA, tableB, effectiveMappings);
    if (auto) {
      const mapped = effectiveMappings.find((m) => m.colA.toLowerCase() === auto.toLowerCase());
      if (mapped) {
        keyPairs.push({ colA: mapped.colA, colB: mapped.colB });
      } else {
        keyPairs.push({ colA: auto, colB: auto });
      }
    }
  }

  const diffRows: DataDiffRow[] = [];
  const columnDiscrepancies: Record<string, number> = {};
  let identicalCount = 0;
  let modifiedCount = 0;
  let onlyInACount = 0;
  let onlyInBCount = 0;

  if (keyPairs.length === 0) {
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
        effectiveMappings.forEach((pair) => {
          const valA = rowA[pair.colA];
          const valB = rowB[pair.colB];
          const pairKey = pair.colA === pair.colB ? pair.colA : `${pair.colA} ↔ ${pair.colB}`;
          if (String(valA ?? '') !== String(valB ?? '')) {
            changedCols.push(pairKey);
            columnDiscrepancies[pairKey] = (columnDiscrepancies[pairKey] || 0) + 1;
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
    const buildRowKeyA = (row: Record<string, any>, idx: number): string => {
      const parts = keyPairs.map((kp) => {
        const val = row[kp.colA];
        return val !== null && val !== undefined ? String(val).trim() : '';
      });
      if (parts.every((p) => p === '')) return `_row_${idx}`;
      return parts.join(' | ');
    };

    const buildRowKeyB = (row: Record<string, any>, idx: number): string => {
      const parts = keyPairs.map((kp) => {
        const val = row[kp.colB];
        return val !== null && val !== undefined ? String(val).trim() : '';
      });
      if (parts.every((p) => p === '')) return `_row_${idx}`;
      return parts.join(' | ');
    };

    // Compare indexed by composite key
    const mapA = new Map<string, Record<string, any>>();
    dataA.forEach((row, idx) => {
      const k = buildRowKeyA(row, idx);
      mapA.set(k, row);
    });

    const mapB = new Map<string, Record<string, any>>();
    dataB.forEach((row, idx) => {
      const k = buildRowKeyB(row, idx);
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
        effectiveMappings.forEach((pair) => {
          const valA = rowA[pair.colA];
          const valB = rowB[pair.colB];
          const strA = valA !== null && valA !== undefined ? String(valA).trim() : '';
          const strB = valB !== null && valB !== undefined ? String(valB).trim() : '';
          const pairKey = pair.colA === pair.colB ? pair.colA : `${pair.colA} ↔ ${pair.colB}`;

          if (strA !== strB) {
            changedCols.push(pairKey);
            columnDiscrepancies[pairKey] = (columnDiscrepancies[pairKey] || 0) + 1;
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

  // Generate reconciliation SQL using mapped pairs
  const keyLabel = keyPairs
    .map((kp) => (kp.colA === kp.colB ? kp.colA : `${kp.colA} ↔ ${kp.colB}`))
    .join(' + ');

  const nonKeyMappings = effectiveMappings.filter(
    (m) => !keyPairs.some((kp) => kp.colA === m.colA && kp.colB === m.colB)
  );

  const commonJoinCols = nonKeyMappings
    .map((m) => `a.${m.colA} AS a_${m.colA}, b.${m.colB} AS b_${m.colB}`)
    .join(', ');

  const diffKeySelect =
    keyPairs.length > 0
      ? keyPairs
          .map((kp) => `COALESCE(a.${kp.colA}, b.${kp.colB}) AS diff_${kp.colA}`)
          .join(',\n  ')
      : 'COALESCE(a.id, b.id) AS diff_key';

  const onClause =
    keyPairs.length > 0
      ? keyPairs.map((kp) => `a.${kp.colA} = b.${kp.colB}`).join('\n AND ')
      : 'a.id = b.id';

  const caseAddedCondition =
    keyPairs.length > 0
      ? keyPairs.map((kp) => `a.${kp.colA} IS NULL`).join(' OR ')
      : 'a.id IS NULL';

  const caseRemovedCondition =
    keyPairs.length > 0
      ? keyPairs.map((kp) => `b.${kp.colB} IS NULL`).join(' OR ')
      : 'b.id IS NULL';

  const whereNullClause =
    keyPairs.length > 0
      ? keyPairs.map((kp) => `a.${kp.colA} IS NULL\n    OR b.${kp.colB} IS NULL`).join('\n    OR ')
      : 'a.id IS NULL OR b.id IS NULL';

  const whereMismatchClause =
    nonKeyMappings.slice(0, 3).map((m) => `a.${m.colA} <> b.${m.colB}`).join(' OR ') || 'FALSE';

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
    keyColumns: keyPairs.map((kp) => kp.colA),
    keyPairs,
    columnMappings: effectiveMappings,
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Automatically translates column names in a WHERE clause for Table B
 * using mapped column synonyms (e.g. 'actual > 100' -> 'act > 100').
 */
export function translateWhereClauseForTarget(
  whereClause: string,
  columnMappings: ColumnMapping[] = []
): string {
  if (!whereClause || !whereClause.trim()) return '';
  let result = whereClause;

  columnMappings.forEach((m) => {
    if (m.colA.toLowerCase() !== m.colB.toLowerCase()) {
      // Replace bracketed [colA] with [colB]
      const bracketRegex = new RegExp(`\\[${escapeRegex(m.colA)}\\]`, 'gi');
      result = result.replace(bracketRegex, `[${m.colB}]`);

      // Replace word boundary colA with colB
      const wordRegex = new RegExp(`\\b${escapeRegex(m.colA)}\\b`, 'gi');
      result = result.replace(wordRegex, m.colB);
    }
  });

  return result;
}

export interface FilterDatasetResult {
  data: Record<string, any>[];
  error?: string;
}

/**
 * Filters an in-memory row dataset using an SQL WHERE expression evaluated by AlaSQL.
 */
export function filterDatasetWithWhere(
  data: Record<string, any>[],
  whereCondition?: string
): FilterDatasetResult {
  if (!whereCondition || !whereCondition.trim()) {
    return { data };
  }

  const cleanWhere = whereCondition.replace(/^\s*WHERE\s+/i, '').trim();
  if (!cleanWhere) {
    return { data };
  }

  try {
    const res = alasql(`SELECT * FROM ? WHERE ${cleanWhere}`, [data]);
    return { data: Array.isArray(res) ? res : data };
  } catch (err: any) {
    return {
      data,
      error: err?.message || 'Invalid WHERE condition syntax',
    };
  }
}

/**
 * Generates an ANSI / AlaSQL compatible aggregate reconciliation query
 * grouping by dimensions and comparing measure metrics with discrepancy alerts.
 * Supports manual dimension and measure column pairings and optional WHERE filter clauses.
 */
export function generateAggregateReconciliationSql(
  tableAName: string,
  tableBName: string,
  dimensions: (string | KeyPair)[],
  measureCol: string | KeyPair,
  measureAgg: AggregateFunction = 'SUM',
  tolerance: number = 0,
  columnMappings?: ColumnMapping[],
  whereClauseA?: string,
  whereClauseB?: string
): string {
  const effectiveMappings = columnMappings || [];

  // Normalize dimension pairs
  const dimPairs: KeyPair[] = [];
  dimensions.forEach((item) => {
    if (typeof item === 'object' && item !== null && 'colA' in item && 'colB' in item) {
      dimPairs.push(item as KeyPair);
    } else if (typeof item === 'string' && item.trim()) {
      const d = item.trim();
      const mapped = effectiveMappings.find((m) => m.colA.toLowerCase() === d.toLowerCase());
      if (mapped) {
        dimPairs.push({ colA: mapped.colA, colB: mapped.colB });
      } else {
        dimPairs.push({ colA: d, colB: d });
      }
    }
  });

  // Normalize measure pair
  let mPair: KeyPair;
  if (typeof measureCol === 'object' && measureCol !== null && 'colA' in measureCol && 'colB' in measureCol) {
    mPair = measureCol as KeyPair;
  } else if (typeof measureCol === 'string' && measureCol === '*') {
    mPair = { colA: '*', colB: '*' };
  } else if (typeof measureCol === 'string') {
    const mapped = effectiveMappings.find((m) => m.colA.toLowerCase() === measureCol.toLowerCase());
    if (mapped) {
      mPair = { colA: mapped.colA, colB: mapped.colB };
    } else {
      mPair = { colA: measureCol, colB: measureCol };
    }
  } else {
    mPair = { colA: '*', colB: '*' };
  }

  const cleanWhereA = whereClauseA ? whereClauseA.replace(/^\s*WHERE\s+/i, '').trim() : '';
  const cleanWhereB = whereClauseB ? whereClauseB.replace(/^\s*WHERE\s+/i, '').trim() : '';
  const whereSqlA = cleanWhereA ? `\n  WHERE ${cleanWhereA}` : '';
  const whereSqlB = cleanWhereB ? `\n  WHERE ${cleanWhereB}` : '';

  const filterComments = [
    cleanWhereA ? `/* Filter (${tableAName}): WHERE ${cleanWhereA} */` : '',
    cleanWhereB ? `/* Filter (${tableBName}): WHERE ${cleanWhereB} */` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const isAllRows = dimPairs.length === 0;
  const dimLabels = isAllRows
    ? 'All Records (Grand Total)'
    : dimPairs.map((dp) => (dp.colA === dp.colB ? dp.colA : `${dp.colA} ↔ ${dp.colB}`)).join(', ');

  const aggExprA =
    measureAgg === 'COUNT'
      ? mPair.colA === '*'
        ? 'COUNT(*)'
        : `COUNT(${mPair.colA})`
      : `${measureAgg}(${mPair.colA})`;

  const aggExprB =
    measureAgg === 'COUNT'
      ? mPair.colB === '*'
        ? 'COUNT(*)'
        : `COUNT(${mPair.colB})`
      : `${measureAgg}(${mPair.colB})`;

  const colA = `${tableAName}_${mPair.colA === '*' ? 'rows' : mPair.colA.toLowerCase()}_${measureAgg.toLowerCase()}`;
  const colB = `${tableBName}_${mPair.colB === '*' ? 'rows' : mPair.colB.toLowerCase()}_${measureAgg.toLowerCase()}`;

  if (isAllRows) {
    return `/* ==================================================================== */
/* AGGREGATE SUMMARY RECONCILIATION: ${tableAName} vs ${tableBName} */
/* Scope: Overall Totals | Metric: ${aggExprA} vs ${aggExprB} */
${filterComments ? `${filterComments}\n` : ''}/* ==================================================================== */
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
  SELECT 1 AS join_id, ${aggExprA} AS agg_val, COUNT(*) AS row_count
  FROM ${tableAName}${whereSqlA}
) a
JOIN (
  SELECT 1 AS join_id, ${aggExprB} AS agg_val, COUNT(*) AS row_count
  FROM ${tableBName}${whereSqlB}
) b
  ON a.join_id = b.join_id;`;
  }

  const dimSelect = dimPairs
    .map((dp) => `COALESCE(a.${dp.colA}, b.${dp.colB}) AS ${dp.colA === dp.colB ? dp.colA : `${dp.colA}_${dp.colB}`}`)
    .join(',\n  ');
  const dimSubSelectA = dimPairs.map((dp) => dp.colA).join(', ');
  const dimSubSelectB = dimPairs.map((dp) => dp.colB).join(', ');
  const joinClause = dimPairs.map((dp) => `a.${dp.colA} = b.${dp.colB}`).join('\n AND ');
  const groupByA = dimPairs.map((dp) => dp.colA).join(', ');
  const groupByB = dimPairs.map((dp) => dp.colB).join(', ');

  return `/* ==================================================================== */
/* AGGREGATE SUMMARY RECONCILIATION: ${tableAName} vs ${tableBName} */
/* Group By: ${dimLabels} | Metric: ${aggExprA} vs ${aggExprB} */
${filterComments ? `${filterComments}\n` : ''}/* ==================================================================== */
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
    ${aggExprA} AS agg_val,
    COUNT(*) AS row_count
  FROM ${tableAName}${whereSqlA}
  GROUP BY ${groupByA}
) a
FULL OUTER JOIN (
  SELECT
    ${dimSubSelectB},
    ${aggExprB} AS agg_val,
    COUNT(*) AS row_count
  FROM ${tableBName}${whereSqlB}
  GROUP BY ${groupByB}
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
 * Supports manual dimension pairings (e.g. material_desc ↔ material_description)
 * and measure pairings (e.g. actual ↔ act).
 */
export function compareAggregateData(
  tableA: TableSchema,
  dataA: Record<string, any>[],
  tableB: TableSchema,
  dataB: Record<string, any>[],
  dimensions: (string | KeyPair)[],
  measureCol: string | KeyPair,
  measureAgg: AggregateFunction = 'SUM',
  tolerance: number = 0,
  columnMappings?: ColumnMapping[],
  whereCondition?: string | { whereA?: string; whereB?: string }
): AggregateDiffResult {
  const effectiveMappings = columnMappings || [];

  let whereA = '';
  let whereB = '';
  if (typeof whereCondition === 'string') {
    whereA = whereCondition.trim();
    whereB = translateWhereClauseForTarget(whereA, effectiveMappings);
  } else if (typeof whereCondition === 'object' && whereCondition !== null) {
    whereA = (whereCondition.whereA || '').trim();
    whereB = (whereCondition.whereB || '').trim();
    if (!whereB && whereA) {
      whereB = translateWhereClauseForTarget(whereA, effectiveMappings);
    }
  }

  // Filter datasets with WHERE condition if specified
  const filterResA = filterDatasetWithWhere(dataA, whereA);
  const filterResB = filterDatasetWithWhere(dataB, whereB);
  const activeDataA = filterResA.data;
  const activeDataB = filterResB.data;

  // Normalize dimension pairs
  const dimPairs: KeyPair[] = [];
  dimensions.forEach((item) => {
    if (typeof item === 'object' && item !== null && 'colA' in item && 'colB' in item) {
      dimPairs.push(item as KeyPair);
    } else if (typeof item === 'string' && item.trim()) {
      const d = item.trim();
      const mapped = effectiveMappings.find((m) => m.colA.toLowerCase() === d.toLowerCase());
      if (mapped) {
        dimPairs.push({ colA: mapped.colA, colB: mapped.colB });
      } else {
        dimPairs.push({ colA: d, colB: d });
      }
    }
  });

  // Normalize measure pair
  let mPair: KeyPair;
  if (typeof measureCol === 'object' && measureCol !== null && 'colA' in measureCol && 'colB' in measureCol) {
    mPair = measureCol as KeyPair;
  } else if (typeof measureCol === 'string' && measureCol === '*') {
    mPair = { colA: '*', colB: '*' };
  } else if (typeof measureCol === 'string') {
    const mapped = effectiveMappings.find((m) => m.colA.toLowerCase() === measureCol.toLowerCase());
    if (mapped) {
      mPair = { colA: mapped.colA, colB: mapped.colB };
    } else {
      mPair = { colA: measureCol, colB: measureCol };
    }
  } else {
    mPair = { colA: '*', colB: '*' };
  }

  const buildGroupKeyA = (row: Record<string, any>): { key: string; values: Record<string, any> } => {
    if (dimPairs.length === 0) {
      return { key: 'All Records (Grand Total)', values: {} };
    }
    const values: Record<string, any> = {};
    const parts = dimPairs.map((dp) => {
      const v = row[dp.colA];
      const strVal = v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : '(null)';
      const label = dp.colA === dp.colB ? dp.colA : `${dp.colA} ↔ ${dp.colB}`;
      values[label] = v;
      return strVal;
    });
    return { key: parts.join(' | '), values };
  };

  const buildGroupKeyB = (row: Record<string, any>): { key: string; values: Record<string, any> } => {
    if (dimPairs.length === 0) {
      return { key: 'All Records (Grand Total)', values: {} };
    }
    const values: Record<string, any> = {};
    const parts = dimPairs.map((dp) => {
      const v = row[dp.colB];
      const strVal = v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : '(null)';
      const label = dp.colA === dp.colB ? dp.colA : `${dp.colA} ↔ ${dp.colB}`;
      values[label] = v;
      return strVal;
    });
    return { key: parts.join(' | '), values };
  };

  const aggregateDataset = (
    data: Record<string, any>[],
    keyBuilder: (row: Record<string, any>) => { key: string; values: Record<string, any> },
    measureField: string
  ): Map<string, GroupAcc> => {
    const map = new Map<string, GroupAcc>();

    data.forEach((row) => {
      const { key, values } = keyBuilder(row);
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

      if (measureField !== '*') {
        const rawVal = row[measureField];
        if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
          const num = Number(rawVal);
          if (!isNaN(num)) {
            group.sum += num;
            group.numericCount++;
            group.min = group.min === null ? num : Math.min(group.min, num);
            group.max = group.max === null ? num : Math.max(group.max, num);
          }
        }
      }
    });

    return map;
  };

  const computeFinalValue = (group: GroupAcc | undefined, isStar: boolean): number | null => {
    if (!group) return null;
    if (measureAgg === 'COUNT') {
      return isStar ? group.count : group.numericCount;
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

  const mapA = aggregateDataset(activeDataA, buildGroupKeyA, mPair.colA);
  const mapB = aggregateDataset(activeDataB, buildGroupKeyB, mPair.colB);

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

    const valA = computeFinalValue(grpA, mPair.colA === '*');
    const valB = computeFinalValue(grpB, mPair.colB === '*');

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
    dimPairs,
    mPair,
    measureAgg,
    tolerance,
    effectiveMappings,
    whereA,
    whereB
  );

  const dimNames = dimPairs.map((dp) => (dp.colA === dp.colB ? dp.colA : `${dp.colA} ↔ ${dp.colB}`));
  const measureLabel = mPair.colA === mPair.colB ? mPair.colA : `${mPair.colA} ↔ ${mPair.colB}`;

  return {
    tableAName: tableA.name,
    tableBName: tableB.name,
    dimensions: dimNames,
    dimensionPairs: dimPairs,
    measureCol: measureLabel,
    measureColA: mPair.colA,
    measureColB: mPair.colB,
    measurePair: mPair,
    measureAgg,
    tolerance,
    whereClauseA: whereA || undefined,
    whereClauseB: whereB || undefined,
    whereErrorA: filterResA.error,
    whereErrorB: filterResB.error,
    filteredRowsCountA: activeDataA.length,
    filteredRowsCountB: activeDataB.length,
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

