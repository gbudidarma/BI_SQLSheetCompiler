/**
 * DuplicateChecker.tsx
 * Comprehensive duplicate data analysis, composite column duplicate detection,
 * table-wide column uniqueness audit, and deduplication SQL generator.
 */

import React, { useState, useMemo } from 'react';
import {
  CopyCheck,
  Search,
  Filter,
  Database,
  Sparkles,
  Check,
  Copy,
  Play,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Table as TableIcon,
  RefreshCw,
  FileSpreadsheet,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { TableSchema } from '../types';
import {
  analyzeColumnDuplicates,
  auditAllColumns,
  generateDeduplicationSql,
  performDeduplication,
  DuplicateOptions
} from '../utils/duplicateAnalyzer';
import { highlightSql } from '../utils/sqlHighlighter';
import { exportToExcel } from '../utils/exportHelper';
import { useTheme } from '../context/ThemeContext';

interface DuplicateCheckerProps {
  tables: TableSchema[];
  onExecuteQuery?: (sql: string) => void;
  onSaveAsTable?: (tableName: string, data: Record<string, any>[]) => void;
  onSwitchToStudio?: () => void;
}

export const DuplicateChecker: React.FC<DuplicateCheckerProps> = ({
  tables,
  onExecuteQuery,
  onSaveAsTable,
  onSwitchToStudio,
}) => {
  const { theme } = useTheme();

  // 1. Table Selection
  const [selectedTableName, setSelectedTableName] = useState<string>(() => {
    return tables[0]?.name || '';
  });

  // Ensure selected table exists
  React.useEffect(() => {
    if (!tables.some((t) => t.name === selectedTableName) && tables.length > 0) {
      setSelectedTableName(tables[0].name);
    }
  }, [tables, selectedTableName]);

  const currentTable = useMemo(() => {
    return tables.find((t) => t.name === selectedTableName);
  }, [tables, selectedTableName]);

  // Table rows from in-memory engine or previewRows
  const tableRows = useMemo<Record<string, any>[]>(() => {
    if (!currentTable) return [];
    return (window as any).alasql?.tables?.[currentTable.name]?.data || currentTable.previewRows || [];
  }, [currentTable]);

  // 2. Column Selection & Mode
  // 'single' | 'composite' | 'full_row'
  const [selectionMode, setSelectionMode] = useState<'single' | 'composite' | 'full_row'>('single');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    return currentTable?.columns[0]?.name ? [currentTable.columns[0].name] : [];
  });

  // Reset selected columns when table changes if they are invalid
  React.useEffect(() => {
    if (currentTable) {
      const validCols = selectedColumns.filter((c) => currentTable.columns.some((tc) => tc.name === c));
      if (validCols.length === 0 && currentTable.columns.length > 0) {
        setSelectedColumns([currentTable.columns[0].name]);
      } else if (validCols.length !== selectedColumns.length) {
        setSelectedColumns(validCols);
      }
    }
  }, [currentTable]);

  // Analysis options
  const [options, setOptions] = useState<DuplicateOptions>({
    caseInsensitive: false,
    trimWhitespace: true,
    ignoreNulls: false,
  });

  // Active sub-tab
  // 'groups' | 'all_rows' | 'audit' | 'sql'
  const [activeTab, setActiveTab] = useState<'groups' | 'all_rows' | 'audit' | 'sql'>('groups');

  // Filter/Search within results
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  // SQL Generator state
  const [sqlStrategy, setSqlStrategy] = useState<'find_counts' | 'view_full_rows' | 'keep_first' | 'keep_last' | 'remove_all_dupes'>('view_full_rows');
  const [orderByCol, setOrderByCol] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Save Deduplicated Table dialog state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [saveStrategy, setSaveStrategy] = useState<'keep_first' | 'keep_last' | 'remove_all_dupes'>('keep_first');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Effective columns to check based on selectionMode
  const effectiveColumns = useMemo(() => {
    if (!currentTable) return [];
    if (selectionMode === 'full_row') {
      return currentTable.columns.map((c) => c.name);
    }
    return selectedColumns;
  }, [selectionMode, selectedColumns, currentTable]);

  // Run duplicate analysis
  const analysis = useMemo(() => {
    if (!currentTable || tableRows.length === 0 || effectiveColumns.length === 0) {
      return null;
    }
    return analyzeColumnDuplicates(tableRows, effectiveColumns, currentTable.name, options);
  }, [tableRows, effectiveColumns, currentTable, options]);

  // Run full table column audit
  const columnAudit = useMemo(() => {
    if (!currentTable || tableRows.length === 0) return [];
    return auditAllColumns(tableRows, currentTable.columns);
  }, [currentTable, tableRows]);

  // Generated SQL Query
  const generatedSql = useMemo(() => {
    if (!currentTable || effectiveColumns.length === 0) return '';
    return generateDeduplicationSql(currentTable.name, effectiveColumns, sqlStrategy, orderByCol || undefined);
  }, [currentTable, effectiveColumns, sqlStrategy, orderByCol]);

  // Filtered Duplicate Groups for display
  const filteredGroups = useMemo(() => {
    if (!analysis) return [];
    if (!searchFilter.trim()) return analysis.duplicateGroups;
    const q = searchFilter.toLowerCase();
    return analysis.duplicateGroups.filter((g) => g.keyString.toLowerCase().includes(q));
  }, [analysis, searchFilter]);

  // Filtered All Duplicate Rows
  const filteredRows = useMemo(() => {
    if (!analysis) return [];
    if (!searchFilter.trim()) return analysis.allDuplicateRows;
    const q = searchFilter.toLowerCase();
    return analysis.allDuplicateRows.filter((item) => {
      if (item.groupKey.toLowerCase().includes(q)) return true;
      return Object.values(item.row).some((val) => String(val ?? '').toLowerCase().includes(q));
    });
  }, [analysis, searchFilter]);

  // Toggle column selection
  const handleToggleColumn = (colName: string) => {
    if (selectionMode === 'single') {
      setSelectedColumns([colName]);
    } else if (selectionMode === 'composite') {
      setSelectedColumns((prev) => {
        if (prev.includes(colName)) {
          if (prev.length === 1) return prev; // Keep at least one
          return prev.filter((c) => c !== colName);
        } else {
          return [...prev, colName];
        }
      });
    }
  };

  // Quick switch from Audit view to inspect a specific column
  const handleInspectColumnFromAudit = (colName: string) => {
    setSelectionMode('single');
    setSelectedColumns([colName]);
    setActiveTab('groups');
  };

  // Toggle group expansion in table
  const handleToggleGroupExpand = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (!analysis) return;
    setExpandedGroupKeys(new Set(analysis.duplicateGroups.map((g) => g.keyString)));
  };

  const handleCollapseAll = () => {
    setExpandedGroupKeys(new Set());
  };

  // Copy SQL to clipboard
  const handleCopySql = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Run in SQL Studio
  const handleRunInStudio = () => {
    if (!generatedSql || !onExecuteQuery) return;
    onExecuteQuery(generatedSql);
  };

  // Export duplicates report
  const handleExportDuplicates = () => {
    if (!analysis || !currentTable) return;
    const reportData = analysis.allDuplicateRows.map((item) => ({
      ...item.row,
      _DUPLICATE_KEY: item.groupKey,
      _REPEAT_COUNT: item.groupCount,
    }));
    exportToExcel(reportData, [...currentTable.columns.map((c) => c.name), '_DUPLICATE_KEY', '_REPEAT_COUNT'], `${currentTable.name}_duplicates`);
  };

  // Perform client-side deduplication and save as table
  const handleSaveDeduplicatedTable = () => {
    if (!currentTable || !onSaveAsTable || !newTableName.trim()) return;
    const result = performDeduplication(tableRows, effectiveColumns, saveStrategy, options);
    onSaveAsTable(newTableName.trim(), result.cleanedRows);
    setSaveSuccessMsg(`Successfully saved ${result.cleanedRows.length} unique rows into table "${newTableName.trim()}" (${result.removedCount} duplicate rows removed)!`);
    setTimeout(() => {
      setIsSaveModalOpen(false);
      setSaveSuccessMsg(null);
    }, 2200);
  };

  if (tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#070e1c] text-slate-400">
        <Database className="w-12 h-12 text-slate-600 mb-3" />
        <h2 className="text-lg font-semibold text-slate-200">No tables available for duplicate analysis</h2>
        <p className="text-xs text-slate-500 max-w-sm text-center mt-1">
          Upload an Excel or CSV spreadsheet, or load a sample dataset to check for duplicated data and columns.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070e1c] text-slate-100 overflow-hidden font-sans">
      {/* Top Banner / Table & Controls Configuration */}
      <div className="bg-[#0b1429] border-b border-[#162544] px-3 sm:px-6 py-3 sm:py-4 shrink-0 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Header Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shadow-inner shrink-0">
              <CopyCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">Duplicate Inspector</h1>
                <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full font-semibold hidden sm:inline">
                  Data Quality & Integrity
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                Detect duplicate column values, composite collisions, and generate de-duplication SQL.
              </p>
            </div>
          </div>

          {/* Table Selector & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Table Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#091326] px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#1b2f56]">
              <Database className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs text-slate-400">Table:</span>
              <select
                value={selectedTableName}
                onChange={(e) => {
                  setSelectedTableName(e.target.value);
                  const tbl = tables.find((t) => t.name === e.target.value);
                  if (tbl && tbl.columns.length > 0) {
                    setSelectedColumns([tbl.columns[0].name]);
                  }
                }}
                className="bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none cursor-pointer"
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name} className="bg-[#0b1429] text-white">
                    {t.name} ({t.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>

            {/* Deduplicate & Save Button */}
            <button
              onClick={() => {
                setNewTableName(`${currentTable?.name || 'table'}_deduped`);
                setIsSaveModalOpen(true);
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm shadow-emerald-900/30"
              title="Save cleaned data without duplicates as a new table"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deduplicate & Save</span>
            </button>

            {/* Export Duplicates */}
            <button
              onClick={handleExportDuplicates}
              disabled={!analysis || analysis.duplicateGroups.length === 0}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                analysis && analysis.duplicateGroups.length > 0
                  ? 'bg-[#101f3d] hover:bg-[#182e5c] border-[#1e3a6d] text-slate-200'
                  : 'bg-[#0a1224] border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
              title="Download duplicate rows to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Mode Selector & Matching Options */}
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-[#142340] flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
          {/* Target Selection Mode */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
            <span className="text-slate-400 font-medium shrink-0">Mode:</span>
            <div className="flex items-center bg-[#070e1c] p-0.5 rounded-lg border border-[#162544] overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => {
                  setSelectionMode('single');
                  if (selectedColumns.length > 1) {
                    setSelectedColumns([selectedColumns[0]]);
                  }
                }}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  selectionMode === 'single'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Column
              </button>
              <button
                onClick={() => setSelectionMode('composite')}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  selectionMode === 'composite'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Composite Key (Multi-Column)
              </button>
              <button
                onClick={() => setSelectionMode('full_row')}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  selectionMode === 'full_row'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Entire Row (All Columns)
              </button>
            </div>
          </div>

          {/* Matching options (Case, Trim, Ignore Null) */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.trimWhitespace}
                onChange={(e) => setOptions((prev) => ({ ...prev, trimWhitespace: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Trim Whitespace</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.caseInsensitive}
                onChange={(e) => setOptions((prev) => ({ ...prev, caseInsensitive: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Case-Insensitive (Aa = aa)</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.ignoreNulls}
                onChange={(e) => setOptions((prev) => ({ ...prev, ignoreNulls: e.target.checked }))}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Ignore Empty/NULL Rows</span>
            </label>
          </div>
        </div>

        {/* Column Selection Pills Bar (When not in full_row mode) */}
        {selectionMode !== 'full_row' && currentTable && (
          <div className="mt-3 pt-3 border-t border-[#142340]/60 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold shrink-0">
              {selectionMode === 'single' ? 'Select Column:' : 'Select Columns for Composite Key:'}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentTable.columns.map((col) => {
                const isSelected = selectedColumns.includes(col.name);
                return (
                  <button
                    key={col.name}
                    onClick={() => handleToggleColumn(col.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                        : 'bg-[#091326] text-slate-300 border-[#1c3058] hover:border-blue-500/50 hover:bg-[#0e1c38]'
                    }`}
                  >
                    <span>{col.name}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase font-bold ${
                        isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {col.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* KPI Metric Summary Cards */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-[#081022] border-b border-[#142340] shrink-0">
          {/* Card 1: Total Rows */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Rows Scanned</span>
              <Database className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-white">{analysis.totalRows.toLocaleString()}</span>
              {analysis.nullRowsCount > 0 && (
                <span className="text-[10px] text-slate-400">({analysis.nullRowsCount} null)</span>
              )}
            </div>
          </div>

          {/* Card 2: Unique Values */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Unique Values</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-emerald-300">
                {analysis.uniqueValuesCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">keys</span>
            </div>
          </div>

          {/* Card 3: Duplicate Keys Count */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Repeating Values</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold ${
                  analysis.duplicateValuesCount > 0 ? 'text-amber-300' : 'text-slate-300'
                }`}
              >
                {analysis.duplicateValuesCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">keys</span>
            </div>
          </div>

          {/* Card 4: Excess Duplicate Rows */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Redundant Rows</span>
              <Copy className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold ${
                  analysis.excessDuplicateCount > 0 ? 'text-rose-300' : 'text-emerald-400'
                }`}
              >
                {analysis.excessDuplicateCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">
                ({analysis.duplicateRate}%)
              </span>
            </div>
          </div>

          {/* Card 5: Uniqueness Rate */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Uniqueness Rate</span>
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{analysis.uniquenessRate}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    analysis.uniquenessRate >= 99
                      ? 'bg-emerald-500'
                      : analysis.uniquenessRate >= 90
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${analysis.uniquenessRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 6: Integrity Status / Candidate Key */}
          <div className="bg-[#0c162e] border border-[#182a52] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Integrity Verdict</span>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="mt-2">
              {analysis.isCandidatePrimaryKey ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  <Check className="w-3 h-3" /> Valid Primary Key
                </span>
              ) : analysis.duplicateValuesCount === 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-700/60">
                  <Check className="w-3 h-3" /> 100% Unique
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-700/60">
                  <AlertTriangle className="w-3 h-3" /> Has Duplicates
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace: Navigation Tabs + Inspector Panel */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between px-2.5 sm:px-6 py-2 bg-[#0a1226] border-b border-[#162544] shrink-0 overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'groups'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101e3b]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Duplicate </span>Groups</span>
              {analysis && analysis.duplicateGroups.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {analysis.duplicateGroups.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all_rows')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'all_rows'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101e3b]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">All Duplicate </span>Rows</span>
              {analysis && analysis.allDuplicateRows.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {analysis.allDuplicateRows.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101e3b]'
              }`}
            >
              <CopyCheck className="w-3.5 h-3.5" />
              <span>Column Audit</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                {currentTable?.columns.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'sql'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#101e3b]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Deduplication </span>SQL</span>
            </button>
          </div>

          {/* Search bar inside Duplicate views */}
          {(activeTab === 'groups' || activeTab === 'all_rows') && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter duplicate values..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-[#060c18] border border-[#162544] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
                />
              </div>

              {activeTab === 'groups' && analysis && analysis.duplicateGroups.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <button
                    onClick={handleExpandAll}
                    className="px-2 py-1 rounded bg-[#0e1a34] hover:text-white border border-[#1b2f56] cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="px-2 py-1 rounded bg-[#0e1a34] hover:text-white border border-[#1b2f56] cursor-pointer"
                  >
                    Collapse
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: Duplicate Groups */}
        {activeTab === 'groups' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 bg-[#070e1c]">
            {filteredGroups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-600/50 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">No Duplicate Values Found!</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
                  Every entry across{' '}
                  <span className="font-mono text-emerald-300 font-semibold">
                    {effectiveColumns.join(', ')}
                  </span>{' '}
                  is completely distinct in table{' '}
                  <span className="font-semibold text-white">&quot;{currentTable?.name}&quot;</span>.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
                  >
                    Audit Other Columns
                  </button>
                  <button
                    onClick={() => setActiveTab('sql')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0e1a34] border border-[#1b2f56] hover:bg-[#14264c] text-slate-200 text-xs cursor-pointer font-medium"
                  >
                    View SQL Templates
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Found <strong className="text-rose-300">{filteredGroups.length}</strong> distinct duplicate values
                    causing <strong className="text-amber-300">{analysis?.excessDuplicateCount}</strong> redundant rows.
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Click any group to expand and examine all matching records.
                  </span>
                </div>

                {/* Duplicate Groups List */}
                <div className="space-y-2">
                  {filteredGroups.map((group, idx) => {
                    const isExpanded = expandedGroupKeys.has(group.keyString);
                    return (
                      <div
                        key={group.keyString + idx}
                        className="bg-[#0b1429] border border-[#182747] rounded-xl overflow-hidden shadow-sm hover:border-blue-500/40 transition-colors"
                      >
                        {/* Group Header */}
                        <div
                          onClick={() => handleToggleGroupExpand(group.keyString)}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-[#0c162e] hover:bg-[#101c3b] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button className="text-slate-400 hover:text-white transition">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs font-mono font-bold text-white bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-md max-w-xl truncate">
                              {group.keyString}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                              Key: {effectiveColumns.join(', ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 font-mono">
                              {group.count} instances ({group.percentage.toFixed(1)}%)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                              Row indices: {group.rowIndices.slice(0, 3).join(', ')}
                              {group.rowIndices.length > 3 ? '...' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Records Grid */}
                        {isExpanded && (
                          <div className="p-4 bg-[#070e1c] border-t border-[#142340] overflow-x-auto">
                            <table className="w-full text-xs text-left font-mono border-collapse">
                              <thead>
                                <tr className="border-b border-[#162544] text-slate-400 uppercase text-[10px]">
                                  <th className="py-1.5 px-3">Row #</th>
                                  {currentTable?.columns.map((c) => {
                                    const isKey = effectiveColumns.includes(c.name);
                                    return (
                                      <th
                                        key={c.name}
                                        className={`py-1.5 px-3 ${
                                          isKey ? 'text-amber-300 bg-amber-950/20' : ''
                                        }`}
                                      >
                                        {c.name} {isKey && '★'}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#142340]/60">
                                {group.rows.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="hover:bg-blue-950/20 transition-colors"
                                  >
                                    <td className="py-2 px-3 text-slate-500 font-bold">
                                      #{group.rowIndices[rIdx] + 1}
                                    </td>
                                    {currentTable?.columns.map((c) => {
                                      const isKey = effectiveColumns.includes(c.name);
                                      const val = row[c.name];
                                      return (
                                        <td
                                          key={c.name}
                                          className={`py-2 px-3 truncate max-w-xs ${
                                            isKey
                                              ? 'text-amber-200 font-semibold bg-amber-950/30'
                                              : 'text-slate-300'
                                          }`}
                                        >
                                          {val === null || val === undefined ? (
                                            <span className="text-slate-600 italic font-sans">NULL</span>
                                          ) : (
                                            String(val)
                                          )}
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: All Duplicate Rows (Flat List) */}
        {activeTab === 'all_rows' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 bg-[#070e1c]">
            {filteredRows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <h4 className="text-sm font-bold text-white">No Duplicate Rows to Display</h4>
                <p className="text-xs text-slate-500 mt-1">There are no duplicate entries in the current selection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#162544] rounded-xl bg-[#091326] shadow-md">
                <table className="w-full text-xs text-left font-mono border-collapse">
                  <thead>
                    <tr className="bg-[#0b1429] border-b border-[#182747] text-slate-300 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-3 text-slate-400 w-16">Row</th>
                      <th className="py-2.5 px-3 text-amber-300 bg-amber-950/30 border-r border-[#182747]">
                        Duplicate Key ({effectiveColumns.join(' + ')})
                      </th>
                      {currentTable?.columns.map((c) => {
                        const isKey = effectiveColumns.includes(c.name);
                        return (
                          <th
                            key={c.name}
                            className={`py-2.5 px-3 ${
                              isKey ? 'text-amber-300 bg-amber-950/20' : 'text-slate-300'
                            }`}
                          >
                            {c.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142340]">
                    {filteredRows.map((item, idx) => {
                      const isZebra = item.groupColorIndex === 1;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isZebra ? 'bg-[#0a1226]' : 'bg-[#070e1c]'
                          } hover:bg-blue-900/20`}
                        >
                          <td className="py-2 px-3 text-slate-500 font-bold">
                            #{item.rowIndex + 1}
                          </td>
                          <td className="py-2 px-3 font-semibold text-amber-300 border-r border-[#182747] bg-amber-950/20 truncate max-w-xs">
                            <span className="bg-amber-900/40 px-1.5 py-0.5 rounded border border-amber-600/40">
                              {item.groupKey}
                            </span>
                          </td>
                          {currentTable?.columns.map((c) => {
                            const isKey = effectiveColumns.includes(c.name);
                            const val = item.row[c.name];
                            return (
                              <td
                                key={c.name}
                                className={`py-2 px-3 truncate max-w-xs ${
                                  isKey ? 'text-amber-200 font-semibold' : 'text-slate-300'
                                }`}
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-slate-600 italic font-sans">NULL</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Table Column Audit (Audit every column in table) */}
        {activeTab === 'audit' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 bg-[#070e1c]">
            <div className="max-w-6xl mx-auto w-full space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div>
                  <h3 className="text-sm font-bold text-white">Full Table Column Audit: &quot;{currentTable?.name}&quot;</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Evaluate uniqueness, duplicate counts, and primary key suitability for each column.
                  </p>
                </div>
                <span className="text-slate-500 font-mono">
                  {currentTable?.rowCount.toLocaleString()} total records
                </span>
              </div>

              <div className="overflow-x-auto border border-[#162544] rounded-xl bg-[#091326] shadow-md">
                <table className="w-full text-xs text-left font-sans border-collapse">
                  <thead>
                    <tr className="bg-[#0b1429] border-b border-[#182747] text-slate-300 uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Column Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3 text-right">Distinct Values</th>
                      <th className="py-3 px-3 text-right">Repeating Keys</th>
                      <th className="py-3 px-3 text-right">Redundant Rows</th>
                      <th className="py-3 px-4 text-center">Uniqueness Score</th>
                      <th className="py-3 px-4">Integrity Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142340]">
                    {columnAudit.map((col) => {
                      const isCurrent = selectedColumns.includes(col.columnName) && selectionMode === 'single';
                      return (
                        <tr
                          key={col.columnName}
                          className={`hover:bg-[#0e1b38] transition-colors ${
                            isCurrent ? 'bg-blue-950/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {col.columnName}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-semibold">
                              {col.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {col.distinctCount.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {col.duplicateCount > 0 ? (
                              <span className="text-amber-300 font-bold">{col.duplicateCount.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {col.excessDuplicateCount > 0 ? (
                              <span className="text-rose-300 font-bold">
                                {col.excessDuplicateCount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-mono font-semibold text-slate-200">
                                {col.uniquenessPercentage}%
                              </span>
                              <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    col.uniquenessPercentage >= 99
                                      ? 'bg-emerald-500'
                                      : col.uniquenessPercentage >= 80
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${col.uniquenessPercentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {col.isCandidateKey ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                                <Check className="w-3 h-3" /> Candidate Key
                              </span>
                            ) : !col.hasDuplicates ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60">
                                <Check className="w-3 h-3" /> Unique
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60">
                                <AlertTriangle className="w-3 h-3" /> {col.excessDuplicateCount} Dupes
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleInspectColumnFromAudit(col.columnName)}
                              className="px-2.5 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium transition cursor-pointer"
                            >
                              Inspect Duplicates
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Deduplication SQL Generator */}
        {activeTab === 'sql' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 bg-[#070e1c]">
            <div className="max-w-5xl mx-auto w-full space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  Automated SQL Deduplication Scripts
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured, robust SQL templates designed to isolate, inspect, or eliminate duplicate rows from{' '}
                  <span className="font-mono text-blue-300 font-semibold">{currentTable?.name}</span>.
                </p>
              </div>

              {/* Strategy Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {[
                  {
                    id: 'find_counts',
                    title: '1. Count Duplicates',
                    desc: 'Group by column and filter HAVING COUNT > 1',
                  },
                  {
                    id: 'view_full_rows',
                    title: '2. View Full Records',
                    desc: 'INNER JOIN to return all duplicate rows with all columns',
                  },
                  {
                    id: 'keep_first',
                    title: '3. Deduplicate (Keep First)',
                    desc: 'Filter using ROW_NUMBER() OVER(PARTITION BY...) = 1',
                  },
                  {
                    id: 'keep_last',
                    title: '4. Deduplicate (Keep Last)',
                    desc: 'Keep the most recent duplicate record',
                  },
                  {
                    id: 'remove_all_dupes',
                    title: '5. Remove All Dupes',
                    desc: 'Isolate only strictly unique entries (COUNT = 1)',
                  },
                ].map((strat) => (
                  <button
                    key={strat.id}
                    onClick={() => setSqlStrategy(strat.id as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      sqlStrategy === strat.id
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-[#091326] border-[#182747] text-slate-400 hover:text-slate-200 hover:bg-[#0c1830]'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-200">{strat.title}</span>
                    <span className="text-[11px] text-slate-400 mt-1 leading-tight">{strat.desc}</span>
                  </button>
                ))}
              </div>

              {/* Optional Order By Column for Row Number ranking */}
              {(sqlStrategy === 'keep_first' || sqlStrategy === 'keep_last') && (
                <div className="flex items-center gap-2 bg-[#091326] px-3 py-2 rounded-lg border border-[#162544] text-xs">
                  <span className="text-slate-400">Order by column (tie-breaker):</span>
                  <select
                    value={orderByCol}
                    onChange={(e) => setOrderByCol(e.target.value)}
                    className="bg-[#0c162e] text-white border border-[#1b2f56] px-2 py-1 rounded text-xs focus:outline-none"
                  >
                    <option value="">Default (first natural row)</option>
                    {currentTable?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Code Preview Box */}
              <div className="bg-[#060c18] border border-[#182a52] rounded-xl overflow-hidden shadow-xl">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#091326] border-b border-[#162544]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono text-slate-400 ml-2">generated_dedup_query.sql</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySql}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#101e3b] hover:bg-[#182d58] text-slate-200 border border-[#1d3564] text-xs font-medium transition cursor-pointer"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy SQL</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleRunInStudio}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run in SQL Studio</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-slate-200 whitespace-pre">
                  {highlightSql(generatedSql, theme)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deduplicate & Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1429] border border-[#1b2f56] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Save Cleaned Dataset</h3>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Create a fresh, de-duplicated table in your catalog based on the selected columns ({effectiveColumns.join(', ')}).
            </p>

            {saveSuccessMsg ? (
              <div className="bg-emerald-950/80 border border-emerald-600/80 p-4 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    New Table Name:
                  </label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g. customers_clean"
                    className="w-full px-3 py-2 bg-[#060c18] border border-[#162544] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Deduplication Strategy:
                  </label>
                  <select
                    value={saveStrategy}
                    onChange={(e) => setSaveStrategy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#060c18] border border-[#162544] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="keep_first">Keep First Occurrence (Earliest)</option>
                    <option value="keep_last">Keep Last Occurrence (Latest)</option>
                    <option value="remove_all_dupes">Discard All Duplicates (Keep Only Unique)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDeduplicatedTable}
                    disabled={!newTableName.trim()}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-md transition disabled:opacity-50"
                  >
                    Create Clean Table
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
