/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
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
  Table as TableIcon,
  HardDrive,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  Globe
} from 'lucide-react';
import { TableSchema } from '../types';
import { useTheme } from '../context/ThemeContext';
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
import { isProUnlocked } from '../utils/licenseManager';

interface AwsConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesLoaded: (items: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
  onOpenProModal?: () => void;
}

export const AwsConnectionModal: React.FC<AwsConnectionModalProps> = ({
  isOpen,
  onClose,
  onTablesLoaded,
  onOpenProModal,
}) => {
  const { isBright } = useTheme();

  // Active view tab inside modal
  const [activeTab, setActiveTab] = useState<'main' | 's3_url' | 'samples' | 'bridge'>('main');

  // Connection configuration state
  const [config, setConfig] = useState<AwsConnectionConfig>({
    service: 'athena',
    mode: 'demo',
    region: 'us-east-1',
    bridgeUrl: 'http://localhost:54322',
    // Athena defaults
    athenaCatalog: 'AwsDataCatalog',
    athenaDatabase: 'analytics_db',
    athenaWorkgroup: 'primary',
    athenaOutputLocation: 's3://aws-athena-query-results-analytics/',
    // Redshift defaults
    redshiftHost: 'redshift-cluster-1.c4k1e9x.us-west-2.redshift.amazonaws.com',
    redshiftPort: 5439,
    redshiftDatabase: 'dev',
    redshiftUser: 'awsuser',
    redshiftClusterId: 'redshift-cluster-1',
    // S3 defaults
    s3Bucket: 'corp-analytics-datalake-prod',
    s3Prefix: 'financial-metrics/',
    s3FileFormat: 'csv',
    // RDS defaults
    rdsEngine: 'postgres',
    rdsHost: 'aurora-cluster.cluster-c4k1e9x.us-east-2.rds.amazonaws.com',
    rdsPort: 5432,
    rdsDatabase: 'saas_prod',
    rdsUser: 'postgres',
  });

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [rawS3Input, setRawS3Input] = useState('');

  // Testing connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<AwsTestResult | null>(null);

  // Resource discovery state
  const [isFetchingResources, setIsFetchingResources] = useState(false);
  const [discoveredResources, setDiscoveredResources] = useState<AwsDiscoveredResource[]>([]);
  const [selectedResources, setSelectedResources] = useState<Record<string, boolean>>({});

  // Importing state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      setDiscoveredResources([]);
      setSelectedResources({});
      setImportProgress('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle switching AWS service
  const handleServiceChange = (service: AwsServiceType) => {
    setConfig((prev) => ({
      ...prev,
      service,
      // If switching to S3, set mode to demo by default or match previous
      mode: prev.mode,
    }));
    setTestResult(null);
    setDiscoveredResources([]);
    setSelectedResources({});
  };

  // Handle direct S3 URI input change
  const handleS3UriChange = (val: string) => {
    setRawS3Input(val);
    const parsed = parseS3Uri(val);
    if (parsed) {
      setConfig((prev) => ({
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

  // Run Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAwsConnection(config);
      setTestResult(res);
      if (res.success) {
        // Automatically discover tables / resources
        handleFetchResources();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        service: config.service,
        region: config.region,
        error: err.message || 'AWS Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Fetch tables or resources
  const handleFetchResources = async () => {
    setIsFetchingResources(true);
    try {
      const resources = await fetchAwsResources(config);
      setDiscoveredResources(resources);
      const sel: Record<string, boolean> = {};
      resources.forEach((r) => {
        sel[r.name] = true;
      });
      setSelectedResources(sel);
    } catch (err: any) {
      setTestResult((prev) => ({
        success: false,
        latencyMs: prev?.latencyMs || 0,
        service: config.service,
        region: config.region,
        error: err.message || 'Failed to list AWS tables/resources',
      }));
    } finally {
      setIsFetchingResources(false);
    }
  };

  // Toggle selection
  const toggleSelectResource = (name: string) => {
    setSelectedResources((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Select all or none
  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    discoveredResources.forEach((r) => {
      next[r.name] = checked;
    });
    setSelectedResources(next);
  };

  // Import Selected Tables
  const handleImport = async () => {
    const toImport = Object.keys(selectedResources).filter((k) => selectedResources[k]);
    if (toImport.length === 0) return;

    setIsImporting(true);
    const importedItems: { schema: TableSchema; rows: Record<string, any>[] }[] = [];

    try {
      for (let i = 0; i < toImport.length; i++) {
        const resName = toImport[i];
        setImportProgress(`Importing ${resName} from AWS ${config.service.toUpperCase()} (${i + 1}/${toImport.length})...`);
        const result = await importAwsResource(config, resName);
        importedItems.push(result);
      }

      onTablesLoaded(importedItems);
      onClose();
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        service: config.service,
        region: config.region,
        error: `Import failed: ${err.message}`,
      });
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  // Select Sample Profile
  const handleSelectDemoProfile = (profile: AwsDemoProfile) => {
    setConfig((prev) => ({
      ...prev,
      service: profile.service,
      region: profile.region,
      mode: 'demo',
      name: profile.title,
    }));
    setActiveTab('main');
    setTestResult(null);
    setDiscoveredResources([]);
    setSelectedResources({});
  };

  const selectedCount = Object.values(selectedResources).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-colors ${
          isBright
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#0b1329] border-[#1e2f54] text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* AWS Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none ${
            isBright ? 'bg-amber-50/70 border-amber-200/80' : 'bg-[#0c1424] border-[#182a4d]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Connect to AWS Cloud Services</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                  AWS Suite
                </span>
              </div>
              <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                Query Amazon Athena, Redshift, S3 buckets, and RDS/Aurora right in SheetSQL
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

        {/* AWS Service Switcher Toolbar */}
        <div
          className={`flex items-center gap-1.5 px-4 py-2 border-b overflow-x-auto ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080d1b] border-[#14213d]'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
            Service:
          </span>

          {/* Athena */}
          <button
            type="button"
            onClick={() => handleServiceChange('athena')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              config.service === 'athena'
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : isBright
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-[#101b33] hover:bg-[#18294d] text-slate-300 border border-[#1d3159]'
            }`}
          >
            <span className="text-xs">🔶</span>
            <span>Amazon Athena</span>
          </button>

          {/* Redshift */}
          <button
            type="button"
            onClick={() => handleServiceChange('redshift')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              config.service === 'redshift'
                ? 'bg-red-600 text-white shadow-xs font-semibold'
                : isBright
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-[#101b33] hover:bg-[#18294d] text-slate-300 border border-[#1d3159]'
            }`}
          >
            <span className="text-xs">🔴</span>
            <span>Amazon Redshift</span>
          </button>

          {/* S3 */}
          <button
            type="button"
            onClick={() => handleServiceChange('s3')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              config.service === 's3'
                ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                : isBright
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-[#101b33] hover:bg-[#18294d] text-slate-300 border border-[#1d3159]'
            }`}
          >
            <span className="text-xs">🪣</span>
            <span>Amazon S3</span>
          </button>

          {/* RDS / Aurora */}
          <button
            type="button"
            onClick={() => handleServiceChange('rds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              config.service === 'rds'
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : isBright
                ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-[#101b33] hover:bg-[#18294d] text-slate-300 border border-[#1d3159]'
            }`}
          >
            <span className="text-xs">🐬</span>
            <span>RDS / Aurora</span>
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          className={`flex items-center border-b px-4 text-xs font-medium ${
            isBright ? 'border-slate-200 bg-slate-50' : 'border-[#162544] bg-[#091224]'
          }`}
        >
          <button
            onClick={() => setActiveTab('main')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'main'
                ? 'border-amber-500 text-amber-500 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connection Parameters</span>
          </button>

          {config.service === 's3' && (
            <button
              onClick={() => setActiveTab('s3_url')}
              className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 's3_url'
                  ? 'border-amber-500 text-amber-500 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Direct S3 URL / Presigned</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('samples')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'samples'
                ? 'border-amber-500 text-amber-500 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Demo Profiles</span>
          </button>

          <button
            onClick={() => setActiveTab('bridge')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bridge'
                ? 'border-amber-500 text-amber-500 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Node.js AWS Bridge</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: MAIN CONNECTION PARAMETERS */}
          {activeTab === 'main' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Mode Selection Pill */}
              <div
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isBright ? 'bg-amber-50/60 border-amber-200/80' : 'bg-[#101b33] border-[#1d3159]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span>Active AWS Service:</span>
                    <span className="uppercase">{config.service}</span>
                  </div>
                  <div className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                    Choose execution mode: Instant in-browser demo dataset, or connect to real AWS via bridge.
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, mode: 'demo' }))}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                      config.mode === 'demo'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Demo (In-Browser)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, mode: 'bridge' }))}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer font-medium ${
                      config.mode === 'bridge'
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Local Bridge
                  </button>
                </div>
              </div>

              {/* AWS Region & Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* AWS Region */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>
                    AWS Region
                  </label>
                  <select
                    value={config.region}
                    onChange={(e) => setConfig((p) => ({ ...p, region: e.target.value }))}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border transition font-mono ${
                      isBright
                        ? 'bg-white border-slate-300 text-slate-800'
                        : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                    }`}
                  >
                    {AWS_REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Connection Name / Profile Tag */}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>
                    Connection Name / Label
                  </label>
                  <input
                    type="text"
                    value={config.name || ''}
                    onChange={(e) => setConfig((p) => ({ ...p, name: e.target.value }))}
                    placeholder={`AWS ${config.service.toUpperCase()} [${config.region}]`}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border transition ${
                      isBright
                        ? 'bg-white border-slate-300 text-slate-800'
                        : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                    }`}
                  />
                </div>
              </div>

              {/* SERVICE SPECIFIC CONFIGURATION */}
              {/* 1. Amazon Athena Config */}
              {config.service === 'athena' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                    <Database className="w-3.5 h-3.5" />
                    <span>Amazon Athena Query Settings</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Catalog Name
                      </label>
                      <input
                        type="text"
                        value={config.athenaCatalog || 'AwsDataCatalog'}
                        onChange={(e) => setConfig((p) => ({ ...p, athenaCatalog: e.target.value }))}
                        placeholder="AwsDataCatalog"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={config.athenaDatabase || 'analytics_db'}
                        onChange={(e) => setConfig((p) => ({ ...p, athenaDatabase: e.target.value }))}
                        placeholder="analytics_db"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Workgroup
                      </label>
                      <input
                        type="text"
                        value={config.athenaWorkgroup || 'primary'}
                        onChange={(e) => setConfig((p) => ({ ...p, athenaWorkgroup: e.target.value }))}
                        placeholder="primary"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Query Results S3 Bucket (Output Location)
                      </label>
                      <input
                        type="text"
                        value={config.athenaOutputLocation || 's3://aws-athena-query-results/'}
                        onChange={(e) => setConfig((p) => ({ ...p, athenaOutputLocation: e.target.value }))}
                        placeholder="s3://my-query-results-bucket/"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Amazon Redshift Config */}
              {config.service === 'redshift' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-500">
                    <Database className="w-3.5 h-3.5" />
                    <span>Amazon Redshift Cluster Endpoint</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Cluster Endpoint / Host
                      </label>
                      <input
                        type="text"
                        value={config.redshiftHost || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, redshiftHost: e.target.value }))}
                        placeholder="redshift-cluster.c4k1.us-west-2.redshift.amazonaws.com"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Port (Default 5439)
                      </label>
                      <input
                        type="number"
                        value={config.redshiftPort || 5439}
                        onChange={(e) => setConfig((p) => ({ ...p, redshiftPort: parseInt(e.target.value, 10) || 5439 }))}
                        placeholder="5439"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={config.redshiftDatabase || 'dev'}
                        onChange={(e) => setConfig((p) => ({ ...p, redshiftDatabase: e.target.value }))}
                        placeholder="dev"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        User Name
                      </label>
                      <input
                        type="text"
                        value={config.redshiftUser || 'awsuser'}
                        onChange={(e) => setConfig((p) => ({ ...p, redshiftUser: e.target.value }))}
                        placeholder="awsuser"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Password
                      </label>
                      <input
                        type="password"
                        value={config.redshiftPassword || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, redshiftPassword: e.target.value }))}
                        placeholder="••••••••"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Amazon S3 Config */}
              {config.service === 's3' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Amazon S3 Bucket & Objects</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        S3 Bucket Name
                      </label>
                      <input
                        type="text"
                        value={config.s3Bucket || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, s3Bucket: e.target.value }))}
                        placeholder="corp-analytics-datalake"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Key Prefix / Folder Path
                      </label>
                      <input
                        type="text"
                        value={config.s3Prefix || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, s3Prefix: e.target.value }))}
                        placeholder="exports/2024/"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Amazon RDS / Aurora Config */}
              {config.service === 'rds' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-500">
                      <Database className="w-3.5 h-3.5" />
                      <span>Amazon RDS / Aurora Instance</span>
                    </div>

                    {/* Engine selection */}
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setConfig((p) => ({ ...p, rdsEngine: 'postgres', rdsPort: 5432 }))}
                        className={`px-2 py-0.5 rounded transition cursor-pointer font-semibold ${
                          config.rdsEngine !== 'mysql'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        PostgreSQL
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfig((p) => ({ ...p, rdsEngine: 'mysql', rdsPort: 3306 }))}
                        className={`px-2 py-0.5 rounded transition cursor-pointer font-semibold ${
                          config.rdsEngine === 'mysql'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        MySQL
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        RDS Endpoint Host
                      </label>
                      <input
                        type="text"
                        value={config.rdsHost || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, rdsHost: e.target.value }))}
                        placeholder="aurora-cluster.us-east-2.rds.amazonaws.com"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Port
                      </label>
                      <input
                        type="number"
                        value={config.rdsPort || 5432}
                        onChange={(e) => setConfig((p) => ({ ...p, rdsPort: parseInt(e.target.value, 10) || 5432 }))}
                        placeholder="5432"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Database Name
                      </label>
                      <input
                        type="text"
                        value={config.rdsDatabase || 'saas_prod'}
                        onChange={(e) => setConfig((p) => ({ ...p, rdsDatabase: e.target.value }))}
                        placeholder="saas_prod"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Master User
                      </label>
                      <input
                        type="text"
                        value={config.rdsUser || 'postgres'}
                        onChange={(e) => setConfig((p) => ({ ...p, rdsUser: e.target.value }))}
                        placeholder="postgres"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        Password
                      </label>
                      <input
                        type="password"
                        value={config.rdsPassword || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, rdsPassword: e.target.value }))}
                        placeholder="••••••••"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* AWS IAM Credentials Accordion (Optional for Demo mode) */}
              {config.mode === 'bridge' && (
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    isBright ? 'bg-amber-50/30 border-amber-200/60' : 'bg-[#0a1122] border-[#172646]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                    <Key className="w-3.5 h-3.5" />
                    <span>AWS IAM Credentials (Optional if configured in environment / ~/.aws)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-semibold mb-1 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                        AWS Access Key ID
                      </label>
                      <input
                        type="text"
                        value={config.accessKeyId || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, accessKeyId: e.target.value }))}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-semibold ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          AWS Secret Access Key
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          className="text-[10px] text-amber-500 hover:underline flex items-center gap-1"
                        >
                          {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showSecretKey ? 'Hide' : 'Show'}</span>
                        </button>
                      </div>
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={config.secretAccessKey || ''}
                        onChange={(e) => setConfig((p) => ({ ...p, secretAccessKey: e.target.value }))}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT S3 URL / PRESIGNED LINK */}
          {activeTab === 's3_url' && config.service === 's3' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border space-y-3 ${
                  isBright ? 'bg-emerald-50/50 border-emerald-200' : 'bg-[#0c1b2c] border-[#1a3854]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                  <Link2 className="w-4 h-4" />
                  <span>Direct S3 Presigned URL or S3 URI</span>
                </div>
                <p className={`text-xs ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  Paste a standard S3 URI or an Amazon S3 presigned URL. SheetSQL will stream and parse CSV or Excel data directly into client-side AlaSQL tables.
                </p>

                <textarea
                  value={rawS3Input}
                  onChange={(e) => handleS3UriChange(e.target.value)}
                  placeholder="https://my-bucket.s3.us-east-1.amazonaws.com/sales_2024.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
                  rows={4}
                  className={`w-full p-3 text-xs font-mono rounded-lg border resize-none focus:outline-hidden ${
                    isBright
                      ? 'bg-white border-slate-300 text-slate-800 focus:border-emerald-500'
                      : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200 focus:border-emerald-500'
                  }`}
                />

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`font-semibold ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>Supported formats:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">.csv</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">.xlsx</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">.json</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INSTANT DEMO PROFILES */}
          {activeTab === 'samples' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div
                className={`p-3 rounded-lg border text-xs ${
                  isBright ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}
              >
                <strong className="font-semibold">Instant In-Browser AWS Analytics:</strong>{' '}
                No AWS account or bridge setup required. Select a realistic pre-configured AWS dataset to test cross-table SQL joins, time-series forecasting, and BI charts right in your browser.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEMO_AWS_PROFILES.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => handleSelectDemoProfile(profile)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group hover:scale-[1.01] ${
                      config.service === profile.service && config.mode === 'demo'
                        ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                        : isBright
                        ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        : 'bg-[#0c162e] border-[#182a4d] hover:border-[#223d6f]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                        {profile.badge}
                      </span>
                      <span className={`text-[11px] font-mono ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                        {profile.region}
                      </span>
                    </div>

                    <h4 className={`text-xs font-bold mb-1 group-hover:text-amber-500 transition-colors ${
                      isBright ? 'text-slate-800' : 'text-slate-100'
                    }`}>
                      {profile.title}
                    </h4>

                    <p className={`text-[11px] mb-2.5 line-clamp-2 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                      {profile.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1">
                      {profile.tables.map((t) => (
                        <span
                          key={t}
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isBright ? 'bg-slate-100 text-slate-700' : 'bg-[#080d1a] text-slate-300'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NODE.JS AWS BRIDGE GUIDE */}
          {activeTab === 'bridge' && (
            <div className="space-y-3.5 text-xs animate-in fade-in duration-150">
              <div
                className={`p-3.5 rounded-xl border ${
                  isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
                }`}
              >
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-500" />
                  <span>Why use the Node.js AWS Bridge?</span>
                </h4>
                <p className={`text-[11px] leading-relaxed mb-3 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                  Web browsers enforce strict Cross-Origin (CORS) and TCP socket restrictions that prevent direct in-browser socket connections to Redshift (port 5439) or Athena APIs with private IAM roles. Running the local bridge allows SheetSQL to safely query your AWS databases using your local AWS CLI credentials without exposing keys to the browser.
                </p>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Step 1: Start the AWS Bridge</div>
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-lg font-mono text-xs border ${
                      isBright ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#070d1a] border-[#162544] text-amber-400'
                    }`}
                  >
                    <span>npm run bridge:aws</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('npm run bridge:aws');
                        setCopiedCmd(true);
                        setTimeout(() => setCopiedCmd(false), 2000);
                      }}
                      className="p-1 hover:text-white transition cursor-pointer"
                      title="Copy command"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-400 pt-1">Step 2: Bridge URL Configuration</div>
                  <input
                    type="text"
                    value={config.bridgeUrl || 'http://localhost:54322'}
                    onChange={(e) => setConfig((p) => ({ ...p, bridgeUrl: e.target.value }))}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border font-mono ${
                      isBright
                        ? 'bg-white border-slate-300 text-slate-800'
                        : 'bg-[#080d1a] border-[#1b2b4d] text-slate-200'
                    }`}
                  />
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
                  <span>
                    {testResult.success
                      ? `Successfully connected to AWS ${testResult.service.toUpperCase()}`
                      : 'AWS Connection Failed'}
                  </span>
                  <span className="font-mono text-[11px] opacity-80">{testResult.latencyMs}ms</span>
                </div>
                {testResult.version && <div className="text-[11px] opacity-90 mt-0.5">{testResult.version}</div>}
                {testResult.details && <div className="text-[11px] opacity-80 mt-0.5">{testResult.details}</div>}
                {testResult.error && <div className="text-[11px] font-mono mt-1 text-rose-400">{testResult.error}</div>}
              </div>
            </div>
          )}

          {/* Table / Resource Discovery List */}
          {discoveredResources.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 ${
                isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0c162e] border-[#182a4d]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold">
                    Discovered Tables & Datasets ({discoveredResources.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-amber-500 hover:underline cursor-pointer"
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
                {discoveredResources.map((res) => {
                  const isChecked = !!selectedResources[res.name];
                  return (
                    <div
                      key={res.id}
                      onClick={() => toggleSelectResource(res.name)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs transition cursor-pointer select-none ${
                        isChecked
                          ? isBright
                            ? 'bg-amber-50 border-amber-300 text-slate-800'
                            : 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                          : isBright
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'bg-[#080d1a] border-[#182747] text-slate-400 hover:bg-[#101b33]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-mono font-semibold">{res.name}</span>
                        {res.schema && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            isBright ? 'bg-slate-200 text-slate-600' : 'bg-[#142340] text-slate-400'
                          }`}>
                            {res.schema}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] opacity-75">
                        {res.rowCount > 0 && <span>{res.rowCount.toLocaleString()} rows</span>}
                        {res.columnCount > 0 && <span>· {res.columnCount} cols</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t select-none ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#080d1a] border-[#14213d]'
          }`}
        >
          {/* Left: Test Connection or Status */}
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
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <RefreshCw className="w-3.5 h-3.5 text-amber-500" />}
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            {discoveredResources.length === 0 && (
              <button
                type="button"
                disabled={isFetchingResources}
                onClick={handleFetchResources}
                className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
                  isBright
                    ? 'hover:bg-slate-200 text-slate-700'
                    : 'hover:bg-[#121f3d] text-slate-300'
                }`}
              >
                {isFetchingResources ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>Discover Tables</span>
              </button>
            )}

            {importProgress && (
              <span className="text-xs text-amber-500 flex items-center gap-1.5 animate-pulse">
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
                config.service === 'athena'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  : config.service === 'redshift'
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30'
                  : config.service === 's3'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
              }`}
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>
                {selectedCount > 0 ? `Import ${selectedCount} AWS Table${selectedCount > 1 ? 's' : ''}` : 'Select Tables to Import'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
