/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableSchema, ColumnInfo, DataType } from '../types';

export interface SnowflakeConnectionConfig {
  id?: string;
  name?: string;
  account: string; // e.g. "xy12345.us-east-1" or "myorg-myaccount"
  warehouse: string; // e.g. "COMPUTE_WH"
  database: string; // e.g. "RETAIL_ANALYTICS"
  schema: string; // e.g. "PUBLIC"
  role: string; // e.g. "ACCOUNTADMIN" or "ANALYST"
  username: string;
  password?: string;
  token?: string; // OAuth / Programmatic Access Token (PAT) for direct REST API
  bridgeUrl?: string; // Default: 'http://localhost:54321' or remote cloud gateway
  mode: 'direct_rest' | 'bridge' | 'demo';
}

export interface SnowflakeDiscoveredTable {
  name: string;
  schema: string;
  rowCount: number;
  columnCount: number;
  sizeBytes?: number;
  columns?: { name: string; type: string }[];
}

export interface SnowflakeTestResult {
  success: boolean;
  latencyMs: number;
  version?: string;
  account?: string;
  warehouse?: string;
  database?: string;
  error?: string;
}

export interface SnowflakeDemoProfile {
  id: string;
  title: string;
  account: string;
  warehouse: string;
  database: string;
  schema: string;
  description: string;
  tables: string[];
}

export const DEMO_SNOWFLAKE_PROFILES: SnowflakeDemoProfile[] = [
  {
    id: 'snowflake_retail_dw',
    title: 'Snowflake: Retail Enterprise Data Cloud',
    account: 'xy98765.us-east-1',
    warehouse: 'COMPUTE_WH',
    database: 'RETAIL_DW',
    schema: 'ANALYTICS',
    description: 'Columnar analytical warehouse: Orders Fact, Customer 360, and Store Hierarchy',
    tables: ['snowflake_orders_fact', 'snowflake_dim_customer', 'snowflake_dim_store'],
  },
  {
    id: 'snowflake_saas_telemetry',
    title: 'Snowflake: Product Telemetry & DAU Cloud',
    account: 'saas-cloud.eu-west-1',
    warehouse: 'ANALYST_WH',
    database: 'TELEMETRY_DB',
    schema: 'PUBLIC',
    description: 'High-velocity time-series product analytics: Daily Active Users, Feature Flags, and Churn',
    tables: ['snowflake_daily_active_users', 'snowflake_feature_usage', 'snowflake_plan_conversions'],
  },
];

export function getSnowflakeDemoDataset(profileId: string): Record<string, any[]> {
  if (profileId === 'snowflake_saas_telemetry') {
    return {
      snowflake_daily_active_users: [
        { activity_date: '2024-04-01', platform: 'Web Browser', country: 'United States', dau_count: 14200, new_users: 1850, sessions_per_user: 3.4, avg_session_duration_sec: 420 },
        { activity_date: '2024-04-01', platform: 'iOS Mobile', country: 'United States', dau_count: 9800, new_users: 1240, sessions_per_user: 4.8, avg_session_duration_sec: 260 },
        { activity_date: '2024-04-01', platform: 'Android Mobile', country: 'United Kingdom', dau_count: 6400, new_users: 820, sessions_per_user: 3.9, avg_session_duration_sec: 290 },
        { activity_date: '2024-04-02', platform: 'Web Browser', country: 'Germany', dau_count: 8100, new_users: 940, sessions_per_user: 3.1, avg_session_duration_sec: 380 },
        { activity_date: '2024-04-02', platform: 'Web Browser', country: 'Japan', dau_count: 7300, new_users: 890, sessions_per_user: 3.6, avg_session_duration_sec: 410 },
      ],
      snowflake_feature_usage: [
        { feature_key: 'sql_autocomplete_v2', tier_required: 'PRO', monthly_invocations: 1845000, adoption_rate_pct: 78.4, error_rate_pct: 0.02 },
        { feature_key: 'erd_diagram_export', tier_required: 'FREE', monthly_invocations: 420000, adoption_rate_pct: 62.1, error_rate_pct: 0.00 },
        { feature_key: 'scd_type2_pipeline', tier_required: 'PRO', monthly_invocations: 195000, adoption_rate_pct: 34.5, error_rate_pct: 0.05 },
        { feature_key: 'holt_winters_forecast', tier_required: 'PRO', monthly_invocations: 310000, adoption_rate_pct: 46.8, error_rate_pct: 0.01 },
      ],
      snowflake_plan_conversions: [
        { cohort_month: '2024-01', trial_starts: 4200, activated_accounts: 3150, paid_conversions: 840, conversion_rate_pct: 20.0, avg_arr_usd: 1200 },
        { cohort_month: '2024-02', trial_starts: 4800, activated_accounts: 3690, paid_conversions: 1020, conversion_rate_pct: 21.25, avg_arr_usd: 1350 },
        { cohort_month: '2024-03', trial_starts: 5400, activated_accounts: 4210, paid_conversions: 1190, conversion_rate_pct: 22.04, avg_arr_usd: 1400 },
      ],
    };
  }

  // Default: snowflake_retail_dw
  return {
    snowflake_orders_fact: [
      { order_id: 9001, customer_id: 'C-101', order_date: '2024-03-01', store_id: 'STR-EAST-01', total_amount: 1450.00, discount_amount: 50.00, net_amount: 1400.00, payment_method: 'CREDIT_CARD', fulfillment_status: 'DELIVERED' },
      { order_id: 9002, customer_id: 'C-103', order_date: '2024-03-02', store_id: 'STR-WEST-02', total_amount: 890.50, discount_amount: 0.00, net_amount: 890.50, payment_method: 'APPLE_PAY', fulfillment_status: 'DELIVERED' },
      { order_id: 9003, customer_id: 'C-104', order_date: '2024-03-05', store_id: 'STR-CENT-01', total_amount: 3200.00, discount_amount: 200.00, net_amount: 3000.00, payment_method: 'WIRE_TRANSFER', fulfillment_status: 'DELIVERED' },
      { order_id: 9004, customer_id: 'C-102', order_date: '2024-03-08', store_id: 'STR-EAST-01', total_amount: 420.00, discount_amount: 0.00, net_amount: 420.00, payment_method: 'CREDIT_CARD', fulfillment_status: 'PROCESSING' },
      { order_id: 9005, customer_id: 'C-105', order_date: '2024-03-12', store_id: 'STR-SOUTH-03', total_amount: 5400.00, discount_amount: 500.00, net_amount: 4900.00, payment_method: 'CORPORATE_PO', fulfillment_status: 'SHIPPED' },
      { order_id: 9006, customer_id: 'C-106', order_date: '2024-03-15', store_id: 'STR-WEST-02', total_amount: 2150.00, discount_amount: 150.00, net_amount: 2000.00, payment_method: 'CREDIT_CARD', fulfillment_status: 'DELIVERED' },
      { order_id: 9007, customer_id: 'C-101', order_date: '2024-03-19', store_id: 'STR-EAST-01', total_amount: 980.00, discount_amount: 0.00, net_amount: 980.00, payment_method: 'CREDIT_CARD', fulfillment_status: 'DELIVERED' },
    ],
    snowflake_dim_customer: [
      { customer_id: 'C-101', customer_name: 'Helena Berg', email: 'helena.berg@nordicbi.se', loyalty_tier: 'VIP Platinum', city: 'Stockholm', country: 'Sweden', lifetime_spend: 34500.00, registered_date: '2022-04-10' },
      { customer_id: 'C-102', customer_name: 'Hiroshi Tanaka', email: 'hiroshi@tokyodata.jp', loyalty_tier: 'Gold', city: 'Tokyo', country: 'Japan', lifetime_spend: 18200.00, registered_date: '2022-08-15' },
      { customer_id: 'C-103', customer_name: 'Sarah Connor', email: 'sarah@skynetdefense.com', loyalty_tier: 'Enterprise', city: 'Los Angeles', country: 'United States', lifetime_spend: 52100.00, registered_date: '2021-11-05' },
      { customer_id: 'C-104', customer_name: 'Mateo Silva', email: 'mateo@saopaulotech.br', loyalty_tier: 'Silver', city: 'São Paulo', country: 'Brazil', lifetime_spend: 9400.00, registered_date: '2023-02-20' },
      { customer_id: 'C-105', customer_name: 'Amara Okafor', email: 'amara@lagosanalytics.ng', loyalty_tier: 'VIP Platinum', city: 'Lagos', country: 'Nigeria', lifetime_spend: 41800.00, registered_date: '2022-01-18' },
      { customer_id: 'C-106', customer_name: 'Liam Vance', email: 'liam@dublindata.ie', loyalty_tier: 'Gold', city: 'Dublin', country: 'Ireland', lifetime_spend: 15600.00, registered_date: '2023-05-30' },
    ],
    snowflake_dim_store: [
      { store_id: 'STR-EAST-01', store_name: 'Manhattan Flagship Store', region: 'North America East', store_type: 'FLAGSHIP', sqft: 18500, manager_name: 'Daniel Craig', open_year: 2018 },
      { store_id: 'STR-WEST-02', store_name: 'San Francisco Tech Hub', region: 'North America West', store_type: 'OUTLET', sqft: 12000, manager_name: 'Laura Dern', open_year: 2020 },
      { store_id: 'STR-CENT-01', store_name: 'Chicago Loop Commercial', region: 'North America Central', store_type: 'STANDARD', sqft: 14200, manager_name: 'Michael Keaton', open_year: 2019 },
      { store_id: 'STR-SOUTH-03', store_name: 'Miami Wynwood Experience', region: 'North America South', store_type: 'BOUTIQUE', sqft: 8500, manager_name: 'Salma Hayek', open_year: 2022 },
    ],
  };
}

export function inferSnowflakeColumns(rows: Record<string, any>[]): ColumnInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map((colName) => {
    let type: DataType = 'TEXT';
    let nullCount = 0;
    const values: any[] = [];

    for (const row of rows) {
      const val = row[colName];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        values.push(val);
      }
    }

    if (values.length > 0) {
      const allNumbers = values.every((v) => typeof v === 'number');
      const allInts = allNumbers && values.every((v) => Number.isInteger(v));
      const allBooleans = values.every((v) => typeof v === 'boolean');
      const allDates = values.every((v) => {
        if (typeof v !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(Date.parse(v));
      });

      if (allBooleans) type = 'BOOLEAN';
      else if (allInts) type = 'INTEGER';
      else if (allNumbers) type = 'FLOAT';
      else if (allDates) type = 'DATE';
    }

    const distinct = new Set(values).size;

    return {
      name: colName,
      originalName: colName,
      type,
      nullCount,
      distinctCount: distinct,
      sampleValues: values.slice(0, 5),
    };
  });
}

// ============================================================================
// DIRECT SNOWFLAKE SQL REST API (v2) - ZERO BRIDGE REQUIRED
// ============================================================================

export async function executeSnowflakeRestStatement(
  config: SnowflakeConnectionConfig,
  sql: string
): Promise<Record<string, any>[]> {
  const cleanAccount = config.account
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\.snowflakecomputing\.com\/?$/, '');
  const endpoint = `https://${cleanAccount}.snowflakecomputing.com/api/v2/statements`;

  const token = config.token || config.password;
  if (!token) {
    throw new Error('Snowflake REST API requires an OAuth Access Token, PAT, or JWT Bearer token.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      statement: sql,
      warehouse: config.warehouse,
      database: config.database,
      schema: config.schema,
      role: config.role || undefined,
      timeout: 45,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Snowflake REST API HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const colNames = data.resultSetMetaData?.rowType?.map((c: any) => c.name) || [];
  const rawRows: any[][] = data.data || [];

  return rawRows.map((r) => {
    const obj: Record<string, any> = {};
    colNames.forEach((col: string, idx: number) => {
      let val: any = r[idx];
      if (val !== null && val !== undefined && !isNaN(val as any) && val !== '') {
        val = Number(val);
      }
      obj[col] = val;
    });
    return obj;
  });
}

// ============================================================================
// CORE SNOWFLAKE CLIENT
// ============================================================================

export async function testSnowflakeConnection(
  config: SnowflakeConnectionConfig
): Promise<SnowflakeTestResult> {
  const startTime = performance.now();

  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 75));
    const latency = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs: latency,
      version: 'Snowflake Enterprise Edition 8.14.2 (AWS US-East)',
      account: config.account || 'xy98765.us-east-1',
      warehouse: config.warehouse || 'COMPUTE_WH',
      database: config.database || 'RETAIL_DW',
    };
  }

  // Direct Snowflake SQL REST API v2
  if (config.mode === 'direct_rest') {
    try {
      const rows = await executeSnowflakeRestStatement(
        config,
        'SELECT CURRENT_VERSION(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE(), CURRENT_DATABASE();'
      );
      const latency = Math.round(performance.now() - startTime);
      const first = rows[0] || {};

      return {
        success: true,
        latencyMs: latency,
        version: `Snowflake ${first.CURRENT_VERSION || '8.x'} (Direct REST API v2)`,
        account: first.CURRENT_ACCOUNT || config.account,
        warehouse: first.CURRENT_WAREHOUSE || config.warehouse,
        database: first.CURRENT_DATABASE || config.database,
      };
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs: latency,
        error: `Snowflake REST API Error: ${err.message}. If Snowflake blocks browser CORS, use Cloud Gateway URL or the offline SQL/CSV paste ingester.`,
      };
    }
  }

  // Bridge Mode (Local or Remote Gateway)
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${bridgeUrl}/api/snowflake/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - startTime);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        latencyMs: latency,
        error: errData.error || `HTTP ${response.status}: Failed to reach Snowflake bridge`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      latencyMs: latency,
      version: data.version || 'Snowflake Cloud Data Platform (Bridge Verified)',
      account: config.account,
      warehouse: config.warehouse,
      database: config.database,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    return {
      success: false,
      latencyMs: latency,
      error: `Could not reach database bridge at ${bridgeUrl}. Use "Direct REST API" or "SQL/CSV Paste" to connect without a local bridge.`,
    };
  }
}

export async function fetchSnowflakeTables(
  config: SnowflakeConnectionConfig
): Promise<SnowflakeDiscoveredTable[]> {
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const activeProfile =
      DEMO_SNOWFLAKE_PROFILES.find((p) => p.database === config.database) ||
      DEMO_SNOWFLAKE_PROFILES[0];
    const dataset = getSnowflakeDemoDataset(activeProfile.id);

    return Object.keys(dataset).map((tblName) => {
      const rows = dataset[tblName];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        name: tblName,
        schema: config.schema || 'ANALYTICS',
        rowCount: rows.length,
        columnCount: cols.length,
        columns: cols.map((c) => ({ name: c, type: typeof rows[0]?.[c] })),
      };
    });
  }

  // Direct REST
  if (config.mode === 'direct_rest') {
    const rows = await executeSnowflakeRestStatement(
      config,
      `SELECT TABLE_NAME, TABLE_SCHEMA, ROW_COUNT FROM "${config.database}".INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${config.schema}' ORDER BY TABLE_NAME;`
    );

    return rows.map((r) => ({
      name: r.TABLE_NAME || r.table_name,
      schema: r.TABLE_SCHEMA || r.table_schema || config.schema,
      rowCount: r.ROW_COUNT || r.row_count || 0,
      columnCount: 0,
    }));
  }

  // Bridge Mode
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');
  const response = await fetch(`${bridgeUrl}/api/snowflake/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch Snowflake tables: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.tables || [];
}

export async function importSnowflakeTable(
  config: SnowflakeConnectionConfig,
  tableName: string,
  schemaName = 'PUBLIC'
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }> {
  let rows: Record<string, any>[] = [];

  if (config.mode === 'demo') {
    const activeProfile =
      DEMO_SNOWFLAKE_PROFILES.find((p) => p.database === config.database) ||
      DEMO_SNOWFLAKE_PROFILES[0];
    const dataset = getSnowflakeDemoDataset(activeProfile.id);
    rows = dataset[tableName] || [];
  } else if (config.mode === 'direct_rest') {
    rows = await executeSnowflakeRestStatement(
      config,
      `SELECT * FROM "${config.database}"."${schemaName}"."${tableName}" LIMIT 10000;`
    );
  } else {
    const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');
    const response = await fetch(`${bridgeUrl}/api/snowflake/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        sql: `SELECT * FROM "${config.database}"."${schemaName}"."${tableName}" LIMIT 10000;`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to query Snowflake table: ${tableName}`);
    }

    const data = await response.json();
    rows = data.rows || [];
  }

  const columns = inferSnowflakeColumns(rows);

  const connectionLabel =
    config.mode === 'direct_rest'
      ? `Snowflake REST API [${config.account}:${config.warehouse}/${config.database}]`
      : config.name || `Snowflake [${config.account}:${config.warehouse}/${config.database}]`;

  const schema: TableSchema = {
    id: `snowflake_${config.database}_${tableName}`,
    name: tableName,
    sourceFileName: `Snowflake (${config.account}/${config.database})`,
    sheetName: `${schemaName}.${tableName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'snowflake',
    connectionName: connectionLabel,
  };

  return { schema, rows };
}
