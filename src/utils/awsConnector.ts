/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableSchema, ColumnInfo, DataType } from '../types';

export type AwsServiceType = 'athena' | 'redshift' | 's3' | 'rds';
export type AwsAuthMode = 'demo' | 'direct' | 'bridge';

export interface AwsConnectionConfig {
  id?: string;
  name?: string;
  service: AwsServiceType;
  mode: AwsAuthMode;
  region: string;
  // Credentials
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  bridgeUrl?: string; // Default: 'http://localhost:54322'

  // Service-specific parameters
  // Amazon Athena
  athenaCatalog?: string; // Default: 'AwsDataCatalog'
  athenaDatabase?: string; // e.g. 'analytics_db'
  athenaWorkgroup?: string; // Default: 'primary'
  athenaOutputLocation?: string; // e.g. 's3://my-query-results-bucket/athena/'

  // Amazon Redshift
  redshiftHost?: string;
  redshiftPort?: number; // Default: 5439
  redshiftDatabase?: string;
  redshiftUser?: string;
  redshiftPassword?: string;
  redshiftClusterId?: string;
  redshiftWorkgroup?: string;

  // Amazon S3
  s3Bucket?: string;
  s3Key?: string;
  s3Prefix?: string;
  s3FileFormat?: 'csv' | 'xlsx' | 'json';
  s3PresignedUrl?: string;

  // Amazon RDS / Aurora
  rdsEngine?: 'postgres' | 'mysql';
  rdsHost?: string;
  rdsPort?: number; // 5432 or 3306
  rdsDatabase?: string;
  rdsUser?: string;
  rdsPassword?: string;
}

export interface AwsDiscoveredResource {
  id: string;
  name: string;
  service: AwsServiceType;
  schema?: string;
  rowCount: number;
  columnCount: number;
  sizeBytes?: number;
  description?: string;
  columns?: { name: string; type: string }[];
}

export interface AwsTestResult {
  success: boolean;
  latencyMs: number;
  service: AwsServiceType;
  region: string;
  version?: string;
  details?: string;
  error?: string;
}

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) [us-east-1]' },
  { value: 'us-east-2', label: 'US East (Ohio) [us-east-2]' },
  { value: 'us-west-1', label: 'US West (N. California) [us-west-1]' },
  { value: 'us-west-2', label: 'US West (Oregon) [us-west-2]' },
  { value: 'eu-west-1', label: 'EU (Ireland) [eu-west-1]' },
  { value: 'eu-central-1', label: 'EU (Frankfurt) [eu-central-1]' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) [ap-southeast-1]' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) [ap-southeast-2]' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) [ap-northeast-1]' },
  { value: 'sa-east-1', label: 'South America (São Paulo) [sa-east-1]' },
];

// ============================================================================
// DEMO / MOCK AWS DATASETS FOR INSTANT IN-BROWSER EXPLORATION
// ============================================================================

export interface AwsDemoProfile {
  id: string;
  title: string;
  service: AwsServiceType;
  region: string;
  description: string;
  badge: string;
  tables: string[];
}

export const DEMO_AWS_PROFILES: AwsDemoProfile[] = [
  {
    id: 'athena_datalake',
    title: 'Amazon Athena: S3 Analytics Data Lake',
    service: 'athena',
    region: 'us-east-1',
    description: 'Serverless interactive queries on partitioned S3 clickstream events & CloudWatch metrics',
    badge: 'ATHENA',
    tables: ['athena_web_events', 'athena_cloudwatch_metrics', 'athena_customer_churn_risk'],
  },
  {
    id: 'redshift_dw',
    title: 'Amazon Redshift: Enterprise Cloud Data Warehouse',
    service: 'redshift',
    region: 'us-west-2',
    description: 'Columnar analytical warehouse: Orders, Product Catalog, and Multi-region Inventory',
    badge: 'REDSHIFT',
    tables: ['redshift_dw_orders', 'redshift_dw_products', 'redshift_dw_inventory'],
  },
  {
    id: 's3_analytics_bucket',
    title: 'Amazon S3: Global Financial & SaaS Storage Bucket',
    service: 's3',
    region: 'eu-west-1',
    description: 'Direct S3 bucket object storage: Fiscal Revenue CSV and SaaS MRR metrics',
    badge: 'S3',
    tables: ['s3_global_revenue_q4', 's3_saas_mrr_metrics'],
  },
  {
    id: 'rds_aurora_saas',
    title: 'Amazon RDS / Aurora: Production PostgreSQL Cluster',
    service: 'rds',
    region: 'us-east-2',
    description: 'High-availability Aurora serverless instance: Active Users and Subscriptions ledger',
    badge: 'RDS AURORA',
    tables: ['rds_aurora_users', 'rds_aurora_subscriptions'],
  },
];

export function getAwsDemoDataset(profileId: string): Record<string, any[]> {
  switch (profileId) {
    case 'athena_datalake':
      return {
        athena_web_events: [
          { event_id: 'EVT-10001', session_id: 'SES-9821', user_id: 'USR-401', event_type: 'page_view', url_path: '/products/cloud-servers', referrer: 'google.com', response_time_ms: 124, http_status: 200, device_category: 'desktop', country: 'USA', event_time: '2024-04-12 09:15:22' },
          { event_id: 'EVT-10002', session_id: 'SES-9821', user_id: 'USR-401', event_type: 'add_to_cart', url_path: '/cart/add', referrer: 'internal', response_time_ms: 88, http_status: 200, device_category: 'desktop', country: 'USA', event_time: '2024-04-12 09:18:04' },
          { event_id: 'EVT-10003', session_id: 'SES-9821', user_id: 'USR-401', event_type: 'checkout_start', url_path: '/checkout/step-1', referrer: 'internal', response_time_ms: 195, http_status: 200, device_category: 'desktop', country: 'USA', event_time: '2024-04-12 09:19:30' },
          { event_id: 'EVT-10004', session_id: 'SES-9822', user_id: 'USR-512', event_type: 'page_view', url_path: '/pricing', referrer: 'twitter.com', response_time_ms: 110, http_status: 200, device_category: 'mobile', country: 'UK', event_time: '2024-04-12 09:21:10' },
          { event_id: 'EVT-10005', session_id: 'SES-9823', user_id: 'USR-890', event_type: 'search', url_path: '/search?q=elastic+gpu', referrer: 'direct', response_time_ms: 340, http_status: 200, device_category: 'desktop', country: 'Germany', event_time: '2024-04-12 09:25:44' },
          { event_id: 'EVT-10006', session_id: 'SES-9824', user_id: 'USR-112', event_type: 'page_view', url_path: '/docs/api-reference', referrer: 'github.com', response_time_ms: 95, http_status: 200, device_category: 'desktop', country: 'Canada', event_time: '2024-04-12 09:28:11' },
          { event_id: 'EVT-10007', session_id: 'SES-9825', user_id: 'USR-704', event_type: 'api_call', url_path: '/v1/telemetry', referrer: 'sdk-python', response_time_ms: 45, http_status: 200, device_category: 'server', country: 'Japan', event_time: '2024-04-12 09:30:00' },
          { event_id: 'EVT-10008', session_id: 'SES-9826', user_id: 'USR-619', event_type: 'page_view', url_path: '/blog/database-optimization', referrer: 'linkedin.com', response_time_ms: 130, http_status: 200, device_category: 'mobile', country: 'USA', event_time: '2024-04-12 09:34:15' },
        ],
        athena_cloudwatch_metrics: [
          { timestamp: '2024-04-12 09:00:00', namespace: 'AWS/EC2', metric_name: 'CPUUtilization', instance_id: 'i-0a8b9c1d2e3f4a5b6', region: 'us-east-1', avg_value: 42.6, max_value: 78.2, sample_count: 60 },
          { timestamp: '2024-04-12 09:00:00', namespace: 'AWS/RDS', metric_name: 'DatabaseConnections', instance_id: 'rds-prod-primary', region: 'us-east-1', avg_value: 128.0, max_value: 165.0, sample_count: 60 },
          { timestamp: '2024-04-12 09:00:00', namespace: 'AWS/Lambda', metric_name: 'Invocations', instance_id: 'fn-auth-handler', region: 'us-east-1', avg_value: 3450.0, max_value: 4200.0, sample_count: 60 },
          { timestamp: '2024-04-12 09:05:00', namespace: 'AWS/EC2', metric_name: 'CPUUtilization', instance_id: 'i-0a8b9c1d2e3f4a5b6', region: 'us-east-1', avg_value: 51.3, max_value: 84.0, sample_count: 60 },
          { timestamp: '2024-04-12 09:05:00', namespace: 'AWS/RDS', metric_name: 'ReadIOPS', instance_id: 'rds-prod-primary', region: 'us-east-1', avg_value: 840.5, max_value: 1200.0, sample_count: 60 },
          { timestamp: '2024-04-12 09:05:00', namespace: 'AWS/S3', metric_name: 'BucketSizeBytes', instance_id: 'prod-datalake-parquet', region: 'us-east-1', avg_value: 485900000000, max_value: 485900000000, sample_count: 1 },
        ],
        athena_customer_churn_risk: [
          { customer_id: 'CUST-801', company: 'Acme Cloud Solutions', tier: 'Enterprise', mrr: 12500, health_score: 94, open_tickets: 1, churn_risk_pct: 4.2, account_exec: 'Sarah Jenkins' },
          { customer_id: 'CUST-802', company: 'Apex Fintech Corp', tier: 'Enterprise', mrr: 24000, health_score: 68, open_tickets: 6, churn_risk_pct: 48.5, account_exec: 'David Miller' },
          { customer_id: 'CUST-803', company: 'BlueSky Logistics', tier: 'Mid-Market', mrr: 3800, health_score: 88, open_tickets: 0, churn_risk_pct: 8.1, account_exec: 'Sarah Jenkins' },
          { customer_id: 'CUST-804', company: 'Cascade Retailers', tier: 'Mid-Market', mrr: 4500, health_score: 55, open_tickets: 8, churn_risk_pct: 62.0, account_exec: 'Rachel Chen' },
          { customer_id: 'CUST-805', company: 'DataWave AI', tier: 'Startup', mrr: 1200, health_score: 98, open_tickets: 0, churn_risk_pct: 2.0, account_exec: 'Rachel Chen' },
        ],
      };

    case 'redshift_dw':
      return {
        redshift_dw_orders: [
          { order_id: 80001, customer_id: 101, order_date: '2024-01-14', fiscal_quarter: 'Q1-2024', region: 'North America', channel: 'Direct B2B', total_amount: 18450.00, discount_pct: 0.05, margin_pct: 38.5, fulfillment_status: 'COMPLETED' },
          { order_id: 80002, customer_id: 104, order_date: '2024-01-18', fiscal_quarter: 'Q1-2024', region: 'EMEA', channel: 'Partner Portal', total_amount: 9200.50, discount_pct: 0.10, margin_pct: 41.2, fulfillment_status: 'COMPLETED' },
          { order_id: 80003, customer_id: 108, order_date: '2024-01-22', fiscal_quarter: 'Q1-2024', region: 'APAC', channel: 'Direct B2B', total_amount: 34100.00, discount_pct: 0.12, margin_pct: 45.0, fulfillment_status: 'COMPLETED' },
          { order_id: 80004, customer_id: 102, order_date: '2024-02-05', fiscal_quarter: 'Q1-2024', region: 'North America', channel: 'Online Store', total_amount: 4750.00, discount_pct: 0.00, margin_pct: 52.1, fulfillment_status: 'PROCESSING' },
          { order_id: 80005, customer_id: 115, order_date: '2024-02-19', fiscal_quarter: 'Q1-2024', region: 'LATAM', channel: 'Distributor', total_amount: 27800.00, discount_pct: 0.15, margin_pct: 34.8, fulfillment_status: 'SHIPPED' },
          { order_id: 80006, customer_id: 120, order_date: '2024-03-01', fiscal_quarter: 'Q1-2024', region: 'EMEA', channel: 'Direct B2B', total_amount: 15300.00, discount_pct: 0.08, margin_pct: 39.4, fulfillment_status: 'COMPLETED' },
          { order_id: 80007, customer_id: 103, order_date: '2024-03-15', fiscal_quarter: 'Q1-2024', region: 'North America', channel: 'Online Store', total_amount: 6200.00, discount_pct: 0.00, margin_pct: 48.0, fulfillment_status: 'COMPLETED' },
        ],
        redshift_dw_products: [
          { product_id: 'SKU-RED-01', product_name: 'Redshift Cluster Node XL', category: 'Compute', subcategory: 'Data Warehouse', unit_cost: 1450.00, list_price: 2400.00, is_active: true },
          { product_id: 'SKU-RED-02', product_name: 'Spectrum Concurrency Accelerator', category: 'Query Engine', subcategory: 'Serverless', unit_cost: 650.00, list_price: 1100.00, is_active: true },
          { product_id: 'SKU-RED-03', product_name: 'Managed Storage Volume 10TB', category: 'Storage', subcategory: 'Managed EBS', unit_cost: 320.00, list_price: 580.00, is_active: true },
          { product_id: 'SKU-RED-04', product_name: 'Data Lake Sync Connector', category: 'Integration', subcategory: 'ETL Pipelines', unit_cost: 180.00, list_price: 350.00, is_active: true },
          { product_id: 'SKU-RED-05', product_name: 'Columnar Compression License', category: 'Software', subcategory: 'Enterprise Addon', unit_cost: 85.00, list_price: 250.00, is_active: true },
        ],
        redshift_dw_inventory: [
          { warehouse_id: 'WH-US-EAST', product_id: 'SKU-RED-01', available_qty: 45, reserved_qty: 8, reorder_point: 15, last_audit_date: '2024-03-31' },
          { warehouse_id: 'WH-US-WEST', product_id: 'SKU-RED-01', available_qty: 28, reserved_qty: 5, reorder_point: 10, last_audit_date: '2024-03-31' },
          { warehouse_id: 'WH-EU-CENTRAL', product_id: 'SKU-RED-02', available_qty: 82, reserved_qty: 14, reorder_point: 25, last_audit_date: '2024-03-31' },
          { warehouse_id: 'WH-APAC-SING', product_id: 'SKU-RED-03', available_qty: 120, reserved_qty: 20, reorder_point: 30, last_audit_date: '2024-03-31' },
          { warehouse_id: 'WH-US-EAST', product_id: 'SKU-RED-04', available_qty: 250, reserved_qty: 35, reorder_point: 50, last_audit_date: '2024-03-31' },
        ],
      };

    case 's3_analytics_bucket':
      return {
        s3_global_revenue_q4: [
          { region: 'Americas', country: 'United States', business_unit: 'Cloud Infra', target_revenue_usd: 14000000, actual_revenue_usd: 15200000, variance_pct: 8.57, margin_pct: 42.1 },
          { region: 'Americas', country: 'Canada', business_unit: 'Cloud Infra', target_revenue_usd: 3500000, actual_revenue_usd: 3650000, variance_pct: 4.29, margin_pct: 39.4 },
          { region: 'Americas', country: 'Brazil', business_unit: 'SaaS Suite', target_revenue_usd: 2100000, actual_revenue_usd: 1950000, variance_pct: -7.14, margin_pct: 33.0 },
          { region: 'Europe', country: 'United Kingdom', business_unit: 'Enterprise Security', target_revenue_usd: 8500000, actual_revenue_usd: 9100000, variance_pct: 7.06, margin_pct: 46.5 },
          { region: 'Europe', country: 'Germany', business_unit: 'Cloud Infra', target_revenue_usd: 7200000, actual_revenue_usd: 7450000, variance_pct: 3.47, margin_pct: 40.8 },
          { region: 'Europe', country: 'France', business_unit: 'SaaS Suite', target_revenue_usd: 4800000, actual_revenue_usd: 4600000, variance_pct: -4.17, margin_pct: 35.6 },
          { region: 'Asia-Pacific', country: 'Japan', business_unit: 'Enterprise Security', target_revenue_usd: 6200000, actual_revenue_usd: 6800000, variance_pct: 9.68, margin_pct: 48.2 },
          { region: 'Asia-Pacific', country: 'Singapore', business_unit: 'Cloud Infra', target_revenue_usd: 4100000, actual_revenue_usd: 4350000, variance_pct: 6.10, margin_pct: 44.0 },
          { region: 'Asia-Pacific', country: 'Australia', business_unit: 'SaaS Suite', target_revenue_usd: 3900000, actual_revenue_usd: 4050000, variance_pct: 3.85, margin_pct: 38.5 },
        ],
        s3_saas_mrr_metrics: [
          { month: '2024-01', starting_mrr: 185000, new_mrr: 24500, expansion_mrr: 12400, churned_mrr: 5800, ending_mrr: 216100, net_growth_pct: 16.81, paid_accounts: 312 },
          { month: '2024-02', starting_mrr: 216100, new_mrr: 28200, expansion_mrr: 15100, churned_mrr: 6200, ending_mrr: 253200, net_growth_pct: 17.17, paid_accounts: 348 },
          { month: '2024-03', starting_mrr: 253200, new_mrr: 31500, expansion_mrr: 18400, churned_mrr: 7100, ending_mrr: 296000, net_growth_pct: 16.90, paid_accounts: 395 },
          { month: '2024-04', starting_mrr: 296000, new_mrr: 36000, expansion_mrr: 21200, churned_mrr: 6900, ending_mrr: 346300, net_growth_pct: 16.99, paid_accounts: 450 },
        ],
      };

    case 'rds_aurora_saas':
      return {
        rds_aurora_users: [
          { user_id: 'usr_001', full_name: 'Sophia Reynolds', email: 'sophia@cloudtech.io', role: 'admin', org_name: 'CloudTech Systems', plan_tier: 'enterprise', mfa_enabled: true, created_at: '2023-08-10 14:22:01', last_login: '2024-04-12 08:33:10' },
          { user_id: 'usr_002', full_name: 'Marcus Vance', email: 'marcus@dataflow.co', role: 'developer', org_name: 'DataFlow Inc', plan_tier: 'pro', mfa_enabled: true, created_at: '2023-09-15 11:05:44', last_login: '2024-04-11 19:45:22' },
          { user_id: 'usr_003', full_name: 'Elena Rostova', email: 'elena@novafinance.org', role: 'analyst', org_name: 'Nova Finance', plan_tier: 'enterprise', mfa_enabled: true, created_at: '2023-11-20 09:12:33', last_login: '2024-04-12 09:01:50' },
          { user_id: 'usr_004', full_name: 'Liam Gallagher', email: 'liam@celticdev.com', role: 'developer', org_name: 'Celtic Developers', plan_tier: 'standard', mfa_enabled: false, created_at: '2024-01-05 16:40:12', last_login: '2024-04-10 14:15:00' },
          { user_id: 'usr_005', full_name: 'Amina Al-Mansoor', email: 'amina@dubaisolutions.ae', role: 'admin', org_name: 'Dubai Tech Group', plan_tier: 'enterprise', mfa_enabled: true, created_at: '2024-02-18 10:18:25', last_login: '2024-04-12 07:50:33' },
        ],
        rds_aurora_subscriptions: [
          { sub_id: 'sub_901', user_id: 'usr_001', plan: 'Enterprise Unlimited', monthly_fee: 1499.00, billing_cycle: 'ANNUAL', status: 'ACTIVE', auto_renew: true, current_period_end: '2024-08-10' },
          { sub_id: 'sub_902', user_id: 'usr_002', plan: 'Developer Pro', monthly_fee: 299.00, billing_cycle: 'MONTHLY', status: 'ACTIVE', auto_renew: true, current_period_end: '2024-05-15' },
          { sub_id: 'sub_903', user_id: 'usr_003', plan: 'Enterprise Unlimited', monthly_fee: 1499.00, billing_cycle: 'ANNUAL', status: 'ACTIVE', auto_renew: true, current_period_end: '2024-11-20' },
          { sub_id: 'sub_904', user_id: 'usr_004', plan: 'Starter Team', monthly_fee: 99.00, billing_cycle: 'MONTHLY', status: 'ACTIVE', auto_renew: false, current_period_end: '2024-05-05' },
          { sub_id: 'sub_905', user_id: 'usr_005', plan: 'Enterprise Custom', monthly_fee: 2499.00, billing_cycle: 'ANNUAL', status: 'ACTIVE', auto_renew: true, current_period_end: '2025-02-18' },
        ],
      };

    default:
      return {};
  }
}

// ============================================================================
// COLUMN INFERENCE HELPER
// ============================================================================

export function inferAwsColumns(rows: Record<string, any>[]): ColumnInfo[] {
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
// PARSE S3 URIs & HTTP URLs
// ============================================================================

export function parseS3Uri(uri: string): { bucket: string; key: string; region?: string } | null {
  try {
    const trimmed = uri.trim();
    // 1. s3://bucket/key/to/file.csv
    if (trimmed.startsWith('s3://')) {
      const withoutScheme = trimmed.replace(/^s3:\/\//, '');
      const slashIndex = withoutScheme.indexOf('/');
      if (slashIndex === -1) {
        return { bucket: withoutScheme, key: '' };
      }
      return {
        bucket: withoutScheme.slice(0, slashIndex),
        key: withoutScheme.slice(slashIndex + 1),
      };
    }

    // 2. https://bucket.s3.amazonaws.com/key or https://s3.region.amazonaws.com/bucket/key
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const host = url.hostname;

      // Virtual-hosted-style: bucket.s3.region.amazonaws.com
      const vhostMatch = host.match(/^([a-z0-9.-]+)\.s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/);
      if (vhostMatch) {
        return {
          bucket: vhostMatch[1],
          key: url.pathname.replace(/^\//, ''),
          region: vhostMatch[2] || 'us-east-1',
        };
      }

      // Path-style: s3.region.amazonaws.com/bucket/key
      const pathStyleMatch = host.match(/^s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/);
      if (pathStyleMatch) {
        const parts = url.pathname.replace(/^\//, '').split('/');
        return {
          bucket: parts[0] || '',
          key: parts.slice(1).join('/'),
          region: pathStyleMatch[1] || 'us-east-1',
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

// ============================================================================
// CORE AWS CONNECTOR CLIENT (DEMO, CLIENT-SIDE S3, & BRIDGE)
// ============================================================================

/**
 * Test AWS Connection
 */
export async function testAwsConnection(config: AwsConnectionConfig): Promise<AwsTestResult> {
  const startTime = performance.now();

  // Mode 1: Instant In-Browser Demo Profiles
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 65));
    const latency = Math.round(performance.now() - startTime);

    switch (config.service) {
      case 'athena':
        return {
          success: true,
          latencyMs: latency,
          service: 'athena',
          region: config.region || 'us-east-1',
          version: 'Amazon Athena Engine v3 (Trino 422)',
          details: `Catalog: ${config.athenaCatalog || 'AwsDataCatalog'}, DB: ${config.athenaDatabase || 'analytics_db'}, Output: ${config.athenaOutputLocation || 's3://aws-athena-query-results/'}`,
        };
      case 'redshift':
        return {
          success: true,
          latencyMs: latency,
          service: 'redshift',
          region: config.region || 'us-west-2',
          version: 'Amazon Redshift 1.0.64024 (PostgreSQL 8.0.2 compatible)',
          details: `Cluster: ${config.redshiftClusterId || 'redshift-cluster-1'}, DB: ${config.redshiftDatabase || 'dev'}, Port: 5439`,
        };
      case 's3':
        return {
          success: true,
          latencyMs: latency,
          service: 's3',
          region: config.region || 'eu-west-1',
          version: 'Amazon Simple Storage Service (S3 REST API 2006-03-01)',
          details: `Bucket: ${config.s3Bucket || 's3-analytics-data'}, Prefix: ${config.s3Prefix || 'datasets/'}`,
        };
      case 'rds':
        return {
          success: true,
          latencyMs: latency,
          service: 'rds',
          region: config.region || 'us-east-2',
          version: 'Amazon Aurora PostgreSQL 16.1 (Serverless v2)',
          details: `Endpoint: ${config.rdsHost || 'aurora-cluster.us-east-2.rds.amazonaws.com'}, DB: ${config.rdsDatabase || 'saas_prod'}`,
        };
    }
  }

  // Mode 2: Direct Presigned S3 URL
  if (config.mode === 'direct' && config.service === 's3' && config.s3PresignedUrl) {
    try {
      const response = await fetch(config.s3PresignedUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-1024' },
      });
      const latency = Math.round(performance.now() - startTime);

      if (!response.ok && response.status !== 206) {
        return {
          success: false,
          latencyMs: latency,
          service: 's3',
          region: config.region,
          error: `HTTP ${response.status} ${response.statusText} - Failed to reach S3 Presigned URL. Verify bucket CORS and URL expiration.`,
        };
      }

      return {
        success: true,
        latencyMs: latency,
        service: 's3',
        region: config.region,
        version: 'Amazon S3 Presigned Object Direct Access',
        details: `Connected successfully. Content-Type: ${response.headers.get('Content-Type') || 'text/csv'}`,
      };
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs: latency,
        service: 's3',
        region: config.region,
        error: `Network error reaching S3 URL: ${err.message}. If accessing private buckets directly, ensure S3 Bucket CORS allows Origin '${window.location.origin}' or use the Node.js AWS Bridge.`,
      };
    }
  }

  // Mode 3: Local AWS Bridge Agent (http://localhost:54322)
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54322').replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(`${bridgeUrl}/api/aws/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - startTime);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        latencyMs: latency,
        service: config.service,
        region: config.region,
        error: data.error || `HTTP ${response.status}: Failed to connect via AWS bridge`,
      };
    }

    return {
      success: true,
      latencyMs: latency,
      service: config.service,
      region: config.region,
      version: data.version || `AWS ${config.service.toUpperCase()} (Bridge Verified)`,
      details: data.details || `Connected to AWS ${config.service.toUpperCase()} in ${config.region}`,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);
    if (err.name === 'AbortError') {
      return {
        success: false,
        latencyMs: latency,
        service: config.service,
        region: config.region,
        error: `Connection timed out after 7000ms. Ensure AWS bridge is running at ${bridgeUrl}`,
      };
    }

    return {
      success: false,
      latencyMs: latency,
      service: config.service,
      region: config.region,
      error: `Could not reach AWS Bridge at ${bridgeUrl}. Browsers cannot make direct TCP/SigV4 calls with raw AWS credentials without CORS. Start the bridge with 'npm run bridge:aws' or switch to Instant Demo Profiles.`,
    };
  }
}

/**
 * Fetch available tables, queries, or S3 objects from AWS
 */
export async function fetchAwsResources(config: AwsConnectionConfig): Promise<AwsDiscoveredResource[]> {
  // Demo Mode
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const activeProfile =
      DEMO_AWS_PROFILES.find((p) => p.service === config.service) || DEMO_AWS_PROFILES[0];
    const dataset = getAwsDemoDataset(activeProfile.id);

    return Object.keys(dataset).map((tblName) => {
      const rows = dataset[tblName];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        id: `aws_${config.service}_${tblName}`,
        name: tblName,
        service: config.service,
        schema: config.service === 'athena' ? config.athenaDatabase || 'analytics_db' : 'public',
        rowCount: rows.length,
        columnCount: cols.length,
        description: `AWS ${config.service.toUpperCase()} Table (${rows.length} rows, ${cols.length} cols)`,
        columns: cols.map((c) => ({ name: c, type: typeof rows[0]?.[c] })),
      };
    });
  }

  // Direct S3 Presigned URL
  if (config.mode === 'direct' && config.service === 's3' && config.s3PresignedUrl) {
    const parsed = parseS3Uri(config.s3PresignedUrl);
    const fileName = parsed?.key.split('/').pop() || config.s3Key || 's3_imported_file.csv';
    const tableName = fileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.[^.]+$/, '');

    return [
      {
        id: `aws_s3_${tableName}`,
        name: tableName,
        service: 's3',
        schema: config.s3Bucket || 's3_bucket',
        rowCount: 0,
        columnCount: 0,
        description: `Direct S3 File: ${fileName}`,
      },
    ];
  }

  // Bridge Server
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54322').replace(/\/+$/, '');
  const response = await fetch(`${bridgeUrl}/api/aws/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch AWS resources: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.resources || [];
}

/**
 * Import an AWS resource (table, query result, or S3 object) as TableSchema
 */
export async function importAwsResource(
  config: AwsConnectionConfig,
  resourceName: string,
  schemaName = 'public'
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }> {
  let rows: Record<string, any>[] = [];

  // Demo Mode
  if (config.mode === 'demo') {
    const activeProfile =
      DEMO_AWS_PROFILES.find((p) => p.service === config.service) || DEMO_AWS_PROFILES[0];
    const dataset = getAwsDemoDataset(activeProfile.id);
    rows = dataset[resourceName] || [];
  } else if (config.mode === 'direct' && config.service === 's3' && config.s3PresignedUrl) {
    // Fetch directly from presigned / public URL in-browser
    const response = await fetch(config.s3PresignedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download S3 file: HTTP ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    // Parse CSV in-browser
    rows = parseSimpleCsv(text);
  } else {
    // Bridge Mode
    const bridgeUrl = (config.bridgeUrl || 'http://localhost:54322').replace(/\/+$/, '');
    const response = await fetch(`${bridgeUrl}/api/aws/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        resourceName,
        schemaName,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to import AWS resource: ${resourceName}`);
    }

    const data = await response.json();
    rows = data.rows || [];
  }

  const columns = inferAwsColumns(rows);
  const serviceLabel = config.service.toUpperCase();

  const schema: TableSchema = {
    id: `aws_${config.service}_${resourceName}`,
    name: resourceName,
    sourceFileName: `AWS ${serviceLabel} (${config.region})`,
    sheetName: `${config.service}:${schemaName}.${resourceName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'aws',
    connectionName: config.name || `AWS ${serviceLabel} [${config.region}]`,
  };

  return { schema, rows };
}

// Simple fast CSV parser for direct client-side S3 text responses
function parseSimpleCsv(text: string): Record<string, any>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        let val: any = values[idx];
        if (!isNaN(val as any) && val.trim() !== '') {
          val = Number(val);
        } else if (val.toLowerCase() === 'true') {
          val = true;
        } else if (val.toLowerCase() === 'false') {
          val = false;
        }
        row[h.trim()] = val;
      });
      rows.push(row);
    }
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
