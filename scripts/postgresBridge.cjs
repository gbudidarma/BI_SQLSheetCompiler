#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Zero-Dependency PostgreSQL Bridge Server for SheetSQL Compiler
 * Uses native Node.js 'http' module (no Express or CORS dependencies required).
 * 
 * Usage:
 *   node scripts/postgresBridge.cjs
 *   or: npm run bridge
 */

const http = require('http');

let pg;
try {
  pg = require('pg');
} catch {
  console.warn('\n\x1b[33m[Notice]\x1b[0m PostgreSQL driver (pg) is not yet installed.');
  console.warn('To connect to real PostgreSQL databases, install it by running:');
  console.warn('  \x1b[36mnpm install pg\x1b[0m  or  \x1b[36mbun add pg\x1b[0m\n');
}

const PORT = process.env.PORT || 54321;

// Helper to set standard CORS & Chrome Private Network Access headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to create pg client
async function createClient(config) {
  if (!pg) {
    throw new Error('Package "pg" is not installed. Please run "npm install pg" in your project directory.');
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

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Health check
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'SheetSQL PostgreSQL Bridge',
      port: PORT,
      pgInstalled: !!pg,
    }));
    return;
  }

  // POST endpoints
  if (req.method === 'POST') {
    let body = {};
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }

    // 2. Test Connection: POST /api/test
    if (pathname === '/api/test') {
      const startTime = Date.now();
      let client;
      try {
        client = await createClient(body);
        const result = await client.query('SELECT version(), current_database() as db, current_user as usr;');
        const latency = Date.now() - startTime;

        console.log(`\x1b[32m[PG Bridge]\x1b[0m Connection tested: ${body.host}:${body.port}/${body.database} (${latency}ms)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          latencyMs: latency,
          version: result.rows[0].version,
          database: result.rows[0].db,
          user: result.rows[0].usr,
        }));
      } catch (err) {
        console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Test failed: ${err.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } finally {
        if (client) {
          try { await client.end(); } catch {}
        }
      }
      return;
    }

    // 3. Discover Tables: POST /api/tables
    if (pathname === '/api/tables') {
      let client;
      try {
        client = await createClient(body);
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

        const tables = result.rows.map((r) => ({
          name: r.name,
          schema: r.schema,
          columnCount: parseInt(r.column_count, 10) || 0,
          rowCount: 0,
        }));

        console.log(`\x1b[32m[PG Bridge]\x1b[0m Discovered ${tables.length} tables in ${body.database}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tables }));
      } catch (err) {
        console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Fetch tables failed: ${err.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } finally {
        if (client) {
          try { await client.end(); } catch {}
        }
      }
      return;
    }

    // 4. Query: POST /api/query
    if (pathname === '/api/query') {
      const { sql } = body;
      if (!sql) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SQL query is required' }));
        return;
      }

      let client;
      try {
        client = await createClient(body);
        const result = await client.query(sql);
        console.log(`\x1b[32m[PG Bridge]\x1b[0m Query executed: "${sql.slice(0, 50)}..." -> ${result.rowCount} rows`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          rowCount: result.rowCount,
          rows: result.rows,
          fields: result.fields ? result.fields.map((f) => f.name) : [],
        }));
      } catch (err) {
        console.error(`\x1b[31m[PG Bridge Error]\x1b[0m Query error: ${err.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      } finally {
        if (client) {
          try { await client.end(); } catch {}
        }
      }
      return;
    }
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n\x1b[1m\x1b[34m=====================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[32m  SheetSQL PostgreSQL Bridge Server Active\x1b[0m`);
  console.log(`  Bridge listening on: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  Target: Local & Remote PostgreSQL databases`);
  console.log(`\x1b[1m\x1b[34m=====================================================\x1b[0m\n`);
  if (!pg) {
    console.log(`\x1b[33mNote: Install "pg" to connect to PostgreSQL: npm install pg\x1b[0m\n`);
  }
});
