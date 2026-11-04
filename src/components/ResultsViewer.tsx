import React, { useState, useMemo } from 'react';
import {
  Table as TableIcon,
  BarChart2,
  PieChart,
  Cpu,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  PlusSquare,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  FileText,
  CornerDownRight,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpToLine,
  ArrowDownToLine,
  Lightbulb,
  AlertTriangle
} from 'lucide-react';
import { QueryResult, TableSchema } from '../types';
import { ChartVisualizer } from './ChartVisualizer';
import { exportToExcel, exportToCsv, copyAsJson, copyAsMarkdown } from '../utils/exportHelper';
import { InsertScriptModal } from './InsertScriptModal';
import { useTheme } from '../context/ThemeContext';

interface ResultsViewerProps {
  result: QueryResult | null;
  isLoading: boolean;
  onSaveAsTable: (tableName: string, data: Record<string, any>[]) => void;
  tables: TableSchema[];
  onInsertScriptIntoEditor?: (sql: string) => void;
  onOpenVisualizer?: () => void;
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({
  result,
  isLoading,
  onSaveAsTable,
  onInsertScriptIntoEditor,
  onOpenVisualizer,
}) => {
  const { isBright } = useTheme();
  const [activeTab, setActiveTab] = useState<'grid' | 'chart' | 'plan'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showInsertScriptModal, setShowInsertScriptModal] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Reset page when filter, sort, or result changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortCol, sortDir, result]);

  // Sorting handler
  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Filtered & sorted records
  const filteredData = useMemo(() => {
    if (!result?.data) return [];
    let items = [...result.data];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter((row) =>
        Object.values(row).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }

    if (sortCol) {
      items.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return items;
  }, [result?.data, searchTerm, sortCol, sortDir]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredData.length / pageSize));

  const displayedRows = useMemo(() => {
    if (pageSize === 'all') return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, pageSize, currentPage]);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setShowScrollTop(target.scrollTop > 120);
  };

  const handleCopy = async (type: 'json' | 'markdown') => {
    if (!result?.data) return;
    if (type === 'json') {
      const ok = await copyAsJson(result.data);
      if (ok) {
        setCopiedFormat('JSON');
        setTimeout(() => setCopiedFormat(null), 2000);
      }
    } else {
      const ok = await copyAsMarkdown(result.data, result.columns);
      if (ok) {
        setCopiedFormat('Markdown');
        setTimeout(() => setCopiedFormat(null), 2000);
      }
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !result?.data) return;
    onSaveAsTable(newTableName.trim(), result.data);
    setShowSaveModal(false);
    setNewTableName('');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-300">Compiling and executing query...</p>
        <span className="text-xs text-slate-500 font-mono mt-1">In-memory SQL processor</span>
      </div>
    );
  }

  // Error state
  if (result && !result.success) {
    return (
      <div className="flex-1 flex flex-col p-6 bg-[#070e1c] overflow-y-auto">
        <div className="bg-rose-950/50 border border-rose-700/60 rounded-xl p-6 max-w-3xl shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="p-1.5 rounded-lg bg-rose-900/80 border border-rose-600/70 text-rose-300 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-3.5 flex-1 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-200 uppercase tracking-wider text-[10px] bg-rose-950 border border-rose-600/80 px-2 py-0.5 rounded-full">
                    {result.errorCategory === 'syntax'
                      ? 'SQL Syntax Error'
                      : result.errorCategory === 'table_not_found'
                      ? 'Table Not Found'
                      : result.errorCategory === 'column_not_found'
                      ? 'Column Not Found'
                      : 'Query Compilation Error'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-rose-100 mt-1">
                  Query Execution Failed
                </h3>
                <p className="font-mono text-xs text-rose-200 mt-2 whitespace-pre-wrap bg-slate-950/80 p-3.5 rounded-lg border border-rose-900/50 leading-relaxed">
                  {result.error}
                </p>
              </div>

              {result.errorLocation && (result.errorLocation.line || result.errorLocation.column || result.errorLocation.token) && (
                <div className="text-xs text-slate-300 font-mono flex flex-wrap items-center gap-2 bg-[#091326] px-3 py-1.5 rounded-md border border-[#162544]">
                  <span className="text-slate-400">Error Location:</span>
                  {result.errorLocation.line && (
                    <span className="text-rose-300 font-semibold">Line {result.errorLocation.line}</span>
                  )}
                  {result.errorLocation.column && (
                    <span className="text-slate-300">Column {result.errorLocation.column}</span>
                  )}
                  {result.errorLocation.token && (
                    <span className="text-rose-200 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/60">
                      near &quot;{result.errorLocation.token}&quot;
                    </span>
                  )}
                </div>
              )}

              {result.suggestion && (
                <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-200">
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-300">Suggestion:</span>
                    <span>{result.suggestion}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-rose-900/40 pt-3 text-xs text-slate-400 space-y-1.5">
                <div className="font-medium text-slate-300">Diagnostic Tips:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Check table and column name spelling in the active Schema Explorer on the left.</li>
                  <li>Ensure table aliases are explicitly defined and matched (e.g., <code className="text-slate-300 font-mono">FROM customers AS c JOIN orders AS o ON c.cust_no = o.cust_no</code>).</li>
                  <li>If using AlaSQL reserved keywords as column names (e.g. <code className="text-slate-300 font-mono">total</code>, <code className="text-slate-300 font-mono">value</code>), wrap them in brackets like <code className="text-slate-300 font-mono">[total]</code>.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Initial Empty State
  if (!result) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors ${
        isBright ? 'bg-slate-50 text-slate-600' : 'bg-[#070e1c] text-slate-400'
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 border ${
          isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#0c162e] border-[#182c54]'
        }`}>
          <TableIcon className={`w-6 h-6 ${isBright ? 'text-slate-400' : 'text-slate-400'}`} />
        </div>
        <p className={`text-sm font-medium ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>
          No Query Executed Yet
        </p>
        <p className={`text-xs mt-1 max-w-sm text-center ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
          Write a SQL query in the editor above and click &quot;Run Query&quot; or press{' '}
          <kbd className={`px-1.5 py-0.5 rounded font-mono text-[10px] border ${
            isBright ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-[#101e3d] text-slate-200 border-[#1d335f]'
          }`}>
            Ctrl+Enter
          </kbd>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070e1c]">
      {/* Tab Header Bar & Status Bar */}
      <div className="flex flex-wrap items-center justify-between px-2.5 sm:px-4 py-2 bg-[#0b1429] border-b border-[#162544] gap-2 shrink-0">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-[#060b17] rounded-lg border border-[#162544] overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
              activeTab === 'grid'
                ? 'bg-[#132244] text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Results </span>Grid</span>
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
              activeTab === 'chart'
                ? 'bg-[#132244] text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Chart </span>Preview</span>
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer whitespace-nowrap ${
              activeTab === 'plan'
                ? 'bg-[#132244] text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span><span className="hidden sm:inline">Execution </span>Plan</span>
          </button>
        </div>

        {/* Execution Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono tabular-nums text-slate-200 font-medium">
              {result.rowCount} {result.rowCount === 1 ? 'row' : 'rows'}
            </span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="font-mono tabular-nums text-slate-400">
            {result.executionTimeMs} ms
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <div className="text-slate-400 hidden sm:inline">
            {result.columns.length} cols
          </div>
        </div>

        {/* Export & Save Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
          {/* Save as Table button */}
          {result.rowCount > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/60 rounded-md transition cursor-pointer whitespace-nowrap shrink-0"
              title="Save query output as a new queryable SQL table"
            >
              <PlusSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Save as Table</span>
              <span className="sm:hidden">Save</span>
            </button>
          )}

          {onOpenVisualizer && (
            <button
              onClick={onOpenVisualizer}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-pink-300 hover:text-pink-100 bg-pink-950/40 hover:bg-pink-900/60 border border-pink-800/60 rounded-md transition cursor-pointer whitespace-nowrap shrink-0"
              title="Open full Drag-and-Drop Visualizer Studio"
            >
              <PieChart className="w-3.5 h-3.5 text-pink-400" />
              <span className="hidden sm:inline">Visualizer Studio</span>
              <span className="sm:hidden">Visualize</span>
            </button>
          )}

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#091124] border border-[#182c54] p-0.5 rounded-md shrink-0">
            <button
              onClick={() => exportToExcel(result.data, result.columns)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Download as Excel .xlsx"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xs:inline">Excel</span>
            </button>

            <button
              onClick={() => setShowInsertScriptModal(true)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs text-amber-300 hover:text-amber-100 hover:bg-slate-800 rounded transition cursor-pointer"
              title="Generate and export SQL INSERT statements script from result"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Script</span>
            </button>

            <button
              onClick={() => exportToCsv(result.data, result.columns)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Download as CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden xs:inline">CSV</span>
            </button>

            <button
              onClick={() => handleCopy('json')}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Copy as JSON"
            >
              {copiedFormat === 'JSON' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden md:inline">JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* TAB 1: RESULTS GRID */}
        {activeTab === 'grid' && (
          <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
            {/* Search filter & pagination control bar */}
            <div className="px-4 py-2 bg-[#080f20] border-b border-[#162544] flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Left: Search filter */}
              <div className="relative w-64 max-w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter in results..."
                  className="w-full pl-8 pr-7 py-1 bg-[#0a142c] border border-[#1a2d54] rounded text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Right: Page sizing & Pagination controls */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="text-[11px]">Rows:</span>
                  <div className="flex items-center bg-[#060b17] border border-[#162544] rounded p-0.5">
                    {[25, 50, 100, 250, 'all'].map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setPageSize(size as any);
                          setCurrentPage(1);
                        }}
                        className={`px-2 py-0.5 text-[11px] rounded transition cursor-pointer font-mono ${
                          pageSize === size
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {size === 'all' ? 'All' : size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range summary & Pagination buttons */}
                {pageSize !== 'all' && totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-[#060b17] border border-[#162544] rounded p-0.5 text-slate-300">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1 hover:bg-[#122347] rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 hover:bg-[#122347] rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <span className="px-2 text-[11px] font-mono text-slate-300 select-none">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 hover:bg-[#122347] rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1 hover:bg-[#122347] rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Showing Range Count */}
                <div className="text-[11px] font-mono text-slate-400">
                  {filteredData.length === 0 ? (
                    '0 rows'
                  ) : pageSize === 'all' ? (
                    `All ${filteredData.length} rows`
                  ) : (
                    `Showing ${(currentPage - 1) * (pageSize as number) + 1}–${Math.min(
                      currentPage * (pageSize as number),
                      filteredData.length
                    )} of ${filteredData.length}`
                  )}
                </div>

                {/* Quick Scroll To Top / Bottom buttons */}
                <div className="flex items-center gap-1 border-l border-[#162544] pl-2 text-slate-400">
                  <button
                    onClick={() => tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="p-1 hover:text-white hover:bg-[#101e3d] rounded transition cursor-pointer"
                    title="Scroll to Top"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (tableContainerRef.current) {
                        tableContainerRef.current.scrollTo({
                          top: tableContainerRef.current.scrollHeight,
                          behavior: 'smooth',
                        });
                      }
                    }}
                    className="p-1 hover:text-white hover:bg-[#101e3d] rounded transition cursor-pointer"
                    title="Scroll to Bottom"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* High-density Tabular Grid with guaranteed vertical & horizontal scrolling */}
            <div
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              className="flex-1 min-h-0 overflow-auto w-full relative bg-[#070d1a]"
            >
              {filteredData.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                  {result.rowCount === 0 ? (
                    <div className="space-y-3 bg-[#0c162e]/90 border border-[#1b315e] rounded-xl p-5 text-slate-300 shadow-xl">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">Query Returned 0 Rows</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          The query executed cleanly in <span className="font-mono text-slate-200">{result.executionTimeMs} ms</span>, but 0 records matched the query criteria.
                        </p>
                      </div>
                      <div className="text-left bg-[#070e1c] p-3 rounded-lg border border-[#162544] text-[11px] space-y-1.5 text-slate-400">
                        <span className="font-medium text-slate-300 block">Common Reasons:</span>
                        <ul className="list-disc list-inside space-y-1">
                          <li><strong className="text-slate-300">WHERE Filters:</strong> String literals are case-sensitive. Check if values need exact casing.</li>
                          <li><strong className="text-slate-300">JOIN Keys:</strong> Verify that values in <code className="text-blue-300 font-mono">ON a.key = b.key</code> exist in both tables. If you want rows even without a match, try <code className="text-indigo-300 font-mono">LEFT JOIN</code>.</li>
                          <li><strong className="text-slate-300">Empty Source Table:</strong> Check row counts in the Schema Explorer on the left.</li>
                        </ul>
                      </div>
                      {result.plan?.tablesReferenced && result.plan.tablesReferenced.length > 0 && onInsertScriptIntoEditor && (
                        <button
                          onClick={() => onInsertScriptIntoEditor(`SELECT * FROM ${result.plan!.tablesReferenced[0]} LIMIT 20;`)}
                          className="px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/50 hover:bg-blue-900/60 border border-blue-800/60 rounded-md transition cursor-pointer"
                        >
                          View Sample Rows from `{result.plan.tablesReferenced[0]}`
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">No rows match the search query &quot;{searchTerm}&quot;.</div>
                  )}
                </div>
              ) : (
                <table className="w-full min-w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0d1832] sticky top-0 z-10 border-b border-[#182c54] shadow-sm">
                    <tr>
                      <th className="py-2.5 px-3 text-slate-500 font-mono text-[11px] w-12 text-right select-none border-r border-[#182c54]/80 sticky left-0 bg-[#0d1832] z-20">
                        #
                      </th>
                      {result.columns.map((col) => {
                        const isSorted = sortCol === col;
                        return (
                          <th
                            key={col}
                            onClick={() => handleSort(col)}
                            className="py-2.5 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer select-none transition group whitespace-nowrap border-r border-[#182c54]/60 last:border-r-0"
                          >
                            <div className="flex items-center gap-1.5 justify-between">
                              <span className="font-mono text-xs">{col}</span>
                              <div className="text-slate-500 group-hover:text-slate-300">
                                {isSorted ? (
                                  sortDir === 'asc' ? (
                                    <ArrowUp className="w-3 h-3 text-blue-400" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-blue-400" />
                                  )
                                ) : (
                                  <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                )}
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142342] bg-[#070d1a] font-mono text-xs">
                    {displayedRows.map((row, rIdx) => {
                      const rowNum = (pageSize === 'all' ? 0 : (currentPage - 1) * (pageSize as number)) + rIdx + 1;
                      return (
                        <tr
                          key={rowNum}
                          className="hover:bg-[#0f1d3a] transition-colors group"
                        >
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px] text-right select-none border-r border-[#142342] sticky left-0 bg-[#070d1a] group-hover:bg-[#0f1d3a] z-5">
                            {rowNum}
                          </td>
                          {result.columns.map((col) => {
                            const val = row[col];
                            const isNumber = typeof val === 'number';
                            const isNull = val === null || val === undefined;

                            return (
                              <td
                                key={col}
                                className={`py-2 px-3 border-r border-[#142342]/60 last:border-r-0 truncate max-w-xs ${
                                  isNumber
                                    ? 'text-right text-blue-300 tabular-nums'
                                    : isNull
                                    ? 'text-slate-500 italic text-[11px]'
                                    : 'text-slate-200'
                                }`}
                                title={String(val ?? '')}
                              >
                                {isNull ? (
                                  'null'
                                ) : isNumber ? (
                                  val.toLocaleString()
                                ) : typeof val === 'boolean' ? (
                                  val ? 'TRUE' : 'FALSE'
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
              )}

              {/* Floating Back to Top Button */}
              {showScrollTop && (
                <button
                  onClick={() => tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="fixed bottom-6 right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-black/60 border border-blue-400/40 text-xs font-medium cursor-pointer transition z-30"
                  title="Scroll to Top"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Top</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: VISUALIZER (CHARTS) */}
        {activeTab === 'chart' && (
          <div className="flex-1 overflow-hidden">
            <ChartVisualizer data={result.data} columns={result.columns} />
          </div>
        )}

        {/* TAB 3: EXECUTION PLAN & DIAGNOSTICS */}
        {activeTab === 'plan' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="max-w-4xl space-y-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Query Compiler & Plan Inspector</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed pipeline execution breakdown and relational operator topology.
                </p>
              </div>

              {/* AST Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Statement</div>
                  <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">
                    {result.plan?.statementType || 'SELECT'}
                  </div>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Tables Accessed</div>
                  <div className="text-sm font-bold text-indigo-300 font-mono mt-0.5 truncate">
                    {result.plan?.tablesReferenced.length ? result.plan.tablesReferenced.join(', ') : 'None'}
                  </div>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Execution Engine</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                    AlaSQL In-Memory
                  </div>
                </div>
                <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-lg">
                  <div className="text-[11px] text-slate-400 font-medium">Latency</div>
                  <div className="text-sm font-bold text-slate-100 font-mono tabular-nums mt-0.5">
                    {result.executionTimeMs} ms
                  </div>
                </div>
              </div>

              {/* Pipeline Stages */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Pipeline Execution Phases
                </div>

                <div className="space-y-2">
                  {result.plan?.steps.map((st) => (
                    <div
                      key={st.step}
                      className="flex items-start gap-3 p-3 bg-slate-950/60 rounded border border-slate-800/80 text-xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center font-mono text-[11px] text-indigo-300 font-bold shrink-0 mt-0.5">
                        {st.step}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{st.title}</span>
                          {st.costEstimate && (
                            <span className="font-mono text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/40">
                              Cost: {st.costEstimate}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px]">{st.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Result As Table Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c162e] border border-[#182c54] rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">
              Save Query Result as New Table
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter a name for the new table. It will be immediately registered in the SQL catalog for joining and querying.
            </p>

            <form onSubmit={handleSaveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Table Name (SQL Identifier)
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. q1_summary_metrics"
                  autoFocus
                  required
                  className="w-full px-3 py-2 bg-[#070e1c] border border-[#1b315e] rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#122347] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTableName.trim()}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  Create Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Insert Script Modal */}
      {showInsertScriptModal && result && (
        <InsertScriptModal
          isOpen={showInsertScriptModal}
          onClose={() => setShowInsertScriptModal(false)}
          data={result.data}
          columns={result.columns}
          defaultTableName={result.plan?.tablesReferenced[0] || 'query_result'}
          onInsertIntoEditor={onInsertScriptIntoEditor}
        />
      )}
    </div>
  );
};
