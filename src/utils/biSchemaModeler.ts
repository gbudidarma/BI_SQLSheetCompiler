/**
 * biSchemaModeler.ts
 * Generates and models both Star Schema and Snowflake Schema representations:
 * - Star Schema: Central Fact + Denormalized Dimension tables (1-Hop Joins)
 * - Snowflake Schema: Central Fact + Normalized hierarchical Sub-Dimension satellites (Multi-Hop Joins)
 * - Structural analysis, relationship graphs, and SQL query comparisons.
 */

import {
  GeneratedDimension,
  GeneratedFactTable,
  StarSchemaBuildResult,
} from '../types';

export type SchemaArchitectureType = 'star' | 'snowflake';

export interface NormalizedSubDimension {
  id: string;
  tableName: string; // e.g., 'dim_geography'
  parentDimensionId: string;
  parentTableName: string;
  surrogateKeyName: string; // e.g., 'geography_sk'
  foreignKeyInParent: string; // e.g., 'geography_sk'
  attributeCols: string[]; // e.g., ['customer_city', 'customer_state', 'customer_country']
  category: 'geography' | 'category' | 'supplier' | 'segment' | 'calendar' | 'lookup';
  description: string;
}

export interface SchemaRelationshipLink {
  id: string;
  fromTable: string;
  fromKey: string;
  toTable: string;
  toKey: string;
  cardinality: '1:N' | 'N:1';
  type: 'fact_to_dim' | 'dim_to_subdim';
  label: string;
}

export interface SnowflakeSchemaModel {
  factTable: GeneratedFactTable;
  primaryDimensions: GeneratedDimension[];
  subDimensions: NormalizedSubDimension[];
  relationships: SchemaRelationshipLink[];
  starQuery: string;
  snowflakeQuery: string;
  metrics: {
    starTableCount: number;
    snowflakeTableCount: number;
    starJoinCount: number;
    snowflakeJoinCount: number;
    starAvgRowWidth: number;
    snowflakeAvgRowWidth: number;
    redundancyReductionPct: number;
    storageSavingsEstimatePct: number;
  };
}

/**
 * Derives a normalized Snowflake dimensional model from a Star Schema
 */
export function deriveSnowflakeModel(starResult: StarSchemaBuildResult): SnowflakeSchemaModel {
  const fact = starResult.factTable;
  const primaryDims = starResult.dimensions;
  const subDims: NormalizedSubDimension[] = [];
  const relationships: SchemaRelationshipLink[] = [];

  // 1. FACT TO PRIMARY DIMENSION LINKS (Used in both Star and Snowflake)
  primaryDims.forEach((dim) => {
    if (fact.columns.includes(dim.surrogateKeyName)) {
      relationships.push({
        id: `rel_${fact.tableName}_to_${dim.tableName}`,
        fromTable: fact.tableName,
        fromKey: dim.surrogateKeyName,
        toTable: dim.tableName,
        toKey: dim.surrogateKeyName,
        cardinality: 'N:1',
        type: 'fact_to_dim',
        label: `FK (${dim.surrogateKeyName})`,
      });
    }
  });

  // 2. DETECT SUB-DIMENSIONS FROM PRIMARY DIMENSION ATTRIBUTES
  primaryDims.forEach((dim) => {
    const rawAttrs = dim.columns.filter(
      (c) =>
        c !== dim.surrogateKeyName &&
        c !== dim.naturalKeyCol &&
        c !== 'effective_start_date' &&
        c !== 'effective_end_date' &&
        c !== 'is_current'
    );

    const handledCols = new Set<string>();

    // A. Check for Geography attributes
    const geoCols = rawAttrs.filter((c) => {
      const lower = c.toLowerCase();
      return (
        lower.includes('city') ||
        lower.includes('state') ||
        lower.includes('country') ||
        lower.includes('region') ||
        lower.includes('zip') ||
        lower.includes('postal') ||
        lower.includes('province')
      );
    });

    if (geoCols.length >= 1) {
      geoCols.forEach((c) => handledCols.add(c));
      const subId = `sub_${dim.tableName}_geography`;
      subDims.push({
        id: subId,
        tableName: `${dim.tableName}_geography`,
        parentDimensionId: dim.id,
        parentTableName: dim.tableName,
        surrogateKeyName: 'geography_sk',
        foreignKeyInParent: 'geography_sk',
        attributeCols: geoCols,
        category: 'geography',
        description: 'Normalized spatial hierarchy (City → State → Country) in 3NF.',
      });

      relationships.push({
        id: `rel_${dim.tableName}_to_geo`,
        fromTable: dim.tableName,
        fromKey: 'geography_sk',
        toTable: `${dim.tableName}_geography`,
        toKey: 'geography_sk',
        cardinality: 'N:1',
        type: 'dim_to_subdim',
        label: 'Hierarchical 3NF (geography_sk)',
      });
    }

    // B. Check for Category / Taxonomy attributes
    const catCols = rawAttrs.filter((c) => {
      if (handledCols.has(c)) return false;
      const lower = c.toLowerCase();
      return (
        lower.includes('category') ||
        lower.includes('dept') ||
        lower.includes('department') ||
        lower.includes('family') ||
        lower.includes('group') ||
        lower.includes('subcategory') ||
        lower.includes('sub_category')
      );
    });

    if (catCols.length >= 1) {
      catCols.forEach((c) => handledCols.add(c));
      const subId = `sub_${dim.tableName}_category`;
      subDims.push({
        id: subId,
        tableName: `${dim.tableName}_category`,
        parentDimensionId: dim.id,
        parentTableName: dim.tableName,
        surrogateKeyName: 'category_sk',
        foreignKeyInParent: 'category_sk',
        attributeCols: catCols,
        category: 'category',
        description: 'Normalized catalog taxonomy (Subcategory → Category → Department).',
      });

      relationships.push({
        id: `rel_${dim.tableName}_to_cat`,
        fromTable: dim.tableName,
        fromKey: 'category_sk',
        toTable: `${dim.tableName}_category`,
        toKey: 'category_sk',
        cardinality: 'N:1',
        type: 'dim_to_subdim',
        label: 'Hierarchical 3NF (category_sk)',
      });
    }

    // C. Check for Supplier / Brand / Origin attributes
    const supplierCols = rawAttrs.filter((c) => {
      if (handledCols.has(c)) return false;
      const lower = c.toLowerCase();
      return (
        lower.includes('supplier') ||
        lower.includes('vendor') ||
        lower.includes('brand') ||
        lower.includes('manufacturer') ||
        lower.includes('origin')
      );
    });

    if (supplierCols.length >= 1) {
      supplierCols.forEach((c) => handledCols.add(c));
      const subId = `sub_${dim.tableName}_supplier`;
      subDims.push({
        id: subId,
        tableName: `${dim.tableName}_supplier`,
        parentDimensionId: dim.id,
        parentTableName: dim.tableName,
        surrogateKeyName: 'supplier_sk',
        foreignKeyInParent: 'supplier_sk',
        attributeCols: supplierCols,
        category: 'supplier',
        description: 'Normalized merchant & brand satellite lookup entity.',
      });

      relationships.push({
        id: `rel_${dim.tableName}_to_sup`,
        fromTable: dim.tableName,
        fromKey: 'supplier_sk',
        toTable: `${dim.tableName}_supplier`,
        toKey: 'supplier_sk',
        cardinality: 'N:1',
        type: 'dim_to_subdim',
        label: 'Hierarchical 3NF (supplier_sk)',
      });
    }

    // D. Check for Segment / Tier attributes
    const segmentCols = rawAttrs.filter((c) => {
      if (handledCols.has(c)) return false;
      const lower = c.toLowerCase();
      return (
        lower.includes('segment') ||
        lower.includes('tier') ||
        lower.includes('status') ||
        lower.includes('membership') ||
        lower.includes('rating') ||
        lower.includes('grade')
      );
    });

    if (segmentCols.length >= 1) {
      segmentCols.forEach((c) => handledCols.add(c));
      const subId = `sub_${dim.tableName}_segment`;
      subDims.push({
        id: subId,
        tableName: `${dim.tableName}_tier_segment`,
        parentDimensionId: dim.id,
        parentTableName: dim.tableName,
        surrogateKeyName: 'segment_sk',
        foreignKeyInParent: 'segment_sk',
        attributeCols: segmentCols,
        category: 'segment',
        description: 'Normalized classification & segment tier lookup entity.',
      });

      relationships.push({
        id: `rel_${dim.tableName}_to_seg`,
        fromTable: dim.tableName,
        fromKey: 'segment_sk',
        toTable: `${dim.tableName}_tier_segment`,
        toKey: 'segment_sk',
        cardinality: 'N:1',
        type: 'dim_to_subdim',
        label: 'Hierarchical 3NF (segment_sk)',
      });
    }

    // E. Fallback: If dimension has 3+ remaining attributes, normalize the last 2 into a sub-dimension
    const remainingAttrs = rawAttrs.filter((c) => !handledCols.has(c));
    if (subDims.filter((s) => s.parentDimensionId === dim.id).length === 0 && remainingAttrs.length >= 2) {
      const splitAttrs = remainingAttrs.slice(-2);
      const subTableName = `${dim.tableName}_details`;
      const skName = `${dim.tableName.replace(/^dim_/, '')}_detail_sk`;

      subDims.push({
        id: `sub_${dim.tableName}_details`,
        tableName: subTableName,
        parentDimensionId: dim.id,
        parentTableName: dim.tableName,
        surrogateKeyName: skName,
        foreignKeyInParent: skName,
        attributeCols: splitAttrs,
        category: 'lookup',
        description: 'Normalized secondary attribute lookup entity in 3NF.',
      });

      relationships.push({
        id: `rel_${dim.tableName}_to_details`,
        fromTable: dim.tableName,
        fromKey: skName,
        toTable: subTableName,
        toKey: skName,
        cardinality: 'N:1',
        type: 'dim_to_subdim',
        label: `Hierarchical 3NF (${skName})`,
      });
    }
  });

  // If no sub-dimensions were detected at all (e.g. minimal dimensions), create at least one synthetic sub-dimension
  // so the user can experience the true difference of Snowflake Schema
  if (subDims.length === 0 && primaryDims.length > 0) {
    const firstDim = primaryDims[0];
    const subName = `${firstDim.tableName}_type_lookup`;
    subDims.push({
      id: `sub_${firstDim.id}_synthetic`,
      tableName: subName,
      parentDimensionId: firstDim.id,
      parentTableName: firstDim.tableName,
      surrogateKeyName: 'lookup_sk',
      foreignKeyInParent: 'lookup_sk',
      attributeCols: ['entity_classification', 'tax_group', 'active_flag'],
      category: 'lookup',
      description: 'Normalized lookup satellite (3NF Snowflake decomposition).',
    });

    relationships.push({
      id: `rel_${firstDim.tableName}_synthetic`,
      fromTable: firstDim.tableName,
      fromKey: 'lookup_sk',
      toTable: subName,
      toKey: 'lookup_sk',
      cardinality: 'N:1',
      type: 'dim_to_subdim',
      label: 'Hierarchical 3NF (lookup_sk)',
    });
  }

  // 3. GENERATE SQL COMPARISONS
  // Measure column in fact table
  const measureCol =
    fact.columns.find((c) => {
      const lower = c.toLowerCase();
      return (
        !c.endsWith('_sk') &&
        (lower.includes('amount') ||
          lower.includes('total') ||
          lower.includes('revenue') ||
          lower.includes('price') ||
          lower.includes('quantity') ||
          lower.includes('qty'))
      );
    }) || fact.columns.find((c) => !c.endsWith('_sk')) || 'quantity';

  // Star SQL: 1 join per dimension
  const starJoinClauses = primaryDims.map((d, i) => {
    const alias = `d${i + 1}`;
    return `JOIN ${d.tableName} ${alias} ON f.${d.surrogateKeyName} = ${alias}.${d.surrogateKeyName}`;
  });

  const starSelectDims = primaryDims.map((d, i) => {
    const alias = `d${i + 1}`;
    const firstAttr = d.columns.find(
      (c) =>
        c !== d.surrogateKeyName &&
        c !== d.naturalKeyCol &&
        c !== 'effective_start_date' &&
        c !== 'effective_end_date' &&
        c !== 'is_current'
    ) || d.naturalKeyCol;
    return `    ${alias}.${firstAttr} AS ${d.tableName}_${firstAttr}`;
  });

  const starQuery = `-- ⭐ STAR SCHEMA QUERY (1-HOP DIRECT JOINS)
-- Maximum performance for BI dashboards & OLAP cubes
SELECT
${starSelectDims.join(',\n')},
    COUNT(*) AS total_transactions,
    ROUND(SUM(f.${measureCol}), 2) AS total_${measureCol}
FROM ${fact.tableName} f
${starJoinClauses.join('\n')}
GROUP BY
${primaryDims.map((_, i) => `    d${i + 1}.${primaryDims[i].columns.find((c) => c !== primaryDims[i].surrogateKeyName && c !== primaryDims[i].naturalKeyCol) || primaryDims[i].naturalKeyCol}`).join(',\n')}
ORDER BY total_${measureCol} DESC
LIMIT 20;`;

  // Snowflake SQL: Cascading multi-hop joins
  const snowflakeSelectItems: string[] = [];
  const snowflakeJoins: string[] = [];
  const snowflakeGroupBy: string[] = [];

  primaryDims.forEach((d, i) => {
    const pAlias = `p${i + 1}`;
    snowflakeJoins.push(`JOIN ${d.tableName} ${pAlias} ON f.${d.surrogateKeyName} = ${pAlias}.${d.surrogateKeyName}`);

    // Check if dimension has sub-dimensions
    const attachedSubDims = subDims.filter((s) => s.parentDimensionId === d.id);
    if (attachedSubDims.length > 0) {
      attachedSubDims.forEach((s, sIdx) => {
        const subAlias = `s${i + 1}_${sIdx + 1}`;
        snowflakeJoins.push(`  JOIN ${s.tableName} ${subAlias} ON ${pAlias}.${s.foreignKeyInParent} = ${subAlias}.${s.surrogateKeyName}`);
        const attr = s.attributeCols[0] || 'attribute_val';
        snowflakeSelectItems.push(`    ${subAlias}.${attr} AS ${s.tableName}_${attr}`);
        snowflakeGroupBy.push(`    ${subAlias}.${attr}`);
      });
    } else {
      const attr = d.columns.find((c) => c !== d.surrogateKeyName && c !== d.naturalKeyCol) || d.naturalKeyCol;
      snowflakeSelectItems.push(`    ${pAlias}.${attr} AS ${d.tableName}_${attr}`);
      snowflakeGroupBy.push(`    ${pAlias}.${attr}`);
    }
  });

  const snowflakeQuery = `-- ❄️ SNOWFLAKE SCHEMA QUERY (MULTI-HOP NORMALIZED 3NF JOINS)
-- Eliminates attribute redundancy across sub-dimension entities
SELECT
${snowflakeSelectItems.join(',\n')},
    COUNT(*) AS total_transactions,
    ROUND(SUM(f.${measureCol}), 2) AS total_${measureCol}
FROM ${fact.tableName} f
${snowflakeJoins.join('\n')}
GROUP BY
${snowflakeGroupBy.join(',\n')}
ORDER BY total_${measureCol} DESC
LIMIT 20;`;

  // 4. METRICS & ARCHITECTURAL COMPARISON CALCULATIONS
  const starTableCount = 1 + primaryDims.length;
  const snowflakeTableCount = 1 + primaryDims.length + subDims.length;
  const starJoinCount = primaryDims.length;
  const snowflakeJoinCount = primaryDims.length + subDims.length;

  const starAvgRowWidth = Math.round(
    primaryDims.reduce((acc, d) => acc + d.columns.length, 0) / (primaryDims.length || 1)
  );

  const snowflakeAvgRowWidth = Math.max(3, Math.round(starAvgRowWidth * 0.6));
  const redundancyReductionPct = Math.min(85, Math.max(25, subDims.length * 28));
  const storageSavingsEstimatePct = Math.min(45, Math.max(15, subDims.length * 14));

  return {
    factTable: fact,
    primaryDimensions: primaryDims,
    subDimensions: subDims,
    relationships,
    starQuery,
    snowflakeQuery,
    metrics: {
      starTableCount,
      snowflakeTableCount,
      starJoinCount,
      snowflakeJoinCount,
      starAvgRowWidth,
      snowflakeAvgRowWidth,
      redundancyReductionPct,
      storageSavingsEstimatePct,
    },
  };
}
