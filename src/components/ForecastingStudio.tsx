/**
 * ForecastingStudio.tsx
 * Complete Interactive Time-Series Forecasting & Predictive Modeling Studio:
 * - Statistical Methods: Auto-Select Best Fit, Holt's Linear Trend, Holt-Winters Seasonal,
 *   Linear Trend Regression (OLS), Moving Average, and Simple Exponential Smoothing (SES)
 * - Prediction intervals (80% & 95% confidence bands)
 * - Interactive SVG time series chart with hover tooltips and confidence cone
 * - Diagnostics: MAPE, RMSE, MAE, R², Trend Slope, Growth Rate
 * - Actions: Save Forecast as Table, Export to Excel/CSV, Generate Forecast SQL & Query in Studio
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  LineChart as LineChartIcon,
  Sparkles,
  Calendar,
  Sigma,
  Sliders,
  Play,
  RotateCcw,
  Download,
  Save,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Code2,
  Table as TableIcon,
  HelpCircle,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  Hash,
  Database
} from 'lucide-react';
import { TableSchema, ColumnInfo } from '../types';
import {
  ForecastMethod,
  ForecastTimeGrain,
  ForecastResult,
  prepareTimeSeries,
  executeForecast,
  generateForecastSqlQuery,
} from '../utils/forecastingEngine';
import { isDateColumnName, tryNormalizeDate } from '../utils/dateNormalizer';
import { exportToExcel, exportToCsv } from '../utils/exportHelper';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface ForecastingStudioProps {
  tables: TableSchema[];
  onOpenInSqlEditor?: (sql: string) => void;
  onSwitchToStudio?: () => void;
  onSaveAsTable?: (tableName: string, data: Record<string, any>[]) => void;
  onRegisterTables?: (
    newItems: { schema: TableSchema; rows: Record<string, any>[] }[]
  ) => void;
  onLoadSampleDataset?: (datasetId: string) => void;
}

export const ForecastingStudio: React.FC<ForecastingStudioProps> = ({
  tables,
  onOpenInSqlEditor,
  onSwitchToStudio,
  onSaveAsTable,
  onRegisterTables,
  onLoadSampleDataset,
}) => {
  const { isBright } = useTheme();

  // 1. Table Selection
  const [selectedTableName, setSelectedTableName] = useState<string>(() => {
    return tables[0]?.name || '';
  });

  useEffect(() => {
    if (tables.length > 0 && !tables.some((t) => t.name === selectedTableName)) {
      setSelectedTableName(tables[0].name);
    }
  }, [tables, selectedTableName]);

  const selectedTable = useMemo(() => {
    return tables.find((t) => t.name === selectedTableName) || null;
  }, [tables, selectedTableName]);

  // Extract candidate date and value columns
  const tableColumns = useMemo(() => {
    return selectedTable?.columns || [];
  }, [selectedTable]);

  const dateColumns = useMemo(() => {
    return tableColumns.filter(
      (c) => c.type === 'DATE' || isDateColumnName(c.name)
    );
  }, [tableColumns]);

  const measureColumns = useMemo(() => {
    return tableColumns.filter(
      (c) =>
        c.type === 'FLOAT' ||
        c.type === 'INTEGER' ||
        /amount|price|revenue|sales|qty|quantity|total|cost|profit|units|val|score/i.test(c.name)
    );
  }, [tableColumns]);

  // 2. Forecasting Inputs
  const [dateColumn, setDateColumn] = useState<string>('');
  const [valueColumn, setValueColumn] = useState<string>('');
  const [grain, setGrain] = useState<ForecastTimeGrain>('day');
  const [horizon, setHorizon] = useState<number>(30);
  const [method, setMethod] = useState<ForecastMethod>('auto');

  // Advanced Tuning Parameters
  const [showTuning, setShowTuning] = useState<boolean>(false);
  const [alpha, setAlpha] = useState<number>(0.35);
  const [beta, setBeta] = useState<number>(0.15);
  const [gamma, setGamma] = useState<number>(0.25);
  const [windowSize, setWindowSize] = useState<number>(7);
  const [seasonLength, setSeasonLength] = useState<number>(7);

  // Active Bottom Tab
  const [activeBottomTab, setActiveBottomTab] = useState<'chart_table' | 'sql' | 'diagnostics'>('chart_table');
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Auto-select initial columns when table changes
  useEffect(() => {
    if (tableColumns.length > 0) {
      const bestDate = dateColumns[0]?.name || tableColumns.find((c) => isDateColumnName(c.name))?.name || tableColumns[0].name;
      const bestVal = measureColumns[0]?.name || tableColumns.find((c) => c.type === 'FLOAT' || c.type === 'INTEGER')?.name || tableColumns[1]?.name || tableColumns[0].name;
      setDateColumn(bestDate);
      setValueColumn(bestVal);
    }
  }, [selectedTableName, tableColumns, dateColumns, measureColumns]);

  // Extract table rows from selected table
  const rawRows = useMemo(() => {
    if (!selectedTable) return [];
    return selectedTable.allRows && selectedTable.allRows.length > 0
      ? selectedTable.allRows
      : selectedTable.previewRows;
  }, [selectedTable]);

  // Prepare aggregated time series
  const historicalSeries = useMemo(() => {
    if (!rawRows || rawRows.length === 0 || !dateColumn || !valueColumn) return [];
    return prepareTimeSeries(rawRows, dateColumn, valueColumn, grain);
  }, [rawRows, dateColumn, valueColumn, grain]);

  // Execute Forecast Model
  const forecastResult: ForecastResult = useMemo(() => {
    if (historicalSeries.length === 0) {
      return {
        series: [],
        metrics: {
          mape: 0,
          rmse: 0,
          mae: 0,
          r2: 0,
          slope: 0,
          growthRatePct: 0,
          historicalCount: 0,
          forecastCount: 0,
          methodUsed: method,
          methodName: 'No Data',
        },
        historicalTotal: 0,
        forecastTotal: 0,
        methodName: 'No Data',
        methodExplanation: 'Please select a table with historical date and metric columns.',
        equationOrParams: 'N/A',
      };
    }

    return executeForecast(historicalSeries, method, horizon, grain, {
      alpha,
      beta,
      gamma,
      windowSize,
      seasonLength,
    });
  }, [historicalSeries, method, horizon, grain, alpha, beta, gamma, windowSize, seasonLength]);

  // Generated Forecast SQL
  const forecastSql = useMemo(() => {
    return generateForecastSqlQuery(selectedTableName, dateColumn, valueColumn, horizon);
  }, [selectedTableName, dateColumn, valueColumn, horizon]);

  // Chart Dimensions & Scales
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: any;
    x: number;
    y: number;
  } | null>(null);

  const chartPoints = forecastResult.series;

  const chartBounds = useMemo(() => {
    if (chartPoints.length === 0) return { minVal: 0, maxVal: 100 };
    let min = Infinity;
    let max = -Infinity;

    chartPoints.forEach((p) => {
      const candidates = [p.actual, p.forecast, p.upper95, p.lower95].filter(
        (v) => v !== undefined && v !== null && !isNaN(v)
      ) as number[];
      candidates.forEach((c) => {
        if (c < min) min = c;
        if (c > max) max = c;
      });
    });

    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 100;
    const padding = (max - min) * 0.1 || 10;
    return { minVal: Math.max(0, min - padding), maxVal: max + padding };
  }, [chartPoints]);

  // Save Forecast as New Table
  const handleSaveForecastTable = () => {
    const tableName = `forecast_${selectedTableName}_${horizon}${grain[0]}`;
    const futureOnly = chartPoints.filter((p) => p.isForecast);

    const dataToSave = futureOnly.map((p) => ({
      period_date: p.dateStr,
      forecast_value: p.forecast,
      lower_bound_95: p.lower95,
      upper_bound_95: p.upper95,
      lower_bound_80: p.lower80,
      upper_bound_80: p.upper80,
      forecast_method: forecastResult.methodName,
    }));

    if (onSaveAsTable) {
      onSaveAsTable(tableName, dataToSave);
      setSavedSuccess(tableName);
      setTimeout(() => setSavedSuccess(null), 5000);
    }
  };

  // Export handlers
  const handleExport = (format: 'xlsx' | 'csv') => {
    const filename = `forecast_${selectedTableName}_${horizon}_periods`;
    const rows = chartPoints.map((p) => ({
      period_index: p.periodIndex,
      date: p.dateStr,
      is_forecast: p.isForecast ? 'YES' : 'NO',
      actual_value: p.actual ?? '',
      forecast_value: p.forecast ?? '',
      lower_bound_95: p.lower95 ?? '',
      upper_bound_95: p.upper95 ?? '',
      lower_bound_80: p.lower80 ?? '',
      upper_bound_80: p.upper80 ?? '',
    }));
    const cols = [
      'period_index',
      'date',
      'is_forecast',
      'actual_value',
      'forecast_value',
      'lower_bound_95',
      'upper_bound_95',
      'lower_bound_80',
      'upper_bound_80',
    ];

    if (format === 'xlsx') {
      exportToExcel(rows, cols, filename);
    } else {
      exportToCsv(rows, cols, filename);
    }
  };

  // Zero State: No tables loaded
  if (tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-[#070d1a]">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4 shadow-inner">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold">Predictive Forecasting & Trend Studio</h2>
        <p className={`text-xs max-w-md mt-2 mb-6 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
          Apply mathematical time-series models (Holt's Linear Trend, Holt-Winters Seasonal, Exponential Smoothing,
          and Linear Regression) to project future demand, sales, revenue, and KPIs.
        </p>

        {onLoadSampleDataset && (
          <button
            onClick={() => onLoadSampleDataset('sales_dw')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer transition hover:shadow-blue-500/25"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Load Sample Sales Dataset to Forecast</span>
          </button>
        )}
      </div>
    );
  }

  // SVG Chart Dimensions
  const chartW = 900;
  const chartH = 320;
  const padL = 60;
  const padR = 30;
  const padT = 30;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const getX = (idx: number) => {
    const total = chartPoints.length;
    if (total <= 1) return padL;
    return padL + (idx / (total - 1)) * innerW;
  };

  const getY = (val: number) => {
    const range = chartBounds.maxVal - chartBounds.minVal || 1;
    const norm = (val - chartBounds.minVal) / range;
    return padT + (1 - norm) * innerH;
  };

  // Generate SVG Path for Actuals
  const actualPoints = chartPoints.filter((p) => !p.isForecast && p.actual !== undefined);
  const actualPath = actualPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.actual!).toFixed(1)}`)
    .join(' ');

  // Generate SVG Path for Forecast
  const forecastOnlyPoints = chartPoints.filter((p) => p.isForecast);
  const lastActualIdx = actualPoints.length - 1;
  const lastActualVal = actualPoints[lastActualIdx]?.actual ?? actualPoints[lastActualIdx]?.forecast ?? 0;

  let forecastPath = '';
  if (lastActualIdx >= 0) {
    forecastPath = `M ${getX(lastActualIdx).toFixed(1)} ${getY(lastActualVal).toFixed(1)}`;
    forecastOnlyPoints.forEach((p) => {
      const idx = p.periodIndex - 1;
      forecastPath += ` L ${getX(idx).toFixed(1)} ${getY(p.forecast!).toFixed(1)}`;
    });
  }

  // Confidence Interval 95% Band Polygon
  let confidence95Path = '';
  if (forecastOnlyPoints.length > 0 && lastActualIdx >= 0) {
    const startX = getX(lastActualIdx).toFixed(1);
    const startY = getY(lastActualVal).toFixed(1);
    let topPath = `M ${startX} ${startY}`;
    let btmPath = '';

    forecastOnlyPoints.forEach((p) => {
      const idx = p.periodIndex - 1;
      const x = getX(idx).toFixed(1);
      const topY = getY(p.upper95!).toFixed(1);
      const btmY = getY(p.lower95!).toFixed(1);
      topPath += ` L ${x} ${topY}`;
      btmPath = ` L ${x} ${btmY}` + btmPath;
    });

    confidence95Path = `${topPath}${btmPath} Z`;
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-[#070d1a] text-slate-100">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isBright ? 'bg-white border-slate-200' : 'bg-[#0a1226] border-[#182747]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight">Forecasting Studio</h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                Predictive ML / Stat
              </span>
            </div>
            <p className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
              Statistical time-series models with confidence bands and auto-tuned algorithms.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveForecastTable}
            disabled={chartPoints.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              savedSuccess
                ? 'bg-purple-600 text-white border-purple-500'
                : isBright
                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
            }`}
            title="Register forecast projection into workspace table catalog"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5 text-purple-400" />}
            <span>{savedSuccess ? 'Table Saved!' : 'Save as Table'}</span>
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={chartPoints.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow"
            title="Export forecast dataset to Excel workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {onOpenInSqlEditor && (
            <button
              onClick={() => {
                onOpenInSqlEditor(forecastSql);
                if (onSwitchToStudio) onSwitchToStudio();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow"
              title="Open time-series regression query in SQL Studio"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Query in Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CONFIGURATION & MODEL PARAMETERS BAR */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`p-4 border-b space-y-3 shrink-0 ${
          isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#080f20] border-[#182747]'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* 1. Source Table */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              1. Source Table
            </label>
            <div className="relative">
              <select
                value={selectedTableName}
                onChange={(e) => setSelectedTableName(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold border cursor-pointer ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-slate-200'
                }`}
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Date Column */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              2. Date / Period Column
            </label>
            <div className="relative">
              <select
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold border cursor-pointer font-mono ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-purple-300'
                }`}
              >
                {tableColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    📅 {c.name} {c.type === 'DATE' ? '(Date)' : `(${c.type})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Metric Column */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              3. Metric to Forecast
            </label>
            <div className="relative">
              <select
                value={valueColumn}
                onChange={(e) => setValueColumn(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-semibold border cursor-pointer font-mono ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-blue-300'
                }`}
              >
                {tableColumns.map((c) => (
                  <option key={c.name} value={c.name}>
                    Σ {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Forecasting Method */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              4. Forecasting Model
            </label>
            <div className="relative">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ForecastMethod)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-bold border cursor-pointer ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-cyan-300'
                }`}
              >
                <option value="auto">🌟 Auto-Select Best Fit (MAPE)</option>
                <option value="holt_linear">📈 Holt's Linear Trend (Double Exp)</option>
                <option value="holt_winters">🔄 Holt-Winters Seasonal</option>
                <option value="linear_regression">📉 Linear Regression (OLS Trend)</option>
                <option value="moving_average">📊 Moving Average (SMA)</option>
                <option value="exponential_smoothing">〰️ Simple Exp Smoothing (SES)</option>
              </select>
            </div>
          </div>

          {/* 5. Horizon & Grain */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              5. Horizon & Time Grain
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
                className={`w-24 rounded-lg px-2 py-1.5 text-xs font-semibold border cursor-pointer ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-slate-200'
                }`}
              >
                <option value="7">7 periods</option>
                <option value="14">14 periods</option>
                <option value="30">30 periods</option>
                <option value="60">60 periods</option>
                <option value="90">90 periods</option>
                <option value="180">180 periods</option>
                <option value="365">365 periods</option>
              </select>

              <select
                value={grain}
                onChange={(e) => setGrain(e.target.value as ForecastTimeGrain)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold border cursor-pointer ${
                  isBright
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-[#122347] border-[#223d75] text-slate-200'
                }`}
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>

              <button
                onClick={() => setShowTuning(!showTuning)}
                className={`p-1.5 rounded-lg border cursor-pointer transition ${
                  showTuning
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-[#122347] border-[#223d75] text-slate-400 hover:text-white'
                }`}
                title="Toggle Advanced Hyperparameters"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Hyperparameter Tuning Drawer */}
        {showTuning && (
          <div className="p-3 rounded-xl bg-[#060c18] border border-[#1b2f57] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Level Smoothing (α):</span>
                <span className="font-mono text-cyan-400">{alpha.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Trend Smoothing (β):</span>
                <span className="font-mono text-cyan-400">{beta.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.95"
                step="0.02"
                value={beta}
                onChange={(e) => setBeta(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Seasonal Smoothing (γ):</span>
                <span className="font-mono text-cyan-400">{gamma.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.05"
                value={gamma}
                onChange={(e) => setGamma(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Season Cycle Length (s):</span>
                <span className="font-mono text-cyan-400">{seasonLength}</span>
              </div>
              <input
                type="range"
                min="2"
                max="30"
                step="1"
                value={seasonLength}
                onChange={(e) => setSeasonLength(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DIAGNOSTIC SCORECARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
        {/* Metric 1: Selected Model */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Model
          </span>
          <div className="mt-1">
            <div className="text-xs font-bold text-cyan-400 truncate" title={forecastResult.methodName}>
              {forecastResult.methodName}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {forecastResult.equationOrParams}
            </div>
          </div>
        </div>

        {/* Metric 2: MAPE Accuracy */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            MAPE Error Rate
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-lg font-bold font-mono ${
                forecastResult.metrics.mape < 10
                  ? 'text-emerald-400'
                  : forecastResult.metrics.mape < 25
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {forecastResult.metrics.mape}%
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {forecastResult.metrics.mape < 10
                ? '(High Precision)'
                : forecastResult.metrics.mape < 25
                ? '(Acceptable)'
                : '(Volatile)'}
            </span>
          </div>
        </div>

        {/* Metric 3: RMSE */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            RMSE & MAE Error
          </span>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-purple-400">
              ±{forecastResult.metrics.rmse.toLocaleString()}
            </span>
            <div className="text-[10px] text-slate-500">
              MAE: {forecastResult.metrics.mae.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Metric 4: Projected Horizon Growth */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Projected Growth
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-lg font-bold font-mono ${
                forecastResult.metrics.growthRatePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {forecastResult.metrics.growthRatePct >= 0 ? '+' : ''}
              {forecastResult.metrics.growthRatePct}%
            </span>
            <span className="text-[10px] text-slate-500">
              ({forecastResult.metrics.slope >= 0 ? '+' : ''}
              {forecastResult.metrics.slope}/period)
            </span>
          </div>
        </div>

        {/* Metric 5: Projected Volume */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Projected Total Volume
          </span>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono text-blue-400">
              {forecastResult.forecastTotal.toLocaleString()}
            </span>
            <div className="text-[10px] text-slate-500">
              Over {horizon} {grain}s
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* INTERACTIVE TIME SERIES FORECAST SVG CHART */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 pb-2 shrink-0">
        <div
          className={`p-4 rounded-xl border flex flex-col ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          {/* Chart Header & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Time-Series Trajectory & Forecast Cone
              </h3>
              <p className={`text-[11px] ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                {forecastResult.methodExplanation}
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-blue-500 inline-block rounded-full" />
                <span className="text-slate-300">Historical Actuals ({historicalSeries.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-cyan-400 inline-block border-b-2 border-dashed border-cyan-400" />
                <span className="text-cyan-300 font-semibold">Forecast ({horizon})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-cyan-500/20 border border-cyan-500/40 inline-block rounded-xs" />
                <span className="text-slate-400 text-[10px]">95% Confidence Band</span>
              </div>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="w-full overflow-x-auto relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-72 select-none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                {/* Confidence Interval Gradient */}
                <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                  <stop offset="50%" stopColor="#0891b2" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0e7490" stopOpacity="0.05" />
                </linearGradient>

                {/* Historical Area Gradient */}
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padT + pct * innerH;
                const val = chartBounds.maxVal - pct * (chartBounds.maxVal - chartBounds.minVal);
                return (
                  <g key={pct}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={padL + innerW}
                      y2={y}
                      stroke={isBright ? '#e2e8f0' : '#142344'}
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill={isBright ? '#64748b' : '#64748b'}
                      fontFamily="monospace"
                    >
                      {Math.round(val).toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Shaded 95% Confidence Cone */}
              {confidence95Path && (
                <path d={confidence95Path} fill="url(#confidenceGrad)" />
              )}

              {/* Historical Line */}
              {actualPath && (
                <path
                  d={actualPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Forecast Dashed Line */}
              {forecastPath && (
                <path
                  d={forecastPath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Forecast Transition Vertical Divider */}
              {lastActualIdx >= 0 && (
                <line
                  x1={getX(lastActualIdx)}
                  y1={padT}
                  x2={getX(lastActualIdx)}
                  y2={padT + innerH}
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}

              {/* Interactive Hit Area Circles */}
              {chartPoints.map((p, i) => {
                const x = getX(i);
                const val = p.isForecast ? p.forecast! : p.actual!;
                const y = getY(val);

                return (
                  <g key={i}>
                    {/* Circle marker */}
                    <circle
                      cx={x}
                      cy={y}
                      r={p.isForecast ? 3 : 2.5}
                      fill={p.isForecast ? '#06b6d4' : '#3b82f6'}
                      stroke={isBright ? '#ffffff' : '#070d1a'}
                      strokeWidth="1.5"
                      className="cursor-pointer transition-transform hover:scale-150"
                      onMouseEnter={() => setHoveredPoint({ point: p, x, y })}
                    />
                  </g>
                );
              })}

              {/* X Axis Labels */}
              {chartPoints.length > 0 && (
                <>
                  <text
                    x={padL}
                    y={chartH - 12}
                    fontSize="10"
                    fill="#64748b"
                    fontFamily="monospace"
                  >
                    {chartPoints[0].dateStr}
                  </text>
                  {lastActualIdx > 0 && (
                    <text
                      x={getX(lastActualIdx)}
                      y={chartH - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#06b6d4"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ▲ Forecast Start ({chartPoints[lastActualIdx].dateStr})
                    </text>
                  )}
                  <text
                    x={padL + innerW}
                    y={chartH - 12}
                    textAnchor="end"
                    fontSize="10"
                    fill="#06b6d4"
                    fontFamily="monospace"
                  >
                    {chartPoints[chartPoints.length - 1].dateStr}
                  </text>
                </>
              )}
            </svg>

            {/* Hover Tooltip Popup */}
            {hoveredPoint && (
              <div
                className="absolute z-20 pointer-events-none p-2.5 rounded-lg bg-[#0b162e] border border-cyan-500/40 shadow-xl text-xs font-mono text-slate-100 -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: `${(hoveredPoint.x / chartW) * 100}%`,
                  top: `${(hoveredPoint.y / chartH) * 100}%`,
                }}
              >
                <div className="font-bold text-cyan-300 flex items-center justify-between gap-3">
                  <span>{hoveredPoint.point.dateStr}</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400">
                    {hoveredPoint.point.isForecast ? 'PROJECTION' : 'HISTORICAL'}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {!hoveredPoint.point.isForecast ? (
                    <div>Actual: <strong>{hoveredPoint.point.actual?.toLocaleString()}</strong></div>
                  ) : (
                    <>
                      <div className="text-cyan-400">Forecast: <strong>{hoveredPoint.point.forecast?.toLocaleString()}</strong></div>
                      <div className="text-slate-400 text-[10px]">
                        95% Range: [{hoveredPoint.point.lower95?.toLocaleString()} – {hoveredPoint.point.upper95?.toLocaleString()}]
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM TABS: DATA TABLE / GENERATED SQL / DIAGNOSTICS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 px-4 pb-6 min-h-0">
        <div
          className={`rounded-xl border flex flex-col h-full min-h-0 overflow-hidden ${
            isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
          }`}
        >
          {/* Sub Tab Buttons */}
          <div className="p-2 border-b border-[#182747] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveBottomTab('chart_table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeBottomTab === 'chart_table'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Forecast Data Table ({chartPoints.length} points)</span>
              </button>

              <button
                onClick={() => setActiveBottomTab('sql')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeBottomTab === 'sql'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Generated Forecast SQL</span>
              </button>

              <button
                onClick={() => setActiveBottomTab('diagnostics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  activeBottomTab === 'diagnostics'
                    ? 'bg-blue-600 text-white'
                    : isBright
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-[#122347]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Model Diagnostics & Math Specs</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold cursor-pointer transition border border-slate-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Forecast Data Table */}
          {activeBottomTab === 'chart_table' && (
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="sticky top-0 bg-[#0a1226] border-b border-[#182747] text-slate-300 text-[11px] font-bold z-10">
                  <tr>
                    <th className="p-2.5 w-12 text-center text-slate-500">#</th>
                    <th className="p-2.5">Date Period</th>
                    <th className="p-2.5">Partition</th>
                    <th className="p-2.5 text-right">Actual Historical</th>
                    <th className="p-2.5 text-right">Predicted Forecast</th>
                    <th className="p-2.5 text-right">Lower Bound (95%)</th>
                    <th className="p-2.5 text-right">Upper Bound (95%)</th>
                    <th className="p-2.5 text-right">Confidence Spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {chartPoints.map((row, idx) => {
                    const isFut = row.isForecast;
                    const spread = isFut && row.upper95 && row.lower95 ? row.upper95 - row.lower95 : null;

                    return (
                      <tr
                        key={idx}
                        className={`transition ${
                          isFut ? 'bg-cyan-950/20 hover:bg-cyan-900/30 font-semibold' : 'hover:bg-slate-800/20'
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-500 text-[10px]">{row.periodIndex}</td>
                        <td className="p-2.5 font-bold">
                          {row.dateStr}
                          {isFut && <span className="ml-1.5 text-[9px] text-cyan-400 uppercase">▲ Future</span>}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              isFut ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isFut ? 'FORECAST' : 'ACTUAL'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {row.actual !== undefined ? row.actual.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-cyan-400 font-bold">
                          {row.forecast !== undefined ? row.forecast.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-400">
                          {row.lower95 !== undefined ? row.lower95.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-400">
                          {row.upper95 !== undefined ? row.upper95.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-[11px] text-slate-500">
                          {spread !== null ? `±${(spread / 2).toFixed(1)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Generated Forecast SQL */}
          {activeBottomTab === 'sql' && (
            <div className="flex-1 overflow-auto p-4 bg-[#050b17]">
              <pre className="text-xs font-mono text-slate-200 leading-relaxed overflow-x-auto">
                <code>{highlightSql(forecastSql)}</code>
              </pre>
            </div>
          )}

          {/* Tab 3: Model Diagnostics & Mathematical Specs */}
          {activeBottomTab === 'diagnostics' && (
            <div className="flex-1 overflow-auto p-6 space-y-4 max-w-4xl text-xs">
              <div className="p-4 rounded-xl bg-[#060c18] border border-[#1b2f57] space-y-2">
                <h4 className="font-bold text-sm text-cyan-400">Mathematical Model Specifications</h4>
                <p className="text-slate-300 leading-relaxed">
                  The model utilizes <strong>{forecastResult.methodName}</strong>. Error estimates and prediction
                  bands are calculated using standard residual variance σ² = Σ(y_t - ŷ_t)² / (N - k).
                  As the forecast extends h steps into the future, the prediction variance scales with sqrt(h),
                  producing the expanding 95% (Z = 1.96) confidence cone.
                </p>
                <div className="font-mono bg-[#0c162e] p-2.5 rounded-lg border border-[#182747] text-slate-200">
                  Active Formula / Parameters: <strong>{forecastResult.equationOrParams}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#060c18] border border-[#1b2f57]">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Accuracy Benchmarks
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• <strong>MAPE (Mean Absolute Percentage Error):</strong> {forecastResult.metrics.mape}%</li>
                    <li>• <strong>RMSE (Root Mean Square Error):</strong> {forecastResult.metrics.rmse}</li>
                    <li>• <strong>MAE (Mean Absolute Error):</strong> {forecastResult.metrics.mae}</li>
                    <li>• <strong>$R^2$ Goodness of Fit:</strong> {forecastResult.metrics.r2}</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#060c18] border border-[#1b2f57]">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                    Dataset Scope
                  </h4>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• <strong>Historical Sample Points:</strong> {historicalSeries.length} intervals</li>
                    <li>• <strong>Projected Horizon:</strong> {horizon} future intervals</li>
                    <li>• <strong>Time Bucket Granularity:</strong> {grain.toUpperCase()}</li>
                    <li>• <strong>Historical Sum:</strong> {forecastResult.historicalTotal.toLocaleString()}</li>
                    <li>• <strong>Forecasted Sum:</strong> {forecastResult.forecastTotal.toLocaleString()}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
