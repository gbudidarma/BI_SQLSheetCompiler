/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  X,
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Link2,
  Terminal,
  Table as TableIcon,
  HardDrive,
  ArrowRight,
  Eye,
  EyeOff,
  Search,
  ClipboardPaste,
  Globe,
  Zap,
  Code2,
  FileSpreadsheet,
  Bot
} from 'lucide-react';
import { TableSchema } from '../types';
import { useTheme } from '../context/ThemeContext';

// PostgreSQL Connector
import {
  PostgresConnectionConfig,
  DiscoveredTable as PostgresDiscoveredTable,
  ConnectionTestResult as PostgresTestResult,
  parsePostgresUri,
  testPostgresConnection,
  fetchPostgresTables,
  importPostgresTable,
  DEMO_POSTGRES_PROFILES
} from '../utils/postgresConnector';

// AWS Connector
import {
  AwsConnectionConfig,
  AwsServiceType,
  AwsDiscoveredResource,
  AwsTestResult,
  AWS_REGIONS,
  DEMO_AWS_PROFILES,
  AwsDemoProfile,
  testAwsConnection,
  fetchAwsResources,
  importAwsResource,
  parseS3Uri
} from '../utils/awsConnector';

// Snowflake Connector
import {
  SnowflakeConnectionConfig,
  SnowflakeDiscoveredTable,
  SnowflakeTestResult,
  DEMO_SNOWFLAKE_PROFILES,
  SnowflakeDemoProfile,
  testSnowflakeConnection,
  fetchSnowflakeTables,
  importSnowflakeTable
} from '../utils/snowflakeConnector';

// Google BigQuery Connector
import {
  BigQueryConnectionConfig,
  BigQueryDiscoveredTable,
  BigQueryTestResult,
  BIGQUERY_LOCATIONS,
  DEMO_BIGQUERY_PROFILES,
  BigQueryDemoProfile,
  testBigQueryConnection,
  fetchBigQueryTables,
  importBigQueryTable
} from '../utils/bigqueryConnector';

// MCP Connector (Model Context Protocol, e.g. https://mcp.coros.com/mcp)
import {
  McpConnectionConfig,
  McpTestResult,
  McpDiscoveredResource,
  DEMO_COROS_PROFILE,
  testMcpConnection,
  fetchMcpResources,
  importMcpResource,
  getCorosDemoDataset
} from '../utils/mcpConnector';

// Direct Offline SQL / CSV Paste Ingester (Zero-Bridge Alternative)
import {
  detectPasteFormat,
  ingestPastedData
} from '../utils/sqlPasteIngester';

export type DatabaseProvider = 'postgres' | 'aws' | 'snowflake' | 'bigquery' | 'mcp';

interface DatabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesLoaded: (items: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
  onOpenProModal?: () => void;
  initialProvider?: DatabaseProvider;
}

export const DatabaseConnectionModal: React.FC<DatabaseConnectionModalProps> = ({
  isOpen,
  onClose,
  onTablesLoaded,
  onOpenProModal,
  initialProvider = 'postgres',
}) => {
  const { isBright } = useTheme();

  // Active top-level database provider
  const [activeProvider, setActiveProvider] = useState<DatabaseProvider>(initialProvider);

  // Sub-tabs: 'params' | 'paste' | 'samples' | 'bridge' | 's3_url'
  const [subTab, setSubTab] = useState<'params' | 'paste' | 'samples' | 'bridge' | 's3_url'>('params');

  // ==========================================
  // 1. PostgreSQL State
  // ==========================================
  const [pgConfig, setPgConfig] = useState<PostgresConnectionConfig>({
    host: 'ep-pagila-demo.us-east-2.aws.neon.tech',
    port: 5432,
    database: 'pagila_db',
    user: 'neon_admin',
    password: '',
    sslMode: 'require',
    bridgeUrl: 'http://localhost:54321',
    mode: 'direct_neon',
    neonEndpointUrl: 'https://ep-pagila-demo.us-east-2.aws.neon.tech/sql',
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseKey: '',
  });
  const [rawPgUri, setRawPgUri] = useState('');

  // ==========================================
  // 2. AWS State
  // ==========================================
  const [awsConfig, setAwsConfig] = useState<AwsConnectionConfig>({
    service: 's3',
    mode: 'direct',
    region: 'us-east-1',
    bridgeUrl: 'http://localhost:54321',
    athenaCatalog: 'AwsDataCatalog',
    athenaDatabase: 'analytics_db',
    athenaWorkgroup: 'primary',
    athenaOutputLocation: 's3://aws-athena-query-results-analytics/',
    redshiftHost: 'redshift-cluster-1.c4k1e9x.us-west-2.redshift.amazonaws.com',
    redshiftPort: 5439,
    redshiftDatabase: 'dev',
    redshiftUser: 'awsuser',
    s3Bucket: 'corp-analytics-datalake-prod',
    s3Prefix: 'financial-metrics/',
    s3FileFormat: 'csv',
    s3PresignedUrl: '',
    rdsEngine: 'postgres',
    rdsHost: 'aurora-cluster.us-east-2.rds.amazonaws.com',
    rdsPort: 5432,
    rdsDatabase: 'saas_prod',
    rdsUser: 'postgres',
  });
  const [rawS3Input, setRawS3Input] = useState('');

  // ==========================================
  // 3. Snowflake State
  // ==========================================
  const [snowConfig, setSnowConfig] = useState<SnowflakeConnectionConfig>({
    account: 'xy98765.us-east-1',
    warehouse: 'COMPUTE_WH',
    database: 'RETAIL_DW',
    schema: 'ANALYTICS',
    role: 'ACCOUNTADMIN',
    username: 'snow_analyst',
    password: '',
    token: '',
    bridgeUrl: 'http://localhost:54321',
    mode: 'direct_rest',
  });

  // ==========================================
  // 4. Google BigQuery State
  // ==========================================
  const [bqConfig, setBqConfig] = useState<BigQueryConnectionConfig>({
    projectId: 'bigquery-public-data',
    datasetId: 'ga4_obfuscated_sample_ecommerce',
    location: 'US',
    oauthToken: '',
    bridgeUrl: 'http://localhost:54321',
    mode: 'direct_rest',
  });

  // ==========================================
  // 5. MCP Server State (e.g. https://mcp.coros.com/mcp)
  // ==========================================
  const [mcpConfig, setMcpConfig] = useState<McpConnectionConfig>({
    endpointUrl: 'https://mcp.coros.com/mcp',
    authToken: '',
    mode: 'direct',
  });

  // ==========================================
  // 6. Offline Direct SQL / CSV Paste State
  // ==========================================
  const [pasteText, setPasteText] = useState('');
  const [pasteTableName, setPasteTableName] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [detectedInfo, setDetectedInfo] = useState<{
    format: 'sql' | 'tsv' | 'csv' | 'json';
    lineCount: number;
  } | null>(null);

  // UI shared states
  const [showPassword, setShowPassword] = useState(false);
  const [showMcpTokenHelp, setShowMcpTokenHelp] = useState(false);
  const [copiedTokenCmd, setCopiedTokenCmd] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    title: string;
    details?: string;
    error?: string;
  } | null>(null);

  // Unified discovered tables representation
  const [isFetchingTables, setIsFetchingTables] = useState(false);
  const [discoveredItems, setDiscoveredItems] = useState<{
    name: string;
    schema: string;
    rowCount: number;
    columnCount: number;
  }[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  // Importing state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedWorker, setCopiedWorker] = useState(false);

  // Detect format when paste text updates
  useEffect(() => {
    if (!pasteText.trim()) {
      setDetectedInfo(null);
      setPasteError('');
      return;
    }
    try {
      const fmt = detectPasteFormat(pasteText);
      const lines = pasteText.trim().split(/\r?\n/).length;
      setDetectedInfo({ format: fmt, lineCount: lines });
      setPasteError('');
    } catch (e: any) {
      setPasteError(e.message);
    }
  }, [pasteText]);

  // Reset or initialize on open or provider change
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      setDiscoveredItems([]);
      setSelectedItems({});
      setImportProgress('');
    }
  }, [isOpen, activeProvider]);

  if (!isOpen) return null;

  // Handle PostgreSQL URI parsing
  const handlePgUriChange = (val: string) => {
    setRawPgUri(val);
    const parsed = parsePostgresUri(val);
    if (parsed) {
      setPgConfig((prev) => ({
        ...prev,
        ...parsed,
      }));
    }
  };

  // Handle S3 URI parsing
  const handleS3UriChange = (val: string) => {
    setRawS3Input(val);
    const parsed = parseS3Uri(val);
    if (parsed) {
      setAwsConfig((prev) => ({
        ...prev,
        service: 's3',
        s3Bucket: parsed.bucket,
        s3Key: parsed.key,
        region: parsed.region || prev.region,
        s3PresignedUrl: val.startsWith('http') ? val : prev.s3PresignedUrl,
        mode: val.startsWith('http') ? 'direct' : prev.mode,
      }));
    }
  };

  // Run Test Connection for Active Provider
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (activeProvider === 'postgres') {
        const res = await testPostgresConnection(pgConfig);
        if (res.success) {
          setTestResult({
            success: true,
            latencyMs: res.latencyMs,
            title: `Connected to PostgreSQL (${res.database})`,
            details: `${res.version || 'PostgreSQL 16'} · User: ${res.user}`,
          });
          handleFetchTables();
        } else {
          setTestResult({
            success: false,
            latencyMs: res.latencyMs,
            title: 'PostgreSQL Connection Failed',
            error: res.error,
          });
        }
      } else if (activeProvider === 'aws') {
        const res = await testAwsConnection(awsConfig);
        if (res.success) {
          setTestResult({
            success: true,
            latencyMs: res.latencyMs,
            title: `Connected to AWS ${res.service.toUpperCase()} (${res.region})`,
            details: `${res.version} · ${res.details}`,
          });
          handleFetchTables();
        } else {
          setTestResult({
            success: false,
            latencyMs: res.latencyMs,
            title: `AWS ${awsConfig.service.toUpperCase()} Connection Failed`,
            error: res.error,
          });
        }
      } else if (activeProvider === 'snowflake') {
        const res = await testSnowflakeConnection(snowConfig);
        if (res.success) {
          setTestResult({
            success: true,
            latencyMs: res.latencyMs,
            title: `Connected to Snowflake (${res.database})`,
            details: `${res.version} · Warehouse: ${res.warehouse} · Account: ${res.account}`,
          });
          handleFetchTables();
        } else {
          setTestResult({
            success: false,
            latencyMs: res.latencyMs,
            title: 'Snowflake Connection Failed',
            error: res.error,
          });
        }
      } else if (activeProvider === 'bigquery') {
        const res = await testBigQueryConnection(bqConfig);
        if (res.success) {
          setTestResult({
            success: true,
            latencyMs: res.latencyMs,
            title: `Connected to Google BigQuery (${res.datasetId})`,
            details: `${res.version} · Project: ${res.projectId} · Location: ${res.location}`,
          });
          handleFetchTables();
        } else {
          setTestResult({
            success: false,
            latencyMs: res.latencyMs,
            title: 'Google BigQuery Connection Failed',
            error: res.error,
          });
        }
      } else if (activeProvider === 'mcp') {
        const res = await testMcpConnection(mcpConfig);
        if (res.success) {
          setTestResult({
            success: true,
            latencyMs: res.latencyMs,
            title: `Connected to MCP Server (${res.serverName})`,
            details: `Protocol: ${res.protocolVersion} · Discovered ${res.toolsCount} Tools`,
          });
          handleFetchTables();
        } else {
          setTestResult({
            success: false,
            latencyMs: res.latencyMs,
            title: 'MCP Server Connection Failed',
            error: res.error,
          });
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        title: 'Connection Test Failed',
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Fetch Tables for Active Provider
  const handleFetchTables = async () => {
    setIsFetchingTables(true);
    try {
      let items: { name: string; schema: string; rowCount: number; columnCount: number }[] = [];

      if (activeProvider === 'postgres') {
        const tables = await fetchPostgresTables(pgConfig);
        items = tables.map((t) => ({
          name: t.name,
          schema: t.schema,
          rowCount: t.rowCount,
          columnCount: t.columnCount,
        }));
      } else if (activeProvider === 'aws') {
        const resources = await fetchAwsResources(awsConfig);
        items = resources.map((r) => ({
          name: r.name,
          schema: r.schema || awsConfig.service,
          rowCount: r.rowCount,
          columnCount: r.columnCount,
        }));
      } else if (activeProvider === 'snowflake') {
        const tables = await fetchSnowflakeTables(snowConfig);
        items = tables.map((t) => ({
          name: t.name,
          schema: t.schema,
          rowCount: t.rowCount,
          columnCount: t.columnCount,
        }));
      } else if (activeProvider === 'bigquery') {
        const tables = await fetchBigQueryTables(bqConfig);
        items = tables.map((t) => ({
          name: t.name,
          schema: t.dataset,
          rowCount: t.rowCount,
          columnCount: t.columnCount,
        }));
      } else if (activeProvider === 'mcp') {
        const resources = await fetchMcpResources(mcpConfig);
        items = resources.map((r) => ({
          name: r.name,
          schema: r.schema,
          rowCount: r.rowCount,
          columnCount: r.columnCount,
        }));
      }

      setDiscoveredItems(items);
      const sel: Record<string, boolean> = {};
      items.forEach((item) => {
        sel[item.name] = true;
      });
      setSelectedItems(sel);
    } catch (err: any) {
      setTestResult((prev) => ({
        success: false,
        latencyMs: prev?.latencyMs || 0,
        title: 'Failed to Discover Tables',
        error: err.message,
      }));
    } finally {
      setIsFetchingTables(false);
    }
  };

  // Toggle item selection
  const toggleSelectItem = (name: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    discoveredItems.forEach((item) => {
      next[item.name] = checked;
    });
    setSelectedItems(next);
  };

  // Import Selected Tables from Database Provider
  const handleImport = async () => {
    const toImport = Object.keys(selectedItems).filter((k) => selectedItems[k]);
    if (toImport.length === 0) return;

    setIsImporting(true);
    const importedItems: { schema: TableSchema; rows: Record<string, any>[] }[] = [];

    try {
      for (let i = 0; i < toImport.length; i++) {
        const tblName = toImport[i];
        setImportProgress(`Importing ${tblName} (${i + 1}/${toImport.length})...`);

        if (activeProvider === 'postgres') {
          const res = await importPostgresTable(pgConfig, tblName);
          importedItems.push(res);
        } else if (activeProvider === 'aws') {
          const res = await importAwsResource(awsConfig, tblName);
          importedItems.push(res);
        } else if (activeProvider === 'snowflake') {
          const res = await importSnowflakeTable(snowConfig, tblName, snowConfig.schema);
          importedItems.push(res);
        } else if (activeProvider === 'bigquery') {
          const res = await importBigQueryTable(bqConfig, tblName, bqConfig.datasetId);
          importedItems.push(res);
        } else if (activeProvider === 'mcp') {
          const res = await importMcpResource(mcpConfig, tblName);
          importedItems.push(res);
        }
      }

      onTablesLoaded(importedItems);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        title: 'Import Failed',
        error: err.message,
      });
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  // Import Pasted Data (Zero-Bridge)
  const handleImportPasted = () => {
    try {
      setPasteError('');
      const result = ingestPastedData(pasteText, pasteTableName);
      onTablesLoaded([{ schema: result.schema, rows: result.rows }]);
      onClose();
    } catch (err: any) {
      setPasteError(err.message || 'Failed to parse pasted data.');
    }
  };

  // Load sample content into the Paste tab
  const loadSamplePaste = (type: 'sql' | 'tsv' | 'csv') => {
    if (type === 'sql') {
      setPasteTableName('enterprise_sales_dump');
      setPasteText(
`CREATE TABLE enterprise_sales (
  order_id INT,
  region VARCHAR(50),
  product_name VARCHAR(100),
  quantity INT,
  unit_price NUMERIC(10,2),
  order_date DATE
);

INSERT INTO enterprise_sales VALUES
(101, 'North America', 'Cloud Server 2U', 2, 650.00, '2024-04-01'),
(102, 'Europe', 'Managed Kubernetes Cluster', 1, 1450.00, '2024-04-02'),
(103, 'Asia Pacific', 'AI GPU Accelerator', 4, 1600.00, '2024-04-05'),
(104, 'North America', 'DDoS Protection Gateway', 3, 250.00, '2024-04-08'),
(105, 'Latin America', 'Dedicated Fiber Uplink', 1, 890.00, '2024-04-10');`
      );
    } else if (type === 'tsv') {
      setPasteTableName('dbeaver_query_export');
      setPasteText(
`customer_id\tcompany_name\tcountry\tplan_tier\tmrr_usd\tchurn_risk_pct
CUST-101\tAcme Cloud Inc\tUSA\tEnterprise\t14500.00\t2.5
CUST-102\tNordic Analytics\tSweden\tEnterprise\t22400.00\t1.8
CUST-103\tTokyo Data Works\tJapan\tPro\t4800.00\t8.2
CUST-104\tBerlin FinTech\tGermany\tPro\t6200.00\t14.0
CUST-105\tSydney Logistics\tAustralia\tEnterprise\t18900.00\t3.1`
      );
    } else {
      setPasteTableName('csv_metrics_export');
      setPasteText(
`fiscal_quarter,department,budget_allocated,actual_spend,variance_pct
Q1-2024,Engineering,450000.00,428000.00,-4.88
Q1-2024,Marketing,280000.00,295000.00,5.36
Q1-2024,Sales,320000.00,312000.00,-2.50
Q1-2024,Product,190000.00,185000.00,-2.63
Q1-2024,Operations,140000.00,138500.00,-1.07`
      );
    }
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  const cloudflareWorkerCode = `/**
 * Cloudflare Worker Database Gateway for SheetSQL (Zero Local Bridge)
 * Deploy for free on Cloudflare Workers (https://workers.cloudflare.com)
 */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-snowflake-authorization-token-type",
        },
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({ status: "ok", service: "SheetSQL Cloud Gateway" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Proxy target from header
    const targetUrl = request.headers.get("X-Target-Url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing X-Target-Url header" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.delete("host");

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: modifiedHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined,
    });

    const newRespHeaders = new Headers(resp.headers);
    newRespHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(resp.body, { status: resp.status, headers: newRespHeaders });
  },
};`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-colors ${
          isBright
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#0b1329] border-[#1e2f54] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* Modal Window Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080e1e] border-[#162544]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Enterprise Database Connections</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  Zero Bridge & Direct
                </span>
              </div>
              <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                Connect to PostgreSQL, AWS Cloud, Snowflake, BigQuery, and Model Context Protocol (MCP) servers directly in your browser
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isBright ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#142340] text-slate-400'
            }`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TOP LEVEL DATABASE PROVIDER SELECTOR (5 Options) */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-5 p-2 gap-1.5 border-b select-none ${
            isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#060b17] border-[#121f38]'
          }`}
        >
          {/* 1. PostgreSQL */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider('postgres');
              setSubTab('params');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition cursor-pointer border ${
              activeProvider === 'postgres'
                ? 'bg-indigo-600 text-white font-bold border-indigo-500 shadow-xs'
                : isBright
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#0c162e] hover:bg-[#14264d] text-slate-300 border-[#1a2f59]'
            }`}
          >
            <span className="text-sm">🐘</span>
            <span className="truncate font-semibold">PostgreSQL</span>
          </button>

          {/* 2. AWS Cloud */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider('aws');
              setSubTab('params');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition cursor-pointer border ${
              activeProvider === 'aws'
                ? 'bg-amber-600 text-white font-bold border-amber-500 shadow-xs'
                : isBright
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#0c162e] hover:bg-[#14264d] text-slate-300 border-[#1a2f59]'
            }`}
          >
            <span className="text-sm">☁️</span>
            <span className="truncate font-semibold">AWS Cloud</span>
          </button>

          {/* 3. Snowflake */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider('snowflake');
              setSubTab('params');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition cursor-pointer border ${
              activeProvider === 'snowflake'
                ? 'bg-cyan-600 text-white font-bold border-cyan-500 shadow-xs'
                : isBright
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#0c162e] hover:bg-[#14264d] text-slate-300 border-[#1a2f59]'
            }`}
          >
            <span className="text-sm">❄️</span>
            <span className="truncate font-semibold">Snowflake</span>
          </button>

          {/* 4. Google BigQuery */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider('bigquery');
              setSubTab('params');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition cursor-pointer border ${
              activeProvider === 'bigquery'
                ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-xs'
                : isBright
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#0c162e] hover:bg-[#14264d] text-slate-300 border-[#1a2f59]'
            }`}
          >
            <span className="text-sm">🔍</span>
            <span className="truncate font-semibold">BigQuery</span>
          </button>

          {/* 5. MCP Server (e.g. mcp.coros.com) */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider('mcp');
              setSubTab('params');
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition cursor-pointer border ${
              activeProvider === 'mcp'
                ? 'bg-purple-600 text-white font-bold border-purple-500 shadow-xs'
                : isBright
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-[#0c162e] hover:bg-[#14264d] text-slate-300 border-[#1a2f59]'
            }`}
          >
            <span className="text-sm">🤖</span>
            <span className="truncate font-semibold">MCP Server</span>
          </button>
        </div>

        {/* SUB-TABS (Parameters / Direct API, Paste Dump, Demo Datasets, Cloudflare/Node Bridge) */}
        <div
          className={`flex items-center border-b px-4 text-xs font-medium overflow-x-auto ${
            isBright ? 'border-slate-200 bg-slate-50' : 'border-[#162544] bg-[#091224]'
          }`}
        >
          <button
            onClick={() => setSubTab('params')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              subTab === 'params'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Direct Cloud API & Parameters</span>
          </button>

          <button
            onClick={() => setSubTab('paste')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              subTab === 'paste'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            <span>📋 SQL / CSV Paste (Zero Bridge)</span>
          </button>

          {activeProvider === 'aws' && (
            <button
              onClick={() => setSubTab('s3_url')}
              className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                subTab === 's3_url'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Direct S3 URL</span>
            </button>
          )}

          <button
            onClick={() => setSubTab('samples')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              subTab === 'samples'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Instant Demo Datasets</span>
          </button>

          <button
            onClick={() => setSubTab('bridge')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              subTab === 'bridge'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cloud Gateway & Bridge</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: PARAMETERS & DIRECT CLOUD API */}
          {subTab === 'params' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Mode Selection Pills */}
              <div
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isBright ? 'bg-indigo-50/60 border-indigo-200/80' : 'bg-[#101b33] border-[#1d3159]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Connection Mode:</span>
                    <span className="uppercase font-mono">
                      {activeProvider === 'postgres'
                        ? pgConfig.mode.replace('_', ' ')
                        : activeProvider === 'aws'
                        ? awsConfig.mode
                        : activeProvider === 'snowflake'
                        ? snowConfig.mode.replace('_', ' ')
                        : activeProvider === 'bigquery'
                        ? bqConfig.mode.replace('_', ' ')
                        : mcpConfig.mode}
                    </span>
                  </div>
                  <div className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                    Choose Direct Cloud REST API for zero-install browser connections, or use a bridge gateway.
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black/25 p-1 rounded-lg shrink-0 overflow-x-auto">
                  {/* Postgres Modes */}
                  {activeProvider === 'postgres' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPgConfig((p) => ({ ...p, mode: 'direct_neon' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          pgConfig.mode === 'direct_neon'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Neon HTTP
                      </button>
                      <button
                        type="button"
                        onClick={() => setPgConfig((p) => ({ ...p, mode: 'direct_supabase' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          pgConfig.mode === 'direct_supabase'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Supabase REST
                      </button>
                      <button
                        type="button"
                        onClick={() => setPgConfig((p) => ({ ...p, mode: 'bridge' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          pgConfig.mode === 'bridge'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Gateway / Bridge
                      </button>
                      <button
                        type="button"
                        onClick={() => setPgConfig((p) => ({ ...p, mode: 'demo' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          pgConfig.mode === 'demo'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧪 Demo
                      </button>
                    </>
                  )}

                  {/* AWS Modes */}
                  {activeProvider === 'aws' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAwsConfig((p) => ({ ...p, mode: 'direct' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          awsConfig.mode === 'direct'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ S3 Direct URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setAwsConfig((p) => ({ ...p, mode: 'bridge' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          awsConfig.mode === 'bridge'
                            ? 'bg-amber-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Gateway / Bridge
                      </button>
                      <button
                        type="button"
                        onClick={() => setAwsConfig((p) => ({ ...p, mode: 'demo' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          awsConfig.mode === 'demo'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧪 Demo
                      </button>
                    </>
                  )}

                  {/* Snowflake Modes */}
                  {activeProvider === 'snowflake' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSnowConfig((p) => ({ ...p, mode: 'direct_rest' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          snowConfig.mode === 'direct_rest'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Direct REST API
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnowConfig((p) => ({ ...p, mode: 'bridge' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          snowConfig.mode === 'bridge'
                            ? 'bg-cyan-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Gateway / Bridge
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnowConfig((p) => ({ ...p, mode: 'demo' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          snowConfig.mode === 'demo'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧪 Demo
                      </button>
                    </>
                  )}

                  {/* BigQuery Modes */}
                  {activeProvider === 'bigquery' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setBqConfig((p) => ({ ...p, mode: 'direct_rest' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          bqConfig.mode === 'direct_rest'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Direct REST API
                      </button>
                      <button
                        type="button"
                        onClick={() => setBqConfig((p) => ({ ...p, mode: 'bridge' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          bqConfig.mode === 'bridge'
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🌐 Gateway / Bridge
                      </button>
                      <button
                        type="button"
                        onClick={() => setBqConfig((p) => ({ ...p, mode: 'demo' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          bqConfig.mode === 'demo'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧪 Demo
                      </button>
                    </>
                  )}

                  {/* MCP Modes */}
                  {activeProvider === 'mcp' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMcpConfig((p) => ({ ...p, mode: 'direct' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          mcpConfig.mode === 'direct'
                            ? 'bg-purple-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ Direct MCP HTTP
                      </button>
                      <button
                        type="button"
                        onClick={() => setMcpConfig((p) => ({ ...p, mode: 'demo' }))}
                        className={`px-2 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                          mcpConfig.mode === 'demo'
                            ? 'bg-purple-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🧪 COROS Demo Profile
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 1. POSTGRESQL FORM */}
              {activeProvider === 'postgres' && (
                <div className="space-y-3">
                  {/* Mode: Direct Neon HTTP */}
                  {pgConfig.mode === 'direct_neon' && (
                    <div className="space-y-3 p-3.5 rounded-xl border bg-emerald-950/20 border-emerald-500/30">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <Zap className="w-4 h-4" />
                        <span>Neon Serverless SQL HTTP API (Zero Local Bridge)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Neon natively supports in-browser HTTP queries via official HTTPS endpoints with CORS enabled.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Neon Host or SQL Endpoint
                          </label>
                          <input
                            type="text"
                            value={pgConfig.neonEndpointUrl || pgConfig.host}
                            onChange={(e) => setPgConfig((p) => ({ ...p, neonEndpointUrl: e.target.value, host: e.target.value }))}
                            placeholder="ep-cool-fog-123456.us-east-2.aws.neon.tech"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Neon Password or Bearer Token
                          </label>
                          <input
                            type="password"
                            value={pgConfig.password || ''}
                            onChange={(e) => setPgConfig((p) => ({ ...p, password: e.target.value }))}
                            placeholder="npg_••••••••••••"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode: Direct Supabase REST */}
                  {pgConfig.mode === 'direct_supabase' && (
                    <div className="space-y-3 p-3.5 rounded-xl border bg-emerald-950/20 border-emerald-500/30">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <Zap className="w-4 h-4" />
                        <span>Supabase PostgREST API (Zero Local Bridge)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Fetches PostgreSQL tables directly from Supabase via HTTPS REST APIs with CORS enabled.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Supabase Project URL
                          </label>
                          <input
                            type="text"
                            value={pgConfig.supabaseUrl || ''}
                            onChange={(e) => setPgConfig((p) => ({ ...p, supabaseUrl: e.target.value }))}
                            placeholder="https://xyzproject.supabase.co"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Supabase API Key (anon or service_role)
                          </label>
                          <input
                            type="password"
                            value={pgConfig.supabaseKey || ''}
                            onChange={(e) => setPgConfig((p) => ({ ...p, supabaseKey: e.target.value }))}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode: Bridge / Standard Gateway */}
                  {(pgConfig.mode === 'bridge' || pgConfig.mode === 'demo') && (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Host / Endpoint
                          </label>
                          <input
                            type="text"
                            value={pgConfig.host}
                            onChange={(e) => setPgConfig((p) => ({ ...p, host: e.target.value }))}
                            placeholder="localhost or db.example.com"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Port
                          </label>
                          <input
                            type="number"
                            value={pgConfig.port}
                            onChange={(e) => setPgConfig((p) => ({ ...p, port: parseInt(e.target.value, 10) || 5432 }))}
                            placeholder="5432"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Database
                          </label>
                          <input
                            type="text"
                            value={pgConfig.database}
                            onChange={(e) => setPgConfig((p) => ({ ...p, database: e.target.value }))}
                            placeholder="postgres"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Username
                          </label>
                          <input
                            type="text"
                            value={pgConfig.user}
                            onChange={(e) => setPgConfig((p) => ({ ...p, user: e.target.value }))}
                            placeholder="postgres"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Password
                          </label>
                          <input
                            type="password"
                            value={pgConfig.password || ''}
                            onChange={(e) => setPgConfig((p) => ({ ...p, password: e.target.value }))}
                            placeholder="••••••••"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                      </div>

                      {pgConfig.mode === 'bridge' && (
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            Bridge / Gateway URL (Local or Remote Cloudflare Worker)
                          </label>
                          <input
                            type="text"
                            value={pgConfig.bridgeUrl || 'http://localhost:54321'}
                            onChange={(e) => setPgConfig((p) => ({ ...p, bridgeUrl: e.target.value }))}
                            placeholder="http://localhost:54321 or https://my-proxy.workers.dev"
                            className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                              isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                            }`}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 2. AWS CLOUD FORM */}
              {activeProvider === 'aws' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setAwsConfig((p) => ({ ...p, service: 's3' }))}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                        awsConfig.service === 's3' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#121f38] text-slate-300'
                      }`}
                    >
                      🪣 S3 Buckets & Direct URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwsConfig((p) => ({ ...p, service: 'athena' }))}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                        awsConfig.service === 'athena' ? 'bg-amber-600 text-white font-bold' : 'bg-[#121f38] text-slate-300'
                      }`}
                    >
                      🔶 Athena (S3 Lake)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwsConfig((p) => ({ ...p, service: 'redshift' }))}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                        awsConfig.service === 'redshift' ? 'bg-red-600 text-white font-bold' : 'bg-[#121f38] text-slate-300'
                      }`}
                    >
                      🔴 Redshift DW
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwsConfig((p) => ({ ...p, service: 'rds' }))}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                        awsConfig.service === 'rds' ? 'bg-blue-600 text-white font-bold' : 'bg-[#121f38] text-slate-300'
                      }`}
                    >
                      🐬 RDS / Aurora
                    </button>
                  </div>

                  {awsConfig.service === 's3' && (
                    <div className="space-y-2 p-3 rounded-xl border bg-emerald-950/20 border-emerald-500/30">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Direct S3 Presigned URL (Zero Local Bridge)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Paste any S3 Presigned URL or public S3 object link to fetch CSV, JSON, or Excel directly in your browser.
                      </p>
                      <input
                        type="text"
                        value={awsConfig.s3PresignedUrl || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAwsConfig((p) => ({ ...p, s3PresignedUrl: val, mode: 'direct' }));
                          handleS3UriChange(val);
                        }}
                        placeholder="https://my-bucket.s3.us-east-1.amazonaws.com/sales_report.csv?..."
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        AWS Region
                      </label>
                      <select
                        value={awsConfig.region}
                        onChange={(e) => setAwsConfig((p) => ({ ...p, region: e.target.value }))}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      >
                        {AWS_REGIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {awsConfig.service === 'athena' && (
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Athena Database
                        </label>
                        <input
                          type="text"
                          value={awsConfig.athenaDatabase || 'analytics_db'}
                          onChange={(e) => setAwsConfig((p) => ({ ...p, athenaDatabase: e.target.value }))}
                          placeholder="analytics_db"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>
                    )}

                    {awsConfig.service === 'redshift' && (
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Redshift Endpoint
                        </label>
                        <input
                          type="text"
                          value={awsConfig.redshiftHost || ''}
                          onChange={(e) => setAwsConfig((p) => ({ ...p, redshiftHost: e.target.value }))}
                          placeholder="cluster.redshift.amazonaws.com"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. SNOWFLAKE FORM */}
              {activeProvider === 'snowflake' && (
                <div className="space-y-3">
                  {snowConfig.mode === 'direct_rest' && (
                    <div className="space-y-2 p-3 rounded-xl border bg-emerald-950/20 border-emerald-500/30">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Direct Snowflake SQL REST API v2 (Zero Local Bridge)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Query Snowflake directly via HTTPS with OAuth, Programmatic Access Tokens (PAT), or Key-Pair JWT.
                      </p>
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          OAuth Bearer Token or Programmatic Access Token (PAT)
                        </label>
                        <input
                          type="password"
                          value={snowConfig.token || ''}
                          onChange={(e) => setSnowConfig((p) => ({ ...p, token: e.target.value }))}
                          placeholder="eyJraWQiOiI..."
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Snowflake Account Identifier
                      </label>
                      <input
                        type="text"
                        value={snowConfig.account}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, account: e.target.value }))}
                        placeholder="xy12345.us-east-1 or org-account"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Warehouse
                      </label>
                      <input
                        type="text"
                        value={snowConfig.warehouse}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, warehouse: e.target.value }))}
                        placeholder="COMPUTE_WH"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Database
                      </label>
                      <input
                        type="text"
                        value={snowConfig.database}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, database: e.target.value }))}
                        placeholder="RETAIL_DW"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Schema
                      </label>
                      <input
                        type="text"
                        value={snowConfig.schema}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, schema: e.target.value }))}
                        placeholder="PUBLIC"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Role
                      </label>
                      <input
                        type="text"
                        value={snowConfig.role}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, role: e.target.value }))}
                        placeholder="ACCOUNTADMIN"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. GOOGLE BIGQUERY FORM */}
              {activeProvider === 'bigquery' && (
                <div className="space-y-3">
                  {bqConfig.mode === 'direct_rest' && (
                    <div className="space-y-2 p-3 rounded-xl border bg-emerald-950/20 border-emerald-500/30">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Direct Google BigQuery REST API v2 (Zero Local Bridge)</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Query BigQuery datasets directly via Google Cloud REST APIs with an OAuth access token (generated via <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300">gcloud auth print-access-token</code>).
                      </p>
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Google Cloud OAuth Access Token
                        </label>
                        <input
                          type="password"
                          value={bqConfig.oauthToken || ''}
                          onChange={(e) => setBqConfig((p) => ({ ...p, oauthToken: e.target.value }))}
                          placeholder="ya29.a0AfH6SM..."
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Google Cloud Project ID
                      </label>
                      <input
                        type="text"
                        value={bqConfig.projectId}
                        onChange={(e) => setBqConfig((p) => ({ ...p, projectId: e.target.value }))}
                        placeholder="gcp-enterprise-analytics-2024"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Dataset ID
                      </label>
                      <input
                        type="text"
                        value={bqConfig.datasetId}
                        onChange={(e) => setBqConfig((p) => ({ ...p, datasetId: e.target.value }))}
                        placeholder="ga4_ecommerce"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                      Dataset Processing Location
                    </label>
                    <select
                      value={bqConfig.location}
                      onChange={(e) => setBqConfig((p) => ({ ...p, location: e.target.value }))}
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                        isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                      }`}
                    >
                      {BIGQUERY_LOCATIONS.map((loc) => (
                        <option key={loc.value} value={loc.value}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 5. MCP SERVER FORM (e.g. mcp.coros.com) */}
              {activeProvider === 'mcp' && (
                <div className="space-y-3">
                  <div className="space-y-2 p-3.5 rounded-xl border bg-purple-950/20 border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                        <Bot className="w-4 h-4" />
                        <span>Model Context Protocol (MCP) Remote Server</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-400">Presets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMcpConfig((p) => ({ ...p, endpointUrl: 'https://mcp.coros.com/mcp', mode: 'direct' }));
                          }}
                          className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-medium cursor-pointer"
                        >
                          COROS Wearables
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMcpConfig((p) => ({ ...p, endpointUrl: 'http://localhost:3001/sse', mode: 'direct' }));
                          }}
                          className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-medium cursor-pointer"
                        >
                          Local SSE
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Connect to any remote MCP endpoint via HTTP JSON-RPC 2.0. Discovers all tools and resources (e.g. activities, fitness logs, database queries) and imports them directly into AlaSQL.
                    </p>

                    <div className="space-y-3 pt-1">
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          MCP Endpoint URL
                        </label>
                        <input
                          type="text"
                          value={mcpConfig.endpointUrl}
                          onChange={(e) => setMcpConfig((p) => ({ ...p, endpointUrl: e.target.value }))}
                          placeholder="https://mcp.coros.com/mcp"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`block text-[11px] font-semibold ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                            OAuth / Bearer Token
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowMcpTokenHelp(!showMcpTokenHelp)}
                            className="text-[11px] text-purple-400 hover:text-purple-300 font-medium underline cursor-pointer flex items-center gap-1"
                          >
                            <span>{showMcpTokenHelp ? 'Hide Token Guide' : '🔑 How to get token?'}</span>
                          </button>
                        </div>
                        <input
                          type="password"
                          value={mcpConfig.authToken || ''}
                          onChange={(e) => setMcpConfig((p) => ({ ...p, authToken: e.target.value }))}
                          placeholder="Bearer eyJhbGciOi..."
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />

                        {showMcpTokenHelp && (
                          <div className={`mt-2 p-3 rounded-xl border text-[11px] space-y-2 animate-in fade-in ${
                            isBright ? 'bg-purple-50/70 border-purple-200 text-slate-700' : 'bg-[#150e26] border-purple-800/40 text-purple-200'
                          }`}>
                            <div className="font-semibold text-purple-300 flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Key className="w-3.5 h-3.5 text-purple-400" />
                                <span>Get COROS OAuth Token via Official CLI (1 Step)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText('npx coros-mcp login');
                                  setCopiedTokenCmd(true);
                                  setTimeout(() => setCopiedTokenCmd(false), 2000);
                                }}
                                className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 flex items-center gap-1 text-[10px] cursor-pointer"
                              >
                                {copiedTokenCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedTokenCmd ? 'Copied!' : 'Copy Command'}</span>
                              </button>
                            </div>
                            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
                              <li>
                                Run in your terminal:
                                <div className="mt-1 font-mono text-[10px] bg-black/50 px-2 py-1.5 rounded-lg border border-purple-900/40 text-purple-300 flex items-center justify-between">
                                  <span>npx coros-mcp login</span>
                                </div>
                              </li>
                              <li>
                                Open the printed link (<code className="text-purple-300 font-mono text-[10px]">https://mcpus.coros.com/cli/login/...</code>) in your browser and authorize your COROS account.
                              </li>
                              <li>
                                Read the saved token file:
                                <div className="mt-1 font-mono text-[10px] bg-black/50 px-2 py-1.5 rounded-lg border border-purple-900/40 text-slate-300">
                                  cat ~/.coros-mcp-skill-gateway-ts/us/token.json
                                </div>
                              </li>
                              <li>
                                Copy the <code className="text-purple-300 font-mono">access_token</code> string and paste it into the field above! (Valid for 30 days).
                              </li>
                            </ol>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                          <span>Tip: If testing without a COROS token yet, switch mode to</span>
                          <button
                            type="button"
                            onClick={() => setMcpConfig((p) => ({ ...p, mode: 'demo' }))}
                            className="text-purple-400 hover:underline font-semibold cursor-pointer"
                          >
                            🧪 COROS Demo Profile
                          </button>
                          <span>to explore real GPS running, HRV, and marathon metrics!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OFFLINE DIRECT SQL / CSV PASTE INGESTER (ZERO BRIDGE) */}
          {subTab === 'paste' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isBright ? 'bg-emerald-50/60 border-emerald-300' : 'bg-[#0b1c2b] border-[#163e5c]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <ClipboardPaste className="w-4 h-4" />
                    <span>Direct SQL Dump & DB Query Grid Ingester (100% In-Browser)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400">Quick Samples:</span>
                    <button
                      type="button"
                      onClick={() => loadSamplePaste('sql')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium cursor-pointer"
                    >
                      SQL Dump
                    </button>
                    <button
                      type="button"
                      onClick={() => loadSamplePaste('tsv')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium cursor-pointer"
                    >
                      DBeaver TSV
                    </button>
                    <button
                      type="button"
                      onClick={() => loadSamplePaste('csv')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-medium cursor-pointer"
                    >
                      CSV
                    </button>
                  </div>
                </div>

                <p className={`text-[11px] leading-relaxed ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  Export or copy query results from any SQL tool (DBeaver, pgAdmin, Snowflake Snowsight, BigQuery Studio, DataGrip, or pg_dump) and paste them below. SheetSQL automatically parses schema and rows in memory without network calls or bridge servers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                      Destination Table Name
                    </label>
                    <input
                      type="text"
                      value={pasteTableName}
                      onChange={(e) => setPasteTableName(e.target.value)}
                      placeholder="e.g. enterprise_customers"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                        isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                      }`}
                    />
                  </div>
                  <div className="flex items-end">
                    {detectedInfo ? (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 w-full">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono text-[11px]">
                          Format: <strong className="uppercase">{detectedInfo.format}</strong> ({detectedInfo.lineCount} lines)
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-black/20 text-slate-400 text-xs font-mono text-[11px] w-full text-center">
                        Waiting for input...
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`-- Paste SQL statements (CREATE TABLE & INSERT INTO), or\n-- Paste copy-pasted grid rows from DBeaver / Snowflake / BigQuery, or\n-- Paste CSV text with headers...`}
                  rows={8}
                  className={`w-full p-2.5 text-xs font-mono rounded-lg border resize-none ${
                    isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                  }`}
                />

                {pasteError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>{pasteError}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!pasteText.trim()}
                    onClick={handleImportPasted}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Import Pasted Table into SheetSQL</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: S3 DIRECT URL */}
          {subTab === 's3_url' && activeProvider === 'aws' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isBright ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#0c1b2c] border-[#1a3854]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Link2 className="w-4 h-4" />
                  <span>Direct S3 Presigned URL or Public S3 Link (Zero Local Bridge)</span>
                </div>
                <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  In the AWS S3 Console, click your object (CSV, TSV, or XLSX) and choose &quot;Share with a presigned URL&quot; (or use any public bucket URL). SheetSQL downloads and parses it directly in your browser.
                </p>
                <textarea
                  value={rawS3Input}
                  onChange={(e) => handleS3UriChange(e.target.value)}
                  placeholder="https://my-bucket.s3.us-east-1.amazonaws.com/sales_2024.csv?..."
                  rows={3}
                  className={`w-full p-2.5 text-xs font-mono rounded-lg border resize-none ${
                    isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                  }`}
                />
              </div>
            </div>
          )}

          {/* TAB 4: INSTANT DEMO DATASETS */}
          {subTab === 'samples' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div
                className={`p-3 rounded-lg border text-xs ${
                  isBright ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-indigo-950/20 border-indigo-500/30 text-indigo-300'
                }`}
              >
                <strong className="font-semibold">Instant In-Browser Data Warehouse Testing:</strong>{' '}
                Explore realistic datasets without needing credentials or database setups.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeProvider === 'postgres' &&
                  DEMO_POSTGRES_PROFILES.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => {
                        setPgConfig({
                          host: prof.host,
                          port: prof.port,
                          database: prof.database,
                          user: prof.user,
                          password: '••••••••',
                          sslMode: 'require',
                          bridgeUrl: 'http://localhost:54321',
                          mode: 'demo',
                          name: prof.title,
                        });
                        setSubTab('params');
                      }}
                      className="p-3 rounded-xl border cursor-pointer hover:border-indigo-500 transition-colors bg-[#0c162e] border-[#182a4d]"
                    >
                      <div className="text-xs font-bold text-indigo-400 mb-1">{prof.title}</div>
                      <div className="text-[11px] text-slate-400 mb-2">{prof.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {prof.tables.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101f3b] text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                {activeProvider === 'aws' &&
                  DEMO_AWS_PROFILES.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => {
                        setAwsConfig((p) => ({
                          ...p,
                          service: prof.service,
                          region: prof.region,
                          mode: 'demo',
                          name: prof.title,
                        }));
                        setSubTab('params');
                      }}
                      className="p-3 rounded-xl border cursor-pointer hover:border-amber-500 transition-colors bg-[#0c162e] border-[#182a4d]"
                    >
                      <div className="text-xs font-bold text-amber-500 mb-1">{prof.title}</div>
                      <div className="text-[11px] text-slate-400 mb-2">{prof.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {prof.tables.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101f3b] text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                {activeProvider === 'snowflake' &&
                  DEMO_SNOWFLAKE_PROFILES.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => {
                        setSnowConfig((p) => ({
                          ...p,
                          account: prof.account,
                          warehouse: prof.warehouse,
                          database: prof.database,
                          schema: prof.schema,
                          mode: 'demo',
                          name: prof.title,
                        }));
                        setSubTab('params');
                      }}
                      className="p-3 rounded-xl border cursor-pointer hover:border-cyan-500 transition-colors bg-[#0c162e] border-[#182a4d]"
                    >
                      <div className="text-xs font-bold text-cyan-400 mb-1">{prof.title}</div>
                      <div className="text-[11px] text-slate-400 mb-2">{prof.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {prof.tables.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101f3b] text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                {activeProvider === 'bigquery' &&
                  DEMO_BIGQUERY_PROFILES.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => {
                        setBqConfig((p) => ({
                          ...p,
                          projectId: prof.projectId,
                          datasetId: prof.datasetId,
                          location: prof.location,
                          mode: 'demo',
                          name: prof.title,
                        }));
                        setSubTab('params');
                      }}
                      className="p-3 rounded-xl border cursor-pointer hover:border-blue-500 transition-colors bg-[#0c162e] border-[#182a4d]"
                    >
                      <div className="text-xs font-bold text-blue-400 mb-1">{prof.title}</div>
                      <div className="text-[11px] text-slate-400 mb-2">{prof.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {prof.tables.map((t) => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101f3b] text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                {activeProvider === 'mcp' && (
                  <div
                    onClick={() => {
                      setMcpConfig({
                        endpointUrl: DEMO_COROS_PROFILE.endpointUrl,
                        mode: 'demo',
                        name: DEMO_COROS_PROFILE.title,
                      });
                      setSubTab('params');
                    }}
                    className="p-3 rounded-xl border cursor-pointer hover:border-purple-500 transition-colors bg-[#0c162e] border-[#182a4d]"
                  >
                    <div className="text-xs font-bold text-purple-400 mb-1 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      <span>{DEMO_COROS_PROFILE.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">{DEMO_COROS_PROFILE.description}</div>
                    <div className="flex flex-wrap gap-1">
                      {DEMO_COROS_PROFILE.tables.map((t) => (
                        <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101f3b] text-slate-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CLOUDFLARE WORKER & NODE.JS BRIDGE GUIDE */}
          {subTab === 'bridge' && (
            <div className="space-y-3 text-xs animate-in fade-in duration-150">
              {/* Option A: Cloudflare Worker Gateway (Zero Local Bridge) */}
              <div
                className={`p-3.5 rounded-xl border ${
                  isBright ? 'bg-cyan-50/50 border-cyan-200' : 'bg-[#0a1e33] border-[#143d66]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm flex items-center gap-2 text-cyan-400">
                    <Globe className="w-4 h-4" />
                    <span>Option 1: Deploy a Free Cloudflare Worker (Zero Local Bridge)</span>
                  </h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(cloudflareWorkerCode);
                      setCopiedWorker(true);
                      setTimeout(() => setCopiedWorker(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition cursor-pointer font-medium text-[11px]"
                  >
                    {copiedWorker ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWorker ? 'Copied Worker Script' : 'Copy Worker Script'}</span>
                  </button>
                </div>
                <p className={`text-[11px] leading-relaxed mb-2.5 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  Deploy this free 25-line Cloudflare Worker in 30 seconds at <strong className="text-cyan-400">workers.cloudflare.com</strong>. It handles CORS proxying in the cloud 24/7 without needing Node.js or any open terminals on your computer.
                </p>
                <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-24">
                  <pre>{cloudflareWorkerCode.slice(0, 320)}...</pre>
                </div>
              </div>

              {/* Option B: Local Node.js Bridge */}
              <div
                className={`p-3.5 rounded-xl border ${
                  isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                }`}
              >
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>Option 2: Local Node.js Bridge Server</span>
                </h4>
                <p className={`text-[11px] leading-relaxed mb-3 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  If you are developing locally with terminal access, you can run the included bridge script to connect to private local databases.
                </p>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Start the Unified Bridge:</div>
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-lg font-mono text-xs border ${
                      isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#070d1a] border-[#162544] text-indigo-300'
                    }`}
                  >
                    <span>npm run bridge</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('npm run bridge');
                        setCopiedCmd(true);
                        setTimeout(() => setCopiedCmd(false), 2000);
                      }}
                      className="p-1 hover:text-white transition cursor-pointer"
                      title="Copy command"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Test Result Message Box */}
          {testResult && subTab === 'params' && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                testResult.success
                  ? isBright
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : isBright
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold flex items-center justify-between">
                  <span>{testResult.title}</span>
                  <span className="font-mono text-[11px] opacity-80">{testResult.latencyMs}ms</span>
                </div>
                {testResult.details && <div className="text-[11px] opacity-90 mt-0.5">{testResult.details}</div>}
                {testResult.error && <div className="text-[11px] font-mono mt-1 text-rose-400">{testResult.error}</div>}
              </div>
            </div>
          )}

          {/* Discovered Tables List */}
          {discoveredItems.length > 0 && subTab === 'params' && (
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold">
                    Discovered Tables ({discoveredItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-indigo-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="opacity-40">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {discoveredItems.map((item) => {
                  const isChecked = !!selectedItems[item.name];
                  return (
                    <div
                      key={item.name}
                      onClick={() => toggleSelectItem(item.name)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition cursor-pointer select-none ${
                        isChecked
                          ? isBright
                            ? 'bg-indigo-50 border-indigo-300 text-slate-800'
                            : 'bg-indigo-950/25 border-indigo-500/40 text-slate-200'
                          : isBright
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'bg-[#080d1a] border-[#182747] text-slate-400 hover:bg-[#101b33]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded text-indigo-500 focus:ring-indigo-500"
                        />
                        <span className="font-mono font-semibold">{item.name}</span>
                        {item.schema && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isBright ? 'bg-slate-200 text-slate-600' : 'bg-[#142340] text-slate-400'
                          }`}>
                            {item.schema}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] opacity-75">
                        {item.rowCount > 0 && <span>{item.rowCount.toLocaleString()} rows</span>}
                        {item.columnCount > 0 && <span>· {item.columnCount} cols</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t select-none ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080d1a] border-[#14213d]'
          }`}
        >
          {/* Left: Test Connection / Status (shown in params tab) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {subTab === 'params' && (
              <>
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 ${
                    isBright
                      ? 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-[#121f3d] hover:bg-[#1a2d59] text-slate-200 border border-[#1f3563]'
                  }`}
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {discoveredItems.length === 0 && (
                  <button
                    type="button"
                    disabled={isFetchingTables}
                    onClick={handleFetchTables}
                    className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                      isBright ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-[#121f3d] text-slate-300'
                    }`}
                  >
                    {isFetchingTables ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                    <span>Discover Tables</span>
                  </button>
                )}
              </>
            )}

            {subTab === 'paste' && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Network / Instant Offline AlaSQL Import</span>
              </span>
            )}

            {importProgress && (
              <span className="text-xs text-indigo-400 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{importProgress}</span>
              </span>
            )}
          </div>

          {/* Right: Cancel & Import Action */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isBright ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-[#142340] text-slate-400'
              }`}
            >
              Cancel
            </button>

            {subTab === 'paste' ? (
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={handleImportPasted}
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Import Table</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={selectedCount === 0 || isImporting}
                onClick={handleImport}
                className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeProvider === 'postgres'
                    ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30'
                    : activeProvider === 'aws'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                    : activeProvider === 'snowflake'
                    ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                    : activeProvider === 'bigquery'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/30'
                }`}
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>
                  {selectedCount > 0 ? `Import ${selectedCount} Table${selectedCount > 1 ? 's' : ''}` : 'Select Tables to Import'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
