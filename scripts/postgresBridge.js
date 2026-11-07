#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PostgreSQL Bridge Server for SheetSQL Compiler
 * Connects browser web applications to PostgreSQL databases over raw TCP.
 * 
 * Usage:
 *   node scripts/postgresBridge.js
 *   or: npm run bridge
 */

const express = require('express');
const cors = require('cors');

let pg;
try {
  pg = require('pg');
} catch {
  console.error('\x1b[31m[PostgreSQL Bridge Error]\x1b[0m Package "pg" is not installed.');
  console.error('Please install it by running:\n  \x1b[36mnpm install pg\x1b[0m or \x1b[36mbun add pg\x1b[0m\n');
}

const app = express();
const PORT = process.env.PORT || 54321;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SheetSQL PostgreSQL Bridge', port: PORT, pgDriverReady: !!pg });
});

// Helper to get a pg client
async function createClient(config) {
  if (!pg) {
    throw new Error('PostgreSQL driver (pg) is not installed on bridge server. Run "npm install pg"');
  }

  const client = new pg.Client({
    host: config.host || 'localhost',
    port: parseInt(config.port, 10) || 5432,
    database: config.database || 'postgres',
    user: config.user || 'postgres',
    password: config.password || '',
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();
  return client;
}

// 1. Test Connection
app.post('/api/test', async (req, res) => {
  const startTime = Date.now();
  let client;
  try {
    client = await createClient(req.body);
    const result = await client.query('SELECT version(), current_database() as db, current_user as usr;');
    const latency = Date.now() - startTime;

    console.log(`\x1b[32m[PG Bridge]\x1b[0m Connection tested successfully: ${req.body.host}:${req.body.port}/${req.body.database} (${latency}ms)`);

    res.json({
      success: true,
      latencyMs: latency,
      version: result.rows[0].version,
      database: result.rows[0].db,
      user: result.rows[0].usr,
    });
  } catch (err) {
    console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Test connection failed:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
  }
});

// 2. Discover Tables
app.post('/api/tables', async (req, res) => {
  let client;
  try {
    client = await createClient(req.body);
    const sql = `
      SELECT 
        table_schema as schema,
        table_name as name,
        (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = t.table_schema) as column_count
      FROM information_schema.tables t
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name;
    `;
    const result = await client.query(sql);

    const tables = result.rows.map(r => ({
      name: r.name,
      schema: r.schema,
      columnCount: parseInt(r.column_count, 10) || 0,
      rowCount: 0,
    }));

    console.log(`\x1b[32m[PG Bridge]\x1b[0m Discovered ${tables.length} tables in ${req.body.database}`);
    res.json({ success: true, tables });
  } catch (err) {
    console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Fetch tables failed:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
  }
});

// 3. Execute Query
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  let client;
  try {
    client = await createClient(req.body);
    const result = await client.query(sql);
    console.log(`\x1b[32m[PG Bridge]\x1b[0m Query executed: "${sql.slice(0, 60)}..." -> ${result.rowCount} rows`);
    res.json({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields ? result.fields.map(f => f.name) : [],
    });
  } catch (err) {
    console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Query error:`, err.message);
    res.status(400).json({ success: false, error: err.message });
  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`\n\x1b[1m\x1b[34m=====================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[32m  SheetSQL PostgreSQL Bridge Server Active\x1b[0m`);
  console.log(`  Bridge listening on: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  Target: Local & Remote PostgreSQL databases`);
  console.log(`\x1b[1m\x1b[34m=====================================================\x1b[0m\n`);
});
