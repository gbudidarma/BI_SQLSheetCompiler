import React from 'react';
import { X, Clock, Play, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { QueryHistoryItem } from '../types';

interface QueryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: QueryHistoryItem[];
  onSelectQuery: (sql: string) => void;
  onClearHistory: () => void;
}

export const QueryHistoryModal: React.FC<QueryHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectQuery,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-[#0b1429] border border-[#1b315e] rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl shadow-blue-950/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#182c54] shrink-0 bg-[#080f20]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Query History</h2>
              <p className="text-xs text-slate-400">Review and reload previously executed queries</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List of queries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#070e1c]">
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No query history yet. Run a query in the editor to record it here.
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-[#0b162f] border border-[#182c54] hover:border-blue-500/60 rounded-xl transition flex flex-col gap-2 group"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    {item.success ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Success</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                    <span>·</span>
                    <span className="tabular-nums">{item.rowCount} rows</span>
                    <span>·</span>
                    <span className="tabular-nums">{item.executionTimeMs} ms</span>
                  </div>

                  <span className="text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="bg-[#050a14] p-2.5 rounded border border-[#162544] font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-24">
                  {item.query}
                </div>

                {item.error && (
                  <div className="text-[11px] text-rose-400 font-mono">
                    {item.error}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      onSelectQuery(item.query);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition cursor-pointer shadow-sm shadow-blue-900/40"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Load Query</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
