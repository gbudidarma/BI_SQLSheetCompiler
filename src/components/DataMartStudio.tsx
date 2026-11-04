/**
 * DataMartStudio.tsx
 * Complete Data Mart BI Studio featuring:
 * - Drag-and-Drop / Interactive Visual Mart Designer (Shelves: Dimensions, Measures, Filters, Having, Order, Limit)
 * - Auto-Analysis & Smart Mart Generator (Sales, Customer 360, Product Velocity, Executive KPIs, Star Rollup)
 * - Real-time SQL Generation: SELECT, CREATE VIEW, and CREATE TABLE (CTAS) across dialects
 * - Live Query Execution against in-browser AlaSQL engine with result grid & quick BI visualizer
 * - Direct View creation in catalog (`CREATE VIEW dm_... AS SELECT ...`) and Materialized Table export
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  Database,
  Sparkles,
  GripVertical,
  Plus,
  Trash2,
  Play,
  Eye,
  Save,
  Download,
  Copy,
  Check,
  Code2,
  FileSpreadsheet,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  PieChart,
  BarChart3,
  Calendar,
  Hash,
  Tag,
  Key,
  Sigma,
  GitBranch,
  Split,
  RefreshCw,
  Sliders,
  HelpCircle
} from 'lucide-react';
import {
  TableSchema,
  ColumnInfo,
  DataType,
  DataMartModel,
  DataMartDimensionConfig,
  DataMartMeasureConfig,
  DataMartFilterConfig,
  DataMartHavingConfig,
  DataMartJoinConfig,
  AutoMartSuggestion,
  DataMartAggregation,
  DataMartDateGrain,
  QueryResult,
} from '../types';
import {
  generateDataMartSelectSql,
  generateDataMartCreateViewSql,
  generateDataMartCreateTableSql,
  generateAutoMartSuggestions,
  suggestTableJoins,
  getColumnCategory,
  isMeasureColumn,
  isDateColumn,
  isKeyColumn,
} from '../utils/dataMartGenerator';
import { SqlDialect } from '../utils/starSchemaSqlGenerator';
import { executeQuery, registerTable } from '../utils/sqlEngine';
import { highlightSql } from '../utils/sqlHighlighter';
import { exportToExcel, exportToCsv } from '../utils/exportHelper';
import { useTheme } from '../context/ThemeContext';

interface DataMartStudioProps {
  tables: TableSchema[];
  onOpenInSqlEditor?: (sql: string) => void;
  onSwitchToStudio?: () => void;
  onSaveAsTable?: (tableName: string, data: Record<string, any>[]) => void;
  onRegisterTables?: (
    newItems: { schema: TableSchema; rows: Record<string, any>[] }[]
  ) => void;
  onLoadSampleDataset?: (datasetId: string) => void;
}

export const DataMartStudio: React.FC<DataMartStudioProps> = ({
  tables,
  onOpenInSqlEditor,
  onSwitchToStudio,
  onSaveAsTable,
  onRegisterTables,
  onLoadSampleDataset,
}) => {
  const { isBright } = useTheme();

  // Active Main Sub-Tab: 'designer' | 'auto_analysis' | 'sql_script' | 'results'
  const [activeTab, setActiveTab] = useState<'designer' | 'auto_analysis' | 'sql_script' | 'results'>('designer');

  // SQL Scripting Sub-Tab: 'select' | 'create_view' | 'create_table'
  const [sqlScriptMode, setSqlScriptMode] = useState<'select' | 'create_view' | 'create_table'>('select');
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>('standard');
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Field Palette search filter
  const [fieldSearch, setFieldSearch] = useState<string>('');
  const [selectedPaletteTable, setSelectedPaletteTable] = useState<string>('all');

  // Primary Table & Data Mart Model
  const defaultPrimaryTable = useMemo(() => {
    const fact = tables.find((t) => t.name.toLowerCase().startsWith('fact_'));
    if (fact) return fact.name;
    const sales = tables.find((t) => ['sales', 'orders', 'transactions'].some((k) => t.name.toLowerCase().includes(k)));
    if (sales) return sales.name;
    return tables[0]?.name || '';
  }, [tables]);

  const [martModel, setMartModel] = useState<DataMartModel>(() => ({
    name: 'dm_sales_performance',
    description: 'Analytical Data Mart for business performance reporting',
    primaryTable: defaultPrimaryTable,
    joins: [],
    dimensions: [],
    measures: [],
    filters: [],
    havings: [],
    sort: undefined,
    limit: 100,
  }));

  // Update primary table if workspace tables change and current primary table is not in list
  useEffect(() => {
    if (tables.length > 0 && (!martModel.primaryTable || !tables.some((t) => t.name === martModel.primaryTable))) {
      const newPrim = defaultPrimaryTable;
      setMartModel((prev) => ({
        ...prev,
        primaryTable: newPrim,
        joins: [],
        dimensions: [],
        measures: [],
      }));
    }
  }, [tables, defaultPrimaryTable, martModel.primaryTable]);

  // Primary Table Schema object
  const primaryTableSchema = useMemo(() => {
    return tables.find((t) => t.name === martModel.primaryTable) || null;
  }, [tables, martModel.primaryTable]);

  // Available Joins & Candidates
  const joinCandidates = useMemo(() => {
    if (!primaryTableSchema) return [];
    return suggestTableJoins(
      primaryTableSchema,
      tables.filter((t) => t.name !== primaryTableSchema.name)
    );
  }, [primaryTableSchema, tables]);

  // Auto-analysis Mart suggestions
  const autoSuggestions: AutoMartSuggestion[] = useMemo(() => {
    return generateAutoMartSuggestions(tables);
  }, [tables]);

  // All tables currently in the model (primary + joined)
  const activeModelTables = useMemo(() => {
    const list = [martModel.primaryTable].filter(Boolean);
    martModel.joins.forEach((j) => {
      if (!list.includes(j.toTable)) list.push(j.toTable);
    });
    return list;
  }, [martModel.primaryTable, martModel.joins]);

  // Query Execution State
  const [isRunningQuery, setIsRunningQuery] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<QueryResult | null>(null);
  const [viewCreatedSuccess, setViewCreatedSuccess] = useState<string | null>(null);
  const [materializedSuccess, setMaterializedSuccess] = useState<string | null>(null);
  const [resultFilterSearch, setResultFilterSearch] = useState<string>('');

  // Drag and Drop state
  const [draggedColumn, setDraggedColumn] = useState<{
    table: string;
    column: ColumnInfo;
  } | null>(null);
  const [isOverDimensions, setIsOverDimensions] = useState<boolean>(false);
  const [isOverMeasures, setIsOverMeasures] = useState<boolean>(false);

  // Generated SQL strings
  const selectSql = useMemo(() => {
    return generateDataMartSelectSql(martModel, sqlDialect);
  }, [martModel, sqlDialect]);

  const createViewSql = useMemo(() => {
    return generateDataMartCreateViewSql(martModel, sqlDialect);
  }, [martModel, sqlDialect]);

  const createTableSql = useMemo(() => {
    return generateDataMartCreateTableSql(martModel, sqlDialect);
  }, [martModel, sqlDialect]);

  const currentDisplaySql = useMemo(() => {
    if (sqlScriptMode === 'create_view') return createViewSql;
    if (sqlScriptMode === 'create_table') return createTableSql;
    return selectSql;
  }, [sqlScriptMode, selectSql, createViewSql, createTableSql]);

  // Execute Query in AlaSQL
  const handleRunQuery = () => {
    if (!martModel.primaryTable) return;
    setIsRunningQuery(true);
    setViewCreatedSuccess(null);
    setMaterializedSuccess(null);

    // Always use Standard dialect for in-browser AlaSQL execution
    const executableSql = generateDataMartSelectSql(martModel, 'standard');
    const availableTblNames = tables.map((t) => t.name);

    setTimeout(() => {
      const result = executeQuery(executableSql, availableTblNames);
      setExecutionResult(result);
      setIsRunningQuery(false);
      setActiveTab('results');
    }, 30);
  };

  // Create View in AlaSQL Catalog
  const handleCreateView = () => {
    if (!martModel.primaryTable) return;
    const viewName = martModel.name.toLowerCase().startsWith('dm_') ? martModel.name : `dm_${martModel.name}`;
    const executableSelect = generateDataMartSelectSql(martModel, 'standard');
    const createViewQuery = `CREATE VIEW ${viewName} AS ${executableSelect}`;

    try {
      // First try to drop view if existing
      try {
        (window as any).alasql?.(`DROP VIEW IF EXISTS ${viewName}`);
      } catch {
        // ignore drop error
      }

      const res = executeQuery(createViewQuery, tables.map((t) => t.name));
      if (res.success || !res.error) {
        // Also fetch preview rows from the newly created view to verify
        const previewRes = executeQuery(`SELECT * FROM ${viewName} LIMIT 10;`, [...tables.map((t) => t.name), viewName]);
        
        // Register view into app state if onRegisterTables is provided
        if (previewRes.data.length > 0 && onRegisterTables) {
          const colNames = previewRes.columns;
          const colSchemas: ColumnInfo[] = colNames.map((c) => {
            const val = previewRes.data[0]?.[c];
            let type: DataType = 'TEXT';
            if (typeof val === 'number') {
              type = Number.isInteger(val) ? 'INTEGER' : 'FLOAT';
            } else if (typeof val === 'boolean') {
              type = 'BOOLEAN';
            }
            return {
              name: c,
              originalName: c,
              type,
              nullCount: 0,
              distinctCount: previewRes.data.length,
              sampleValues: previewRes.data.slice(0, 3).map((r) => r[c]),
            };
          });

          onRegisterTables([
            {
              schema: {
                id: `view_${viewName}_${Date.now()}`,
                name: viewName,
                sourceFileName: `${viewName}.sql_view`,
                sheetName: viewName,
                rowCount: previewRes.data.length,
                columns: colSchemas,
                previewRows: previewRes.data,
              },
              rows: previewRes.data,
            },
          ]);
        }

        setViewCreatedSuccess(viewName);
        setTimeout(() => setViewCreatedSuccess(null), 5000);
      } else {
        alert(`Could not create view: ${res.error}`);
      }
    } catch (e: any) {
      alert(`Error creating view: ${e?.message || e}`);
    }
  };

  // Materialize as Table (CTAS / Permanent snapshot)
  const handleMaterializeTable = () => {
    if (!martModel.primaryTable) return;
    const tableName = martModel.name.toLowerCase().startsWith('dm_') ? martModel.name : `dm_${martModel.name}`;
    const executableSelect = generateDataMartSelectSql(martModel, 'standard');

    try {
      const res = executeQuery(executableSelect, tables.map((t) => t.name));
      if (res.success && res.data.length > 0) {
        if (onSaveAsTable) {
          onSaveAsTable(tableName, res.data);
        } else {
          registerTable(tableName, res.data);
        }
        setMaterializedSuccess(tableName);
        setTimeout(() => setMaterializedSuccess(null), 5000);
      } else {
        alert('Query returned 0 rows to materialize.');
      }
    } catch (e: any) {
      alert(`Error materializing table: ${e?.message || e}`);
    }
  };

  // Open and Run in SQL Studio
  const handleOpenInSqlStudio = () => {
    if (onOpenInSqlEditor) {
      onOpenInSqlEditor(selectSql);
    }
    if (onSwitchToStudio) {
      onSwitchToStudio();
    }
  };

  // Copy SQL to Clipboard
  const handleCopySql = () => {
    navigator.clipboard.writeText(currentDisplaySql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Download SQL Script
  const handleDownloadSql = () => {
    const filename = `${martModel.name || 'data_mart'}_${sqlScriptMode}_${sqlDialect}.sql`;
    const blob = new Blob([currentDisplaySql], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Results
  const handleExportResults = (format: 'xlsx' | 'csv') => {
    if (!executionResult || !executionResult.data || executionResult.data.length === 0) return;
    const filename = martModel.name || 'data_mart_export';
    if (format === 'xlsx') {
      exportToExcel(executionResult.data, executionResult.columns, filename);
    } else {
      exportToCsv(executionResult.data, executionResult.columns, filename);
    }
  };

  // Add Dimension Column
  const handleAddDimension = (table: string, col: ColumnInfo) => {
    const isDate = isDateColumn(col);
    const newDim: DataMartDimensionConfig = {
      id: `dim_${table}_${col.name}_${Date.now()}`,
      table,
      column: col.name,
      alias: col.name,
      dateGrain: isDate ? 'month' : 'none',
    };
    setMartModel((prev) => ({
      ...prev,
      dimensions: [...prev.dimensions, newDim],
    }));
  };

  // Add Measure Column
  const handleAddMeasure = (table: string, col: ColumnInfo, aggregation: DataMartAggregation = 'SUM') => {
    const cleanColName = col.name.replace(/^(total_|sum_|avg_)/i, '');
    let alias = `${aggregation.toLowerCase()}_${cleanColName}`;
    if (aggregation === 'COUNT_DISTINCT') alias = `unique_${cleanColName}`;
    if (aggregation === 'SUM' && /amount|revenue|sales|price/i.test(col.name)) alias = `total_${cleanColName}`;

    const newMeas: DataMartMeasureConfig = {
      id: `meas_${table}_${col.name}_${Date.now()}`,
      table,
      column: col.name,
      aggregation,
      alias,
    };
    setMartModel((prev) => ({
      ...prev,
      measures: [...prev.measures, newMeas],
    }));
  };

  // Remove Dimension
  const handleRemoveDimension = (id: string) => {
    setMartModel((prev) => ({
      ...prev,
      dimensions: prev.dimensions.filter((d) => d.id !== id),
    }));
  };

  // Remove Measure
  const handleRemoveMeasure = (id: string) => {
    setMartModel((prev) => ({
      ...prev,
      measures: prev.measures.filter((m) => m.id !== id),
    }));
  };

  // Add Join
  const handleAddJoin = (join: DataMartJoinConfig) => {
    setMartModel((prev) => {
      if (prev.joins.some((j) => j.toTable === join.toTable)) return prev;
      return {
        ...prev,
        joins: [...prev.joins, join],
      };
    });
  };

  // Remove Join
  const handleRemoveJoin = (id: string) => {
    setMartModel((prev) => {
      const removedJoin = prev.joins.find((j) => j.id === id);
      const remainingJoins = prev.joins.filter((j) => j.id !== id);
      if (!removedJoin) return prev;

      // Also clean up any dimensions or measures from the removed table
      return {
        ...prev,
        joins: remainingJoins,
        dimensions: prev.dimensions.filter((d) => d.table !== removedJoin.toTable),
        measures: prev.measures.filter((m) => m.table !== removedJoin.toTable),
      };
    });
  };

  // Load an Auto-Mart Suggestion into the Designer
  const handleApplyAutoMart = (suggestion: AutoMartSuggestion) => {
    setMartModel(suggestion.model);
    setActiveTab('designer');
  };

  // Instantly execute an Auto-Mart Suggestion and create view
  const handleInstantRunAutoMart = (suggestion: AutoMartSuggestion) => {
    setMartModel(suggestion.model);
    const executableSql = generateDataMartSelectSql(suggestion.model, 'standard');
    setIsRunningQuery(true);

    setTimeout(() => {
      const res = executeQuery(executableSql, tables.map((t) => t.name));
      setExecutionResult(res);
      setIsRunningQuery(false);
      setActiveTab('results');
    }, 40);
  };

  // Filtered rows for Results view
  const filteredResultRows = useMemo(() => {
    if (!executionResult || !executionResult.data) return [];
    if (!resultFilterSearch.trim()) return executionResult.data;
    const q = resultFilterSearch.toLowerCase();
    return executionResult.data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [executionResult, resultFilterSearch]);

  // Mini Chart data for quick visualizer (Top 8 items)
  const miniChartData = useMemo(() => {
    if (!executionResult || !executionResult.data || executionResult.data.length === 0) return null;
    const dimCol = martModel.dimensions[0]?.alias || executionResult.columns[0];
    const measCol = martModel.measures[0]?.alias || executionResult.columns[1];

    if (!dimCol || !measCol) return null;

    const slice = executionResult.data.slice(0, 8);
    const maxVal = Math.max(...slice.map((r) => Number(r[measCol]) || 0), 1);

    return {
      dimCol,
      measCol,
      items: slice.map((r) => ({
        label: String(r[dimCol] ?? 'N/A'),
        value: Number(r[measCol]) || 0,
        pct: Math.min(100, Math.max(0, ((Number(r[measCol]) || 0) / maxVal) * 100)),
      })),
    };
  }, [executionResult, martModel.dimensions, martModel.measures]);

  // =========================================================
  // ZERO-STATE: NO TABLES LOADED
  // =========================================================
  if (tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4 shadow-inner">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Data Mart BI & Analytical Cube Builder</h2>
        <p className={`text-xs max-w-md mt-2 mb-6 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
          Build subject-oriented Data Marts with drag-and-drop granularity, automated business rollups,
          live in-browser SQL execution, and catalog view creation.
        </p>

        {onLoadSampleDataset && (
          <button
            onClick={() => onLoadSampleDataset('sales_dw')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer transition hover:shadow-blue-500/25"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Load Sample Sales & BI Dataset to Start</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#070d1a]">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: BRAND, TAB NAVIGATION & ACTION BAR */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isBright ? 'bg-white border-slate-200' : 'bg-[#0a1226] border-[#182747]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">Data Mart BI Studio</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                OLAP & Views
              </span>
            </div>
            <p className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
              Drag & drop rollup cubes, smart auto-generated marts, and 1-click SQL views.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div
          className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
            isBright ? 'bg-slate-100 border-slate-300' : 'bg-[#060c18] border-[#182747]'
          }`}
        >
          <button
            onClick={() => setActiveTab('designer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'designer'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GripVertical className="w-3.5 h-3.5" />
            <span>Drag & Drop Designer</span>
          </button>

          <button
            onClick={() => setActiveTab('auto_analysis')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'auto_analysis'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto Analysis Marts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
              {autoSuggestions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sql_script')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'sql_script'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Generated SQL</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'results'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Results & Visualizer</span>
            {executionResult && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                {executionResult.rowCount} rows
              </span>
            )}
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunQuery}
            disabled={isRunningQuery || !martModel.primaryTable}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition disabled:opacity-50"
            title="Execute query live against in-browser SQL engine"
          >
            <Play className={`w-3.5 h-3.5 ${isRunningQuery ? 'animate-spin' : 'fill-white'}`} />
            <span>{isRunningQuery ? 'Running...' : 'Run Query'}</span>
          </button>

          <button
            onClick={handleCreateView}
            disabled={!martModel.primaryTable}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              viewCreatedSuccess
                ? 'bg-emerald-600 text-white border-emerald-500'
                : isBright
                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
            }`}
            title="Create view dm_... in AlaSQL catalog for querying anywhere"
          >
            {viewCreatedSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{viewCreatedSuccess ? `View ${viewCreatedSuccess} Created!` : 'Create View'}</span>
          </button>

          <button
            onClick={handleMaterializeTable}
            disabled={!martModel.primaryTable}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              materializedSuccess
                ? 'bg-purple-600 text-white border-purple-500'
                : isBright
                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
            }`}
            title="Materialize query output as a physical table in workspace"
          >
            {materializedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5 text-purple-400" />}
            <span>{materializedSuccess ? 'Table Saved!' : 'Save as Table'}</span>
          </button>

          {onOpenInSqlEditor && (
            <button
              onClick={handleOpenInSqlStudio}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isBright
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-300'
              }`}
              title="Open query in SQL Studio editor"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUCCESS NOTIFICATION TOAST */}
      {/* ------------------------------------------------------------- */}
      {viewCreatedSuccess && (
        <div className="bg-emerald-600/20 border-b border-emerald-500/40 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>View Created:</strong> View <code className="font-mono bg-emerald-950/60 px-1 py-0.5 rounded">{viewCreatedSuccess}</code> is now registered and queryable in your SQL catalog!
            </span>
          </div>
          <button
            onClick={() => {
              if (onOpenInSqlEditor) onOpenInSqlEditor(`SELECT * FROM ${viewCreatedSuccess} LIMIT 50;`);
              if (onSwitchToStudio) onSwitchToStudio();
            }}
            className="flex items-center gap-1 underline text-emerald-200 hover:text-white cursor-pointer font-semibold"
          >
            <span>Query in Studio</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: DRAG & DROP VISUAL MART DESIGNER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'designer' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* LEFT PALETTE: Available Tables & Columns */}
          <div
            className={`w-full md:w-80 border-r flex flex-col shrink-0 overflow-hidden ${
              isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#091224] border-[#182747]'
            }`}
          >
            {/* Palette Header & Primary Table Picker */}
            <div className="p-3 border-b space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Primary Fact / Source
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
                  {tables.length} tables
                </span>
              </div>

              <select
                value={martModel.primaryTable}
                onChange={(e) => {
                  const tbl = e.target.value;
                  setMartModel((prev) => ({
                    ...prev,
                    primaryTable: tbl,
                    joins: [],
                    dimensions: [],
                    measures: [],
                  }));
                }}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none border cursor-pointer ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-slate-200'
                }`}
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.rowCount} rows · {t.columns.length} cols)
                  </option>
                ))}
              </select>

              {/* Data Mart Name Input */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">Name:</span>
                <input
                  type="text"
                  value={martModel.name}
                  onChange={(e) =>
                    setMartModel((prev) => ({
                      ...prev,
                      name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                    }))
                  }
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-mono focus:outline-none border ${
                    isBright
                      ? 'bg-white border-slate-300 text-slate-800'
                      : 'bg-[#070e1c] border-[#1b2f57] text-slate-200'
                  }`}
                  placeholder="dm_mart_name"
                />
              </div>

              {/* Multi-Table Joins Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Table Joins ({martModel.joins.length})
                  </span>
                  {joinCandidates.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {joinCandidates.length} detected
                    </span>
                  )}
                </div>

                {martModel.joins.length > 0 ? (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {martModel.joins.map((j) => (
                      <div
                        key={j.id}
                        className={`flex items-center justify-between px-2 py-1 rounded border text-[11px] ${
                          isBright
                            ? 'bg-white border-slate-200 text-slate-700'
                            : 'bg-[#0b1733] border-[#1d3566] text-slate-300'
                        }`}
                      >
                        <div className="truncate">
                          <span className="text-blue-400 font-bold">{j.joinType.split(' ')[0]} </span>
                          <span className="font-semibold">{j.toTable}</span>
                          <span className="text-slate-500 text-[10px]"> on {j.fromColumn}={j.toColumn}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveJoin(j.id)}
                          className="text-slate-400 hover:text-red-400 ml-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No joins added yet.</p>
                )}

                {/* Candidate Joins Button list */}
                {joinCandidates.filter((c) => !martModel.joins.some((j) => j.toTable === c.toTable)).length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                      Suggested Joins:
                    </span>
                    {joinCandidates
                      .filter((c) => !martModel.joins.some((j) => j.toTable === c.toTable))
                      .map((cand) => (
                        <button
                          key={cand.id}
                          onClick={() => handleAddJoin(cand)}
                          className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] border text-left cursor-pointer transition ${
                            isBright
                              ? 'bg-blue-50/80 hover:bg-blue-100 border-blue-200 text-blue-900'
                              : 'bg-blue-950/40 hover:bg-blue-900/40 border-blue-800/40 text-blue-300'
                          }`}
                        >
                          <span className="truncate">
                            + Join <strong>{cand.toTable}</strong> ({cand.fromColumn})
                          </span>
                          <Plus className="w-3 h-3 shrink-0 ml-1" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Field Filter & Palette */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields (measure, dim, date)..."
                  className={`w-full pl-8 pr-2.5 py-1 text-xs rounded-lg focus:outline-none border ${
                    isBright
                      ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                      : 'bg-[#070e1c] border-[#182747] text-slate-200 placeholder-slate-500'
                  }`}
                />
              </div>
            </div>

            {/* Column Palette List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {activeModelTables.map((tblName) => {
                const schema = tables.find((t) => t.name === tblName);
                if (!schema) return null;

                const matchingCols = schema.columns.filter((c) =>
                  c.name.toLowerCase().includes(fieldSearch.toLowerCase())
                );
                if (matchingCols.length === 0) return null;

                const isPrimary = tblName === martModel.primaryTable;

                return (
                  <div key={tblName} className="space-y-1">
                    <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
                      <span className="truncate">
                        {tblName} {isPrimary && <span className="text-blue-400 text-[10px] font-normal">(Primary)</span>}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{matchingCols.length}</span>
                    </div>

                    <div className="space-y-1">
                      {matchingCols.map((col) => {
                        const cat = getColumnCategory(col);
                        const isMeasure = cat === 'measure';
                        const isDate = cat === 'date';
                        const isKey = cat === 'key';

                        return (
                          <div
                            key={`${tblName}_${col.name}`}
                            draggable
                            onDragStart={() => setDraggedColumn({ table: tblName, column: col })}
                            onDragEnd={() => setDraggedColumn(null)}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition ${
                              isBright
                                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-2xs'
                                : 'bg-[#0c162e] hover:bg-[#122347] border-[#1a2c52] text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0" />
                              {isMeasure && <Sigma className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                              {isDate && <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                              {isKey && <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {!isMeasure && !isDate && !isKey && <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              <span className="font-mono text-[11px] truncate">{col.name}</span>
                            </div>

                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                              {/* Quick Add Buttons */}
                              {isMeasure ? (
                                <button
                                  onClick={() => handleAddMeasure(tblName, col, 'SUM')}
                                  className="px-1.5 py-0.5 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-[10px] font-mono cursor-pointer transition"
                                  title="Add as SUM measure"
                                >
                                  +SUM
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAddDimension(tblName, col)}
                                  className="px-1.5 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 text-[10px] font-mono cursor-pointer transition"
                                  title="Add as Dimension / Group By"
                                >
                                  +DIM
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT CANVAS: Drop Shelves & Data Mart Settings */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Quick Stats & Granularity Summary */}
            <div
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isBright ? 'bg-white border-slate-200 shadow-2xs' : 'bg-[#091224] border-[#182747]'
              }`}
            >
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Data Mart Topology
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold font-mono text-blue-400">
                    {martModel.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ({martModel.dimensions.length} Dimensions · {martModel.measures.length} Measures)
                  </span>
                </div>
              </div>

              {/* Quick Presets for Measures */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-semibold">Quick Presets:</span>
                <button
                  onClick={() => {
                    if (!primaryTableSchema) return;
                    const measCols = primaryTableSchema.columns.filter(isMeasureColumn);
                    if (measCols.length > 0) {
                      handleAddMeasure(primaryTableSchema.name, measCols[0], 'SUM');
                    }
                  }}
                  className="px-2 py-1 rounded-md text-[11px] bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/20 cursor-pointer transition"
                >
                  + Add Revenue SUM
                </button>
                <button
                  onClick={() => {
                    if (!primaryTableSchema) return;
                    const firstCol = primaryTableSchema.columns[0];
                    if (firstCol) {
                      handleAddMeasure(primaryTableSchema.name, firstCol, 'COUNT');
                    }
                  }}
                  className="px-2 py-1 rounded-md text-[11px] bg-purple-600/15 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 cursor-pointer transition"
                >
                  + Add Transaction COUNT
                </button>
                <button
                  onClick={() => {
                    setMartModel((prev) => ({
                      ...prev,
                      dimensions: [],
                      measures: [],
                      filters: [],
                      havings: [],
                    }));
                  }}
                  className="px-2 py-1 rounded-md text-[11px] bg-slate-700/30 hover:bg-slate-700/60 text-slate-300 border border-slate-600/20 cursor-pointer transition"
                >
                  Clear Shelves
                </button>
              </div>
            </div>

            {/* SHELF 1: DIMENSIONS & GRANULARITY (GROUP BY) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsOverDimensions(true);
              }}
              onDragLeave={() => setIsOverDimensions(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsOverDimensions(false);
                if (draggedColumn) {
                  handleAddDimension(draggedColumn.table, draggedColumn.column);
                }
              }}
              className={`p-3.5 rounded-xl border transition ${
                isOverDimensions
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isBright
                  ? 'bg-white border-slate-200'
                  : 'bg-[#091224] border-[#182747]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Dimensions & Granularity (GROUP BY)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {martModel.dimensions.length} attributes
                </span>
              </div>

              {martModel.dimensions.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center text-slate-500 text-xs">
                  Drag dimension columns here from the field palette, or click "+DIM" on any column
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {martModel.dimensions.map((dim) => (
                    <div
                      key={dim.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                        isBright
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : 'bg-[#0c162e] border-[#1a2c52] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {dim.table}
                          </span>
                          <span className="font-semibold text-xs truncate">{dim.column}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveDimension(dim.id)}
                          className="text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/40 text-[11px]">
                        <span className="text-slate-400 text-[10px]">Alias:</span>
                        <input
                          type="text"
                          value={dim.alias || dim.column}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMartModel((prev) => ({
                              ...prev,
                              dimensions: prev.dimensions.map((d) =>
                                d.id === dim.id ? { ...d, alias: val } : d
                              ),
                            }));
                          }}
                          className={`flex-1 px-1.5 py-0.5 rounded text-[11px] font-mono focus:outline-none border ${
                            isBright
                              ? 'bg-white border-slate-300 text-slate-800'
                              : 'bg-[#070e1c] border-[#182747] text-slate-200'
                          }`}
                        />

                        {/* Date Grain selector */}
                        {dim.dateGrain && (
                          <select
                            value={dim.dateGrain}
                            onChange={(e) => {
                              const grain = e.target.value as DataMartDateGrain;
                              setMartModel((prev) => ({
                                ...prev,
                                dimensions: prev.dimensions.map((d) =>
                                  d.id === dim.id ? { ...d, dateGrain: grain } : d
                                ),
                              }));
                            }}
                            className="px-1 py-0.5 rounded text-[10px] bg-[#122347] border border-[#223d75] text-purple-300 cursor-pointer"
                          >
                            <option value="none">Raw Date</option>
                            <option value="year">Year</option>
                            <option value="quarter">Quarter</option>
                            <option value="month">Month</option>
                            <option value="day">Day</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SHELF 2: MEASURES & AGGREGATIONS */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsOverMeasures(true);
              }}
              onDragLeave={() => setIsOverMeasures(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsOverMeasures(false);
                if (draggedColumn) {
                  handleAddMeasure(draggedColumn.table, draggedColumn.column, 'SUM');
                }
              }}
              className={`p-3.5 rounded-xl border transition ${
                isOverMeasures
                  ? 'border-blue-500 bg-blue-500/10'
                  : isBright
                  ? 'bg-white border-slate-200'
                  : 'bg-[#091224] border-[#182747]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sigma className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Measures & Aggregations (SELECT AGG)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {martModel.measures.length} metrics
                </span>
              </div>

              {martModel.measures.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center text-slate-500 text-xs">
                  Drag numeric metric columns here from the palette, or click "+SUM" on any column
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {martModel.measures.map((meas) => (
                    <div
                      key={meas.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                        isBright
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : 'bg-[#0c162e] border-[#1a2c52] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <select
                            value={meas.aggregation}
                            onChange={(e) => {
                              const agg = e.target.value as DataMartAggregation;
                              setMartModel((prev) => ({
                                ...prev,
                                measures: prev.measures.map((m) =>
                                  m.id === meas.id ? { ...m, aggregation: agg } : m
                                ),
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 cursor-pointer"
                          >
                            <option value="SUM">SUM</option>
                            <option value="AVG">AVG</option>
                            <option value="COUNT">COUNT</option>
                            <option value="COUNT_DISTINCT">COUNT DISTINCT</option>
                            <option value="MIN">MIN</option>
                            <option value="MAX">MAX</option>
                          </select>
                          <span className="font-semibold text-xs truncate">{meas.column}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveMeasure(meas.id)}
                          className="text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/40 text-[11px]">
                        <span className="text-slate-400 text-[10px]">Alias:</span>
                        <input
                          type="text"
                          value={meas.alias}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMartModel((prev) => ({
                              ...prev,
                              measures: prev.measures.map((m) =>
                                m.id === meas.id ? { ...m, alias: val } : m
                              ),
                            }));
                          }}
                          className={`flex-1 px-1.5 py-0.5 rounded text-[11px] font-mono focus:outline-none border ${
                            isBright
                              ? 'bg-white border-slate-300 text-slate-800'
                              : 'bg-[#070e1c] border-[#182747] text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SHELF 3: SLICING FILTERS & THRESHOLDS (WHERE & HAVING) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WHERE FILTERS */}
              <div
                className={`p-3.5 rounded-xl border ${
                  isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Slicing Filters (WHERE)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (!primaryTableSchema) return;
                      const col = primaryTableSchema.columns[0];
                      if (!col) return;
                      const newFilter: DataMartFilterConfig = {
                        id: `filter_${Date.now()}`,
                        table: primaryTableSchema.name,
                        column: col.name,
                        operator: '=',
                        value: '',
                      };
                      setMartModel((prev) => ({
                        ...prev,
                        filters: [...prev.filters, newFilter],
                      }));
                    }}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Filter</span>
                  </button>
                </div>

                {martModel.filters.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-2">
                    No slicing filters configured. The mart will process all input rows.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {martModel.filters.map((f) => (
                      <div
                        key={f.id}
                        className={`p-2 rounded-lg border flex items-center gap-2 text-xs ${
                          isBright
                            ? 'bg-slate-50 border-slate-200 text-slate-800'
                            : 'bg-[#0c162e] border-[#1a2c52] text-slate-200'
                        }`}
                      >
                        <select
                          value={f.column}
                          onChange={(e) => {
                            const colName = e.target.value;
                            setMartModel((prev) => ({
                              ...prev,
                              filters: prev.filters.map((item) =>
                                item.id === f.id ? { ...item, column: colName } : item
                              ),
                            }));
                          }}
                          className="px-1.5 py-0.5 rounded text-[11px] bg-[#122347] border border-[#223d75] text-slate-200"
                        >
                          {primaryTableSchema?.columns.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={f.operator}
                          onChange={(e) => {
                            const op = e.target.value as any;
                            setMartModel((prev) => ({
                              ...prev,
                              filters: prev.filters.map((item) =>
                                item.id === f.id ? { ...item, operator: op } : item
                              ),
                            }));
                          }}
                          className="px-1.5 py-0.5 rounded text-[11px] bg-[#122347] border border-[#223d75] text-slate-200 font-mono"
                        >
                          <option value="=">=</option>
                          <option value="!=">!=</option>
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<=">&lt;=</option>
                          <option value="LIKE">LIKE</option>
                          <option value="IS NOT NULL">IS NOT NULL</option>
                        </select>

                        {f.operator !== 'IS NOT NULL' && (
                          <input
                            type="text"
                            value={f.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMartModel((prev) => ({
                                ...prev,
                                filters: prev.filters.map((item) =>
                                  item.id === f.id ? { ...item, value: val } : item
                                ),
                              }));
                            }}
                            placeholder="Value..."
                            className="flex-1 px-1.5 py-0.5 rounded text-[11px] bg-[#070e1c] border border-[#182747] text-slate-200 focus:outline-none"
                          />
                        )}

                        <button
                          onClick={() => {
                            setMartModel((prev) => ({
                              ...prev,
                              filters: prev.filters.filter((item) => item.id !== f.id),
                            }));
                          }}
                          className="text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SORT & LIMITS */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Sort & Output Limit (ORDER BY & LIMIT)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                        Sort By Column:
                      </span>
                      <select
                        value={martModel.sort?.columnOrAlias || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMartModel((prev) => ({
                            ...prev,
                            sort: val ? { columnOrAlias: val, direction: prev.sort?.direction || 'DESC' } : undefined,
                          }));
                        }}
                        className="w-full px-2 py-1 rounded text-xs bg-[#122347] border border-[#223d75] text-slate-200"
                      >
                        <option value="">Default (First Measure DESC)</option>
                        {martModel.measures.map((m) => (
                          <option key={m.alias} value={m.alias}>
                            {m.alias} (Measure)
                          </option>
                        ))}
                        {martModel.dimensions.map((d) => (
                          <option key={d.alias || d.column} value={d.alias || d.column}>
                            {d.alias || d.column} (Dimension)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                        Direction:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (martModel.sort) {
                              setMartModel((prev) => ({
                                ...prev,
                                sort: prev.sort ? { ...prev.sort, direction: 'DESC' } : undefined,
                              }));
                            }
                          }}
                          className={`flex-1 py-1 text-xs font-semibold rounded border cursor-pointer ${
                            martModel.sort?.direction === 'DESC' || !martModel.sort
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-[#122347] border-[#223d75] text-slate-300'
                          }`}
                        >
                          DESC (High to Low)
                        </button>
                        <button
                          onClick={() => {
                            if (martModel.sort) {
                              setMartModel((prev) => ({
                                ...prev,
                                sort: prev.sort ? { ...prev.sort, direction: 'ASC' } : undefined,
                              }));
                            }
                          }}
                          className={`flex-1 py-1 text-xs font-semibold rounded border cursor-pointer ${
                            martModel.sort?.direction === 'ASC'
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-[#122347] border-[#223d75] text-slate-300'
                          }`}
                        >
                          ASC (A-Z)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/40">
                  <span className="text-xs text-slate-400">Max Row Limit:</span>
                  <select
                    value={martModel.limit || 100}
                    onChange={(e) => {
                      const lim = parseInt(e.target.value, 10);
                      setMartModel((prev) => ({ ...prev, limit: lim > 0 ? lim : undefined }));
                    }}
                    className="px-2 py-1 rounded text-xs bg-[#122347] border border-[#223d75] text-slate-200 font-mono"
                  >
                    <option value="25">Top 25</option>
                    <option value="50">Top 50</option>
                    <option value="100">Top 100</option>
                    <option value="500">Top 500</option>
                    <option value="1000">Top 1,000</option>
                    <option value="0">All Rows (No Limit)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* LIVE SQL PREVIEW STRIP AT BOTTOM OF DESIGNER */}
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isBright ? 'bg-slate-100 border-slate-300' : 'bg-[#060c18] border-[#182747]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold font-mono text-emerald-400">Live SQL Preview</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  (Auto-synchronizes as you drag & drop)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('sql_script')}
                  className="px-2.5 py-1 text-xs rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40 cursor-pointer transition font-semibold"
                >
                  Inspect Full DDL & Scripts
                </button>
                <button
                  onClick={handleRunQuery}
                  className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Run Query Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: AUTO ANALYSIS & SMART DATA MARTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'auto_analysis' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-6xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold">Auto-Generated Business Data Marts</h2>
            </div>
            <p className={`text-xs mt-1 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
              Intelligent heuristics analyzed your {tables.length} tables and generated {autoSuggestions.length} tailored OLAP data marts.
              Click to customize in the designer, or immediately execute and register as a catalog view!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {autoSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition hover:shadow-lg ${
                  isBright
                    ? 'bg-white border-slate-200 hover:border-blue-400'
                    : 'bg-[#091224] border-[#182747] hover:border-blue-500/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      {suggestion.badge}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">
                      {suggestion.model.name}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold">{suggestion.model.description || suggestion.name}</h3>
                  <p className={`text-xs mt-1 ${isBright ? 'text-slate-600' : 'text-slate-300'}`}>
                    {suggestion.description}
                  </p>

                  <div className="mt-3 p-2 rounded-lg bg-[#060c18] border border-[#162544] text-[11px] font-mono space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Tag className="w-3 h-3" />
                      <span>Dims: {suggestion.model.dimensions.map((d) => d.alias || d.column).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <Sigma className="w-3 h-3" />
                      <span>Measures: {suggestion.model.measures.map((m) => `${m.aggregation}(${m.column})`).join(', ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/40">
                  <button
                    onClick={() => handleApplyAutoMart(suggestion)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#122347] hover:bg-[#1a3266] text-blue-300 border border-[#223d75] cursor-pointer transition"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                    <span>Customize in Designer</span>
                  </button>

                  <button
                    onClick={() => handleInstantRunAutoMart(suggestion)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Instant Run & View</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: GENERATED SQL SCRIPTING & DDL CENTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sql_script' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-5xl mx-auto w-full">
          {/* Controls Bar */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSqlScriptMode('select')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  sqlScriptMode === 'select'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                SELECT Query
              </button>

              <button
                onClick={() => setSqlScriptMode('create_view')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  sqlScriptMode === 'create_view'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                CREATE VIEW
              </button>

              <button
                onClick={() => setSqlScriptMode('create_table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  sqlScriptMode === 'create_table'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                CREATE TABLE (CTAS)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">Dialect:</span>
              <select
                value={sqlDialect}
                onChange={(e) => setSqlDialect(e.target.value as SqlDialect)}
                className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-[#060c18] border border-[#182747] text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="standard">Standard ANSI / AlaSQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="snowflake">Snowflake</option>
                <option value="bigquery">Google BigQuery</option>
              </select>

              <button
                onClick={handleCopySql}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition border border-slate-700"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownloadSql}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.sql</span>
              </button>
            </div>
          </div>

          {/* Syntax-Highlighted Code Editor Display */}
          <div className="rounded-xl border border-[#182747] bg-[#050b17] overflow-hidden shadow-xl">
            <div className="px-4 py-2 border-b border-[#182747] bg-[#081020] flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>{martModel.name}.sql ({sqlDialect.toUpperCase()})</span>
              <span>{currentDisplaySql.split('\n').length} lines</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
              <code>{highlightSql(currentDisplaySql)}</code>
            </pre>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: RESULTS GRID & LIVE BI VISUALIZER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'results' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 space-y-3">
          {/* Results Action Bar */}
          <div
            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 shrink-0 ${
              isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
            }`}
          >
            <div className="flex items-center gap-3">
              {executionResult && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    ✓ {executionResult.rowCount.toLocaleString()} rows
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    in {executionResult.executionTimeMs}ms
                  </span>
                </div>
              )}

              {/* In-table Filter Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={resultFilterSearch}
                  onChange={(e) => setResultFilterSearch(e.target.value)}
                  placeholder="Filter mart results..."
                  className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-[#060c18] border border-[#182747] text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportResults('xlsx')}
                disabled={!executionResult || executionResult.rowCount === 0}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={() => handleExportResults('csv')}
                disabled={!executionResult || executionResult.rowCount === 0}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition border border-slate-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleRunQuery}
                disabled={isRunningQuery}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningQuery ? 'animate-spin' : ''}`} />
                <span>Re-run Query</span>
              </button>
            </div>
          </div>

          {/* Quick BI Visualizer Strip (Top 8 items) */}
          {miniChartData && miniChartData.items.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border shrink-0 ${
                isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Quick BI Summary: {miniChartData.measCol} by {miniChartData.dimCol}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Top 8 slices</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {miniChartData.items.map((item, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-[#060c18] border border-[#162544] flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 truncate font-semibold" title={item.label}>
                      {item.label}
                    </span>
                    <div className="mt-1">
                      <span className="text-xs font-bold font-mono text-blue-400">
                        {item.value.toLocaleString()}
                      </span>
                      <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabular Data Grid */}
          <div
            className={`flex-1 min-h-0 border rounded-xl overflow-hidden flex flex-col ${
              isBright ? 'bg-white border-slate-200' : 'bg-[#060c18] border-[#182747]'
            }`}
          >
            {!executionResult ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <Play className="w-8 h-8 text-blue-500/40 mb-2" />
                <p className="text-xs">Click "Run Query" or "Instant Run & View" to execute the Data Mart</p>
              </div>
            ) : executionResult.error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-red-400">
                <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-xs font-bold">SQL Execution Error</p>
                <p className="text-xs font-mono mt-1 text-slate-400 max-w-lg">{executionResult.error}</p>
              </div>
            ) : filteredResultRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <p className="text-xs">0 rows returned matching filter criteria</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="sticky top-0 bg-[#0a1226] border-b border-[#182747] text-slate-300 text-[11px] font-bold z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center text-slate-500">#</th>
                      {executionResult.columns.map((col) => (
                        <th key={col} className="p-2.5 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                    {filteredResultRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-600/10 transition">
                        <td className="p-2.5 text-center text-slate-500 text-[10px]">{idx + 1}</td>
                        {executionResult.columns.map((col) => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className="p-2.5 whitespace-nowrap">
                              {isNum ? val.toLocaleString() : String(val ?? '')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
