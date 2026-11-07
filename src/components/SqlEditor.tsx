import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Wand2,
  RotateCcw,
  ChevronDown,
  BookOpen,
  Layers,
  Sparkles,
  Zap,
  ZapOff,
  Palette,
  AlertCircle,
  AlertTriangle,
  X,
  CornerDownRight,
  Lightbulb,
  Copy,
  Check,
  Wrench
} from 'lucide-react';
import { formatSql } from '../utils/sqlEngine';
import { QueryResult, TableSchema } from '../types';
import { getSuggestions, SqlSuggestion } from '../utils/sqlAutocomplete';
import { SqlAutocompletePopover } from './SqlAutocompletePopover';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface SqlEditorProps {
  query: string;
  onChange: (val: string) => void;
  onExecute: () => void;
  isLoading: boolean;
  tables: TableSchema[];
  onOpenHistory: () => void;
  historyCount: number;
  lastResult?: QueryResult | null;
  onDismissError?: () => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onChange,
  onExecute,
  isLoading,
  tables,
  onOpenHistory,
  historyCount,
  lastResult,
  onDismissError,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const editorBodyRef = useRef<HTMLDivElement>(null);

  const [showSnippets, setShowSnippets] = useState(false);
  const [showTablesHelper, setShowTablesHelper] = useState(false);
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true);
  const [syntaxColoringEnabled, setSyntaxColoringEnabled] = useState(true);

  // Error Alert State
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [lastDismissedTimestamp, setLastDismissedTimestamp] = useState<number | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [queryModifiedSinceExecution, setQueryModifiedSinceExecution] = useState(false);

  // Reset alert dismissed state whenever a new query execution result arrives
  useEffect(() => {
    if (lastResult?.timestamp && lastResult.timestamp !== lastDismissedTimestamp) {
      setIsAlertDismissed(false);
      setQueryModifiedSinceExecution(false);
    }
  }, [lastResult?.timestamp, lastDismissedTimestamp]);

  // Auto-suggest state
  const [suggestions, setSuggestions] = useState<SqlSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 40, left: 60 });
  const [activeTokenInfo, setActiveTokenInfo] = useState<{
    tokenStart: number;
    prefix: string;
    qualifier?: string;
  }>({ tokenStart: 0, prefix: '' });

  // Line numbers calculation
  const lineCount = Math.max(1, query.split('\n').length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Synchronize scroll between textarea, syntax highlighted pre-layer, and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
    }
  }, []);

  const { theme, isBright } = useTheme();

  // Extract table and column identifiers for VS Code coloring
  const tableNames = useMemo(() => tables.map((t) => t.name), [tables]);
  const columnNames = useMemo(
    () => tables.flatMap((t) => t.columns.map((c) => c.name)),
    [tables]
  );

  const highlightedCode = useMemo(
    () => highlightSql(query, tableNames, columnNames, theme),
    [query, tableNames, columnNames, theme]
  );

  // Calculate coordinates for caret in monospace textarea
  const calculateCaretCoordinates = useCallback((cursorPos: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 40, left: 60 };

    const textBefore = textarea.value.substring(0, cursorPos);
    const lines = textBefore.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentColIndex = lines[currentLineIndex].length;

    const lineHeight = 24; // leading-6 is 24px
    const charWidth = 7.8; // approximate character width for 13px JetBrains Mono
    const paddingLeft = 14;
    const paddingTop = 12;

    const top = paddingTop + (currentLineIndex + 1) * lineHeight - textarea.scrollTop;
    const left = paddingLeft + currentColIndex * charWidth - textarea.scrollLeft;

    // Bounds checking inside editor container
    const editorHeight = editorBodyRef.current?.clientHeight || 200;
    const editorWidth = editorBodyRef.current?.clientWidth || 600;

    const clampedTop = top + 200 > editorHeight ? Math.max(10, top - 210) : top;
    const clampedLeft = Math.min(Math.max(20, left + 36), Math.max(20, (editorWidth || window.innerWidth) - 270));

    return { top: clampedTop, left: clampedLeft };
  }, []);

  // Update suggestions based on cursor position
  const updateSuggestions = useCallback(
    (cursorPos: number, explicit = false) => {
      if (!autoSuggestEnabled && !explicit) {
        setPopoverVisible(false);
        return;
      }

      const res = getSuggestions(query, cursorPos, tables);
      if (res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
        setActiveIndex(0);
        setActiveTokenInfo({
          tokenStart: res.tokenStart,
          prefix: res.prefix,
          qualifier: res.qualifier,
        });
        const coords = calculateCaretCoordinates(cursorPos);
        setPopoverPos(coords);
        setPopoverVisible(true);
      } else {
        setPopoverVisible(false);
      }
    },
    [query, tables, autoSuggestEnabled, calculateCaretCoordinates]
  );

  // Handle accepting a suggestion
  const handleSelectSuggestion = useCallback(
    (suggestion: SqlSuggestion) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { tokenStart, prefix, qualifier } = activeTokenInfo;
      const currentVal = query;

      let replaceStart = tokenStart;
      let replaceLength = prefix.length;

      // If user had a qualifier like "o.cust", we replace after the dot
      if (qualifier) {
        replaceStart = tokenStart + qualifier.length + 1;
        replaceLength = prefix.length;
      }

      const before = currentVal.substring(0, replaceStart);
      const after = currentVal.substring(replaceStart + replaceLength);

      const nextVal = before + suggestion.insertText + after;
      onChange(nextVal);
      setPopoverVisible(false);

      // Reposition cursor
      const offset = suggestion.cursorOffset ?? 0;
      const nextCursor = before.length + suggestion.insertText.length + offset;

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = nextCursor;
        textarea.focus();
      }, 0);
    },
    [query, activeTokenInfo, onChange]
  );

  // Handle keyboard events (navigating suggestions or executing)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If popover is active, handle navigation & acceptance
    if (popoverVisible && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPopoverVisible(false);
        return;
      }
    }

    // Explicitly trigger auto-suggest on Ctrl+Space
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        updateSuggestions(textarea.selectionStart, true);
      }
      return;
    }

    // Ctrl+Enter or Cmd+Enter to execute query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setPopoverVisible(false);
      onExecute();
      return;
    }

    // Handle Tab key to insert 2 spaces if popover not visible
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;

      const nextVal = currentVal.substring(0, start) + '  ' + currentVal.substring(end);
      onChange(nextVal);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // On textarea change: update query and check suggestions
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(nextVal);
    setQueryModifiedSinceExecution(true);

    // Trigger auto-suggestions on typing
    setTimeout(() => {
      updateSuggestions(cursorPos);
    }, 10);
  };

  // Jump to specific error line or token in textarea
  const jumpToErrorLine = useCallback(
    (line?: number, col?: number, token?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const lines = query.split('\n');
      let targetIndex = 0;

      if (line && line > 0 && line <= lines.length) {
        for (let i = 0; i < line - 1; i++) {
          targetIndex += lines[i].length + 1; // +1 for newline
        }
        if (col && col > 0) {
          targetIndex += Math.min(col - 1, lines[line - 1].length);
        }
      } else if (token) {
        const idx = query.toLowerCase().indexOf(token.toLowerCase());
        if (idx !== -1) targetIndex = idx;
      }

      const selectionLen = token ? Math.max(1, token.length) : 1;
      textarea.focus();
      textarea.setSelectionRange(targetIndex, targetIndex + selectionLen);

      // Scroll to line
      const targetLine = line || 1;
      const lineHeight = 24;
      textarea.scrollTop = Math.max(0, (targetLine - 3) * lineHeight);
    },
    [query]
  );

  // Apply auto-fix suggestion
  const handleApplyFix = useCallback(
    (fix?: { from: string; to: string; description: string }) => {
      if (!fix) return;
      const regex = new RegExp(`\\b${fix.from}\\b`, 'i');
      if (regex.test(query)) {
        const updated = query.replace(regex, fix.to);
        onChange(updated);
      } else {
        const updated = query.replace(fix.from, fix.to);
        onChange(updated);
      }
      setIsAlertDismissed(true);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    [query, onChange]
  );

  // Copy error message to clipboard
  const handleCopyError = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedError(true);
    setTimeout(() => setCopiedError(false), 2000);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setPopoverVisible(false);
      setShowSnippets(false);
      setShowTablesHelper(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleFormat = () => {
    const formatted = formatSql(query);
    onChange(formatted);
    setPopoverVisible(false);
  };

  const handleClear = () => {
    onChange('');
    setPopoverVisible(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const insertSnippet = (snippetSql: string) => {
    onChange(snippetSql);
    setShowSnippets(false);
    setPopoverVisible(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const insertColumnOrTable = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    const nextVal = currentVal.substring(0, start) + text + currentVal.substring(end);
    onChange(nextVal);

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  };

  const handleInsertQuickToken = (token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(query + (query.endsWith(' ') || query.length === 0 ? '' : ' ') + token);
      return;
    }
    const start = textarea.selectionStart ?? query.length;
    const end = textarea.selectionEnd ?? query.length;
    const before = query.substring(0, start);
    const after = query.substring(end);
    const spacer = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n') && token !== ',' && token !== ';' ? ' ' : '';
    const newText = before + spacer + token + after;
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + spacer.length + token.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const snippets = [
    {
      name: 'Group Aggregation & Summary',
      sql: tables.length > 0
        ? `SELECT \n  ${tables[0].columns[0]?.name || 'category'},\n  COUNT(*) AS total_records,\n  ROUND(AVG(${tables[0].columns.find((c) => c.type === 'FLOAT' || c.type === 'INTEGER')?.name || 'value'}), 2) AS avg_value\nFROM ${tables[0].name}\nGROUP BY ${tables[0].columns[0]?.name || 'category'}\nORDER BY total_records DESC;`
        : `SELECT \n  category,\n  COUNT(*) AS total_items,\n  SUM(amount) AS total_sum\nFROM my_table\nGROUP BY category\nORDER BY total_sum DESC;`,
    },
    {
      name: 'Filter with WHERE & CASE WHEN',
      sql: tables.length > 0
        ? `SELECT \n  *,\n  CASE \n    WHEN ${tables[0].columns[0]?.name || 'id'} IS NOT NULL THEN 'Verified'\n    ELSE 'Unassigned'\n  END AS status_badge\nFROM ${tables[0].name}\nLIMIT 25;`
        : `SELECT \n  *,\n  CASE \n    WHEN score >= 80 THEN 'High'\n    WHEN score >= 50 THEN 'Medium'\n    ELSE 'Low'\n  END AS performance_tier\nFROM metrics\nLIMIT 25;`,
    },
    {
      name: 'Relational INNER JOIN',
      sql: tables.length >= 2
        ? `SELECT \n  t1.*,\n  t2.*\nFROM ${tables[0].name} AS t1\nINNER JOIN ${tables[1].name} AS t2 ON t1.${tables[0].columns[0]?.name || 'id'} = t2.${tables[1].columns[0]?.name || 'id'}\nLIMIT 50;`
        : `SELECT \n  orders.order_id,\n  customers.customer_name,\n  orders.total_amount\nFROM orders\nINNER JOIN customers ON orders.customer_id = customers.id;`,
    },
    {
      name: 'Save Query Result as New Table',
      sql: tables.length > 0
        ? `CREATE TABLE high_value_records AS\nSELECT * FROM ${tables[0].name}\nLIMIT 100;`
        : `CREATE TABLE summary_report AS\nSELECT category, SUM(amount) AS total\nFROM sales\nGROUP BY category;`,
    },
    {
      name: 'Distinct Values & Count',
      sql: tables.length > 0
        ? `SELECT DISTINCT \n  ${tables[0].columns[0]?.name || 'name'}\nFROM ${tables[0].name}\nORDER BY 1 ASC;`
        : `SELECT DISTINCT status FROM orders ORDER BY status ASC;`,
    },
    {
      name: 'Export Result to Excel (INTO XLSX)',
      sql: tables.length > 0
        ? `-- Execute query and trigger Excel export\nSELECT * INTO XLSX('query_export.xlsx', {headers:true})\nFROM ${tables[0].name}\nLIMIT 100;`
        : `SELECT * INTO XLSX('exported_data.xlsx', {headers:true})\nFROM sales_orders\nLIMIT 100;`,
    },
    {
      name: 'Insert Records Script',
      sql: tables.length > 0
        ? `INSERT INTO ${tables[0].name} (${tables[0].columns.slice(0, 3).map((c) => c.name).join(', ')})\nVALUES (${tables[0].columns.slice(0, 3).map((c) => c.type === 'INTEGER' ? '1' : c.type === 'FLOAT' ? '99.5' : `'sample'`).join(', ')});`
        : `INSERT INTO my_table (id, name, amount)\nVALUES (101, 'Premium Plan', 249.00);`,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#070e1c] border-b border-[#162544] relative">
      {/* Editor Header / Action Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0b1429] border-b border-[#162544] shrink-0 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Run Query Button */}
          <button
            onClick={onExecute}
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition shadow-sm whitespace-nowrap cursor-pointer"
            title="Execute SQL Query (Ctrl + Enter)"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Compiling…' : 'Run Query'}</span>
            <span className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-blue-700/60 rounded text-blue-100">
              Ctrl+↵
            </span>
          </button>

          {/* Auto-Suggest Toggle */}
          <button
            onClick={() => {
              setAutoSuggestEnabled(!autoSuggestEnabled);
              if (autoSuggestEnabled) setPopoverVisible(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
              autoSuggestEnabled
                ? isBright
                  ? 'text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300 shadow-xs'
                  : 'text-blue-300 bg-blue-950/70 border border-blue-800/60 hover:bg-blue-900/60'
                : isBright
                  ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300'
                  : 'text-slate-400 bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/50'
            }`}
            title="Toggle SQL Autocomplete & suggestions as you type (Ctrl + Space to trigger)"
          >
            {autoSuggestEnabled ? (
              <Zap className={`w-3.5 h-3.5 ${isBright ? 'text-blue-600' : 'text-blue-400'}`} />
            ) : (
              <ZapOff className={`w-3.5 h-3.5 ${isBright ? 'text-slate-400' : 'text-slate-500'}`} />
            )}
            <span className="hidden md:inline">
              Auto-Suggest: {autoSuggestEnabled ? 'ON' : 'OFF'}
            </span>
            <span className="md:hidden">Suggest</span>
          </button>

          {/* VS Code Syntax Coloring Toggle */}
          <button
            onClick={() => setSyntaxColoringEnabled(!syntaxColoringEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition whitespace-nowrap cursor-pointer ${
              syntaxColoringEnabled
                ? isBright
                  ? 'text-sky-800 bg-sky-100 hover:bg-sky-200 border border-sky-300 shadow-xs'
                  : 'text-sky-300 bg-sky-950/60 border border-sky-800/60 hover:bg-sky-900/60'
                : isBright
                  ? 'text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300'
                  : 'text-slate-400 bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/50'
            }`}
            title="Toggle VS Code Dark+ syntax highlighting colors"
          >
            <Palette className={`w-3.5 h-3.5 ${isBright ? 'text-sky-600' : 'text-sky-400'}`} />
            <span className="hidden lg:inline">VS Code Syntax</span>
          </button>

          {/* Format SQL */}
          <button
            onClick={handleFormat}
            disabled={!query.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/60 disabled:opacity-40 rounded-md transition whitespace-nowrap cursor-pointer"
            title="Prettify and format SQL statements"
          >
            <Wand2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Format</span>
          </button>

          {/* Snippets Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSnippets(!showSnippets)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/60 rounded-md transition whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Snippets</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showSnippets && (
              <div className="absolute left-0 mt-1 w-64 bg-[#0c162e] border border-[#1b315e] rounded-lg shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#182c54]/70">
                  Query Templates
                </div>
                {snippets.map((snip, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertSnippet(snip.sql)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-600 hover:text-white transition flex flex-col cursor-pointer"
                  >
                    <span className="font-medium">{snip.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Insert Column/Table Helper */}
          {tables.length > 0 && (
            <div className="relative hidden lg:block" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowTablesHelper(!showTablesHelper)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#0f1b36] hover:bg-[#14244a] border border-[#1b315e]/60 rounded-md transition whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Insert Field</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showTablesHelper && (
                <div className="absolute left-0 mt-1 w-72 max-h-72 overflow-y-auto bg-[#0c162e] border border-[#1b315e] rounded-lg shadow-2xl p-2 z-50 space-y-2">
                  {tables.map((tbl) => (
                    <div key={tbl.name} className="space-y-1">
                      <div
                        onClick={() => {
                          insertColumnOrTable(tbl.name);
                          setShowTablesHelper(false);
                        }}
                        className="text-[11px] font-semibold text-blue-300 hover:text-blue-100 cursor-pointer flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-[#122347]"
                      >
                        <span>{tbl.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">table</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pl-2">
                        {tbl.columns.map((col) => (
                          <button
                            key={col.name}
                            onClick={() => {
                              insertColumnOrTable(col.name);
                              setShowTablesHelper(false);
                            }}
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-[#080f20] hover:bg-blue-600 hover:text-white text-slate-300 rounded border border-[#182c54]"
                          >
                            {col.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Query History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-md transition cursor-pointer"
            title="View query history"
          >
            <ClockIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono bg-[#122347] text-blue-300 rounded-full border border-[#1b315e]">
                {historyCount}
              </span>
            )}
          </button>

          {/* Reset/Clear */}
          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-md transition cursor-pointer"
            title="Clear SQL Editor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ERROR ALERT BANNER: Prominently displayed when query execution fails */}
      {Boolean(lastResult && !lastResult.success && lastResult.error && !isAlertDismissed) && lastResult && (
        <div className="bg-gradient-to-r from-rose-950/95 via-[#1a0a14] to-[#0d1424] border-b border-rose-600/70 px-4 py-2.5 text-xs text-rose-100 shadow-xl relative z-20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="p-1 rounded-md bg-rose-900/90 border border-rose-500/70 shrink-0 mt-0.5 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-300 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-rose-200 uppercase tracking-wider text-[10px] bg-rose-950 border border-rose-600/80 px-2 py-0.5 rounded-full shadow-inner">
                    {lastResult.errorCategory === 'syntax'
                      ? 'SQL Syntax Error'
                      : lastResult.errorCategory === 'table_not_found'
                      ? 'Table Not Found'
                      : lastResult.errorCategory === 'column_not_found'
                      ? 'Column Not Found'
                      : 'Query Execution Error'}
                  </span>
                  {lastResult.errorLocation && (
                    <span className="font-mono text-[11px] text-rose-300 bg-black/50 px-2 py-0.5 rounded border border-rose-800/60">
                      {lastResult.errorLocation.line ? `Line ${lastResult.errorLocation.line}` : ''}
                      {lastResult.errorLocation.column ? ` : Col ${lastResult.errorLocation.column}` : ''}
                      {lastResult.errorLocation.token ? ` (near "${lastResult.errorLocation.token}")` : ''}
                    </span>
                  )}
                  {queryModifiedSinceExecution && (
                    <span className="text-[10px] text-amber-300/90 italic bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-700/50">
                      Query edited · Press Run Query to re-test
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-rose-100 font-semibold break-words leading-relaxed">
                  {lastResult.error}
                </div>
                {lastResult.suggestion && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-200/95 pt-0.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                    <span>{lastResult.suggestion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {lastResult.autoFix && (
                <button
                  type="button"
                  onClick={() => handleApplyFix(lastResult.autoFix)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 border border-emerald-500 rounded-md transition cursor-pointer shadow"
                  title={lastResult.autoFix.description}
                >
                  <Wrench className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Apply Fix</span>
                </button>
              )}

              {lastResult.errorLocation && (lastResult.errorLocation.line || lastResult.errorLocation.token) && (
                <button
                  type="button"
                  onClick={() =>
                    jumpToErrorLine(
                      lastResult.errorLocation?.line,
                      lastResult.errorLocation?.column,
                      lastResult.errorLocation?.token
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-200 hover:text-white bg-rose-900/70 hover:bg-rose-800 border border-rose-700/70 rounded-md transition cursor-pointer"
                  title="Place caret at error line and token"
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-rose-300" />
                  <span>Jump to Error</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyError(lastResult.error || '')}
                className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-900/80 rounded transition cursor-pointer"
                title="Copy error message to clipboard"
              >
                {copiedError ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAlertDismissed(true);
                  if (lastResult?.timestamp) setLastDismissedTimestamp(lastResult.timestamp);
                  if (onDismissError) onDismissError();
                }}
                className="p-1.5 text-rose-300 hover:text-rose-100 hover:bg-rose-900/80 rounded transition cursor-pointer"
                title="Dismiss error alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZERO ROWS NOTICE: Informs the user when a query succeeded but returned 0 rows */}
      {Boolean(
        lastResult &&
          lastResult.success &&
          lastResult.rowCount === 0 &&
          !lastResult.isCommand &&
          lastResult.warning &&
          !isAlertDismissed
      ) && lastResult && (
        <div className="bg-gradient-to-r from-amber-950/90 via-[#1c140a] to-[#0a1222] border-b border-amber-600/60 px-4 py-2 text-xs text-amber-100 shadow-md relative z-20 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1 rounded-md bg-amber-900/80 border border-amber-500/60 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] bg-amber-950 border border-amber-600/70 px-2 py-0.5 rounded-full">
                0 Rows Returned
              </span>
              <span className="text-amber-100/90 text-xs">
                Query executed successfully ({lastResult.executionTimeMs}ms), but returned 0 rows. Verify filter values (e.g. string casing) and JOIN conditions.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAlertDismissed(true);
              if (lastResult?.timestamp) setLastDismissedTimestamp(lastResult.timestamp);
            }}
            className="p-1 text-amber-300 hover:text-white hover:bg-amber-900/60 rounded transition cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Quick SQL Helper Toolbar (< md) */}
      <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-[#091124] border-b border-[#162544] overflow-x-auto no-scrollbar shrink-0 select-none">
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-500 shrink-0">
          SQL:
        </span>
        {['SELECT ', '* ', 'FROM ', 'WHERE ', 'LIMIT 50;', 'GROUP BY ', 'ORDER BY ', 'JOIN ', 'AND ', 'COUNT(*)', 'SUM()', 'AVG()', ', ', "'"].map((kw) => (
          <button
            key={kw}
            type="button"
            onClick={() => handleInsertQuickToken(kw)}
            className="px-2 py-1 text-[11px] font-mono font-semibold text-blue-300 bg-[#0f1b35] hover:bg-blue-600 hover:text-white border border-[#1b2f57] rounded-md shrink-0 active:scale-95 transition cursor-pointer shadow-xs"
          >
            {kw.trim() || kw}
          </button>
        ))}
        {tables.length > 0 && (
          <>
            <span className="text-slate-600 text-[10px] shrink-0">|</span>
            {tables.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => handleInsertQuickToken(t.name + ' ')}
                className="px-2 py-1 text-[11px] font-mono font-semibold text-emerald-300 bg-[#07191f] hover:bg-emerald-600 hover:text-white border border-[#103b42] rounded-md shrink-0 active:scale-95 transition cursor-pointer shadow-xs"
                title={`Insert table ${t.name}`}
              >
                {t.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Editor Body with Line Numbers and Caret-Anchored Autocomplete */}
      <div
        ref={editorBodyRef}
        className="relative flex-1 flex overflow-hidden min-h-[170px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Line Numbers Column with Error Line Highlighting */}
        <div
          ref={lineNumbersRef}
          className="w-8 sm:w-12 py-3 bg-[#060c18] text-right pr-1.5 sm:pr-3 font-mono text-[10px] sm:text-xs text-slate-500 select-none border-r border-[#162544] shrink-0 overflow-hidden leading-6"
        >
          {lineNumbers.map((num) => {
            const isErrorLine = Boolean(
              lastResult &&
                !lastResult.success &&
                !isAlertDismissed &&
                lastResult.errorLocation?.line === num
            );
            return (
              <div
                key={num}
                className={
                  isErrorLine
                    ? 'bg-rose-900/90 text-rose-200 font-bold -mr-3 pr-3 border-r-2 border-rose-500 shadow-inner'
                    : ''
                }
              >
                {num}
              </div>
            );
          })}
        </div>

        {/* Textarea & VS Code Syntax Highlight Layer */}
        <div className="relative flex-1 h-full overflow-hidden bg-[#070e1c]">
          {/* Layer 1: VS Code Dark+ Syntax Highlighted View */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none p-3 font-mono text-xs sm:text-sm leading-6 whitespace-pre overflow-hidden select-none m-0 border-0"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              tabSize: 2,
            }}
          >
            {syntaxColoringEnabled ? highlightedCode : query}
          </pre>

          {/* Layer 2: Transparent Interactive Textarea */}
          <textarea
            ref={textareaRef}
            value={query}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            onClick={() => {
              // On click inside textarea, check if cursor is on a word
              const textarea = textareaRef.current;
              if (textarea) {
                updateSuggestions(textarea.selectionStart);
              }
            }}
            placeholder="-- Write your SQL query here (e.g., SELECT * FROM sales_orders WHERE discount_pct > 0;)"
            spellCheck={false}
            className={`sql-editor-textarea absolute inset-0 w-full h-full p-3 font-mono text-xs sm:text-sm resize-none focus:outline-none leading-6 whitespace-pre overflow-auto ${
              isBright
                ? 'placeholder:text-slate-400 selection:bg-blue-200 selection:text-transparent'
                : 'placeholder:text-slate-500 selection:bg-blue-600/35 selection:text-transparent'
            } ${
              syntaxColoringEnabled
                ? isBright
                  ? 'bg-transparent text-transparent caret-blue-600'
                  : 'bg-transparent text-transparent caret-blue-400'
                : isBright
                ? 'bg-transparent text-slate-900'
                : 'bg-transparent text-slate-100'
            }`}
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              tabSize: 2,
            }}
          />

          {/* Floating Auto-Suggest Popover */}
          <SqlAutocompletePopover
            suggestions={suggestions}
            activeIndex={activeIndex}
            onSelect={handleSelectSuggestion}
            position={popoverPos}
            visible={popoverVisible}
          />
        </div>
      </div>
    </div>
  );
};

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <polyline points="12 6 12 12 16 14" strokeWidth="2" />
  </svg>
);
