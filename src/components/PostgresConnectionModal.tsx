/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
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
  ExternalLink,
  Table as TableIcon
} from 'lucide-react';
import { TableSchema } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  PostgresConnectionConfig,
  DiscoveredTable,
  ConnectionTestResult,
  parsePostgresUri,
  testPostgresConnection,
  fetchPostgresTables,
  importPostgresTable,
  DEMO_POSTGRES_PROFILES
} from '../utils/postgresConnector';

interface PostgresConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesLoaded: (items: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
}

export const PostgresConnectionModal: React.FC<PostgresConnectionModalProps> = ({
  isOpen,
  onClose,
  onTablesLoaded,
}) => {
  const { isBright } = useTheme();

  // Active tab in DBeaver modal
  const [activeTab, setActiveTab] = useState<'main' | 'url' | 'bridge' | 'samples'>('main');

  // Connection parameters
  const [config, setConfig] = useState<PostgresConnectionConfig>({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    sslMode: 'prefer',
    bridgeUrl: 'http://localhost:54321',
    mode: 'bridge',
  });

  const [rawUri, setRawUri] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Connection testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Table discovery state
  const [isFetchingTables, setIsFetchingTables] = useState(false);
  const [discoveredTables, setDiscoveredTables] = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({});

  // Importing state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');

  // Copied helper
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Reset or initialize state
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      setDiscoveredTables([]);
      setSelectedTables({});
      setImportProgress('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle URL Paste
  const handleUriChange = (val: string) => {
    setRawUri(val);
    const parsed = parsePostgresUri(val);
    if (parsed) {
      setConfig((prev) => ({
        ...prev,
        ...parsed,
        mode: prev.mode === 'demo' ? 'bridge' : prev.mode,
      }));
    }
  };

  // Run Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testPostgresConnection(config);
      setTestResult(res);
      if (res.success) {
        // Automatically fetch tables on successful test
        handleFetchTables();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Fetch Tables
  const handleFetchTables = async () => {
    setIsFetchingTables(true);
    try {
      const tables = await fetchPostgresTables(config);
      setDiscoveredTables(tables);
      // Select all discovered tables by default
      const sel: Record<string, boolean> = {};
      tables.forEach((t) => {
        sel[t.name] = true;
      });
      setSelectedTables(sel);
    } catch (err: any) {
      setTestResult((prev) => ({
        success: false,
        latencyMs: prev?.latencyMs || 0,
        error: err.message || 'Failed to fetch table list',
      }));
    } finally {
      setIsFetchingTables(false);
    }
  };

  // Toggle Table selection
  const toggleSelectTable = (tblName: string) => {
    setSelectedTables((prev) => ({
      ...prev,
      [tblName]: !prev[tblName],
    }));
  };

  // Select all or none
  const toggleSelectAllTables = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    discoveredTables.forEach((t) => {
      next[t.name] = checked;
    });
    setSelectedTables(next);
  };

  // Import Selected Tables
  const handleImport = async () => {
    const tableNamesToImport = Object.keys(selectedTables).filter((k) => selectedTables[k]);
    if (tableNamesToImport.length === 0) return;

    setIsImporting(true);
    const importedItems: { schema: TableSchema; rows: Record<string, any>[] }[] = [];

    try {
      for (let i = 0; i < tableNamesToImport.length; i++) {
        const tblName = tableNamesToImport[i];
        setImportProgress(`Importing ${tblName} (${i + 1}/${tableNamesToImport.length})...`);
        const result = await importPostgresTable(config, tblName);
        importedItems.push(result);
      }

      onTablesLoaded(importedItems);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: `Import failed: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  // Choose a quick sample profile
  const handleSelectSampleProfile = (profile: typeof DEMO_POSTGRES_PROFILES[0]) => {
    setConfig({
      host: profile.host,
      port: profile.port,
      database: profile.database,
      user: profile.user,
      password: '••••••••',
      sslMode: 'require',
      bridgeUrl: 'http://localhost:54321',
      mode: 'demo',
      name: profile.title,
    });
    setTestResult(null);
    setDiscoveredTables([]);
    setActiveTab('main');
  };

  const selectedCount = Object.values(selectedTables).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-colors ${
          isBright
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#0b1329] border-[#1e2f54] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* DBeaver-style Window Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080e1e] border-[#162544]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-sm shadow-inner">
              🐘
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Connect to PostgreSQL Database</h3>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  DBeaver Style
                </span>
              </div>
              <p className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                Localhost, Neon, Supabase, RDS, or instant browser profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isBright ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-[#162544] text-slate-400 hover:text-slate-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector & Tab Navigation */}
        <div
          className={`px-4 pt-2 border-b flex items-center justify-between gap-2 overflow-x-auto select-none ${
            isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#070b16] border-[#162544]'
          }`}
        >
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'main'
                  ? 'border-blue-500 text-blue-500 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>General</span>
            </button>

            <button
              onClick={() => setActiveTab('url')}
              className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'url'
                  ? 'border-blue-500 text-blue-500 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Connection URL</span>
            </button>

            <button
              onClick={() => setActiveTab('samples')}
              className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'samples'
                  ? 'border-blue-500 text-blue-500 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Demo Profiles</span>
              <span className="text-[9px] px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                Instant
              </span>
            </button>

            <button
              onClick={() => setActiveTab('bridge')}
              className={`px-3 py-2 border-b-2 font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bridge'
                  ? 'border-blue-500 text-blue-500 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bridge Agent</span>
            </button>
          </div>

          {/* Active Mode Pill */}
          <div className="shrink-0 pb-1">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                config.mode === 'demo'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              {config.mode === 'demo' ? '⚡ Instant Demo Mode' : '🔌 TCP Bridge Mode'}
            </span>
          </div>
        </div>

        {/* Dialog Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: GENERAL (DBeaver style form) */}
          {activeTab === 'main' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-400 text-[11px] flex items-center gap-1">
                    <span>Host</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="localhost or ep-xxx.neon.tech"
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060b17] border-[#182c54] text-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400 text-[11px]">Port</label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 5432 })}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060b17] border-[#182c54] text-slate-200'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-400 text-[11px] flex items-center gap-1">
                    <span>Database</span>
                    <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => setConfig({ ...config, database: e.target.value })}
                    placeholder="postgres"
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060b17] border-[#182c54] text-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-400 text-[11px]">SSL Mode</label>
                  <select
                    value={config.sslMode}
                    onChange={(e) => setConfig({ ...config, sslMode: e.target.value as any })}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060b17] border-[#182c54] text-slate-200'
                    }`}
                  >
                    <option value="prefer">prefer</option>
                    <option value="require">require</option>
                    <option value="disable">disable</option>
                    <option value="verify-full">verify-full</option>
                  </select>
                </div>
              </div>

              {/* Authentication Group */}
              <div
                className={`p-3 rounded-lg border space-y-3 ${
                  isBright ? 'bg-slate-50/70 border-slate-200' : 'bg-[#080f22]/70 border-[#152445]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Authentication</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-400 text-[11px]">Username</label>
                    <input
                      type="text"
                      value={config.user}
                      onChange={(e) => setConfig({ ...config, user: e.target.value })}
                      placeholder="postgres"
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                        isBright
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-[#060b17] border-[#182c54] text-slate-200'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-400 text-[11px]">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={config.password}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      placeholder="••••••••"
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                        isBright
                          ? 'bg-white border-slate-300 text-slate-800'
                          : 'bg-[#060b17] border-[#182c54] text-slate-200'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">Connection Mode:</span>
                <div className="flex items-center gap-1 bg-[#060b17] p-0.5 rounded-lg border border-[#162544]">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, mode: 'bridge' })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      config.mode === 'bridge'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Local / Custom Bridge
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, mode: 'demo' })}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                      config.mode === 'demo'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Instant Demo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTION URL */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste a standard PostgreSQL connection URI string. The host, port, database, user,
                password, and sslmode parameters will be parsed automatically.
              </p>
              <textarea
                value={rawUri}
                onChange={(e) => handleUriChange(e.target.value)}
                placeholder="postgresql://user:secret@localhost:5432/my_database?sslmode=prefer"
                rows={3}
                className={`w-full p-2.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                  isBright
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-[#060b17] border-[#182c54] text-slate-200'
                }`}
              />
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Supports: Neon, Supabase, AWS RDS, Cloud SQL, Localhost</span>
                <button
                  type="button"
                  onClick={() =>
                    handleUriChange('postgres://postgres:admin123@localhost:5432/postgres?sslmode=disable')
                  }
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  Insert localhost template
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DEMO PROFILES */}
          {activeTab === 'samples' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold">Instant In-Browser PostgreSQL Testing:</strong>{' '}
                  No local bridge or database setup required. Pick a pre-configured PostgreSQL
                  schema below to test full SQL querying, relational joins, and visual ERD.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {DEMO_POSTGRES_PROFILES.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => handleSelectSampleProfile(profile)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer group flex items-center justify-between ${
                      config.database === profile.database && config.mode === 'demo'
                        ? 'border-blue-500 bg-blue-500/10'
                        : isBright
                        ? 'bg-white hover:border-blue-400 border-slate-200'
                        : 'bg-[#080f22] hover:border-blue-500/50 border-[#152445]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-200 group-hover:text-blue-400">
                          {profile.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-[#050b16] text-blue-300 border border-blue-500/30">
                          {profile.database}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{profile.description}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {profile.tables.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: BRIDGE AGENT */}
          {activeTab === 'bridge' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Standard web browsers restrict raw TCP sockets (port 5432). Run the included
                lightweight bridge server on your machine to connect directly to any real PostgreSQL
                instance:
              </p>

              <div className="relative">
                <pre
                  className={`p-3 rounded-lg font-mono text-[11px] overflow-x-auto border ${
                    isBright
                      ? 'bg-slate-100 text-slate-800 border-slate-300'
                      : 'bg-[#050914] text-emerald-400 border-[#152445]'
                  }`}
                >
                  npm run bridge
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('npm run bridge');
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="absolute right-2 top-2 p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  title="Copy command"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400 text-[11px]">Bridge URL</label>
                <input
                  type="text"
                  value={config.bridgeUrl}
                  onChange={(e) => setConfig({ ...config, bridgeUrl: e.target.value })}
                  placeholder="http://localhost:54321"
                  className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors ${
                    isBright
                      ? 'bg-slate-50 border-slate-300 text-slate-800'
                      : 'bg-[#060b17] border-[#182c54] text-slate-200'
                  }`}
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/40 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">How It Works:</div>
                <div>1. The bridge runs locally as an HTTP-to-TCP gateway using node's official pg driver.</div>
                <div>2. SheetSQL connects to http://localhost:54321 with CORS enabled.</div>
                <div>3. No external cloud credentials are required; all data stays on your local machine.</div>
              </div>
            </div>
          )}

          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-0.5">
                <div className="font-semibold flex items-center gap-2">
                  <span>{testResult.success ? 'Connected successfully!' : 'Connection failed'}</span>
                  {testResult.latencyMs > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
                {testResult.version && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">{testResult.version}</p>
                )}
                {testResult.error && (
                  <p className="text-[11px] text-red-300/90 leading-relaxed">{testResult.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Discovered Tables Checklist */}
          {discoveredTables.length > 0 && (
            <div
              className={`p-3 rounded-lg border space-y-2.5 ${
                isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#080f22] border-[#162544]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-slate-200 text-xs">
                    Discovered Tables ({discoveredTables.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => toggleSelectAllTables(true)}
                    className="text-blue-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAllTables(false)}
                    className="text-slate-400 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {discoveredTables.map((tbl) => (
                  <label
                    key={tbl.name}
                    className={`flex items-center justify-between p-2 rounded-md border transition cursor-pointer ${
                      selectedTables[tbl.name]
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-200'
                        : isBright
                        ? 'bg-white border-slate-200 text-slate-700'
                        : 'bg-[#060b17] border-[#182c54] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!selectedTables[tbl.name]}
                        onChange={() => toggleSelectTable(tbl.name)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-medium">{tbl.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({tbl.schema})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span>{tbl.columnCount} cols</span>
                      {tbl.rowCount > 0 && <span>• {tbl.rowCount} rows</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (DBeaver Actions) */}
        <div
          className={`px-4 py-3 border-t flex items-center justify-between gap-2 select-none ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080e1e] border-[#162544]'
          }`}
        >
          {/* Left Action: Test Connection */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isImporting}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              isBright
                ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-xs'
                : 'bg-[#0f1d38] hover:bg-[#162a52] border-[#223d75] text-slate-200'
            }`}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>Pinging...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Test Connection</span>
              </>
            )}
          </button>

          {/* Right Actions: Cancel & Connect / Import */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isBright
                  ? 'hover:bg-slate-200 text-slate-600'
                  : 'hover:bg-[#162544] text-slate-400 hover:text-slate-200'
              }`}
            >
              Cancel
            </button>

            {discoveredTables.length === 0 ? (
              <button
                type="button"
                onClick={handleFetchTables}
                disabled={isFetchingTables || isTesting}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isFetchingTables ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Inspecting...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Explore Tables</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || selectedCount === 0}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{importProgress || 'Importing...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Import {selectedCount} Table{selectedCount === 1 ? '' : 's'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
