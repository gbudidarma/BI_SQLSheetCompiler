/**
 * dataMartGenerator.ts
 * Core engine for Data Mart BI:
 * - Generates SELECT, CREATE VIEW, and CREATE TABLE SQL across dialects
 * - Auto-detects foreign key relationships and suggests optimal joins
 * - Auto-analyzes workspace tables and produces tailored Data Mart templates
 * - Formats and validates OLAP queries with aggregation functions
 */

import {
  TableSchema,
  ColumnInfo,
  DataMartModel,
  DataMartDimensionConfig,
  DataMartMeasureConfig,
  DataMartFilterConfig,
  DataMartHavingConfig,
  DataMartJoinConfig,
  AutoMartSuggestion,
  DataMartAggregation,
  DataMartDateGrain,
} from '../types';
import { SqlDialect } from './starSchemaSqlGenerator';

/**
 * Returns whether a column looks like a numeric metric/measure
 */
export function isMeasureColumn(col: ColumnInfo): boolean {
  const name = col.name.toLowerCase();
  if (name.endsWith('_sk') || name.endsWith('_id') || name === 'id' || name.endsWith('_key')) {
    return false;
  }
  const type = (col.type || '').toUpperCase();
  if (type === 'INTEGER' || type === 'FLOAT') {
    return true;
  }
  return (
    name.includes('amount') ||
    name.includes('price') ||
    name.includes('revenue') ||
    name.includes('sales') ||
    name.includes('qty') ||
    name.includes('quantity') ||
    name.includes('cost') ||
    name.includes('profit') ||
    name.includes('discount') ||
    name.includes('total') ||
    name.includes('spend') ||
    name.includes('score') ||
    name.includes('rating') ||
    name.includes('balance')
  );
}

/**
 * Returns whether a column looks like a date/time attribute
 */
export function isDateColumn(col: ColumnInfo): boolean {
  const type = (col.type || '').toUpperCase();
  const name = col.name.toLowerCase();
  return (
    type === 'DATE' ||
    name.includes('date') ||
    name.includes('time') ||
    name.includes('year') ||
    name.includes('month') ||
    name.includes('day') ||
    name.includes('created') ||
    name.includes('updated')
  );
}

/**
 * Returns whether a column looks like a join key
 */
export function isKeyColumn(col: ColumnInfo): boolean {
  const name = col.name.toLowerCase();
  return (
    name.endsWith('_sk') ||
    name.endsWith('_id') ||
    name.endsWith('_key') ||
    name === 'id' ||
    name.includes('code') ||
    name.includes('sku')
  );
}

/**
 * Categorizes a column into a role tag
 */
export function getColumnCategory(
  col: ColumnInfo
): 'measure' | 'date' | 'key' | 'dimension' {
  if (isKeyColumn(col)) return 'key';
  if (isMeasureColumn(col)) return 'measure';
  if (isDateColumn(col)) return 'date';
  return 'dimension';
}

/**
 * Formats a column expression for a date grain
 */
export function formatDateGrainExpression(
  tableAlias: string,
  column: string,
  grain: DataMartDateGrain,
  dialect: SqlDialect = 'standard'
): string {
  const colRef = `${tableAlias}.${column}`;
  if (grain === 'none' || !grain) return colRef;

  switch (dialect) {
    case 'postgres':
      if (grain === 'year') return `DATE_TRUNC('year', ${colRef})::DATE`;
      if (grain === 'quarter') return `DATE_TRUNC('quarter', ${colRef})::DATE`;
      if (grain === 'month') return `DATE_TRUNC('month', ${colRef})::DATE`;
      if (grain === 'day') return `DATE_TRUNC('day', ${colRef})::DATE`;
      break;

    case 'snowflake':
    case 'bigquery':
      if (grain === 'year') return `DATE_TRUNC(${colRef}, YEAR)`;
      if (grain === 'quarter') return `DATE_TRUNC(${colRef}, QUARTER)`;
      if (grain === 'month') return `DATE_TRUNC(${colRef}, MONTH)`;
      if (grain === 'day') return `DATE_TRUNC(${colRef}, DAY)`;
      break;

    case 'mysql':
      if (grain === 'year') return `DATE_FORMAT(${colRef}, '%Y-01-01')`;
      if (grain === 'quarter') return `CONCAT(YEAR(${colRef}), '-Q', QUARTER(${colRef}))`;
      if (grain === 'month') return `DATE_FORMAT(${colRef}, '%Y-%m-01')`;
      if (grain === 'day') return `DATE(${colRef})`;
      break;

    case 'standard':
    default:
      // AlaSQL & ANSI SQL friendly
      if (grain === 'year') return `YEAR(${colRef})`;
      if (grain === 'quarter') return `QUARTER(${colRef})`;
      if (grain === 'month') return `MONTH(${colRef})`;
      if (grain === 'day') return `DAY(${colRef})`;
      break;
  }
  return colRef;
}

/**
 * Formats an aggregation measure expression
 */
export function formatMeasureExpression(
  tableAlias: string,
  measure: DataMartMeasureConfig,
  dialect: SqlDialect = 'standard'
): string {
  const colRef = `${tableAlias}.${measure.column}`;
  switch (measure.aggregation) {
    case 'SUM':
      return `SUM(${colRef})`;
    case 'AVG':
      return dialect === 'postgres' ? `ROUND(AVG(${colRef})::numeric, 2)` : `ROUND(AVG(${colRef}), 2)`;
    case 'COUNT':
      return `COUNT(${colRef})`;
    case 'COUNT_DISTINCT':
      return `COUNT(DISTINCT ${colRef})`;
    case 'MIN':
      return `MIN(${colRef})`;
    case 'MAX':
      return `MAX(${colRef})`;
    default:
      return `SUM(${colRef})`;
  }
}

/**
 * Builds table alias dictionary (e.g., fact_sales -> f, dim_customer -> c)
 */
export function buildTableAliases(model: DataMartModel): Map<string, string> {
  const aliasMap = new Map<string, string>();
  const used = new Set<string>();

  const getCleanAlias = (tblName: string) => {
    let clean = tblName.toLowerCase().replace(/^(fact_|dim_|dm_|subdim_)/, '');
    let char = clean[0] || 't';
    let candidate = char;
    let idx = 1;
    while (used.has(candidate)) {
      candidate = `${char}${idx++}`;
    }
    used.add(candidate);
    return candidate;
  };

  aliasMap.set(model.primaryTable, getCleanAlias(model.primaryTable));

  model.joins.forEach((j) => {
    if (!aliasMap.has(j.toTable)) {
      aliasMap.set(j.toTable, getCleanAlias(j.toTable));
    }
  });

  return aliasMap;
}

/**
 * Generates the clean SELECT SQL for a Data Mart model
 */
export function generateDataMartSelectSql(
  model: DataMartModel,
  dialect: SqlDialect = 'standard'
): string {
  if (!model.primaryTable) {
    return '-- Please select a Primary Table to begin building your Data Mart';
  }

  const aliases = buildTableAliases(model);
  const primaryAlias = aliases.get(model.primaryTable) || 'p';

  // Projection clauses
  const projections: string[] = [];

  // Dimensions
  model.dimensions.forEach((dim) => {
    const tblAlias = aliases.get(dim.table) || dim.table;
    const expr = formatDateGrainExpression(tblAlias, dim.column, dim.dateGrain || 'none', dialect);
    const aliasName = dim.alias || (dim.dateGrain && dim.dateGrain !== 'none' ? `${dim.column}_${dim.dateGrain}` : dim.column);
    projections.push(`  ${expr} AS ${aliasName}`);
  });

  // Measures
  model.measures.forEach((meas) => {
    const tblAlias = aliases.get(meas.table) || meas.table;
    const expr = formatMeasureExpression(tblAlias, meas, dialect);
    projections.push(`  ${expr} AS ${meas.alias}`);
  });

  if (projections.length === 0) {
    projections.push(`  ${primaryAlias}.*`);
  }

  // FROM clause
  const fromClause = `FROM ${model.primaryTable} AS ${primaryAlias}`;

  // JOIN clauses
  const joinClauses: string[] = [];
  model.joins.forEach((join) => {
    const fromAlias = aliases.get(join.fromTable) || join.fromTable;
    const toAlias = aliases.get(join.toTable) || join.toTable;
    joinClauses.push(
      `${join.joinType} ${join.toTable} AS ${toAlias}\n  ON ${fromAlias}.${join.fromColumn} = ${toAlias}.${join.toColumn}`
    );
  });

  // WHERE clause
  const whereClauses: string[] = [];
  model.filters.forEach((filter) => {
    const tblAlias = aliases.get(filter.table) || filter.table;
    const colRef = `${tblAlias}.${filter.column}`;
    if (filter.operator === 'IS NOT NULL') {
      whereClauses.push(`${colRef} IS NOT NULL`);
    } else if (filter.operator === 'LIKE') {
      whereClauses.push(`${colRef} LIKE '%${filter.value.replace(/'/g, "''")}%'`);
    } else {
      const isNum = !isNaN(Number(filter.value)) && filter.value.trim() !== '';
      const valStr = isNum ? filter.value : `'${filter.value.replace(/'/g, "''")}'`;
      whereClauses.push(`${colRef} ${filter.operator} ${valStr}`);
    }
  });

  // GROUP BY clause
  const groupByClauses: string[] = [];
  if (model.dimensions.length > 0 && model.measures.length > 0) {
    model.dimensions.forEach((dim) => {
      const tblAlias = aliases.get(dim.table) || dim.table;
      const expr = formatDateGrainExpression(tblAlias, dim.column, dim.dateGrain || 'none', dialect);
      groupByClauses.push(expr);
    });
  }

  // HAVING clause
  const havingClauses: string[] = [];
  model.havings.forEach((h) => {
    havingClauses.push(`${h.measureAlias} ${h.operator} ${h.value}`);
  });

  // ORDER BY clause
  let orderByClause = '';
  if (model.sort && model.sort.columnOrAlias) {
    orderByClause = `ORDER BY ${model.sort.columnOrAlias} ${model.sort.direction}`;
  } else if (model.measures.length > 0) {
    orderByClause = `ORDER BY ${model.measures[0].alias} DESC`;
  } else if (model.dimensions.length > 0) {
    orderByClause = `ORDER BY 1 ASC`;
  }

  // LIMIT clause
  const limitClause = model.limit && model.limit > 0 ? `LIMIT ${model.limit}` : '';

  // Assemble query
  const parts: string[] = [
    'SELECT',
    projections.join(',\n'),
    fromClause,
  ];

  if (joinClauses.length > 0) {
    parts.push(joinClauses.join('\n'));
  }

  if (whereClauses.length > 0) {
    parts.push(`WHERE ${whereClauses.join('\n  AND ')}`);
  }

  if (groupByClauses.length > 0) {
    parts.push(`GROUP BY\n  ${groupByClauses.join(',\n  ')}`);
  }

  if (havingClauses.length > 0) {
    parts.push(`HAVING ${havingClauses.join('\n  AND ')}`);
  }

  if (orderByClause) {
    parts.push(orderByClause);
  }

  if (limitClause) {
    parts.push(limitClause);
  }

  return parts.join('\n') + ';';
}

/**
 * Generates CREATE VIEW DDL statement
 */
export function generateDataMartCreateViewSql(
  model: DataMartModel,
  dialect: SqlDialect = 'standard'
): string {
  const martName = model.name.toLowerCase().startsWith('dm_') ? model.name : `dm_${model.name}`;
  const selectSql = generateDataMartSelectSql(model, dialect);

  let viewHeader = `CREATE VIEW ${martName} AS`;
  if (dialect === 'postgres' || dialect === 'snowflake' || dialect === 'bigquery') {
    viewHeader = `CREATE OR REPLACE VIEW ${martName} AS`;
  }

  return `-- =========================================================
-- DATA MART VIEW DEFINITION: ${martName}
-- Purpose: ${model.description || 'Analytical aggregation and business intelligence view'}
-- Dialect: ${dialect.toUpperCase()}
-- =========================================================
${viewHeader}
${selectSql}`;
}

/**
 * Generates CREATE TABLE / CTAS statement (Materialized Table)
 */
export function generateDataMartCreateTableSql(
  model: DataMartModel,
  dialect: SqlDialect = 'standard'
): string {
  const martName = model.name.toLowerCase().startsWith('dm_') ? model.name : `dm_${model.name}`;
  const selectSql = generateDataMartSelectSql(model, dialect);

  let ctasHeader = `CREATE TABLE ${martName} AS`;
  if (dialect === 'snowflake') {
    ctasHeader = `CREATE OR REPLACE TABLE ${martName} AS`;
  } else if (dialect === 'bigquery') {
    ctasHeader = `CREATE OR REPLACE TABLE ${martName} AS`;
  }

  return `-- =========================================================
-- MATERIALIZED DATA MART TABLE (CTAS): ${martName}
-- Snapshots analytical data mart for high-speed BI reporting
-- Dialect: ${dialect.toUpperCase()}
-- =========================================================
${ctasHeader}
${selectSql}`;
}

/**
 * Discovers potential foreign-key join relationships between tables
 */
export function suggestTableJoins(
  primaryTable: TableSchema,
  otherTables: TableSchema[]
): DataMartJoinConfig[] {
  const suggested: DataMartJoinConfig[] = [];
  if (!primaryTable || !otherTables) return suggested;

  const primCols = primaryTable.columns;

  otherTables.forEach((other) => {
    if (other.name === primaryTable.name) return;

    // 1. Direct surrogate key match: e.g. customer_sk in primary == customer_sk in dim_customer
    for (const pCol of primCols) {
      for (const oCol of other.columns) {
        const pName = pCol.name.toLowerCase();
        const oName = oCol.name.toLowerCase();

        // Exact match on keys
        const isMatch =
          pName === oName &&
          (pName.endsWith('_sk') ||
            pName.endsWith('_id') ||
            pName.endsWith('_key') ||
            pName === 'id' ||
            pName.includes('code'));

        // Target table name prefix match: e.g. customer_id in orders == id in customers
        const isTargetMatch =
          pName === `${other.name.toLowerCase().replace(/^(dim_|dm_)/, '')}_id` &&
          (oName === 'id' || oName === `${other.name.toLowerCase().replace(/^(dim_|dm_)/, '')}_id`);

        if (isMatch || isTargetMatch) {
          suggested.push({
            id: `join_${primaryTable.name}_${other.name}_${pCol.name}`,
            fromTable: primaryTable.name,
            fromColumn: pCol.name,
            toTable: other.name,
            toColumn: oCol.name,
            joinType: 'LEFT JOIN',
          });
          break; // 1 join per table candidate
        }
      }
    }
  });

  return suggested;
}

/**
 * Generates smart auto-analysis Data Mart suggestions based on workspace tables
 */
export function generateAutoMartSuggestions(
  tables: TableSchema[]
): AutoMartSuggestion[] {
  const suggestions: AutoMartSuggestion[] = [];
  if (!tables || tables.length === 0) return suggestions;

  // Find candidate Fact table (table with measures or named fact_* or with highest row count)
  let factTable = tables.find((t) => t.name.toLowerCase().startsWith('fact_'));
  if (!factTable) {
    factTable = tables.find((t) =>
      ['orders', 'sales', 'transactions', 'line_items', 'order_details'].some((cand) =>
        t.name.toLowerCase().includes(cand)
      )
    );
  }
  if (!factTable) {
    // Pick table with most measure columns
    let maxMeasures = -1;
    tables.forEach((t) => {
      const mCount = t.columns.filter(isMeasureColumn).length;
      if (mCount > maxMeasures) {
        maxMeasures = mCount;
        factTable = t;
      }
    });
  }
  if (!factTable) {
    factTable = tables[0];
  }

  const otherTables = tables.filter((t) => t.name !== factTable?.name);
  const suggestedJoins = suggestTableJoins(factTable, otherTables);

  // Collect all available columns from fact + joined dimensions
  const factMeasures = factTable.columns.filter(isMeasureColumn);
  const factDims = factTable.columns.filter((c) => !isMeasureColumn(c) && !isKeyColumn(c));
  const factDates = factTable.columns.filter(isDateColumn);

  // 1. Sales & Revenue Performance Mart
  const revenueCol =
    factMeasures.find((c) => /total|amount|revenue|sales|price/i.test(c.name)) ||
    factMeasures[0];
  const qtyCol =
    factMeasures.find((c) => /qty|quantity|units|count/i.test(c.name)) ||
    factMeasures[1];

  // Try to find category or product dimension
  let productDimCol = factDims.find((c) => /category|product|item|type|department/i.test(c.name));
  let productTbl = factTable.name;

  if (!productDimCol) {
    for (const other of otherTables) {
      const found = other.columns.find((c) => /category|product_name|name|department/i.test(c.name));
      if (found) {
        productDimCol = found;
        productTbl = other.name;
        break;
      }
    }
  }

  const dateCol = factDates[0];

  if (revenueCol) {
    const dims: DataMartDimensionConfig[] = [];
    if (productDimCol) {
      dims.push({
        id: 'dim_category',
        table: productTbl,
        column: productDimCol.name,
        alias: 'product_category',
      });
    }
    if (dateCol) {
      dims.push({
        id: 'dim_date_grain',
        table: factTable.name,
        column: dateCol.name,
        alias: 'sales_month',
        dateGrain: 'month',
      });
    }

    const measures: DataMartMeasureConfig[] = [
      {
        id: 'meas_revenue',
        table: factTable.name,
        column: revenueCol.name,
        aggregation: 'SUM',
        alias: 'total_revenue',
      },
      {
        id: 'meas_orders',
        table: factTable.name,
        column: revenueCol.name,
        aggregation: 'COUNT',
        alias: 'transaction_volume',
      },
      {
        id: 'meas_aov',
        table: factTable.name,
        column: revenueCol.name,
        aggregation: 'AVG',
        alias: 'avg_order_value',
      },
    ];

    if (qtyCol) {
      measures.push({
        id: 'meas_units',
        table: factTable.name,
        column: qtyCol.name,
        aggregation: 'SUM',
        alias: 'total_units_sold',
      });
    }

    // Relevant joins for product table
    const relevantJoins = suggestedJoins.filter((j) => j.toTable === productTbl);

    suggestions.push({
      id: 'mart_sales_performance',
      name: 'dm_sales_performance',
      badge: 'Revenue & Sales',
      category: 'sales',
      description: 'Rollup of revenue, order transactions, average order value, and unit volumes across categories and time.',
      recommendedReason: `Derived from primary metrics [${revenueCol.name}${qtyCol ? ', ' + qtyCol.name : ''}] and business grouping.`,
      model: {
        name: 'dm_sales_performance',
        description: 'Executive Sales & Revenue Performance Mart',
        primaryTable: factTable.name,
        joins: relevantJoins,
        dimensions: dims,
        measures,
        filters: [],
        havings: [],
        sort: { columnOrAlias: 'total_revenue', direction: 'DESC' },
        limit: 100,
      },
    });
  }

  // 2. Customer 360 & Regional Mart
  let customerDimCol = factDims.find((c) => /customer|client|region|city|state|segment|tier/i.test(c.name));
  let customerTbl = factTable.name;

  if (!customerDimCol) {
    for (const other of otherTables) {
      const found = other.columns.find((c) => /customer_name|segment|region|city|state/i.test(c.name));
      if (found) {
        customerDimCol = found;
        customerTbl = other.name;
        break;
      }
    }
  }

  if (customerDimCol && revenueCol) {
    const custJoins = suggestedJoins.filter((j) => j.toTable === customerTbl);
    suggestions.push({
      id: 'mart_customer_insights',
      name: 'dm_customer_insights',
      badge: 'Customer 360',
      category: 'customer',
      description: 'Analyzes customer spending patterns, order frequencies, and lifetime value across customer tiers or geographic regions.',
      recommendedReason: `Aggregates customer entity [${customerDimCol.name}] with monetary metrics to reveal top spenders.`,
      model: {
        name: 'dm_customer_insights',
        description: 'Customer Lifetime Value & Segment Data Mart',
        primaryTable: factTable.name,
        joins: custJoins,
        dimensions: [
          {
            id: 'dim_customer_entity',
            table: customerTbl,
            column: customerDimCol.name,
            alias: customerDimCol.name,
          },
        ],
        measures: [
          {
            id: 'meas_cust_revenue',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'SUM',
            alias: 'lifetime_spend',
          },
          {
            id: 'meas_cust_orders',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'COUNT',
            alias: 'order_frequency',
          },
          {
            id: 'meas_cust_max',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'MAX',
            alias: 'highest_single_purchase',
          },
        ],
        filters: [],
        havings: [],
        sort: { columnOrAlias: 'lifetime_spend', direction: 'DESC' },
        limit: 50,
      },
    });
  }

  // 3. Product Velocity & Profitability Mart
  if (qtyCol || revenueCol) {
    const targetMeas = revenueCol || factMeasures[0];
    const dims: DataMartDimensionConfig[] = [];
    if (productDimCol) {
      dims.push({
        id: 'dim_prod',
        table: productTbl,
        column: productDimCol.name,
        alias: 'product_dimension',
      });
    } else if (factDims[0]) {
      dims.push({
        id: 'dim_first',
        table: factTable.name,
        column: factDims[0].name,
        alias: factDims[0].name,
      });
    }

    if (dims.length > 0 && targetMeas) {
      suggestions.push({
        id: 'mart_product_velocity',
        name: 'dm_product_velocity',
        badge: 'Product & Catalog',
        category: 'product',
        description: 'Tracks product velocity, sales turnover, and volume performance to identify bestsellers and stock velocity.',
        recommendedReason: 'Evaluates product item distribution to identify top performing SKUs.',
        model: {
          name: 'dm_product_velocity',
          description: 'Product Catalog Velocity & Turnover Mart',
          primaryTable: factTable.name,
          joins: suggestedJoins.filter((j) => j.toTable === productTbl),
          dimensions: dims,
          measures: [
            {
              id: 'meas_prod_rev',
              table: factTable.name,
              column: targetMeas.name,
              aggregation: 'SUM',
              alias: 'gross_sales',
            },
            {
              id: 'meas_prod_avg',
              table: factTable.name,
              column: targetMeas.name,
              aggregation: 'AVG',
              alias: 'average_realized_price',
            },
            {
              id: 'meas_prod_count',
              table: factTable.name,
              column: targetMeas.name,
              aggregation: 'COUNT',
              alias: 'order_count',
            },
          ],
          filters: [],
          havings: [],
          sort: { columnOrAlias: 'gross_sales', direction: 'DESC' },
          limit: 50,
        },
      });
    }
  }

  // 4. Executive Temporal KPI Trend Mart
  if (dateCol && revenueCol) {
    suggestions.push({
      id: 'mart_executive_kpis',
      name: 'dm_executive_monthly_kpi',
      badge: 'Executive & Time',
      category: 'executive',
      description: 'Monthly and quarterly trend rollups for C-suite reporting, forecasting, and revenue growth tracking.',
      recommendedReason: `Time-series rollup based on temporal dimension [${dateCol.name}].`,
      model: {
        name: 'dm_executive_monthly_kpi',
        description: 'Executive Monthly Summary KPI Data Mart',
        primaryTable: factTable.name,
        joins: [],
        dimensions: [
          {
            id: 'dim_exec_year',
            table: factTable.name,
            column: dateCol.name,
            alias: 'reporting_year',
            dateGrain: 'year',
          },
          {
            id: 'dim_exec_month',
            table: factTable.name,
            column: dateCol.name,
            alias: 'reporting_month',
            dateGrain: 'month',
          },
        ],
        measures: [
          {
            id: 'meas_exec_rev',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'SUM',
            alias: 'monthly_gross_revenue',
          },
          {
            id: 'meas_exec_orders',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'COUNT',
            alias: 'monthly_order_count',
          },
          {
            id: 'meas_exec_avg',
            table: factTable.name,
            column: revenueCol.name,
            aggregation: 'AVG',
            alias: 'average_ticket_size',
          },
        ],
        filters: [],
        havings: [],
        sort: { columnOrAlias: 'reporting_year', direction: 'ASC' },
        limit: 100,
      },
    });
  }

  // 5. Star Schema Unified Rollup Mart (if multiple dimensions exist)
  if (suggestedJoins.length > 0 && revenueCol) {
    const starDims: DataMartDimensionConfig[] = [];

    // Add 1 dimension from each joined table
    suggestedJoins.forEach((join, idx) => {
      const targetTbl = tables.find((t) => t.name === join.toTable);
      if (targetTbl) {
        const attribute =
          targetTbl.columns.find((c) => !isKeyColumn(c) && !isMeasureColumn(c)) ||
          targetTbl.columns[1] ||
          targetTbl.columns[0];
        if (attribute) {
          starDims.push({
            id: `dim_star_${idx}`,
            table: targetTbl.name,
            column: attribute.name,
            alias: `${targetTbl.name.replace(/^(dim_|dm_)/, '')}_${attribute.name}`,
          });
        }
      }
    });

    if (starDims.length > 0) {
      suggestions.push({
        id: 'mart_star_schema_rollup',
        name: 'dm_star_cross_functional',
        badge: 'Star Schema OLAP',
        category: 'star_schema',
        description: 'Multi-dimensional OLAP cube joining all active dimension satellites with fact transaction metrics.',
        recommendedReason: `Automatically bridges ${suggestedJoins.length} dimension satellites via surrogate foreign keys.`,
        model: {
          name: 'dm_star_cross_functional',
          description: 'Cross-Functional Star Schema Data Mart',
          primaryTable: factTable.name,
          joins: suggestedJoins,
          dimensions: starDims,
          measures: [
            {
              id: 'meas_star_sum',
              table: factTable.name,
              column: revenueCol.name,
              aggregation: 'SUM',
              alias: 'total_revenue',
            },
            {
              id: 'meas_star_count',
              table: factTable.name,
              column: revenueCol.name,
              aggregation: 'COUNT',
              alias: 'transaction_count',
            },
          ],
          filters: [],
          havings: [],
          sort: { columnOrAlias: 'total_revenue', direction: 'DESC' },
          limit: 100,
        },
      });
    }
  }

  return suggestions;
}
