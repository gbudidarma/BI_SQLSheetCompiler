/**
 * visualizerEngine.ts
 * Calculation, aggregation, data pivoting, and SQL generation engine
 * for the Drag-and-Drop Data Visualization Studio.
 */

export type AggregationFunction =
  | 'sum'
  | 'avg'
  | 'count'
  | 'distinct_count'
  | 'min'
  | 'max'
  | 'median'
  | 'percent_of_total'
  | 'running_sum';

export type MetricFormat = 'standard' | 'currency' | 'percentage' | 'compact' | 'integer';

export interface VisualMetricConfig {
  id: string;
  column: string;
  aggregation: AggregationFunction;
  alias?: string;
  format?: MetricFormat;
  color?: string;
}

export interface VisualFilterConfig {
  id: string;
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'not_null';
  value: string | number;
}

export type ChartType =
  | 'bar_vertical'
  | 'bar_horizontal'
  | 'donut'
  | 'pie'
  | 'line'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'kpi'
  | 'pivot_table';

export type StackingMode = 'grouped' | 'stacked' | 'percent';

export type SortOrder = 'val_desc' | 'val_asc' | 'alpha_asc' | 'alpha_desc' | 'none';

export interface PivotResult {
  labels: string[]; // X-axis categories
  series: {
    id: string;
    label: string;
    metric: string;
    aggregation: AggregationFunction;
    format: MetricFormat;
    color: string;
    values: number[];
  }[];
  breakdownCategories?: string[]; // If breakdown column is used
  tableRows: Record<string, any>[]; // Aggregated flat table for pivot view / export
  stats: {
    totalRows: number;
    filteredRows: number;
    grandTotal: number;
    average: number;
    min: number;
    max: number;
  };
  generatedSql: string;
}

export const AGGREGATION_LABELS: Record<AggregationFunction, { label: string; short: string; desc: string }> = {
  sum: { label: 'Sum', short: 'SUM', desc: 'Total sum of all values' },
  avg: { label: 'Average', short: 'AVG', desc: 'Arithmetic mean of values' },
  count: { label: 'Count', short: 'COUNT', desc: 'Total row count' },
  distinct_count: { label: 'Distinct Count', short: 'DISTINCT', desc: 'Number of unique values' },
  min: { label: 'Minimum', short: 'MIN', desc: 'Smallest value' },
  max: { label: 'Maximum', short: 'MAX', desc: 'Largest value' },
  median: { label: 'Median', short: 'MEDIAN', desc: '50th percentile midpoint' },
  percent_of_total: { label: '% of Total', short: '% TOTAL', desc: 'Share of overall total' },
  running_sum: { label: 'Running Total', short: 'RUN SUM', desc: 'Cumulative rolling sum' },
};

export const COLOR_PALETTES: Record<string, { name: string; colors: string[] }> = {
  modern: {
    name: 'Modern Vibrant',
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#E11D48'],
  },
  emerald: {
    name: 'Emerald Forest',
    colors: ['#059669', '#10B981', '#34D399', '#6EE7B7', '#0D9488', '#14B8A6', '#2DD4BF', '#0284C7', '#38BDF8', '#818CF8'],
  },
  sunset: {
    name: 'Sunset Warmth',
    colors: ['#F97316', '#FB923C', '#F59E0B', '#E11D48', '#F43F5E', '#BE185D', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'],
  },
  cyber: {
    name: 'Cyber Neon',
    colors: ['#06B6D4', '#22C55E', '#EAB308', '#EC4899', '#A855F7', '#3B82F6', '#14B8A6', '#F97316', '#6366F1', '#10B981'],
  },
  monochrome: {
    name: 'Steel Monochrome',
    colors: ['#64748B', '#94A3B8', '#475569', '#334155', '#CBD5E1', '#E2E8F0', '#0EA5E9', '#38BDF8', '#93C5FD', '#1E293B'],
  },
};

/**
 * Format a numeric value according to chosen style
 */
export function formatMetricValue(value: number, format: MetricFormat = 'standard', decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '-';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
        maximumFractionDigits: decimals,
      }).format(value);

    case 'percentage':
      return `${value.toFixed(decimals)}%`;

    case 'compact':
      return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);

    case 'integer':
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
      }).format(Math.round(value));

    case 'standard':
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(2, decimals),
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

/**
 * Detect column data type affinity (measure vs dimension)
 */
export function classifyColumn(values: any[]): 'measure' | 'dimension' | 'date' {
  if (!values || values.length === 0) return 'dimension';

  let numericCount = 0;
  let dateCount = 0;
  let nonNullCount = 0;

  for (let i = 0; i < Math.min(values.length, 100); i++) {
    const v = values[i];
    if (v === null || v === undefined || v === '') continue;
    nonNullCount++;

    if (typeof v === 'number') {
      numericCount++;
    } else if (!isNaN(Number(v))) {
      numericCount++;
    } else if (typeof v === 'string') {
      const parsed = Date.parse(v);
      if (!isNaN(parsed) && (v.includes('-') || v.includes('/') || v.includes(':'))) {
        dateCount++;
      }
    }
  }

  if (nonNullCount === 0) return 'dimension';
  if (numericCount / nonNullCount > 0.75) return 'measure';
  if (dateCount / nonNullCount > 0.75) return 'date';
  return 'dimension';
}

/**
 * Perform median calculation
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Aggregate raw numbers array based on specified function
 */
export function computeAggregate(
  rawValues: any[],
  aggFunc: AggregationFunction,
  groupTotalRows: number,
  grandTotalSum: number = 0
): number {
  if (aggFunc === 'count') {
    return groupTotalRows;
  }

  if (aggFunc === 'distinct_count') {
    const set = new Set(rawValues.filter((v) => v !== null && v !== undefined && v !== ''));
    return set.size;
  }

  const nums = rawValues
    .map((v) => (typeof v === 'number' ? v : parseFloat(v)))
    .filter((n) => !isNaN(n));

  if (nums.length === 0) return 0;

  switch (aggFunc) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);

    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;

    case 'min':
      return Math.min(...nums);

    case 'max':
      return Math.max(...nums);

    case 'median':
      return calculateMedian(nums);

    case 'percent_of_total': {
      const sum = nums.reduce((a, b) => a + b, 0);
      return grandTotalSum > 0 ? (sum / grandTotalSum) * 100 : 0;
    }

    case 'running_sum':
      // Calculated at series level
      return nums.reduce((a, b) => a + b, 0);

    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

/**
 * Main Pivot & Aggregation Engine
 */
export function executePivot({
  data,
  tableName,
  dimensionCol,
  metrics,
  breakdownCol,
  filters = [],
  sortOrder = 'val_desc',
  sortByMetricId,
  limit = 20,
  paletteKey = 'modern',
}: {
  data: Record<string, any>[];
  tableName: string;
  dimensionCol: string | null;
  metrics: VisualMetricConfig[];
  breakdownCol?: string | null;
  filters?: VisualFilterConfig[];
  sortOrder?: SortOrder;
  sortByMetricId?: string;
  limit?: number;
  paletteKey?: string;
}): PivotResult {
  const palette = COLOR_PALETTES[paletteKey]?.colors || COLOR_PALETTES.modern.colors;

  if (!data || data.length === 0) {
    return {
      labels: [],
      series: [],
      tableRows: [],
      stats: { totalRows: 0, filteredRows: 0, grandTotal: 0, average: 0, min: 0, max: 0 },
      generatedSql: `-- No data available in table ${tableName}`,
    };
  }

  // 1. Filter raw data
  const filteredData = data.filter((row) => {
    for (const f of filters) {
      if (!f.column) continue;
      const val = row[f.column];
      switch (f.operator) {
        case 'equals':
          if (String(val) !== String(f.value)) return false;
          break;
        case 'not_equals':
          if (String(val) === String(f.value)) return false;
          break;
        case 'contains':
          if (!String(val || '').toLowerCase().includes(String(f.value).toLowerCase())) return false;
          break;
        case 'greater_than':
          if (Number(val) <= Number(f.value)) return false;
          break;
        case 'less_than':
          if (Number(val) >= Number(f.value)) return false;
          break;
        case 'not_null':
          if (val === null || val === undefined || val === '') return false;
          break;
      }
    }
    return true;
  });

  // Effective dimension
  const effectiveDim = dimensionCol || (Object.keys(data[0] || {})[0] || 'Category');

  // If no metrics specified, auto-default to COUNT(*)
  const effectiveMetrics: VisualMetricConfig[] =
    metrics.length > 0
      ? metrics
      : [
          {
            id: 'm_count',
            column: '*',
            aggregation: 'count',
            alias: 'Total Records',
            format: 'integer',
          },
        ];

  // Calculate grand sum of first metric for % of total calculation
  let grandTotalSum = 0;
  if (effectiveMetrics.length > 0) {
    const firstMetric = effectiveMetrics[0].column;
    if (firstMetric && firstMetric !== '*') {
      filteredData.forEach((row) => {
        const v = parseFloat(row[firstMetric]);
        if (!isNaN(v)) grandTotalSum += v;
      });
    } else {
      grandTotalSum = filteredData.length;
    }
  }

  // 2. Group by Dimension (and optional Breakdown)
  interface GroupBucket {
    count: number;
    rawValuesByMetric: Record<string, any[]>;
    breakdownSubGroups?: Map<string, { count: number; rawValues: Record<string, any[]> }>;
  }

  const groupBuckets = new Map<string, GroupBucket>();
  const allBreakdownKeys = new Set<string>();

  filteredData.forEach((row) => {
    const rawDim = row[effectiveDim];
    const dimKey = rawDim !== null && rawDim !== undefined && rawDim !== '' ? String(rawDim) : '(blank)';

    let bucket = groupBuckets.get(dimKey);
    if (!bucket) {
      bucket = {
        count: 0,
        rawValuesByMetric: {},
        breakdownSubGroups: breakdownCol ? new Map() : undefined,
      };
      effectiveMetrics.forEach((m) => {
        bucket!.rawValuesByMetric[m.id] = [];
      });
      groupBuckets.set(dimKey, bucket);
    }

    bucket.count++;
    effectiveMetrics.forEach((m) => {
      bucket!.rawValuesByMetric[m.id].push(m.column === '*' ? 1 : row[m.column]);
    });

    if (breakdownCol && bucket.breakdownSubGroups) {
      const rawBrk = row[breakdownCol];
      const brkKey = rawBrk !== null && rawBrk !== undefined && rawBrk !== '' ? String(rawBrk) : '(other)';
      allBreakdownKeys.add(brkKey);

      let subBucket = bucket.breakdownSubGroups.get(brkKey);
      if (!subBucket) {
        subBucket = { count: 0, rawValues: {} };
        effectiveMetrics.forEach((m) => {
          subBucket!.rawValues[m.id] = [];
        });
        bucket.breakdownSubGroups.set(brkKey, subBucket);
      }
      subBucket.count++;
      effectiveMetrics.forEach((m) => {
        subBucket!.rawValues[m.id].push(m.column === '*' ? 1 : row[m.column]);
      });
    }
  });

  // 3. Compute Aggregates per Group
  interface AggregatedRow {
    dimLabel: string;
    metricValues: Record<string, number>;
    breakdownValues?: Record<string, Record<string, number>>; // brkKey -> metricId -> val
    primaryValue: number;
  }

  let aggregatedList: AggregatedRow[] = [];

  groupBuckets.forEach((bucket, dimKey) => {
    const metricVals: Record<string, number> = {};
    effectiveMetrics.forEach((m) => {
      const rawList = bucket.rawValuesByMetric[m.id] || [];
      metricVals[m.id] = computeAggregate(rawList, m.aggregation, bucket.count, grandTotalSum);
    });

    let brkValues: Record<string, Record<string, number>> | undefined;
    if (breakdownCol && bucket.breakdownSubGroups) {
      brkValues = {};
      allBreakdownKeys.forEach((brkKey) => {
        brkValues![brkKey] = {};
        const sub = bucket.breakdownSubGroups!.get(brkKey);
        effectiveMetrics.forEach((m) => {
          if (!sub) {
            brkValues![brkKey][m.id] = 0;
          } else {
            brkValues![brkKey][m.id] = computeAggregate(
              sub.rawValues[m.id] || [],
              m.aggregation,
              sub.count,
              grandTotalSum
            );
          }
        });
      });
    }

    const targetMetricId =
      sortByMetricId && metricVals[sortByMetricId] !== undefined
        ? sortByMetricId
        : effectiveMetrics[0]?.id;

    aggregatedList.push({
      dimLabel: dimKey,
      metricValues: metricVals,
      breakdownValues: brkValues,
      primaryValue: targetMetricId ? metricVals[targetMetricId] || 0 : 0,
    });
  });

  const safeNumber = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  // 4. Sorting
  if (sortOrder === 'val_desc') {
    aggregatedList.sort((a, b) => safeNumber(b.primaryValue) - safeNumber(a.primaryValue));
  } else if (sortOrder === 'val_asc') {
    aggregatedList.sort((a, b) => safeNumber(a.primaryValue) - safeNumber(b.primaryValue));
  } else if (sortOrder === 'alpha_asc') {
    aggregatedList.sort((a, b) => a.dimLabel.localeCompare(b.dimLabel, undefined, { numeric: true }));
  } else if (sortOrder === 'alpha_desc') {
    aggregatedList.sort((a, b) => b.dimLabel.localeCompare(a.dimLabel, undefined, { numeric: true }));
  }

  // 5. Limit / Top N (e.g. Top 15)
  if (limit > 0 && aggregatedList.length > limit) {
    aggregatedList = aggregatedList.slice(0, limit);
  }

  // 6. Build Series and Labels
  const labels = aggregatedList.map((row) => row.dimLabel);
  const breakdownCategoryList = Array.from(allBreakdownKeys);

  let seriesResult: PivotResult['series'] = [];

  if (breakdownCol && breakdownCategoryList.length > 0) {
    // When breakdown is used, create a series for each breakdown category (using the primary metric)
    const primaryMetric = effectiveMetrics[0];
    seriesResult = breakdownCategoryList.map((brkCat, idx) => {
      const vals = aggregatedList.map((row) => {
        return row.breakdownValues?.[brkCat]?.[primaryMetric.id] || 0;
      });
      return {
        id: `brk_${idx}_${brkCat}`,
        label: brkCat,
        metric: primaryMetric.column,
        aggregation: primaryMetric.aggregation,
        format: primaryMetric.format || 'standard',
        color: palette[idx % palette.length],
        values: vals,
      };
    });
  } else {
    // Normal multi-metric series
    seriesResult = effectiveMetrics.map((m, idx) => {
      let values = aggregatedList.map((row) => row.metricValues[m.id] || 0);

      // Handle running sum
      if (m.aggregation === 'running_sum') {
        let running = 0;
        values = values.map((v) => {
          running += v;
          return running;
        });
      }

      const aggInfo = AGGREGATION_LABELS[m.aggregation];
      const seriesLabel = m.alias || `${aggInfo.short}(${m.column})`;

      return {
        id: m.id,
        label: seriesLabel,
        metric: m.column,
        aggregation: m.aggregation,
        format: m.format || 'standard',
        color: m.color || palette[idx % palette.length],
        values,
      };
    });
  }

  // 7. Build Flat Table Rows for Pivot Grid & Export
  const tableRows = aggregatedList.map((row) => {
    const out: Record<string, any> = { [effectiveDim]: row.dimLabel };
    if (breakdownCol && row.breakdownValues) {
      breakdownCategoryList.forEach((brk) => {
        const primaryMetric = effectiveMetrics[0];
        const colName = `${brk} (${AGGREGATION_LABELS[primaryMetric.aggregation].short})`;
        out[colName] = row.breakdownValues![brk]?.[primaryMetric.id] || 0;
      });
    } else {
      effectiveMetrics.forEach((m) => {
        const aggInfo = AGGREGATION_LABELS[m.aggregation];
        const colHeader = m.alias || `${aggInfo.short}(${m.column})`;
        out[colHeader] = row.metricValues[m.id];
      });
    }
    return out;
  });

  // 8. Global Stats
  const allValues = seriesResult.flatMap((s) => s.values);
  const totalSum = allValues.reduce((a, b) => a + b, 0);
  const maxVal = allValues.length ? Math.max(...allValues) : 0;
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const avgVal = allValues.length ? totalSum / allValues.length : 0;

  // 9. Generate Equivalent SQL
  const sqlSelectCols: string[] = [`  ${effectiveDim}`];
  if (breakdownCol) {
    sqlSelectCols.push(`  ${breakdownCol}`);
  }

  effectiveMetrics.forEach((m) => {
    let sqlFunc = 'SUM';
    if (m.aggregation === 'avg') sqlFunc = 'AVG';
    else if (m.aggregation === 'count') sqlFunc = 'COUNT';
    else if (m.aggregation === 'distinct_count') sqlFunc = 'COUNT(DISTINCT';
    else if (m.aggregation === 'min') sqlFunc = 'MIN';
    else if (m.aggregation === 'max') sqlFunc = 'MAX';

    const colTarget = m.column === '*' ? '*' : `\`${m.column}\``;
    const expr = m.aggregation === 'distinct_count' ? `COUNT(DISTINCT ${colTarget})` : `${sqlFunc}(${colTarget})`;
    const alias = (m.alias || `${m.aggregation}_${m.column}`).replace(/[^a-zA-Z0-9_]/g, '_');
    sqlSelectCols.push(`  ${expr} AS ${alias}`);
  });

  const groupByCols = [effectiveDim];
  if (breakdownCol) groupByCols.push(breakdownCol);

  let whereClause = '';
  if (filters.length > 0) {
    const conditions = filters
      .filter((f) => f.column)
      .map((f) => {
        if (f.operator === 'equals') return `\`${f.column}\` = '${f.value}'`;
        if (f.operator === 'not_equals') return `\`${f.column}\` != '${f.value}'`;
        if (f.operator === 'contains') return `\`${f.column}\` LIKE '%${f.value}%'`;
        if (f.operator === 'greater_than') return `\`${f.column}\` > ${f.value}`;
        if (f.operator === 'less_than') return `\`${f.column}\` < ${f.value}`;
        if (f.operator === 'not_null') return `\`${f.column}\` IS NOT NULL`;
        return '';
      })
      .filter(Boolean);
    if (conditions.length > 0) {
      whereClause = `\nWHERE ${conditions.join(' AND ')}`;
    }
  }

  let orderClause = '';
  if (sortOrder === 'val_desc') {
    orderClause = `\nORDER BY 2 DESC`;
  } else if (sortOrder === 'val_asc') {
    orderClause = `\nORDER BY 2 ASC`;
  } else if (sortOrder === 'alpha_asc') {
    orderClause = `\nORDER BY 1 ASC`;
  } else if (sortOrder === 'alpha_desc') {
    orderClause = `\nORDER BY 1 DESC`;
  }

  const limitClause = limit > 0 ? `\nLIMIT ${limit}` : '';

  const generatedSql = `SELECT\n${sqlSelectCols.join(',\n')}\nFROM \`${tableName}\`${whereClause}\nGROUP BY ${groupByCols.map((c) => `\`${c}\``).join(', ')}${orderClause}${limitClause};`;

  return {
    labels,
    series: seriesResult,
    breakdownCategories: breakdownCategoryList,
    tableRows,
    stats: {
      totalRows: data.length,
      filteredRows: filteredData.length,
      grandTotal: totalSum,
      average: avgVal,
      min: minVal,
      max: maxVal,
    },
    generatedSql,
  };
}
