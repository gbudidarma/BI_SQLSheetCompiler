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
  Database,
  Key,
  Plus,
  ArrowRight,
  BarChart3,
  Calculator,
  Download,
  Sliders,
} from 'lucide-react';
import { TableSchema, AggregateFunction } from '../types';
import {
  compareSchemas,
  compareData,
  autoDetectKeyColumn,
  compareAggregateData,
} from '../utils/schemaComparator';
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

  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'aggregate' | 'reconciliation'>('schema');
  const [customKeyCols, setCustomKeyCols] = useState<string[]>([]);
  const [dataFilter, setDataFilter] = useState<'all' | 'modified' | 'only_a' | 'only_b' | 'identical'>('all');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedAggSql, setCopiedAggSql] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Aggregate Summary State
  const [customAggDimensions, setCustomAggDimensions] = useState<string[]>([]);
  const [aggMeasure, setAggMeasure] = useState<string>('');
  const [aggFunction, setAggFunction] = useState<AggregateFunction>('SUM');
  const [aggTolerance, setAggTolerance] = useState<number>(0);
  const [aggFilter, setAggFilter] = useState<'all' | 'alerts' | 'balanced' | 'only_a' | 'only_b'>('all');
  const [aggSearch, setAggSearch] = useState<string>('');
  const [reconciliationType, setReconciliationType] = useState<'row' | 'aggregate'>('row');

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

  // Effective key columns (supports single or multi-column composite identity)
  const effectiveKeys = useMemo(() => {
    const validCustom = customKeyCols.filter((col) => commonColumns.includes(col));
    if (validCustom.length > 0) return validCustom;
    if (tableA && tableB) {
      const auto = autoDetectKeyColumn(tableA, tableB);
      return auto ? [auto] : [];
    }
    return [];
  }, [customKeyCols, commonColumns, tableA, tableB]);

  const effectiveKeyLabel = useMemo(() => effectiveKeys.join(' + '), [effectiveKeys]);

  const availableAddKeys = useMemo(() => {
    return commonColumns.filter((col) => !effectiveKeys.includes(col));
  }, [commonColumns, effectiveKeys]);

  // Data diff result
  const dataDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareData(tableA, dataA, tableB, dataB, effectiveKeys);
  }, [tableA, dataA, tableB, dataB, effectiveKeys]);

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

  // Candidate measures for aggregate summary
  const candidateMeasures = useMemo(() => {
    const list: string[] = ['*'];
    if (!tableA || !tableB) return list;

    // First add columns that look like measures or have numeric types
    commonColumns.forEach((colName) => {
      const colA = tableA.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      const isNumType = colA && (colA.type === 'INTEGER' || colA.type === 'FLOAT');
      const isNumName = /(qty|quantity|amount|total|price|cost|sales|rev|revenue|count|sum|balance|score|rate|val|value)/i.test(colName);
      if (isNumType || isNumName) {
        list.push(colName);
      }
    });

    // Then add other common columns
    commonColumns.forEach((colName) => {
      if (!list.includes(colName)) {
        list.push(colName);
      }
    });

    return list;
  }, [commonColumns, tableA, tableB]);

  // Effective dimensions for aggregate comparison
  const effectiveAggDimensions = useMemo(() => {
    const validCustom = customAggDimensions.filter((col) => commonColumns.includes(col));
    if (validCustom.length > 0) return validCustom;
    // Default to effective identity keys if available
    if (effectiveKeys.length > 0) return effectiveKeys;
    // Fallback to first non-measure common column
    const nonMeasure = commonColumns.find((c) => !candidateMeasures.slice(1).includes(c));
    return nonMeasure ? [nonMeasure] : (commonColumns.length > 0 ? [commonColumns[0]] : []);
  }, [customAggDimensions, commonColumns, effectiveKeys, candidateMeasures]);

  const effectiveAggMeasure = useMemo(() => {
    if (aggMeasure && (aggMeasure === '*' || commonColumns.includes(aggMeasure))) {
      return aggMeasure;
    }
    const firstNum = candidateMeasures.find((m) => m !== '*' && !effectiveAggDimensions.includes(m));
    return firstNum || (candidateMeasures.length > 1 ? candidateMeasures[1] : '*');
  }, [aggMeasure, commonColumns, candidateMeasures, effectiveAggDimensions]);

  const availableAddAggDimensions = useMemo(() => {
    return commonColumns.filter((col) => !effectiveAggDimensions.includes(col) && col !== effectiveAggMeasure);
  }, [commonColumns, effectiveAggDimensions, effectiveAggMeasure]);

  // Aggregate diff result
  const aggregateDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareAggregateData(
      tableA,
      dataA,
      tableB,
      dataB,
      effectiveAggDimensions,
      effectiveAggMeasure,
      aggFunction,
      aggTolerance
    );
  }, [tableA, dataA, tableB, dataB, effectiveAggDimensions, effectiveAggMeasure, aggFunction, aggTolerance]);

  // Filtered rows for aggregate comparison tab
  const filteredAggRows = useMemo(() => {
    if (!aggregateDiff?.rows) return [];
    let rows = aggregateDiff.rows;

    if (aggFilter === 'alerts') {
      rows = rows.filter((r) => r.status === 'variance_alert');
    } else if (aggFilter === 'balanced') {
      rows = rows.filter((r) => r.status === 'balanced');
    } else if (aggFilter === 'only_a') {
      rows = rows.filter((r) => r.status === 'only_a');
    } else if (aggFilter === 'only_b') {
      rows = rows.filter((r) => r.status === 'only_b');
    }

    if (aggSearch.trim()) {
      const term = aggSearch.toLowerCase();
      rows = rows.filter((r) => {
        if (r.dimensionKey.toLowerCase().includes(term)) return true;
        return Object.values(r.dimensionValues).some((v) => String(v).toLowerCase().includes(term));
      });
    }

    return rows;
  }, [aggregateDiff, aggFilter, aggSearch]);

  const handleExportAggCsv = () => {
    if (!aggregateDiff || !tableA || !tableB) return;
    const measureLabel = `${aggregateDiff.measureAgg}_${aggregateDiff.measureCol}`;
    const headerCols = [
      ...aggregateDiff.dimensions,
      'Reconciliation_Status',
      `${tableA.name}_${measureLabel}`,
      `${tableB.name}_${measureLabel}`,
      'Variance_Delta',
      'Percent_Delta',
      `${tableA.name}_RowCount`,
      `${tableB.name}_RowCount`,
    ];
    const rows = aggregateDiff.rows.map((r) => {
      const dimCells = aggregateDiff.dimensions.map((d) => `"${String(r.dimensionValues[d] ?? '').replace(/"/g, '""')}"`);
      return [
        ...dimCells,
        r.status,
        r.valA !== null ? r.valA : '',
        r.valB !== null ? r.valB : '',
        r.delta !== null ? r.delta : '',
        r.percentDelta !== null ? `${r.percentDelta}%` : '',
        r.countA,
        r.countB,
      ].join(',');
    });
    const csvContent = [headerCols.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aggregate_reconciliation_${tableA.name}_vs_${tableB.name}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyAggSql = () => {
    if (!aggregateDiff?.reconciliationSql) return;
    navigator.clipboard.writeText(aggregateDiff.reconciliationSql);
    setCopiedAggSql(true);
    setTimeout(() => setCopiedAggSql(false), 2000);
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
            onClick={() => setActiveTab('aggregate')}
            className={`px-2.5 sm:px-3 py-1.5 font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'aggregate'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Aggregate </span>Summary</span>
            {aggregateDiff && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  aggregateDiff.varianceAlerts > 0
                    ? 'bg-amber-950 text-amber-300 border border-amber-600/50 font-bold'
                    : 'bg-emerald-950 text-emerald-300'
                }`}
                title={aggregateDiff.varianceAlerts > 0 ? `${aggregateDiff.varianceAlerts} aggregate variance alert(s)` : `${aggregateDiff.matchRate}% match rate`}
              >
                {aggregateDiff.varianceAlerts > 0 ? `⚠️ ${aggregateDiff.varianceAlerts}` : `${aggregateDiff.matchRate}%`}
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Key className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Identity / Join Key:</span>
                </div>

                {/* Composite Join Key Chips & Selectors */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {effectiveKeys.map((col, idx) => (
                    <div
                      key={col}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-500/50 text-xs font-mono text-blue-200 shadow-xs"
                    >
                      {idx > 0 && <span className="text-blue-400 font-sans font-bold text-[10px] mr-0.5">+</span>}
                      <span>{col}</span>
                      {effectiveKeys.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomKeyCols(effectiveKeys.filter((k) => k !== col));
                          }}
                          className="p-0.5 hover:bg-blue-800/60 rounded text-blue-300 hover:text-white transition cursor-pointer"
                          title={`Remove ${col} from join key`}
                          aria-label={`Remove ${col}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-blue-400 font-sans opacity-70">
                          {col === autoDetectKeyColumn(tableA!, tableB!) ? '(Auto)' : ''}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Add Key Column Dropdown (e.g. + Order Date, + Line Item) */}
                  {availableAddKeys.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setCustomKeyCols([...effectiveKeys, e.target.value]);
                        }
                      }}
                      className="bg-[#070e1c] hover:bg-[#0c1830] border border-dashed border-blue-500/40 hover:border-blue-400 text-xs text-blue-300 font-medium rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer transition shadow-xs"
                      title="Add another column to form a composite key (e.g. customer + order_date)"
                    >
                      <option value="" disabled>+ Add Join Key...</option>
                      {availableAddKeys.map((col) => (
                        <option key={col} value={col}>+ {col}</option>
                      ))}
                    </select>
                  )}

                  {/* Single Key Switcher (when only 1 key is selected, allowing easy 1-click change) */}
                  {effectiveKeys.length === 1 && (
                    <select
                      value={effectiveKeys[0]}
                      onChange={(e) => setCustomKeyCols([e.target.value])}
                      className="bg-[#070e1c] border border-[#1b315e] text-xs text-slate-300 font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                      title="Switch primary join key"
                    >
                      {commonColumns.map((col) => (
                        <option key={col} value={col}>
                          Switch to: {col} {col === autoDetectKeyColumn(tableA!, tableB!) ? '(Auto-Detected)' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Reset to Auto Button */}
                  {customKeyCols.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomKeyCols([])}
                      className="text-[11px] text-slate-400 hover:text-blue-300 underline cursor-pointer ml-1"
                      title="Reset to auto-detected key"
                    >
                      Reset to Auto
                    </button>
                  )}
                </div>

                <span className="text-[11px] text-slate-400 block w-full sm:w-auto mt-0.5 sm:mt-0">
                  {effectiveKeys.length > 1
                    ? `(Composite Key: matches rows when all ${effectiveKeys.length} columns correlate)`
                    : 'Used to correlate matching records between both datasets.'}
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
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1.5 ${
                    dataFilter === 'modified'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : dataDiff.modifiedCount > 0
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50 hover:bg-amber-900/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Filter to records with cell value discrepancies (alerts)"
                >
                  {dataDiff.modifiedCount > 0 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                  <span>Value Alerts ({dataDiff.modifiedCount})</span>
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

            {/* VALUE MISMATCH ALERT BANNER */}
            {dataDiff.modifiedCount > 0 ? (
              <div className="p-3.5 rounded-xl border bg-gradient-to-r from-amber-950/50 via-[#1f1409]/60 to-[#0b162f] border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-200 flex items-center gap-2">
                      <span>Value Discrepancy Alert: {dataDiff.modifiedCount} row(s) have cell value differences!</span>
                      <span className="text-[10px] bg-amber-500/25 text-amber-300 px-1.5 py-0.2 rounded font-mono font-bold border border-amber-500/40">
                        DIFFERENCE DETECTED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Mismatched columns:</span>
                      {Object.entries(dataDiff.columnDiscrepancies || {}).map(([colName, cnt]) => (
                        <span
                          key={colName}
                          className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-200 border border-amber-600/50"
                        >
                          {colName} ({cnt} {cnt === 1 ? 'alert' : 'alerts'})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDataFilter(dataFilter === 'modified' ? 'all' : 'modified')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      dataFilter === 'modified'
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                        : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{dataFilter === 'modified' ? 'Showing Alerts Only' : 'View Value Alerts Only'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border bg-emerald-950/20 border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Value Discrepancies: All correlating records have matching values across all common attributes.</span>
              </div>
            )}

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

              <div
                onClick={() => {
                  if (dataDiff.modifiedCount > 0) {
                    setDataFilter('modified');
                  }
                }}
                className={`border rounded-xl p-4 transition ${
                  dataDiff.modifiedCount > 0
                    ? 'bg-amber-950/25 border-amber-500/50 cursor-pointer hover:bg-amber-950/40 ring-1 ring-amber-500/30'
                    : 'bg-[#0b162f] border-[#182c54]'
                }`}
                title={dataDiff.modifiedCount > 0 ? 'Click to view value alert rows' : ''}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Values Altered</div>
                  {dataDiff.modifiedCount > 0 && (
                    <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                      <span>Alerts</span>
                    </span>
                  )}
                </div>
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
                      <th className="py-2.5 px-4 font-mono">Key ({effectiveKeyLabel})</th>
                      <th className="py-2.5 px-4">Status</th>
                      {commonColumns.map((col) => {
                        const diffCount = dataDiff?.columnDiscrepancies?.[col] || 0;
                        return (
                          <th key={col} className="py-2.5 px-4 font-mono max-w-[240px]">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{col}</span>
                              {diffCount > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-sans shrink-0"
                                  title={`${diffCount} value discrepancy alert(s) in ${col}`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>{diffCount}</span>
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
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
                              ? 'bg-amber-950/25 border-l-2 border-l-amber-500'
                              : isOnlyA
                              ? 'bg-blue-950/20'
                              : isOnlyB
                              ? 'bg-emerald-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-100">
                            {row.key.includes(' | ') ? (
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                {row.key.split(' | ').map((part, pIdx) => (
                                  <span key={pIdx} className="inline-flex items-center gap-1.5">
                                    {pIdx > 0 && <span className="text-slate-500 font-normal">|</span>}
                                    <span>{part}</span>
                                  </span>
                                ))}
                              </span>
                            ) : (
                              row.key
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {isMod ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/60 shadow-xs">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>
                                  Value Alert ({row.changedColumns?.length} {row.changedColumns?.length === 1 ? 'cell' : 'cells'})
                                </span>
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
                              <td key={col} className="py-2 px-4 max-w-[280px]">
                                {isChanged ? (() => {
                                  // Compute numeric variance if applicable (e.g. qty 700 vs 701 -> diff +1)
                                  const numA =
                                    valA !== null && valA !== undefined && valA !== '' && !isNaN(Number(valA))
                                      ? Number(valA)
                                      : null;
                                  const numB =
                                    valB !== null && valB !== undefined && valB !== '' && !isNaN(Number(valB))
                                      ? Number(valB)
                                      : null;
                                  const isNumeric = numA !== null && numB !== null;
                                  const delta = isNumeric ? numB - numA : null;
                                  const deltaFormatted =
                                    isNumeric && delta !== null
                                      ? delta > 0
                                        ? `+${Number(delta.toFixed(4))}`
                                        : `${Number(delta.toFixed(4))}`
                                      : null;

                                  return (
                                    <div className="flex flex-col gap-1 p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 shadow-xs">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-900/60 px-1 py-0.2 rounded border border-amber-600/40">
                                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                          <span>Alert</span>
                                        </span>
                                        {isNumeric && delta !== 0 && (
                                          <span
                                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                              delta! > 0
                                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                                : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                                            }`}
                                            title={`Variance (Target B - Source A): ${deltaFormatted}`}
                                          >
                                            Δ {deltaFormatted}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
                                        <span
                                          className="text-red-400 line-through bg-red-950/70 px-1.5 py-0.5 rounded border border-red-900/60 truncate max-w-[110px]"
                                          title={`Source (${tableA?.name}): ${String(valA ?? 'null')}`}
                                        >
                                          {String(valA ?? 'null')}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span
                                          className="text-emerald-300 font-bold bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/60 truncate max-w-[110px]"
                                          title={`Target (${tableB?.name}): ${String(valB ?? 'null')}`}
                                        >
                                          {String(valB ?? 'null')}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })() : (
                                  <span className="text-slate-300 font-mono truncate block">
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

        {/* TAB 3: AGGREGATE SUMMARY (DIMENSIONAL COMPARISON) */}
        {activeTab === 'aggregate' && aggregateDiff && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Dimension & Measure Aggregation Controls */}
            <div className="bg-[#0b162f] p-4 rounded-xl border border-[#182c54] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#142447]">
                {/* Dimensions Configuration */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Group By Dimension(s):</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {effectiveAggDimensions.map((dim, idx) => (
                      <div
                        key={dim}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-500/50 text-xs font-mono text-blue-200 shadow-xs"
                      >
                        {idx > 0 && <span className="text-blue-400 font-sans font-bold text-[10px] mr-0.5">+</span>}
                        <span>{dim}</span>
                        {effectiveAggDimensions.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomAggDimensions(effectiveAggDimensions.filter((d) => d !== dim));
                            }}
                            className="p-0.5 hover:bg-blue-800/60 rounded text-blue-300 hover:text-white transition cursor-pointer"
                            title={`Remove ${dim} from dimensions`}
                            aria-label={`Remove ${dim}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {/* Add Dimension Dropdown */}
                    {availableAddAggDimensions.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setCustomAggDimensions([...effectiveAggDimensions, e.target.value]);
                          }
                        }}
                        className="bg-[#070e1c] hover:bg-[#0c1830] border border-dashed border-blue-500/40 hover:border-blue-400 text-xs text-blue-300 font-medium rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer transition shadow-xs"
                        title="Add dimension to group by (e.g. customer + order_date)"
                      >
                        <option value="" disabled>+ Add Dimension...</option>
                        {availableAddAggDimensions.map((col) => (
                          <option key={col} value={col}>+ {col}</option>
                        ))}
                      </select>
                    )}

                    {/* Single Dimension Quick Switcher */}
                    {effectiveAggDimensions.length === 1 && (
                      <select
                        value={effectiveAggDimensions[0]}
                        onChange={(e) => setCustomAggDimensions([e.target.value])}
                        className="bg-[#070e1c] border border-[#1b315e] text-xs text-slate-300 font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                        title="Switch primary dimension"
                      >
                        {commonColumns
                          .filter((c) => c !== effectiveAggMeasure)
                          .map((col) => (
                            <option key={col} value={col}>
                              Switch to: {col}
                            </option>
                          ))}
                      </select>
                    )}

                    {/* Reset Button */}
                    {customAggDimensions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCustomAggDimensions([])}
                        className="text-[11px] text-slate-400 hover:text-blue-300 underline cursor-pointer ml-1"
                        title="Reset to default dimensions"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Measure & Function Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Aggregate Metric:</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Function */}
                    <select
                      value={aggFunction}
                      onChange={(e) => setAggFunction(e.target.value as AggregateFunction)}
                      className="bg-[#070e1c] border border-[#1b315e] text-xs text-emerald-300 font-bold font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      title="Aggregation function"
                    >
                      <option value="SUM">SUM</option>
                      <option value="COUNT">COUNT</option>
                      <option value="AVG">AVG</option>
                      <option value="MIN">MIN</option>
                      <option value="MAX">MAX</option>
                    </select>

                    <span className="text-slate-500 font-mono text-xs">(</span>

                    {/* Column */}
                    <select
                      value={effectiveAggMeasure}
                      onChange={(e) => setAggMeasure(e.target.value)}
                      className="bg-[#070e1c] border border-[#1b315e] text-xs text-slate-200 font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[180px]"
                      title="Measure column to aggregate"
                    >
                      {candidateMeasures.map((col) => (
                        <option key={col} value={col}>
                          {col === '*' ? '* (Row Count)' : col}
                        </option>
                      ))}
                    </select>

                    <span className="text-slate-500 font-mono text-xs">)</span>
                  </div>

                  {/* Tolerance */}
                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#1b315e]">
                    <span className="text-[11px] text-slate-400">Tolerance:</span>
                    <select
                      value={aggTolerance}
                      onChange={(e) => setAggTolerance(Number(e.target.value))}
                      className="bg-[#070e1c] border border-[#1b315e] text-xs text-slate-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                      title="Tolerance threshold for discrepancy alert"
                    >
                      <option value="0">0 (Exact Match)</option>
                      <option value="0.001">±0.001 (Decimal)</option>
                      <option value="0.01">±0.01 (Cents)</option>
                      <option value="1">±1.0 (Unit)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scope Description */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <div>
                  Comparing <span className="font-mono text-slate-200 font-bold">{aggFunction}({effectiveAggMeasure})</span> grouped by <span className="font-mono text-blue-300 font-bold">{effectiveAggDimensions.join(' + ') || 'All Rows'}</span> between <span className="text-blue-400 font-semibold">{tableA?.name}</span> and <span className="text-emerald-400 font-semibold">{tableB?.name}</span>.
                </div>
                <div className="text-[11px] text-slate-500">
                  {aggregateDiff.totalGroups} distinct dimension groups analyzed
                </div>
              </div>
            </div>

            {/* VALUE DISCREPANCY ALERT BANNER */}
            {aggregateDiff.varianceAlerts > 0 ? (
              <div className="p-4 rounded-xl border bg-gradient-to-r from-amber-950/60 via-[#1f1409]/70 to-[#0b162f] border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-200 flex items-center gap-2 flex-wrap">
                      <span>Aggregate Variance Alert: {aggregateDiff.varianceAlerts} group(s) have differing aggregate totals!</span>
                      <span className="text-[10px] bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded font-mono font-bold border border-amber-500/40">
                        DIFFERENCE DETECTED
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Aggregated metric <span className="font-mono font-bold text-amber-300">{aggFunction}({effectiveAggMeasure})</span> differs between <span className="text-blue-300 font-semibold">{tableA?.name}</span> and <span className="text-emerald-300 font-semibold">{tableB?.name}</span>. Net variance: <span className="font-mono font-bold text-amber-200">Δ {aggregateDiff.totalDelta > 0 ? `+${aggregateDiff.totalDelta.toLocaleString()}` : aggregateDiff.totalDelta.toLocaleString()}</span>{aggregateDiff.percentTotalDelta !== null ? ` (${aggregateDiff.percentTotalDelta > 0 ? '+' : ''}${aggregateDiff.percentTotalDelta}%)` : ''}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAggFilter(aggFilter === 'alerts' ? 'all' : 'alerts')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      aggFilter === 'alerts'
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                        : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{aggFilter === 'alerts' ? 'Showing Alerts Only' : `View ${aggregateDiff.varianceAlerts} Alerts Only`}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border bg-emerald-950/20 border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero Aggregate Discrepancies: All {aggregateDiff.totalGroups} groups have matching totals across both tables for {aggFunction}({effectiveAggMeasure}).</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50">
                  100% RECONCILED
                </span>
              </div>
            )}

            {/* Aggregate Diff KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Group Match Rate</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {aggregateDiff.matchRate}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {aggregateDiff.balancedGroups} of {aggregateDiff.totalGroups} groups balanced
                </div>
              </div>

              <div
                onClick={() => {
                  if (aggregateDiff.varianceAlerts > 0) {
                    setAggFilter(aggFilter === 'alerts' ? 'all' : 'alerts');
                  }
                }}
                className={`border rounded-xl p-4 transition ${
                  aggregateDiff.varianceAlerts > 0
                    ? 'bg-amber-950/25 border-amber-500/50 cursor-pointer hover:bg-amber-950/40 ring-1 ring-amber-500/30'
                    : 'bg-[#0b162f] border-[#182c54]'
                }`}
                title={aggregateDiff.varianceAlerts > 0 ? 'Click to toggle value alert groups' : ''}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Variance Alerts</div>
                  {aggregateDiff.varianceAlerts > 0 && (
                    <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                      <span>Alerts</span>
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-bold font-mono mt-1 ${aggregateDiff.varianceAlerts > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {aggregateDiff.varianceAlerts}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Groups with different totals
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Total Net Variance (Δ)</div>
                <div
                  className={`text-2xl font-bold font-mono mt-1 ${
                    aggregateDiff.totalDelta === 0
                      ? 'text-emerald-400'
                      : aggregateDiff.totalDelta > 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  Δ {aggregateDiff.totalDelta > 0 ? `+${aggregateDiff.totalDelta.toLocaleString()}` : aggregateDiff.totalDelta.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {aggregateDiff.percentTotalDelta !== null ? `${aggregateDiff.percentTotalDelta > 0 ? '+' : ''}${aggregateDiff.percentTotalDelta}% net shift` : 'B minus A'}
                </div>
              </div>

              <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-4">
                <div className="text-xs text-slate-400">Totals Compared</div>
                <div className="text-xs font-mono font-semibold text-slate-200 mt-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 font-bold truncate max-w-[80px]">{tableA?.name}:</span>
                    <span className="tabular-nums">{aggregateDiff.totalValA.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold truncate max-w-[80px]">{tableB?.name}:</span>
                    <span className="tabular-nums">{aggregateDiff.totalValB.toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Sum of all group aggregates
                </div>
              </div>
            </div>

            {/* Filter, Search & Export Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b162f] p-3 rounded-xl border border-[#182c54]">
              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#070e1c] rounded-lg border border-[#182c54] text-xs">
                <button
                  type="button"
                  onClick={() => setAggFilter('all')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    aggFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({aggregateDiff.totalGroups})
                </button>
                <button
                  type="button"
                  onClick={() => setAggFilter('alerts')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium flex items-center gap-1.5 ${
                    aggFilter === 'alerts'
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : aggregateDiff.varianceAlerts > 0
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50 hover:bg-amber-900/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {aggregateDiff.varianceAlerts > 0 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                  <span>Alerts ({aggregateDiff.varianceAlerts})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAggFilter('balanced')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    aggFilter === 'balanced' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Balanced ({aggregateDiff.balancedGroups})
                </button>
                <button
                  type="button"
                  onClick={() => setAggFilter('only_a')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    aggFilter === 'only_a' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Only in {tableA?.name} ({aggregateDiff.onlyInAGroups})
                </button>
                <button
                  type="button"
                  onClick={() => setAggFilter('only_b')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                    aggFilter === 'only_b' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Only in {tableB?.name} ({aggregateDiff.onlyInBGroups})
                </button>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <div className="flex items-center gap-2 bg-[#070e1c] px-3 py-1.5 rounded-lg border border-[#182c54] flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search dimension..."
                    value={aggSearch}
                    onChange={(e) => setAggSearch(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none flex-1 font-mono"
                  />
                  {aggSearch && (
                    <button
                      onClick={() => setAggSearch('')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportAggCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-xs font-medium text-slate-200 rounded-lg transition cursor-pointer"
                  title="Export aggregate reconciliation table to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>

                {onExecuteQuery && (
                  <button
                    type="button"
                    onClick={() => onExecuteQuery(aggregateDiff.reconciliationSql)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow-xs cursor-pointer"
                    title="Open and run this aggregate reconciliation query in SQL Studio"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Execute in SQL Studio</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aggregate Summary Table */}
            <div className="bg-[#0b162f] border border-[#182c54] rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-[#182c54] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <span>Grouped Aggregate Comparison</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      Metric: {aggFunction}({effectiveAggMeasure})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Variance Δ = Target (B) - Source (A). Discrepancies highlighted with ⚠️ alerts.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Showing {filteredAggRows.length} of {aggregateDiff.rows.length} groups
                </span>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#081022] z-10 border-b border-[#182c54] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4 font-mono">
                        Dimension ({effectiveAggDimensions.join(' + ') || 'All'})
                      </th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">
                        Source ({tableA?.name}) Total
                      </th>
                      <th className="py-2.5 px-4 text-right">
                        Target ({tableB?.name}) Total
                      </th>
                      <th className="py-2.5 px-4 text-right">
                        Variance (Δ)
                      </th>
                      <th className="py-2.5 px-4 text-right">
                        % Variance
                      </th>
                      <th className="py-2.5 px-4 text-center">
                        Row Counts (A / B)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142342] font-mono">
                    {filteredAggRows.map((row, idx) => {
                      const isAlert = row.status === 'variance_alert';
                      const isBalanced = row.status === 'balanced';
                      const isOnlyA = row.status === 'only_a';
                      const isOnlyB = row.status === 'only_b';

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-[#0f1d3a] transition-colors ${
                            isAlert
                              ? 'bg-amber-950/25 border-l-2 border-l-amber-500'
                              : isOnlyA
                              ? 'bg-blue-950/20'
                              : isOnlyB
                              ? 'bg-emerald-950/20'
                              : ''
                          }`}
                        >
                          {/* Dimension Key */}
                          <td className="py-2.5 px-4 font-bold text-slate-100">
                            {row.dimensionKey.includes(' | ') ? (
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                {row.dimensionKey.split(' | ').map((part, pIdx) => (
                                  <span key={pIdx} className="inline-flex items-center gap-1.5">
                                    {pIdx > 0 && <span className="text-slate-500 font-normal">|</span>}
                                    <span className="bg-slate-800/60 px-1.5 py-0.5 rounded text-blue-200 border border-slate-700/50">
                                      {part}
                                    </span>
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-blue-200">{row.dimensionKey}</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {isAlert ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-500/60 shadow-xs">
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Variance Alert</span>
                              </span>
                            ) : isBalanced ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>Balanced</span>
                              </span>
                            ) : isOnlyA ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                Only in {tableA?.name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Only in {tableB?.name}
                              </span>
                            )}
                          </td>

                          {/* Source Value A */}
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.valA !== null ? (
                              <span className={isAlert ? 'text-amber-200 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded' : 'text-slate-300'}>
                                {row.valA.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Target Value B */}
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.valB !== null ? (
                              <span className={isAlert ? 'text-emerald-300 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded' : 'text-slate-300'}>
                                {row.valB.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Variance Delta (Δ) */}
                          <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                            {row.delta !== null ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                  row.delta === 0
                                    ? 'text-slate-400 bg-slate-800/40'
                                    : row.delta > 0
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                                    : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                                }`}
                              >
                                {row.delta > 0 ? `+${row.delta.toLocaleString()}` : row.delta.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* % Variance */}
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {row.percentDelta !== null ? (
                              <span
                                className={`text-[11px] ${
                                  row.percentDelta === 0
                                    ? 'text-slate-400'
                                    : row.percentDelta > 0
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-rose-400 font-semibold'
                                }`}
                              >
                                {row.percentDelta > 0 ? `+${row.percentDelta}%` : `${row.percentDelta}%`}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Row Counts */}
                          <td className="py-2.5 px-4 text-center tabular-nums text-slate-400 text-[11px]">
                            <span className="text-blue-300">{row.countA}</span>
                            <span className="mx-1 text-slate-600">/</span>
                            <span className="text-emerald-300">{row.countB}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Grand Total Footer */}
                  <tfoot className="sticky bottom-0 bg-[#081022] border-t-2 border-[#1e3668] text-slate-200 font-bold font-mono text-xs shadow-lg">
                    <tr>
                      <td className="py-3 px-4 uppercase tracking-wider text-[11px] text-blue-300">
                        Grand Totals ({aggregateDiff.totalGroups} groups)
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            aggregateDiff.varianceAlerts > 0
                              ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                          }`}
                        >
                          {aggregateDiff.varianceAlerts > 0 ? `${aggregateDiff.varianceAlerts} Alerts` : 'Balanced'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-blue-300">
                        {aggregateDiff.totalValA.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-300">
                        {aggregateDiff.totalValB.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            aggregateDiff.totalDelta === 0
                              ? 'text-slate-300'
                              : aggregateDiff.totalDelta > 0
                              ? 'text-emerald-300 bg-emerald-950 border border-emerald-500/50'
                              : 'text-rose-300 bg-rose-950 border border-rose-500/50'
                          }`}
                        >
                          Δ {aggregateDiff.totalDelta > 0 ? `+${aggregateDiff.totalDelta.toLocaleString()}` : aggregateDiff.totalDelta.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        {aggregateDiff.percentTotalDelta !== null ? (
                          <span
                            className={
                              aggregateDiff.percentTotalDelta > 0
                                ? 'text-emerald-400'
                                : aggregateDiff.percentTotalDelta < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }
                          >
                            {aggregateDiff.percentTotalDelta > 0 ? `+${aggregateDiff.percentTotalDelta}%` : `${aggregateDiff.percentTotalDelta}%`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-300 text-[11px]">
                        {dataA.length} / {dataB.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECONCILIATION SQL */}
        {activeTab === 'reconciliation' && (dataDiff || aggregateDiff) && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-[#0b162f] border border-[#182c54] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
                    <span>Auto-Generated Reconciliation SQL</span>
                    {reconciliationType === 'row' && effectiveKeys.length > 1 && (
                      <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800">
                        Composite: {effectiveKeyLabel}
                      </span>
                    )}
                    {reconciliationType === 'aggregate' && aggregateDiff && (
                      <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {aggregateDiff.measureAgg}({aggregateDiff.measureCol}) by {aggregateDiff.dimensions.join(' + ') || 'All'}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {reconciliationType === 'row'
                      ? 'Execute this query in the SQL Studio to inspect all modified or missing rows directly.'
                      : 'Execute this grouped query to compare dimension totals and detect aggregated variance alerts.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sql = reconciliationType === 'row' ? dataDiff?.reconciliationSql : aggregateDiff?.reconciliationSql;
                      if (!sql) return;
                      navigator.clipboard.writeText(sql);
                      if (reconciliationType === 'row') {
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      } else {
                        setCopiedAggSql(true);
                        setTimeout(() => setCopiedAggSql(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-xs font-medium text-slate-200 rounded-lg transition cursor-pointer"
                  >
                    {(reconciliationType === 'row' ? copiedSql : copiedAggSql) ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{(reconciliationType === 'row' ? copiedSql : copiedAggSql) ? 'Copied!' : 'Copy SQL'}</span>
                  </button>

                  {onExecuteQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        const sql = reconciliationType === 'row' ? dataDiff?.reconciliationSql : aggregateDiff?.reconciliationSql;
                        if (sql) onExecuteQuery(sql);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Execute in SQL Studio</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle query type: Row Level vs Aggregate Summary */}
              <div className="flex items-center gap-2 p-1 bg-[#070e1c] rounded-lg border border-[#182c54] w-fit text-xs">
                <button
                  type="button"
                  onClick={() => setReconciliationType('row')}
                  className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    reconciliationType === 'row' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Row-Level Reconciliation Query</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReconciliationType('aggregate')}
                  className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    reconciliationType === 'aggregate' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Aggregate Summary Reconciliation Query</span>
                </button>
              </div>

              {/* Code display with syntax highlighter */}
              <div className="p-4 bg-[#070e1c] rounded-lg border border-[#182c54] font-mono text-xs whitespace-pre overflow-x-auto leading-relaxed">
                {highlightSql(
                  (reconciliationType === 'row' ? dataDiff?.reconciliationSql : aggregateDiff?.reconciliationSql) || '-- No query available',
                  theme
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
