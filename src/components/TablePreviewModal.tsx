import React, { useState } from 'react';
import { X, Table as TableIcon, Download, Play, Hash, FileCode, FileSpreadsheet, CopyCheck, PieChart } from 'lucide-react';
import { TableSchema } from '../types';
import { exportToExcel, exportToCsv } from '../utils/exportHelper';
import { InsertScriptModal } from './InsertScriptModal';

interface TablePreviewModalProps {
  table: TableSchema | null;
  onClose: () => void;
  onQueryTable: (tableName: string) => void;
  onInsertIntoEditor?: (sql: string) => void;
  onCheckDuplicates?: (tableName: string) => void;
  onOpenVisualizer?: (tableName: string) => void;
}

export const TablePreviewModal: React.FC<TablePreviewModalProps> = ({
  table,
  onClose,
  onQueryTable,
  onInsertIntoEditor,
  onCheckDuplicates,
  onOpenVisualizer,
}) => {
  const [showInsertScriptModal, setShowInsertScriptModal] = useState(false);

  if (!table) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-[#0b1429] border border-[#1b315e] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-blue-950/50 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between p-3 sm:p-4 border-b border-[#182c54] shrink-0 bg-[#080f20] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <TableIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 font-mono">{table.name}</h2>
                <span className="text-[11px] font-mono text-slate-400 bg-[#060b17] border border-[#162544] px-2 py-0.5 rounded">
                  {table.rowCount} rows · {table.columns.length} columns
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Source: {table.sourceFileName} {table.sheetName ? `(Sheet: ${table.sheetName})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onQueryTable(table.name);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition cursor-pointer shadow-sm shadow-blue-900/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Query Table</span>
            </button>
            <button
              onClick={() => setShowInsertScriptModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-300 hover:text-amber-100 bg-amber-950/60 border border-amber-900/60 rounded-md transition cursor-pointer"
              title="Generate and export SQL INSERT statements / Excel"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Insert Script</span>
            </button>
            {onOpenVisualizer && (
              <button
                onClick={() => {
                  onOpenVisualizer(table.name);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-pink-300 hover:text-pink-100 bg-pink-950/50 border border-pink-900/50 rounded-md transition cursor-pointer"
                title="Open in Drag-and-Drop Visualizer Studio"
              >
                <PieChart className="w-3.5 h-3.5 text-pink-400" />
                <span>Visualize</span>
              </button>
            )}
            {onCheckDuplicates && (
              <button
                onClick={() => {
                  onCheckDuplicates(table.name);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-300 hover:text-amber-100 bg-amber-950/50 border border-amber-900/50 rounded-md transition cursor-pointer"
                title="Check Duplicate Data & Columns"
              >
                <CopyCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Check Dupes</span>
              </button>
            )}
            <button
              onClick={() => exportToExcel(table.previewRows, table.columns.map((c) => c.name), table.name)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-300 hover:text-emerald-100 bg-emerald-950/50 border border-emerald-900/50 rounded-md transition cursor-pointer"
              title="Download Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Column Specs Grid */}
        <div className="p-4 bg-[#070e1c] border-b border-[#182c54] shrink-0 overflow-x-auto">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Column Dictionary & Inferred Types
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {table.columns.map((col) => (
              <div
                key={col.name}
                className="bg-[#0b162f] border border-[#1b315e] rounded p-2 text-xs min-w-[140px] shrink-0"
              >
                <div className="font-mono font-medium text-slate-200 truncate" title={col.name}>
                  {col.name}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span className="font-mono text-blue-400 font-semibold">{col.type}</span>
                  <span>{col.nullCount > 0 ? `${col.nullCount} nulls` : '0 nulls'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Sample Preview Table */}
        <div className="flex-1 overflow-auto p-4 bg-[#050a14]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0b1429] sticky top-0 z-10 border-b border-[#182c54]">
              <tr>
                <th className="py-2 px-3 text-slate-500 font-mono text-[11px] w-10 text-right">#</th>
                {table.columns.map((col) => (
                  <th key={col.name} className="py-2 px-3 font-semibold text-slate-300 font-mono">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#162544]/60 font-mono">
              {table.previewRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#0b162f]/60 transition-colors">
                  <td className="py-1.5 px-3 text-slate-600 text-right">{idx + 1}</td>
                  {table.columns.map((col) => {
                    const val = row[col.name];
                    const isNumber = typeof val === 'number';
                    const isNull = val === null || val === undefined;
                    return (
                      <td
                        key={col.name}
                        className={`py-1.5 px-3 truncate max-w-xs ${
                          isNumber
                            ? 'text-right text-blue-300 tabular-nums'
                            : isNull
                            ? 'text-slate-600 italic'
                            : 'text-slate-300'
                        }`}
                      >
                        {isNull ? 'null' : isNumber ? val.toLocaleString() : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#080f20] border-t border-[#182c54] shrink-0 flex items-center justify-between text-xs text-slate-400">
          <span>Showing sample of {Math.min(50, table.previewRows.length)} rows</span>
          <button
            onClick={() => exportToCsv(table.previewRows, table.columns.map((c) => c.name), table.name)}
            className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
          >
            Download CSV representation
          </button>
        </div>
      </div>

      {/* Nested Insert Script modal */}
      <InsertScriptModal
        isOpen={showInsertScriptModal}
        onClose={() => setShowInsertScriptModal(false)}
        data={table.previewRows}
        columns={table.columns.map((c) => c.name)}
        defaultTableName={table.name}
        onInsertIntoEditor={onInsertIntoEditor}
      />
    </div>
  );
};
