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
  Sparkles,
  Wand2,
  Link2,
  Unlink,
  RefreshCw,
} from 'lucide-react';
import { TableSchema, AggregateFunction, ColumnMapping, KeyPair } from '../types';
import {
  compareSchemas,
  compareData,
  autoDetectKeyColumn,
  compareAggregateData,
  autoDetectColumnMappings,
  suggestFuzzyColumnMappings,
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

  // Column Mapping & Synonym State
  const [customColumnMappings, setCustomColumnMappings] = useState<ColumnMapping[]>([]);
  const [isMappingPanelOpen, setIsMappingPanelOpen] = useState<boolean>(false);
  const [newMapColA, setNewMapColA] = useState<string>('');
  const [newMapColB, setNewMapColB] = useState<string>('');

  // Aggregate Summary State
  const [customAggDimensions, setCustomAggDimensions] = useState<string[]>([]);
  const [aggMeasure, setAggMeasure] = useState<string>('');
  const [aggFunction, setAggFunction] = useState<AggregateFunction>('SUM');
  const [aggTolerance, setAggTolerance] = useState<number>(0);
  const [aggFilter, setAggFilter] = useState<'all' | 'alerts' | 'balanced' | 'only_a' | 'only_b'>('all');
  const [aggSearch, setAggSearch] = useState<string>('');
  const [aggWhereA, setAggWhereA] = useState<string>('');
  const [aggWhereB, setAggWhereB] = useState<string>('');
  const [isSeparateWhere, setIsSeparateWhere] = useState<boolean>(false);
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

  // Reset mappings and selections when switching tables
  React.useEffect(() => {
    setCustomColumnMappings([]);
    setCustomKeyCols([]);
    setCustomAggDimensions([]);
    setAggMeasure('');
    setNewMapColA('');
    setNewMapColB('');
    setAggWhereA('');
    setAggWhereB('');
    setIsSeparateWhere(false);
  }, [selectedTableAName, selectedTableBName]);

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

  // Default exact column name mappings
  const defaultMappings = useMemo(() => {
    if (!tableA || !tableB) return [];
    return autoDetectColumnMappings(tableA, tableB);
  }, [tableA, tableB]);

  // Active mappings (user custom mappings override defaults if present)
  const activeMappings = useMemo(() => {
    if (customColumnMappings.length > 0) {
      return customColumnMappings;
    }
    return defaultMappings;
  }, [customColumnMappings, defaultMappings]);

  // Number of custom synonym pairings where names differ (e.g. actual ↔ act)
  const synonymCount = useMemo(() => {
    return activeMappings.filter((m) => m.colA.toLowerCase() !== m.colB.toLowerCase()).length;
  }, [activeMappings]);

  // Fuzzy suggestions for columns that are not yet paired
  const fuzzySuggestions = useMemo(() => {
    if (!tableA || !tableB) return [];
    return suggestFuzzyColumnMappings(tableA, tableB, activeMappings);
  }, [tableA, tableB, activeMappings]);

  // Mapping handlers
  const handleAddMapping = (colA: string, colB: string) => {
    if (!colA || !colB) return;
    // Remove any existing mappings involving colA or colB to avoid duplicates
    const filtered = activeMappings.filter(
      (m) => m.colA.toLowerCase() !== colA.toLowerCase() && m.colB.toLowerCase() !== colB.toLowerCase()
    );
    setCustomColumnMappings([
      ...filtered,
      { colA, colB, isAutoMatched: false },
    ]);
    setNewMapColA('');
    setNewMapColB('');
  };

  const handleRemoveMapping = (colA: string, colB: string) => {
    const filtered = activeMappings.filter(
      (m) => !(m.colA.toLowerCase() === colA.toLowerCase() && m.colB.toLowerCase() === colB.toLowerCase())
    );
    setCustomColumnMappings(filtered);
  };

  const handleAcceptAllFuzzy = () => {
    if (fuzzySuggestions.length === 0) return;
    const current = [...activeMappings];
    fuzzySuggestions.forEach((sugg) => {
      const filtered = current.filter(
        (m) => m.colA.toLowerCase() !== sugg.colA.toLowerCase() && m.colB.toLowerCase() !== sugg.colB.toLowerCase()
      );
      filtered.push(sugg);
      current.length = 0;
      current.push(...filtered);
    });
    setCustomColumnMappings([...current]);
  };

  const handleResetMappings = () => {
    setCustomColumnMappings([]);
  };

  // Schema diff result (takes active column mappings into account)
  const schemaDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareSchemas(tableA, tableB, activeMappings);
  }, [tableA, tableB, activeMappings]);

  // Effective identity key pairs (supports single or multi-column composite identity with mapped names)
  const effectiveKeys = useMemo(() => {
    const validCustom = customKeyCols.filter((col) =>
      activeMappings.some(
        (m) => m.colA === col || m.colB === col || `${m.colA} ↔ ${m.colB}` === col
      )
    );
    if (validCustom.length > 0) return validCustom;
    if (tableA && tableB) {
      const auto = autoDetectKeyColumn(tableA, tableB, activeMappings);
      if (auto) {
        const match = activeMappings.find((m) => m.colA === auto);
        return match ? [match.colA === match.colB ? match.colA : `${match.colA} ↔ ${match.colB}`] : [auto];
      }
    }
    return [];
  }, [customKeyCols, activeMappings, tableA, tableB]);

  const effectiveKeyPairs = useMemo<KeyPair[]>(() => {
    return effectiveKeys.map((k) => {
      const match = activeMappings.find(
        (m) => m.colA === k || m.colB === k || `${m.colA} ↔ ${m.colB}` === k
      );
      if (match) {
        return { colA: match.colA, colB: match.colB };
      }
      return { colA: k, colB: k };
    });
  }, [effectiveKeys, activeMappings]);

  const effectiveKeyLabel = useMemo(() => {
    return effectiveKeyPairs
      .map((kp) => (kp.colA === kp.colB ? kp.colA : `${kp.colA} ↔ ${kp.colB}`))
      .join(' + ');
  }, [effectiveKeyPairs]);

  const availableAddKeys = useMemo(() => {
    return activeMappings
      .map((m) => (m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`))
      .filter((label) => !effectiveKeys.includes(label));
  }, [activeMappings, effectiveKeys]);

  // Data diff result (evaluates mapped pairs, e.g. actual ↔ act)
  const dataDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareData(tableA, dataA, tableB, dataB, effectiveKeyPairs, activeMappings);
  }, [tableA, dataA, tableB, dataB, effectiveKeyPairs, activeMappings]);

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

  // Candidate measures for aggregate summary (supports mapped pairs like actual ↔ act)
  const candidateMeasures = useMemo(() => {
    const list: { key: string; label: string; colA: string; colB: string }[] = [
      { key: '*', label: '* (Row Count)', colA: '*', colB: '*' },
    ];
    if (!tableA || !tableB) return list;

    // First add mapped columns that look like measures or have numeric types
    activeMappings.forEach((m) => {
      const colA = tableA.columns.find((c) => c.name.toLowerCase() === m.colA.toLowerCase());
      const colB = tableB.columns.find((c) => c.name.toLowerCase() === m.colB.toLowerCase());
      const isNumType =
        (colA && (colA.type === 'INTEGER' || colA.type === 'FLOAT')) ||
        (colB && (colB.type === 'INTEGER' || colB.type === 'FLOAT'));
      const isNumName =
        /(qty|quantity|amount|total|price|cost|sales|rev|revenue|count|sum|balance|score|rate|val|value|act|actual)/i.test(
          m.colA
        ) ||
        /(qty|quantity|amount|total|price|cost|sales|rev|revenue|count|sum|balance|score|rate|val|value|act|actual)/i.test(
          m.colB
        );
      const key = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
      if (isNumType || isNumName) {
        list.push({ key, label: key, colA: m.colA, colB: m.colB });
      }
    });

    // Then add other mapped pairs
    activeMappings.forEach((m) => {
      const key = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
      if (!list.some((item) => item.key === key)) {
        list.push({ key, label: key, colA: m.colA, colB: m.colB });
      }
    });

    return list;
  }, [activeMappings, tableA, tableB]);

  // Effective dimensions for aggregate comparison
  const effectiveAggDimensions = useMemo(() => {
    const validCustom = customAggDimensions.filter((dim) =>
      activeMappings.some(
        (m) => m.colA === dim || m.colB === dim || `${m.colA} ↔ ${m.colB}` === dim
      )
    );
    if (validCustom.length > 0) return validCustom;
    // Default to effective identity keys if available
    if (effectiveKeys.length > 0) return effectiveKeys;
    // Fallback to first non-measure mapped column
    const nonMeasure = activeMappings.find((m) => {
      const key = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
      return !candidateMeasures.slice(1).some((cm) => cm.key === key);
    });
    if (nonMeasure) {
      return [nonMeasure.colA === nonMeasure.colB ? nonMeasure.colA : `${nonMeasure.colA} ↔ ${nonMeasure.colB}`];
    }
    return activeMappings.length > 0
      ? [activeMappings[0].colA === activeMappings[0].colB ? activeMappings[0].colA : `${activeMappings[0].colA} ↔ ${activeMappings[0].colB}`]
      : [];
  }, [customAggDimensions, activeMappings, effectiveKeys, candidateMeasures]);

  const effectiveAggDimensionPairs = useMemo<KeyPair[]>(() => {
    return effectiveAggDimensions.map((d) => {
      const match = activeMappings.find(
        (m) => m.colA === d || m.colB === d || `${m.colA} ↔ ${m.colB}` === d
      );
      if (match) {
        return { colA: match.colA, colB: match.colB };
      }
      return { colA: d, colB: d };
    });
  }, [effectiveAggDimensions, activeMappings]);

  const effectiveAggMeasurePair = useMemo<KeyPair>(() => {
    if (aggMeasure) {
      if (aggMeasure === '*') return { colA: '*', colB: '*' };
      const match = activeMappings.find(
        (m) => m.colA === aggMeasure || m.colB === aggMeasure || `${m.colA} ↔ ${m.colB}` === aggMeasure
      );
      if (match) {
        return { colA: match.colA, colB: match.colB };
      }
    }
    const firstMeas = candidateMeasures.find(
      (m) => m.key !== '*' && !effectiveAggDimensions.includes(m.key)
    );
    if (firstMeas) {
      return { colA: firstMeas.colA, colB: firstMeas.colB };
    }
    return candidateMeasures.length > 1
      ? { colA: candidateMeasures[1].colA, colB: candidateMeasures[1].colB }
      : { colA: '*', colB: '*' };
  }, [aggMeasure, activeMappings, candidateMeasures, effectiveAggDimensions]);

  const effectiveAggMeasureKey = useMemo(() => {
    if (effectiveAggMeasurePair.colA === '*') return '*';
    return effectiveAggMeasurePair.colA === effectiveAggMeasurePair.colB
      ? effectiveAggMeasurePair.colA
      : `${effectiveAggMeasurePair.colA} ↔ ${effectiveAggMeasurePair.colB}`;
  }, [effectiveAggMeasurePair]);

  const availableAddAggDimensions = useMemo(() => {
    return activeMappings
      .map((m) => (m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`))
      .filter((label) => !effectiveAggDimensions.includes(label) && label !== effectiveAggMeasureKey);
  }, [activeMappings, effectiveAggDimensions, effectiveAggMeasureKey]);

  // Quick WHERE suggestions based on columns in Table A
  const quickWhereSuggestions = useMemo(() => {
    if (!tableA) return [];
    const chips: string[] = [];
    tableA.columns.forEach((c) => {
      const lower = c.name.toLowerCase();
      if (lower.includes('status') || lower.includes('state')) {
        chips.push(`${c.name} = 'ACTIVE'`);
        chips.push(`${c.name} <> 'CANCELLED'`);
      } else if (lower.includes('year')) {
        chips.push(`${c.name} = 2026`);
      } else if (lower.includes('date')) {
        chips.push(`${c.name} >= '2026-01-01'`);
      } else if (c.type === 'INTEGER' || c.type === 'FLOAT') {
        if (chips.length < 5) {
          chips.push(`${c.name} > 0`);
        }
      }
    });
    if (chips.length === 0 && tableA.columns.length > 0) {
      chips.push(`${tableA.columns[0].name} IS NOT NULL`);
    }
    return chips.slice(0, 5);
  }, [tableA]);

  // Aggregate diff result
  const aggregateDiff = useMemo(() => {
    if (!tableA || !tableB) return null;
    return compareAggregateData(
      tableA,
      dataA,
      tableB,
      dataB,
      effectiveAggDimensionPairs,
      effectiveAggMeasurePair,
      aggFunction,
      aggTolerance,
      activeMappings,
      {
        whereA: aggWhereA,
        whereB: isSeparateWhere ? aggWhereB : undefined,
      }
    );
  }, [
    tableA,
    dataA,
    tableB,
    dataB,
    effectiveAggDimensionPairs,
    effectiveAggMeasurePair,
    aggFunction,
    aggTolerance,
    activeMappings,
    aggWhereA,
    aggWhereB,
    isSeparateWhere,
  ]);

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
    const measureLabel = `${aggregateDiff.measureAgg}_${(aggregateDiff.measureCol || '').replace(/ ↔ /g, '_vs_')}`;
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
    const filterHeader = aggregateDiff.whereClauseA || aggregateDiff.whereClauseB
      ? `# WHERE Filter (${tableA.name}): ${aggregateDiff.whereClauseA || 'None'}\n# WHERE Filter (${tableB.name}): ${aggregateDiff.whereClauseB || 'None'}\n`
      : '';
    const csvContent = filterHeader + [headerCols.join(','), ...rows].join('\n');
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

          {/* Column Mapping Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMappingPanelOpen(!isMappingPanelOpen)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs ${
              isMappingPanelOpen
                ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                : synonymCount > 0
                ? 'bg-blue-950/80 text-blue-300 border-blue-500/60 hover:bg-blue-900/50'
                : 'bg-[#0e1b38] text-slate-300 border-[#1e3668] hover:bg-[#182c54]'
            }`}
            title="Manage column synonym mappings (e.g. actual ↔ act, material desc ↔ material description)"
          >
            <Link2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Column Mapping ({activeMappings.length})</span>
            {synonymCount > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500 text-slate-950 font-mono">
                {synonymCount} synonym{synonymCount === 1 ? '' : 's'}
              </span>
            ) : fuzzySuggestions.length > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                ⚡ {fuzzySuggestions.length} suggest
              </span>
            ) : null}
          </button>
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

      {/* COLLAPSIBLE COLUMN MAPPING & SYNONYM PAIRING DRAWER */}
      {isMappingPanelOpen && (
        <div className="bg-[#0b1429] border-b border-[#1d3567] p-4 sm:p-5 space-y-4 shadow-xl animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                  <span>Manual Column Mappings & Synonyms</span>
                  <span className="text-[10px] text-blue-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-800 font-mono">
                    {activeMappings.length} Active Pairings ({synonymCount} Synonyms)
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Map columns with different names between tables (e.g. <span className="font-mono text-blue-300">actual ↔ act</span>, <span className="font-mono text-emerald-300">material desc ↔ material description</span>) for accurate schema matching, row diffs, and aggregate summaries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {fuzzySuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleAcceptAllFuzzy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
                  title="Auto-pair columns with similar names or common abbreviations"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Suggest All ({fuzzySuggestions.length})</span>
                </button>
              )}

              {customColumnMappings.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetMappings}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] text-slate-300 hover:text-white border border-[#1e3668] rounded-lg text-xs transition cursor-pointer"
                  title="Reset to exact column name matches only"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset to Exact Matches</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMappingPanelOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#122347] transition cursor-pointer"
                title="Close Mapping Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Manual Column Pair Adder Form */}
          <div className="flex flex-wrap items-center gap-2.5 bg-[#070e1c] p-3 rounded-xl border border-[#182c54]">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Add Pair:</span>
            </div>

            {/* Select Col A */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-blue-400 font-mono">Source (A):</span>
              <select
                value={newMapColA}
                onChange={(e) => setNewMapColA(e.target.value)}
                className="bg-[#0e1b38] border border-[#1e3668] text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
              >
                <option value="">-- Choose Column from {tableA?.name} --</option>
                {tableA?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />

            {/* Select Col B */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-400 font-mono">Target (B):</span>
              <select
                value={newMapColB}
                onChange={(e) => setNewMapColB(e.target.value)}
                className="bg-[#0e1b38] border border-[#1e3668] text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer font-mono"
              >
                <option value="">-- Choose Column from {tableB?.name} --</option>
                {tableB?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!newMapColA || !newMapColB}
              onClick={() => handleAddMapping(newMapColA, newMapColB)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Map Pair</span>
            </button>
          </div>

          {/* Fuzzy Suggestions Pill Bar (if any) */}
          {fuzzySuggestions.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Fuzzy Synonym Suggestions Detected:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {fuzzySuggestions.map((sugg) => (
                  <button
                    key={`${sugg.colA}-${sugg.colB}`}
                    type="button"
                    onClick={() => handleAddMapping(sugg.colA, sugg.colB)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1b38] hover:bg-[#182c54] border border-amber-500/50 text-xs font-mono text-amber-200 transition cursor-pointer group shadow-xs"
                    title={`Click to map "${sugg.colA}" in Table A to "${sugg.colB}" in Table B`}
                  >
                    <span className="text-blue-300 font-bold">{sugg.colA}</span>
                    <ArrowRightLeft className="w-3 h-3 text-amber-400 group-hover:scale-110 transition" />
                    <span className="text-emerald-300 font-bold">{sugg.colB}</span>
                    <span className="text-[10px] text-amber-400 font-sans font-bold ml-1 bg-amber-500/20 px-1 py-0.2 rounded">
                      + Map
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Mappings Chips Grid */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400">
              Current Column Mappings ({activeMappings.length}):
            </div>
            <div className="flex flex-wrap items-center gap-2 max-h-48 overflow-y-auto p-1">
              {activeMappings.map((m) => {
                const isSynonym = m.colA.toLowerCase() !== m.colB.toLowerCase();
                return (
                  <div
                    key={`${m.colA}-${m.colB}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition ${
                      isSynonym
                        ? 'bg-blue-950/90 border-blue-500/70 text-blue-200 shadow-xs'
                        : 'bg-[#070e1c] border-[#182c54] text-slate-300'
                    }`}
                  >
                    <span className="text-blue-300 font-semibold">{m.colA}</span>
                    <ArrowRightLeft className={`w-3 h-3 ${isSynonym ? 'text-blue-400' : 'text-slate-600'}`} />
                    <span className="text-emerald-300 font-semibold">{m.colB}</span>

                    {isSynonym && (
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-sans font-bold">
                        Synonym
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveMapping(m.colA, m.colB)}
                      className="p-0.5 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 rounded transition cursor-pointer ml-0.5"
                      title={`Remove mapping for ${m.colA} ↔ ${m.colB}`}
                      aria-label={`Unlink ${m.colA} and ${m.colB}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                      {activeMappings.map((m) => {
                        const label = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
                        const isAuto = m.colA === autoDetectKeyColumn(tableA!, tableB!, activeMappings);
                        return (
                          <option key={label} value={label}>
                            Switch to: {label} {isAuto ? '(Auto-Detected)' : ''}
                          </option>
                        );
                      })}
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
                      {activeMappings.map((m) => {
                        const pairKey = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
                        const diffCount = dataDiff?.columnDiscrepancies?.[pairKey] || 0;
                        const isSynonym = m.colA.toLowerCase() !== m.colB.toLowerCase();
                        return (
                          <th key={pairKey} className="py-2.5 px-4 font-mono max-w-[240px]">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate" title={pairKey}>{pairKey}</span>
                              {isSynonym && (
                                <span
                                  className="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800 shrink-0"
                                  title={`Custom mapping: ${m.colA} (A) ↔ ${m.colB} (B)`}
                                >
                                  Mapped
                                </span>
                              )}
                              {diffCount > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-sans shrink-0"
                                  title={`${diffCount} value discrepancy alert(s) in ${pairKey}`}
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

                          {activeMappings.map((m) => {
                            const pairKey = m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`;
                            const valA = row.valuesA ? row.valuesA[m.colA] : undefined;
                            const valB = row.valuesB ? row.valuesB[m.colB] : undefined;
                            const isChanged = row.changedColumns?.includes(pairKey);

                            return (
                              <td key={pairKey} className="py-2 px-4 max-w-[280px]">
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
                                          title={`Source (${tableA?.name} [${m.colA}]): ${String(valA ?? 'null')}`}
                                        >
                                          {String(valA ?? 'null')}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span
                                          className="text-emerald-300 font-bold bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/60 truncate max-w-[110px]"
                                          title={`Target (${tableB?.name} [${m.colB}]): ${String(valB ?? 'null')}`}
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
                        {activeMappings
                          .map((m) => (m.colA === m.colB ? m.colA : `${m.colA} ↔ ${m.colB}`))
                          .filter((c) => c !== effectiveAggMeasureKey)
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
                      value={effectiveAggMeasureKey}
                      onChange={(e) => setAggMeasure(e.target.value)}
                      className="bg-[#070e1c] border border-[#1b315e] text-xs text-slate-200 font-mono rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[200px]"
                      title="Measure column to aggregate"
                    >
                      {candidateMeasures.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
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

              {/* WHERE Filter Condition Section */}
              <div className="bg-[#070e1c] border border-[#1b315e] rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                      <Filter className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      WHERE Condition Filter
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
                      Pre-Aggregation Filter
                    </span>
                    {(aggWhereA.trim() || (isSeparateWhere && aggWhereB.trim())) && (
                      <span className="text-[10px] font-mono font-bold bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded border border-blue-600/50 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        FILTER ACTIVE ({aggregateDiff.filteredRowsCountA ?? dataA.length}/{dataA.length} in A, {aggregateDiff.filteredRowsCountB ?? dataB.length}/{dataB.length} in B)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSeparateWhere}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsSeparateWhere(checked);
                          if (checked && !aggWhereB) {
                            setAggWhereB(aggWhereA);
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-400 hover:text-slate-200">
                        Separate WHERE for A & B
                      </span>
                    </label>

                    {(aggWhereA || aggWhereB) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAggWhereA('');
                          setAggWhereB('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear Filter</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Single vs Separate Inputs */}
                {!isSeparateWhere ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-[#0a1427] border border-[#1b315e] focus-within:border-blue-500 rounded-lg px-3 py-1.5 transition">
                      <span className="text-xs font-mono font-bold text-blue-400 select-none">
                        WHERE
                      </span>
                      <input
                        type="text"
                        value={aggWhereA}
                        onChange={(e) => setAggWhereA(e.target.value)}
                        placeholder="e.g. status = 'COMPLETED' AND order_date >= '2026-01-01' OR qty > 0"
                        className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none flex-1 font-mono"
                      />
                      {aggWhereA && (
                        <button
                          type="button"
                          onClick={() => setAggWhereA('')}
                          className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                          title="Clear WHERE clause"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>
                        Shared condition applies to both tables. Mapped column synonyms (e.g. <span className="font-mono text-slate-300">{activeMappings.filter(m => m.colA !== m.colB).map(m => `${m.colA} ➔ ${m.colB}`).slice(0, 2).join(', ') || 'Actual ➔ Act'}</span>) auto-translate for Target (B).
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Source Table A WHERE */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-blue-400 font-semibold flex items-center gap-1">
                          Source ({tableA?.name}) WHERE
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {aggregateDiff.filteredRowsCountA ?? dataA.length}/{dataA.length} rows
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0a1427] border border-blue-900/50 focus-within:border-blue-500 rounded-lg px-2.5 py-1.5 transition">
                        <span className="text-xs font-mono font-bold text-blue-400 select-none">
                          WHERE
                        </span>
                        <input
                          type="text"
                          value={aggWhereA}
                          onChange={(e) => setAggWhereA(e.target.value)}
                          placeholder="e.g. status = 'COMPLETED' AND qty > 0"
                          className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none flex-1 font-mono"
                        />
                        {aggWhereA && (
                          <button
                            type="button"
                            onClick={() => setAggWhereA('')}
                            className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Target Table B WHERE */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          Target ({tableB?.name}) WHERE
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {aggregateDiff.filteredRowsCountB ?? dataB.length}/{dataB.length} rows
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#0a1427] border border-emerald-900/50 focus-within:border-emerald-500 rounded-lg px-2.5 py-1.5 transition">
                        <span className="text-xs font-mono font-bold text-emerald-400 select-none">
                          WHERE
                        </span>
                        <input
                          type="text"
                          value={aggWhereB}
                          onChange={(e) => setAggWhereB(e.target.value)}
                          placeholder="e.g. status = 'COMPLETED' AND act > 0"
                          className="bg-transparent text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none flex-1 font-mono"
                        />
                        {aggWhereB && (
                          <button
                            type="button"
                            onClick={() => setAggWhereB('')}
                            className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner if AlaSQL parsing failed */}
                {(aggregateDiff.whereErrorA || aggregateDiff.whereErrorB) && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">WHERE Syntax Notice: </span>
                      {aggregateDiff.whereErrorA && (
                        <span>Source A: &quot;{aggregateDiff.whereErrorA}&quot;. </span>
                      )}
                      {aggregateDiff.whereErrorB && (
                        <span>Target B: &quot;{aggregateDiff.whereErrorB}&quot;. </span>
                      )}
                      <span className="text-rose-200/80">
                        Check quotes and column names. Unfiltered data is displayed while editing.
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Suggestion Chips & Operator Helper Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#142342]">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                    Quick Filters:
                  </span>
                  {quickWhereSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const targetVal = aggWhereA.trim()
                          ? `${aggWhereA} AND ${suggestion}`
                          : suggestion;
                        setAggWhereA(targetVal);
                        if (isSeparateWhere) {
                          const targetValB = aggWhereB.trim()
                            ? `${aggWhereB} AND ${suggestion}`
                            : suggestion;
                          setAggWhereB(targetValB);
                        }
                      }}
                      className="px-2 py-0.5 bg-[#0f1d38] hover:bg-[#182c54] border border-[#1e3668] hover:border-blue-500/60 text-[11px] font-mono text-blue-300 rounded transition cursor-pointer flex items-center gap-1"
                      title={`Click to add "${suggestion}"`}
                    >
                      <Plus className="w-2.5 h-2.5 text-blue-400" />
                      <span>{suggestion}</span>
                    </button>
                  ))}

                  {/* Operator Helpers */}
                  <div className="flex items-center gap-1 ml-auto">
                    {['AND', 'OR', 'NOT', 'LIKE', 'IS NOT NULL'].map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => {
                          const appendedA = aggWhereA.trim()
                            ? `${aggWhereA} ${op} `
                            : `${op} `;
                          setAggWhereA(appendedA);
                          if (isSeparateWhere) {
                            const appendedB = aggWhereB.trim()
                              ? `${aggWhereB} ${op} `
                              : `${op} `;
                            setAggWhereB(appendedB);
                          }
                        }}
                        className="px-1.5 py-0.5 bg-slate-900/80 hover:bg-slate-800 text-[10px] font-mono text-slate-400 hover:text-slate-200 border border-slate-700/60 rounded cursor-pointer transition"
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scope Description */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <div>
                  Comparing <span className="font-mono text-slate-200 font-bold">{aggFunction}({effectiveAggMeasureKey})</span> grouped by <span className="font-mono text-blue-300 font-bold">{effectiveAggDimensions.join(' + ') || 'All Rows'}</span> between <span className="text-blue-400 font-semibold">{tableA?.name}</span> and <span className="text-emerald-400 font-semibold">{tableB?.name}</span>
                  {(aggregateDiff.whereClauseA || aggregateDiff.whereClauseB) && (
                    <span className="ml-1 text-amber-300 font-medium">
                      (filtered: {aggregateDiff.filteredRowsCountA ?? dataA.length}/{dataA.length} in A, {aggregateDiff.filteredRowsCountB ?? dataB.length}/{dataB.length} in B)
                    </span>
                  )}.
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
                      Aggregated metric <span className="font-mono font-bold text-amber-300">{aggFunction}({effectiveAggMeasureKey})</span> differs between <span className="text-blue-300 font-semibold">{tableA?.name}</span> and <span className="text-emerald-300 font-semibold">{tableB?.name}</span>. Net variance: <span className="font-mono font-bold text-amber-200">Δ {aggregateDiff.totalDelta > 0 ? `+${aggregateDiff.totalDelta.toLocaleString()}` : aggregateDiff.totalDelta.toLocaleString()}</span>{aggregateDiff.percentTotalDelta !== null ? ` (${aggregateDiff.percentTotalDelta > 0 ? '+' : ''}${aggregateDiff.percentTotalDelta}%)` : ''}.
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
                  <span>Zero Aggregate Discrepancies: All {aggregateDiff.totalGroups} groups have matching totals across both tables for {aggFunction}({effectiveAggMeasureKey}).</span>
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
                      Metric: {aggFunction}({effectiveAggMeasureKey})
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
                        {aggregateDiff.whereClauseA || aggregateDiff.whereClauseB ? (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="text-amber-300 font-bold">
                              {aggregateDiff.filteredRowsCountA ?? dataA.length} / {aggregateDiff.filteredRowsCountB ?? dataB.length}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              of {dataA.length} / {dataB.length}
                            </span>
                          </div>
                        ) : (
                          `${dataA.length} / ${dataB.length}`
                        )}
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
                      <>
                        <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {aggregateDiff.measureAgg}({aggregateDiff.measureCol}) by {aggregateDiff.dimensions.join(' + ') || 'All'}
                        </span>
                        {(aggregateDiff.whereClauseA || aggregateDiff.whereClauseB) && (
                          <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                            <Filter className="w-3 h-3 text-amber-400" />
                            <span>WHERE Filtered</span>
                          </span>
                        )}
                      </>
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
