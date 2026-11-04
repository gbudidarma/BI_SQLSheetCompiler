/**
 * BiSchemaVisualizer.tsx
 * Interactive BI Schema Visualizer featuring:
 * - ⭐ Star Schema Preview (Central Fact with 1-Hop Denormalized Dimension satellites)
 * - ❄️ Snowflake Schema Preview (Hierarchical Normalized 3NF Sub-Dimension branches)
 * - ⚖️ Architectural Comparison & Trade-off Analyzer
 * - Interactive SVG connection graph with zoom & node inspection
 * - Star vs. Snowflake SQL query generation and 1-click execution in SQL Studio
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Star,
  Snowflake,
  GitBranch,
  Database,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Play,
  Info,
  ArrowRight,
  Split,
  Eye,
  Key,
  Hash,
  Tag,
  Sigma,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Zap,
  TrendingDown,
  ChevronRight,
  X
} from 'lucide-react';
import {
  StarSchemaBuildResult,
  GeneratedDimension,
  GeneratedFactTable,
} from '../types';
import {
  deriveSnowflakeModel,
  NormalizedSubDimension,
  SchemaArchitectureType,
  SnowflakeSchemaModel,
} from '../utils/biSchemaModeler';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface BiSchemaVisualizerProps {
  starSchemaResult: StarSchemaBuildResult;
  onOpenInSqlEditor?: (sql: string) => void;
  onSwitchToStudio?: () => void;
  rawFileName?: string;
}

export const BiSchemaVisualizer: React.FC<BiSchemaVisualizerProps> = ({
  starSchemaResult,
  onOpenInSqlEditor,
  onSwitchToStudio,
  rawFileName = 'dataset',
}) => {
  const { isBright } = useTheme();

  // Active Architecture Mode
  const [activeMode, setActiveMode] = useState<SchemaArchitectureType>('star');
  const [showComparisonPanel, setShowComparisonPanel] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedTable, setSelectedTable] = useState<{
    name: string;
    type: 'fact' | 'dimension' | 'sub_dimension';
    data?: any;
  } | null>(null);

  // SQL Query Tab (Star vs Snowflake)
  const [sqlTab, setSqlTab] = useState<'star' | 'snowflake'>('star');
  const [copiedQuery, setCopiedQuery] = useState<boolean>(false);

  // Derive Snowflake Model from Star Schema Result
  const snowflakeModel: SnowflakeSchemaModel = useMemo(() => {
    return deriveSnowflakeModel(starSchemaResult);
  }, [starSchemaResult]);

  const { factTable, primaryDimensions, subDimensions, metrics, starQuery, snowflakeQuery } =
    snowflakeModel;

  // Zoom Handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.5, z + 0.1));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.6, z - 0.1));
  const handleZoomReset = () => setZoomLevel(1);

  // Copy Query
  const handleCopyQuery = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  // Run Query in Studio
  const handleRunQuery = (sql: string) => {
    if (onOpenInSqlEditor) {
      onOpenInSqlEditor(sql);
    } else if (onSwitchToStudio) {
      onSwitchToStudio();
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP TOOLBAR: ARCHITECTURE SWITCHER & CONTROLS */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs transition ${
          isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Star Schema Tab */}
          <button
            onClick={() => setActiveMode('star')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeMode === 'star'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : isBright
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-[#0f1b35] hover:bg-[#16274e] text-slate-300'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>Star Schema</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-normal ${
                activeMode === 'star'
                  ? 'bg-amber-600/30 text-slate-950'
                  : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              1-Hop OLAP
            </span>
          </button>

          {/* Snowflake Schema Tab */}
          <button
            onClick={() => setActiveMode('snowflake')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeMode === 'snowflake'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : isBright
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-[#0f1b35] hover:bg-[#16274e] text-slate-300'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>Snowflake Schema</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-normal ${
                activeMode === 'snowflake'
                  ? 'bg-cyan-600/30 text-slate-950'
                  : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              3NF Normalized
            </span>
          </button>

          {/* Compare Trade-offs Toggle */}
          <button
            onClick={() => setShowComparisonPanel(!showComparisonPanel)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              showComparisonPanel
                ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                : isBright
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-[#0b162f] hover:bg-[#122347] text-slate-300 border-[#1c305c]'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>Architecture Breakdown</span>
          </button>
        </div>

        {/* Viewport Zoom & Quick Status */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center rounded-lg border px-1.5 py-0.5 text-xs ${
              isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#060c18] border-[#182747]'
            }`}
          >
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-400">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono ${
              isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#070e1c] border-[#182747]'
            }`}
          >
            <span className="text-blue-500 font-bold">1 Fact</span>
            <span>·</span>
            <span className="text-purple-400 font-bold">{primaryDimensions.length} Dims</span>
            {activeMode === 'snowflake' && (
              <>
                <span>·</span>
                <span className="text-cyan-400 font-bold">{subDimensions.length} Sub-Dims</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. ARCHITECTURE TRADE-OFFS BREAKDOWN DRAWER (When toggled) */}
      {showComparisonPanel && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0a1226] border-[#1a2c52] shadow-xl'
          }`}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-500/20">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold">Dimensional Modeling Comparison: Star vs. Snowflake</h3>
            </div>
            <button
              onClick={() => setShowComparisonPanel(false)}
              className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Star Schema Summary Card */}
            <div
              className={`p-4 rounded-xl border ${
                activeMode === 'star'
                  ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                  : 'border-slate-500/20'
              } ${isBright ? 'bg-amber-50/40' : 'bg-amber-950/10'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-500 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Star Schema (Kimball Methodology)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                  Denormalized
                </span>
              </div>
              <p className={`text-[11px] mb-3 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                Dimension tables are completely denormalized. Descriptive attributes (city, state, category) are stored directly inside the main dimension record.
              </p>
              <ul className="space-y-1.5 text-[11px] font-sans">
                <li className="flex items-start gap-1.5">
                  <Zap className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Query Speed:</strong> Ultra-fast. Every metric calculation requires only 1 join hop per dimension.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Zap className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Simplicity:</strong> Clean for non-technical users in Power BI, Tableau, and Excel pivot tables.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <TrendingDown className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong>Redundancy:</strong> Text strings repeat across entities (higher disk footprint).</span>
                </li>
              </ul>
            </div>

            {/* Snowflake Schema Summary Card */}
            <div
              className={`p-4 rounded-xl border ${
                activeMode === 'snowflake'
                  ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
                  : 'border-slate-500/20'
              } ${isBright ? 'bg-cyan-50/40' : 'bg-cyan-950/10'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5" />
                  Snowflake Schema (Inmon Methodology)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                  3NF Normalized
                </span>
              </div>
              <p className={`text-[11px] mb-3 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                Dimension tables are further normalized into sub-dimensions (e.g., Customer → Geography → Country, Product → Category → Department).
              </p>
              <ul className="space-y-1.5 text-[11px] font-sans">
                <li className="flex items-start gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                  <span><strong>Storage Efficiency:</strong> Zero data redundancy; updates happen in exactly one place.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                  <span><strong>Deep Hierarchies:</strong> Perfect for complex enterprise catalogs, supplier taxonomies, and multi-tier geography.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <TrendingDown className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <span><strong>Join Overhead:</strong> Queries require multi-hop cascading joins (Fact → Dim → Sub-Dim).</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Quick Metrics Comparison Table */}
          <div className="mt-4 pt-3 border-t border-slate-500/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded-lg bg-slate-500/5">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Total Tables</div>
                <div className="text-sm font-bold font-mono mt-0.5">
                  <span className="text-amber-500">{metrics.starTableCount}</span> (Star) vs{' '}
                  <span className="text-cyan-400">{metrics.snowflakeTableCount}</span> (Snowflake)
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/5">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Join Hops per Query</div>
                <div className="text-sm font-bold font-mono mt-0.5">
                  <span className="text-amber-500">{metrics.starJoinCount}</span> (1-Hop) vs{' '}
                  <span className="text-cyan-400">{metrics.snowflakeJoinCount}</span> (Multi-Hop)
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/5">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Normalization 3NF</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  +{metrics.redundancyReductionPct}% Reduced Redundancy
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-500/5">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Storage Optimization</div>
                <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                  ~{metrics.storageSavingsEstimatePct}% Space Savings
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VISUAL SCHEMA CANVAS & ER TOPOLOGY MAP */}
      <div
        className={`rounded-2xl border overflow-hidden relative transition ${
          isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#070e1c] border-[#182747]'
        }`}
      >
        {/* Canvas Header / Mode Badge */}
        <div
          className={`px-4 py-2.5 border-b flex items-center justify-between text-xs ${
            isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#091329] border-[#182747]'
          }`}
        >
          <div className="flex items-center gap-2">
            {activeMode === 'star' ? (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
            ) : (
              <Snowflake className="w-4 h-4 text-cyan-400" />
            )}
            <span className="font-bold">
              {activeMode === 'star' ? 'Star Schema ER Topology' : 'Snowflake Schema Hierarchical Branches'}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-[11px] text-slate-400">
              {activeMode === 'star'
                ? 'Direct 1-to-many links between centralized Fact and denormalized Dimension satellites'
                : 'Decomposed 3NF sub-dimension hierarchy branching outward from primary entities'}
            </span>
          </div>

          <span className="text-[10px] text-slate-400 font-mono">
            Click table cards to inspect schema & relationships
          </span>
        </div>

        {/* Scalable Visual Canvas */}
        <div
          className="p-6 overflow-x-auto min-h-[440px] flex items-center justify-center relative"
          style={{
            backgroundImage: isBright
              ? 'radial-gradient(#cbd5e1 1px, transparent 1px)'
              : 'radial-gradient(#1e293b 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div
            className="transition-transform duration-200 origin-center flex flex-col lg:flex-row items-center justify-center gap-8 py-4"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {/* ========================================================= */}
            {/* STAR SCHEMA VIEW: CENTRAL FACT + SATELLITE DIMENSIONS */}
            {/* ========================================================= */}
            {activeMode === 'star' && (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full max-w-5xl">
                {/* Central Fact Box */}
                <div
                  onClick={() =>
                    setSelectedTable({
                      name: factTable.tableName,
                      type: 'fact',
                      data: factTable,
                    })
                  }
                  className={`w-72 p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-md ${
                    selectedTable?.name === factTable.tableName
                      ? 'border-blue-500 ring-4 ring-blue-500/20'
                      : 'border-blue-500/60 hover:border-blue-400'
                  } ${isBright ? 'bg-blue-50/70' : 'bg-blue-950/30'}`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white">
                        <Database className="w-3 h-3" />
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {factTable.tableName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      FACT
                    </span>
                  </div>

                  {/* Fact Attributes & Measures Summary */}
                  <div className="mt-2.5 space-y-1 font-mono text-[11px]">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mb-1">
                      Surrogate Foreign Keys (FK):
                    </div>
                    {primaryDimensions.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded"
                      >
                        <span className="flex items-center gap-1">
                          <Key className="w-2.5 h-2.5 text-emerald-500" />
                          {d.surrogateKeyName}
                        </span>
                        <span className="text-[9px] text-slate-400">FK → {d.tableName}</span>
                      </div>
                    ))}

                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mt-2 mb-1">
                      Fact Measures & Degenerates:
                    </div>
                    {factTable.columns
                      .filter((c) => !primaryDimensions.some((d) => d.surrogateKeyName === c))
                      .slice(0, 4)
                      .map((c) => (
                        <div key={c} className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1">
                            {c.includes('amount') || c.includes('qty') || c.includes('total') ? (
                              <Sigma className="w-2.5 h-2.5 text-amber-400" />
                            ) : c.includes('date') ? (
                              <Calendar className="w-2.5 h-2.5 text-sky-400" />
                            ) : (
                              <Hash className="w-2.5 h-2.5 text-slate-400" />
                            )}
                            {c}
                          </span>
                          <span className="text-[9px] text-slate-400 font-sans">Metric</span>
                        </div>
                      ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-blue-500/20 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{factTable.rows.length.toLocaleString()} rows</span>
                    <span className="text-blue-400 font-semibold">Click to inspect</span>
                  </div>
                </div>

                {/* Satellite Links to Dimensions */}
                <div className="flex flex-col items-center justify-center text-xs font-mono text-slate-400">
                  <div className="hidden lg:flex flex-col items-center gap-1">
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                      ★ 1-Hop Joins
                    </span>
                    <span className="text-lg text-slate-500">◀ ─── ▶</span>
                    <span className="text-[10px] text-slate-400 font-sans">N : 1 Cardinality</span>
                  </div>
                </div>

                {/* Primary Dimension Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                  {primaryDimensions.map((dim) => {
                    const isSelected = selectedTable?.name === dim.tableName;
                    const attrs = dim.columns.filter(
                      (c) =>
                        c !== dim.surrogateKeyName &&
                        c !== dim.naturalKeyCol &&
                        c !== 'effective_start_date' &&
                        c !== 'effective_end_date' &&
                        c !== 'is_current'
                    );

                    return (
                      <div
                        key={dim.id}
                        onClick={() =>
                          setSelectedTable({
                            name: dim.tableName,
                            type: 'dimension',
                            data: dim,
                          })
                        }
                        className={`w-64 p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'border-purple-500 ring-2 ring-purple-500/20'
                            : 'border-purple-500/40 hover:border-purple-400'
                        } ${isBright ? 'bg-white' : 'bg-[#0c162e]'}`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/20">
                          <span className="font-mono text-xs font-bold text-purple-400">
                            {dim.tableName}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold">
                            DIMENSION
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 font-mono text-[11px]">
                          {/* Surrogate Primary Key */}
                          <div className="flex items-center justify-between text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded">
                            <span className="flex items-center gap-1 font-bold">
                              <Key className="w-2.5 h-2.5 text-emerald-500" />
                              {dim.surrogateKeyName}
                            </span>
                            <span className="text-[9px] text-emerald-500 font-sans font-bold">PK</span>
                          </div>

                          {/* Natural Business Key */}
                          <div className="flex items-center justify-between text-purple-300">
                            <span className="flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-purple-400" />
                              {dim.naturalKeyCol}
                            </span>
                            <span className="text-[9px] text-slate-400 font-sans">NK</span>
                          </div>

                          {/* Denormalized Attributes */}
                          {attrs.slice(0, 3).map((a) => (
                            <div key={a} className="flex items-center justify-between text-slate-300">
                              <span className="truncate pr-1">• {a}</span>
                              <span className="text-[9px] text-slate-500 font-sans">Attr</span>
                            </div>
                          ))}
                          {attrs.length > 3 && (
                            <div className="text-[10px] text-slate-500 italic">
                              +{attrs.length - 3} more denormalized attributes...
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 pt-1.5 border-t border-purple-500/20 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>{dim.rows.length} entities</span>
                          <span className="text-purple-400">Inspect</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* SNOWFLAKE SCHEMA VIEW: FACT -> PRIMARY DIM -> SUB-DIMS */}
            {/* ========================================================= */}
            {activeMode === 'snowflake' && (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-6 w-full max-w-6xl">
                {/* 1. Central Fact Box */}
                <div
                  onClick={() =>
                    setSelectedTable({
                      name: factTable.tableName,
                      type: 'fact',
                      data: factTable,
                    })
                  }
                  className={`w-64 p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-md shrink-0 ${
                    selectedTable?.name === factTable.tableName
                      ? 'border-blue-500 ring-4 ring-blue-500/20'
                      : 'border-blue-500/60 hover:border-blue-400'
                  } ${isBright ? 'bg-blue-50/70' : 'bg-blue-950/30'}`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {factTable.tableName}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      FACT
                    </span>
                  </div>

                  <div className="mt-2 space-y-1 font-mono text-[11px]">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mb-1">
                      Surrogate FK Links:
                    </div>
                    {primaryDimensions.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded text-[10px]"
                      >
                        <span>{d.surrogateKeyName}</span>
                        <span className="text-slate-400">FK → {d.tableName}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-blue-500/20 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{factTable.rows.length.toLocaleString()} rows</span>
                    <span className="text-blue-400 font-semibold">Inspect</span>
                  </div>
                </div>

                {/* 2. Hierarchical Link Arrow */}
                <div className="hidden lg:flex flex-col items-center text-xs font-mono text-slate-400 shrink-0">
                  <span className="text-[10px] text-purple-400 font-bold uppercase">Hop 1</span>
                  <span className="text-lg text-slate-500">───▶</span>
                  <span className="text-[9px] text-slate-400">N : 1</span>
                </div>

                {/* 3. Primary Dimension Layer */}
                <div className="flex flex-col gap-4 shrink-0">
                  {primaryDimensions.map((dim) => {
                    const isSelected = selectedTable?.name === dim.tableName;
                    const attachedSubDims = subDimensions.filter(
                      (s) => s.parentDimensionId === dim.id
                    );

                    return (
                      <div
                        key={dim.id}
                        onClick={() =>
                          setSelectedTable({
                            name: dim.tableName,
                            type: 'dimension',
                            data: dim,
                          })
                        }
                        className={`w-64 p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'border-purple-500 ring-2 ring-purple-500/20'
                            : 'border-purple-500/40 hover:border-purple-400'
                        } ${isBright ? 'bg-white' : 'bg-[#0c162e]'}`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-purple-500/20">
                          <span className="font-mono text-xs font-bold text-purple-400">
                            {dim.tableName}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold">
                            PRIMARY DIM
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 font-mono text-[11px]">
                          <div className="flex items-center justify-between text-emerald-400 text-[10px]">
                            <span className="font-bold">{dim.surrogateKeyName}</span>
                            <span className="font-bold">PK</span>
                          </div>
                          <div className="flex items-center justify-between text-purple-300 text-[10px]">
                            <span>{dim.naturalKeyCol}</span>
                            <span>NK</span>
                          </div>

                          {/* Outgoing Normalized FK to Sub-Dimensions */}
                          {attachedSubDims.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between text-cyan-400 bg-cyan-500/5 px-1 py-0.5 rounded text-[10px]"
                            >
                              <span className="font-semibold">{s.foreignKeyInParent}</span>
                              <span className="text-[9px] text-cyan-400/80">FK → {s.tableName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 4. Hierarchical Link Arrow to Sub-Dimensions */}
                <div className="hidden lg:flex flex-col items-center text-xs font-mono text-slate-400 shrink-0">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">Hop 2 (3NF)</span>
                  <span className="text-lg text-slate-500">───▶</span>
                  <span className="text-[9px] text-slate-400">N : 1</span>
                </div>

                {/* 5. Normalized Sub-Dimensions (Snowflake Layer 2 Satellites) */}
                <div className="flex flex-col gap-3 shrink-0">
                  {subDimensions.map((sub) => {
                    const isSelected = selectedTable?.name === sub.tableName;

                    return (
                      <div
                        key={sub.id}
                        onClick={() =>
                          setSelectedTable({
                            name: sub.tableName,
                            type: 'sub_dimension',
                            data: sub,
                          })
                        }
                        className={`w-64 p-3.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                            : 'border-cyan-500/40 hover:border-cyan-400'
                        } ${isBright ? 'bg-cyan-50/30' : 'bg-[#08152c]'}`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/20">
                          <span className="font-mono text-xs font-bold text-cyan-400">
                            {sub.tableName}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                            3NF SATELLITE
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 font-mono text-[11px]">
                          <div className="flex items-center justify-between text-emerald-400 text-[10px]">
                            <span className="font-bold">{sub.surrogateKeyName}</span>
                            <span className="font-bold">PK</span>
                          </div>

                          {sub.attributeCols.map((attr) => (
                            <div key={attr} className="flex items-center justify-between text-slate-300 text-[10px]">
                              <span>• {attr}</span>
                              <span className="text-[9px] text-slate-500">Normalized</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2 text-[9px] text-slate-400 italic">
                          Parent: <code className="text-purple-300">{sub.parentTableName}</code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Table Inspection Bottom Sheet (If a table is clicked) */}
        {selectedTable && (
          <div
            className={`p-4 border-t flex flex-wrap items-center justify-between gap-4 text-xs ${
              isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#0a142c] border-[#182747]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${
                  selectedTable.type === 'fact'
                    ? 'bg-blue-600'
                    : selectedTable.type === 'dimension'
                    ? 'bg-purple-600'
                    : 'bg-cyan-600'
                }`}
              >
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{selectedTable.name}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-500/20 font-semibold">
                    {selectedTable.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {selectedTable.type === 'fact' && 'Central transactional fact table storing numerical measures and surrogate foreign keys.'}
                  {selectedTable.type === 'dimension' && 'Primary descriptive dimension entity containing natural keys and attribute context.'}
                  {selectedTable.type === 'sub_dimension' && 'Normalized 3NF lookup satellite branching from primary dimension to eliminate redundancy.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedTable(null)}
                className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-500/20 hover:bg-slate-500/10 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. STAR VS. SNOWFLAKE SQL QUERY COMPARISON STUDIO */}
      <div
        className={`p-4 rounded-2xl border transition ${
          isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Query Comparison:
            </span>
            <div className="flex items-center p-0.5 rounded-lg border border-slate-500/20 bg-slate-500/5 text-xs">
              <button
                onClick={() => setSqlTab('star')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  sqlTab === 'star'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>Star Schema SQL (1-Hop)</span>
              </button>
              <button
                onClick={() => setSqlTab('snowflake')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  sqlTab === 'snowflake'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Snowflake className="w-3 h-3" />
                <span>Snowflake Schema SQL (Multi-Hop)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunQuery(sqlTab === 'star' ? starQuery : snowflakeQuery)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition"
              title="Test this query directly inside SQL Studio"
            >
              <Play className="w-3 h-3" />
              <span>Run in SQL Studio</span>
            </button>

            <button
              onClick={() => handleCopyQuery(sqlTab === 'star' ? starQuery : snowflakeQuery)}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                copiedQuery
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : isBright
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-200'
              }`}
            >
              {copiedQuery ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedQuery ? 'Copied!' : 'Copy SQL'}</span>
            </button>
          </div>
        </div>

        {/* Syntax Highlighted SQL Query View */}
        <div
          className={`rounded-xl border overflow-hidden font-mono text-xs ${
            isBright ? 'bg-slate-900 text-slate-100 border-slate-800' : 'bg-[#050a14] text-slate-200 border-[#152340]'
          }`}
        >
          <div className="overflow-x-auto max-h-56 p-4 font-mono leading-relaxed select-text">
            <pre className="m-0 whitespace-pre">
              {highlightSql(sqlTab === 'star' ? starQuery : snowflakeQuery, 'dark')}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
