import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  RefreshCw,
  GitBranch,
  Wand2,
  Play,
  Copy,
  Check,
  UploadCloud,
  FileSpreadsheet,
  GitCompare,
  Move,
  ChevronDown,
  ChevronUp,
  Link2,
  X,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  SlidersHorizontal,
  Info,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  TableSchema,
  TableNodePos,
  JoinRelationship,
  JoinType,
  JoinOperator,
  ModelFilter,
  ModelOrderBy
} from '../types';
import { generateSqlFromModel, autoDetectJoins } from '../utils/sqlModelGenerator';
import { highlightSql } from '../utils/sqlHighlighter';
import { parseExcelFile } from '../utils/excelParser';
import { useTheme } from '../context/ThemeContext';

interface DataModelerProps {
  tables: TableSchema[];
  onExecuteQuery: (sql: string) => void;
  onOpenUploadModal: () => void;
  onOpenComparator: (tableA?: string, tableB?: string) => void;
  onTablesImported: (items: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
}

export const DataModeler: React.FC<DataModelerProps> = ({
  tables,
  onExecuteQuery,
  onOpenUploadModal,
  onOpenComparator,
  onTablesImported,
}) => {
  const { theme } = useTheme();

  // Canvas table node positions
  const [nodes, setNodes] = useState<TableNodePos[]>(() => {
    // Initial arrangement of loaded tables
    return tables.map((t, idx) => ({
      tableName: t.name,
      x: 60 + (idx % 3) * 320,
      y: 60 + Math.floor(idx / 3) * 380,
      selectedColumns: t.columns.map((c) => c.name),
      isCollapsed: false,
    }));
  });

  // Synced join relationships between tables
  const [joins, setJoins] = useState<JoinRelationship[]>(() => {
    return autoDetectJoins(tables);
  });

  // Active filters and order by
  const [filters, setFilters] = useState<ModelFilter[]>([]);
  const [orderBy, setOrderBy] = useState<ModelOrderBy[]>([]);
  const [queryLimit, setQueryLimit] = useState<number>(50);

  // Dragging state for moving table cards
  const [draggingNode, setDraggingNode] = useState<{
    tableName: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Dragging state for drawing join wires from port to port
  const [draggingWire, setDraggingWire] = useState<{
    sourceTable: string;
    sourceColumn: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Active Join Popover modal
  const [activeJoinPopover, setActiveJoinPopover] = useState<{
    joinId: string;
    x: number;
    y: number;
  } | null>(null);

  // UI state
  const [showSqlDrawer, setShowSqlDrawer] = useState<boolean>(true);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showAddTableMenu, setShowAddTableMenu] = useState<boolean>(false);
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  const canvasRef = useRef<HTMLDivElement>(null);

  // Keep node list synced when tables list changes (e.g. from upload or sample load)
  useEffect(() => {
    setNodes((prev) => {
      const existingNames = new Set(prev.map((n) => n.tableName));
      const newNodes = [...prev];

      tables.forEach((t, idx) => {
        if (!existingNames.has(t.name)) {
          const colIdx = newNodes.length % 3;
          const rowIdx = Math.floor(newNodes.length / 3);
          newNodes.push({
            tableName: t.name,
            x: 60 + colIdx * 320,
            y: 60 + rowIdx * 380,
            selectedColumns: t.columns.map((c) => c.name),
            isCollapsed: false,
          });
        }
      });

      return newNodes;
    });
  }, [tables]);

  // Clean up joins if a table was removed
  useEffect(() => {
    const tableNames = new Set(tables.map((t) => t.name));
    setJoins((prev) =>
      prev.filter((j) => tableNames.has(j.sourceTable) && tableNames.has(j.targetTable))
    );
  }, [tables]);

  // Auto-generate SQL from current model state
  const generatedSql = useMemo(() => {
    const activeNodes = nodes.filter((n) => tables.some((t) => t.name === n.tableName));
    return generateSqlFromModel({
      tables,
      nodes: activeNodes,
      joins,
      filters,
      orderBy,
      limit: queryLimit,
    });
  }, [tables, nodes, joins, filters, orderBy, queryLimit]);

  // Handle Dragging Table Cards
  const handleNodeMouseDown = (tableName: string, e: React.MouseEvent) => {
    // Only drag from header, ignore buttons
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.port-socket')) {
      return;
    }
    const node = nodes.find((n) => n.tableName === tableName);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoomLevel;
    const mouseY = (e.clientY - rect.top) / zoomLevel;

    setDraggingNode({
      tableName,
      offsetX: mouseX - node.x,
      offsetY: mouseY - node.y,
    });
  };

  // Handle Starting Wire Drag from Column Port
  const handlePortMouseDown = (
    tableName: string,
    columnName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / zoomLevel;
    const startY = (e.clientY - rect.top) / zoomLevel;

    setDraggingWire({
      sourceTable: tableName,
      sourceColumn: columnName,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  // Handle Mouse Move across canvas
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) / zoomLevel;
      const currentY = (e.clientY - rect.top) / zoomLevel;

      if (draggingNode) {
        setNodes((prev) =>
          prev.map((n) =>
            n.tableName === draggingNode.tableName
              ? {
                  ...n,
                  x: Math.max(20, currentX - draggingNode.offsetX),
                  y: Math.max(20, currentY - draggingNode.offsetY),
                }
              : n
          )
        );
      } else if (draggingWire) {
        setDraggingWire((prev) => (prev ? { ...prev, currentX, currentY } : null));
      }
    },
    [draggingNode, draggingWire, zoomLevel]
  );

  // Handle Mouse Up (Completing wire or node drag)
  const handleCanvasMouseUp = useCallback(() => {
    if (draggingNode) {
      setDraggingNode(null);
    }
    if (draggingWire) {
      // Wire dropped in open canvas without target
      setDraggingWire(null);
    }
  }, [draggingNode, draggingWire]);

  // Touch Support for Mobile Dragging
  const handleNodeTouchStart = (tableName: string, e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.port-socket')) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    const node = nodes.find((n) => n.tableName === tableName);
    if (!node || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const touchX = (touch.clientX - rect.left) / zoomLevel;
    const touchY = (touch.clientY - rect.top) / zoomLevel;

    setDraggingNode({
      tableName,
      offsetX: touchX - node.x,
      offsetY: touchY - node.y,
    });
  };

  const handleCanvasTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!canvasRef.current || !draggingNode) return;
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = (touch.clientX - rect.left) / zoomLevel;
      const currentY = (touch.clientY - rect.top) / zoomLevel;

      setNodes((prev) =>
        prev.map((n) =>
          n.tableName === draggingNode.tableName
            ? {
                ...n,
                x: Math.max(20, currentX - draggingNode.offsetX),
                y: Math.max(20, currentY - draggingNode.offsetY),
              }
            : n
        )
      );
    },
    [draggingNode, zoomLevel]
  );

  // Complete Wire Drop on Target Column Port
  const handlePortMouseUp = (targetTable: string, targetColumn: string) => {
    if (!draggingWire) return;

    // Prevent connecting to the exact same column on the same table
    if (
      draggingWire.sourceTable === targetTable &&
      draggingWire.sourceColumn === targetColumn
    ) {
      setDraggingWire(null);
      return;
    }

    // Check if relationship already exists
    const exists = joins.some(
      (j) =>
        (j.sourceTable === draggingWire.sourceTable &&
          j.sourceColumn === draggingWire.sourceColumn &&
          j.targetTable === targetTable &&
          j.targetColumn === targetColumn) ||
        (j.sourceTable === targetTable &&
          j.sourceColumn === targetColumn &&
          j.targetTable === draggingWire.sourceTable &&
          j.targetColumn === draggingWire.sourceColumn)
    );

    if (!exists) {
      const newJoin: JoinRelationship = {
        id: `join_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceTable: draggingWire.sourceTable,
        sourceColumn: draggingWire.sourceColumn,
        targetTable,
        targetColumn,
        joinType: 'LEFT JOIN',
        operator: '=',
      };
      setJoins((prev) => [...prev, newJoin]);
    }

    setDraggingWire(null);
  };

  // Toggle column selection in query projection
  const toggleColumnSelection = (tableName: string, colName: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.tableName !== tableName) return n;
        const exists = n.selectedColumns.includes(colName);
        return {
          ...n,
          selectedColumns: exists
            ? n.selectedColumns.filter((c) => c !== colName)
            : [...n.selectedColumns, colName],
        };
      })
    );
  };

  // Select / Deselect all columns for a table
  const selectAllColumns = (tableName: string, selectAll: boolean) => {
    const schema = tables.find((t) => t.name === tableName);
    if (!schema) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.tableName === tableName
          ? {
              ...n,
              selectedColumns: selectAll ? schema.columns.map((c) => c.name) : [],
            }
          : n
      )
    );
  };

  // Remove table from canvas
  const handleRemoveNode = (tableName: string) => {
    setNodes((prev) => prev.filter((n) => n.tableName !== tableName));
    setJoins((prev) =>
      prev.filter((j) => j.sourceTable !== tableName && j.targetTable !== tableName)
    );
  };

  // Auto-arrange tables in clean grid layout
  const handleAutoArrange = () => {
    setNodes((prev) =>
      prev.map((n, idx) => ({
        ...n,
        x: 60 + (idx % 3) * 340,
        y: 60 + Math.floor(idx / 3) * 400,
      }))
    );
  };

  // Auto-detect joins between tables
  const handleAutoDetect = () => {
    const detected = autoDetectJoins(tables);
    setJoins(detected);
  };

  // Copy generated SQL
  const handleCopySql = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Drag-and-drop Excel file directly onto canvas
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find((f) =>
      /\.(xlsx|xls|csv)$/i.test(f.name)
    );

    if (excelFile) {
      try {
        const parsed = await parseExcelFile(excelFile);
        onTablesImported(parsed);
      } catch (err) {
        console.error('Failed to parse dropped Excel file:', err);
      }
    }
  };

  // Calculate coordinates for join lines between tables
  const joinLineCoords = useMemo(() => {
    return joins.map((j) => {
      const srcNode = nodes.find((n) => n.tableName === j.sourceTable);
      const tgtNode = nodes.find((n) => n.tableName === j.targetTable);
      const srcTable = tables.find((t) => t.name === j.sourceTable);
      const tgtTable = tables.find((t) => t.name === j.targetTable);

      if (!srcNode || !tgtNode || !srcTable || !tgtTable) return null;

      const srcColIdx = srcTable.columns.findIndex((c) => c.name === j.sourceColumn);
      const tgtColIdx = tgtTable.columns.findIndex((c) => c.name === j.targetColumn);

      // Estimated card widths and heights
      const cardWidth = 280;
      const headerHeight = 75;
      const rowHeight = 32;

      // Determine which sides to connect based on relative horizontal positions
      const isSrcLeft = srcNode.x < tgtNode.x;
      const x1 = isSrcLeft ? srcNode.x + cardWidth : srcNode.x;
      const y1 = srcNode.y + headerHeight + Math.max(0, srcColIdx) * rowHeight + 16;

      const x2 = isSrcLeft ? tgtNode.x : tgtNode.x + cardWidth;
      const y2 = tgtNode.y + headerHeight + Math.max(0, tgtColIdx) * rowHeight + 16;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      return {
        join: j,
        x1,
        y1,
        x2,
        y2,
        midX,
        midY,
      };
    }).filter(Boolean);
  }, [joins, nodes, tables]);

  return (
    <div
      className="flex flex-col h-full w-full bg-[#070e1c] text-slate-100 overflow-hidden relative select-none"
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      {/* Modeler Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 bg-[#0b1429] border-b border-[#182c54] shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              Visual Data Modeler
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-400 bg-[#122347] px-2 py-0.5 rounded border border-[#1b315e] hidden xs:inline">
                ERD Builder
              </span>
            </h2>
            <p className="text-xs text-slate-400 hidden sm:block">
              Drag relationship joins between columns to visualize schemas and auto-generate SQL.
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar max-w-full">
          {/* Add Table Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowAddTableMenu(!showAddTableMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-slate-200 rounded-lg transition cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Add Table</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showAddTableMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-60 bg-[#0c162e] border border-[#182c54] rounded-xl shadow-2xl p-2 z-50 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1">
                  Catalog Tables:
                </div>
                {tables.map((t) => {
                  const onCanvas = nodes.some((n) => n.tableName === t.name);
                  return (
                    <button
                      key={t.name}
                      onClick={() => {
                        if (!onCanvas) {
                          setNodes((prev) => [
                            ...prev,
                            {
                              tableName: t.name,
                              x: 100 + (prev.length % 3) * 300,
                              y: 100 + Math.floor(prev.length / 3) * 350,
                              selectedColumns: t.columns.map((c) => c.name),
                            },
                          ]);
                        }
                        setShowAddTableMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                        onCanvas
                          ? 'text-slate-500 bg-[#070e1c] opacity-60 cursor-not-allowed'
                          : 'text-slate-200 hover:bg-[#132448] hover:text-white'
                      }`}
                      disabled={onCanvas}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {onCanvas ? 'Added' : `+ Add`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Import Excel Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-slate-200 rounded-lg transition cursor-pointer font-medium"
            title="Import Excel or spreadsheet file with multiple sheets"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Excel</span>
          </button>

          {/* Auto-Detect Joins Button */}
          <button
            onClick={handleAutoDetect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-slate-200 rounded-lg transition cursor-pointer font-medium"
            title="Automatically detect foreign keys and matching column names"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-Detect Joins</span>
          </button>

          {/* Auto-Arrange Layout */}
          <button
            onClick={handleAutoArrange}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-slate-200 rounded-lg transition cursor-pointer font-medium"
            title="Organize table cards in a neat grid"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Auto-Arrange</span>
          </button>

          {/* Canvas Zoom In & Zoom Out Controls */}
          <div className="flex items-center bg-[#0e1b38] border border-[#1e3668] rounded-lg p-0.5 shadow-xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              disabled={zoomLevel <= 0.4}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-[#182c54] disabled:opacity-40 rounded transition cursor-pointer"
              title="Zoom Out (Ctrl + Scroll Down)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-2 py-1 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-[#182c54] rounded transition cursor-pointer min-w-[46px] text-center"
              title="Click to Reset Zoom to 100%"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              disabled={zoomLevel >= 2.0}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-[#182c54] disabled:opacity-40 rounded transition cursor-pointer"
              title="Zoom In (Ctrl + Scroll Up)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Compare Schemas / Data Button */}
          <button
            onClick={() => onOpenComparator(tables[0]?.name, tables[1]?.name)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 rounded-lg transition cursor-pointer font-medium"
            title="Compare differences between sheets and schemas"
          >
            <GitCompare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Compare Sheets</span>
          </button>

          {/* Toggle SQL Drawer */}
          <button
            onClick={() => setShowSqlDrawer(!showSqlDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition cursor-pointer font-semibold ${
              showSqlDrawer
                ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                : 'bg-[#0e1b38] border-[#1e3668] text-slate-300 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{showSqlDrawer ? 'Hide SQL' : 'View SQL'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Interactive ERD Canvas + Bottom SQL Drawer */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto cursor-crosshair min-h-[300px]"
          style={{
            backgroundImage: `radial-gradient(#182c54 1.2px, transparent 1.2px)`,
            backgroundSize: `${24 * zoomLevel}px ${24 * zoomLevel}px`,
            backgroundColor: '#070e1c',
          }}
          onMouseDown={() => setActiveJoinPopover(null)}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasMouseUp}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.1 : -0.1;
              setZoomLevel((z) => Math.min(2.0, Math.max(0.4, Number((z + delta).toFixed(2)))));
            }
          }}
        >
          {/* Zoom and Navigation Widget (Positioned safely above MobileBottomNav on small screens) */}
          <div className="absolute bottom-20 sm:bottom-6 left-4 sm:left-6 z-20 flex items-center gap-1 bg-[#0c162e]/95 backdrop-blur-md border border-[#182c54] rounded-lg p-1 text-xs shadow-2xl">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
              disabled={zoomLevel <= 0.4}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#182c54] disabled:opacity-40 transition cursor-pointer flex items-center justify-center"
              title="Zoom Out (Ctrl + Scroll Down)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="font-mono text-slate-300 hover:text-white hover:bg-[#182c54] px-2 py-1 rounded text-[11px] transition cursor-pointer font-semibold min-w-[46px] text-center"
              title="Click to Reset Zoom to 100%"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
              disabled={zoomLevel >= 2.0}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-[#182c54] disabled:opacity-40 transition cursor-pointer flex items-center justify-center"
              title="Zoom In (Ctrl + Scroll Up)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-[#182c54] text-[10px] ml-0.5 border-l border-[#182c54] pl-2 transition cursor-pointer"
              title="Reset Zoom to 100%"
            >
              Reset
            </button>
          </div>

          {/* Information Tip Banner */}
          <div className="absolute top-4 left-6 z-10 flex items-center gap-2 bg-[#0c162e]/80 backdrop-blur-xs border border-[#182c54] px-3 py-1.5 rounded-full text-[11px] text-slate-300 pointer-events-none shadow-md">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Drag between column circles <span className="text-blue-400 font-bold">○</span> to establish JOIN relationships.
            </span>
          </div>

          {/* SVG Connector Layer */}
          <svg
            className="absolute inset-0 w-[4000px] h-[3000px] pointer-events-none z-10"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }}
          >
            <defs>
              <linearGradient id="joinWireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>

            {/* Existing Joins */}
            {joinLineCoords.map((coord) => {
              if (!coord) return null;
              const { join, x1, y1, x2, y2, midX, midY } = coord;
              const dx = Math.abs(x2 - x1) * 0.5 + 40;
              const pathD = `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`;

              return (
                <g key={join.id} className="pointer-events-auto">
                  {/* Thick transparent stroke for easier hover/click */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="18"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveJoinPopover({
                        joinId: join.id,
                        x: midX,
                        y: midY,
                      });
                    }}
                  />
                  {/* Visual Bézier Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#joinWireGrad)"
                    strokeWidth="2.5"
                    strokeDasharray={join.joinType.includes('OUTER') || join.joinType.includes('LEFT') ? '6 3' : undefined}
                    className="transition-all hover:stroke-amber-400 hover:stroke-[3.5px] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveJoinPopover({
                        joinId: join.id,
                        x: midX,
                        y: midY,
                      });
                    }}
                  />
                  {/* Connection Endpoint Markers */}
                  <circle cx={x1} cy={y1} r="4" fill="#3B82F6" />
                  <circle cx={x2} cy={y2} r="4" fill="#10B981" />
                </g>
              );
            })}

            {/* In-Progress Dragging Wire */}
            {draggingWire && (
              <path
                d={`M ${draggingWire.startX} ${draggingWire.startY} C ${draggingWire.startX + 60} ${draggingWire.startY}, ${draggingWire.currentX - 60} ${draggingWire.currentY}, ${draggingWire.currentX} ${draggingWire.currentY}`}
                fill="none"
                stroke="#60A5FA"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                className="animate-pulse"
              />
            )}
          </svg>

          {/* HTML Join Midpoint Badges Layer */}
          <div
            className="absolute inset-0 w-[4000px] h-[3000px] pointer-events-none z-15"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }}
          >
            {joinLineCoords.map((coord) => {
              if (!coord) return null;
              const { join, midX, midY } = coord;
              return (
                <div
                  key={`badge_${join.id}`}
                  style={{
                    left: `${midX}px`,
                    top: `${midY}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className="absolute pointer-events-auto"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveJoinPopover({
                        joinId: join.id,
                        x: midX,
                        y: midY,
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0c162e] text-blue-300 border border-blue-500/60 shadow-lg hover:border-amber-400 hover:text-amber-300 transition cursor-pointer"
                    title="Click to configure join type or condition"
                  >
                    <span>{join.joinType.replace(' JOIN', '')}</span>
                    <span className="text-slate-400">{join.operator}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Active Join Popover Dialog */}
          {activeJoinPopover && (
            (() => {
              const activeJoin = joins.find((j) => j.id === activeJoinPopover.joinId);
              if (!activeJoin) return null;

              return (
                <div
                  style={{
                    left: `${activeJoinPopover.x * zoomLevel}px`,
                    top: `${activeJoinPopover.y * zoomLevel}px`,
                    transform: 'translate(-50%, 15px)',
                  }}
                  className="absolute z-40 bg-[#0c162e] border border-blue-500/80 rounded-xl p-4 shadow-2xl w-72 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-[#182c54] pb-2">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-400" />
                      Configure Relationship
                    </span>
                    <button
                      onClick={() => setActiveJoinPopover(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Relationship Description */}
                  <div className="text-[11px] font-mono text-slate-300 bg-[#070e1c] p-2 rounded border border-[#162544]">
                    <span className="text-blue-400">{activeJoin.sourceTable}.{activeJoin.sourceColumn}</span>
                    <span className="text-slate-500 mx-1">{activeJoin.operator}</span>
                    <span className="text-emerald-400">{activeJoin.targetTable}.{activeJoin.targetColumn}</span>
                  </div>

                  {/* Join Type Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">Join Type</label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {(['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN'] as JoinType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setJoins((prev) =>
                              prev.map((j) =>
                                j.id === activeJoin.id ? { ...j, joinType: type } : j
                              )
                            );
                          }}
                          className={`px-2 py-1.5 rounded-md font-mono text-[11px] transition text-left cursor-pointer border ${
                            activeJoin.joinType === type
                              ? 'bg-blue-600 border-blue-400 text-white font-bold'
                              : 'bg-[#070e1c] border-[#182c54] text-slate-300 hover:bg-[#132448]'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Operator Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-400">Comparison</label>
                    <select
                      value={activeJoin.operator}
                      onChange={(e) => {
                        const op = e.target.value as JoinOperator;
                        setJoins((prev) =>
                          prev.map((j) => (j.id === activeJoin.id ? { ...j, operator: op } : j))
                        );
                      }}
                      className="w-full bg-[#070e1c] border border-[#182c54] rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    >
                      <option value="=">= (Equals)</option>
                      <option value="<>">&lt;&gt; (Not Equals)</option>
                      <option value=">">&gt; (Greater Than)</option>
                      <option value="<">&lt; (Less Than)</option>
                      <option value=">=">&gt;= (Greater Or Equal)</option>
                      <option value="<=">&lt;= (Less Or Equal)</option>
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#182c54]">
                    <button
                      onClick={() => {
                        setJoins((prev) => prev.filter((j) => j.id !== activeJoin.id));
                        setActiveJoinPopover(null);
                      }}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Join</span>
                    </button>
                    <button
                      onClick={() => setActiveJoinPopover(null)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()
          )}

          {/* Table Cards Layer */}
          <div
            className="absolute inset-0 w-[4000px] h-[3000px] pointer-events-none"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: '0 0' }}
          >
            {nodes.map((node) => {
              const table = tables.find((t) => t.name === node.tableName);
              if (!table) return null;

              const isAllSelected = node.selectedColumns.length === table.columns.length;
              const isSomeSelected = node.selectedColumns.length > 0 && !isAllSelected;

              return (
                <div
                  key={node.tableName}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '280px',
                  }}
                  className="absolute pointer-events-auto bg-[#0c162e] border border-[#182c54] rounded-xl shadow-2xl overflow-hidden hover:border-blue-500/80 transition-colors group/card"
                >
                  {/* Table Card Header (Draggable Handle) */}
                  <div
                    onMouseDown={(e) => handleNodeMouseDown(node.tableName, e)}
                    onTouchStart={(e) => handleNodeTouchStart(node.tableName, e)}
                    className="p-3 bg-[#0a1326] border-b border-[#182c54] cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 select-none"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 font-mono truncate" title={table.name}>
                          {table.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span className="text-emerald-400 font-mono">{table.rowCount} rows</span>
                          {table.sheetName && (
                            <span className="text-slate-500 truncate">({table.sheetName})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.tableName === node.tableName
                                ? { ...n, isCollapsed: !n.isCollapsed }
                                : n
                            )
                          )
                        }
                        className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-[#122347] transition cursor-pointer"
                        title={node.isCollapsed ? 'Expand Table' : 'Collapse Table'}
                      >
                        {node.isCollapsed ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveNode(node.tableName)}
                        className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-950/40 transition cursor-pointer"
                        title="Remove from visual canvas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Table Body & Columns List */}
                  {!node.isCollapsed && (
                    <div className="divide-y divide-[#142342] bg-[#070e1c]">
                      {/* Column Quick Actions Bar */}
                      <div className="px-3 py-1.5 bg-[#081022] flex items-center justify-between text-[10px] text-slate-400 border-b border-[#142342]">
                        <span className="font-medium">
                          {node.selectedColumns.length}/{table.columns.length} in SELECT
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => selectAllColumns(node.tableName, true)}
                            className="hover:text-blue-400 transition cursor-pointer"
                          >
                            All
                          </button>
                          <span>•</span>
                          <button
                            onClick={() => selectAllColumns(node.tableName, false)}
                            className="hover:text-blue-400 transition cursor-pointer"
                          >
                            None
                          </button>
                        </div>
                      </div>

                      {/* Column List */}
                      <div className="max-h-72 overflow-y-auto">
                        {table.columns.map((col) => {
                          const isSelected = node.selectedColumns.includes(col.name);
                          const isKeyName =
                            col.name.toLowerCase().includes('id') ||
                            col.name.toLowerCase().includes('no') ||
                            col.name.toLowerCase().includes('code');

                          return (
                            <div
                              key={col.name}
                              className={`flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-[#0e1c38] transition-colors group/row relative ${
                                isSelected ? 'bg-blue-950/20' : ''
                              }`}
                            >
                              {/* Left Port Socket for Joins */}
                              <div
                                onMouseDown={(e) => handlePortMouseDown(table.name, col.name, e)}
                                onMouseUp={() => handlePortMouseUp(table.name, col.name)}
                                className="port-socket w-3 h-3 rounded-full border border-blue-400 bg-[#070e1c] hover:bg-blue-500 hover:scale-125 transition-all cursor-crosshair -ml-3 mr-1.5 flex items-center justify-center shrink-0 z-10"
                                title="Click & drag to connect join relationship"
                              >
                                <div className="w-1 h-1 rounded-full bg-blue-400" />
                              </div>

                              {/* Column checkbox & name */}
                              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleColumnSelection(table.name, col.name)}
                                  className="w-3.5 h-3.5 rounded border-[#1e3668] bg-[#070e1c] text-blue-600 focus:ring-0 cursor-pointer"
                                />
                                <span
                                  className={`font-mono text-xs truncate ${
                                    isSelected
                                      ? 'text-slate-100 font-semibold'
                                      : 'text-slate-400'
                                  }`}
                                  title={`${col.name} (${col.type})`}
                                >
                                  {col.name}
                                </span>
                              </div>

                              {/* Data Type Badge */}
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium shrink-0 uppercase ${
                                  col.type === 'INTEGER'
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                    : col.type === 'FLOAT'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                    : col.type === 'DATE'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                                    : col.type === 'BOOLEAN'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {col.type.slice(0, 4)}
                              </span>

                              {/* Right Port Socket for Joins */}
                              <div
                                onMouseDown={(e) => handlePortMouseDown(table.name, col.name, e)}
                                onMouseUp={() => handlePortMouseUp(table.name, col.name)}
                                className="port-socket w-3 h-3 rounded-full border border-emerald-400 bg-[#070e1c] hover:bg-emerald-500 hover:scale-125 transition-all cursor-crosshair -mr-3 ml-1.5 flex items-center justify-center shrink-0 z-10"
                                title="Click & drag to connect join relationship"
                              >
                                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Panel: Live Auto-Generated SQL Drawer */}
        {showSqlDrawer && (
          <div className="h-64 border-t border-[#182c54] bg-[#091224] flex flex-col shrink-0 z-20 shadow-2xl transition-[height] duration-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b162f] border-b border-[#182c54] shrink-0 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-100 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  Auto-Generated SQL Query
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Synchronized live from active table model & joins
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Limit input */}
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <span>LIMIT:</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={queryLimit}
                    onChange={(e) => setQueryLimit(Math.max(1, parseInt(e.target.value) || 50))}
                    className="w-16 px-2 py-0.5 bg-[#070e1c] border border-[#1b315e] rounded text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Copy SQL */}
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#0e1b38] hover:bg-[#182c54] border border-[#1e3668] text-slate-200 rounded-lg transition cursor-pointer font-medium"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Open in SQL Studio & Execute */}
                <button
                  onClick={() => onExecuteQuery(generatedSql)}
                  className="flex items-center gap-1.5 px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm cursor-pointer font-semibold"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Execute in SQL Studio</span>
                </button>
              </div>
            </div>

            {/* Generated Code Area */}
            <div className="flex-1 p-3 overflow-auto bg-[#070e1c] font-mono text-xs whitespace-pre leading-relaxed select-text">
              {highlightSql(generatedSql, theme)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
