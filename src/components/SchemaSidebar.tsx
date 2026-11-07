import React, { useState } from 'react';
import {
  Database,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  Search,
  Eye,
  Trash2,
  Download,
  Plus,
  Play,
  FileSpreadsheet,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';
import { TableSchema } from '../types';
import { SAMPLE_DATASETS } from '../utils/sampleData';
import { useTheme } from '../context/ThemeContext';
import { isProUnlocked, FREE_TABLE_LIMIT } from '../utils/licenseManager';

interface SchemaSidebarProps {
  tables: TableSchema[];
  onSelectTableQuery: (tableName: string) => void;
  onPreviewTable: (table: TableSchema) => void;
  onDropTable: (tableName: string) => void;
  onExportTable: (table: TableSchema) => void;
  onInsertField: (fieldName: string) => void;
  onLoadSample: (datasetId: string) => void;
  onOpenUpload: () => void;
  onOpenPostgres?: () => void;
  onOpenProModal?: () => void;
  onOpenVisualizer?: (tableName: string) => void;
}

export const SchemaSidebar: React.FC<SchemaSidebarProps> = ({
  tables,
  onSelectTableQuery,
  onPreviewTable,
  onDropTable,
  onExportTable,
  onInsertField,
  onLoadSample,
  onOpenUpload,
  onOpenPostgres,
  onOpenProModal,
  onOpenVisualizer,
}) => {
  const { isBright } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>(() => {
    // Expand first table by default
    const initial: Record<string, boolean> = {};
    if (tables.length > 0) initial[tables[0].name] = true;
    return initial;
  });

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const filteredTables = tables.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchTable = t.name.toLowerCase().includes(term);
    const matchCol = t.columns.some((c) => c.name.toLowerCase().includes(term));
    return matchTable || matchCol;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INTEGER':
      case 'FLOAT':
        return isBright
          ? 'text-amber-700 bg-amber-50 border-amber-200'
          : 'text-amber-400 bg-amber-950/50 border-amber-800/40';
      case 'DATE':
        return isBright
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40';
      case 'BOOLEAN':
        return isBright
          ? 'text-purple-700 bg-purple-50 border-purple-200'
          : 'text-purple-400 bg-purple-950/50 border-purple-800/40';
      default:
        return isBright
          ? 'text-sky-700 bg-sky-50 border-sky-200'
          : 'text-sky-400 bg-sky-950/50 border-sky-800/40';
    }
  };

  return (
    <aside className={`w-full md:w-72 border-r flex flex-col h-full shrink-0 select-none transition-colors duration-150 ${
      isBright ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#091224] border-[#162544] text-slate-100'
    }`}>
      {/* Sidebar Header */}
      <div className={`p-3 border-b shrink-0 transition-colors ${
        isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#162544]'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-500" />
            <span className={`text-xs font-semibold tracking-wide uppercase ${
              isBright ? 'text-slate-800' : 'text-slate-200'
            }`}>
              SQL Schema
            </span>
            {isProUnlocked() ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                💎 Unlimited
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenProModal}
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border transition cursor-pointer flex items-center gap-1 ${
                  tables.length >= FREE_TABLE_LIMIT
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 font-bold'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={`Free plan limit: ${FREE_TABLE_LIMIT} tables. Click to unlock Unlimited Tables.`}
              >
                <span>{tables.length}/{FREE_TABLE_LIMIT}</span>
                {tables.length >= FREE_TABLE_LIMIT && <span className="text-[8px] uppercase">Pro</span>}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenPostgres && (
              <button
                onClick={onOpenPostgres}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-100 bg-indigo-700 hover:bg-indigo-600 rounded transition cursor-pointer shadow-xs border border-indigo-500/40"
                title="Connect PostgreSQL Database (DBeaver style)"
              >
                <span className="text-xs">🐘</span>
                <span>Postgres</span>
              </button>
            )}
            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition cursor-pointer shadow-xs"
              title="Upload Excel or CSV file"
            >
              <Plus className="w-3 h-3" />
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* Search tables/columns */}
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${isBright ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search schema..."
            className={`w-full pl-8 pr-2.5 py-1 text-xs rounded transition-colors focus:outline-none focus:border-blue-500 ${
              isBright
                ? 'bg-slate-100/80 border border-slate-200 text-slate-800 placeholder:text-slate-400'
                : 'bg-[#060b17] border border-[#182c54] text-slate-200 placeholder:text-slate-500'
            }`}
          />
        </div>
      </div>

      {/* Table limit banner when at 2 tables */}
      {!isProUnlocked() && tables.length >= FREE_TABLE_LIMIT && onOpenProModal && (
        <div className="mx-2 mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Table limit reached (2/2)</span>
          </div>
          <button
            type="button"
            onClick={onOpenProModal}
            className="font-bold underline text-amber-200 hover:text-white cursor-pointer ml-1 shrink-0"
          >
            Unlock 💎
          </button>
        </div>
      )}

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tables.length === 0 ? (
          <div className={`p-4 text-center text-xs space-y-3.5 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
            <Layers className={`w-8 h-8 mx-auto ${isBright ? 'text-slate-400' : 'text-slate-600'}`} />
            <div>
              <p className={`font-semibold ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>
                Schema is Empty
              </p>
              <p className="mt-1 text-[11px] leading-relaxed">
                Connect a PostgreSQL database via DBeaver, load a sample dataset, or upload an Excel / CSV file.
              </p>
            </div>
            <div className="space-y-1.5 pt-1 text-left">
              {onOpenPostgres && (
                <button
                  type="button"
                  onClick={onOpenPostgres}
                  className={`w-full text-left p-2.5 rounded-lg border transition flex items-center justify-between group cursor-pointer ${
                    isBright
                      ? 'bg-indigo-50/70 hover:bg-indigo-100/70 border-indigo-200 text-indigo-950 shadow-xs'
                      : 'bg-indigo-950/40 hover:bg-indigo-900/50 border-indigo-800/50 text-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base shrink-0">🐘</span>
                    <div className="truncate">
                      <div className="text-xs font-semibold group-hover:underline">
                        Connect PostgreSQL (DBeaver)
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Local, Neon, Supabase, or Demo DB
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {SAMPLE_DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => onLoadSample(ds.id)}
                  className={`w-full text-left p-2 rounded-lg border transition flex items-center justify-between group cursor-pointer ${
                    isBright
                      ? 'bg-white hover:bg-blue-50/80 border-slate-200 shadow-xs'
                      : 'bg-[#0b162f] hover:bg-[#122347] border-[#182c54]'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className={`text-xs font-medium truncate ${
                      isBright ? 'text-slate-800 group-hover:text-blue-600' : 'text-slate-200 group-hover:text-blue-300'
                    }`}>
                      {ds.title}
                    </div>
                    <div className={`text-[10px] font-mono ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                      {ds.badge}
                    </div>
                  </div>
                  <Sparkles className={`w-3 h-3 shrink-0 ${
                    isBright ? 'text-slate-400 group-hover:text-blue-500' : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                </button>
              ))}
            </div>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className={`p-4 text-center text-xs ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>
            No tables or columns match &quot;{searchTerm}&quot;.
          </div>
        ) : (
          filteredTables.map((table) => {
            const isExpanded = expandedTables[table.name] ?? false;

            return (
              <div
                key={table.name}
                className={`border rounded-lg overflow-hidden transition-all ${
                  isBright
                    ? 'bg-white border-slate-200 shadow-xs'
                    : 'bg-[#0b162f]/80 border-[#182c54]'
                }`}
              >
                {/* Table Header Bar */}
                <div
                  onClick={() => toggleTable(table.name)}
                  className={`flex items-center justify-between p-2 cursor-pointer group transition-colors ${
                    isBright ? 'hover:bg-slate-50' : 'hover:bg-[#122347]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isExpanded ? (
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${isBright ? 'text-slate-400' : 'text-slate-400'}`} />
                    ) : (
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isBright ? 'text-slate-400' : 'text-slate-400'}`} />
                    )}
                    {table.sourceType === 'postgres' ? (
                      <span className="text-xs shrink-0 select-none" title="PostgreSQL Table">🐘</span>
                    ) : (
                      <TableIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className={`font-mono text-xs font-semibold truncate ${
                      isBright ? 'text-slate-800 group-hover:text-blue-600' : 'text-slate-200 group-hover:text-white'
                    }`} title={table.name}>
                      {table.name}
                    </span>
                    {table.sourceType === 'postgres' && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                        PG
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-mono tabular-nums ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>
                      {table.rowCount}r
                    </span>
                    {/* Quick Query Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTableQuery(table.name);
                      }}
                      title={`Query SELECT * FROM ${table.name}`}
                      className={`p-1 rounded transition cursor-pointer ${
                        isBright
                          ? 'hover:bg-blue-600 hover:text-white text-slate-500'
                          : 'hover:bg-blue-600 hover:text-white text-slate-400'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>

                {/* Sub-actions toolbar */}
                {isExpanded && (
                  <div className={`px-2 pb-1.5 flex items-center justify-between text-[11px] border-b transition-colors ${
                    isBright
                      ? 'bg-slate-50/80 border-slate-200 text-slate-600'
                      : 'bg-[#070e1e] border-[#182c54] text-slate-400'
                  }`}>
                    <span className="truncate max-w-[140px]" title={table.connectionName || table.sourceFileName}>
                      {table.sourceType === 'postgres'
                        ? (table.connectionName ? `PG: ${table.connectionName}` : `PostgreSQL: ${table.name}`)
                        : (table.sheetName || table.sourceFileName)}
                    </span>
                    <div className="flex items-center gap-1">
                      {onOpenVisualizer && (
                        <button
                          onClick={() => onOpenVisualizer(table.name)}
                          className={`p-1 rounded transition cursor-pointer ${
                            isBright
                              ? 'hover:text-pink-600 hover:bg-slate-200'
                              : 'hover:text-pink-300 hover:bg-[#122347]'
                          }`}
                          title="Open in Drag-and-Drop Visualizer Studio"
                        >
                          <PieChart className="w-3 h-3 text-pink-500" />
                        </button>
                      )}
                      <button
                        onClick={() => onPreviewTable(table)}
                        className={`p-1 rounded transition cursor-pointer ${
                          isBright
                            ? 'hover:text-slate-900 hover:bg-slate-200 text-slate-500'
                            : 'hover:text-slate-200 hover:bg-[#122347] text-slate-400'
                        }`}
                        title="Preview table rows & statistics"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onExportTable(table)}
                        className={`p-1 rounded transition cursor-pointer ${
                          isBright
                            ? 'hover:text-slate-900 hover:bg-slate-200 text-slate-500'
                            : 'hover:text-slate-200 hover:bg-[#122347] text-slate-400'
                        }`}
                        title="Export table as Excel (.xlsx)"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDropTable(table.name)}
                        className={`p-1 rounded transition cursor-pointer ${
                          isBright
                            ? 'hover:text-rose-600 hover:bg-rose-50 text-slate-400'
                            : 'hover:text-rose-400 hover:bg-[#122347] text-slate-400'
                        }`}
                        title="Drop table from catalog"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Columns List */}
                {isExpanded && (
                  <div className={`p-1.5 space-y-0.5 ${
                    isBright ? 'bg-slate-50/50' : 'bg-[#070e1e]'
                  }`}>
                    {table.columns.map((col) => (
                      <div
                        key={col.name}
                        onClick={() => onInsertField(col.name)}
                        className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer group transition-colors ${
                          isBright
                            ? 'hover:bg-slate-100 text-slate-700'
                            : 'hover:bg-[#122347] text-slate-300'
                        }`}
                        title={`Click to insert "${col.name}" into query (Type: ${col.type}, Nulls: ${col.nullCount})`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`font-mono text-[11px] truncate ${
                            isBright ? 'text-slate-700 group-hover:text-blue-700' : 'text-slate-300 group-hover:text-white'
                          }`}>
                            {col.name}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase font-medium ${getTypeColor(
                            col.type
                          )}`}
                        >
                          {col.type === 'INTEGER' ? 'INT' : col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sample Datasets Panel (visible when tables exist) */}
      {tables.length > 0 && (
        <div className={`p-3 border-t shrink-0 transition-colors ${
          isBright ? 'bg-slate-100/70 border-slate-200' : 'bg-[#070e1d] border-[#162544]'
        }`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
            isBright ? 'text-slate-500' : 'text-slate-400'
          }`}>
            Sample Datasets
          </div>
          <div className="space-y-1.5">
            {SAMPLE_DATASETS.map((ds) => (
              <button
                key={ds.id}
                onClick={() => onLoadSample(ds.id)}
                className={`w-full text-left p-2 rounded transition flex items-center justify-between group cursor-pointer border ${
                  isBright
                    ? 'bg-white hover:bg-blue-50 border-slate-200 shadow-xs'
                    : 'bg-[#0b162f] hover:bg-[#122347] border-[#182c54]'
                }`}
              >
                <div className="truncate pr-2">
                  <div className={`text-xs font-medium truncate ${
                    isBright ? 'text-slate-800 group-hover:text-blue-600' : 'text-slate-200 group-hover:text-blue-300'
                  }`}>
                    {ds.title}
                  </div>
                  <div className={`text-[10px] font-mono ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                    {ds.badge}
                  </div>
                </div>
                <Sparkles className={`w-3 h-3 shrink-0 ${
                  isBright ? 'text-slate-400 group-hover:text-blue-500' : 'text-slate-400 group-hover:text-blue-400'
                }`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
