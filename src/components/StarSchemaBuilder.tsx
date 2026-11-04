/**
 * StarSchemaBuilder.tsx
 * Complete Client-Side "CSV Star Schema & SCD Builder" Web Application.
 * Operates 100% in-browser on CSV files:
 * - Step 1: Flat CSV Upload & Column Role Tagger
 * - Step 2: Dimension Table Builder (Entity Grouping, Deduplication & Surrogate Key Generator)
 * - Step 3: CSV-Based SCD Engine (Slowly Changing Dimension Merger Type 1 & 2)
 * - Step 4: Fact CSV Lookup & Multi-CSV Download Center (.zip / individual CSVs)
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Download,
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Eye,
  Hash,
  Key,
  Calendar,
  Tag,
  Sigma,
  Ban,
  FileArchive,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  GitBranch,
  Split,
  ChevronRight,
  Sliders,
  HelpCircle,
  FileCode,
  ShieldCheck,
  TrendingDown,
  Copy,
  Code2,
  Terminal,
  ExternalLink,
  Star,
  Snowflake,
} from 'lucide-react';
import {
  ColumnRole,
  ColumnRoleConfig,
  DataType,
  DimensionConfig,
  GeneratedDimension,
  GeneratedFactTable,
  ScdRowStatus,
  StarSchemaBuildResult,
  SurrogateKeyFormat,
  TableSchema,
} from '../types';
import {
  tryNormalizeDate,
  isDateColumnName,
  normalizeRowsDateColumn,
} from '../utils/dateNormalizer';
import {
  parseCsvText,
  formatDataToCsv,
  downloadCsvFile,
  autoDetectColumnRoles,
  buildDimensionTable,
  buildFactTable,
  downloadAllStarSchemaZip,
  SAMPLE_FLAT_SALES_CSV_TEXT,
  SAMPLE_EXISTING_CUSTOMER_CSV_TEXT,
  parseExcelWorkbookBuffer,
  parseFileToTableData,
  ParsedSheetInfo,
} from '../utils/csvStarSchemaEngine';
import {
  generateCreateTableDdl,
  generateInsertSelectEtl,
  generateInsertValuesDml,
  generateAnalyticalSelectQueries,
  generateFullPipelineScript,
  SqlDialect,
} from '../utils/starSchemaSqlGenerator';
import { highlightSql } from '../utils/sqlHighlighter';
import { BiSchemaVisualizer } from './BiSchemaVisualizer';
import { useTheme } from '../context/ThemeContext';

export interface StarSchemaBuilderProps {
  tables?: TableSchema[];
  onRegisterTablesToStudio?: (tables: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
  onSwitchToStudio?: () => void;
  onOpenInSqlEditor?: (sql: string) => void;
}

type WizardStep = 1 | 2 | 3 | 4;

export const StarSchemaBuilder: React.FC<StarSchemaBuilderProps> = ({
  tables = [],
  onRegisterTablesToStudio,
  onSwitchToStudio,
  onOpenInSqlEditor,
}) => {
  const { isBright } = useTheme();

  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // EXCEL / MULTI-SHEET & WORKSPACE STATE
  const [uploadedExcelSheets, setUploadedExcelSheets] = useState<ParsedSheetInfo[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  // STEP 4 & SQL SCRIPTING STATE
  const [activePreviewTable, setActivePreviewTable] = useState<string>('fact_table');
  const [step4SubTab, setStep4SubTab] = useState<
    'schema_topology' | 'preview_export' | 'sql_scripting'
  >('schema_topology');
  const [selectedScriptType, setSelectedScriptType] = useState<
    'all_pipeline' | 'ddl' | 'etl_select' | 'dml_values' | 'queries'
  >('all_pipeline');
  const [sqlDialect, setSqlDialect] = useState<SqlDialect>('standard');
  const [dmlMaxRows, setDmlMaxRows] = useState<number>(100);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // STEP 1 STATE: Raw Flat CSV / Excel & Column Tagging
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [flatFileName, setFlatFileName] = useState<string>('');
  const [flatHeaders, setFlatHeaders] = useState<string[]>([]);
  const [flatRows, setFlatRows] = useState<Record<string, any>[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<ColumnRoleConfig[]>([]);
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const pageSize = 8;

  // STEP 2 STATE: Dimension Builder
  const [dimensions, setDimensions] = useState<DimensionConfig[]>([]);
  const [editingDimId, setEditingDimId] = useState<string | null>(null);

  // Modal / Inline Add Dimension Form
  const [dimFormName, setDimFormName] = useState<string>('');
  const [dimFormNk, setDimFormNk] = useState<string>('');
  const [dimFormAttrs, setDimFormAttrs] = useState<string[]>([]);
  const [dimFormSkFormat, setDimFormSkFormat] = useState<SurrogateKeyFormat>('auto_increment');
  const [dimFormSkName, setDimFormSkName] = useState<string>('');
  const [showAddDimForm, setShowAddDimForm] = useState<boolean>(false);

  // STEP 3 STATE: SCD Simulation / Upload
  const [activeScdDimId, setActiveScdDimId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scdFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // STEP 1 HANDLERS: Universal Upload & Parse (CSV, Excel .xlsx, .xls)
  // -------------------------------------------------------------

  const loadHeadersAndRows = (
    headers: string[],
    rows: Record<string, any>[],
    fileName: string,
    rawText = ''
  ) => {
    if (headers.length === 0 || rows.length === 0) {
      alert('The provided file or sheet contains no data rows.');
      return;
    }

    setRawCsvText(rawText);
    setFlatFileName(fileName);
    setFlatHeaders(headers);
    setFlatRows(rows);

    const detectedConfigs = autoDetectColumnRoles(headers, rows);
    setColumnConfigs(detectedConfigs);
    setPreviewPage(1);

    // Auto-seed starter dimensions based on detected Natural Business Keys
    const naturalKeys = detectedConfigs.filter((c) => c.role === 'natural_key');
    const starterDims: DimensionConfig[] = [];

    naturalKeys.forEach((nk) => {
      const prefix = nk.name
        .replace(/_code$/, '')
        .replace(/_sku$/, '')
        .replace(/_id$/, '')
        .replace(/_key$/, '');

      const relatedAttrs = detectedConfigs
        .filter(
          (c) =>
            c.role === 'dimension_attr' &&
            c.name !== nk.name &&
            (c.name.startsWith(prefix) ||
              c.name.includes(prefix) ||
              (prefix === 'customer' &&
                (c.name.includes('city') ||
                  c.name.includes('name') ||
                  c.name.includes('segment') ||
                  c.name.includes('email'))) ||
              (prefix === 'product' &&
                (c.name.includes('category') ||
                  c.name.includes('name') ||
                  c.name.includes('supplier'))))
        )
        .map((c) => c.name);

      starterDims.push({
        id: `dim_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        tableName: `dim_${prefix}`,
        naturalKeyCol: nk.name,
        attributeCols: relatedAttrs,
        surrogateKeyName: `${prefix}_sk`,
        surrogateKeyFormat: 'auto_increment',
        scdMode: 'initial',
        scdType: 2,
      });
    });

    if (starterDims.length > 0) {
      setDimensions(starterDims);
      setActiveScdDimId(starterDims[0].id);
    }
  };

  const handleParseAndLoadCsv = (csvContent: string, fileName: string) => {
    const { headers, rows } = parseCsvText(csvContent);
    setUploadedExcelSheets([]);
    setActiveSheetIndex(0);
    loadHeadersAndRows(headers, rows, fileName, csvContent);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const parsed = await parseFileToTableData(file);
      if (!parsed.sheets || parsed.sheets.length === 0) {
        alert('Could not parse any tables or sheets from this file.');
        return;
      }

      setUploadedExcelSheets(parsed.sheets);
      setActiveSheetIndex(0);

      const firstSheet = parsed.sheets[0];
      const displayName =
        parsed.sheets.length > 1 ? `${file.name} [${firstSheet.sheetName}]` : file.name;
      loadHeadersAndRows(firstSheet.headers, firstSheet.rows, displayName);
    } catch (err: any) {
      alert(`Error reading file: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectExcelSheet = (sheetIdx: number) => {
    if (!uploadedExcelSheets[sheetIdx]) return;
    setActiveSheetIndex(sheetIdx);
    const sheet = uploadedExcelSheets[sheetIdx];
    const baseName = flatFileName.split(' [')[0];
    loadHeadersAndRows(sheet.headers, sheet.rows, `${baseName} [${sheet.sheetName}]`);
  };

  const handleLoadFromWorkspaceTable = (tableName: string) => {
    const tbl = tables.find((t) => t.name === tableName);
    if (!tbl) return;

    const rows = tbl.allRows && tbl.allRows.length > 0 ? tbl.allRows : tbl.previewRows;
    const headers = tbl.columns.map((c) => c.name);

    setUploadedExcelSheets([]);
    setActiveSheetIndex(0);
    loadHeadersAndRows(headers, rows, `${tbl.name} (Workspace)`);
  };

  const handleLoadSampleSalesCsv = () => {
    handleParseAndLoadCsv(SAMPLE_FLAT_SALES_CSV_TEXT, 'raw_retail_sales_flat.csv');
  };

  const handleRoleChange = (colName: string, newRole: ColumnRole) => {
    setColumnConfigs((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, role: newRole } : c))
    );
  };

  const handleTypeChange = (colName: string, newType: DataType) => {
    if (newType === 'DATE') {
      const updatedRows = flatRows.map((r) => {
        const val = r[colName];
        if (val !== null && val !== undefined && val !== '') {
          const norm = tryNormalizeDate(val, true);
          if (norm !== null) {
            return { ...r, [colName]: norm };
          }
        }
        return r;
      });
      setFlatRows(updatedRows);

      const values = updatedRows.map((r) => r[colName]);
      const nonNullVals = values.filter((v) => v !== null && v !== undefined && v !== '');
      const uniqueSet = new Set(nonNullVals.map((v) => String(v)));
      const samples = Array.from(uniqueSet).slice(0, 4);

      setColumnConfigs((prev) =>
        prev.map((c) =>
          c.name === colName
            ? {
                ...c,
                type: 'DATE',
                role: c.role === 'dimension_attr' || c.role === 'fact_measure' ? 'date_key' : c.role,
                samples,
                uniqueCount: uniqueSet.size,
              }
            : c
        )
      );
      return;
    }

    if (newType === 'INTEGER') {
      const updatedRows = flatRows.map((r) => {
        const val = r[colName];
        if (val !== null && val !== undefined && val !== '') {
          const parsed = parseInt(String(val).replace(/,/g, ''), 10);
          if (!isNaN(parsed)) return { ...r, [colName]: parsed };
        }
        return r;
      });
      setFlatRows(updatedRows);
    } else if (newType === 'FLOAT') {
      const updatedRows = flatRows.map((r) => {
        const val = r[colName];
        if (val !== null && val !== undefined && val !== '') {
          const parsed = parseFloat(String(val).replace(/,/g, ''));
          if (!isNaN(parsed)) return { ...r, [colName]: Number(parsed.toFixed(4)) };
        }
        return r;
      });
      setFlatRows(updatedRows);
    } else if (newType === 'TEXT') {
      const updatedRows = flatRows.map((r) => {
        const val = r[colName];
        if (val !== null && val !== undefined) {
          return { ...r, [colName]: String(val) };
        }
        return r;
      });
      setFlatRows(updatedRows);
    }

    // Recompute samples
    const values = flatRows.map((r) => r[colName]);
    const nonNullVals = values.filter((v) => v !== null && v !== undefined && v !== '');
    const uniqueSet = new Set(nonNullVals.map((v) => String(v)));
    const samples = Array.from(uniqueSet).slice(0, 4);

    setColumnConfigs((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, type: newType, samples, uniqueCount: uniqueSet.size } : c))
    );
  };

  const handleResetRoles = () => {
    if (flatHeaders.length > 0 && flatRows.length > 0) {
      setColumnConfigs(autoDetectColumnRoles(flatHeaders, flatRows));
    }
  };

  // -------------------------------------------------------------
  // STEP 2 HANDLERS: Dimension Builder
  // -------------------------------------------------------------

  const handleOpenAddDim = () => {
    const availableNks = columnConfigs.filter(
      (c) => c.role === 'natural_key' || c.role === 'dimension_attr'
    );
    const defaultNk = availableNks[0]?.name || flatHeaders[0] || '';
    const prefix = defaultNk.replace(/_code$/, '').replace(/_sku$/, '').replace(/_id$/, '');

    setDimFormName(`dim_${prefix || 'entity'}`);
    setDimFormNk(defaultNk);
    setDimFormSkName(`${prefix || 'entity'}_sk`);
    setDimFormSkFormat('auto_increment');
    setDimFormAttrs([]);
    setShowAddDimForm(true);
  };

  const handleSaveDimension = () => {
    if (!dimFormName.trim() || !dimFormNk) {
      alert('Please provide a Dimension Table Name and select a Natural Business Key column.');
      return;
    }

    const newDim: DimensionConfig = {
      id: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      tableName: dimFormName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      naturalKeyCol: dimFormNk,
      attributeCols: dimFormAttrs,
      surrogateKeyName: dimFormSkName.trim() || `${dimFormName}_sk`,
      surrogateKeyFormat: dimFormSkFormat,
      scdMode: 'initial',
      scdType: 2,
    };

    setDimensions((prev) => [...prev, newDim]);
    if (!activeScdDimId) {
      setActiveScdDimId(newDim.id);
    }
    setShowAddDimForm(false);
  };

  const handleDeleteDimension = (id: string) => {
    setDimensions((prev) => prev.filter((d) => d.id !== id));
    if (activeScdDimId === id) {
      const remaining = dimensions.filter((d) => d.id !== id);
      setActiveScdDimId(remaining[0]?.id || '');
    }
  };

  const handleToggleAttrInDimForm = (attrCol: string) => {
    setDimFormAttrs((prev) =>
      prev.includes(attrCol) ? prev.filter((c) => c !== attrCol) : [...prev, attrCol]
    );
  };

  const handleAutoSuggestDimensions = () => {
    if (flatRows.length === 0) return;
    const detectedConfigs = columnConfigs.length > 0 ? columnConfigs : autoDetectColumnRoles(flatHeaders, flatRows);
    const naturalKeys = detectedConfigs.filter((c) => c.role === 'natural_key');
    const autoDims: DimensionConfig[] = [];

    naturalKeys.forEach((nk) => {
      const prefix = nk.name
        .replace(/_code$/, '')
        .replace(/_sku$/, '')
        .replace(/_id$/, '')
        .replace(/_key$/, '');

      const relatedAttrs = detectedConfigs
        .filter(
          (c) =>
            c.role === 'dimension_attr' &&
            c.name !== nk.name &&
            (c.name.startsWith(prefix) ||
              c.name.includes(prefix) ||
              (prefix === 'customer' && (c.name.includes('city') || c.name.includes('name') || c.name.includes('segment') || c.name.includes('email'))) ||
              (prefix === 'product' && (c.name.includes('category') || c.name.includes('name') || c.name.includes('supplier'))))
        )
        .map((c) => c.name);

      autoDims.push({
        id: `dim_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        tableName: `dim_${prefix}`,
        naturalKeyCol: nk.name,
        attributeCols: relatedAttrs,
        surrogateKeyName: `${prefix}_sk`,
        surrogateKeyFormat: 'auto_increment',
        scdMode: 'initial',
        scdType: 2,
      });
    });

    if (autoDims.length > 0) {
      setDimensions(autoDims);
      setActiveScdDimId(autoDims[0].id);
    }
  };

  // -------------------------------------------------------------
  // STEP 3 HANDLERS: SCD Mode & Incremental Simulation
  // -------------------------------------------------------------

  const handleUpdateDimScdConfig = (dimId: string, updates: Partial<DimensionConfig>) => {
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimId ? { ...d, ...updates } : d))
    );
  };

  const handleLoadSimulatedExistingCustomerCsv = (dimId: string) => {
    const { headers, rows } = parseCsvText(SAMPLE_EXISTING_CUSTOMER_CSV_TEXT);
    handleUpdateDimScdConfig(dimId, {
      scdMode: 'incremental',
      scdType: 2,
      existingCsvRows: rows,
      existingCsvFileName: 'simulated_dim_customer_prior_run.csv',
    });
  };

  const handleUploadExistingDimFile = async (
    dimId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseFileToTableData(file);
      if (!parsed.sheets || parsed.sheets.length === 0 || parsed.sheets[0].rows.length === 0) {
        alert('The uploaded existing Dimension file contains no data rows.');
        return;
      }
      const sheet = parsed.sheets[0];
      handleUpdateDimScdConfig(dimId, {
        scdMode: 'incremental',
        existingCsvRows: sheet.rows,
        existingCsvFileName: file.name,
      });
    } catch (err: any) {
      alert(`Error reading file: ${err.message || String(err)}`);
    } finally {
      if (scdFileInputRef.current) scdFileInputRef.current.value = '';
    }
  };

  const handleLoadWorkspaceTableAsExistingDim = (dimId: string, tableName: string) => {
    const tbl = tables.find((t) => t.name === tableName);
    if (!tbl) return;
    const rows = tbl.allRows && tbl.allRows.length > 0 ? tbl.allRows : tbl.previewRows;
    handleUpdateDimScdConfig(dimId, {
      scdMode: 'incremental',
      existingCsvRows: rows,
      existingCsvFileName: `${tbl.name} (Workspace)`,
    });
  };

  // -------------------------------------------------------------
  // GENERATED STAR SCHEMA EXECUTION
  // -------------------------------------------------------------

  const starSchemaResult: StarSchemaBuildResult = useMemo(() => {
    if (flatRows.length === 0 || dimensions.length === 0) {
      return {
        dimensions: [],
        factTable: {
          tableName: 'fact_table',
          columns: [],
          rows: [],
          stats: { inputRows: 0, factRows: 0, columnReduction: 0, unmatchedLookups: 0 },
        },
      };
    }

    const generatedDims = dimensions.map((d) => buildDimensionTable(d, flatRows, asOfDate));
    const generatedFact = buildFactTable(flatRows, columnConfigs, generatedDims);

    return {
      dimensions: generatedDims,
      factTable: generatedFact,
    };
  }, [flatRows, dimensions, columnConfigs, asOfDate]);

  // Active table selected for preview in Step 4
  const activePreviewData = useMemo(() => {
    if (activePreviewTable === 'fact_table') {
      return {
        name: starSchemaResult.factTable.tableName,
        columns: starSchemaResult.factTable.columns,
        rows: starSchemaResult.factTable.rows,
        statuses: undefined,
      };
    }
    const foundDim = starSchemaResult.dimensions.find((d) => d.id === activePreviewTable || d.tableName === activePreviewTable);
    if (foundDim) {
      return {
        name: foundDim.tableName,
        columns: foundDim.columns,
        rows: foundDim.rows,
        statuses: foundDim.rowStatuses,
      };
    }
    return {
      name: starSchemaResult.factTable.tableName,
      columns: starSchemaResult.factTable.columns,
      rows: starSchemaResult.factTable.rows,
      statuses: undefined,
    };
  }, [activePreviewTable, starSchemaResult]);

  // Download Individual CSV
  const handleDownloadSingleCsv = (tableName: string, rows: Record<string, any>[], cols: string[]) => {
    const csvStr = formatDataToCsv(rows, cols);
    downloadCsvFile(csvStr, tableName);
  };

  // Download All as .zip
  const handleDownloadAllZip = async () => {
    if (starSchemaResult.dimensions.length === 0 || starSchemaResult.factTable.rows.length === 0) return;
    setIsZipping(true);
    try {
      await downloadAllStarSchemaZip(starSchemaResult, `star_schema_${flatFileName.replace(/\.csv$/, '') || 'sales'}.zip`);
    } catch (err) {
      console.error('Failed to zip star schema CSVs:', err);
      alert('Error bundling CSV files into .zip. You can download individual CSV files below.');
    } finally {
      setIsZipping(false);
    }
  };

  // Register Tables to SQL Studio
  const handleRegisterToStudio = () => {
    if (!onRegisterTablesToStudio) return;

    const newItems: { schema: TableSchema; rows: Record<string, any>[] }[] = [];

    // Fact table
    const factCols = starSchemaResult.factTable.columns.map((c) => ({
      name: c,
      originalName: c,
      type: (c.endsWith('_sk') || c.includes('qty') || c.includes('amount') || c.includes('price') ? 'FLOAT' : 'TEXT') as any,
      nullCount: 0,
      distinctCount: 0,
      sampleValues: [],
    }));

    newItems.push({
      schema: {
        id: starSchemaResult.factTable.tableName,
        name: starSchemaResult.factTable.tableName,
        sourceFileName: `${starSchemaResult.factTable.tableName}.csv`,
        sheetName: 'Fact',
        rowCount: starSchemaResult.factTable.rows.length,
        columns: factCols,
        previewRows: starSchemaResult.factTable.rows.slice(0, 10),
        allRows: starSchemaResult.factTable.rows,
      },
      rows: starSchemaResult.factTable.rows,
    });

    // Dimensions
    starSchemaResult.dimensions.forEach((dim) => {
      const dimCols = dim.columns.map((c) => ({
        name: c,
        originalName: c,
        type: (c === dim.surrogateKeyName ? 'INTEGER' : 'TEXT') as any,
        nullCount: 0,
        distinctCount: 0,
        sampleValues: [],
      }));

      newItems.push({
        schema: {
          id: dim.tableName,
          name: dim.tableName,
          sourceFileName: `${dim.tableName}.csv`,
          sheetName: 'Dimension',
          rowCount: dim.rows.length,
          columns: dimCols,
          previewRows: dim.rows.slice(0, 10),
          allRows: dim.rows,
        },
        rows: dim.rows,
      });
    });

    onRegisterTablesToStudio(newItems);
    setRegisteredSuccess(true);
    setTimeout(() => setRegisteredSuccess(false), 4000);
  };

  // -------------------------------------------------------------
  // SQL SCRIPT GENERATION & EXECUTION HANDLERS
  // -------------------------------------------------------------

  const stagingTableName = useMemo(() => {
    const cleanName = flatFileName
      .split(' [')[0]
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase();
    return cleanName || 'raw_staging';
  }, [flatFileName]);

  const currentScriptSql = useMemo(() => {
    if (!starSchemaResult || starSchemaResult.dimensions.length === 0) {
      return '-- Configure and generate dimensions to view SQL scripts.';
    }

    switch (selectedScriptType) {
      case 'all_pipeline':
        return generateFullPipelineScript(
          starSchemaResult,
          stagingTableName,
          columnConfigs,
          sqlDialect
        );
      case 'ddl':
        return generateCreateTableDdl(starSchemaResult, sqlDialect);
      case 'etl_select':
        return generateInsertSelectEtl(starSchemaResult, stagingTableName, columnConfigs);
      case 'dml_values':
        return generateInsertValuesDml(starSchemaResult, dmlMaxRows);
      case 'queries':
        return generateAnalyticalSelectQueries(starSchemaResult);
      default:
        return generateFullPipelineScript(
          starSchemaResult,
          stagingTableName,
          columnConfigs,
          sqlDialect
        );
    }
  }, [
    starSchemaResult,
    selectedScriptType,
    sqlDialect,
    dmlMaxRows,
    stagingTableName,
    columnConfigs,
  ]);

  const handleCopyScript = () => {
    if (!currentScriptSql) return;
    navigator.clipboard.writeText(currentScriptSql);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDownloadScript = () => {
    if (!currentScriptSql) return;
    const blob = new Blob([currentScriptSql], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `star_schema_${selectedScriptType}_${sqlDialect}.sql`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRunScriptInStudio = () => {
    if (!currentScriptSql) return;
    if (onOpenInSqlEditor) {
      onOpenInSqlEditor(currentScriptSql);
    } else if (onSwitchToStudio) {
      onSwitchToStudio();
    }
  };

  // -------------------------------------------------------------
  // ROLE STYLES & LABELS HELPER
  // -------------------------------------------------------------

  const getRoleBadge = (role: ColumnRole) => {
    switch (role) {
      case 'fact_measure':
        return {
          label: 'Fact (Measure)',
          color: isBright
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
          icon: Sigma,
        };
      case 'dimension_attr':
        return {
          label: 'Dimension Attribute',
          color: isBright
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-blue-950/60 text-blue-300 border-blue-800/60',
          icon: Tag,
        };
      case 'natural_key':
        return {
          label: 'Natural Business Key',
          color: isBright
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-purple-950/60 text-purple-300 border-purple-800/60',
          icon: Key,
        };
      case 'degenerate_key':
        return {
          label: 'Degenerate Key',
          color: isBright
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-amber-950/60 text-amber-300 border-amber-800/60',
          icon: Hash,
        };
      case 'date_key':
        return {
          label: 'Date/Time Key',
          color: isBright
            ? 'bg-sky-50 text-sky-700 border-sky-200'
            : 'bg-sky-950/60 text-sky-300 border-sky-800/60',
          icon: Calendar,
        };
      default:
        return {
          label: 'Ignore / Exclude',
          color: isBright
            ? 'bg-slate-100 text-slate-500 border-slate-200'
            : 'bg-slate-800/60 text-slate-400 border-slate-700/60',
          icon: Ban,
        };
    }
  };

  // -------------------------------------------------------------
  // RENDER UI
  // -------------------------------------------------------------

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors duration-150 ${
        isBright ? 'bg-slate-50 text-slate-800' : 'bg-[#070e1c] text-slate-100'
      }`}
    >
      {/* HEADER & 4-STEP WIZARD PROGRESS BAR */}
      <div
        className={`px-4 sm:px-6 py-3.5 border-b shrink-0 transition-colors ${
          isBright ? 'bg-white border-slate-200' : 'bg-[#0b1329] border-[#182747]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
                <Split className="w-3.5 h-3.5" />
              </div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight font-sans">
                CSV Star Schema & SCD Builder
              </h1>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-medium ${
                  isBright
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                }`}
              >
                Browser ETL
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
              Turn flat CSVs into normalized Star Schema Facts & Dimensions with Slowly Changing Dimension (SCD Type 1 & 2) management.
            </p>
          </div>

          {/* Wizard Step Pills */}
          <div
            className={`flex items-center p-1 rounded-xl border self-start sm:self-auto overflow-x-auto no-scrollbar ${
              isBright ? 'bg-slate-100 border-slate-200' : 'bg-[#060c18] border-[#162544]'
            }`}
          >
            {[
              { num: 1, title: '1. Role Tagger', desc: 'Flat Spreadsheet' },
              { num: 2, title: '2. Dimensions', desc: 'Surrogate Keys' },
              { num: 3, title: '3. SCD Engine', desc: 'Type 1 & 2' },
              { num: 4, title: '4. BI Schema & Export', desc: 'Star & Snowflake' },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              const isAvailable =
                step.num === 1 || (flatRows.length > 0 && (step.num === 2 || dimensions.length > 0));

              return (
                <button
                  key={step.num}
                  disabled={!isAvailable}
                  onClick={() => setCurrentStep(step.num as WizardStep)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isPast
                      ? isBright
                        ? 'text-blue-700 hover:bg-slate-200'
                        : 'text-blue-400 hover:bg-[#122347]'
                      : isBright
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono ${
                      isActive
                        ? 'bg-white text-blue-600 font-bold'
                        : isPast
                        ? 'bg-blue-500/20 text-blue-300'
                        : isBright
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPast ? '✓' : step.num}
                  </span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* WORKSPACE BODY VIEW ROUTED BY CURRENT STEP */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {/* ========================================================= */}
        {/* STEP 1: FLAT CSV UPLOAD & COLUMN ROLE TAGGER */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Top CSV / Excel Load Cards */}
            {flatRows.length === 0 ? (
              <div
                className={`p-8 sm:p-12 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition ${
                  isBright
                    ? 'bg-white border-slate-300 shadow-sm'
                    : 'bg-[#0a1226] border-[#1f3460] shadow-xl'
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h2 className="text-lg font-bold">Upload Flat CSV or Excel File (.xlsx, .xls, .csv)</h2>
                <p className={`text-xs max-w-md mt-1.5 mb-6 ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                  Upload any raw flat spreadsheet (Excel workbook or CSV export), or choose an existing table from your workspace. We will detect data types, measures, natural keys, and attributes.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md cursor-pointer transition disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploading ? 'Reading File...' : 'Browse File (.xlsx, .xls, .csv)'}</span>
                  </button>

                  {tables.length > 0 && (
                    <div className="relative">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleLoadFromWorkspaceTable(e.target.value);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer appearance-none pr-8 ${
                          isBright
                            ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                            : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
                        }`}
                      >
                        <option value="" disabled>Select from Workspace ({tables.length} tables)...</option>
                        {tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} ({t.rowCount} rows · {t.columns.length} cols)
                          </option>
                        ))}
                      </select>
                      <Database className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}

                  <button
                    onClick={handleLoadSampleSalesCsv}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isBright
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                        : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Load Sample Sales CSV (20 Rows, 15 Columns)</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Multi-sheet Excel switcher if workbook has multiple sheets */}
                {uploadedExcelSheets.length > 1 && (
                  <div
                    className={`p-3 rounded-xl border flex flex-wrap items-center gap-2 ${
                      isBright ? 'bg-blue-50/70 border-blue-200' : 'bg-blue-950/30 border-blue-900/40'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Workbook Worksheets:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {uploadedExcelSheets.map((sh, idx) => (
                        <button
                          key={sh.sheetName}
                          onClick={() => handleSelectExcelSheet(idx)}
                          className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold transition cursor-pointer ${
                            activeSheetIndex === idx
                              ? 'bg-blue-600 text-white shadow-xs'
                              : isBright
                              ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-[#0f1b35] hover:bg-[#16274e] text-slate-300 border border-[#203661]'
                          }`}
                        >
                          {sh.sheetName} ({sh.rows.length.toLocaleString()} rows)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* File info bar & Quick Actions */}
                <div
                  className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#0a1226] border-[#182747]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{flatFileName || 'Raw Dataset'}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({flatRows.length.toLocaleString()} rows · {flatHeaders.length} columns)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Ready for dimensional modeling & SQL scripting</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {tables.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleLoadFromWorkspaceTable(e.target.value);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                          isBright
                            ? 'bg-white border-slate-200 text-slate-700'
                            : 'bg-[#0f1b35] border-[#203661] text-slate-300'
                        }`}
                      >
                        <option value="" disabled>Workspace Table...</option>
                        {tables.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name} ({t.rowCount}r)
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={handleResetRoles}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        isBright
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-300'
                      }`}
                      title="Reset role assignments to auto-detected defaults"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Roles</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                        isBright
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-300'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Change File (.xlsx / .csv)</span>
                    </button>

                    <button
                      onClick={() => setCurrentStep(2)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition"
                    >
                      <span>Proceed to Step 2: Dimensions</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Role Tagger Cards Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold">Column Role Assignment & Inferred Schema</h3>
                      <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                        Assign the role of each column. Measures will stay in the Fact CSV, Natural Keys and Attributes will form Dimensions.
                      </p>
                    </div>

                    {/* Quick role counts badge */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="text-emerald-500 font-semibold">
                        {columnConfigs.filter((c) => c.role === 'fact_measure').length} Measures
                      </span>
                      <span>·</span>
                      <span className="text-blue-500 font-semibold">
                        {columnConfigs.filter((c) => c.role === 'dimension_attr').length} Attributes
                      </span>
                      <span>·</span>
                      <span className="text-purple-500 font-semibold">
                        {columnConfigs.filter((c) => c.role === 'natural_key').length} Natural Keys
                      </span>
                      <span>·</span>
                      <span className="text-amber-500 font-semibold">
                        {columnConfigs.filter((c) => c.role === 'degenerate_key').length} Degenerate
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {columnConfigs.map((col) => {
                      const badge = getRoleBadge(col.role);
                      const IconComponent = badge.icon;

                      return (
                        <div
                          key={col.name}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                            isBright
                              ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                              : 'bg-[#091224] border-[#182747] hover:border-[#22396b]'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-mono text-xs font-bold truncate" title={col.name}>
                                {col.name}
                              </span>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-semibold ${
                                  col.type === 'INTEGER' || col.type === 'FLOAT'
                                    ? isBright
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-amber-950/50 text-amber-300 border-amber-800/40'
                                    : col.type === 'DATE'
                                    ? isBright
                                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                                      : 'bg-sky-950/50 text-sky-300 border-sky-800/40'
                                    : isBright
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {col.type}
                              </span>
                            </div>

                            {/* Samples & Stats */}
                            <div className="text-[11px] text-slate-500 space-y-1 mb-3">
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span>{col.uniqueCount} distinct values</span>
                                <span>{col.nullCount > 0 ? `${col.nullCount} nulls` : 'No nulls'}</span>
                              </div>
                              <div className="truncate text-[10px] font-mono bg-slate-500/5 p-1 rounded">
                                Ex: {col.samples.join(', ') || 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Quick Date Conversion Action if values are epoch timestamps or date-like */}
                          {col.type !== 'DATE' &&
                            (isDateColumnName(col.name) ||
                              col.samples.some((s) => typeof s === 'number' && s > 300000000000)) && (
                              <button
                                onClick={() => handleTypeChange(col.name, 'DATE')}
                                className="w-full mb-2.5 px-2 py-1 text-[10px] font-bold rounded-md bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 flex items-center justify-center gap-1 cursor-pointer transition shadow-2xs"
                                title="Instantly convert numeric timestamps/serials to clean YYYY-MM-DD date format"
                              >
                                <Calendar className="w-3 h-3 text-sky-400" />
                                <span>⚡ Format as Date (YYYY-MM-DD)</span>
                              </button>
                            )}

                          {/* Data Type and Role Selectors Grid */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Data Type Selector */}
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                                Data Type:
                              </label>
                              <select
                                value={col.type}
                                onChange={(e) => handleTypeChange(col.name, e.target.value as DataType)}
                                className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none border cursor-pointer transition ${
                                  isBright
                                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                                    : 'bg-[#0f1b35] border-[#223d75] text-slate-200'
                                }`}
                              >
                                <option value="DATE">DATE (YYYY-MM-DD)</option>
                                <option value="INTEGER">INTEGER</option>
                                <option value="FLOAT">FLOAT / DECIMAL</option>
                                <option value="TEXT">TEXT / STRING</option>
                                <option value="BOOLEAN">BOOLEAN</option>
                              </select>
                            </div>

                            {/* Role Selector Dropdown */}
                            <div>
                              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                                Role:
                              </label>
                              <select
                                value={col.role}
                                onChange={(e) => handleRoleChange(col.name, e.target.value as ColumnRole)}
                                className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none border cursor-pointer transition ${
                                  badge.color
                                }`}
                              >
                                <option value="fact_measure">Fact (Measure)</option>
                                <option value="dimension_attr">Dimension Attr</option>
                                <option value="natural_key">Natural Key</option>
                                <option value="degenerate_key">Degenerate Key</option>
                                <option value="date_key">Date/Time Key</option>
                                <option value="ignore">Ignore</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Raw CSV Data Preview Table */}
                <div
                  className={`rounded-xl border overflow-hidden transition ${
                    isBright ? 'bg-white border-slate-200' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div
                    className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b162f] border-[#182747]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Raw CSV Data Preview ({flatRows.length} total rows)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          value={previewSearch}
                          onChange={(e) => {
                            setPreviewSearch(e.target.value);
                            setPreviewPage(1);
                          }}
                          placeholder="Search preview rows..."
                          className={`pl-8 pr-2.5 py-1 text-xs rounded border focus:outline-none focus:border-blue-500 ${
                            isBright
                              ? 'bg-white border-slate-200 text-slate-800'
                              : 'bg-[#060c18] border-[#182747] text-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead
                        className={`sticky top-0 z-10 border-b font-mono ${
                          isBright ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0e1933] border-[#182747] text-slate-300'
                        }`}
                      >
                        <tr>
                          <th className="p-2 w-10 text-center font-normal">#</th>
                          {flatHeaders.map((h) => (
                            <th key={h} className="p-2 whitespace-nowrap font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/20 font-mono">
                        {flatRows
                          .filter((r) =>
                            previewSearch.trim()
                              ? Object.values(r).some((v) =>
                                  String(v).toLowerCase().includes(previewSearch.toLowerCase())
                                )
                              : true
                          )
                          .slice((previewPage - 1) * pageSize, previewPage * pageSize)
                          .map((row, idx) => (
                            <tr
                              key={idx}
                              className={`transition-colors ${
                                isBright ? 'hover:bg-slate-50' : 'hover:bg-[#0f1d3a]'
                              }`}
                            >
                              <td className="p-2 text-center text-slate-400 font-sans">
                                {(previewPage - 1) * pageSize + idx + 1}
                              </td>
                              {flatHeaders.map((h) => (
                                <td key={h} className="p-2 whitespace-nowrap max-w-[200px] truncate" title={String(row[h] ?? '')}>
                                  {row[h] !== null && row[h] !== undefined ? String(row[h]) : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Preview Pagination */}
                  <div
                    className={`p-2 border-t flex items-center justify-between text-xs text-slate-500 font-mono ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#070e1e] border-[#182747]'
                    }`}
                  >
                    <span>
                      Showing {(previewPage - 1) * pageSize + 1} -{' '}
                      {Math.min(previewPage * pageSize, flatRows.length)} of {flatRows.length} rows
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => p - 1)}
                        className="px-2 py-0.5 rounded border disabled:opacity-40 cursor-pointer"
                      >
                        Prev
                      </button>
                      <span>Page {previewPage}</span>
                      <button
                        disabled={previewPage * pageSize >= flatRows.length}
                        onClick={() => setPreviewPage((p) => p + 1)}
                        className="px-2 py-0.5 rounded border disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: DIMENSION TABLE BUILDER */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Configure Dimension Tables</h2>
                <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                  Group descriptive columns around unique Natural Business Keys. Rows will be automatically deduplicated with Surrogate Keys.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoSuggestDimensions}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isBright
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-300'
                  }`}
                  title="Automatically create dimensions from tagged Natural Keys"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Auto-Detect Dimensions</span>
                </button>

                <button
                  onClick={handleOpenAddDim}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Dimension Table</span>
                </button>

                {dimensions.length > 0 && (
                  <button
                    onClick={() => {
                      setStep4SubTab('schema_topology');
                      setCurrentStep(4);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      isBright
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-amber-950/40 hover:bg-amber-900/40 border-amber-800/60 text-amber-300'
                    }`}
                    title="Directly preview Star and Snowflake schema ER topologies"
                  >
                    <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                    <span>Preview Schema</span>
                  </button>
                )}

                <button
                  disabled={dimensions.length === 0}
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition disabled:opacity-40"
                >
                  <span>Proceed to Step 3: SCD</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal / Inline Add Dimension Form */}
            {showAddDimForm && (
              <div
                className={`p-5 rounded-2xl border transition shadow-lg ${
                  isBright ? 'bg-white border-blue-300 ring-2 ring-blue-100' : 'bg-[#0b162f] border-blue-500/40 ring-2 ring-blue-900/30'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-bold">New Dimension Table Definition</h3>
                  </div>
                  <button
                    onClick={() => setShowAddDimForm(false)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Dimension Table Name:
                    </label>
                    <input
                      type="text"
                      value={dimFormName}
                      onChange={(e) => {
                        setDimFormName(e.target.value);
                        const clean = e.target.value.replace(/^dim_/, '');
                        setDimFormSkName(`${clean}_sk`);
                      }}
                      placeholder="e.g. dim_customer"
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:border-blue-500 ${
                        isBright ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#060c18] border-[#182747] text-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Natural Business Key (1 per dim):
                    </label>
                    <select
                      value={dimFormNk}
                      onChange={(e) => {
                        setDimFormNk(e.target.value);
                        const prefix = e.target.value.replace(/_code$/, '').replace(/_sku$/, '').replace(/_id$/, '');
                        if (!dimFormName || dimFormName.startsWith('dim_')) {
                          setDimFormName(`dim_${prefix}`);
                          setDimFormSkName(`${prefix}_sk`);
                        }
                      }}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:border-blue-500 cursor-pointer ${
                        isBright ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#060c18] border-[#182747] text-slate-200'
                      }`}
                    >
                      {columnConfigs
                        .filter((c) => c.role === 'natural_key' || c.role === 'dimension_attr')
                        .map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.uniqueCount} distinct)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Surrogate Key (_sk) Column:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={dimFormSkName}
                        onChange={(e) => setDimFormSkName(e.target.value)}
                        placeholder="customer_sk"
                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono border focus:outline-none focus:border-blue-500 ${
                          isBright ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#060c18] border-[#182747] text-slate-200'
                        }`}
                      />
                      <select
                        value={dimFormSkFormat}
                        onChange={(e) => setDimFormSkFormat(e.target.value as SurrogateKeyFormat)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                          isBright ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#060c18] border-[#182747] text-slate-200'
                        }`}
                      >
                        <option value="auto_increment">Integer (1, 2, 3..)</option>
                        <option value="hash">Hash (sk_e3b0c4..)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Attributes Checklist */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-400">
                      Select Descriptive Dimension Attributes:
                    </label>
                    <div className="flex gap-2 text-[11px]">
                      <button
                        onClick={() =>
                          setDimFormAttrs(
                            columnConfigs.filter((c) => c.role === 'dimension_attr').map((c) => c.name)
                          )
                        }
                        className="text-blue-500 hover:underline cursor-pointer"
                      >
                        Select All Attributes
                      </button>
                      <span>·</span>
                      <button
                        onClick={() => setDimFormAttrs([])}
                        className="text-slate-400 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg bg-slate-500/5 border border-slate-500/10">
                    {columnConfigs
                      .filter((c) => c.name !== dimFormNk && c.role !== 'fact_measure')
                      .map((col) => {
                        const isChecked = dimFormAttrs.includes(col.name);
                        return (
                          <label
                            key={col.name}
                            className={`flex items-center gap-2 p-1.5 rounded border text-xs font-mono cursor-pointer transition ${
                              isChecked
                                ? 'bg-blue-600/10 border-blue-500/40 text-blue-400'
                                : isBright
                                ? 'bg-white border-slate-200 text-slate-700'
                                : 'bg-[#060c18] border-[#182747] text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleAttrInDimForm(col.name)}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <span className="truncate">{col.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowAddDimForm(false)}
                    className="px-4 py-1.5 rounded-lg text-xs border cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDimension}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
                  >
                    Create Dimension Table
                  </button>
                </div>
              </div>
            )}

            {/* List of Configured Dimensions */}
            {dimensions.length === 0 ? (
              <div
                className={`p-8 rounded-xl border text-center ${
                  isBright ? 'bg-white border-slate-200 text-slate-500' : 'bg-[#091224] border-[#182747] text-slate-400'
                }`}
              >
                <Layers className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="font-semibold">No Dimension Tables Configured Yet</p>
                <p className="text-xs mt-1 mb-4">
                  Click &quot;Auto-Detect Dimensions&quot; to auto-create them from your tagged natural keys or add one manually.
                </p>
                <button
                  onClick={handleAutoSuggestDimensions}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Auto-Detect Dimensions Now
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {dimensions.map((dim) => {
                  const generated = starSchemaResult.dimensions.find((d) => d.id === dim.id);
                  const deduplicatedCount = generated?.rows.length || 0;

                  return (
                    <div
                      key={dim.id}
                      className={`p-4 rounded-xl border transition ${
                        isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                            <Database className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-blue-400">
                                {dim.tableName}.csv
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Deduplicated: {deduplicatedCount} unique entities (from {flatRows.length} transactions)
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span>Natural Key: <code className="text-purple-400 font-mono font-semibold">{dim.naturalKeyCol}</code></span>
                              <span>·</span>
                              <span>Surrogate Key: <code className="text-emerald-400 font-mono font-semibold">{dim.surrogateKeyName}</code> ({dim.surrogateKeyFormat})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteDimension(dim.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                            title="Delete dimension"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Attribute Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span className="text-[11px] text-slate-400">Attributes:</span>
                        {dim.attributeCols.length === 0 ? (
                          <span className="text-xs text-slate-500 italic">None selected</span>
                        ) : (
                          dim.attributeCols.map((attr) => (
                            <span
                              key={attr}
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                isBright
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                              }`}
                            >
                              {attr}
                            </span>
                          ))
                        )}
                      </div>

                      {/* Mini Live Preview of Dimension CSV Rows */}
                      {generated && generated.rows.length > 0 && (
                        <div className="rounded-lg border overflow-x-auto max-h-48 border-slate-500/20">
                          <table className="w-full text-[11px] text-left border-collapse">
                            <thead
                              className={`sticky top-0 z-10 border-b font-mono ${
                                isBright ? 'bg-slate-100 text-slate-700' : 'bg-[#0f1d3a] text-slate-300'
                              }`}
                            >
                              <tr>
                                {generated.columns.map((c) => (
                                  <th key={c} className="p-1.5 whitespace-nowrap font-medium">
                                    {c}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/20 font-mono">
                              {generated.rows.slice(0, 6).map((r, i) => (
                                <tr
                                  key={i}
                                  className={isBright ? 'hover:bg-slate-50' : 'hover:bg-[#122347]'}
                                >
                                  {generated.columns.map((c) => (
                                    <td key={c} className="p-1.5 whitespace-nowrap">
                                      {r[c] !== null && r[c] !== undefined ? String(r[c]) : ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: CSV-BASED SCD ENGINE (MERGER TYPE 1 & 2) */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Slowly Changing Dimension (SCD) Engine</h2>
                <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                  Choose between Initial Star Load or compare against an existing Dimension CSV using SCD Type 1 (Overwrite) or SCD Type 2 (History Tracking).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isBright ? 'bg-white border-slate-200' : 'bg-[#0f1b35] border-[#203661]'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Dimensions</span>
                </button>

                <button
                  onClick={() => setCurrentStep(4)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition"
                >
                  <span>Build Fact & Downloads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dimension Tabs for SCD Configuration */}
            <div className="flex items-center gap-2 border-b border-slate-500/20 pb-2 overflow-x-auto no-scrollbar">
              {dimensions.map((dim) => {
                const isActive = activeScdDimId === dim.id;
                return (
                  <button
                    key={dim.id}
                    onClick={() => setActiveScdDimId(dim.id)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isBright
                        ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        : 'bg-[#091224] text-slate-300 hover:bg-[#122347] border border-[#182747]'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>{dim.tableName}.csv</span>
                    {dim.scdMode === 'incremental' && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono">
                        SCD {dim.scdType}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Dimension SCD Config Panel */}
            {(() => {
              const activeDim = dimensions.find((d) => d.id === activeScdDimId) || dimensions[0];
              if (!activeDim) return null;

              const generated = starSchemaResult.dimensions.find((d) => d.id === activeDim.id);

              return (
                <div className="space-y-5">
                  {/* Mode Card */}
                  <div
                    className={`p-5 rounded-xl border space-y-4 ${
                      isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-500/10 pb-3">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <span>SCD Configuration for</span>
                          <code className="text-blue-400 font-mono">{activeDim.tableName}.csv</code>
                        </h3>
                        <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                          Natural Key: <code className="text-purple-400 font-mono">{activeDim.naturalKeyCol}</code>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-semibold">
                          <span>Effective As-Of Date:</span>
                          <input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                            className={`px-2 py-1 rounded text-xs border font-mono ${
                              isBright ? 'bg-slate-100 border-slate-300' : 'bg-[#060c18] border-[#182747]'
                            }`}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Mode Radio Tabs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Mode 1: Initial Load */}
                      <div
                        onClick={() => handleUpdateDimScdConfig(activeDim.id, { scdMode: 'initial' })}
                        className={`p-4 rounded-xl border cursor-pointer transition ${
                          activeDim.scdMode === 'initial'
                            ? isBright
                              ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                              : 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                            : isBright
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            : 'bg-[#060c18] border-[#182747] hover:bg-[#0c162e]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">Initial Star Load Mode</span>
                          {activeDim.scdMode === 'initial' && <Check className="w-4 h-4 text-blue-500" />}
                        </div>
                        <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Generates a brand-new dimension table from scratch with SCD tracking columns (`effective_start_date`, `effective_end_date = null`, `is_current = true`).
                        </p>
                      </div>

                      {/* Mode 2: Incremental SCD Update */}
                      <div
                        onClick={() => handleUpdateDimScdConfig(activeDim.id, { scdMode: 'incremental' })}
                        className={`p-4 rounded-xl border cursor-pointer transition ${
                          activeDim.scdMode === 'incremental'
                            ? isBright
                              ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400'
                              : 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                            : isBright
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            : 'bg-[#060c18] border-[#182747] hover:bg-[#0c162e]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">Incremental SCD Update Mode</span>
                          {activeDim.scdMode === 'incremental' && <Check className="w-4 h-4 text-amber-500" />}
                        </div>
                        <p className={`text-[11px] ${isBright ? 'text-slate-600' : 'text-slate-400'}`}>
                          Compares this flat file against an existing `dim_*.csv` file. Detects changed attributes on matching Natural Keys.
                        </p>
                      </div>
                    </div>

                    {/* Incremental Controls if selected */}
                    {activeDim.scdMode === 'incremental' && (
                      <div
                        className={`p-4 rounded-xl border space-y-4 ${
                          isBright ? 'bg-amber-50/40 border-amber-200' : 'bg-amber-950/20 border-amber-800/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-xs block">Existing Dimension CSV Source:</span>
                            <span className="text-[11px] text-slate-400">
                              {activeDim.existingCsvFileName
                                ? `Loaded: ${activeDim.existingCsvFileName} (${activeDim.existingCsvRows?.length} prior rows)`
                                : 'No prior CSV uploaded yet. Upload one or click Simulate.'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              ref={scdFileInputRef}
                              type="file"
                              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                              onChange={(e) => handleUploadExistingDimFile(activeDim.id, e)}
                              className="hidden"
                            />
                            <button
                              onClick={() => scdFileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                            >
                              Upload Prior dim_* (.xlsx / .csv)
                            </button>

                            {tables.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleLoadWorkspaceTableAsExistingDim(activeDim.id, e.target.value);
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                                  isBright
                                    ? 'bg-white border-slate-300 text-slate-700'
                                    : 'bg-[#122347] border-[#223d75] text-slate-200'
                                }`}
                              >
                                <option value="" disabled>Workspace Table...</option>
                                {tables.map((t) => (
                                  <option key={t.name} value={t.name}>
                                    {t.name} ({t.rowCount}r)
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              onClick={() => handleLoadSimulatedExistingCustomerCsv(activeDim.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                isBright
                                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                                  : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
                              }`}
                              title="Simulate previous customer dimension records with attribute changes"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 inline mr-1" />
                              <span>Simulate Existing Dim CSV</span>
                            </button>
                          </div>
                        </div>

                        {/* SCD Type 1 vs Type 2 Toggle */}
                        <div className="pt-2 border-t border-slate-500/20">
                          <label className="block text-xs font-semibold mb-2">Select SCD Strategy:</label>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="radio"
                                name={`scdType_${activeDim.id}`}
                                checked={activeDim.scdType === 1}
                                onChange={() => handleUpdateDimScdConfig(activeDim.id, { scdType: 1 })}
                                className="text-blue-600"
                              />
                              <span className="font-bold">SCD Type 1 (In-Place Overwrite)</span>
                              <span className="text-slate-400 text-[11px]">— No history, overwrites changed attributes in-place</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="radio"
                                name={`scdType_${activeDim.id}`}
                                checked={activeDim.scdType === 2}
                                onChange={() => handleUpdateDimScdConfig(activeDim.id, { scdType: 2 })}
                                className="text-blue-600"
                              />
                              <span className="font-bold">SCD Type 2 (History Row Versioning)</span>
                              <span className="text-slate-400 text-[11px]">— Sets end date on old row, appends new row with new _sk</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Visual Diff Preview Table */}
                  {generated && (
                    <div
                      className={`rounded-xl border overflow-hidden transition ${
                        isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                      }`}
                    >
                      <div
                        className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                          isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b162f] border-[#182747]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold uppercase tracking-wider">
                            Live SCD Merged Preview: {generated.tableName}.csv ({generated.rows.length} total rows)
                          </span>
                        </div>

                        {/* Diff stats legend */}
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="flex items-center gap-1 text-emerald-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>{generated.stats.added} Added</span>
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span>{generated.stats.updated} Updated</span>
                          </span>
                          <span className="flex items-center gap-1 text-rose-500">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span>{generated.stats.expired} Expired</span>
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            <span>{generated.stats.unchanged} Unchanged</span>
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead
                            className={`sticky top-0 z-10 border-b font-mono ${
                              isBright ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0e1933] border-[#182747] text-slate-300'
                            }`}
                          >
                            <tr>
                              <th className="p-2 w-12 text-center font-normal">Status</th>
                              {generated.columns.map((c) => (
                                <th key={c} className="p-2 whitespace-nowrap font-medium">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/20 font-mono">
                            {generated.rows.map((row, idx) => {
                              const skVal = row[generated.surrogateKeyName];
                              const status = generated.rowStatuses?.[skVal] || 'unchanged';

                              let rowBgClass = '';
                              let statusBadge = (
                                <span className="text-[10px] text-slate-400 font-mono">SAME</span>
                              );

                              if (status === 'added') {
                                rowBgClass = isBright
                                  ? 'bg-emerald-50/60 text-emerald-950 font-medium'
                                  : 'bg-emerald-950/30 text-emerald-300';
                                statusBadge = (
                                  <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                                    NEW
                                  </span>
                                );
                              } else if (status === 'updated') {
                                rowBgClass = isBright
                                  ? 'bg-amber-50/60 text-amber-950 font-medium'
                                  : 'bg-amber-950/30 text-amber-300';
                                statusBadge = (
                                  <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 font-bold">
                                    VER 2
                                  </span>
                                );
                              } else if (status === 'expired') {
                                rowBgClass = isBright
                                  ? 'bg-rose-50/60 text-rose-800 line-through opacity-75'
                                  : 'bg-rose-950/30 text-rose-300 line-through opacity-70';
                                statusBadge = (
                                  <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-400 font-bold">
                                    OLD
                                  </span>
                                );
                              }

                              return (
                                <tr key={idx} className={`transition-colors ${rowBgClass}`}>
                                  <td className="p-2 text-center">{statusBadge}</td>
                                  {generated.columns.map((c) => (
                                    <td key={c} className="p-2 whitespace-nowrap">
                                      {row[c] !== null && row[c] !== undefined ? String(row[c]) : ''}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: FACT CSV LOOKUP & MULTI-CSV DOWNLOAD CENTER */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Action Bar & KPI Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Star Schema Build & Download Center</h2>
                <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                  Fact table mapped with surrogate foreign keys. Download all tables as individual CSVs or bundled in a single .zip archive.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCurrentStep(3)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    isBright ? 'bg-white border-slate-200' : 'bg-[#0f1b35] border-[#203661]'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to SCD</span>
                </button>

                {onRegisterTablesToStudio && (
                  <button
                    onClick={handleRegisterToStudio}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      registeredSuccess
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : isBright
                        ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                        : 'bg-[#122347] hover:bg-[#1a3266] border-[#223d75] text-slate-200'
                    }`}
                    title="Register fact and dimension tables into SheetSQL AlaSQL catalog"
                  >
                    {registeredSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{registeredSuccess ? 'Registered!' : 'Query in SQL Studio'}</span>
                  </button>
                )}

                <button
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition disabled:opacity-50"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  <span>{isZipping ? 'Bundling Zip...' : 'Download All CSVs (.zip)'}</span>
                </button>
              </div>
            </div>

            {/* Validation & Compression Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Fact Row Count
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono">
                    {starSchemaResult.factTable.rows.length.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-mono">
                    (100% integrity)
                  </span>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Dimensions Created
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-blue-500">
                    {starSchemaResult.dimensions.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    satellites
                  </span>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Fact Column Reduction
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-purple-500">
                    {starSchemaResult.factTable.stats.columnReduction}%
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">
                    normalized
                  </span>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                }`}
              >
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Key Lookup Matches
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-emerald-500">
                    {starSchemaResult.factTable.stats.unmatchedLookups === 0 ? '100%' : 'Warnings'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({starSchemaResult.factTable.stats.unmatchedLookups} orphans)
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 4 SUB-TAB NAVIGATOR: STAR & SNOWFLAKE VISUALIZER / CSV PREVIEW / SQL SCRIPTING */}
            <div
              className={`p-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setStep4SubTab('schema_topology')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    step4SubTab === 'schema_topology'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isBright
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                  <span>Star & Snowflake Visualizer</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-normal">
                    Interactive
                  </span>
                </button>

                <button
                  onClick={() => setStep4SubTab('preview_export')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    step4SubTab === 'preview_export'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isBright
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSVs & Data Preview</span>
                </button>

                <button
                  onClick={() => setStep4SubTab('sql_scripting')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    step4SubTab === 'sql_scripting'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isBright
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SQL Scripting Studio</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                    CREATE, INSERT & SELECT
                  </span>
                </button>
              </div>

              {step4SubTab === 'sql_scripting' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    Dialect:
                  </span>
                  <select
                    value={sqlDialect}
                    onChange={(e) => setSqlDialect(e.target.value as SqlDialect)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none border cursor-pointer ${
                      isBright
                        ? 'bg-slate-50 border-slate-300 text-slate-800'
                        : 'bg-[#060c18] border-[#182747] text-slate-200'
                    }`}
                  >
                    <option value="standard">Standard ANSI / AlaSQL</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="snowflake">Snowflake</option>
                    <option value="bigquery">Google BigQuery</option>
                  </select>
                </div>
              )}
            </div>

            {/* SUB-VIEW 0: STAR & SNOWFLAKE INTERACTIVE SCHEMA VISUALIZER */}
            {step4SubTab === 'schema_topology' && (
              <BiSchemaVisualizer
                starSchemaResult={starSchemaResult}
                onOpenInSqlEditor={onOpenInSqlEditor}
                onSwitchToStudio={onSwitchToStudio}
                rawFileName={flatFileName}
              />
            )}

            {/* SUB-VIEW A: CSV EXPORT & LIVE PREVIEW */}
            {step4SubTab === 'preview_export' && (
              <div className="space-y-6">
                {/* Visual Star Schema Topology ER Map */}
                <div
                  className={`p-5 rounded-xl border ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Generated Star Schema Topology
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      1 Central Fact ↔ {starSchemaResult.dimensions.length} Dimension Satellites
                    </span>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-slate-500/5 border border-slate-500/10">
                    {/* Central Fact Box */}
                    <div
                      className={`p-4 rounded-xl border-2 w-full md:w-64 text-center transition ${
                        activePreviewTable === 'fact_table'
                          ? 'border-blue-500 ring-2 ring-blue-500/20'
                          : 'border-blue-500/40'
                      } ${isBright ? 'bg-blue-50/50' : 'bg-blue-950/20'}`}
                    >
                      <div className="text-[10px] font-mono text-blue-400 uppercase font-semibold">
                        Centralized Fact Table
                      </div>
                      <div className="text-sm font-bold mt-0.5 font-mono">fact_table.csv</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {starSchemaResult.factTable.rows.length.toLocaleString()} rows · {starSchemaResult.factTable.columns.length} columns
                      </div>
                      <div className="mt-3 flex justify-center">
                        <button
                          onClick={() =>
                            handleDownloadSingleCsv(
                              'fact_table',
                              starSchemaResult.factTable.rows,
                              starSchemaResult.factTable.columns
                            )
                          }
                          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold cursor-pointer shadow-xs"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download fact_table.csv</span>
                        </button>
                      </div>
                    </div>

                    {/* Connecting Links */}
                    <div className="flex flex-col gap-2 text-xs font-mono text-slate-400 text-center">
                      <div className="hidden md:block">◀ Foreign Keys (SK) ▶</div>
                    </div>

                    {/* Satellite Dimensions List */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
                      {starSchemaResult.dimensions.map((dim) => (
                        <div
                          key={dim.id}
                          className={`p-3 rounded-lg border text-left transition ${
                            activePreviewTable === dim.tableName
                              ? 'border-purple-500 ring-1 ring-purple-500'
                              : 'border-slate-500/20'
                          } ${isBright ? 'bg-white' : 'bg-[#0b162f]'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-purple-400">
                              {dim.tableName}.csv
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {dim.rows.length}r
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            FK: <code className="text-emerald-400">{dim.surrogateKeyName}</code>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              onClick={() => handleDownloadSingleCsv(dim.tableName, dim.rows, dim.columns)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                                isBright
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                  : 'bg-[#122347] hover:bg-[#1a3266] text-slate-200 border-[#223d75]'
                              }`}
                            >
                              <Download className="w-2.5 h-2.5" />
                              <span>CSV</span>
                            </button>

                            <button
                              onClick={() => setActivePreviewTable(dim.tableName)}
                              className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                            >
                              Preview
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Individual CSV Download Bar */}
                <div
                  className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div>
                    <span className="font-bold text-xs block">Export Generated Tables</span>
                    <span className="text-[11px] text-slate-400">
                      Download each file individually or bundle everything in a .zip archive.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        handleDownloadSingleCsv(
                          'fact_table',
                          starSchemaResult.factTable.rows,
                          starSchemaResult.factTable.columns
                        )
                      }
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isBright
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                          : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-200'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      <span>fact_table.csv</span>
                    </button>

                    {starSchemaResult.dimensions.map((dim) => (
                      <button
                        key={dim.id}
                        onClick={() => handleDownloadSingleCsv(dim.tableName, dim.rows, dim.columns)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isBright
                            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                            : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-200'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5 text-purple-400" />
                        <span>{dim.tableName}.csv</span>
                      </button>
                    ))}

                    <button
                      onClick={handleDownloadAllZip}
                      disabled={isZipping}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition disabled:opacity-50"
                    >
                      <FileArchive className="w-3.5 h-3.5" />
                      <span>Download All (.zip)</span>
                    </button>
                  </div>
                </div>

                {/* Live Data Preview of Selected Table (Fact or Dimension) */}
                <div
                  className={`rounded-xl border overflow-hidden transition ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div
                    className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b162f] border-[#182747]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Preview Table:
                      </span>
                      <select
                        value={activePreviewTable}
                        onChange={(e) => setActivePreviewTable(e.target.value)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-none border cursor-pointer ${
                          isBright ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#060c18] border-[#182747] text-slate-200'
                        }`}
                      >
                        <option value="fact_table">fact_table.csv ({starSchemaResult.factTable.rows.length} rows)</option>
                        {starSchemaResult.dimensions.map((dim) => (
                          <option key={dim.id} value={dim.tableName}>
                            {dim.tableName}.csv ({dim.rows.length} rows)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() =>
                        handleDownloadSingleCsv(
                          activePreviewData.name,
                          activePreviewData.rows,
                          activePreviewData.columns
                        )
                      }
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download {activePreviewData.name}.csv</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead
                        className={`sticky top-0 z-10 border-b font-mono ${
                          isBright ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0e1933] border-[#182747] text-slate-300'
                        }`}
                      >
                        <tr>
                          <th className="p-2 w-10 text-center font-normal">#</th>
                          {activePreviewData.columns.map((c) => (
                            <th key={c} className="p-2 whitespace-nowrap font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/20 font-mono">
                        {activePreviewData.rows.slice(0, 50).map((row, idx) => (
                          <tr
                            key={idx}
                            className={isBright ? 'hover:bg-slate-50' : 'hover:bg-[#0f1d3a]'}
                          >
                            <td className="p-2 text-center text-slate-400 font-sans">{idx + 1}</td>
                            {activePreviewData.columns.map((c) => (
                              <td key={c} className="p-2 whitespace-nowrap">
                                {row[c] !== null && row[c] !== undefined ? String(row[c]) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW B: SQL SCRIPTING STUDIO (CREATE TABLE, INSERT, SELECT) */}
            {step4SubTab === 'sql_scripting' && (
              <div className="space-y-4">
                {/* Script Type Selector Pills */}
                <div
                  className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      {
                        id: 'all_pipeline',
                        label: 'All-in-One Pipeline',
                        icon: Layers,
                        badge: 'Full ETL',
                      },
                      {
                        id: 'ddl',
                        label: 'CREATE TABLE (DDL)',
                        icon: Database,
                        badge: `${starSchemaResult.dimensions.length + 1} Tables`,
                      },
                      {
                        id: 'etl_select',
                        label: 'INSERT INTO ... SELECT',
                        icon: Split,
                        badge: 'Staging to Star',
                      },
                      {
                        id: 'dml_values',
                        label: 'INSERT INTO ... VALUES',
                        icon: Plus,
                        badge: 'Row Data',
                      },
                      {
                        id: 'queries',
                        label: 'Star Join Analytics (SELECT)',
                        icon: Sigma,
                        badge: 'BI Queries',
                      },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isSel = selectedScriptType === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedScriptType(tab.id as any)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            isSel
                              ? 'bg-blue-600 text-white shadow-xs'
                              : isBright
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              : 'bg-[#0f1b35] hover:bg-[#16274e] text-slate-300 border border-[#203661]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{tab.label}</span>
                          <span
                            className={`text-[10px] px-1 rounded font-normal font-mono ${
                              isSel
                                ? 'bg-blue-800 text-blue-200'
                                : isBright
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-[#182b52] text-slate-300'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions: Run in Studio, Copy, Download */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedScriptType === 'dml_values' && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400">Rows:</span>
                        <select
                          value={dmlMaxRows}
                          onChange={(e) => setDmlMaxRows(Number(e.target.value))}
                          className={`rounded px-2 py-1 text-xs border font-mono ${
                            isBright
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : 'bg-[#060c18] border-[#182747] text-slate-200'
                          }`}
                        >
                          <option value={25}>25 rows</option>
                          <option value={50}>50 rows</option>
                          <option value={100}>100 rows</option>
                          <option value={500}>500 rows</option>
                        </select>
                      </div>
                    )}

                    <button
                      onClick={handleRunScriptInStudio}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition"
                      title="Open and run this script directly inside SQL Studio AlaSQL engine"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Run in SQL Studio</span>
                    </button>

                    <button
                      onClick={handleCopyScript}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        copiedScript
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : isBright
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                          : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-200'
                      }`}
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadScript}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        isBright
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                          : 'bg-[#0f1b35] hover:bg-[#16274e] border-[#203661] text-slate-200'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .sql</span>
                    </button>
                  </div>
                </div>

                {/* Script Header Banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isBright ? 'bg-blue-50/50 border-blue-200' : 'bg-blue-950/20 border-blue-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">
                      {selectedScriptType === 'all_pipeline' && 'Complete Star Schema & SCD ETL Pipeline'}
                      {selectedScriptType === 'ddl' && 'CREATE TABLE DDL (Schemas & Constraints)'}
                      {selectedScriptType === 'etl_select' && 'INSERT INTO ... SELECT (Staging to Star ETL)'}
                      {selectedScriptType === 'dml_values' && 'INSERT INTO ... VALUES (Row Data Population)'}
                      {selectedScriptType === 'queries' && 'Star Join Analytical & SCD Audit Queries'}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Dialect: <strong className="text-blue-400 uppercase">{sqlDialect}</strong>
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {currentScriptSql.split('\n').length} lines
                  </span>
                </div>

                {/* Syntax Highlighted SQL Code Display Box */}
                <div
                  className={`rounded-xl border overflow-hidden font-mono text-xs ${
                    isBright
                      ? 'bg-slate-900 text-slate-100 border-slate-800'
                      : 'bg-[#050a14] text-slate-200 border-[#152340]'
                  }`}
                >
                  <div className="overflow-x-auto max-h-[460px] p-4 font-mono leading-relaxed select-text">
                    <pre className="m-0 whitespace-pre">
                      {highlightSql(currentScriptSql, 'dark')}
                    </pre>
                  </div>
                </div>

                {/* Educational Architecture Explanation */}
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 ${
                    isBright ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#091224] border-[#182747]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-300">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>How this SQL Pipeline works:</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-400 text-[11px] pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <strong className="text-slate-200 block mb-1">1. DDL Schemas & Keys</strong>
                      Generates Primary Keys for Surrogate Keys (`_sk`) and Foreign Key constraints linking the central Fact table back to dimension satellites.
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <strong className="text-slate-200 block mb-1">2. ETL Deduplication</strong>
                      Uses `ROW_NUMBER() OVER()` and `SELECT DISTINCT` to extract unique dimension entities, then joins active versions (`is_current = TRUE`) into the fact table.
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                      <strong className="text-slate-200 block mb-1">3. BI Star Join Reporting</strong>
                      Enables sub-second slice & dice aggregation queries across customers, products, and transaction dates.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
