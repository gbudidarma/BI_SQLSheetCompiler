/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TableSchema, ColumnInfo, DataType } from '../types';

export interface PostgresConnectionConfig {
  id?: string;
  name?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  sslMode: 'require' | 'prefer' | 'disable' | 'verify-full';
  bridgeUrl?: string; // Default: 'http://localhost:54321'
  mode: 'bridge' | 'neon' | 'demo';
}

export interface DiscoveredTable {
  name: string;
  schema: string;
  rowCount: number;
  columnCount: number;
  columns?: { name: string; type: string }[];
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  version?: string;
  database?: string;
  user?: string;
  error?: string;
}

/**
 * Parse standard PostgreSQL connection URI
 * e.g., postgres://postgres:secret@localhost:5432/mydb?sslmode=require
 */
export function parsePostgresUri(uri: string): Partial<PostgresConnectionConfig> | null {
  try {
    const trimmed = uri.trim();
    if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
      return null;
    }

    const url = new URL(trimmed.replace(/^postgres(ql)?:\/\//, 'http://'));
    const sslModeParam = url.searchParams.get('sslmode') as any;

    return {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 5432,
      database: url.pathname.replace(/^\//, '') || 'postgres',
      user: decodeURIComponent(url.username || 'postgres'),
      password: decodeURIComponent(url.password || ''),
      sslMode: ['require', 'prefer', 'disable', 'verify-full'].includes(sslModeParam)
        ? sslModeParam
        : 'prefer',
    };
  } catch {
    return null;
  }
}

// ============================================================================
// DEMO / MOCK POSTGRESQL PROFILES FOR INSTANT IN-BROWSER TESTING
// ============================================================================

export const DEMO_POSTGRES_PROFILES = [
  {
    id: 'ecommerce_pg',
    title: 'E-Commerce Retail (PostgreSQL 16)',
    description: 'Relational DB: Customers, Orders, Items, Products, Inventory',
    host: 'pg-retail-demo.postgres.database.azure.com',
    port: 5432,
    database: 'retail_warehouse',
    user: 'pg_analyst',
    tables: ['pg_customers', 'pg_orders', 'pg_order_items', 'pg_products'],
  },
  {
    id: 'pagila_pg',
    title: 'Pagila / DVD Rental (Classic PostgreSQL)',
    description: 'PostgreSQL standard reference schema: Films, Actors, Rentals, Stores',
    host: 'ep-pagila-demo.us-east-2.aws.neon.tech',
    port: 5432,
    database: 'pagila_db',
    user: 'neon_admin',
    tables: ['pg_film', 'pg_customer', 'pg_rental', 'pg_payment', 'pg_category'],
  },
  {
    id: 'fintech_pg',
    title: 'Fintech Transactions & Accounts',
    description: 'Ledger accounts, credit cards, transactions, and merchant risk scores',
    host: 'db.supabase.co',
    port: 5432,
    database: 'fintech_prod',
    user: 'postgres',
    tables: ['pg_accounts', 'pg_transactions', 'pg_merchants'],
  },
];

// Mock data generator for demo profiles
function getDemoDataset(profileId: string): Record<string, any[]> {
  if (profileId === 'pagila_pg') {
    return {
      pg_film: [
        { film_id: 1, title: 'ACADEMY DINOSAUR', release_year: 2006, rental_rate: 0.99, length: 86, rating: 'PG', special_features: 'Deleted Scenes,Behind the Scenes' },
        { film_id: 2, title: 'ACE GOLDFINGER', release_year: 2006, rental_rate: 4.99, length: 48, rating: 'G', special_features: 'Trailers,Deleted Scenes' },
        { film_id: 3, title: 'ADAPTATION HOLES', release_year: 2006, rental_rate: 2.99, length: 50, rating: 'NC-17', special_features: 'Trailers,Commentaries' },
        { film_id: 4, title: 'AFFAIR PREJUDICE', release_year: 2006, rental_rate: 2.99, length: 117, rating: 'G', special_features: 'Commentaries,Behind the Scenes' },
        { film_id: 5, title: 'AFRICAN EGG', release_year: 2006, rental_rate: 2.99, length: 130, rating: 'G', special_features: 'Deleted Scenes' },
        { film_id: 6, title: 'AGENT TRUMAN', release_year: 2006, rental_rate: 4.99, length: 169, rating: 'PG', special_features: 'Deleted Scenes' },
        { film_id: 7, title: 'AIRPLANE SIERRA', release_year: 2006, rental_rate: 4.99, length: 62, rating: 'PG-13', special_features: 'Trailers,Deleted Scenes' },
        { film_id: 8, title: 'AIRPORT POLLOCK', release_year: 2006, rental_rate: 4.99, length: 54, rating: 'R', special_features: 'Trailers' },
      ],
      pg_customer: [
        { customer_id: 101, store_id: 1, first_name: 'MARY', last_name: 'SMITH', email: 'mary.smith@sakilacustomer.org', active: true, create_date: '2024-02-14' },
        { customer_id: 102, store_id: 1, first_name: 'PATRICIA', last_name: 'JOHNSON', email: 'patricia.johnson@sakilacustomer.org', active: true, create_date: '2024-02-14' },
        { customer_id: 103, store_id: 1, first_name: 'LINDA', last_name: 'WILLIAMS', email: 'linda.williams@sakilacustomer.org', active: true, create_date: '2024-02-15' },
        { customer_id: 104, store_id: 2, first_name: 'BARBARA', last_name: 'JONES', email: 'barbara.jones@sakilacustomer.org', active: true, create_date: '2024-02-15' },
        { customer_id: 105, store_id: 1, first_name: 'ELIZABETH', last_name: 'BROWN', email: 'elizabeth.brown@sakilacustomer.org', active: false, create_date: '2024-02-17' },
      ],
      pg_rental: [
        { rental_id: 1001, rental_date: '2024-05-24 22:53:30', inventory_id: 367, customer_id: 101, return_date: '2024-05-26 22:04:30', staff_id: 1 },
        { rental_id: 1002, rental_date: '2024-05-24 22:54:33', inventory_id: 1525, customer_id: 102, return_date: '2024-05-28 19:40:33', staff_id: 2 },
        { rental_id: 1003, rental_date: '2024-05-24 23:03:39', inventory_id: 1711, customer_id: 103, return_date: '2024-06-01 22:12:39', staff_id: 1 },
        { rental_id: 1004, rental_date: '2024-05-24 23:04:41', inventory_id: 2452, customer_id: 104, return_date: '2024-06-03 01:43:41', staff_id: 2 },
      ],
      pg_payment: [
        { payment_id: 5001, customer_id: 101, staff_id: 1, rental_id: 1001, amount: 2.99, payment_date: '2024-05-25 11:30:37' },
        { payment_id: 5002, customer_id: 102, staff_id: 2, rental_id: 1002, amount: 0.99, payment_date: '2024-05-27 13:22:42' },
        { payment_id: 5003, customer_id: 103, staff_id: 1, rental_id: 1003, amount: 5.99, payment_date: '2024-05-29 08:45:19' },
        { payment_id: 5004, customer_id: 104, staff_id: 2, rental_id: 1004, amount: 4.99, payment_date: '2024-05-31 16:18:03' },
      ],
      pg_category: [
        { category_id: 1, name: 'Action', last_update: '2024-02-15 04:46:27' },
        { category_id: 2, name: 'Animation', last_update: '2024-02-15 04:46:27' },
        { category_id: 3, name: 'Children', last_update: '2024-02-15 04:46:27' },
        { category_id: 4, name: 'Classics', last_update: '2024-02-15 04:46:27' },
        { category_id: 5, name: 'Comedy', last_update: '2024-02-15 04:46:27' },
        { category_id: 6, name: 'Documentary', last_update: '2024-02-15 04:46:27' },
      ],
    };
  }

  if (profileId === 'fintech_pg') {
    return {
      pg_accounts: [
        { account_id: 'ACC-1001', customer_name: 'Alexander Hamilton', account_type: 'CHECKING', balance: 14500.50, currency: 'USD', status: 'ACTIVE', created_at: '2023-01-15' },
        { account_id: 'ACC-1002', customer_name: 'Beatrix Potter', account_type: 'SAVINGS', balance: 48200.00, currency: 'USD', status: 'ACTIVE', created_at: '2023-03-22' },
        { account_id: 'ACC-1003', customer_name: 'Charles Babbage', account_type: 'INVESTMENT', balance: 135800.75, currency: 'USD', status: 'ACTIVE', created_at: '2022-11-10' },
        { account_id: 'ACC-1004', customer_name: 'Diana Prince', account_type: 'CHECKING', balance: 6720.10, currency: 'USD', status: 'ACTIVE', created_at: '2024-02-01' },
      ],
      pg_transactions: [
        { tx_id: 'TXN-9001', account_id: 'ACC-1001', amount: -120.50, tx_type: 'DEBIT', merchant: 'Amazon AWS', category: 'Cloud Infrastructure', tx_date: '2024-04-01 10:14:22' },
        { tx_id: 'TXN-9002', account_id: 'ACC-1001', amount: 5000.00, tx_type: 'CREDIT', merchant: 'Payroll Direct Deposit', category: 'Income', tx_date: '2024-04-05 06:00:00' },
        { tx_id: 'TXN-9003', account_id: 'ACC-1002', amount: -45.00, tx_type: 'DEBIT', merchant: 'Whole Foods Market', category: 'Groceries', tx_date: '2024-04-06 17:33:10' },
        { tx_id: 'TXN-9004', account_id: 'ACC-1003', amount: -1250.00, tx_type: 'DEBIT', merchant: 'Vanguard ETF Purchase', category: 'Investment', tx_date: '2024-04-07 14:20:00' },
        { tx_id: 'TXN-9005', account_id: 'ACC-1004', amount: -18.75, tx_type: 'DEBIT', merchant: 'Starbucks Coffee', category: 'Dining', tx_date: '2024-04-08 08:12:44' },
      ],
      pg_merchants: [
        { merchant_id: 'M-101', name: 'Amazon AWS', mcc_code: 7372, risk_score: 0.02, country: 'USA' },
        { merchant_id: 'M-102', name: 'Whole Foods Market', mcc_code: 5411, risk_score: 0.01, country: 'USA' },
        { merchant_id: 'M-103', name: 'Vanguard ETF Purchase', mcc_code: 6211, risk_score: 0.00, country: 'USA' },
        { merchant_id: 'M-104', name: 'Starbucks Coffee', mcc_code: 5814, risk_score: 0.03, country: 'USA' },
      ],
    };
  }

  // Default: ecommerce_pg
  return {
    pg_customers: [
      { id: 1, full_name: 'Grace Hopper', email: 'grace@navy.mil', city: 'Arlington', country: 'USA', segment: 'Enterprise', registered_at: '2023-01-12' },
      { id: 2, full_name: 'Alan Turing', email: 'alan@bletchley.uk', city: 'Manchester', country: 'UK', segment: 'Enterprise', registered_at: '2023-02-18' },
      { id: 3, full_name: 'Ada Lovelace', email: 'ada@analytical.org', city: 'London', country: 'UK', segment: 'VIP', registered_at: '2023-03-05' },
      { id: 4, full_name: 'Claude Shannon', email: 'claude@bell-labs.com', city: 'New York', country: 'USA', segment: 'Standard', registered_at: '2023-04-20' },
      { id: 5, full_name: 'Margaret Hamilton', email: 'margaret@mit.edu', city: 'Cambridge', country: 'USA', segment: 'VIP', registered_at: '2023-05-11' },
      { id: 6, full_name: 'Linus Torvalds', email: 'linus@linuxfoundation.org', city: 'Helsinki', country: 'Finland', segment: 'Enterprise', registered_at: '2023-06-01' },
      { id: 7, full_name: 'Tim Berners-Lee', email: 'tim@cern.ch', city: 'Geneva', country: 'Switzerland', segment: 'VIP', registered_at: '2023-07-19' },
    ],
    pg_orders: [
      { order_id: 101, customer_id: 1, order_date: '2024-01-15', total_amount: 1450.00, status: 'DELIVERED', shipping_method: 'EXPRESS', warehouse_code: 'WH-US-EAST' },
      { order_id: 102, customer_id: 2, order_date: '2024-01-18', total_amount: 420.50, status: 'DELIVERED', shipping_method: 'STANDARD', warehouse_code: 'WH-EU-CENTRAL' },
      { order_id: 103, customer_id: 3, order_date: '2024-01-22', total_amount: 3200.00, status: 'DELIVERED', shipping_method: 'EXPRESS', warehouse_code: 'WH-EU-CENTRAL' },
      { order_id: 104, customer_id: 1, order_date: '2024-02-05', total_amount: 890.00, status: 'PROCESSING', shipping_method: 'STANDARD', warehouse_code: 'WH-US-EAST' },
      { order_id: 105, customer_id: 4, order_date: '2024-02-12', total_amount: 175.25, status: 'SHIPPED', shipping_method: 'PRIORITY', warehouse_code: 'WH-US-WEST' },
      { order_id: 106, customer_id: 5, order_date: '2024-02-19', total_amount: 5400.00, status: 'DELIVERED', shipping_method: 'EXPRESS', warehouse_code: 'WH-US-EAST' },
      { order_id: 107, customer_id: 6, order_date: '2024-03-02', total_amount: 980.00, status: 'DELIVERED', shipping_method: 'STANDARD', warehouse_code: 'WH-EU-NORTH' },
      { order_id: 108, customer_id: 7, order_date: '2024-03-10', total_amount: 2150.00, status: 'CANCELLED', shipping_method: 'STANDARD', warehouse_code: 'WH-EU-CENTRAL' },
    ],
    pg_order_items: [
      { item_id: 1, order_id: 101, product_id: 201, quantity: 2, unit_price: 650.00, discount: 0.05 },
      { item_id: 2, order_id: 101, product_id: 204, quantity: 1, unit_price: 150.00, discount: 0.00 },
      { item_id: 3, order_id: 102, product_id: 203, quantity: 5, unit_price: 84.10, discount: 0.00 },
      { item_id: 4, order_id: 103, product_id: 202, quantity: 2, unit_price: 1600.00, discount: 0.10 },
      { item_id: 5, order_id: 104, product_id: 205, quantity: 1, unit_price: 890.00, discount: 0.00 },
      { item_id: 6, order_id: 105, product_id: 204, quantity: 1, unit_price: 175.25, discount: 0.00 },
      { item_id: 7, order_id: 106, product_id: 201, quantity: 4, unit_price: 650.00, discount: 0.10 },
      { item_id: 8, order_id: 106, product_id: 202, quantity: 2, unit_price: 1400.00, discount: 0.00 },
      { item_id: 9, order_id: 107, product_id: 203, quantity: 10, unit_price: 98.00, discount: 0.00 },
    ],
    pg_products: [
      { product_id: 201, sku: 'SRV-DL380-G10', name: 'Rackmount Server Node 2U', category: 'Hardware', stock_qty: 48, cost_price: 420.00, retail_price: 650.00 },
      { product_id: 202, sku: 'GPU-H100-80G', name: 'Tensor Compute Accelerator', category: 'AI Accelerators', stock_qty: 12, cost_price: 1100.00, retail_price: 1600.00 },
      { product_id: 203, sku: 'RAM-DDR5-64G', name: 'ECC Registered Memory Kit', category: 'Components', stock_qty: 240, cost_price: 55.00, retail_price: 84.10 },
      { product_id: 204, sku: 'NIC-100G-QSFP', name: 'Dual-Port 100GbE NIC Card', category: 'Networking', stock_qty: 85, cost_price: 110.00, retail_price: 150.00 },
      { product_id: 205, sku: 'SW-L3-48X-6Q', name: 'Managed Data Center Switch', category: 'Networking', stock_qty: 18, cost_price: 620.00, retail_price: 890.00 },
    ],
  };
}

// Infer column types from sample records
function inferColumns(rows: Record<string, any>[]): ColumnInfo[] {
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
// CORE POSTGRESQL CONNECTOR CLIENT
// ============================================================================

/**
 * Test PostgreSQL connection (Bridge, Direct HTTP, or Demo profile)
 */
export async function testPostgresConnection(
  config: PostgresConnectionConfig
): Promise<ConnectionTestResult> {
  const startTime = performance.now();

  // Mode 1: Instant Demo Profiles
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 60)); // Simulate realistic network ping
    const latency = Math.round(performance.now() - startTime);
    return {
      success: true,
      latencyMs: latency,
      version: 'PostgreSQL 16.4 on aarch64-unknown-linux-gnu, compiled by GCC 12.2.0, 64-bit',
      database: config.database || 'retail_warehouse',
      user: config.user || 'pg_analyst',
    };
  }

  // Mode 2: Local Bridge Agent (http://localhost:54321)
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${bridgeUrl}/api/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.sslMode !== 'disable',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        latencyMs: latency,
        error: errData.error || `HTTP ${response.status}: Failed to connect via bridge`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      latencyMs: latency,
      version: data.version || 'PostgreSQL (Remote)',
      database: data.database || config.database,
      user: data.user || config.user,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - startTime);

    if (err.name === 'AbortError') {
      return {
        success: false,
        latencyMs: latency,
        error: `Connection timed out after 6000ms. Ensure PostgreSQL bridge is running at ${bridgeUrl}`,
      };
    }

    // Friendly bridge not found message
    return {
      success: false,
      latencyMs: latency,
      error: `Could not reach PostgreSQL Bridge at ${bridgeUrl}. Browsers cannot open direct TCP sockets without a local bridge. Run 'bun run bridge' or use the Instant Demo profile to test.`,
    };
  }
}

/**
 * Fetch available tables from PostgreSQL
 */
export async function fetchPostgresTables(
  config: PostgresConnectionConfig
): Promise<DiscoveredTable[]> {
  if (config.mode === 'demo') {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const activeProfile =
      DEMO_POSTGRES_PROFILES.find((p) => p.database === config.database) ||
      DEMO_POSTGRES_PROFILES[0];
    const dataset = getDemoDataset(activeProfile.id);

    return Object.keys(dataset).map((tblName) => {
      const rows = dataset[tblName];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        name: tblName,
        schema: 'public',
        rowCount: rows.length,
        columnCount: cols.length,
        columns: cols.map((c) => ({ name: c, type: typeof rows[0]?.[c] })),
      };
    });
  }

  // Real Bridge
  const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');

  const response = await fetch(`${bridgeUrl}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.sslMode !== 'disable',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch tables: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.tables || [];
}

/**
 * Import a PostgreSQL table and convert it into a TableSchema
 */
export async function importPostgresTable(
  config: PostgresConnectionConfig,
  tableName: string,
  schemaName = 'public'
): Promise<{ schema: TableSchema; rows: Record<string, any>[] }> {
  let rows: Record<string, any>[] = [];

  if (config.mode === 'demo') {
    const activeProfile =
      DEMO_POSTGRES_PROFILES.find((p) => p.database === config.database) ||
      DEMO_POSTGRES_PROFILES[0];
    const dataset = getDemoDataset(activeProfile.id);
    rows = dataset[tableName] || [];
  } else {
    // Real Bridge
    const bridgeUrl = (config.bridgeUrl || 'http://localhost:54321').replace(/\/+$/, '');

    const response = await fetch(`${bridgeUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.sslMode !== 'disable',
        sql: `SELECT * FROM "${schemaName}"."${tableName}" LIMIT 10000;`,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed to query table ${tableName}`);
    }

    const data = await response.json();
    rows = data.rows || [];
  }

  const columns = inferColumns(rows);

  const schema: TableSchema = {
    id: `pg_${config.database}_${tableName}`,
    name: tableName,
    sourceFileName: `${config.host || 'postgres'}/${config.database}`,
    sheetName: `${schemaName}.${tableName}`,
    rowCount: rows.length,
    columns,
    previewRows: rows.slice(0, 50),
    allRows: rows,
    sourceType: 'postgres',
    connectionName: config.name || `${config.host}:${config.port}/${config.database}`,
  };

  return { schema, rows };
}
