export type DataType = 'INTEGER' | 'FLOAT' | 'TEXT' | 'DATE' | 'BOOLEAN';

export interface ColumnInfo {
  name: string; // sanitized SQL column name
  originalName: string; // verbatim header from row 0
  type: DataType;
  nullCount: number;
  distinctCount: number;
  sampleValues: any[];
}

export interface TableSchema {
  id: string;
  name: string; // SQL table name (e.g., 'orders', 'sales_data')
  sourceFileName: string;
  sheetName: string;
  rowCount: number;
  columns: ColumnInfo[];
  previewRows: Record<string, any>[];
  allRows?: Record<string, any>[];
  sourceType?: 'excel' | 'postgres';
  connectionName?: string;
}

export interface PlanStep {
  step: number;
  phase: 'PARSE' | 'SCAN' | 'FILTER' | 'JOIN' | 'GROUP' | 'SORT' | 'PROJECT';
  title: string;
  detail: string;
  costEstimate?: string;
}

export interface QueryPlan {
  statementType: string;
  tablesReferenced: string[];
  columnsProjected: string[];
  hasWhere: boolean;
  hasJoin: boolean;
  hasGroupBy: boolean;
  hasOrderBy: boolean;
  hasLimit: boolean;
  limitCount?: number;
  steps: PlanStep[];
}

export interface QueryResult {
  query: string;
  success: boolean;
  data: Record<string, any>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  errorLocation?: { line?: number; column?: number; token?: string };
  errorCategory?: 'syntax' | 'table_not_found' | 'column_not_found' | 'type_mismatch' | 'runtime' | 'zero_rows_warning';
  suggestion?: string;
  autoFix?: { from: string; to: string; description: string };
  warning?: string;
  plan?: QueryPlan;
  affectedRows?: number;
  isCommand?: boolean;
  timestamp: number;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  success: boolean;
  executionTimeMs: number;
  rowCount: number;
  error?: string;
}

export interface SampleDataset {
  id: string;
  title: string;
  description: string;
  badge: string;
  tables: {
    sheetName: string;
    tableName: string;
    data: Record<string, any>[];
  }[];
  starterQueries: {
    title: string;
    sql: string;
    description: string;
  }[];
}

// Data Modeler Types
export type JoinType = 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | 'FULL JOIN' | 'CROSS JOIN';
export type JoinOperator = '=' | '<' | '>' | '<=' | '>=' | '<>';

export interface TableNodePos {
  tableName: string;
  x: number;
  y: number;
  selectedColumns: string[]; // columns chosen for SELECT projection
  color?: string;
  isCollapsed?: boolean;
}

export interface JoinRelationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  joinType: JoinType;
  operator: JoinOperator;
}

export interface ModelFilter {
  id: string;
  tableName: string;
  columnName: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
  value: string;
}

export interface ModelOrderBy {
  tableName: string;
  columnName: string;
  direction: 'ASC' | 'DESC';
}

// Schema & Data Comparator Types
export interface SchemaDiffColumn {
  name: string;
  inTableA: boolean;
  inTableB: boolean;
  typeA?: DataType;
  typeB?: DataType;
  nullCountA?: number;
  nullCountB?: number;
  distinctA?: number;
  distinctB?: number;
}

export interface SchemaDiffResult {
  tableAName: string;
  tableBName: string;
  matchRate: number; // percentage (0-100)
  columns: SchemaDiffColumn[];
  onlyInA: string[];
  onlyInB: string[];
  typeMismatches: { column: string; typeA: DataType; typeB: DataType }[];
}

export interface DataDiffRow {
  key: string;
  status: 'identical' | 'modified' | 'only_a' | 'only_b';
  valuesA?: Record<string, any>;
  valuesB?: Record<string, any>;
  changedColumns?: string[];
}

export interface DataDiffResult {
  tableAName: string;
  tableBName: string;
  keyColumn: string;
  totalRowsA: number;
  totalRowsB: number;
  identicalCount: number;
  modifiedCount: number;
  onlyInACount: number;
  onlyInBCount: number;
  matchPercentage: number;
  diffRows: DataDiffRow[];
  reconciliationSql: string;
}

// ==========================================
// CSV Star Schema & SCD Builder Types
// ==========================================

export type ColumnRole =
  | 'fact_measure'
  | 'dimension_attr'
  | 'natural_key'
  | 'degenerate_key'
  | 'date_key'
  | 'ignore';

export interface ColumnRoleConfig {
  name: string;
  role: ColumnRole;
  type: DataType;
  uniqueCount: number;
  nullCount: number;
  samples: any[];
}

export type SurrogateKeyFormat = 'auto_increment' | 'hash';

export interface DimensionConfig {
  id: string;
  tableName: string; // e.g., 'dim_customer'
  naturalKeyCol: string; // e.g., 'customer_code'
  attributeCols: string[]; // e.g., ['customer_name', 'customer_city']
  surrogateKeyName: string; // e.g., 'customer_sk'
  surrogateKeyFormat: SurrogateKeyFormat;
  scdMode: 'initial' | 'incremental';
  scdType: 1 | 2;
  existingCsvRows?: Record<string, any>[];
  existingCsvFileName?: string;
}

export type ScdRowStatus = 'added' | 'updated' | 'expired' | 'unchanged';

export interface GeneratedDimension {
  id: string;
  tableName: string;
  naturalKeyCol: string;
  surrogateKeyName: string;
  columns: string[];
  rows: Record<string, any>[];
  rowStatuses?: Record<string | number, ScdRowStatus>;
  stats: {
    total: number;
    added: number;
    updated: number;
    expired: number;
    unchanged: number;
  };
}

export interface GeneratedFactTable {
  tableName: string;
  columns: string[];
  rows: Record<string, any>[];
  stats: {
    inputRows: number;
    factRows: number;
    columnReduction: number;
    unmatchedLookups: number;
  };
}

export interface StarSchemaBuildResult {
  dimensions: GeneratedDimension[];
  factTable: GeneratedFactTable;
}

// -------------------------------------------------------------
// DATA MART BI TYPES
// -------------------------------------------------------------

export type DataMartAggregation = 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';

export type DataMartDateGrain = 'none' | 'year' | 'quarter' | 'month' | 'day';

export interface DataMartDimensionConfig {
  id: string;
  table: string;
  column: string;
  alias?: string;
  dateGrain?: DataMartDateGrain;
}

export interface DataMartMeasureConfig {
  id: string;
  table: string;
  column: string;
  aggregation: DataMartAggregation;
  alias: string;
}

export interface DataMartFilterConfig {
  id: string;
  table: string;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IS NOT NULL';
  value: string;
}

export interface DataMartHavingConfig {
  id: string;
  measureAlias: string;
  operator: '>' | '<' | '>=' | '<=' | '=';
  value: number;
}

export interface DataMartJoinConfig {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  joinType: 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN';
}

export interface DataMartSortConfig {
  columnOrAlias: string;
  direction: 'ASC' | 'DESC';
}

export interface DataMartModel {
  name: string;
  description?: string;
  primaryTable: string;
  joins: DataMartJoinConfig[];
  dimensions: DataMartDimensionConfig[];
  measures: DataMartMeasureConfig[];
  filters: DataMartFilterConfig[];
  havings: DataMartHavingConfig[];
  sort?: DataMartSortConfig;
  limit?: number;
}

export interface AutoMartSuggestion {
  id: string;
  name: string;
  badge: string;
  description: string;
  category: 'sales' | 'customer' | 'product' | 'financial' | 'executive' | 'star_schema';
  model: DataMartModel;
  recommendedReason: string;
}

