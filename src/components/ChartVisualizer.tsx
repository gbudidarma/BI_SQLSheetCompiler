import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BarChartHorizontal,
  LineChart,
  PieChart,
  Layers,
  Columns3,
  TrendingUp,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  Filter,
  Check,
  ChevronDown
} from 'lucide-react';

interface ChartVisualizerProps {
  data: Record<string, any>[];
  columns: string[];
}

type ChartType = 'column' | 'bar' | 'line' | 'donut';
type StackingMode = 'grouped' | 'stacked';
type AggregationType = 'sum' | 'avg' | 'count' | 'max' | 'min' | 'raw';
type SortOption = 'default' | 'desc' | 'asc' | 'alpha';

// Color palette for charts
const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#E11D48', // Rose
];

export const ChartVisualizer: React.FC<ChartVisualizerProps> = ({ data, columns }) => {
  const [chartType, setChartType] = useState<ChartType>('column');
  const [stackingMode, setStackingMode] = useState<StackingMode>('grouped');
  const [aggregation, setAggregation] = useState<AggregationType>('sum');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [maxItems, setMaxItems] = useState<number>(20);
  const [hoveredItem, setHoveredItem] = useState<{
    label: string;
    metric: string;
    value: number;
    pct: number;
    x?: number;
    y?: number;
  } | null>(null);

  // Classify columns into numerics and categoricals with smart heuristic prioritization
  const { numerics, categoricals } = useMemo(() => {
    const numCols: string[] = [];
    const catCols: string[] = [];

    if (!data.length || !columns.length) return { numerics: numCols, categoricals: catCols };

    columns.forEach((col) => {
      let isNumeric = true;
      let nonNullCount = 0;

      for (let i = 0; i < Math.min(data.length, 50); i++) {
        const val = data[i][col];
        if (val !== null && val !== undefined && val !== '') {
          nonNullCount++;
          if (typeof val !== 'number' && isNaN(Number(val))) {
            isNumeric = false;
            break;
          }
        }
      }

      if (isNumeric && nonNullCount > 0) {
        numCols.push(col);
      } else {
        catCols.push(col);
      }
    });

    // Score and sort numerics so actual measures (amount, sales, price, total) come before IDs
    const measureKeywords = ['amount', 'sales', 'revenue', 'total', 'price', 'profit', 'cost', 'qty', 'count', 'val', 'net', 'sum', 'score'];
    const idKeywords = ['id', 'no', 'num', 'code', 'lat', 'long', 'zip', 'year'];

    numCols.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIsMeasure = measureKeywords.some((k) => aLower.includes(k));
      const bIsMeasure = measureKeywords.some((k) => bLower.includes(k));
      const aIsId = idKeywords.some((k) => aLower.includes(k));
      const bIsId = idKeywords.some((k) => bLower.includes(k));

      if (aIsMeasure && !bIsMeasure) return -1;
      if (!aIsMeasure && bIsMeasure) return 1;
      if (!aIsId && bIsId) return -1;
      if (aIsId && !bIsId) return 1;
      return 0;
    });

    // Score and sort categoricals so meaningful descriptions come first
    const descKeywords = ['name', 'desc', 'title', 'category', 'customer', 'product', 'type', 'label', 'city', 'country'];
    catCols.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIsDesc = descKeywords.some((k) => aLower.includes(k));
      const bIsDesc = descKeywords.some((k) => bLower.includes(k));
      if (aIsDesc && !bIsDesc) return -1;
      if (!aIsDesc && bIsDesc) return 1;
      return 0;
    });

    return { numerics: numCols, categoricals: catCols };
  }, [data, columns]);

  // Selected dimension (X-axis)
  const [labelCol, setLabelCol] = useState<string>(() => {
    return categoricals[0] || columns[0] || '';
  });

  // Selected metrics (Y-axis) - allow multiple metrics
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => {
    return numerics.length > 0 ? [numerics[0]] : columns[1] ? [columns[1]] : [columns[0]];
  });

  // Keep state synchronized if columns change
  React.useEffect(() => {
    if (!columns.includes(labelCol)) {
      setLabelCol(categoricals[0] || columns[0] || '');
    }
    const validMetrics = selectedMetrics.filter((m) => columns.includes(m));
    if (validMetrics.length === 0) {
      setSelectedMetrics(numerics.length > 0 ? [numerics[0]] : columns[1] ? [columns[1]] : [columns[0]]);
    } else if (validMetrics.length !== selectedMetrics.length) {
      setSelectedMetrics(validMetrics);
    }
  }, [columns, categoricals, numerics]);

  const toggleMetric = (col: string) => {
    if (selectedMetrics.includes(col)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((m) => m !== col));
      }
    } else {
      setSelectedMetrics([...selectedMetrics, col]);
    }
  };

  // Process data points with aggregation and grouping
  const processedSeries = useMemo(() => {
    if (!data.length || !labelCol || selectedMetrics.length === 0) {
      return { labels: [], series: [], stats: { sum: 0, avg: 0, max: 0, min: 0 } };
    }

    // Map each row value
    if (aggregation === 'raw') {
      const slice = data.slice(0, maxItems);
      const labels = slice.map((row, idx) => {
        const val = row[labelCol];
        return val !== null && val !== undefined ? String(val) : `#${idx + 1}`;
      });

      const series = selectedMetrics.map((metric, metricIdx) => {
        const values = slice.map((row) => {
          const raw = row[metric];
          return typeof raw === 'number' ? raw : parseFloat(raw) || 0;
        });
        return {
          metric,
          values,
          color: COLOR_PALETTE[metricIdx % COLOR_PALETTE.length],
        };
      });

      // Total sum for KPI
      const allVals = series.flatMap((s) => s.values);
      const sum = allVals.reduce((a, b) => a + b, 0);
      const max = allVals.length ? Math.max(...allVals) : 0;
      const min = allVals.length ? Math.min(...allVals) : 0;
      const avg = allVals.length ? sum / allVals.length : 0;

      return { labels, series, stats: { sum, avg, max, min } };
    }

    // Group by dimension to prevent duplicate category stacking
    interface GroupEntry {
      count: number;
      metrics: Record<string, number[]>;
    }
    const groupMap = new Map<string, GroupEntry>();

    data.forEach((row) => {
      const rawLabel = row[labelCol];
      const key = rawLabel !== null && rawLabel !== undefined && rawLabel !== '' ? String(rawLabel) : '(blank)';
      if (!groupMap.has(key)) {
        const metricObj: Record<string, number[]> = {};
        selectedMetrics.forEach((m) => (metricObj[m] = []));
        groupMap.set(key, { count: 0, metrics: metricObj });
      }
      const entry = groupMap.get(key)!;
      entry.count += 1;
      selectedMetrics.forEach((m) => {
        const raw = row[m];
        const num = typeof raw === 'number' ? raw : parseFloat(raw) || 0;
        if (!entry.metrics[m]) entry.metrics[m] = [];
        entry.metrics[m].push(num);
      });
    });

    let aggregatedEntries = Array.from(groupMap.entries()).map(([label, entry]) => {
      const metricValues: Record<string, number> = {};
      selectedMetrics.forEach((m) => {
        const vals = entry.metrics[m] || [];
        if (aggregation === 'sum') {
          metricValues[m] = vals.reduce((a, b) => a + b, 0);
        } else if (aggregation === 'avg') {
          metricValues[m] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        } else if (aggregation === 'max') {
          metricValues[m] = vals.length ? Math.max(...vals) : 0;
        } else if (aggregation === 'min') {
          metricValues[m] = vals.length ? Math.min(...vals) : 0;
        } else if (aggregation === 'count') {
          metricValues[m] = entry.count;
        }
      });
      return { label, metricValues, primaryValue: metricValues[selectedMetrics[0]] || 0 };
    });

    // Apply sorting
    if (sortOption === 'desc') {
      aggregatedEntries.sort((a, b) => b.primaryValue - a.primaryValue);
    } else if (sortOption === 'asc') {
      aggregatedEntries.sort((a, b) => a.primaryValue - b.primaryValue);
    } else if (sortOption === 'alpha') {
      aggregatedEntries.sort((a, b) => a.label.localeCompare(b.label));
    }

    // Limit items
    if (maxItems > 0 && aggregatedEntries.length > maxItems) {
      aggregatedEntries = aggregatedEntries.slice(0, maxItems);
    }

    const labels = aggregatedEntries.map((e) => e.label);
    const series = selectedMetrics.map((metric, metricIdx) => {
      const values = aggregatedEntries.map((e) => e.metricValues[metric]);
      return {
        metric,
        values,
        color: COLOR_PALETTE[metricIdx % COLOR_PALETTE.length],
      };
    });

    const allVals = series.flatMap((s) => s.values);
    const sum = allVals.reduce((a, b) => a + b, 0);
    const max = allVals.length ? Math.max(...allVals) : 0;
    const min = allVals.length ? Math.min(...allVals) : 0;
    const avg = allVals.length ? sum / allVals.length : 0;

    return { labels, series, stats: { sum, avg, max, min } };
  }, [data, labelCol, selectedMetrics, aggregation, sortOption, maxItems]);

  // Max value calculation based on stacking mode
  const yAxisMax = useMemo(() => {
    const { labels, series } = processedSeries;
    if (!labels.length || !series.length) return 100;

    if (stackingMode === 'stacked' && series.length > 1) {
      // Sum across metrics for each item
      let maxStacked = 0;
      for (let i = 0; i < labels.length; i++) {
        let total = 0;
        series.forEach((s) => {
          total += Math.max(0, s.values[i] || 0);
        });
        if (total > maxStacked) maxStacked = total;
      }
      return maxStacked > 0 ? maxStacked * 1.1 : 100;
    }

    // Grouped / Side-by-side mode: max single value
    const maxSingle = Math.max(...series.flatMap((s) => s.values), 1);
    return maxSingle * 1.1;
  }, [processedSeries, stackingMode]);

  if (!data.length || !columns.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full">
        <AlertCircle className="w-8 h-8 mb-2 text-slate-500" />
        <p className="text-sm">Run a query with numeric results to generate visualizations.</p>
      </div>
    );
  }

  // Calculate nicely formatted tick values for Y-axis
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => pct * yAxisMax);

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  // Helper for donut pie arcs
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeDonutArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 360) {
      endAngle = startAngle + 359.99;
    }
    const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
    const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
    const startInner = polarToCartesian(x, y, innerRadius, startAngle);
    const endInner = polarToCartesian(x, y, innerRadius, endAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', startOuter.x, startOuter.y,
      'A', outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
      'L', startInner.x, startInner.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 1, endInner.x, endInner.y,
      'Z'
    ].join(' ');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 bg-[#070e1c] text-slate-200">
      {/* Visualizer Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c162e] p-3 rounded-lg border border-[#182c54] shadow-sm">
        {/* Left: Chart Type Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-[#070e1c] rounded-md border border-[#162544]">
          <button
            onClick={() => setChartType('column')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              chartType === 'column' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vertical Column Chart (Side-by-side or stacked)"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Columns</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              chartType === 'bar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Horizontal Bar Chart"
          >
            <BarChartHorizontal className="w-3.5 h-3.5" />
            <span>Bars</span>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              chartType === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Trend Line / Area Chart"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Line</span>
          </button>
          <button
            onClick={() => setChartType('donut')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              chartType === 'donut' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Donut / Distribution Chart"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Donut</span>
          </button>
        </div>

        {/* Middle: Stacking & Layout Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-[#070e1c] rounded-md border border-[#162544] text-xs">
            <span className="text-slate-400 px-2 font-medium text-[11px] hidden sm:inline">Layout:</span>
            <button
              onClick={() => setStackingMode('grouped')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                stackingMode === 'grouped'
                  ? 'bg-[#182c54] text-blue-300 border border-blue-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Side-by-side (Grouped / Unstacked) bars - elements stand independently"
            >
              <Columns3 className="w-3 h-3 text-blue-400" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setStackingMode('stacked')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition cursor-pointer ${
                stackingMode === 'stacked'
                  ? 'bg-[#182c54] text-blue-300 border border-blue-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Stacked bars - segments cumulative on top of each other"
            >
              <Layers className="w-3 h-3 text-amber-400" />
              <span>Stacked</span>
            </button>
          </div>

          {/* Aggregation Mode Selector */}
          <div className="flex items-center gap-1 bg-[#070e1c] px-2 py-1 rounded-md border border-[#162544] text-xs">
            <span className="text-slate-400 text-[11px] font-medium hidden md:inline">Group:</span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value as AggregationType)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              title="Aggregation method across identical categories"
            >
              <option value="sum" className="bg-[#0b1429]">SUM (Group by Dimension)</option>
              <option value="avg" className="bg-[#0b1429]">AVERAGE</option>
              <option value="max" className="bg-[#0b1429]">MAX</option>
              <option value="min" className="bg-[#0b1429]">MIN</option>
              <option value="count" className="bg-[#0b1429]">COUNT</option>
              <option value="raw" className="bg-[#0b1429]">Raw Rows (No Grouping)</option>
            </select>
          </div>
        </div>

        {/* Right: Axis Controls & Sort */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Dimension Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Dimension (X):</span>
            <select
              value={labelCol}
              onChange={(e) => setLabelCol(e.target.value)}
              className="bg-[#0b1429] border border-[#182c54] text-slate-200 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px] truncate"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium hidden lg:inline">Sort:</span>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-[#0b1429] border border-[#182c54] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="default" className="bg-[#0b1429]">Query Order</option>
              <option value="desc" className="bg-[#0b1429]">Highest First</option>
              <option value="asc" className="bg-[#0b1429]">Lowest First</option>
              <option value="alpha" className="bg-[#0b1429]">Alphabetical</option>
            </select>
          </div>

          {/* Limit Items */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium hidden lg:inline">Top:</span>
            <select
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value))}
              className="bg-[#0b1429] border border-[#182c54] text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10} className="bg-[#0b1429]">Top 10</option>
              <option value={20} className="bg-[#0b1429]">Top 20</option>
              <option value={50} className="bg-[#0b1429]">Top 50</option>
              <option value={100} className="bg-[#0b1429]">Top 100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Selector Pills (Multi-metric support) */}
      <div className="flex items-center gap-2 flex-wrap text-xs bg-[#091224] p-2.5 rounded-lg border border-[#142649]">
        <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Metrics (Y):
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {numerics.map((col, idx) => {
            const isSelected = selectedMetrics.includes(col);
            const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
            return (
              <button
                key={col}
                onClick={() => toggleMetric(col)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer border ${
                  isSelected
                    ? 'bg-[#0f2347] border-blue-500 text-white shadow-xs'
                    : 'bg-[#070e1c] border-[#182c54] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? color : '#475569' }}
                />
                <span>{col}</span>
                {isSelected && <Check className="w-3 h-3 text-blue-400" />}
              </button>
            );
          })}
        </div>

        {/* Active Mode Notice */}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span className="bg-[#070e1c] px-2 py-0.5 rounded border border-[#162544]">
            {stackingMode === 'grouped' ? '✓ Side-by-Side (Unstacked)' : '⚠ Stacked'}
          </span>
          <span className="text-slate-500 hidden sm:inline">
            {processedSeries.labels.length} items shown
          </span>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0b162f] p-3 rounded-lg border border-[#182c54]">
          <div className="text-xs text-slate-400 font-medium">Total Sum</div>
          <div className="text-lg font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {processedSeries.stats.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#0b162f] p-3 rounded-lg border border-[#182c54]">
          <div className="text-xs text-slate-400 font-medium">Average</div>
          <div className="text-lg font-bold text-slate-100 font-mono tabular-nums mt-0.5">
            {processedSeries.stats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#0b162f] p-3 rounded-lg border border-[#182c54]">
          <div className="text-xs text-slate-400 font-medium">Maximum</div>
          <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
            {processedSeries.stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-[#0b162f] p-3 rounded-lg border border-[#182c54]">
          <div className="text-xs text-slate-400 font-medium">Minimum</div>
          <div className="text-lg font-bold text-amber-400 font-mono tabular-nums mt-0.5">
            {processedSeries.stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Chart Canvas Container */}
      <div className="bg-[#0b162f] border border-[#182c54] rounded-lg p-5 min-h-[380px] flex flex-col justify-center relative overflow-hidden">
        {/* Floating Tooltip Card */}
        {hoveredItem && (
          <div
            className="absolute z-30 pointer-events-none bg-[#070e1c]/95 backdrop-blur-xs border border-blue-500/60 shadow-xl shadow-black/80 p-2.5 rounded-lg text-xs space-y-1 transition-all duration-75"
            style={{
              left: `${Math.min(hoveredItem.x ?? 150, 680)}px`,
              top: `${Math.max(20, (hoveredItem.y ?? 100) - 70)}px`,
            }}
          >
            <div className="font-semibold text-slate-200 border-b border-[#182c54] pb-1 truncate max-w-[220px]">
              {hoveredItem.label}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">{hoveredItem.metric}:</span>
              <span className="font-mono font-bold text-blue-300 tabular-nums">
                {hoveredItem.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            {processedSeries.stats.sum > 0 && (
              <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
                <span>Share:</span>
                <span className="font-mono text-emerald-400 tabular-nums">
                  {((hoveredItem.value / processedSeries.stats.sum) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* 1. COLUMN CHART (VERTICAL BARS - SIDE-BY-SIDE OR STACKED) */}
        {chartType === 'column' && (
          <div className="w-full flex flex-col h-[340px]">
            {/* Chart Area with Y-axis */}
            <div className="flex-1 flex min-h-0">
              {/* Left Y-Axis Scale */}
              <div className="w-16 flex flex-col justify-between text-right pr-3 text-[11px] font-mono text-slate-400 select-none pb-8 shrink-0">
                {yTicks.slice().reverse().map((t, i) => (
                  <div key={i} className="truncate">
                    {formatNumber(t)}
                  </div>
                ))}
              </div>

              {/* Columns Canvas (Horizontal scrollable if many bars) */}
              <div className="flex-1 overflow-x-auto relative flex flex-col justify-between">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                  {yTicks.map((_, i) => (
                    <div key={i} className="w-full border-b border-[#162544]/70 border-dashed" />
                  ))}
                </div>

                {/* Bars Container */}
                <div
                  className="flex-1 flex items-end gap-3 px-3 relative z-10 pb-8 min-h-0"
                  style={{
                    minWidth: `${Math.max(100, processedSeries.labels.length * (selectedMetrics.length > 1 && stackingMode === 'grouped' ? 56 : 38))}px`,
                  }}
                >
                  {processedSeries.labels.map((label, labelIdx) => {
                    const seriesList = processedSeries.series;

                    if (stackingMode === 'stacked' && seriesList.length > 1) {
                      // Stacked: Bars placed on top of each other
                      let currentBottomPct = 0;
                      return (
                        <div
                          key={labelIdx}
                          className="flex-1 flex flex-col justify-end items-center h-full relative group min-w-[24px]"
                        >
                          <div className="w-full max-w-[36px] h-full flex flex-col justify-end relative">
                            {seriesList.map((s, sIdx) => {
                              const val = s.values[labelIdx] || 0;
                              const heightPct = yAxisMax > 0 ? (val / yAxisMax) * 100 : 0;
                              return (
                                <div
                                  key={sIdx}
                                  className="w-full rounded-xs transition-all duration-200 hover:brightness-125 cursor-pointer relative"
                                  style={{
                                    height: `${Math.max(val > 0 ? 3 : 0, heightPct)}%`,
                                    backgroundColor: s.color,
                                  }}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoveredItem({
                                      label,
                                      metric: s.metric,
                                      value: val,
                                      pct: processedSeries.stats.sum > 0 ? (val / processedSeries.stats.sum) * 100 : 0,
                                      x: rect.left,
                                      y: rect.top,
                                    });
                                  }}
                                  onMouseLeave={() => setHoveredItem(null)}
                                />
                              );
                            })}
                          </div>
                          {/* Label below bar */}
                          <div
                            className="absolute -bottom-7 w-20 text-center text-[10px] text-slate-400 group-hover:text-slate-200 truncate select-none"
                            title={label}
                          >
                            {label}
                          </div>
                        </div>
                      );
                    }

                    // Grouped / Side-by-Side: Bars placed beside each other!
                    return (
                      <div
                        key={labelIdx}
                        className="flex-1 flex flex-col justify-end items-center h-full relative group min-w-[30px]"
                      >
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          {seriesList.map((s, sIdx) => {
                            const val = s.values[labelIdx] || 0;
                            const heightPct = yAxisMax > 0 ? (val / yAxisMax) * 100 : 0;
                            return (
                              <div
                                key={sIdx}
                                className="flex-1 max-w-[24px] rounded-t-sm transition-all duration-200 hover:brightness-125 cursor-pointer relative"
                                style={{
                                  height: `${Math.max(val > 0 ? 3 : 0, heightPct)}%`,
                                  backgroundColor: s.color,
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredItem({
                                    label,
                                    metric: s.metric,
                                    value: val,
                                    pct: processedSeries.stats.sum > 0 ? (val / processedSeries.stats.sum) * 100 : 0,
                                    x: rect.left,
                                    y: rect.top,
                                  });
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                              />
                            );
                          })}
                        </div>
                        {/* Label below bar */}
                        <div
                          className="absolute -bottom-7 w-20 text-center text-[10px] text-slate-400 group-hover:text-slate-200 truncate select-none"
                          title={label}
                        >
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend if multiple metrics */}
            {processedSeries.series.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-[#162544] text-xs">
                {processedSeries.series.map((s) => (
                  <div key={s.metric} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-slate-300 font-mono text-[11px]">{s.metric}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. HORIZONTAL BAR CHART (SIDE-BY-SIDE OR STACKED) */}
        {chartType === 'bar' && (
          <div className="w-full space-y-2.5 max-h-[460px] overflow-y-auto pr-2">
            {processedSeries.labels.map((label, labelIdx) => {
              const seriesList = processedSeries.series;

              return (
                <div key={labelIdx} className="group flex items-center gap-3 text-xs">
                  {/* Label */}
                  <div className="w-36 text-right truncate text-slate-300 font-medium shrink-0" title={label}>
                    {label}
                  </div>

                  {/* Horizontal Bar Track */}
                  <div className="flex-1 bg-[#050a14] h-7 rounded overflow-hidden relative border border-[#162544] flex items-center p-0.5">
                    {stackingMode === 'stacked' && seriesList.length > 1 ? (
                      // Stacked horizontally
                      seriesList.map((s, sIdx) => {
                        const val = s.values[labelIdx] || 0;
                        const widthPct = yAxisMax > 0 ? (val / yAxisMax) * 100 : 0;
                        return (
                          <div
                            key={sIdx}
                            className="h-full transition-all duration-300 hover:brightness-125 cursor-pointer flex items-center px-1.5 relative first:rounded-l last:rounded-r"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: s.color,
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredItem({
                                label,
                                metric: s.metric,
                                value: val,
                                pct: processedSeries.stats.sum > 0 ? (val / processedSeries.stats.sum) * 100 : 0,
                                x: rect.left,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {widthPct > 8 && (
                              <span className="text-[10px] font-mono tabular-nums text-white font-semibold truncate drop-shadow">
                                {formatNumber(val)}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      // Grouped / Side-by-side or Single metric
                      <div className="w-full flex flex-col justify-center gap-0.5 h-full">
                        {seriesList.map((s, sIdx) => {
                          const val = s.values[labelIdx] || 0;
                          const widthPct = yAxisMax > 0 ? Math.max(1, (val / yAxisMax) * 100) : 0;
                          return (
                            <div
                              key={sIdx}
                              className="h-full rounded transition-all duration-300 hover:brightness-125 cursor-pointer flex items-center px-2 relative"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: s.color,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredItem({
                                  label,
                                  metric: s.metric,
                                  value: val,
                                  pct: processedSeries.stats.sum > 0 ? (val / processedSeries.stats.sum) * 100 : 0,
                                  x: rect.left,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setHoveredItem(null)}
                            >
                              <span className="text-[11px] font-mono tabular-nums font-semibold text-white drop-shadow whitespace-nowrap">
                                {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. TREND LINE / AREA CHART */}
        {chartType === 'line' && (
          <div className="w-full h-[320px] flex flex-col">
            <div className="flex-1 flex min-h-0">
              {/* Left Y-axis */}
              <div className="w-16 flex flex-col justify-between text-right pr-3 text-[11px] font-mono text-slate-400 select-none pb-8 shrink-0">
                {yTicks.slice().reverse().map((t, i) => (
                  <div key={i} className="truncate">
                    {formatNumber(t)}
                  </div>
                ))}
              </div>

              {/* Line Canvas */}
              <div className="flex-1 overflow-x-auto relative">
                {(() => {
                  const ptCount = processedSeries.labels.length;
                  const stepX = 54;
                  const canvasWidth = Math.max(600, ptCount * stepX + 60);
                  const canvasHeight = 240;
                  const bottomPad = 30;
                  const usableHeight = canvasHeight - bottomPad;

                  return (
                    <svg
                      className="h-full overflow-visible"
                      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                      style={{ width: `${canvasWidth}px` }}
                    >
                      <defs>
                        <linearGradient id="lineFillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {yTicks.map((_, i) => {
                        const y = usableHeight - (i / (yTicks.length - 1)) * usableHeight;
                        return (
                          <line
                            key={i}
                            x1="20"
                            y1={y}
                            x2={canvasWidth - 20}
                            y2={y}
                            stroke="#182c54"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                        );
                      })}

                      {/* Series Lines */}
                      {processedSeries.series.map((s, sIdx) => {
                        if (s.values.length < 2) return null;

                        const pts = s.values.map((v, i) => {
                          const x = 40 + i * stepX;
                          const y = yAxisMax > 0 ? usableHeight - (v / yAxisMax) * usableHeight : usableHeight;
                          return { x, y, value: v, label: processedSeries.labels[i] };
                        });

                        const linePath = pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
                        const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${usableHeight} L ${pts[0].x} ${usableHeight} Z`;

                        return (
                          <g key={s.metric}>
                            {/* Area fill for primary metric */}
                            {sIdx === 0 && <path d={areaPath} fill="url(#lineFillGrad)" />}

                            {/* Main Stroke Line */}
                            <path
                              d={linePath}
                              fill="none"
                              stroke={s.color}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Point Dots & Clean Labels */}
                            {pts.map((p, i) => (
                              <g
                                key={i}
                                className="cursor-pointer group"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredItem({
                                    label: p.label,
                                    metric: s.metric,
                                    value: p.value,
                                    pct: processedSeries.stats.sum > 0 ? (p.value / processedSeries.stats.sum) * 100 : 0,
                                    x: rect.left,
                                    y: rect.top,
                                  });
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="4"
                                  fill={s.color}
                                  stroke="#070e1c"
                                  strokeWidth="2"
                                  className="transition-transform group-hover:scale-150"
                                />

                                {/* X-axis Tick label (Only if single series or bottom) */}
                                {sIdx === 0 && (
                                  <text
                                    x={p.x}
                                    y={canvasHeight - 8}
                                    textAnchor="middle"
                                    fill="#94A3B8"
                                    fontSize="10"
                                    fontFamily="monospace"
                                  >
                                    {p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label}
                                  </text>
                                )}
                              </g>
                            ))}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* 4. DONUT / PIE DISTRIBUTION CHART */}
        {chartType === 'donut' && (
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
            {/* Donut representation */}
            <div className="relative w-56 h-56 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 200 200">
                {(() => {
                  const s = processedSeries.series[0];
                  if (!s || !s.values.length) return null;

                  const total = s.values.reduce((a, b) => a + Math.max(0, b), 0);
                  if (total <= 0) return null;

                  let currentAngle = 0;
                  const slices = processedSeries.labels.slice(0, 12).map((label, i) => {
                    const val = Math.max(0, s.values[i] || 0);
                    const angle = (val / total) * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle = endAngle;

                    const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
                    const pathD = describeDonutArc(100, 100, 52, 90, startAngle, endAngle);

                    return {
                      label,
                      val,
                      color,
                      pathD,
                      pct: (val / total) * 100,
                    };
                  });

                  return slices.map((sl, i) => (
                    <path
                      key={i}
                      d={sl.pathD}
                      fill={sl.color}
                      className="transition-all duration-200 hover:opacity-85 hover:stroke-white hover:stroke-1 cursor-pointer"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredItem({
                          label: sl.label,
                          metric: s.metric,
                          value: sl.val,
                          pct: sl.pct,
                          x: rect.left,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                    />
                  ));
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[11px] text-slate-400 font-medium">Total</span>
                <span className="text-sm font-bold text-slate-100 font-mono tabular-nums">
                  {formatNumber(processedSeries.stats.sum)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {processedSeries.labels.length} segments
                </span>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto w-full max-w-md pr-2">
              {processedSeries.labels.slice(0, 12).map((label, i) => {
                const s = processedSeries.series[0];
                const val = s?.values[i] || 0;
                const total = processedSeries.stats.sum;
                const pct = total > 0 ? (val / total) * 100 : 0;
                const color = COLOR_PALETTE[i % COLOR_PALETTE.length];

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 bg-[#070e1c] p-2 rounded border border-[#182c54] hover:border-blue-500 transition cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredItem({
                        label,
                        metric: s?.metric || '',
                        value: val,
                        pct,
                      })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-slate-300 truncate" title={label}>{label}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400 font-semibold shrink-0">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
