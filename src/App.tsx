/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar, AppViewTab, MobileBottomNav } from './components/TopBar';
import { Database, Table as TableIcon, Code2 } from 'lucide-react';
import { SchemaSidebar } from './components/SchemaSidebar';
import { SqlEditor } from './components/SqlEditor';
import { ResultsViewer } from './components/ResultsViewer';
import { UploadModal } from './components/UploadModal';
import { TablePreviewModal } from './components/TablePreviewModal';
import { QueryHistoryModal } from './components/QueryHistoryModal';
import { DocsModal } from './components/DocsModal';
import { DataModeler } from './components/DataModeler';
import { SchemaDataComparator } from './components/SchemaDataComparator';
import { DuplicateChecker } from './components/DuplicateChecker';
import { VisualizerStudio } from './components/VisualizerStudio';
import { StarSchemaBuilder } from './components/StarSchemaBuilder';
import { DataMartStudio } from './components/DataMartStudio';
import { ForecastingStudio } from './components/ForecastingStudio';
import { TableSchema, QueryResult, QueryHistoryItem } from './types';
import {
  registerTable,
  executeQuery,
  extractEngineTables,
  dropTableFromEngine,
} from './utils/sqlEngine';
import { parseSheetData, sanitizeSqlIdentifier } from './utils/excelParser';
import { SAMPLE_DATASETS } from './utils/sampleData';
import { exportToExcel } from './utils/exportHelper';

export default function App() {
  const [activeView, setActiveView] = useState<AppViewTab>('studio');
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [query, setQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [comparatorInitialTables, setComparatorInitialTables] = useState<{ a?: string; b?: string }>({});
  const [visualizerInitialTable, setVisualizerInitialTable] = useState<string | undefined>(undefined);
  const [mobileStudioTab, setMobileStudioTab] = useState<'editor' | 'results' | 'schema'>('editor');

  // Split pane height for SQL Editor (in percentage)
  const [editorHeightPct, setEditorHeightPct] = useState<number>(36);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const mainWorkspaceRef = useRef<HTMLElement>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [previewTable, setPreviewTable] = useState<TableSchema | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [docsModal, setDocsModal] = useState<{
    isOpen: boolean;
    tab: 'docs' | 'syntax' | 'shortcuts';
  }>({ isOpen: false, tab: 'docs' });

  // Handle dragging vertical divider between SQL Editor and Results Grid
  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
  };

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainWorkspaceRef.current) return;
      const rect = mainWorkspaceRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const pct = (relativeY / rect.height) * 100;
      setEditorHeightPct(Math.min(75, Math.max(18, pct)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Load a sample dataset into AlaSQL and the React state
  const loadSampleDataset = useCallback((datasetId: string) => {
    const dataset = SAMPLE_DATASETS.find((d) => d.id === datasetId) || SAMPLE_DATASETS[0];
    const newSchemas: TableSchema[] = [];

    dataset.tables.forEach((tbl) => {
      // Register in AlaSQL engine
      registerTable(tbl.tableName, tbl.data);

      // Convert data to 2D array for schema analyzer (first row is header)
      const headers = Object.keys(tbl.data[0] || {});
      const rawMatrix: any[][] = [headers];
      tbl.data.forEach((row) => {
        rawMatrix.push(headers.map((h) => row[h]));
      });

      const parsed = parseSheetData(rawMatrix, tbl.tableName, `${dataset.title}.xlsx`, tbl.sheetName);
      newSchemas.push({
        ...parsed.schema,
        allRows: tbl.data,
      });
    });

    setTables(newSchemas);

    // Set starter query
    if (dataset.starterQueries.length > 0) {
      setQuery(dataset.starterQueries[0].sql);
    }
  }, []);

  // SQL schema starts empty on first load as requested, while keeping sample datasets available


  // Execute current SQL query
  const handleExecuteQuery = useCallback(() => {
    if (!query.trim()) return;

    setIsLoading(true);

    // Small delay to allow UI to render spinner before synchronous computation
    setTimeout(() => {
      const availableTableNames = tables.map((t) => t.name);
      const res = executeQuery(query, availableTableNames);
      setQueryResult(res);
      setIsLoading(false);

      // Record to history
      const historyItem: QueryHistoryItem = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        query: res.query,
        timestamp: res.timestamp,
        success: res.success,
        executionTimeMs: res.executionTimeMs,
        rowCount: res.rowCount,
        error: res.error,
      };
      setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);

      // Check if query created or modified any tables in AlaSQL catalog
      const refreshedSchemas = extractEngineTables(tables);
      if (refreshedSchemas.length !== tables.length) {
        setTables(refreshedSchemas);
      }
      setMobileStudioTab('results');
    }, 15);
  }, [query, tables]);

  // Execute query from Modeler or Comparator and switch back to SQL Studio
  const handleExecuteFromExternal = useCallback(
    (sql: string) => {
      setQuery(sql);
      setActiveView('studio');
      setIsLoading(true);

      setTimeout(() => {
        const availableTableNames = tables.map((t) => t.name);
        const res = executeQuery(sql, availableTableNames);
        setQueryResult(res);
        setIsLoading(false);

        const historyItem: QueryHistoryItem = {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          query: res.query,
          timestamp: res.timestamp,
          success: res.success,
          executionTimeMs: res.executionTimeMs,
          rowCount: res.rowCount,
          error: res.error,
        };
        setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
        setMobileStudioTab('results');
      }, 50);
    },
    [tables]
  );

  // Switch to Comparator from Modeler
  const handleOpenComparator = useCallback((tableA?: string, tableB?: string) => {
    setComparatorInitialTables({ a: tableA, b: tableB });
    setActiveView('comparator');
  }, []);

  // When files are uploaded
  const handleTablesLoaded = (
    newItems: { schema: TableSchema; rows: Record<string, any>[] }[]
  ) => {
    newItems.forEach((item) => {
      registerTable(item.schema.name, item.rows);
    });

    setTables((prev) => {
      // Replace existing table if same name or append
      const existingNames = new Set(newItems.map((n) => n.schema.name));
      const filtered = prev.filter((t) => !existingNames.has(t.name));
      return [
        ...filtered,
        ...newItems.map((n) => ({
          ...n.schema,
          allRows: n.rows,
        })),
      ];
    });

    if (newItems.length > 0) {
      const firstTbl = newItems[0].schema.name;
      const initialQuery = `SELECT * FROM ${firstTbl} LIMIT 50;`;
      setQuery(initialQuery);
      // Auto run first query
      setTimeout(() => {
        const res = executeQuery(initialQuery, [firstTbl]);
        setQueryResult(res);
      }, 50);
    }
  };

  // Quick query generation from schema sidebar
  const handleSelectTableQuery = (tableName: string) => {
    const sql = `SELECT * FROM ${tableName} LIMIT 50;`;
    setQuery(sql);
    setActiveView('studio');
    const res = executeQuery(sql, tables.map((t) => t.name));
    setQueryResult(res);
    setMobileStudioTab('results');
  };

  // Drop table from catalog
  const handleDropTable = (tableName: string) => {
    dropTableFromEngine(tableName);
    setTables((prev) => prev.filter((t) => t.name !== tableName));
    if (previewTable?.name === tableName) {
      setPreviewTable(null);
    }
  };

  // Export full table
  const handleExportTable = (table: TableSchema) => {
    // If table exists in alasql, get complete rows
    const tblData = (window as any).alasql?.tables?.[table.name]?.data || table.previewRows;
    exportToExcel(tblData, table.columns.map((c) => c.name), table.name);
  };

  // Save query output as new table
  const handleSaveAsTable = (tableName: string, data: Record<string, any>[]) => {
    const cleanName = sanitizeSqlIdentifier(tableName);
    registerTable(cleanName, data);

    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const arrayRows: any[][] = [headers];
    data.forEach((r) => {
      arrayRows.push(headers.map((h) => r[h]));
    });

    const parsed = parseSheetData(arrayRows, cleanName, 'Query Result', cleanName);
    setTables((prev) => {
      const filtered = prev.filter((t) => t.name !== cleanName);
      return [
        ...filtered,
        {
          ...parsed.schema,
          allRows: data,
        },
      ];
    });
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-screen overflow-hidden bg-[#070d1a] text-slate-100 font-sans">
      {/* 3-Zone Top Navigation Bar with View Switcher */}
      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenDocs={() => setDocsModal({ isOpen: true, tab: 'docs' })}
        onOpenSyntax={() => setDocsModal({ isOpen: true, tab: 'syntax' })}
        onOpenShortcuts={() => setDocsModal({ isOpen: true, tab: 'shortcuts' })}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Primary View Router with mobile bottom bar clearance */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative mb-[calc(3.5rem+max(env(safe-area-inset-bottom,0px),6px))] md:mb-0">
        {/* VIEW 1: SQL STUDIO (Sidebar + Editor + Results) */}
        {activeView === 'studio' && (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Mobile Segmented Sub-Navbar (only visible on mobile < md) */}
            <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-[#091224] border-b border-[#162544] shrink-0 text-xs">
              <div className="flex items-center gap-1 p-0.5 bg-[#060b17] rounded-lg border border-[#162544] w-full">
                <button
                  type="button"
                  onClick={() => setMobileStudioTab('editor')}
                  className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    mobileStudioTab === 'editor'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileStudioTab('results')}
                  className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    mobileStudioTab === 'results'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Results</span>
                  {queryResult && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-900/60 text-blue-200">
                      {queryResult.rowCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMobileStudioTab('schema')}
                  className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    mobileStudioTab === 'schema'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Tables ({tables.length})</span>
                </button>
              </div>
            </div>

            {/* Left: Interactive Schema Explorer (Desktop: side-by-side, Mobile: when tab is 'schema') */}
            <div className={`h-full ${mobileStudioTab === 'schema' ? 'flex flex-1' : 'hidden md:flex'}`}>
              <SchemaSidebar
                tables={tables}
                onSelectTableQuery={(tblName) => {
                  handleSelectTableQuery(tblName);
                  setMobileStudioTab('results');
                }}
                onPreviewTable={(tbl) => setPreviewTable(tbl)}
                onDropTable={handleDropTable}
                onExportTable={handleExportTable}
                onInsertField={(field) => {
                  setQuery((prev) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + field);
                  setMobileStudioTab('editor');
                }}
                onLoadSample={loadSampleDataset}
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenVisualizer={(tblName) => {
                  setVisualizerInitialTable(tblName);
                  setActiveView('visualizer');
                }}
              />
            </div>

            {/* Right Workspace: SQL Editor (top) + Tabbed Results/Visualizer (bottom) */}
            <main
              ref={mainWorkspaceRef}
              className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative ${
                mobileStudioTab === 'schema' ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Top Panel: SQL Compiler / Code Editor */}
              <div
                style={{ height: `${editorHeightPct}%` }}
                className={`min-h-[140px] flex flex-col shrink-0 overflow-hidden transition-[height] duration-75 ${
                  mobileStudioTab === 'editor' ? 'flex flex-1 md:flex-initial' : 'hidden md:flex'
                }`}
              >
                <SqlEditor
                  query={query}
                  onChange={setQuery}
                  onExecute={handleExecuteQuery}
                  isLoading={isLoading}
                  tables={tables}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                  historyCount={history.length}
                  lastResult={queryResult}
                  onDismissError={() => {
                    if (queryResult && !queryResult.success) {
                      setQueryResult(null);
                    }
                  }}
                />
              </div>

              {/* Draggable Divider with layout quick buttons (Desktop only) */}
              <div
                onMouseDown={handleMouseDownSplitter}
                className={`hidden md:flex h-2.5 bg-[#091224] hover:bg-blue-600/30 border-y border-[#182c54] items-center justify-center cursor-row-resize select-none transition-colors group shrink-0 relative z-20 ${
                  isDraggingSplitter ? 'bg-blue-600/40' : ''
                }`}
                title="Drag to resize SQL Editor and Results Grid"
              >
                <div className="w-12 h-1 rounded-full bg-slate-600 group-hover:bg-blue-400 transition" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition text-[10px] text-slate-400">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setEditorHeightPct(22)}
                    className={`px-1.5 py-0.5 rounded hover:text-white cursor-pointer ${
                      editorHeightPct <= 25 ? 'bg-blue-600 text-white font-semibold' : 'bg-[#0f1d3a]'
                    }`}
                    title="Expand Results Table (22% editor / 78% table)"
                  >
                    Max Table
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setEditorHeightPct(36)}
                    className={`px-1.5 py-0.5 rounded hover:text-white cursor-pointer ${
                      editorHeightPct > 25 && editorHeightPct < 50 ? 'bg-blue-600 text-white font-semibold' : 'bg-[#0f1d3a]'
                    }`}
                    title="Balanced Layout (36% editor / 64% table)"
                  >
                    Balanced
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setEditorHeightPct(55)}
                    className={`px-1.5 py-0.5 rounded hover:text-white cursor-pointer ${
                      editorHeightPct >= 50 ? 'bg-blue-600 text-white font-semibold' : 'bg-[#0f1d3a]'
                    }`}
                    title="Expand SQL Editor (55% editor / 45% table)"
                  >
                    Max Editor
                  </button>
                </div>
              </div>

              {/* Bottom Panel: Results Grid, Chart Visualizer, and Execution Plan */}
              <div
                className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
                  mobileStudioTab === 'results' ? 'flex' : 'hidden md:flex'
                }`}
              >
                <ResultsViewer
                  result={queryResult}
                  isLoading={isLoading}
                  onSaveAsTable={handleSaveAsTable}
                  tables={tables}
                  onInsertScriptIntoEditor={(sql) => {
                    setQuery(sql);
                    setMobileStudioTab('editor');
                  }}
                  onOpenVisualizer={() => setActiveView('visualizer')}
                />
              </div>
            </main>
          </div>
        )}

        {/* VIEW 2: DATA MODELER (Visual ERD & Drag-and-Drop Joins) */}
        {activeView === 'modeler' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <DataModeler
              tables={tables}
              onExecuteQuery={handleExecuteFromExternal}
              onOpenUploadModal={() => setIsUploadOpen(true)}
              onOpenComparator={handleOpenComparator}
              onTablesImported={handleTablesLoaded}
            />
          </div>
        )}

        {/* VIEW 3: SCHEMA & DATA COMPARATOR */}
        {activeView === 'comparator' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <SchemaDataComparator
              tables={tables}
              initialTableA={comparatorInitialTables.a}
              initialTableB={comparatorInitialTables.b}
              onExecuteQuery={handleExecuteFromExternal}
            />
          </div>
        )}

        {/* VIEW 4: DUPLICATE CHECKER */}
        {activeView === 'duplicates' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <DuplicateChecker
              tables={tables}
              onExecuteQuery={handleExecuteFromExternal}
              onSaveAsTable={handleSaveAsTable}
              onSwitchToStudio={() => setActiveView('studio')}
            />
          </div>
        )}

        {/* VIEW 5: DATA VISUALIZER STUDIO */}
        {activeView === 'visualizer' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <VisualizerStudio
              tables={tables}
              onExecuteQuery={handleExecuteFromExternal}
              onSaveAsTable={handleSaveAsTable}
              onSwitchToStudio={() => setActiveView('studio')}
              initialSelectedTable={visualizerInitialTable}
            />
          </div>
        )}

        {/* VIEW 6: CSV STAR SCHEMA & SCD BUILDER */}
        {activeView === 'bi_schema' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <StarSchemaBuilder
              tables={tables}
              onRegisterTablesToStudio={handleTablesLoaded}
              onSwitchToStudio={() => setActiveView('studio')}
              onOpenInSqlEditor={(sql) => {
                setQuery(sql);
                setActiveView('studio');
              }}
            />
          </div>
        )}

        {/* VIEW 7: DATA MART BI & ANALYTICAL CUBE BUILDER */}
        {activeView === 'data_mart' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <DataMartStudio
              tables={tables}
              onOpenInSqlEditor={(sql) => {
                setQuery(sql);
                setActiveView('studio');
              }}
              onSwitchToStudio={() => setActiveView('studio')}
              onSaveAsTable={handleSaveAsTable}
              onRegisterTables={handleTablesLoaded}
              onLoadSampleDataset={loadSampleDataset}
            />
          </div>
        )}

        {/* VIEW 8: TIME-SERIES FORECASTING STUDIO */}
        {activeView === 'forecasting' && (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <ForecastingStudio
              tables={tables}
              onOpenInSqlEditor={(sql) => {
                setQuery(sql);
                setActiveView('studio');
              }}
              onSwitchToStudio={() => setActiveView('studio')}
              onSaveAsTable={handleSaveAsTable}
              onRegisterTables={handleTablesLoaded}
              onLoadSampleDataset={loadSampleDataset}
            />
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTablesLoaded={handleTablesLoaded}
        onLoadSample={loadSampleDataset}
      />

      <TablePreviewModal
        table={previewTable}
        onClose={() => setPreviewTable(null)}
        onQueryTable={handleSelectTableQuery}
        onInsertIntoEditor={(sql) => setQuery(sql)}
        onCheckDuplicates={() => setActiveView('duplicates')}
        onOpenVisualizer={(tblName) => {
          setVisualizerInitialTable(tblName);
          setActiveView('visualizer');
        }}
      />

      <QueryHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectQuery={(sql) => setQuery(sql)}
        onClearHistory={() => setHistory([])}
      />

      <DocsModal
        isOpen={docsModal.isOpen}
        onClose={() => setDocsModal({ isOpen: false, tab: 'docs' })}
        defaultTab={docsModal.tab}
      />

      {/* Mobile Bottom Navigation Bar (< md) */}
      <MobileBottomNav
        activeView={activeView}
        onChangeView={setActiveView}
      />
    </div>
  );
}
