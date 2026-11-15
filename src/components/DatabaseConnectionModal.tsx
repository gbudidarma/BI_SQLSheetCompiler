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
  Search
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

export type DatabaseProvider = 'postgres' | 'aws' | 'snowflake' | 'bigquery';

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

  // Sub-tabs: 'params' | 'samples' | 'bridge' | 's3_url'
  const [subTab, setSubTab] = useState<'params' | 'samples' | 'bridge' | 's3_url'>('params');

  // ==========================================
  // 1. PostgreSQL State
  // ==========================================
  const [pgConfig, setPgConfig] = useState<PostgresConnectionConfig>({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    sslMode: 'prefer',
    bridgeUrl: 'http://localhost:54321',
    mode: 'demo',
  });
  const [rawPgUri, setRawPgUri] = useState('');

  // ==========================================
  // 2. AWS State
  // ==========================================
  const [awsConfig, setAwsConfig] = useState<AwsConnectionConfig>({
    service: 'athena',
    mode: 'demo',
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
    bridgeUrl: 'http://localhost:54321',
    mode: 'demo',
  });

  // ==========================================
  // 4. Google BigQuery State
  // ==========================================
  const [bqConfig, setBqConfig] = useState<BigQueryConnectionConfig>({
    projectId: 'bigquery-public-data',
    datasetId: 'ga4_obfuscated_sample_ecommerce',
    location: 'US',
    bridgeUrl: 'http://localhost:54321',
    mode: 'demo',
  });

  // UI shared states
  const [showPassword, setShowPassword] = useState(false);
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
        mode: 'bridge',
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

  // Import Selected Tables
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

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

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
                  Unified Hub
                </span>
              </div>
              <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                Connect to PostgreSQL, AWS Cloud, Snowflake, and Google BigQuery in one unified studio
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

        {/* TOP LEVEL DATABASE PROVIDER SELECTOR */}
        <div
          className={`grid grid-cols-4 p-2 gap-1.5 border-b select-none ${
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
        </div>

        {/* SUB-TABS (Parameters, Demo Profiles, Bridge Guide, URL/Direct) */}
        <div
          className={`flex items-center border-b px-4 text-xs font-medium ${
            isBright ? 'border-slate-200 bg-slate-50' : 'border-[#162544] bg-[#091224]'
          }`}
        >
          <button
            onClick={() => setSubTab('params')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'params'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connection Parameters</span>
          </button>

          {activeProvider === 'aws' && awsConfig.service === 's3' && (
            <button
              onClick={() => setSubTab('s3_url')}
              className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                subTab === 's3_url'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Direct S3 URL</span>
            </button>
          )}

          <button
            onClick={() => setSubTab('samples')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'samples'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Demo Datasets</span>
          </button>

          <button
            onClick={() => setSubTab('bridge')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'bridge'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Node.js Bridge Guide</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB: PARAMETERS */}
          {subTab === 'params' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Mode Banner / Pill */}
              <div
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isBright ? 'bg-indigo-50/60 border-indigo-200/80' : 'bg-[#101b33] border-[#1d3159]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <span>Selected Provider:</span>
                    <span className="uppercase font-mono">{activeProvider}</span>
                  </div>
                  <div className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                    Test instantly with in-browser demo data or connect via local bridge server.
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeProvider === 'postgres') setPgConfig((p) => ({ ...p, mode: 'demo' }));
                      if (activeProvider === 'aws') setAwsConfig((p) => ({ ...p, mode: 'demo' }));
                      if (activeProvider === 'snowflake') setSnowConfig((p) => ({ ...p, mode: 'demo' }));
                      if (activeProvider === 'bigquery') setBqConfig((p) => ({ ...p, mode: 'demo' }));
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                      (activeProvider === 'postgres' && pgConfig.mode === 'demo') ||
                      (activeProvider === 'aws' && awsConfig.mode === 'demo') ||
                      (activeProvider === 'snowflake' && snowConfig.mode === 'demo') ||
                      (activeProvider === 'bigquery' && bqConfig.mode === 'demo')
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Demo (In-Browser)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeProvider === 'postgres') setPgConfig((p) => ({ ...p, mode: 'bridge' }));
                      if (activeProvider === 'aws') setAwsConfig((p) => ({ ...p, mode: 'bridge' }));
                      if (activeProvider === 'snowflake') setSnowConfig((p) => ({ ...p, mode: 'bridge' }));
                      if (activeProvider === 'bigquery') setBqConfig((p) => ({ ...p, mode: 'bridge' }));
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                      (activeProvider === 'postgres' && pgConfig.mode === 'bridge') ||
                      (activeProvider === 'aws' && awsConfig.mode === 'bridge') ||
                      (activeProvider === 'snowflake' && snowConfig.mode === 'bridge') ||
                      (activeProvider === 'bigquery' && bqConfig.mode === 'bridge')
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Local Bridge
                  </button>
                </div>
              </div>

              {/* 1. POSTGRESQL FORM */}
              {activeProvider === 'postgres' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Host / Endpoint
                      </label>
                      <input
                        type="text"
                        value={pgConfig.host}
                        onChange={(e) => setPgConfig((p) => ({ ...p, host: e.target.value }))}
                        placeholder="localhost"
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
                </div>
              )}

              {/* 2. AWS CLOUD FORM */}
              {activeProvider === 'aws' && (
                <div className="space-y-3">
                  {/* AWS Sub-service Selector */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
                      onClick={() => setAwsConfig((p) => ({ ...p, service: 's3' }))}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer ${
                        awsConfig.service === 's3' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#121f38] text-slate-300'
                      }`}
                    >
                      🪣 S3 Buckets
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

                    {awsConfig.service === 's3' && (
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          S3 Bucket Name
                        </label>
                        <input
                          type="text"
                          value={awsConfig.s3Bucket || ''}
                          onChange={(e) => setAwsConfig((p) => ({ ...p, s3Bucket: e.target.value }))}
                          placeholder="corp-analytics-datalake"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                            isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                          }`}
                        />
                      </div>
                    )}

                    {awsConfig.service === 'rds' && (
                      <div>
                        <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Aurora / RDS Endpoint
                        </label>
                        <input
                          type="text"
                          value={awsConfig.rdsHost || ''}
                          onChange={(e) => setAwsConfig((p) => ({ ...p, rdsHost: e.target.value }))}
                          placeholder="aurora-cluster.rds.amazonaws.com"
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
                        Username
                      </label>
                      <input
                        type="text"
                        value={snowConfig.username}
                        onChange={(e) => setSnowConfig((p) => ({ ...p, username: e.target.value }))}
                        placeholder="snow_analyst"
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
            </div>
          )}

          {/* TAB: S3 DIRECT URL (AWS only) */}
          {subTab === 's3_url' && activeProvider === 'aws' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border space-y-2.5 ${
                  isBright ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#0c1b2c] border-[#1a3854]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                  <Link2 className="w-4 h-4" />
                  <span>Direct S3 Presigned URL or Public S3 Link</span>
                </div>
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

          {/* TAB: INSTANT DEMO DATASETS */}
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
              </div>
            </div>
          )}

          {/* TAB: NODE.JS BRIDGE GUIDE */}
          {subTab === 'bridge' && (
            <div className="space-y-3 text-xs animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border ${
                  isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                }`}
              >
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>Unified Enterprise Database Bridge Server</span>
                </h4>
                <p className={`text-[11px] leading-relaxed mb-3 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  Connect SheetSQL to your local or private cloud databases (PostgreSQL, AWS, Snowflake, and BigQuery) without exposing sensitive database credentials in browser traffic or hitting CORS issues.
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
          {testResult && (
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
          {discoveredItems.length > 0 && (
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
          {/* Left: Test Connection / Status */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
              }`}
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>
                {selectedCount > 0 ? `Import ${selectedCount} Table${selectedCount > 1 ? 's' : ''}` : 'Select Tables to Import'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
