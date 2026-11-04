/**
 * VisualizerStudio.tsx
 * Complete Drag-and-Drop Data Visualization Studio & BI Pivot Dashboard.
 * Supports:
 * - Drag-and-drop columns from field palette into Dimension, Measure, Breakdown, and Filter shelves
 * - Chart types: Bar (Vertical/Horizontal, Grouped/Stacked), Donut, Pie, Line, Area, Scatter, Radar, KPI Cards, and Pivot Table
 * - Custom aggregations: SUM, AVG, COUNT, DISTINCT COUNT, MIN, MAX, MEDIAN, % OF TOTAL, RUNNING TOTAL
 * - Formatters: Currency ($), Percentage (%), Compact (K/M), Number, Integer
 * - Dynamic SQL query generation and 1-click execution in SQL Studio
 * - High-res PNG Chart Export, Excel (.xlsx) / CSV Pivot export, and Save as Table
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart2,
  BarChart3,
  BarChartHorizontal,
  PieChart,
  LineChart,
  AreaChart,
  ScatterChart,
  Radar,
  Table as TableIcon,
  Layers,
  Sparkles,
  GripVertical,
  Plus,
  X,
  Download,
  Play,
  RotateCcw,
  Palette,
  Sliders,
  Filter,
  Sigma,
  Hash,
  Type,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  Search,
  FileSpreadsheet,
  FileCode,
  Check,
  TrendingUp,
  LayoutGrid,
  Info,
  Save,
  HelpCircle
} from 'lucide-react';
import { TableSchema } from '../types';
import {
  ChartType,
  StackingMode,
  SortOrder,
  AggregationFunction,
  MetricFormat,
  VisualMetricConfig,
  VisualFilterConfig,
  AGGREGATION_LABELS,
  COLOR_PALETTES,
  classifyColumn,
  formatMetricValue,
  executePivot,
  PivotResult,
} from '../utils/visualizerEngine';
import { getTableRowsFromEngine } from '../utils/sqlEngine';
import { exportToExcel, exportToCsv } from '../utils/exportHelper';
import { useTheme } from '../context/ThemeContext';

interface VisualizerStudioProps {
  tables: TableSchema[];
  onExecuteQuery: (sql: string) => void;
  onSaveAsTable?: (tableName: string, data: Record<string, any>[]) => void;
  onSwitchToStudio?: () => void;
  initialSelectedTable?: string;
}

export const VisualizerStudio: React.FC<VisualizerStudioProps> = ({
  tables,
  onExecuteQuery,
  onSaveAsTable,
  onSwitchToStudio,
  initialSelectedTable,
}) => {
  const { theme, isBright } = useTheme();

  // Dynamic Theme Palette for SVG Charts
  const chartTheme = useMemo(() => {
    return {
      gridline: isBright ? '#e2e8f0' : '#162544',
      axisText: isBright ? '#475569' : '#64748b',
      labelCategory: isBright ? '#334155' : '#94a3b8',
      labelValue: isBright ? '#0f172a' : '#cbd5e1',
      donutCenterBg: isBright ? '#ffffff' : '#0a1226',
      donutCenterBorder: isBright ? '#cbd5e1' : '#1b2c4e',
      donutCenterSub: isBright ? '#64748b' : '#94a3b8',
      donutCenterTotal: isBright ? '#0284c7' : '#38bdf8',
      donutCenterCount: isBright ? '#64748b' : '#64748b',
      sliceStroke: isBright ? '#ffffff' : '#070e1c',
      markerStroke: isBright ? '#ffffff' : '#070e1c',
      radarGrid: isBright ? '#cbd5e1' : '#1e3057',
      radarSpoke: isBright ? '#e2e8f0' : '#1e3057',
      radarLabel: isBright ? '#334155' : '#94a3b8',
      canvasExportBg: isBright ? '#ffffff' : '#0b1329',
    };
  }, [isBright]);

  // 1. Selected Table
  const [selectedTableName, setSelectedTableName] = useState<string>(() => {
    if (initialSelectedTable && tables.some((t) => t.name === initialSelectedTable)) {
      return initialSelectedTable;
    }
    return tables[0]?.name || '';
  });

  // Keep table selection valid if tables list updates
  useEffect(() => {
    if (!tables.some((t) => t.name === selectedTableName) && tables.length > 0) {
      setSelectedTableName(tables[0].name);
    }
  }, [tables, selectedTableName]);

  const activeTable = useMemo(() => {
    return tables.find((t) => t.name === selectedTableName) || tables[0] || null;
  }, [tables, selectedTableName]);

  // 2. Chart Configuration State
  const [chartType, setChartType] = useState<ChartType>('bar_vertical');
  const [stackingMode, setStackingMode] = useState<StackingMode>('grouped');
  const [sortOrder, setSortOrder] = useState<SortOrder>('val_desc');
  const [sortByMetricId, setSortByMetricId] = useState<string>('');
  const [limit, setLimit] = useState<number>(15);
  const [paletteKey, setPaletteKey] = useState<string>('modern');
  const [showDataLabels, setShowDataLabels] = useState<boolean>(true);
  const [showGridlines, setShowGridlines] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showSqlPanel, setShowSqlPanel] = useState<boolean>(false);

  // 3. Drop Shelves State
  const [dimensionCol, setDimensionCol] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<VisualMetricConfig[]>([]);
  const [breakdownCol, setBreakdownCol] = useState<string | null>(null);
  const [filters, setFilters] = useState<VisualFilterConfig[]>([]);

  // Search in column list
  const [columnSearch, setColumnSearch] = useState<string>('');

  // Drag State
  const [draggingCol, setDraggingCol] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'dimension' | 'metrics' | 'breakdown' | 'filters' | null>(null);

  // Hovered item in chart for interactive tooltips
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    metricLabel: string;
    value: number;
    pct?: number;
    color: string;
    clientX?: number;
    clientY?: number;
  } | null>(null);

  // Save Modal
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveTableName, setSaveTableName] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Mobile mode tab ('chart' | 'config')
  const [mobileVisualizerTab, setMobileVisualizerTab] = useState<'chart' | 'config'>('chart');

  // Measure aggregation dropdown modal
  const [activeMetricMenuId, setActiveMetricMenuId] = useState<string | null>(null);

  // SVG Chart ref for PNG export
  const chartSvgRef = useRef<SVGSVGElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Full rows resolution: from activeTable.allRows, or AlaSQL engine, or previewRows fallback
  const fullDataRows = useMemo(() => {
    if (!activeTable) return [];
    if (activeTable.allRows && activeTable.allRows.length > 0) {
      return activeTable.allRows;
    }
    const engineRows = getTableRowsFromEngine(activeTable.name);
    if (engineRows && engineRows.length > 0) {
      return engineRows;
    }
    return activeTable.previewRows || [];
  }, [activeTable]);

  // Column types classification
  const classifiedColumns = useMemo(() => {
    if (!activeTable) return { dimensions: [], measures: [] };

    const dimensions: { name: string; type: 'dimension' | 'date'; sample: any }[] = [];
    const measures: { name: string; sample: any }[] = [];

    const rowsForSampling = fullDataRows.length > 0 ? fullDataRows : activeTable.previewRows;

    activeTable.columns.forEach((col) => {
      const sampleValues = rowsForSampling.map((r) => r[col.name]);
      const affinity = classifyColumn(sampleValues);

      if (affinity === 'measure') {
        measures.push({ name: col.name, sample: sampleValues[0] });
      } else {
        dimensions.push({ name: col.name, type: affinity, sample: sampleValues[0] });
      }
    });

    return { dimensions, measures };
  }, [activeTable, fullDataRows]);

  // Auto-initialize default dimension & measure when table changes or mounts
  useEffect(() => {
    if (!activeTable) return;

    // Pick first dimension if none set
    if (!dimensionCol || !activeTable.columns.some((c) => c.name === dimensionCol)) {
      const defaultDim =
        classifiedColumns.dimensions[0]?.name || activeTable.columns[0]?.name || null;
      setDimensionCol(defaultDim);
    }

    // Pick first measure if none set
    if (metrics.length === 0 || !metrics.some((m) => activeTable.columns.some((c) => c.name === m.column))) {
      const defaultMeasure =
        classifiedColumns.measures[0]?.name ||
        activeTable.columns.find((c) => c.name !== dimensionCol)?.name ||
        '*';

      setMetrics([
        {
          id: 'metric_1',
          column: defaultMeasure,
          aggregation: defaultMeasure === '*' ? 'count' : 'sum',
          alias: defaultMeasure === '*' ? 'Record Count' : `Total ${defaultMeasure}`,
          format: defaultMeasure.toLowerCase().includes('rate') || defaultMeasure.toLowerCase().includes('pct')
            ? 'percentage'
            : defaultMeasure.toLowerCase().includes('price') ||
              defaultMeasure.toLowerCase().includes('sales') ||
              defaultMeasure.toLowerCase().includes('amount') ||
              defaultMeasure.toLowerCase().includes('cost') ||
              defaultMeasure.toLowerCase().includes('revenue')
            ? 'currency'
            : 'standard',
        },
      ]);
    }
  }, [activeTable, classifiedColumns]);

  // Compute Pivot Aggregations
  const pivotResult: PivotResult = useMemo(() => {
    if (!activeTable || fullDataRows.length === 0) {
      return {
        labels: [],
        series: [],
        tableRows: [],
        stats: { totalRows: 0, filteredRows: 0, grandTotal: 0, average: 0, min: 0, max: 0 },
        generatedSql: activeTable ? `-- No data in table ${activeTable.name}` : '-- No table selected',
      };
    }

    return executePivot({
      data: fullDataRows,
      tableName: activeTable.name,
      dimensionCol,
      metrics,
      breakdownCol,
      filters,
      sortOrder,
      sortByMetricId,
      limit,
      paletteKey,
    });
  }, [activeTable, fullDataRows, dimensionCol, metrics, breakdownCol, filters, sortOrder, sortByMetricId, limit, paletteKey]);

  // Max value calculation for Y axis scaling
  const yAxisMax = useMemo(() => {
    const { labels, series } = pivotResult;
    if (!labels.length || !series.length) return 100;

    if (stackingMode === 'stacked' && series.length > 1) {
      let maxStacked = 0;
      for (let i = 0; i < labels.length; i++) {
        let total = 0;
        series.forEach((s) => {
          total += Math.max(0, s.values[i] || 0);
        });
        if (total > maxStacked) maxStacked = total;
      }
      return maxStacked > 0 ? maxStacked * 1.15 : 100;
    }

    const maxSingle = Math.max(...series.flatMap((s) => s.values), 1);
    return maxSingle * 1.15;
  }, [pivotResult, stackingMode]);

  // Handle Drag & Drop
  const handleDragStart = (colName: string) => {
    setDraggingCol(colName);
  };

  const handleDragEnd = () => {
    setDraggingCol(null);
    setDragOverZone(null);
  };

  const handleDropOnDimension = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    const colName = draggingCol || e.dataTransfer.getData('text/plain');
    if (colName) {
      setDimensionCol(colName);
    }
  };

  const handleDropOnMetrics = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    const colName = draggingCol || e.dataTransfer.getData('text/plain');
    if (!colName) return;

    // Check if already in metrics
    const exists = metrics.find((m) => m.column === colName);
    if (!exists) {
      const isNum = classifiedColumns.measures.some((m) => m.name === colName);
      const defaultAgg: AggregationFunction = isNum ? 'sum' : 'count';
      const colLower = colName.toLowerCase();
      const format: MetricFormat = colLower.includes('sales') ||
        colLower.includes('price') ||
        colLower.includes('amount') ||
        colLower.includes('cost') ||
        colLower.includes('revenue')
        ? 'currency'
        : colLower.includes('pct') || colLower.includes('rate')
        ? 'percentage'
        : 'standard';

      setMetrics((prev) => [
        ...prev,
        {
          id: `metric_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          column: colName,
          aggregation: defaultAgg,
          alias: `${AGGREGATION_LABELS[defaultAgg].short} of ${colName}`,
          format,
        },
      ]);
    }
  };

  const handleDropOnBreakdown = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    const colName = draggingCol || e.dataTransfer.getData('text/plain');
    if (colName && colName !== dimensionCol) {
      setBreakdownCol(colName);
    }
  };

  const handleDropOnFilters = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    const colName = draggingCol || e.dataTransfer.getData('text/plain');
    if (colName) {
      setFilters((prev) => [
        ...prev,
        {
          id: `filter_${Date.now()}`,
          column: colName,
          operator: 'not_null',
          value: '',
        },
      ]);
    }
  };

  // Quick 1-click column add handlers
  const addColumnAsDimension = (colName: string) => {
    setDimensionCol(colName);
  };

  const addColumnAsMetric = (colName: string) => {
    const isNum = classifiedColumns.measures.some((m) => m.name === colName);
    const defaultAgg: AggregationFunction = isNum ? 'sum' : 'count';
    const colLower = colName.toLowerCase();
    const format: MetricFormat = colLower.includes('sales') ||
      colLower.includes('price') ||
      colLower.includes('amount') ||
      colLower.includes('cost') ||
      colLower.includes('revenue')
      ? 'currency'
      : colLower.includes('pct') || colLower.includes('rate')
      ? 'percentage'
      : 'standard';

    setMetrics((prev) => [
      ...prev,
      {
        id: `metric_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        column: colName,
        aggregation: defaultAgg,
        alias: `${AGGREGATION_LABELS[defaultAgg].short} of ${colName}`,
        format,
      },
    ]);
  };

  const removeMetric = (id: string) => {
    if (metrics.length <= 1) {
      // Keep at least a count metric
      setMetrics([
        {
          id: 'metric_count_default',
          column: '*',
          aggregation: 'count',
          alias: 'Record Count',
          format: 'integer',
        },
      ]);
      return;
    }
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMetricAgg = (id: string, agg: AggregationFunction) => {
    setMetrics((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          aggregation: agg,
          alias: `${AGGREGATION_LABELS[agg].short} of ${m.column}`,
        };
      })
    );
    setActiveMetricMenuId(null);
  };

  const updateMetricFormat = (id: string, format: MetricFormat) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, format } : m))
    );
    setActiveMetricMenuId(null);
  };

  // Export Chart as PNG
  const handleExportPng = () => {
    const svgEl = chartSvgRef.current;
    if (!svgEl) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const bbox = svgEl.getBoundingClientRect();
        canvas.width = (bbox.width || 800) * 2; // high dpi
        canvas.height = (bbox.height || 500) * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = chartTheme.canvasExportBg; // dynamic theme canvas bg
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.download = `${activeTable?.name || 'chart'}_${chartType}_visualization.png`;
          a.href = pngUrl;
          a.click();
        }
      };
      image.src = blobURL;
    } catch (err) {
      console.error('Failed to export chart PNG', err);
    }
  };

  // Export Aggregated Table to Excel
  const handleExportExcel = () => {
    if (!pivotResult.tableRows.length) return;
    const colNames = Object.keys(pivotResult.tableRows[0] || {});
    exportToExcel(pivotResult.tableRows, colNames, `${activeTable?.name || 'pivot'}_aggregated_data`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!pivotResult.tableRows.length) return;
    const colNames = Object.keys(pivotResult.tableRows[0] || {});
    exportToCsv(pivotResult.tableRows, colNames, `${activeTable?.name || 'pivot'}_aggregated_data`);
  };

  // Save Aggregated Pivot Data as New Table in Engine
  const handleConfirmSaveTable = () => {
    if (!saveTableName.trim() || !pivotResult.tableRows.length || !onSaveAsTable) return;
    onSaveAsTable(saveTableName.trim(), pivotResult.tableRows);
    setSaveSuccessMsg(`Table "${saveTableName.trim()}" created successfully! Available across the app.`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setSaveModalOpen(false);
      setSaveTableName('');
    }, 1800);
  };

  // Run in SQL Studio
  const handleRunInStudio = () => {
    if (pivotResult.generatedSql && onExecuteQuery) {
      onExecuteQuery(pivotResult.generatedSql);
      if (onSwitchToStudio) {
        onSwitchToStudio();
      }
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors duration-150 ${
      isBright ? 'bg-slate-50 text-slate-800' : 'bg-[#070e1c] text-slate-100'
    }`}>
      {/* TOP CONTROLS & WORKSPACE TOOLBAR */}
      <div className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-5 py-2 sm:py-2.5 shrink-0 z-20 border-b transition-colors ${
        isBright ? 'bg-white border-slate-200' : 'bg-[#0b1329] border-[#182747]'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar max-w-full">
          {/* Table Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${
              isBright ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Source:
            </span>
            <select
              value={selectedTableName}
              onChange={(e) => setSelectedTableName(e.target.value)}
              className={`text-xs rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 font-medium focus:outline-none cursor-pointer border transition-colors ${
                isBright
                  ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                  : 'bg-[#0f1b35] border-[#233863] text-slate-100 focus:border-blue-500 shadow-inner'
              }`}
            >
              {tables.map((tbl) => (
                <option key={tbl.name} value={tbl.name}>
                  {tbl.name} ({tbl.rowCount.toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>

          <div className={`h-4 w-px shrink-0 ${isBright ? 'bg-slate-200' : 'bg-slate-700/60'}`} />

          {/* Quick Chart Type Selectors */}
          <div className={`flex items-center p-0.5 rounded-lg border overflow-x-auto no-scrollbar shrink-0 transition-colors ${
            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#070e1c] border-[#162544]'
          }`}>
            <button
              onClick={() => setChartType('bar_vertical')}
              title="Vertical Column / Bar Chart"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'bar_vertical'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Column</span>
            </button>

            <button
              onClick={() => setChartType('bar_horizontal')}
              title="Horizontal Bar Chart"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'bar_horizontal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChartHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bar</span>
            </button>

            <button
              onClick={() => setChartType('donut')}
              title="Donut Chart with KPI Center"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'donut'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieChart className="w-3.5 h-3.5 text-pink-500" />
              <span className="hidden sm:inline">Donut</span>
            </button>

            <button
              onClick={() => setChartType('pie')}
              title="Classic Pie Chart"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'pie'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pie</span>
            </button>

            <button
              onClick={() => setChartType('line')}
              title="Line Chart with Markers"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Line</span>
            </button>

            <button
              onClick={() => setChartType('area')}
              title="Gradient Area Chart"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'area'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AreaChart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Area</span>
            </button>

            <button
              onClick={() => setChartType('scatter')}
              title="Scatter / Bubble Plot"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'scatter'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ScatterChart className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Scatter</span>
            </button>

            <button
              onClick={() => setChartType('radar')}
              title="Radar / Spider Chart"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'radar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radar className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Radar</span>
            </button>

            <button
              onClick={() => setChartType('kpi')}
              title="KPI Stat Scorecard Cards"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'kpi'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">KPIs</span>
            </button>

            <button
              onClick={() => setChartType('pivot_table')}
              title="Aggregated Pivot Summary Matrix"
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition cursor-pointer ${
                chartType === 'pivot_table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pivot Table</span>
            </button>
          </div>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full shrink-0">
          {/* SQL Query Toggle */}
          <button
            onClick={() => setShowSqlPanel(!showSqlPanel)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
              showSqlPanel
                ? isBright ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-blue-950/80 border-blue-500 text-blue-300'
                : isBright ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-[#0f1b35] border-[#203358] text-slate-300 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Generated </span>SQL
          </button>

          {/* Run in SQL Studio */}
          <button
            onClick={handleRunInStudio}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer whitespace-nowrap shrink-0"
            title="Execute current visual aggregation in SQL Studio"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span><span className="hidden sm:inline">Run in </span>Studio</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <button
            onClick={handleExportPng}
            disabled={chartType === 'pivot_table' || chartType === 'kpi'}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
              isBright
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-[#0f1b35] hover:bg-[#16274b] border-[#203358] text-slate-200'
            }`}
            title="Download visual as High-Res PNG"
          >
            <Download className="w-3.5 h-3.5 text-cyan-500" />
            <span>PNG</span>
          </button>

          <button
            onClick={handleExportExcel}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
              isBright
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                : 'bg-emerald-950/50 hover:bg-emerald-900/70 border-emerald-800/80 text-emerald-300'
            }`}
            title="Export aggregated pivot data to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden xs:inline">Excel</span>
          </button>

          {onSaveAsTable && (
            <button
              onClick={() => {
                setSaveTableName(`${activeTable?.name || 'data'}_summary`);
                setSaveModalOpen(true);
              }}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
                isBright
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-[#132244] hover:bg-[#1b3162] border-[#294275] text-slate-200'
              }`}
              title="Save aggregated results as a new table in database"
            >
              <Save className="w-3.5 h-3.5 text-amber-500" />
              <span>Save<span className="hidden sm:inline"> Table</span></span>
            </button>
          )}
        </div>
      </div>

      {/* SQL PANEL DRAWER (Expandable) */}
      {showSqlPanel && (
        <div className={`border-b px-5 py-3 shrink-0 flex items-start justify-between gap-4 animate-in slide-in-from-top-2 duration-150 transition-colors ${
          isBright ? 'bg-slate-100/90 border-slate-200' : 'bg-[#050a14] border-[#1c2f54]'
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isBright ? 'text-blue-700' : 'text-blue-400'
              }`}>
                <FileCode className="w-3.5 h-3.5" />
                Live SQL Engine Representation
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                isBright ? 'text-slate-600 bg-slate-200' : 'text-slate-400 bg-slate-800/80'
              }`}>
                ANSI / AlaSQL Compliant
              </span>
            </div>
            <pre className={`font-mono text-xs p-2.5 rounded border overflow-x-auto whitespace-pre leading-relaxed ${
              isBright
                ? 'text-slate-800 bg-white border-slate-200 shadow-inner'
                : 'text-blue-200/90 bg-[#0a1122] border-[#1b2b4d]'
            }`}>
              {pivotResult.generatedSql}
            </pre>
          </div>
          <div className="flex flex-col gap-2 pt-1 shrink-0">
            <button
              onClick={handleRunInStudio}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Open in Studio</span>
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(pivotResult.generatedSql)}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 cursor-pointer border transition-colors ${
                isBright
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-[#142344] hover:bg-[#1e3464] text-slate-200 border-[#243c70]'
              }`}
            >
              <span>Copy SQL</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Sub-Nav: Chart View vs Configure Shelves & Fields (< md) */}
      <div className={`md:hidden flex items-center justify-between px-3 py-1.5 border-b shrink-0 text-xs transition-colors ${
        isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#091224] border-[#162544]'
      }`}>
        <div className={`flex items-center gap-1 p-0.5 rounded-lg border w-full ${
          isBright ? 'bg-slate-200/70 border-slate-300' : 'bg-[#060b17] border-[#162544]'
        }`}>
          <button
            type="button"
            onClick={() => setMobileVisualizerTab('chart')}
            className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mobileVisualizerTab === 'chart'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Chart View</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileVisualizerTab('config')}
            className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              mobileVisualizerTab === 'config'
                ? 'bg-blue-600 text-white shadow-xs'
                : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Configure & Shelves</span>
          </button>
        </div>
      </div>

      {/* MAIN STUDIO SPLIT PANE */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT COLUMN: AVAILABLE FIELDS PALETTE */}
        <div className={`w-full md:w-64 border-r flex flex-col shrink-0 select-none transition-colors ${
          isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#091124] border-[#182747]'
        } ${
          mobileVisualizerTab === 'config' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Header */}
          <div className={`p-3 border-b ${isBright ? 'border-slate-200' : 'border-[#182747]'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isBright ? 'text-slate-800' : 'text-slate-300'
              }`}>
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Fields & Columns
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isBright ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-400'
              }`}>
                {activeTable?.columns.length || 0} fields
              </span>
            </div>
            {/* Search Box */}
            <div className="relative">
              <Search className={`w-3 h-3 absolute left-2.5 top-2.5 ${isBright ? 'text-slate-400' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Search columns..."
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className={`w-full rounded-md pl-7 pr-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 border transition-colors ${
                  isBright
                    ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 shadow-xs'
                    : 'bg-[#060c18] border-[#1d2d50] text-slate-200 placeholder-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Fields List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
            {/* DIMENSIONS GROUP */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className={`flex items-center gap-1 font-bold ${isBright ? 'text-cyan-700' : 'text-cyan-400'}`}>
                  <Type className="w-3 h-3" />
                  Dimensions (Categories)
                </span>
                <span className={`text-[10px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>
                  {classifiedColumns.dimensions.length}
                </span>
              </div>
              <div className="space-y-1">
                {classifiedColumns.dimensions
                  .filter((c) => c.name.toLowerCase().includes(columnSearch.toLowerCase()))
                  .map((col) => (
                    <div
                      key={col.name}
                      draggable={true}
                      onDragStart={() => handleDragStart(col.name)}
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center justify-between px-2.5 py-1.5 border rounded-md cursor-grab active:cursor-grabbing transition ${
                        isBright
                          ? 'bg-white hover:bg-slate-100 border-slate-200 hover:border-cyan-500 text-slate-800 shadow-xs'
                          : 'bg-[#0e1933] hover:bg-[#16274e] border-[#1b2b4e] hover:border-cyan-500/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GripVertical className={`w-3 h-3 shrink-0 ${isBright ? 'text-slate-400 group-hover:text-cyan-600' : 'text-slate-500 group-hover:text-cyan-400'}`} />
                        {col.type === 'date' ? (
                          <Calendar className={`w-3 h-3 shrink-0 ${isBright ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        ) : (
                          <Type className={`w-3 h-3 shrink-0 ${isBright ? 'text-cyan-600' : 'text-cyan-400'}`} />
                        )}
                        <span className={`truncate font-medium ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>{col.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => addColumnAsDimension(col.name)}
                          title="Set as Dimension (X-Axis)"
                          className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                            isBright ? 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800' : 'bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200'
                          }`}
                        >
                          + X
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* MEASURES GROUP */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className={`flex items-center gap-1 font-bold ${isBright ? 'text-blue-700' : 'text-blue-400'}`}>
                  <Hash className="w-3 h-3" />
                  Measures (Numeric)
                </span>
                <span className={`text-[10px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>
                  {classifiedColumns.measures.length}
                </span>
              </div>
              <div className="space-y-1">
                {/* Count (*) wildcard measure */}
                <div
                  draggable={true}
                  onDragStart={() => handleDragStart('*')}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center justify-between px-2.5 py-1.5 border rounded-md cursor-grab active:cursor-grabbing transition ${
                    isBright
                      ? 'bg-white hover:bg-slate-100 border-slate-200 hover:border-blue-500 text-slate-800 shadow-xs'
                      : 'bg-[#0e1933] hover:bg-[#16274e] border-[#1b2b4e] hover:border-blue-500/50 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <GripVertical className={`w-3 h-3 shrink-0 ${isBright ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-500 group-hover:text-blue-400'}`} />
                    <Sigma className={`w-3 h-3 shrink-0 ${isBright ? 'text-amber-600' : 'text-amber-400'}`} />
                    <span className={`font-medium ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>Record Count (*)</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => addColumnAsMetric('*')}
                      title="Add to Measures"
                      className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                        isBright ? 'bg-blue-100 hover:bg-blue-200 text-blue-800' : 'bg-blue-900/60 hover:bg-blue-800 text-blue-200'
                      }`}
                    >
                      + Y
                    </button>
                  </div>
                </div>

                {classifiedColumns.measures
                  .filter((c) => c.name.toLowerCase().includes(columnSearch.toLowerCase()))
                  .map((col) => (
                    <div
                      key={col.name}
                      draggable={true}
                      onDragStart={() => handleDragStart(col.name)}
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center justify-between px-2.5 py-1.5 border rounded-md cursor-grab active:cursor-grabbing transition ${
                        isBright
                          ? 'bg-white hover:bg-slate-100 border-slate-200 hover:border-blue-500 text-slate-800 shadow-xs'
                          : 'bg-[#0e1933] hover:bg-[#16274e] border-[#1b2b4e] hover:border-blue-500/50 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <GripVertical className={`w-3 h-3 shrink-0 ${isBright ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-500 group-hover:text-blue-400'}`} />
                        <Hash className={`w-3 h-3 shrink-0 ${isBright ? 'text-blue-600' : 'text-blue-400'}`} />
                        <span className={`truncate font-medium ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>{col.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => addColumnAsMetric(col.name)}
                          title="Add to Measures (Y-Axis)"
                          className={`px-1.5 py-0.5 text-[10px] rounded font-semibold cursor-pointer ${
                            isBright ? 'bg-blue-100 hover:bg-blue-200 text-blue-800' : 'bg-blue-900/60 hover:bg-blue-800 text-blue-200'
                          }`}
                        >
                          + Y
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Quick tips at bottom */}
          <div className={`p-3 border-t text-[11px] flex items-start gap-2 ${
            isBright ? 'bg-slate-100/70 border-slate-200 text-slate-600' : 'bg-[#060c18] border-[#182747] text-slate-400'
          }`}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Drag columns onto the shelves above the chart or use the quick <strong className={isBright ? 'text-slate-800' : 'text-slate-300'}>+X</strong> and <strong className={isBright ? 'text-slate-800' : 'text-slate-300'}>+Y</strong> buttons.
            </span>
          </div>

          {/* Mobile Button to jump back to Chart View */}
          <div className={`p-3 border-t md:hidden shrink-0 ${isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#060c18] border-[#182747]'}`}>
            <button
              type="button"
              onClick={() => setMobileVisualizerTab('chart')}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <PieChart className="w-4 h-4" />
              <span>Done Editing · View Chart →</span>
            </button>
          </div>
        </div>

        {/* RIGHT MAIN WORKSPACE: SHELVES & VISUAL VIEWPORT */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${
          isBright ? 'bg-slate-50' : 'bg-[#070e1c]'
        } ${
          mobileVisualizerTab === 'chart' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Mobile Quick Banner to jump to config */}
          <div className={`md:hidden flex items-center justify-between px-3 py-2 border-b text-xs shrink-0 ${
            isBright ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#091326] border-[#182747] text-slate-300'
          }`}>
            <span className="font-medium truncate max-w-[200px]">
              {dimensionCol ? `${dimensionCol} · ${metrics.length} metric${metrics.length === 1 ? '' : 's'}` : 'Configure chart fields'}
            </span>
            <button
              type="button"
              onClick={() => setMobileVisualizerTab('config')}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold cursor-pointer shrink-0"
            >
              Edit Shelves
            </button>
          </div>

          {/* DRAG AND DROP SHELVES BAR */}
          <div className={`p-3 space-y-2.5 shrink-0 border-b transition-colors ${
            isBright ? 'bg-slate-100/80 border-slate-200' : 'bg-[#0a1226] border-[#182747]'
          }`}>
            {/* ROW 1: DIMENSION (X-AXIS) & BREAKDOWN (SERIES) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* DIMENSION SHELF */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverZone('dimension');
                }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={handleDropOnDimension}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition min-h-[38px] ${
                  dragOverZone === 'dimension'
                    ? isBright ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-400' : 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                    : isBright ? 'border-slate-200 bg-white shadow-xs' : 'border-[#1b2c4e] bg-[#070f20]'
                }`}
              >
                <span className={`font-semibold uppercase tracking-wider text-[11px] shrink-0 flex items-center gap-1 ${
                  isBright ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  <Type className={`w-3 h-3 ${isBright ? 'text-cyan-600' : 'text-cyan-400'}`} />
                  X-Axis / Category:
                </span>
                {dimensionCol ? (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs shadow-sm border ${
                    isBright
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-900'
                      : 'bg-cyan-950/70 border-cyan-800/80 text-cyan-200'
                  }`}>
                    <span>{dimensionCol}</span>
                    <button
                      onClick={() => setDimensionCol(null)}
                      className={`cursor-pointer ml-1 ${isBright ? 'text-cyan-600 hover:text-cyan-900' : 'text-cyan-400 hover:text-white'}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className={`italic text-[11px] ${isBright ? 'text-slate-400' : 'text-slate-500'}`}>
                    Drag column here for categories...
                  </span>
                )}
              </div>

              {/* BREAKDOWN / COLOR LEGEND SHELF */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverZone('breakdown');
                }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={handleDropOnBreakdown}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition min-h-[38px] ${
                  dragOverZone === 'breakdown'
                    ? isBright ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-400' : 'border-purple-400 bg-purple-950/40 ring-1 ring-purple-400'
                    : isBright ? 'border-slate-200 bg-white shadow-xs' : 'border-[#1b2c4e] bg-[#070f20]'
                }`}
              >
                <span className={`font-semibold uppercase tracking-wider text-[11px] shrink-0 flex items-center gap-1 ${
                  isBright ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  <Palette className={`w-3 h-3 ${isBright ? 'text-purple-600' : 'text-purple-400'}`} />
                  Breakdown / Series:
                </span>
                {breakdownCol ? (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs shadow-sm border ${
                    isBright
                      ? 'bg-purple-50 border-purple-200 text-purple-900'
                      : 'bg-purple-950/70 border-purple-800/80 text-purple-200'
                  }`}>
                    <span>{breakdownCol}</span>
                    <button
                      onClick={() => setBreakdownCol(null)}
                      className={`cursor-pointer ml-1 ${isBright ? 'text-purple-600 hover:text-purple-900' : 'text-purple-400 hover:text-white'}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className={`italic text-[11px] ${isBright ? 'text-slate-400' : 'text-slate-500'}`}>
                    (Optional) Drag column to split by series/color
                  </span>
                )}
              </div>
            </div>

            {/* ROW 2: MEASURES / VALUES SHELF (CUSTOM AGGREGATION) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone('metrics');
              }}
              onDragLeave={() => setDragOverZone(null)}
              onDrop={handleDropOnMetrics}
              className={`flex items-center flex-wrap gap-2 px-3 py-1.5 rounded-lg border text-xs transition min-h-[42px] ${
                dragOverZone === 'metrics'
                  ? isBright ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-blue-400 bg-blue-950/40 ring-1 ring-blue-400'
                  : isBright ? 'border-slate-200 bg-white shadow-xs' : 'border-[#1b2c4e] bg-[#070f20]'
              }`}
            >
              <span className={`font-semibold uppercase tracking-wider text-[11px] shrink-0 flex items-center gap-1 ${
                isBright ? 'text-slate-600' : 'text-slate-400'
              }`}>
                <Sigma className={`w-3 h-3 ${isBright ? 'text-blue-600' : 'text-blue-400'}`} />
                Values & Aggregations:
              </span>

              {metrics.map((metric) => {
                const isMenuOpen = activeMetricMenuId === metric.id;
                const aggInfo = AGGREGATION_LABELS[metric.aggregation];

                return (
                  <div
                    key={metric.id}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs shadow-sm border ${
                      isBright
                        ? 'bg-blue-50 border-blue-200 text-blue-950'
                        : 'bg-[#132448] border-[#233d73] text-blue-100'
                    }`}
                  >
                    <span className={isBright ? 'text-slate-800' : 'text-slate-300'}>{metric.column}</span>

                    {/* Aggregation Function Pill Button */}
                    <button
                      onClick={() => setActiveMetricMenuId(isMenuOpen ? null : metric.id)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600/80 hover:bg-blue-600 text-white font-bold text-[10px] cursor-pointer shadow"
                    >
                      <span>{aggInfo.short}</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>

                    {/* Format indicator badge */}
                    {metric.format && metric.format !== 'standard' && (
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isBright ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {metric.format === 'currency' ? '$' : metric.format === 'percentage' ? '%' : 'k'}
                      </span>
                    )}

                    <button
                      onClick={() => removeMetric(metric.id)}
                      className={`cursor-ml-0.5 ${isBright ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {/* Custom Aggregation & Format Popup */}
                    {isMenuOpen && (
                      <div className={`absolute top-full left-0 mt-1 w-56 rounded-lg shadow-2xl p-2 z-50 text-xs border ${
                        isBright
                          ? 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
                          : 'bg-[#0a1329] border-[#203666] text-slate-200 shadow-2xl'
                      }`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-b mb-1 ${
                          isBright ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-[#1c2e54]'
                        }`}>
                          Aggregation Formula
                        </div>
                        <div className="space-y-0.5 mb-2">
                          {(Object.keys(AGGREGATION_LABELS) as AggregationFunction[]).map((func) => (
                            <button
                              key={func}
                              onClick={() => updateMetricAgg(metric.id, func)}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left cursor-pointer transition ${
                                metric.aggregation === func
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : isBright ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-[#132247]'
                              }`}
                            >
                              <span>{AGGREGATION_LABELS[func].label}</span>
                              <span className="text-[10px] opacity-70">
                                {AGGREGATION_LABELS[func].short}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 border-b mb-1 ${
                          isBright ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-[#1c2e54]'
                        }`}>
                          Value Format
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {(['standard', 'currency', 'percentage', 'compact'] as MetricFormat[]).map(
                            (fmt) => (
                              <button
                                key={fmt}
                                onClick={() => updateMetricFormat(metric.id, fmt)}
                                className={`px-2 py-1 rounded text-[11px] capitalize cursor-pointer transition ${
                                  (metric.format || 'standard') === fmt
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : isBright
                                      ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                                      : 'text-slate-300 bg-[#101c38] hover:bg-[#192b52]'
                                }`}
                              >
                                {fmt}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {metrics.length === 0 && (
                <span className={`italic text-[11px] ${isBright ? 'text-slate-400' : 'text-slate-500'}`}>
                  Drag numeric columns here or click + Y on any column...
                </span>
              )}
            </div>
          </div>

          {/* SECONDARY VIEWPORT TOOLBAR (Visual Options & Sorting) */}
          <div className={`flex items-center justify-between gap-4 px-5 py-2 border-b text-xs shrink-0 transition-colors ${
            isBright ? 'bg-slate-100/70 border-slate-200 text-slate-700' : 'bg-[#091122] border-[#182747] text-slate-300'
          }`}>
            {/* Sorting & Limit Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className={`w-3.5 h-3.5 ${isBright ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`font-medium ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>Sort:</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className={`rounded px-2 py-1 text-xs focus:outline-none border cursor-pointer ${
                    isBright ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-[#0e1933] border-[#21355f] text-slate-200'
                  }`}
                >
                  <option value="val_desc">Highest Value (Desc)</option>
                  <option value="val_asc">Lowest Value (Asc)</option>
                  <option value="alpha_asc">Alphabetical (A - Z)</option>
                  <option value="alpha_desc">Alphabetical (Z - A)</option>
                </select>
              </div>

              {/* If sorting by value and there are multiple measures, allow selecting which measure */}
              {(sortOrder === 'val_desc' || sortOrder === 'val_asc') && metrics.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>By:</span>
                  <select
                    value={sortByMetricId || metrics[0]?.id}
                    onChange={(e) => setSortByMetricId(e.target.value)}
                    className={`rounded px-2 py-1 text-xs focus:outline-none border cursor-pointer max-w-[130px] truncate ${
                      isBright ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-[#0e1933] border-[#21355f] text-slate-200'
                    }`}
                  >
                    {metrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alias || `${m.aggregation.toUpperCase()}(${m.column})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className={`font-medium ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>Show:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className={`rounded px-2 py-1 text-xs focus:outline-none border cursor-pointer ${
                    isBright ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-[#0e1933] border-[#21355f] text-slate-200'
                  }`}
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                  <option value={20}>Top 20</option>
                  <option value={25}>Top 25</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                  <option value={0}>All Records</option>
                </select>
              </div>

              {/* Stacking Mode for Bars/Areas */}
              {(chartType === 'bar_vertical' || chartType === 'bar_horizontal' || chartType === 'area') &&
                (metrics.length > 1 || breakdownCol) && (
                  <div className={`flex items-center gap-1 p-0.5 rounded border ${
                    isBright ? 'bg-slate-200/80 border-slate-300' : 'bg-[#060c18] border-[#1b2b4e]'
                  }`}>
                    <button
                      onClick={() => setStackingMode('grouped')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                        stackingMode === 'grouped'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Grouped
                    </button>
                    <button
                      onClick={() => setStackingMode('stacked')}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                        stackingMode === 'stacked'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isBright ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Stacked
                    </button>
                  </div>
                )}
            </div>

            {/* Display Toggles */}
            <div className="flex items-center gap-4">
              {/* Palette Selector */}
              <div className="flex items-center gap-1.5">
                <Palette className={`w-3.5 h-3.5 ${isBright ? 'text-slate-500' : 'text-slate-400'}`} />
                <select
                  value={paletteKey}
                  onChange={(e) => setPaletteKey(e.target.value)}
                  className={`rounded px-2 py-1 text-xs focus:outline-none cursor-pointer border ${
                    isBright ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-[#0e1933] border-[#21355f] text-slate-200'
                  }`}
                >
                  {Object.entries(COLOR_PALETTES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles */}
              <label className={`flex items-center gap-1.5 cursor-pointer font-medium ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>
                <input
                  type="checkbox"
                  checked={showDataLabels}
                  onChange={(e) => setShowDataLabels(e.target.checked)}
                  className={`rounded focus:ring-0 ${isBright ? 'border-slate-300 bg-white text-blue-600' : 'border-[#21355f] bg-[#0e1933] text-blue-600'}`}
                />
                <span>Values</span>
              </label>

              <label className={`flex items-center gap-1.5 cursor-pointer font-medium ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className={`rounded focus:ring-0 ${isBright ? 'border-slate-300 bg-white text-blue-600' : 'border-[#21355f] bg-[#0e1933] text-blue-600'}`}
                />
                <span>Legend</span>
              </label>
            </div>
          </div>

          {/* CHART VIEWPORT CANVAS */}
          <div
            ref={chartContainerRef}
            className={`flex-1 min-h-0 p-5 overflow-auto flex flex-col items-center justify-center relative transition-colors duration-200 ${
              isBright
                ? 'bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800'
                : 'bg-radial from-[#0d162d] to-[#070e1c] text-slate-100'
            }`}
          >
            {/* If no data or categories */}
            {pivotResult.labels.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                <Sparkles className="w-10 h-10 text-blue-500 mb-3 animate-pulse" />
                <h3 className={`text-base font-semibold mb-1 ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>
                  Ready to Visualize
                </h3>
                <p className={`text-xs mb-4 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                  Drag a category column from the left into the Dimension (X-Axis) shelf, and numeric columns into the Values shelf.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (classifiedColumns.dimensions[0]) {
                        setDimensionCol(classifiedColumns.dimensions[0].name);
                      }
                      if (classifiedColumns.measures[0]) {
                        addColumnAsMetric(classifiedColumns.measures[0].name);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
                  >
                    Auto-Generate Quick Visual
                  </button>
                </div>
              </div>
            ) : chartType === 'kpi' ? (
              /* KPI STAT SCORECARD VIEW */
              <div className="w-full max-w-5xl h-full flex flex-col justify-center gap-6 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className={`p-5 rounded-xl border flex flex-col justify-between transition-colors ${
                    isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b162c] border-[#1d315b] shadow-lg'
                  }`}>
                    <span className={`text-xs uppercase font-bold tracking-wider ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                      Total {metrics[0]?.alias || 'Sum'}
                    </span>
                    <div className={`text-3xl font-black my-2 ${isBright ? 'text-blue-600' : 'text-blue-400'}`}>
                      {formatMetricValue(pivotResult.stats.grandTotal, metrics[0]?.format)}
                    </div>
                    <span className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>
                      Across {pivotResult.labels.length} categories
                    </span>
                  </div>

                  <div className={`p-5 rounded-xl border flex flex-col justify-between transition-colors ${
                    isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b162c] border-[#1d315b] shadow-lg'
                  }`}>
                    <span className={`text-xs uppercase font-bold tracking-wider ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                      Average per Group
                    </span>
                    <div className={`text-3xl font-black my-2 ${isBright ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      {formatMetricValue(pivotResult.stats.average, metrics[0]?.format)}
                    </div>
                    <span className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>Arithmetic mean</span>
                  </div>

                  <div className={`p-5 rounded-xl border flex flex-col justify-between transition-colors ${
                    isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b162c] border-[#1d315b] shadow-lg'
                  }`}>
                    <span className={`text-xs uppercase font-bold tracking-wider ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                      Peak / Maximum
                    </span>
                    <div className={`text-3xl font-black my-2 ${isBright ? 'text-amber-600' : 'text-amber-400'}`}>
                      {formatMetricValue(pivotResult.stats.max, metrics[0]?.format)}
                    </div>
                    <span className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>Highest recorded value</span>
                  </div>

                  <div className={`p-5 rounded-xl border flex flex-col justify-between transition-colors ${
                    isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b162c] border-[#1d315b] shadow-lg'
                  }`}>
                    <span className={`text-xs uppercase font-bold tracking-wider ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                      Lowest / Minimum
                    </span>
                    <div className={`text-3xl font-black my-2 ${isBright ? 'text-pink-600' : 'text-pink-400'}`}>
                      {formatMetricValue(pivotResult.stats.min, metrics[0]?.format)}
                    </div>
                    <span className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-500'}`}>Smallest non-zero</span>
                  </div>
                </div>

                {/* Sub-Ranking List */}
                <div className={`border rounded-xl p-4 transition-colors ${
                  isBright ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b162c] border-[#1d315b]'
                }`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isBright ? 'text-slate-800' : 'text-slate-300'}`}>
                    Top Contributing Categories ({dimensionCol})
                  </h4>
                  <div className="space-y-2">
                    {pivotResult.labels.slice(0, 6).map((lbl, idx) => {
                      const val = pivotResult.series[0]?.values[idx] || 0;
                      const pct = pivotResult.stats.grandTotal > 0 ? (val / pivotResult.stats.grandTotal) * 100 : 0;
                      return (
                        <div key={lbl} className="flex items-center justify-between gap-4 text-xs">
                          <span className={`w-32 font-medium truncate ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>{lbl}</span>
                          <div className={`flex-1 rounded-full h-2.5 overflow-hidden border ${
                            isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#060c18] border-[#182747]'
                          }`}>
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                            />
                          </div>
                          <span className={`w-24 text-right font-mono font-bold ${isBright ? 'text-slate-900' : 'text-slate-200'}`}>
                            {formatMetricValue(val, metrics[0]?.format)}
                          </span>
                          <span className={`w-14 text-right font-mono text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : chartType === 'pivot_table' ? (
              /* PIVOT TABLE MATRIX VIEW */
              <div className={`w-full h-full flex flex-col rounded-xl border overflow-hidden shadow-xl transition-colors ${
                isBright ? 'bg-white border-slate-200 shadow-md' : 'bg-[#0b1428] border-[#1b2f56]'
              }`}>
                <div className={`p-3 border-b flex items-center justify-between ${
                  isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0e1a35] border-[#1b2f56]'
                }`}>
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-blue-500" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${isBright ? 'text-slate-800' : 'text-slate-200'}`}>
                      Aggregated Matrix Summary ({pivotResult.tableRows.length} groups)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      onClick={handleExportCsv}
                      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                        isBright
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-[#152345] hover:bg-[#1d3262] text-slate-300 border-[#243a6d]'
                      }`}
                    >
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className={`sticky top-0 border-b z-10 ${
                      isBright ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-[#080f20] text-slate-400 border-[#1c305a]'
                    }`}>
                      <tr>
                        {Object.keys(pivotResult.tableRows[0] || {}).map((colName) => (
                          <th key={colName} className="px-4 py-2.5 font-bold uppercase tracking-wider">
                            {colName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isBright ? 'divide-slate-100' : 'divide-[#132244]'}`}>
                      {pivotResult.tableRows.map((row, rIdx) => (
                        <tr key={rIdx} className={`transition-colors ${isBright ? 'hover:bg-slate-50' : 'hover:bg-[#101d3a]'}`}>
                          {Object.entries(row).map(([k, val], cIdx) => (
                            <td
                              key={k}
                              className={`px-4 py-2 font-mono ${
                                cIdx === 0
                                  ? isBright ? 'font-medium text-slate-800' : 'font-medium text-slate-200'
                                  : isBright ? 'text-blue-700 font-semibold' : 'text-blue-300 font-semibold'
                              }`}
                            >
                              {typeof val === 'number'
                                ? formatMetricValue(val, metrics[cIdx - 1]?.format || 'standard')
                                : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* DYNAMIC SVG CHART RENDERING ENGINE */
              <div className="w-full h-full flex flex-col items-center justify-center relative">
                {/* SVG CHART CONTAINER */}
                <svg
                  ref={chartSvgRef}
                  viewBox="0 0 860 480"
                  className="w-full h-full max-h-[580px] drop-shadow-md select-none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    {/* Gradients for bars & areas */}
                    {COLOR_PALETTES[paletteKey].colors.map((c, i) => (
                      <linearGradient key={i} id={`grad_${paletteKey}_${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity="0.9" />
                        <stop offset="100%" stopColor={c} stopOpacity="0.4" />
                      </linearGradient>
                    ))}
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* 1. DONUT & PIE CHARTS */}
                  {(chartType === 'donut' || chartType === 'pie') && (
                    <g transform="translate(430, 240)">
                      {(() => {
                        const { labels, series, stats } = pivotResult;
                        const values = series[0]?.values || [];
                        const total = values.reduce((a, b) => a + b, 0) || 1;
                        const outerRadius = 160;
                        const innerRadius = chartType === 'donut' ? 95 : 0;
                        const palette = COLOR_PALETTES[paletteKey].colors;

                        let currentAngle = -Math.PI / 2;

                        return (
                          <>
                            {values.map((val, idx) => {
                              const sliceAngle = (val / total) * (Math.PI * 2);
                              const endAngle = currentAngle + sliceAngle;
                              const isHovered = hoveredPoint?.label === labels[idx];

                              // Angles for SVG arc
                              const x1 = Math.cos(currentAngle) * (isHovered ? outerRadius + 8 : outerRadius);
                              const y1 = Math.sin(currentAngle) * (isHovered ? outerRadius + 8 : outerRadius);
                              const x2 = Math.cos(endAngle) * (isHovered ? outerRadius + 8 : outerRadius);
                              const y2 = Math.sin(endAngle) * (isHovered ? outerRadius + 8 : outerRadius);

                              const x3 = Math.cos(endAngle) * innerRadius;
                              const y3 = Math.sin(endAngle) * innerRadius;
                              const x4 = Math.cos(currentAngle) * innerRadius;
                              const y4 = Math.sin(currentAngle) * innerRadius;

                              const largeArc = sliceAngle > Math.PI ? 1 : 0;
                              const pathData =
                                innerRadius > 0
                                  ? `M ${x1} ${y1} A ${isHovered ? outerRadius + 8 : outerRadius} ${
                                      isHovered ? outerRadius + 8 : outerRadius
                                    } 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`
                                  : `M 0 0 L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                              // Label anchor position
                              const midAngle = currentAngle + sliceAngle / 2;
                              const labelRadius = innerRadius > 0 ? (innerRadius + outerRadius) / 2 : outerRadius * 0.65;
                              const lx = Math.cos(midAngle) * labelRadius;
                              const ly = Math.sin(midAngle) * labelRadius;
                              const pct = ((val / total) * 100).toFixed(1);

                              currentAngle = endAngle;

                              const sliceColor = palette[idx % palette.length];

                              return (
                                <g key={idx}>
                                  <path
                                    d={pathData}
                                    fill={sliceColor}
                                    stroke={chartTheme.sliceStroke}
                                    strokeWidth="2.5"
                                    className="transition-all duration-200 cursor-pointer"
                                    opacity={isHovered ? 1 : 0.9}
                                    filter={isHovered ? 'url(#glow)' : undefined}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredPoint({
                                        label: labels[idx],
                                        metricLabel: series[0]?.label || 'Value',
                                        value: val,
                                        pct: parseFloat(pct),
                                        color: sliceColor,
                                        clientX: rect.left + rect.width / 2,
                                        clientY: rect.top,
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  />
                                  {/* Slice Value Label */}
                                  {showDataLabels && sliceAngle > 0.25 && (
                                    <text
                                      x={lx}
                                      y={ly}
                                      fill="#ffffff"
                                      fontSize="11"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      pointerEvents="none"
                                      className="drop-shadow-md"
                                    >
                                      {pct}%
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Donut Center KPI Scorecard */}
                            {chartType === 'donut' && (
                              <g pointerEvents="none">
                                <circle r={innerRadius - 4} fill={chartTheme.donutCenterBg} stroke={chartTheme.donutCenterBorder} strokeWidth="1" />
                                <text
                                  x="0"
                                  y="-14"
                                  fill={chartTheme.donutCenterSub}
                                  fontSize="10"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  letterSpacing="0.05em"
                                >
                                  {metrics[0]?.alias || 'GRAND TOTAL'}
                                </text>
                                <text
                                  x="0"
                                  y="12"
                                  fill={chartTheme.donutCenterTotal}
                                  fontSize="20"
                                  fontWeight="900"
                                  textAnchor="middle"
                                >
                                  {formatMetricValue(total, metrics[0]?.format, 1)}
                                </text>
                                <text
                                  x="0"
                                  y="32"
                                  fill={chartTheme.donutCenterCount}
                                  fontSize="10"
                                  textAnchor="middle"
                                >
                                  {labels.length} categories
                                </text>
                              </g>
                            )}
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* 2. VERTICAL COLUMN / BAR CHART */}
                  {chartType === 'bar_vertical' && (
                    <g transform="translate(60, 40)">
                      {/* Gridlines */}
                      {showGridlines &&
                        [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                          const y = 360 - pct * 360;
                          const val = pct * yAxisMax;
                          return (
                            <g key={i}>
                              <line
                                x1="0"
                                y1={y}
                                x2="740"
                                y2={y}
                                stroke={chartTheme.gridline}
                                strokeDasharray={i === 0 ? 'none' : '4 4'}
                                strokeWidth="1"
                              />
                              <text
                                x="-10"
                                y={y + 4}
                                fill={chartTheme.axisText}
                                fontSize="10"
                                textAnchor="end"
                                fontFamily="monospace"
                              >
                                {formatMetricValue(val, metrics[0]?.format, 0)}
                              </text>
                            </g>
                          );
                        })}

                      {/* Bars */}
                      {(() => {
                        const { labels, series } = pivotResult;
                        const plotWidth = 740;
                        const groupWidth = plotWidth / Math.max(labels.length, 1);
                        const isStacked = stackingMode === 'stacked' && series.length > 1;
                        const palette = COLOR_PALETTES[paletteKey].colors;

                        return labels.map((label, lIdx) => {
                          const groupX = lIdx * groupWidth;
                          let stackedAccY = 0;

                          return (
                            <g key={lIdx}>
                              {series.map((s, sIdx) => {
                                const val = s.values[lIdx] || 0;
                                const barHeight = (val / yAxisMax) * 360;
                                const barWidth = isStacked
                                  ? Math.min(groupWidth * 0.65, 48)
                                  : Math.min((groupWidth * 0.8) / series.length, 36);

                                const barX = isStacked
                                  ? groupX + (groupWidth - barWidth) / 2
                                  : groupX + (groupWidth - barWidth * series.length) / 2 + sIdx * barWidth;

                                const barY = isStacked
                                  ? 360 - stackedAccY - barHeight
                                  : 360 - barHeight;

                                if (isStacked) {
                                  stackedAccY += barHeight;
                                }

                                const isHovered =
                                  hoveredPoint?.label === label &&
                                  hoveredPoint?.metricLabel === s.label;

                                const color = s.color || palette[sIdx % palette.length];

                                return (
                                  <g key={s.id}>
                                    <rect
                                      x={barX}
                                      y={barY}
                                      width={Math.max(1, barWidth - 2)}
                                      height={Math.max(1, barHeight)}
                                      rx="3"
                                      fill={`url(#grad_${paletteKey}_${sIdx % palette.length})`}
                                      stroke={color}
                                      strokeWidth={isHovered ? '2' : '1'}
                                      className="transition-all duration-150 cursor-pointer"
                                      filter={isHovered ? 'url(#glow)' : undefined}
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredPoint({
                                          label,
                                          metricLabel: s.label,
                                          value: val,
                                          color,
                                          clientX: rect.left + rect.width / 2,
                                          clientY: rect.top,
                                        });
                                      }}
                                      onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                    {showDataLabels && barHeight > 18 && (
                                      <text
                                        x={barX + (barWidth - 2) / 2}
                                        y={barY - 4}
                                        fill={chartTheme.labelValue}
                                        fontSize="9"
                                        fontWeight="bold"
                                        textAnchor="middle"
                                        pointerEvents="none"
                                      >
                                        {formatMetricValue(val, s.format, 0)}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}

                              {/* X Axis Category Label */}
                              <text
                                x={groupX + groupWidth / 2}
                                y="380"
                                fill={chartTheme.labelCategory}
                                fontSize="10"
                                fontWeight="medium"
                                textAnchor="middle"
                                className="truncate"
                              >
                                {label.length > 12 ? `${label.substring(0, 10)}…` : label}
                              </text>
                            </g>
                          );
                        });
                      })()}
                    </g>
                  )}

                  {/* 3. HORIZONTAL BAR CHART */}
                  {chartType === 'bar_horizontal' && (
                    <g transform="translate(120, 30)">
                      {(() => {
                        const { labels, series } = pivotResult;
                        const plotHeight = 380;
                        const plotWidth = 660;
                        const rowHeight = plotHeight / Math.max(labels.length, 1);
                        const palette = COLOR_PALETTES[paletteKey].colors;
                        const isStacked = stackingMode === 'stacked' && series.length > 1;

                        return labels.map((label, lIdx) => {
                          const rowY = lIdx * rowHeight;
                          let stackedAccX = 0;

                          return (
                            <g key={lIdx}>
                              {/* Row Y Label */}
                              <text
                                x="-12"
                                y={rowY + rowHeight / 2 + 4}
                                fill={chartTheme.labelCategory}
                                fontSize="10"
                                fontWeight="medium"
                                textAnchor="end"
                              >
                                {label.length > 16 ? `${label.substring(0, 14)}…` : label}
                              </text>

                              {series.map((s, sIdx) => {
                                const val = s.values[lIdx] || 0;
                                const barWidth = (val / yAxisMax) * plotWidth;
                                const barH = isStacked
                                  ? Math.min(rowHeight * 0.65, 24)
                                  : Math.min((rowHeight * 0.8) / series.length, 16);

                                const barY = isStacked
                                  ? rowY + (rowHeight - barH) / 2
                                  : rowY + (rowHeight - barH * series.length) / 2 + sIdx * barH;

                                const barX = isStacked ? stackedAccX : 0;
                                if (isStacked) stackedAccX += barWidth;

                                const color = s.color || palette[sIdx % palette.length];
                                const isHovered =
                                  hoveredPoint?.label === label &&
                                  hoveredPoint?.metricLabel === s.label;

                                return (
                                  <g key={s.id}>
                                    <rect
                                      x={barX}
                                      y={barY}
                                      width={Math.max(2, barWidth)}
                                      height={barH}
                                      rx="3"
                                      fill={color}
                                      stroke={isHovered ? (isBright ? '#0f172a' : '#ffffff') : color}
                                      strokeWidth={isHovered ? '2' : '1'}
                                      className="transition-all cursor-pointer"
                                      filter={isHovered ? 'url(#glow)' : undefined}
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredPoint({
                                          label,
                                          metricLabel: s.label,
                                          value: val,
                                          color,
                                          clientX: rect.left + rect.width / 2,
                                          clientY: rect.top,
                                        });
                                      }}
                                      onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                    {showDataLabels && barWidth > 20 && (
                                      <text
                                        x={barX + barWidth + 6}
                                        y={barY + barH / 2 + 3}
                                        fill={chartTheme.labelValue}
                                        fontSize="9"
                                        fontWeight="bold"
                                        pointerEvents="none"
                                      >
                                        {formatMetricValue(val, s.format, 0)}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        });
                      })()}
                    </g>
                  )}

                  {/* 4. LINE & AREA CHARTS */}
                  {(chartType === 'line' || chartType === 'area') && (
                    <g transform="translate(60, 40)">
                      {/* Gridlines */}
                      {showGridlines &&
                        [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                          const y = 360 - pct * 360;
                          const val = pct * yAxisMax;
                          return (
                            <g key={i}>
                              <line
                                x1="0"
                                y1={y}
                                x2="740"
                                y2={y}
                                stroke={chartTheme.gridline}
                                strokeDasharray={i === 0 ? 'none' : '4 4'}
                                strokeWidth="1"
                              />
                              <text
                                x="-10"
                                y={y + 4}
                                fill={chartTheme.axisText}
                                fontSize="10"
                                textAnchor="end"
                                fontFamily="monospace"
                              >
                                {formatMetricValue(val, metrics[0]?.format, 0)}
                              </text>
                            </g>
                          );
                        })}

                      {(() => {
                        const { labels, series } = pivotResult;
                        const plotWidth = 740;
                        const step = plotWidth / Math.max(labels.length - 1, 1);
                        const palette = COLOR_PALETTES[paletteKey].colors;

                        return (
                          <>
                            {series.map((s, sIdx) => {
                              const color = s.color || palette[sIdx % palette.length];
                              const points = labels.map((lbl, lIdx) => {
                                const val = s.values[lIdx] || 0;
                                const x = lIdx * step;
                                const y = 360 - (val / yAxisMax) * 360;
                                return { x, y, val, label: lbl };
                              });

                              // SVG path points string
                              const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                              const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} 360 L 0 360 Z`;

                              return (
                                <g key={s.id}>
                                  {/* Area Fill */}
                                  {chartType === 'area' && (
                                    <path
                                      d={areaPath}
                                      fill={`url(#grad_${paletteKey}_${sIdx % palette.length})`}
                                      opacity="0.6"
                                    />
                                  )}

                                  {/* Line Stroke */}
                                  <path
                                    d={linePath}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />

                                  {/* Point Markers */}
                                  {points.map((p, pIdx) => {
                                    const isHovered =
                                      hoveredPoint?.label === p.label &&
                                      hoveredPoint?.metricLabel === s.label;

                                    return (
                                      <g key={pIdx}>
                                        <circle
                                          cx={p.x}
                                          cy={p.y}
                                          r={isHovered ? 7 : 4.5}
                                          fill={color}
                                          stroke={chartTheme.markerStroke}
                                          strokeWidth="2"
                                          className="transition-all cursor-pointer"
                                          filter={isHovered ? 'url(#glow)' : undefined}
                                          onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredPoint({
                                              label: p.label,
                                              metricLabel: s.label,
                                              value: p.val,
                                              color,
                                              clientX: rect.left + rect.width / 2,
                                              clientY: rect.top,
                                            });
                                          }}
                                          onMouseLeave={() => setHoveredPoint(null)}
                                        />
                                        {showDataLabels && (
                                          <text
                                            x={p.x}
                                            y={p.y - 8}
                                            fill={chartTheme.labelValue}
                                            fontSize="9"
                                            fontWeight="bold"
                                            textAnchor="middle"
                                          >
                                            {formatMetricValue(p.val, s.format, 0)}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })}
                                </g>
                              );
                            })}

                            {/* X-axis labels */}
                            {labels.map((lbl, idx) => (
                              <text
                                key={idx}
                                x={idx * step}
                                y="380"
                                fill={chartTheme.labelCategory}
                                fontSize="10"
                                textAnchor="middle"
                              >
                                {lbl.length > 10 ? `${lbl.substring(0, 8)}…` : lbl}
                              </text>
                            ))}
                          </>
                        );
                      })()}
                    </g>
                  )}

                  {/* 5. SCATTER / BUBBLE PLOT */}
                  {chartType === 'scatter' && (
                    <g transform="translate(60, 40)">
                      {/* Gridlines */}
                      {showGridlines &&
                        [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                          const y = 360 - pct * 360;
                          return (
                            <line
                              key={i}
                              x1="0"
                              y1={y}
                              x2="740"
                              y2={y}
                              stroke={chartTheme.gridline}
                              strokeDasharray="4 4"
                            />
                          );
                        })}

                      {(() => {
                        const { labels, series } = pivotResult;
                        const plotWidth = 740;
                        const step = plotWidth / Math.max(labels.length, 1);
                        const palette = COLOR_PALETTES[paletteKey].colors;

                        return labels.map((lbl, idx) => {
                          const val = series[0]?.values[idx] || 0;
                          const x = idx * step + step / 2;
                          const y = 360 - (val / yAxisMax) * 360;
                          const radius = Math.min(24, Math.max(6, (val / yAxisMax) * 28));
                          const color = palette[idx % palette.length];

                          return (
                            <g key={idx}>
                              <circle
                                cx={x}
                                cy={y}
                                r={radius}
                                fill={color}
                                fillOpacity="0.75"
                                stroke={isBright ? '#f1f5f9' : '#ffffff'}
                                strokeWidth="1.5"
                                className="cursor-pointer transition-all hover:scale-125"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredPoint({
                                    label: lbl,
                                    metricLabel: series[0]?.label || 'Metric',
                                    value: val,
                                    color,
                                    clientX: rect.left + rect.width / 2,
                                    clientY: rect.top,
                                  });
                                }}
                                onMouseLeave={() => setHoveredPoint(null)}
                              />
                              <text
                                x={x}
                                y="380"
                                fill={chartTheme.labelCategory}
                                fontSize="9"
                                textAnchor="middle"
                              >
                                {lbl.length > 8 ? `${lbl.substring(0, 6)}…` : lbl}
                              </text>
                            </g>
                          );
                        });
                      })()}
                    </g>
                  )}

                  {/* 6. RADAR / SPIDER CHART */}
                  {chartType === 'radar' && (
                    <g transform="translate(430, 240)">
                      {(() => {
                        const { labels, series } = pivotResult;
                        const totalSides = Math.max(labels.length, 3);
                        const maxRadius = 160;
                        const palette = COLOR_PALETTES[paletteKey].colors;

                        // Circular polygon grid levels
                        const gridLevels = [0.25, 0.5, 0.75, 1];

                        return (
                          <>
                            {gridLevels.map((lvl) => {
                              const r = lvl * maxRadius;
                              const gridPoints = Array.from({ length: totalSides }).map((_, i) => {
                                const angle = (i * 2 * Math.PI) / totalSides - Math.PI / 2;
                                return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                              });
                              return (
                                <polygon
                                  key={lvl}
                                  points={gridPoints.join(' ')}
                                  fill="none"
                                  stroke={chartTheme.radarGrid}
                                  strokeWidth="1"
                                />
                              );
                            })}

                            {/* Axis radiating lines */}
                            {labels.map((lbl, i) => {
                              const angle = (i * 2 * Math.PI) / totalSides - Math.PI / 2;
                              const x = Math.cos(angle) * maxRadius;
                              const y = Math.sin(angle) * maxRadius;
                              const labelX = Math.cos(angle) * (maxRadius + 22);
                              const labelY = Math.sin(angle) * (maxRadius + 22);

                              return (
                                <g key={i}>
                                  <line x1="0" y1="0" x2={x} y2={y} stroke={chartTheme.radarSpoke} strokeWidth="1" />
                                  <text
                                    x={labelX}
                                    y={labelY + 4}
                                    fill={chartTheme.radarLabel}
                                    fontSize="10"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {lbl.length > 10 ? `${lbl.substring(0, 8)}…` : lbl}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Polygon Series */}
                            {series.map((s, sIdx) => {
                              const color = s.color || palette[sIdx % palette.length];
                              const seriesPoints = labels.map((_, i) => {
                                const val = s.values[i] || 0;
                                const r = (val / yAxisMax) * maxRadius;
                                const angle = (i * 2 * Math.PI) / totalSides - Math.PI / 2;
                                return `${Math.cos(angle) * r},${Math.sin(angle) * r}`;
                              });

                              return (
                                <polygon
                                  key={s.id}
                                  points={seriesPoints.join(' ')}
                                  fill={color}
                                  fillOpacity="0.4"
                                  stroke={color}
                                  strokeWidth="2.5"
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>

                {/* CHART LEGEND (Bottom / Inline) */}
                {showLegend && pivotResult.series.length > 0 && (
                  <div className={`flex items-center justify-center flex-wrap gap-4 mt-2 px-4 py-1.5 rounded-full border text-xs shadow-xs transition-colors ${
                    isBright
                      ? 'bg-white/95 border-slate-200 text-slate-700'
                      : 'bg-[#081024]/80 border-[#1b2b4d] text-slate-300'
                  }`}>
                    {pivotResult.series.map((s, idx) => {
                      const color = s.color || COLOR_PALETTES[paletteKey].colors[idx % COLOR_PALETTES[paletteKey].colors.length];
                      return (
                        <div key={s.id} className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className={`font-medium ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* INTERACTIVE FLOATING HOVER TOOLTIP */}
            {hoveredPoint && (
              <div
                className={`fixed pointer-events-none z-50 rounded-lg shadow-xl p-2.5 text-xs min-w-[160px] animate-in fade-in zoom-in-95 duration-100 border transition-colors ${
                  isBright
                    ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/60'
                    : 'bg-[#091329] border-[#233a6b] text-slate-100 shadow-2xl'
                }`}
                style={{
                  left: (hoveredPoint.clientX || 0) + 12,
                  top: (hoveredPoint.clientY || 0) - 20,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className={`flex items-center gap-1.5 font-bold border-b pb-1 mb-1.5 ${
                  isBright ? 'text-slate-800 border-slate-200' : 'text-slate-200 border-[#1b2f56]'
                }`}>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: hoveredPoint.color }}
                  />
                  <span className="truncate">{hoveredPoint.label}</span>
                </div>
                <div className={`flex items-center justify-between gap-3 ${
                  isBright ? 'text-slate-600' : 'text-slate-300'
                }`}>
                  <span className={isBright ? 'text-slate-500' : 'text-slate-400'}>{hoveredPoint.metricLabel}:</span>
                  <span className={`font-mono font-bold ${isBright ? 'text-slate-900' : 'text-white'}`}>
                    {formatMetricValue(hoveredPoint.value, metrics[0]?.format)}
                  </span>
                </div>
                {hoveredPoint.pct !== undefined && (
                  <div className={`flex items-center justify-between gap-3 text-[11px] mt-0.5 ${
                    isBright ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    <span>Share:</span>
                    <span className={`font-mono font-semibold ${isBright ? 'text-cyan-700' : 'text-cyan-300'}`}>{hoveredPoint.pct}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SAVE AGGREGATED TABLE MODAL */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-xl shadow-2xl w-full max-w-md p-5 animate-in zoom-in-95 duration-150 transition-colors ${
            isBright ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0b1428] border-[#1e3460] text-slate-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 mb-4 ${
              isBright ? 'border-slate-200' : 'border-[#182a4d]'
            }`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Save className="w-4 h-4 text-amber-500" />
                Save Aggregated Table to Database
              </h3>
              <button
                onClick={() => setSaveModalOpen(false)}
                className={`cursor-pointer ${isBright ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs mb-4 ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
              This registers your aggregated pivot result ({pivotResult.tableRows.length} rows) as a permanent table in your SheetSQL catalog for future queries and visual ERD relationships.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isBright ? 'text-slate-700' : 'text-slate-300'}`}>
                  Table Name:
                </label>
                <input
                  type="text"
                  value={saveTableName}
                  onChange={(e) => setSaveTableName(e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono border ${
                    isBright
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-[#060c18] border-[#213763] text-white'
                  }`}
                  placeholder="e.g. sales_by_country"
                />
              </div>

              {saveSuccessMsg && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                  isBright
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                }`}>
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSaveModalOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border ${
                  isBright
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-[#121f3d] hover:bg-[#1a2d58] text-slate-300 border-[#22355e]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSaveTable}
                disabled={!saveTableName.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Save Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
