/**
 * starSchemaSqlGenerator.ts
 * Generates production-ready SQL scripts for Star Schema & SCD:
 * - CREATE TABLE (DDL) for Dimension tables & Fact table with keys, types & constraints
 * - INSERT INTO ... SELECT (ETL Staging Pipeline) with surrogate key lookups & distinct deduplication
 * - INSERT INTO ... VALUES (DML Row Data population)
 * - SELECT Queries (Star Join BI Analytics & SCD Auditing)
 * - Comprehensive End-to-End Pipeline scripts with dialect support
 */

import {
  ColumnRoleConfig,
  DataType,
  DimensionConfig,
  GeneratedDimension,
  GeneratedFactTable,
  StarSchemaBuildResult,
} from '../types';
import { inferDataType } from './excelParser';

export type SqlDialect = 'standard' | 'postgres' | 'mysql' | 'snowflake' | 'bigquery';

/**
 * Maps logical data type to target SQL dialect data type
 */
function mapDataTypeToSql(
  colName: string,
  type: DataType,
  dialect: SqlDialect = 'standard',
  isPrimaryKey = false
): string {
  const nameLower = colName.toLowerCase();

  if (isPrimaryKey) {
    if (dialect === 'postgres') return 'SERIAL PRIMARY KEY';
    if (dialect === 'mysql') return 'INT NOT NULL AUTO_INCREMENT PRIMARY KEY';
    return 'INT PRIMARY KEY';
  }

  if (type === 'BOOLEAN' || nameLower === 'is_current') {
    if (dialect === 'mysql') return 'TINYINT(1)';
    return 'BOOLEAN';
  }

  if (type === 'DATE' || nameLower.includes('date')) {
    if (nameLower.includes('timestamp') || nameLower.includes('_at') || nameLower.includes('start_date') || nameLower.includes('end_date')) {
      if (dialect === 'postgres') return 'TIMESTAMP WITH TIME ZONE';
      if (dialect === 'snowflake' || dialect === 'bigquery') return 'TIMESTAMP';
      return 'DATETIME';
    }
    return 'DATE';
  }

  if (type === 'INTEGER') {
    if (nameLower.endsWith('_sk') || nameLower.endsWith('_key') || nameLower.endsWith('_id')) {
      return 'INT';
    }
    return 'INT';
  }

  if (type === 'FLOAT') {
    if (
      nameLower.includes('price') ||
      nameLower.includes('amount') ||
      nameLower.includes('cost') ||
      nameLower.includes('revenue') ||
      nameLower.includes('total') ||
      nameLower.includes('sales')
    ) {
      if (dialect === 'bigquery') return 'NUMERIC(14, 2)';
      return 'DECIMAL(14, 2)';
    }
    if (dialect === 'postgres') return 'DOUBLE PRECISION';
    if (dialect === 'mysql') return 'DOUBLE';
    return 'FLOAT';
  }

  // TEXT / VARCHAR
  if (nameLower.endsWith('_sk')) {
    return 'VARCHAR(64)';
  }
  if (nameLower.endsWith('_code') || nameLower.endsWith('_sku') || nameLower.endsWith('_id') || nameLower.endsWith('_no')) {
    return 'VARCHAR(100)';
  }
  if (nameLower.includes('name') || nameLower.includes('city') || nameLower.includes('country') || nameLower.includes('category')) {
    return 'VARCHAR(150)';
  }

  return 'VARCHAR(255)';
}

/**
 * Escapes SQL string literals safely
 */
function escapeSqlValue(val: any): string {
  if (val === null || val === undefined || val === '') {
    return 'NULL';
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 'NULL' : String(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (val instanceof Date) {
    return `'${val.toISOString().split('T')[0]}'`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Generates CREATE TABLE statements for all dimensions and the fact table
 */
export function generateCreateTableDdl(
  result: StarSchemaBuildResult,
  dialect: SqlDialect = 'standard'
): string {
  const scripts: string[] = [];

  scripts.push(`-- =========================================================`);
  scripts.push(`-- STAR SCHEMA DDL: DIMENSION & FACT TABLE SCHEMAS`);
  scripts.push(`-- Generated: ${new Date().toISOString()}`);
  scripts.push(`-- Dialect: ${dialect.toUpperCase()}`);
  scripts.push(`-- =========================================================\n`);

  // 1. DIMENSION TABLES DDL
  result.dimensions.forEach((dim) => {
    scripts.push(`-- Dimension: ${dim.tableName}`);
    scripts.push(`CREATE TABLE ${dim.tableName} (`);

    const colDefs: string[] = [];

    // Surrogate Key
    const skIsInteger = dim.rows.length > 0 && typeof dim.rows[0][dim.surrogateKeyName] === 'number';
    if (skIsInteger) {
      colDefs.push(`    ${dim.surrogateKeyName.padEnd(24)} INT PRIMARY KEY`);
    } else {
      colDefs.push(`    ${dim.surrogateKeyName.padEnd(24)} VARCHAR(64) PRIMARY KEY`);
    }

    // Natural Key
    colDefs.push(`    ${dim.naturalKeyCol.padEnd(24)} VARCHAR(100) NOT NULL`);

    // Attributes
    dim.columns.forEach((c) => {
      if (
        c === dim.surrogateKeyName ||
        c === dim.naturalKeyCol ||
        c === 'effective_start_date' ||
        c === 'effective_end_date' ||
        c === 'is_current'
      ) {
        return;
      }
      const vals = dim.rows.map((r) => r[c]);
      const inferred = inferDataType(vals);
      const sqlType = mapDataTypeToSql(c, inferred, dialect);
      colDefs.push(`    ${c.padEnd(24)} ${sqlType}`);
    });

    // SCD metadata columns if present
    if (dim.columns.includes('effective_start_date')) {
      const tsType = dialect === 'postgres' ? 'TIMESTAMP WITH TIME ZONE' : 'DATETIME';
      colDefs.push(`    ${'effective_start_date'.padEnd(24)} ${tsType} NOT NULL`);
      colDefs.push(`    ${'effective_end_date'.padEnd(24)} ${tsType} NULL`);
      const boolType = dialect === 'mysql' ? 'TINYINT(1)' : 'BOOLEAN';
      colDefs.push(`    ${'is_current'.padEnd(24)} ${boolType} NOT NULL DEFAULT TRUE`);
    }

    scripts.push(colDefs.join(',\n'));
    scripts.push(`);\n`);
  });

  // 2. FACT TABLE DDL
  const fact = result.factTable;
  scripts.push(`-- Fact Table: ${fact.tableName}`);
  scripts.push(`CREATE TABLE ${fact.tableName} (`);

  const factColDefs: string[] = [];

  fact.columns.forEach((c) => {
    const vals = fact.rows.map((r) => r[c]);
    const inferred = inferDataType(vals);

    // Is it a surrogate foreign key?
    const isDimSk = result.dimensions.some((d) => d.surrogateKeyName === c);
    if (isDimSk) {
      factColDefs.push(`    ${c.padEnd(24)} INT NOT NULL`);
      return;
    }

    const sqlType = mapDataTypeToSql(c, inferred, dialect);
    factColDefs.push(`    ${c.padEnd(24)} ${sqlType}`);
  });

  // Optional: Foreign Key constraints
  if (result.dimensions.length > 0 && dialect !== 'bigquery') {
    result.dimensions.forEach((dim) => {
      if (fact.columns.includes(dim.surrogateKeyName)) {
        factColDefs.push(
          `    CONSTRAINT fk_${fact.tableName}_${dim.tableName} FOREIGN KEY (${dim.surrogateKeyName}) REFERENCES ${dim.tableName} (${dim.surrogateKeyName})`
        );
      }
    });
  }

  scripts.push(factColDefs.join(',\n'));
  scripts.push(`);\n`);

  return scripts.join('\n');
}

/**
 * Generates INSERT INTO ... SELECT ETL Pipeline statements
 * from a flat staging table into the Star Schema dimensions and fact table
 */
export function generateInsertSelectEtl(
  result: StarSchemaBuildResult,
  stagingTableName = 'raw_staging',
  columnConfigs: ColumnRoleConfig[] = []
): string {
  const scripts: string[] = [];

  scripts.push(`-- =========================================================`);
  scripts.push(`-- STAR SCHEMA ETL PIPELINE: INSERT INTO ... SELECT`);
  scripts.push(`-- Transforms Flat Staging Table (${stagingTableName}) into Star Schema`);
  scripts.push(`-- =========================================================\n`);

  // 1. POPULATE DIMENSION TABLES VIA DISTINCT / ROW_NUMBER
  result.dimensions.forEach((dim, idx) => {
    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`-- Step 1.${idx + 1}: Populate Dimension ${dim.tableName}`);
    scripts.push(`-- ---------------------------------------------------------`);

    const attrCols = dim.columns.filter(
      (c) =>
        c !== dim.surrogateKeyName &&
        c !== dim.naturalKeyCol &&
        c !== 'effective_start_date' &&
        c !== 'effective_end_date' &&
        c !== 'is_current'
    );

    const hasScdCols = dim.columns.includes('is_current');

    const targetCols = [
      dim.surrogateKeyName,
      dim.naturalKeyCol,
      ...attrCols,
      ...(hasScdCols ? ['effective_start_date', 'effective_end_date', 'is_current'] : []),
    ];

    scripts.push(`INSERT INTO ${dim.tableName} (`);
    scripts.push(`    ` + targetCols.join(',\n    '));
    scripts.push(`)`);
    scripts.push(`SELECT`);
    scripts.push(`    ROW_NUMBER() OVER (ORDER BY ${dim.naturalKeyCol}) AS ${dim.surrogateKeyName},`);
    scripts.push(`    ${dim.naturalKeyCol},`);
    attrCols.forEach((col) => {
      scripts.push(`    ${col},`);
    });
    if (hasScdCols) {
      scripts.push(`    CURRENT_TIMESTAMP AS effective_start_date,`);
      scripts.push(`    NULL AS effective_end_date,`);
      scripts.push(`    TRUE AS is_current`);
    } else {
      // Remove trailing comma from last attr if no scd
      const lastLineIdx = scripts.length - 1;
      scripts[lastLineIdx] = scripts[lastLineIdx].replace(/,$/, '');
    }

    scripts.push(`FROM (`);
    scripts.push(`    SELECT DISTINCT`);
    scripts.push(`        ` + [dim.naturalKeyCol, ...attrCols].join(',\n        '));
    scripts.push(`    FROM ${stagingTableName}`);
    scripts.push(`    WHERE ${dim.naturalKeyCol} IS NOT NULL`);
    scripts.push(`) src_${dim.tableName};\n`);
  });

  // 2. POPULATE FACT TABLE VIA SURROGATE KEY JOINS
  const fact = result.factTable;
  scripts.push(`-- ---------------------------------------------------------`);
  scripts.push(`-- Step 2: Populate Fact Table ${fact.tableName}`);
  scripts.push(`-- Joins Staging with active Dimension rows for Surrogate Keys`);
  scripts.push(`-- ---------------------------------------------------------`);

  scripts.push(`INSERT INTO ${fact.tableName} (`);
  scripts.push(`    ` + fact.columns.join(',\n    '));
  scripts.push(`)`);
  scripts.push(`SELECT`);

  const selectLines: string[] = [];

  fact.columns.forEach((col) => {
    // Check if column is a surrogate key from a dimension
    const matchingDim = result.dimensions.find((d) => d.surrogateKeyName === col);
    if (matchingDim) {
      const dimAlias = `d_${matchingDim.tableName.replace(/^dim_/, '')}`;
      selectLines.push(`    COALESCE(${dimAlias}.${matchingDim.surrogateKeyName}, -1) AS ${col}`);
    } else {
      // Comes directly from staging
      selectLines.push(`    stg.${col} AS ${col}`);
    }
  });

  scripts.push(selectLines.join(',\n'));
  scripts.push(`FROM ${stagingTableName} stg`);

  // Left Joins to Dimensions
  result.dimensions.forEach((dim) => {
    if (fact.columns.includes(dim.surrogateKeyName)) {
      const dimAlias = `d_${dim.tableName.replace(/^dim_/, '')}`;
      const hasIsCurrent = dim.columns.includes('is_current');
      const scdFilter = hasIsCurrent ? ` AND ${dimAlias}.is_current = TRUE` : '';
      scripts.push(
        `LEFT JOIN ${dim.tableName} ${dimAlias}\n    ON stg.${dim.naturalKeyCol} = ${dimAlias}.${dim.naturalKeyCol}${scdFilter}`
      );
    }
  });

  scripts.push(`;\n`);

  return scripts.join('\n');
}

/**
 * Generates INSERT INTO ... VALUES statements containing actual transformed data
 */
export function generateInsertValuesDml(
  result: StarSchemaBuildResult,
  maxRowsPerTable = 100
): string {
  const scripts: string[] = [];

  scripts.push(`-- =========================================================`);
  scripts.push(`-- STAR SCHEMA DML: INSERT INTO ... VALUES`);
  scripts.push(`-- Direct row data insertion for test and validation`);
  scripts.push(`-- =========================================================\n`);

  // 1. Dimensions Inserts
  result.dimensions.forEach((dim) => {
    scripts.push(`-- Data for Dimension: ${dim.tableName} (${Math.min(dim.rows.length, maxRowsPerTable)} rows)`);
    const rowsToInsert = dim.rows.slice(0, maxRowsPerTable);
    if (rowsToInsert.length === 0) return;

    scripts.push(`INSERT INTO ${dim.tableName} (${dim.columns.join(', ')}) VALUES`);

    const valueRows = rowsToInsert.map((row) => {
      const vals = dim.columns.map((c) => escapeSqlValue(row[c]));
      return `  (${vals.join(', ')})`;
    });

    scripts.push(valueRows.join(',\n') + ';\n');
  });

  // 2. Fact Table Inserts
  const fact = result.factTable;
  scripts.push(`-- Data for Fact: ${fact.tableName} (${Math.min(fact.rows.length, maxRowsPerTable)} rows)`);
  const factRowsToInsert = fact.rows.slice(0, maxRowsPerTable);
  if (factRowsToInsert.length > 0) {
    scripts.push(`INSERT INTO ${fact.tableName} (${fact.columns.join(', ')}) VALUES`);

    const valueRows = factRowsToInsert.map((row) => {
      const vals = fact.columns.map((c) => escapeSqlValue(row[c]));
      return `  (${vals.join(', ')})`;
    });

    scripts.push(valueRows.join(',\n') + ';\n');
  }

  return scripts.join('\n');
}

/**
 * Generates analytical SELECT queries demonstrating Star Join BI Reporting
 */
export function generateAnalyticalSelectQueries(result: StarSchemaBuildResult): string {
  const scripts: string[] = [];
  const fact = result.factTable;

  scripts.push(`-- =========================================================`);
  scripts.push(`-- STAR SCHEMA ANALYTICAL QUERIES (SELECT)`);
  scripts.push(`-- High-performance multidimensional aggregation queries`);
  scripts.push(`-- =========================================================\n`);

  // Find numerical measure columns in fact table
  const measureCols = fact.columns.filter((c) => {
    const isSk = result.dimensions.some((d) => d.surrogateKeyName === c);
    if (isSk) return false;
    const vals = fact.rows.map((r) => r[c]);
    const inferred = inferDataType(vals);
    return inferred === 'FLOAT' || inferred === 'INTEGER';
  });

  const primaryMeasure = measureCols[0] || 'quantity';
  const secondaryMeasure = measureCols[1] || measureCols[0];

  // 1. Single Dimension Aggregation (First dimension)
  if (result.dimensions.length > 0) {
    const dim1 = result.dimensions[0];
    const dim1Alias = `d1`;
    const attrCols = dim1.columns.filter(
      (c) =>
        c !== dim1.surrogateKeyName &&
        c !== dim1.naturalKeyCol &&
        c !== 'effective_start_date' &&
        c !== 'effective_end_date' &&
        c !== 'is_current'
    );
    const primaryAttr = attrCols[0] || dim1.naturalKeyCol;

    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`-- Query 1: Aggregation by ${dim1.tableName} (${primaryAttr})`);
    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`SELECT`);
    scripts.push(`    ${dim1Alias}.${primaryAttr},`);
    scripts.push(`    COUNT(*) AS transaction_count,`);
    if (primaryMeasure) {
      scripts.push(`    SUM(f.${primaryMeasure}) AS total_${primaryMeasure},`);
      scripts.push(`    ROUND(AVG(f.${primaryMeasure}), 2) AS avg_${primaryMeasure}`);
    }
    scripts.push(`FROM ${fact.tableName} f`);
    scripts.push(`JOIN ${dim1.tableName} ${dim1Alias}`);
    scripts.push(`    ON f.${dim1.surrogateKeyName} = ${dim1Alias}.${dim1.surrogateKeyName}`);
    if (dim1.columns.includes('is_current')) {
      scripts.push(`WHERE ${dim1Alias}.is_current = TRUE`);
    }
    scripts.push(`GROUP BY ${dim1Alias}.${primaryAttr}`);
    if (primaryMeasure) {
      scripts.push(`ORDER BY total_${primaryMeasure} DESC`);
    } else {
      scripts.push(`ORDER BY transaction_count DESC`);
    }
    scripts.push(`LIMIT 20;\n`);
  }

  // 2. Multi-Dimension Star Join (if 2+ dimensions)
  if (result.dimensions.length >= 2) {
    const dim1 = result.dimensions[0];
    const dim2 = result.dimensions[1];
    const attr1 = dim1.columns.find((c) => c.includes('name') || c.includes('city') || c.includes('category')) || dim1.naturalKeyCol;
    const attr2 = dim2.columns.find((c) => c.includes('name') || c.includes('category') || c.includes('type')) || dim2.naturalKeyCol;

    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`-- Query 2: Multi-Dimension Slice & Dice (${dim1.tableName} x ${dim2.tableName})`);
    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`SELECT`);
    scripts.push(`    d1.${attr1} AS ${dim1.tableName}_attr,`);
    scripts.push(`    d2.${attr2} AS ${dim2.tableName}_attr,`);
    scripts.push(`    COUNT(*) AS total_records,`);
    if (primaryMeasure) {
      scripts.push(`    SUM(f.${primaryMeasure}) AS sum_${primaryMeasure},`);
    }
    if (secondaryMeasure && secondaryMeasure !== primaryMeasure) {
      scripts.push(`    SUM(f.${secondaryMeasure}) AS sum_${secondaryMeasure}`);
    } else {
      const lastLine = scripts[scripts.length - 1];
      scripts[scripts.length - 1] = lastLine.replace(/,$/, '');
    }
    scripts.push(`FROM ${fact.tableName} f`);
    scripts.push(`JOIN ${dim1.tableName} d1 ON f.${dim1.surrogateKeyName} = d1.${dim1.surrogateKeyName}`);
    scripts.push(`JOIN ${dim2.tableName} d2 ON f.${dim2.surrogateKeyName} = d2.${dim2.surrogateKeyName}`);
    scripts.push(`WHERE 1=1`);
    if (dim1.columns.includes('is_current')) scripts.push(`  AND d1.is_current = TRUE`);
    if (dim2.columns.includes('is_current')) scripts.push(`  AND d2.is_current = TRUE`);
    scripts.push(`GROUP BY d1.${attr1}, d2.${attr2}`);
    scripts.push(`ORDER BY total_records DESC`);
    scripts.push(`LIMIT 25;\n`);
  }

  // 3. SCD Type 2 Audit Query (Historical versions)
  const scdDim = result.dimensions.find((d) => d.columns.includes('is_current'));
  if (scdDim) {
    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`-- Query 3: SCD Type 2 Historical Audit on ${scdDim.tableName}`);
    scripts.push(`-- Audits active vs. expired dimension versions`);
    scripts.push(`-- ---------------------------------------------------------`);
    scripts.push(`SELECT`);
    scripts.push(`    ${scdDim.naturalKeyCol},`);
    scripts.push(`    ${scdDim.surrogateKeyName},`);
    scripts.push(`    effective_start_date,`);
    scripts.push(`    effective_end_date,`);
    scripts.push(`    is_current,`);
    scripts.push(`    CASE WHEN is_current = TRUE THEN 'ACTIVE' ELSE 'EXPIRED (HISTORICAL)' END AS scd_status`);
    scripts.push(`FROM ${scdDim.tableName}`);
    scripts.push(`ORDER BY ${scdDim.naturalKeyCol}, effective_start_date DESC;\n`);
  }

  return scripts.join('\n');
}

/**
 * Generates a unified, complete all-in-one script containing:
 * 1. Staging table create & load
 * 2. Star Schema DDL (CREATE TABLE)
 * 3. ETL Pipeline (INSERT INTO ... SELECT)
 * 4. Sample Verification (SELECT Queries)
 */
export function generateFullPipelineScript(
  result: StarSchemaBuildResult,
  stagingTableName = 'raw_staging',
  columnConfigs: ColumnRoleConfig[] = [],
  dialect: SqlDialect = 'standard'
): string {
  const parts: string[] = [];

  parts.push(`/* =========================================================================`);
  parts.push(`   STAR SCHEMA & SCD ETL PIPELINE SCRIPT`);
  parts.push(`   Target Dialect: ${dialect.toUpperCase()}`);
  parts.push(`   Generated at: ${new Date().toISOString()}`);
  parts.push(`   Summary:`);
  parts.push(`     - Dimensions: ${result.dimensions.map((d) => d.tableName).join(', ')}`);
  parts.push(`     - Fact Table: ${result.factTable.tableName}`);
  parts.push(`     - Total Fact Rows: ${result.factTable.rows.length}`);
  parts.push(`   ========================================================================= */\n`);

  parts.push(generateCreateTableDdl(result, dialect));
  parts.push(`\n`);
  parts.push(generateInsertSelectEtl(result, stagingTableName, columnConfigs));
  parts.push(`\n`);
  parts.push(generateAnalyticalSelectQueries(result));

  return parts.join('\n');
}
