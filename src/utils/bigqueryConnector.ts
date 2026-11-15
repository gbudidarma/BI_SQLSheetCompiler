/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableSchema, ColumnInfo, DataType } from '../types';

export interface BigQueryConnectionConfig {
  id?: string;
  name?: string;
  projectId: string; // e.g. "gcp-enterprise-analytics-2024"
  datasetId: string; // e.g. "ga4_ecommerce"
  location: string; // e.g. "US", "EU", "asia-southeast1"
  serviceAccountKeyJson?: string;
  apiKey?: string;
  bridgeUrl?: string; // Default: 'http://localhost:54321'
  mode: 'bridge' | 'demo';
}

export interface BigQueryDiscoveredTable {
  name: string;
  dataset: string;
  rowCount: number;
  columnCount: number;
  sizeBytes?: number;
  columns?: { name: string; type: string }[];
}

export interface BigQueryTestResult {
  success: boolean;
  latencyMs: number;
  version?: string;
  projectId?: string;
  datasetId?: string;
  location?: string;
  error?: string;
}

export interface BigQueryDemoProfile {
  id: string;
  title: string;
  projectId: string;
  datasetId: string;
  location: string;
  description: string;
  tables: string[];
}

export const BIGQUERY_LOCATIONS = [
  { value: 'US', label: 'United States Multi-Region (US)' },
  { value: 'EU', label: 'European Union Multi-Region (EU)' },
  { value: 'us-central1', label: 'Iowa (us-central1)' },
  { value: 'us-east1', label: 'South Carolina (us-east1)' },
  { value: 'europe-west1', label: 'Belgium (europe-west1)' },
  { value: 'asia-southeast1', label: 'Singapore (asia-southeast1)' },
  { value: 'asia-northeast1', label: 'Tokyo (asia-northeast1)' },
  { value: 'australia-southeast1', label: 'Sydney (australia-southeast1)' },
];

export const DEMO_BIGQUERY_PROFILES: BigQueryDemoProfile[] = [
  {
    id: 'bigquery_ga4_web',
    title: 'Google BigQuery: GA4 E-Commerce Clickstream',
    projectId: 'bigquery-public-data',
    datasetId: 'ga4_obfuscated_sample_ecommerce',
    location: 'US',
    description: 'Petabyte-scale clickstream event logs: User Journeys, Traffic Sources, and Conversions',
    tables: ['bigquery_ga4_events', 'bigquery_traffic_sources', 'bigquery_conversion_funnel'],
  },
  {
    id: 'bigquery_cloud_billing',
    title: 'Google BigQuery: GCP Multi-Cloud Billing & Cost',
    projectId: 'enterprise-finops-prod',
    datasetId: 'gcp_billing_export',
    location: 'US',
    description: 'Detailed billing records: SKU breakdown, Compute Engine costs, and Credits applied',
    tables: ['bigquery_cloud_billing', 'bigquery_sku_cost_centers'],
  },
];

export function getBigQueryDemoDataset(profileId: string): Record<string, any[]> {
  if (profileId === 'bigquery_cloud_billing') {
    return {
      bigquery_cloud_billing: [
        { invoice_month: '202404', project_id: 'prod-ml-cluster', service_description: 'Compute Engine', sku_description: 'N2 Custom Extended Memory', cost_usd: 12450.80, credit_usd: -2100.00, net_cost_usd: 10350.80, currency: 'USD' },
        { invoice_month: '202404', project_id: 'prod-data-lake', service_description: 'BigQuery', sku_description: 'Analysis (Slots / On-Demand)', cost_usd: 8400.20, credit_usd: -500.00, net_cost_usd: 7900.20, currency: 'USD' },
        { invoice_month: '202404', project_id: 'prod-data-lake', service_description: 'Cloud Storage', sku_description: 'Standard Storage (Multi-Region)', cost_usd: 3120.00, credit_usd: 0.00, net_cost_usd: 3120.00, currency: 'USD' },
        { invoice_month: '202404', project_id: 'frontend-k8s', service_description: 'Kubernetes Engine', sku_description: 'GKE Standard Cluster Management', cost_usd: 730.00, credit_usd: -73.00, net_cost_usd: 657.00, currency: 'USD' },
        { invoice_month: '202404', project_id: 'enterprise-security', service_description: 'Cloud Armor', sku_description: 'WAF Rule Invocations', cost_usd: 480.00, credit_usd: 0.00, net_cost_usd: 480.00, currency: 'USD' },
      ],
      bigquery_sku_cost_centers: [
        { service_description: 'Compute Engine', cost_center: 'Engineering - Infrastructure', owner_email: 'infra-lead@corp.net', allocation_pct: 45.0 },
        { service_description: 'BigQuery', cost_center: 'BI & Analytics', owner_email: 'bi-director@corp.net', allocation_pct: 35.0 },
        { service_description: 'Cloud Storage', cost_center: 'Data Platform', owner_email: 'data-eng@corp.net', allocation_pct: 15.0 },
        { service_description: 'Kubernetes Engine', cost_center: 'Product Delivery', owner_email: 'devops@corp.net', allocation_pct: 5.0 },
      ],
    };
  }

  // Default: bigquery_ga4_web
  return {
    bigquery_ga4_events: [
      { event_date: '20240410', event_timestamp: 1712743200000000, event_name: 'session_start', user_pseudo_id: 'user_8849.201948', ga_session_id: 991201, geo_country: 'United States', geo_city: 'San Jose', device_category: 'desktop', operating_system: 'Macintosh' },
      { event_date: '20240410', event_timestamp: 1712743220000000, event_name: 'view_item', user_pseudo_id: 'user_8849.201948', ga_session_id: 991201, geo_country: 'United States', geo_city: 'San Jose', device_category: 'desktop', operating_system: 'Macintosh' },
      { event_date: '20240410', event_timestamp: 1712743295000000, event_name: 'add_to_cart', user_pseudo_id: 'user_8849.201948', ga_session_id: 991201, geo_country: 'United States', geo_city: 'San Jose', device_category: 'desktop', operating_system: 'Macintosh' },
      { event_date: '20240410', event_timestamp: 1712743380000000, event_name: 'purchase', user_pseudo_id: 'user_8849.201948', ga_session_id: 991201, geo_country: 'United States', geo_city: 'San Jose', device_category: 'desktop', operating_system: 'Macintosh' },
      { event_date: '20240410', event_timestamp: 1712743410000000, event_name: 'session_start', user_pseudo_id: 'user_5412.839102', ga_session_id: 991202, geo_country: 'United Kingdom', geo_city: 'London', device_category: 'mobile', operating_system: 'iOS' },
      { event_date: '20240410', event_timestamp: 1712743440000000, event_name: 'view_item', user_pseudo_id: 'user_5412.839102', ga_session_id: 991202, geo_country: 'United Kingdom', geo_city: 'London', device_category: 'mobile', operating_system: 'iOS' },
      { event_date: '20240410', event_timestamp: 1712743500000000, event_name: 'session_start', user_pseudo_id: 'user_1932.482019', ga_session_id: 991203, geo_country: 'Germany', geo_city: 'Berlin', device_category: 'desktop', operating_system: 'Windows' },
    ],
    bigquery_traffic_sources: [
      { source: 'google', medium: 'organic', campaign: '(organic)', sessions: 48500, users: 39200, bounce_rate_pct: 32.4, revenue_usd: 124500.00 },
      { source: 'google', medium: 'cpc', campaign: 'spring_cloud_promo', sessions: 28400, users: 21900, bounce_rate_pct: 28.1, revenue_usd: 98400.00 },
      { source: '(direct)', medium: '(none)', campaign: '(direct)', sessions: 34100, users: 29800, bounce_rate_pct: 22.5, revenue_usd: 142000.00 },
      { source: 'linkedin', medium: 'referral', campaign: 'tech_summit_2024', sessions: 12200, users: 10400, bounce_rate_pct: 38.6, revenue_usd: 48100.00 },
      { source: 'github.com', medium: 'referral', campaign: 'developer_ecosystem', sessions: 9800, users: 8900, bounce_rate_pct: 18.2, revenue_usd: 35600.00 },
    ],
    bigquery_conversion_funnel: [
      { funnel_step: 1, step_name: 'Landing Page View', total_users: 100000, drop_off_pct: 0.0, conversion_rate_pct: 100.0 },
      { funnel_step: 2, step_name: 'Product Details Page', total_users: 58000, drop_off_pct: 42.0, conversion_rate_pct: 58.0 },
      { funnel_step: 3, step_name: 'Add to Cart / Trial', total_users: 26500, drop_off_pct: 54.3, conversion_rate_pct: 26.5 },
      { funnel_step: 4, step_name: 'Checkout Initiated', total_users: 18200, drop_off_pct: 31.3, conversion_rate_pct: 18.2 },
      { funnel_step: 5, step_name: 'Purchase Completed', total_users: 12400, drop_off_pct: 31.9, conversion_rate_pct: 12.4 },
    ],
  };
}

export function inferBigQueryColumns(rows: Record<string, any>[]): ColumnInfo[] {
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

export async function testBigQueryConnection(
  config: BigQueryConnectionConfig
): Promise<BigQueryTestResult> {
  const startTime = performance.now();

  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 70));
    const latency = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs: latency,
      version: 'Google BigQuery Analysis Engine (GoogleSQL v2.0)',
      projectId: config.projectId || 'bigquery-public-data',
      datasetId: config.datasetId || 'ga4_ecommerce',
      location: config.location || 'US',
    };
  }

  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${bridgeUrl}/api/bigquery/test`, {
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
        error: errData.error || `HTTP ${response.status}: Failed to reach BigQuery bridge`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      latencyMs: latency,
      version: data.version || 'Google BigQuery REST API (Bridge Verified)',
      projectId: config.projectId,
      datasetId: config.datasetId,
      location: config.location,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    return {
      success: false,
      latencyMs: latency,
      error: `Could not reach database bridge at ${bridgeUrl}. Run 'npm run bridge' or use the Instant Demo profile to test.`,
    };
  }
}

export async function fetchBigQueryTables(
  config: BigQueryConnectionConfig
): Promise<BigQueryDiscoveredTable[]> {
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const activeProfile =
      DEMO_BIGQUERY_PROFILES.find((p) => p.datasetId === config.datasetId) ||
      DEMO_BIGQUERY_PROFILES[0];
    const dataset = getBigQueryDemoDataset(activeProfile.id);

    return Object.keys(dataset).map((tblName) => {
      const rows = dataset[tblName];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        name: tblName,
        dataset: config.datasetId || 'ga4_ecommerce',
        rowCount: rows.length,
        columnCount: cols.length,
        columns: cols.map((c) => ({ name: c, type: typeof rows[0]?.[c] })),
      };
    });
  }

  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');
  const response = await fetch(`${bridgeUrl}/api/bigquery/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch BigQuery tables: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.tables || [];
}

export async function importBigQueryTable(
  config: BigQueryConnectionConfig,
  tableName: string,
  datasetId = 'default'
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }> {
  let rows: Record<string, any>[] = [];

  if (config.mode === 'demo') {
    const activeProfile =
      DEMO_BIGQUERY_PROFILES.find((p) => p.datasetId === config.datasetId) ||
      DEMO_BIGQUERY_PROFILES[0];
    const dataset = getBigQueryDemoDataset(activeProfile.id);
    rows = dataset[tableName] || [];
  } else {
    const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');
    const response = await fetch(`${bridgeUrl}/api/bigquery/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        sql: `SELECT * FROM \`${config.projectId}.${config.datasetId}.${tableName}\` LIMIT 10000;`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to query BigQuery table: ${tableName}`);
    }

    const data = await response.json();
    rows = data.rows || [];
  }

  const columns = inferBigQueryColumns(rows);

  const schema: TableSchema = {
    id: `bq_${config.projectId}_${tableName}`,
    name: tableName,
    sourceFileName: `BigQuery (${config.projectId}/${config.datasetId})`,
    sheetName: `${datasetId}.${tableName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'bigquery',
    connectionName: config.name || `BigQuery [${config.projectId}:${config.datasetId}]`,
  };

  return { schema, rows };
}
