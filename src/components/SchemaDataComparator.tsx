import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Search,
  Filter,
  Copy,
  Check,
  Play,
  X,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { TableSchema } from '../types';
import { compareSchemas, compareData, autoDetectKeyColumn } from '../utils/schemaComparator';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface SchemaDataComparatorProps {
  tables: TableSchema[];
  initialTableA?: string;
  initialTableB?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onExecuteQuery?: (sql: string) => void;
}

export const SchemaDataComparator: React.FC<SchemaDataComparatorProps> = ({
  tables,
  initialTableA,
  initialTableB,
  isOpen = true,
  onClose,
  onExecuteQuery,
}) => {
  const { theme } = useTheme();

  const [selectedTableAName, setSelectedTableAName] = useState<string>(() => {
    return initialTableA || tables[0]?.name || '';
  });

  const [selectedTableBName, setSelectedTableBName] = useState<string>(() => {
    return initialTableB || tables[1]?.name || tables[0]?.name || '';
  });

  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'reconciliation'>('schema');
  const [customKeyCol, setCustomKeyCol] = useState<string>('');
  const [dataFilter, setDataFilter] = useState<'all' | 'modified' | 'only_a' | 'only_b' | 'identical'>('all');
  const [copiedSql, setCopiedSql] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Keep selection synchronized with available tables
  React.useEffect(() => {
    if (!tables.some((t) => t.name === selectedTableAName) && tables.length > 0) {
      setSelectedTableAName(tables[0].name);
    }
    if (!tables.some((t) => t.name === selectedTableBName) && tables.length > 1) {
      setSelectedTableBName(tables[1].name);
    }
  }, [tables, selectedTableAName, selectedTableBName]);

  const tableA = useMemo(() => tables.find((t) => t.name === selectedTableAName), [tables, selectedTableAName]);
  const tableB = useMemo(() => tables.find((t) => t.name === selectedTableBName), [tables, selectedTableBName]);

  // Retrieve complete row data from in-memory engine or previewRows
  const dataA = useMemo(() => {
    if (!tableA) return [];
    return (window as any).alasql?.tables?.[tableA.name]?.data || tableA.previewRows || [];
  }, [tableA]);

  const dataB = useMemo(() => {
    if (!tableB) return [];
    return (window as any).alasql?.tables?.[tableB.name]?.data || tableB.previewRows || [];
  }, [tableB]);

  // Schema diff result
  const schemaDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareSchemas(tableA, tableB);
  }, [tableA, tableB]);

  // Available common columns to serve as Key column
  const commonColumns = useMemo(() => {
    if (!tableA || !tableB) return [];
    return tableA.columns
      .map((c) => c.name)
      .filter((name) => tableB.columns.some((cB) => cB.name.toLowerCase() === name.toLowerCase()));
  }, [tableA, tableB]);

  // Effective key column
  const effectiveKey = useMemo(() => {
    if (customKeyCol && commonColumns.includes(customKeyCol)) return customKeyCol;
    if (tableA && tableB) return autoDetectKeyColumn(tableA, tableB);
    return '';
  }, [customKeyCol, commonColumns, tableA, tableB]);

  // Data diff result
  const dataDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareData(tableA, dataA, tableB, dataB, effectiveKey);
  }, [tableA, dataA, tableB, dataB, effectiveKey]);

  // Filtered rows for data comparison tab
  const filteredDiffRows = useMemo(() => {
    if (!dataDiff?.diffRows) return [];
    let rows = dataDiff.diffRows;

    if (dataFilter !== 'all') {
      rows = rows.filter((r) => r.status === dataFilter);
    }

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      rows = rows.filter((r) => {
        if (r.key.toLowerCase().includes(term)) return true;
        const inA = r.valuesA ? Object.values(r.valuesA).some((v) => String(v).toLowerCase().includes(term)) : false;
        const inB = r.valuesB ? Object.values(r.valuesB).some((v) => String(v).toLowerCase().includes(term)) : false;
        return inA || inB;
      });
    }

    return rows;
  }, [dataDiff, dataFilter, searchFilter]);

  const handleSwap = () => {
    const temp = selectedTableAName;
    setSelectedTableAName(selectedTableBName);
    setSelectedTableBName(temp);
  };

  const handleCopySql = () => {
    if (!dataDiff?.reconciliationSql) return;
    navigator.clipboard.writeText(dataDiff.reconciliationSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#070e1c] text-slate-100 overflow-hidden">
      {/* Comparator Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0b1429] border-b border-[#182c54] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Schema & Data Comparator
              <span className="text-xs font-normal text-slate-400 bg-[#122347] px-2 py-0.5 rounded border border-[#1b315e]">
                Diff Tool
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Compare structure, column data types, row modifications, and generate reconciliation queries.
            </p>
          </div>
        </div>

        {/* Close button if rendered as modal */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#122347] transition cursor-pointer"
            title="Close Comparator"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Comparison Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3 bg-[#0a1326] border-b border-[#182c54] shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Table A Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-1 rounded border border-blue-800/60">
              Source (A)
            </span>
            <select
              value={selectedTableAName}
              onChange={(e) => setSelectedTableAName(e.target.value)}
              className="bg-[#0e1b38] border border-[#1e3668] text-slate-100 text-xs rounded-lg px-2.5 sm:px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              {tables.map((tbl) => (
                <option key={tbl.name} value={tbl.name}>
                  {tbl.name} ({tbl.rowCount} rows)
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="p-1.5 rounded-lg bg-[#0e1b38] hover:bg-[#182c54] text-slate-300 hover:text-white border border-[#1e3668] transition cursor-pointer"
            title="Swap Table A and Table B"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>

          {/* Table B Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800/60">
              Target (B)
            </span>
            <select
              value={selectedTableBName}
              onChange={(e) => setSelectedTableBName(e.target.value)}
              className="bg-[#0e1b38] border border-[#1e3668] text-slate-100 text-xs rounded-lg px-2.5 sm:px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              {tables.map((tbl) => (
                <option key={tbl.name} value={tbl.name}>
                  {tbl.name} ({tbl.rowCount} rows)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-0.5 sm:p-1 bg-[#070e1c] rounded-lg border border-[#182c54] text-xs overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-2.5 sm:px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'schema'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Schema </span>Differences</span>
            {schemaDiff && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-900/60 text-blue-200 font-mono">
                {schemaDiff.matchRate}%
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-2.5 sm:px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'data'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Data </span>Differences</span>
            {dataDiff && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  dataDiff.modifiedCount > 0 ? 'bg-amber-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
                }`}
              >
                {dataDiff.modifiedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-2.5 sm:px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'reconciliation'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Reconciliation </span>SQL</span>
          </button>
        </div>
      </div>

      {/* Main Diff Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* TAB 1: SCHEMA DIFFERENCES */}
        {activeTab === 'schema' && schemaDiff && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Schema Compatibility</div>
                <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                  {schemaDiff.matchRate}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Structural alignment score
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Matching Columns</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {schemaDiff.columns.filter((c) => c.inTableA && c.inTableB).length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Present in both schemas
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Type Mismatches</div>
                <div className={`text-2xl font-bold font-mono mt-1 ${schemaDiff.typeMismatches.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {schemaDiff.typeMismatches.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Differing column data types
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Exclusive Columns</div>
                <div className="text-2xl font-bold font-mono text-slate-200 mt-1">
                  {schemaDiff.onlyInA.length + schemaDiff.onlyInB.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {schemaDiff.onlyInA.length} in A, {schemaDiff.onlyInB.length} in B
                </div>
              </div>
            </div>

            {/* Schema Columns Table */}
            <div className="bg-[#0b162f] border border-[#182c54] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#182c54] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Column Schema Comparison</h3>
                  <p className="text-xs text-slate-400">
                    Side-by-side attribute, data type, and nullability audit.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {schemaDiff.columns.length} Total Unique Columns
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#081022] border-b border-[#182c54] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">Column Name</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-blue-400">{tableA?.name} (Type)</th>
                      <th className="py-2.5 px-4 text-emerald-400">{tableB?.name} (Type)</th>
                      <th className="py-2.5 px-4 text-right">Table A Distinct</th>
                      <th className="py-2.5 px-4 text-right">Table B Distinct</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142342] font-mono">
                    {schemaDiff.columns.map((col) => {
                      const isBoth = col.inTableA && col.inTableB;
                      const isMismatch = isBoth && col.typeA !== col.typeB;
                      const isOnlyA = col.inTableA && !col.inTableB;
                      const isOnlyB = !col.inTableA && col.inTableB;

                      return (
                        <tr
                          key={col.name}
                          className={`hover:bg-[#0f1d3a] transition-colors ${
                            isMismatch
                              ? 'bg-amber-950/20'
                              : isOnlyA
                              ? 'bg-blue-950/20'
                              : isOnlyB
                              ? 'bg-emerald-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-200">
                            {col.name}
                          </td>
                          <td className="py-2.5 px-4">
                            {isMismatch ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                                <AlertTriangle className="w-3 h-3" /> Type Mismatch
                              </span>
                            ) : isBoth ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Matched
                              </span>
                            ) : isOnlyA ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                                Only in {tableA?.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                Only in {tableB?.name}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {col.inTableA ? (
                              <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800/60 font-semibold text-[11px]">
                                {col.typeA}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {col.inTableB ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 font-semibold text-[11px]">
                                {col.typeB}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-300 tabular-nums">
                            {col.distinctA !== undefined ? col.distinctA.toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-300 tabular-nums">
                            {col.distinctB !== undefined ? col.distinctB.toLocaleString() : '—'}
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

        {/* TAB 2: DATA DIFFERENCES (DIFF) */}
        {activeTab === 'data' && dataDiff && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Key Selector & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0b162f] p-4 rounded-xl border border-[#182c54]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300">Identity / Join Key:</span>
                <select
                  value={effectiveKey}
                  onChange={(e) => setCustomKeyCol(e.target.value)}
                  className="bg-[#070e1c] border border-[#1b315e] text-xs text-blue-300 font-mono rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {commonColumns.map((col) => (
                    <option key={col} value={col}>
                      {col} {col === effectiveKey ? '(Auto-Detected Key)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500">
                  Used to correlate matching records between both datasets.
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-[#070e1c] rounded-lg border border-[#182c54] text-xs">
                <button
                  onClick={() => setDataFilter('all')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    dataFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({dataDiff.diffRows.length})
                </button>
                <button
                  onClick={() => setDataFilter('modified')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    dataFilter === 'modified' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Modified ({dataDiff.modifiedCount})
                </button>
                <button
                  onClick={() => setDataFilter('only_a')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    dataFilter === 'only_a' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Only in {tableA?.name} ({dataDiff.onlyInACount})
                </button>
                <button
                  onClick={() => setDataFilter('only_b')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    dataFilter === 'only_b' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Only in {tableB?.name} ({dataDiff.onlyInBCount})
                </button>
                <button
                  onClick={() => setDataFilter('identical')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    dataFilter === 'identical' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Identical ({dataDiff.identicalCount})
                </button>
              </div>
            </div>

            {/* Data Diff Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Row Identity Match Rate</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {dataDiff.matchPercentage}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {dataDiff.identicalCount} exactly identical rows
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Values Altered</div>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {dataDiff.modifiedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Rows with cell value changes
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Only in Source (A)</div>
                <div className="text-2xl font-bold font-mono text-blue-400 mt-1">
                  {dataDiff.onlyInACount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Missing in {tableB?.name}
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Only in Target (B)</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {dataDiff.onlyInBCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  New rows in {tableB?.name}
                </div>
              </div>
            </div>

            {/* Search filter */}
            <div className="flex items-center gap-2 bg-[#0b162f] px-3 py-2 rounded-lg border border-[#182c54]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search across key or values..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none flex-1 font-mono"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cell-Level Diff Table */}
            <div className="bg-[#0b162f] border border-[#182c54] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#182c54] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Cell-Level Differences</h3>
                  <p className="text-xs text-slate-400">
                    <span className="text-red-400 font-semibold line-through mr-1">Red</span> shows previous value from {tableA?.name}; <span className="text-emerald-400 font-semibold ml-1">Green</span> shows updated value in {tableB?.name}.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Showing {filteredDiffRows.length} records
                </span>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#081022] z-10 border-b border-[#182c54] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-mono">Key ({effectiveKey})</th>
                      <th className="py-2.5 px-4">Status</th>
                      {commonColumns.map((col) => (
                        <th key={col} className="py-2.5 px-4 font-mono truncate max-w-[200px]">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142342] font-mono">
                    {filteredDiffRows.slice(0, 150).map((row, idx) => {
                      const isMod = row.status === 'modified';
                      const isOnlyA = row.status === 'only_a';
                      const isOnlyB = row.status === 'only_b';

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-[#0f1d3a] transition-colors ${
                            isMod
                              ? 'bg-amber-950/20'
                              : isOnlyA
                              ? 'bg-blue-950/20'
                              : isOnlyB
                              ? 'bg-emerald-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-100">
                            {row.key}
                          </td>
                          <td className="py-2.5 px-4">
                            {isMod ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                Modified ({row.changedColumns?.length} cells)
                              </span>
                            ) : isOnlyA ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                Only in {tableA?.name}
                              </span>
                            ) : isOnlyB ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Only in {tableB?.name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                Identical
                              </span>
                            )}
                          </td>

                          {commonColumns.map((col) => {
                            const valA = row.valuesA ? row.valuesA[col] : undefined;
                            const valB = row.valuesB ? row.valuesB[col] : undefined;
                            const isChanged = row.changedColumns?.includes(col);

                            return (
                              <td key={col} className="py-2 px-4 max-w-[240px] truncate">
                                {isChanged ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-red-400 line-through text-[11px] bg-red-950/50 px-1 rounded">
                                      {String(valA ?? 'null')}
                                    </span>
                                    <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950/50 px-1 rounded">
                                      {String(valB ?? 'null')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">
                                    {String(valA ?? valB ?? 'null')}
                                  </span>
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
            </div>
          </div>
        )}

        {/* TAB 3: RECONCILIATION SQL */}
        {activeTab === 'reconciliation' && dataDiff && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    Auto-Generated Reconciliation SQL
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Execute this query in the SQL Studio to inspect all discrepancy records directly in the data engine.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-xs font-medium text-slate-200 rounded-lg transition cursor-pointer"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  {onExecuteQuery && (
                    <button
                      onClick={() => onExecuteQuery(dataDiff.reconciliationSql)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Execute in SQL Studio</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Code display with blue keywords */}
              <div className="p-4 bg-[#070e1c] rounded-lg border border-[#182c54] font-mono text-xs whitespace-pre overflow-x-auto leading-relaxed">
                {highlightSql(dataDiff.reconciliationSql, theme)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
