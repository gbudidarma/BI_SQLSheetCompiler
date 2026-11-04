import React, { useState, useMemo } from 'react';
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Play,
  FileSpreadsheet,
  Settings2,
  FileDown
} from 'lucide-react';
import {
  generateInsertScript,
  downloadSqlScript,
  exportToExcel,
  exportExcelWithScript,
  InsertScriptOptions
} from '../utils/exportHelper';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface InsertScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, any>[];
  columns: string[];
  defaultTableName?: string;
  onInsertIntoEditor?: (sql: string) => void;
}

export const InsertScriptModal: React.FC<InsertScriptModalProps> = ({
  isOpen,
  onClose,
  data,
  columns,
  defaultTableName = 'exported_table',
  onInsertIntoEditor,
}) => {
  const { theme } = useTheme();
  const [tableName, setTableName] = useState(defaultTableName);
  const [includeCreateTable, setIncludeCreateTable] = useState(true);
  const [format, setFormat] = useState<'multi-row' | 'single-row'>('multi-row');
  const [batchSize, setBatchSize] = useState(50);
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Synchronize default table name
  React.useEffect(() => {
    if (defaultTableName) {
      setTableName(defaultTableName);
    }
  }, [defaultTableName]);

  // Generate SQL script dynamically based on settings
  const sqlScript = useMemo(() => {
    const opts: InsertScriptOptions = {
      tableName: tableName.trim() || 'exported_table',
      includeCreateTable,
      format,
      batchSize,
    };
    return generateInsertScript(data, columns, opts);
  }, [data, columns, tableName, includeCreateTable, format, batchSize]);

  const highlightedScript = useMemo(() => {
    // Only highlight preview if under 120KB to keep UI snappy
    if (sqlScript.length > 120000) {
      return sqlScript;
    }
    return highlightSql(sqlScript, [tableName], columns, theme);
  }, [sqlScript, tableName, columns, theme]);

  const scriptLines = useMemo(() => sqlScript.split('\n'), [sqlScript]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SQL script:', err);
    }
  };

  const getCleanName = () => {
    return tableName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'insert_script';
  };

  const handleDownloadSql = () => {
    downloadSqlScript(sqlScript, getCleanName());
    setDownloadSuccess('SQL file downloaded!');
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  const handleExportStandardExcel = () => {
    exportToExcel(data, columns, `${getCleanName()}_data`);
    setDownloadSuccess('Excel (.xlsx) downloaded!');
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  const handleExportExcelWithScript = () => {
    exportExcelWithScript(data, columns, sqlScript, `${getCleanName()}_with_script`);
    setDownloadSuccess('Excel with Script sheet downloaded!');
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  const handleInsertIntoEditor = () => {
    if (onInsertIntoEditor) {
      onInsertIntoEditor(sqlScript);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-[#0b1429] border border-[#1b315e] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl shadow-blue-950/50 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between p-3 sm:p-4 border-b border-[#182c54] shrink-0 bg-[#080f20] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-700/60 flex items-center justify-center text-amber-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">SQL Insert Script & Excel Export</h2>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-900/60 px-2 py-0.5 rounded">
                  {data.length} records · {columns.length} columns
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate DDL and INSERT statements, or export directly to Excel with the script included
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Toolbar */}
        <div className="p-3.5 bg-[#070e1c] border-b border-[#182c54] shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Table Name */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Target Table:</span>
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="table_name"
                className="px-2 py-1 bg-[#0b162f] border border-[#1b315e] rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 w-36"
              />
            </div>

            {/* CREATE TABLE Toggle */}
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeCreateTable}
                onChange={(e) => setIncludeCreateTable(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#1b315e] text-blue-600 focus:ring-0 bg-[#0b162f] cursor-pointer"
              />
              <span>Include CREATE TABLE DDL</span>
            </label>

            {/* Format Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Format:</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="bg-[#0b162f] border border-[#1b315e] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="multi-row">Multi-row (Batched)</option>
                <option value="single-row">Single Statements</option>
              </select>
            </div>

            {/* Batch Size (if multi-row) */}
            {format === 'multi-row' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Batch:</span>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="bg-[#0b162f] border border-[#1b315e] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={25}>25 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={500}>500 rows</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {downloadSuccess && (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                <Check className="w-3 h-3" />
                {downloadSuccess}
              </span>
            )}
            <div className="text-[11px] text-slate-400 font-mono">
              {scriptLines.length} lines · {(sqlScript.length / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>

        {/* Live SQL Preview Box */}
        <div className="flex-1 flex overflow-hidden bg-[#050a14] font-mono text-xs">
          {/* Line Numbers */}
          <div className="w-12 py-3 bg-[#060b17] text-right pr-3 text-slate-500 select-none border-r border-[#162544] shrink-0 overflow-hidden leading-5">
            {scriptLines.slice(0, 1000).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Script Content */}
          <div className="flex-1 overflow-auto p-3 text-slate-200 leading-5 whitespace-pre font-mono">
            {highlightedScript}
          </div>
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-3.5 bg-[#091224] border-t border-[#182c54] shrink-0 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Excel Export options */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Excel + Script option */}
            <button
              onClick={handleExportExcelWithScript}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:text-white bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-lg transition cursor-pointer shadow-sm"
              title="Download Excel workbook containing both Result Data sheet and SQL Insert Script sheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel (Data + Script)</span>
            </button>

            {/* Standard Data Excel */}
            <button
              onClick={handleExportStandardExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0f1c38] hover:bg-[#14264d] border border-[#1b315e] rounded-lg transition cursor-pointer"
              title="Download results data as clean Excel (.xlsx)"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Standard Excel</span>
            </button>
          </div>

          {/* Right: Script actions */}
          <div className="flex items-center gap-2">
            {/* Copy Script */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0f1c38] hover:bg-[#14264d] border border-[#1b315e] rounded-lg transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy SQL</span>
                </>
              )}
            </button>

            {/* Download .sql file */}
            <button
              onClick={handleDownloadSql}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-[#0f1c38] hover:bg-[#14264d] border border-[#1b315e] rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Download .sql</span>
            </button>

            {/* Insert into SQL Editor */}
            {onInsertIntoEditor && (
              <button
                onClick={handleInsertIntoEditor}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-sm cursor-pointer shadow-blue-900/40"
                title="Inject this SQL script into the query editor"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Insert into SQL Editor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
