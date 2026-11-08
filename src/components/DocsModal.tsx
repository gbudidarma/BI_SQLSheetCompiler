import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Code2,
  Keyboard,
  HelpCircle,
  Search,
  Terminal,
  GitBranch,
  GitCompare,
  CopyCheck,
  PieChart,
  Split,
  Layers,
  TrendingUp,
  Database,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Filter,
  Lightbulb
} from 'lucide-react';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';
import { AppViewTab } from './TopBar';

export interface FeatureGuideItem {
  id: string;
  viewTab?: AppViewTab;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  summary: string;
  keywords: string[];
  capabilities: string[];
  steps: { title: string; desc: string }[];
  proTip: string;
  exampleSnippet?: string;
  exampleSnippetLang?: 'sql' | 'bash' | 'text';
}

const FEATURE_GUIDES: FeatureGuideItem[] = [
  {
    id: 'studio',
    viewTab: 'studio',
    title: 'SQL Studio',
    badge: 'Core ANSI SQL',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: Terminal,
    iconColor: 'text-blue-400',
    summary:
      'The foundational workspace to query Excel (.xlsx, .xls) and CSV spreadsheets using standard ANSI SQL entirely in-memory with zero server latency.',
    keywords: ['sql', 'query', 'select', 'join', 'editor', 'excel', 'csv', 'format', 'snippets', 'export'],
    capabilities: [
      'Multi-sheet workbooks automatically mapped into independent relational SQL tables',
      'IntelliSense SQL auto-complete (Ctrl + Space) for keywords, tables, and column identifiers',
      'One-click SQL code formatter & VS Code style syntax coloring',
      'Pre-built SQL templates (SELECT, Aggregations, Window Functions, CASE WHEN)',
      'Dual export: Formatted Excel (bundling records + SQL Insert statements) & CSV'
    ],
    steps: [
      {
        title: 'Upload or Connect Data',
        desc: 'Click "+ Upload" to load Excel/CSV files, or connect directly to PostgreSQL via the DBeaver bridge.'
      },
      {
        title: 'Compose SQL Query',
        desc: 'Write standard SQL in the editor. Use Ctrl + Space for column suggestions or choose a template from the "Snippets" menu.'
      },
      {
        title: 'Execute & Inspect Results',
        desc: 'Press Ctrl + Enter (Cmd + Enter on Mac) or click "Run Query" to view data in the virtualized grid.'
      },
      {
        title: 'Export & Share',
        desc: 'Click "Export Excel" to receive a workbook containing both query results and ready-to-run SQL INSERT scripts.'
      }
    ],
    proTip:
      'Every tab in your uploaded Excel workbook becomes a separate table. You can perform multi-table relational joins (e.g. sales_orders INNER JOIN customers ON sales_orders.customer_id = customers.id) across sheets seamlessly!',
    exampleSnippet: `SELECT 
  c.customer_name,
  COUNT(o.order_id) AS total_orders,
  ROUND(SUM(o.amount), 2) AS total_revenue
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id
WHERE o.order_status = 'COMPLETED'
GROUP BY c.customer_name
ORDER BY total_revenue DESC
LIMIT 20;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'bi_schema',
    viewTab: 'bi_schema',
    title: 'BI Schema Architect',
    badge: 'Dimensional Modeling',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: Split,
    iconColor: 'text-emerald-400',
    summary:
      'Design enterprise-grade Data Warehouse dimensional schemas following Kimball methodology. Switch between Star Schema and Snowflake Schema with automated DDL generation.',
    keywords: ['bi schema', 'star schema', 'snowflake schema', 'fact table', 'dimension', 'scd', 'data warehouse', 'ddl', 'olap', 'surrogate key'],
    capabilities: [
      'Star Schema architecture: Centralized Fact table with 1-hop denormalized Dimension satellites for maximum OLAP query speed',
      'Snowflake Schema architecture: Normalized 3NF sub-dimension hierarchy branches to eliminate data redundancy',
      'Architectural trade-off analyzer: Storage savings vs. query join complexity metrics',
      'Automatic Surrogate Key (sk_...) assignment and Slowly Changing Dimension (SCD Type 1 & Type 2) tracking flags',
      'Automated Data Warehouse DDL Export (ANSI SQL, PostgreSQL, BigQuery, Snowflake syntax)'
    ],
    steps: [
      {
        title: 'Choose Architecture Mode',
        desc: 'Select either "Star Schema" (denormalized, fast query execution) or "Snowflake Schema" (normalized 3NF sub-dimensions).'
      },
      {
        title: 'Designate Fact Table',
        desc: 'Select your central quantitative table (e.g., fact_sales) containing transactional metrics and foreign keys.'
      },
      {
        title: 'Configure Dimension Satellites',
        desc: 'Assign contextual tables (e.g., dim_customer, dim_product, dim_date) and assign surrogate keys and SCD flags.'
      },
      {
        title: 'Generate & Export DDL',
        desc: 'Click "Generate DDL" to inspect or copy production-ready SQL warehouse migration scripts.'
      }
    ],
    proTip:
      'Use Star Schema when your primary goal is fast analytical query performance and simplified reporting in BI tools (Power BI, Tableau). Use Snowflake Schema when dimension tables have deep hierarchies (e.g. Category -> Subcategory -> Product) and you need to minimize storage redundancy.',
    exampleSnippet: `-- Star Schema Analytical Query
SELECT 
  d.year,
  d.quarter,
  p.category_name,
  SUM(f.sales_amount) AS total_revenue,
  AVG(f.discount_rate) AS avg_discount
FROM fact_sales AS f
JOIN dim_date AS d ON f.sk_date = d.sk_date
JOIN dim_product AS p ON f.sk_product = p.sk_product
GROUP BY d.year, d.quarter, p.category_name
ORDER BY d.year DESC, total_revenue DESC;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'data_mart',
    viewTab: 'data_mart',
    title: 'Data Mart Studio',
    badge: 'Analytical Marts',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    icon: Layers,
    iconColor: 'text-cyan-400',
    summary:
      'Curate departmental, domain-specific analytical data marts (Sales Mart, Financial Mart, Inventory Mart, Marketing Mart) tailored for business reporting and KPIs.',
    keywords: ['data mart', 'mart', 'kpi', 'metrics', 'olap', 'aggregation', 'department', 'sales mart', 'curate'],
    capabilities: [
      'Pre-built industry templates: Sales Performance, Financial Health, Inventory & Fulfillment, and Customer Insights',
      'Multi-table metric aggregation: Combine raw transaction records with customer and product attributes',
      'Calculated measures & custom business KPIs (Gross Margin %, Customer Lifetime Value, Return Rate)',
      'Interactive multi-dimensional filtering, grouping, and live OLAP Data Grid preview',
      'One-click export of curated business marts directly into Excel or CSV'
    ],
    steps: [
      {
        title: 'Select Mart Template or Start Blank',
        desc: 'Pick an analytical domain template (e.g. Sales Mart) or create a customized business mart.'
      },
      {
        title: 'Include Source Tables',
        desc: 'Select which tables and sheets feed into the mart (e.g. orders, products, regions).'
      },
      {
        title: 'Define Dimensions & Metrics',
        desc: 'Choose grouping dimensions (e.g. Region, Fiscal Quarter) and specify metric formulas (e.g. SUM(revenue) - SUM(cost)).'
      },
      {
        title: 'Preview & Export Mart',
        desc: 'Inspect the live aggregated mart in the preview grid, then click "Export Mart" to distribute to stakeholders.'
      }
    ],
    proTip:
      'Data Marts bridge the gap between technical database schemas and business users. Instead of writing complex 5-table joins every week, curate a Data Mart once and export ready-to-consume summaries!',
    exampleSnippet: `-- Data Mart Materialized View Logic
SELECT 
  r.region_name,
  p.department,
  DATE_TRUNC('month', o.order_date) AS report_month,
  COUNT(DISTINCT o.order_id) AS total_orders,
  SUM(o.quantity) AS units_shipped,
  ROUND(SUM(o.revenue), 2) AS gross_revenue,
  ROUND((SUM(o.revenue) - SUM(o.cost)) / NULLIF(SUM(o.revenue), 0) * 100, 1) AS margin_pct
FROM sales_orders AS o
JOIN products AS p ON o.product_id = p.id
JOIN regions AS r ON o.region_id = r.id
GROUP BY r.region_name, p.department, DATE_TRUNC('month', o.order_date);`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'forecasting',
    viewTab: 'forecasting',
    title: 'Forecasting Studio',
    badge: 'Statistical & ML',
    badgeColor: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    icon: TrendingUp,
    iconColor: 'text-violet-400',
    summary:
      'Run mathematical and statistical time-series forecasting directly on your spreadsheet data without Python or external ML servers.',
    keywords: ['forecast', 'forecasting', 'time series', 'trend', 'linear regression', 'moving average', 'exponential smoothing', 'holt-winters', 'prediction', 'cagr'],
    capabilities: [
      'Automated date & time-series column detection across daily, monthly, quarterly, and annual granularities',
      'Multiple statistical forecast algorithms: Linear Trend Regression, Simple Moving Average (SMA), and Exponential Smoothing (ETS)',
      'Configurable prediction horizon: Project 3, 6, 12, or custom future periods',
      '95% Statistical Confidence Bands: Visualizes the uncertainty range (upper/lower bounds) of projected values',
      'Key trajectory indicators: Historical CAGR (Compound Annual Growth Rate), trend velocity, and next-period projection'
    ],
    steps: [
      {
        title: 'Select Dataset & Time Column',
        desc: 'Choose the table containing your time-series records and pick the Date/Time period column.'
      },
      {
        title: 'Pick Target Metric',
        desc: 'Select the numeric metric you want to forecast (e.g. revenue, active_users, units_sold).'
      },
      {
        title: 'Select Forecasting Algorithm',
        desc: 'Choose Linear Trend (steady growth/decline), Moving Average (smoothing noise), or Exponential Smoothing (weighted recent history).'
      },
      {
        title: 'Set Horizon & Analyze',
        desc: 'Specify how many periods into the future to project. Inspect the forecast chart with confidence intervals and export the data.'
      }
    ],
    proTip:
      'For stable businesses with steady year-over-year expansion, Linear Trend works best. For volatile or seasonal data, Exponential Smoothing (ETS) reacts more accurately to recent shifts by placing heavier weights on recent quarters.',
    exampleSnippet: `-- Conceptual Forecast Projection Model
-- 1. Input: Historical Monthly Revenue
-- 2. Algorithm: Exponential Smoothing with Trend (Holt's Model)
-- 3. Output: 6-Month Projected Horizon with 95% Confidence Bounds
Period | Historical | Forecast | Lower Bound (95%) | Upper Bound (95%)
----------------------------------------------------------------------
Nov-26 | $124,500   | -        | -                 | -
Dec-26 | -          | $131,200 | $126,400          | $136,000
Jan-27 | -          | $134,800 | $128,900          | $140,700
Feb-27 | -          | $138,500 | $131,200          | $145,800`,
    exampleSnippetLang: 'text'
  },
  {
    id: 'duplicates',
    viewTab: 'duplicates',
    title: 'Duplicate Checker',
    badge: 'Data Quality & Hygiene',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: CopyCheck,
    iconColor: 'text-purple-400',
    summary:
      'Scan any table to detect redundant rows across single or composite keys, calculate duplicate rates, generate SQL cleanup queries, and download deduplicated datasets.',
    keywords: ['duplicate', 'duplicates', 'deduplicate', 'clean', 'unique', 'composite key', 'row_number', 'data quality', 'hygiene'],
    capabilities: [
      'Single or Composite Key analysis: Check uniqueness by one column (e.g. email) or combined multi-column keys (e.g. first_name + last_name + birth_date)',
      'Cluster inspection: View exact duplicate clusters with occurrence frequencies and sample row records',
      'Statistical overview: Total rows, Unique records, Redundant duplicate count, and Redundancy % badge',
      'Automated SQL Cleanup Script: Generates ROW_NUMBER() OVER (PARTITION BY ... ORDER BY id) cleanup queries for your database',
      'One-click clean export: Download a clean deduplicated dataset as CSV or Excel immediately'
    ],
    steps: [
      {
        title: 'Choose Target Table',
        desc: 'Select the table you want to inspect for duplicate records.'
      },
      {
        title: 'Specify Matching Columns',
        desc: 'Check the columns that define uniqueness. Click "Select All" to find completely identical duplicate rows.'
      },
      {
        title: 'Run Duplicate Audit',
        desc: 'Click "Analyze Duplicates" to generate the cluster report and identify redundant rows.'
      },
      {
        title: 'Clean or Export',
        desc: 'Click "Export Deduplicated Data" to save a clean CSV, or copy the generated SQL Cleanup script to run on your live database.'
      }
    ],
    proTip:
      'Composite keys prevent false positives! For example, two customers might share the same first name or phone number, but matching on (first_name + phone + street_address) accurately isolates true duplicate entries.',
    exampleSnippet: `-- Generated SQL Deduplication Query (Retaining First Record)
WITH RankedRecords AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY email, company_name 
      ORDER BY created_at ASC
    ) AS row_num
  FROM raw_leads
)
SELECT * 
FROM RankedRecords 
WHERE row_num = 1;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'modeler',
    viewTab: 'modeler',
    title: 'Data Modeler (ERD)',
    badge: 'Interactive ERD',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    icon: GitBranch,
    iconColor: 'text-indigo-400',
    summary:
      'Interactive visual Entity-Relationship Diagram (ERD) canvas. Map foreign key relationships across your tables and visually construct multi-table SQL queries.',
    keywords: ['modeler', 'erd', 'entity relationship', 'foreign key', 'diagram', 'visual query builder', 'relationships', 'canvas'],
    capabilities: [
      'Interactive draggable schema cards with column data types and primary key indicators',
      'Smart foreign key auto-detection based on standard relational naming patterns (e.g. customer_id, order_id)',
      'Click-and-connect relationship links with configurable cardinality (1:1, 1:N, N:M)',
      'Visual Query Builder: Select desired columns and joins with checkboxes to auto-generate complex SQL JOIN queries',
      'Canvas controls: Smooth zoom in/out, pan, reset view, and auto-layout graph arrangements'
    ],
    steps: [
      {
        title: 'View ERD Canvas',
        desc: 'Click "Data Modeler ERD" in the top bar to inspect your tables rendered as interactive relational cards.'
      },
      {
        title: 'Connect Relationships',
        desc: 'Click a key column on one table card and link it to the corresponding foreign key on another table.'
      },
      {
        title: 'Use Visual Query Builder',
        desc: 'Switch to the "Visual Query Builder" tab and check the fields you want in your final result set.'
      },
      {
        title: 'Send Query to Studio',
        desc: 'Click "Execute in Studio" to automatically inject the generated multi-table SQL JOIN query into SQL Studio.'
      }
    ],
    proTip:
      'Use the ERD canvas as a quick schema cheat sheet! When writing queries with multiple tables, glancing at the ERD helps you immediately spot matching ID columns and avoid incorrect JOIN criteria.',
    exampleSnippet: `-- Auto-Generated Visual Modeler Query
SELECT 
  o.order_id,
  o.order_date,
  c.company_name,
  c.contact_email,
  p.product_title,
  o.quantity * p.unit_price AS total_price
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.customer_id
INNER JOIN order_items AS oi ON o.order_id = oi.order_id
INNER JOIN products AS p ON oi.product_id = p.product_id;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'comparator',
    viewTab: 'comparator',
    title: 'Schema Comparator',
    badge: 'Schema & Data Drift',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: GitCompare,
    iconColor: 'text-amber-400',
    summary:
      'Compare any two tables or sheets side-by-side to detect structural schema drift, renamed columns, type alterations, and row count variances.',
    keywords: ['comparator', 'compare', 'diff', 'drift', 'schema compare', 'migration', 'sync'],
    capabilities: [
      'Side-by-side column diffing: Green for new columns, Red for dropped columns, Amber for altered data types',
      'Row count & null distribution audit: Identify table size discrepancies and data density changes',
      'Metric summary cards: Identical columns, Type mismatches, Missing in Source, Missing in Target',
      'Automated SQL Migration Script: Generates ALTER TABLE ADD/DROP/MODIFY statements to synchronize schemas'
    ],
    steps: [
      {
        title: 'Select Base & Target Tables',
        desc: 'Choose your baseline table (e.g. Sales_Q1) and the target comparison table (e.g. Sales_Q2).'
      },
      {
        title: 'Analyze Structural Diff',
        desc: 'Review the instant side-by-side comparison matrix of matching, added, and dropped columns.'
      },
      {
        title: 'Audit Data Drift',
        desc: 'Inspect row count differences and column type mutations.'
      },
      {
        title: 'Copy Sync Script',
        desc: 'Copy the generated SQL migration script if you need to alter your production database schema.'
      }
    ],
    proTip:
      'Schema Comparator is essential when receiving updated Excel files from clients or third parties. Instead of manually inspecting every column, run Compare to instantly see if new columns were added or column names changed.',
    exampleSnippet: `-- Generated Schema Synchronization Script
-- Synchronizing target_table with base_table
ALTER TABLE target_table ADD COLUMN tax_rate DECIMAL(5,2);
ALTER TABLE target_table ADD COLUMN fulfillment_status VARCHAR(50);
ALTER TABLE target_table DROP COLUMN legacy_discount_code;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'visualizer',
    viewTab: 'visualizer',
    title: 'Visualizer Studio',
    badge: 'Interactive BI Charts',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    icon: PieChart,
    iconColor: 'text-pink-400',
    summary:
      'Turn raw spreadsheet data and SQL query results into interactive business charts and analytical graphs with customizable aggregations and high-res image export.',
    keywords: ['visualizer', 'chart', 'charts', 'graph', 'bar chart', 'pie chart', 'line chart', 'area chart', 'radar', 'scatter', 'bi'],
    capabilities: [
      '8+ Chart Types: Vertical Bar, Horizontal Bar, Line Chart, Area Chart, Donut / Pie Chart, Scatter Plot, and Radar',
      'Flexible Metric Aggregations: Dynamic SUM, AVG, COUNT, MIN, and MAX on any numeric field',
      'Multi-category grouping: Group metrics by dates, regions, sales reps, or categories',
      'Sorting and Layout Controls: Ascending, descending, normal or stacked display',
      'High-Resolution Export: Save PNG images for slides and executive presentations or export aggregated CSV data'
    ],
    steps: [
      {
        title: 'Select Source Dataset',
        desc: 'Pick an uploaded table or use the active SQL query result set from SQL Studio.'
      },
      {
        title: 'Choose Chart Type',
        desc: 'Select Bar, Horizontal Bar, Line, Area, Pie/Donut, Scatter, or Radar.'
      },
      {
        title: 'Configure Dimension & Metric',
        desc: 'Select your Category (X-axis) and the Numeric Metric (Y-axis), along with aggregation (e.g. SUM or AVG).'
      },
      {
        title: 'Export & Share',
        desc: 'Click "Export Chart PNG" to download an image for reports or "Export Data" for the aggregated numbers.'
      }
    ],
    proTip:
      'Use Horizontal Bar charts when category names are long (e.g., product titles or full names) to avoid label truncation! Use Line/Area charts for time-based trends and Donut charts for proportional breakdown (under 7 categories).',
    exampleSnippet: `-- Query powering an aggregated Visualizer chart
SELECT 
  product_category,
  ROUND(SUM(revenue), 2) AS total_revenue,
  COUNT(order_id) AS order_volume
FROM sales_records
GROUP BY product_category
ORDER BY total_revenue DESC;`,
    exampleSnippetLang: 'sql'
  },
  {
    id: 'postgres',
    title: 'PostgreSQL Connector (DBeaver Style)',
    badge: 'Database Bridge',
    badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    icon: Database,
    iconColor: 'text-sky-400',
    summary:
      'Connect SheetSQL directly to local or cloud PostgreSQL databases using a lightweight, zero-dependency Node.js bridge server. Introspect schemas, browse tables, and run queries into SheetSQL memory.',
    keywords: ['postgres', 'postgresql', 'database', 'dbeaver', 'bridge', 'connector', 'host', 'port', 'schema', 'introspect'],
    capabilities: [
      'Zero-dependency bridge: Runs locally via node scripts/postgresBridge.cjs with built-in Chrome Private Network Access headers',
      'Connects to localhost, Docker, AWS RDS, Supabase, Neon, GCP Cloud SQL, or custom Postgres servers',
      'Schema introspection: Browse public and custom database schemas, tables, and column data types',
      'In-memory query execution: Query remote Postgres tables and pull result sets directly into SheetSQL memory for instant charting and modeling'
    ],
    steps: [
      {
        title: 'Start the Local Bridge',
        desc: 'In your terminal, run "node scripts/postgresBridge.cjs" (or "npm run bridge").'
      },
      {
        title: 'Open Postgres Modal',
        desc: 'Click the "Postgres" button in the SQL Studio sidebar.'
      },
      {
        title: 'Enter Credentials & Connect',
        desc: 'Fill in Host (e.g. localhost), Port (5432), Database, User, Password, and SSL mode, then click "Test & Connect".'
      },
      {
        title: 'Browse & Query',
        desc: 'Explore database tables, view schemas, and click "Query Table" to load records into SheetSQL.'
      }
    ],
    proTip:
      'Because modern browsers block web pages from directly opening raw TCP database sockets, the lightweight local bridge acts as a secure proxy. No third-party software or heavy drivers are required!',
    exampleSnippet: `# 1. Start the zero-dependency bridge in your terminal:
node scripts/postgresBridge.cjs

# 2. Output:
# [Postgres Bridge] Running on http://127.0.0.1:4000
# [Postgres Bridge] Chrome PNA headers enabled`,
    exampleSnippetLang: 'bash'
  },
  {
    id: 'pro',
    title: 'Pro Mode & License Keys',
    badge: 'Freemium & Offline License',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Sparkles,
    iconColor: 'text-amber-400',
    summary:
      'SheetSQL operates on a freemium model. Free users can open and query up to 2 tables simultaneously. Pro Mode unlocks permanent unlimited tables via a 1-time Ko-fi license key.',
    keywords: ['pro', 'license', 'key', 'unlimited', 'ko-fi', 'freemium', 'pricing', 'offline', 'activation'],
    capabilities: [
      'Free Tier: Open up to 2 Excel sheets / CSV tables simultaneously with complete access to all studio tools',
      'Pro Mode: Unlock permanent unlimited tables and sheets',
      '100% Offline verification: License keys are cryptographically validated in-browser using SHA-256 without external server calls',
      'One-time purchase for $5 on Ko-fi (https://ko-fi.com/s/9b3a2aa6fe) with immediate key delivery'
    ],
    steps: [
      {
        title: 'Click Unlock Unlimited / PRO',
        desc: 'Click the PRO badge in the top navigation bar or the sidebar.'
      },
      {
        title: 'Obtain License Key',
        desc: 'Visit https://ko-fi.com/s/9b3a2aa6fe to get a permanent SheetSQL Pro license key.'
      },
      {
        title: 'Enter Key & Activate',
        desc: 'Paste your key (format: SSQL-XXXX-XXXX-XXXX-XXXX) and click "Activate Pro".'
      },
      {
        title: 'Enjoy Unlimited Tables',
        desc: 'SheetSQL securely remembers your activation in browser storage and permanently removes the 2-table limit.'
      }
    ],
    proTip:
      'All verification logic executes strictly inside your browser. No telemetry or activation ping is ever transmitted over the network, ensuring complete privacy in air-gapped corporate environments.',
    exampleSnippet: `License Key Format:
SSQL-XXXX-XXXX-XXXX-XXXX

Example:
SSQL-A7F9-82BC-4E11-903D`,
    exampleSnippetLang: 'text'
  }
];

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'features' | 'docs' | 'syntax' | 'shortcuts';
  initialSection?: string;
  onNavigateToView?: (view: AppViewTab) => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'features',
  initialSection,
  onNavigateToView,
}) => {
  const { theme } = useTheme();
  const isBright = theme === 'bright';

  const [activeTab, setActiveTab] = useState<'features' | 'docs' | 'syntax' | 'shortcuts'>(defaultTab);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>(initialSection || 'studio');
  const [searchQuery, setSearchQuery] = useState<string>('');

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  React.useEffect(() => {
    if (initialSection) {
      setSelectedFeatureId(initialSection);
      setActiveTab('features');
    }
  }, [initialSection]);

  // Filter features based on search input
  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FEATURE_GUIDES;
    return FEATURE_GUIDES.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)) ||
        item.capabilities.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  const activeFeature = useMemo(() => {
    const found = FEATURE_GUIDES.find((f) => f.id === selectedFeatureId);
    return found || filteredFeatures[0] || FEATURE_GUIDES[0];
  }, [selectedFeatureId, filteredFeatures]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 overflow-y-auto">
      <div
        className={`rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border transition-colors ${
          isBright
            ? 'bg-white border-slate-300 text-slate-800 shadow-xl'
            : 'bg-[#0b1429] border-[#1b315e] text-slate-100 shadow-2xl shadow-blue-950/50'
        }`}
      >
        {/* Header with Title & Close Button */}
        <div
          className={`flex flex-wrap items-center justify-between p-3.5 sm:p-4 border-b shrink-0 gap-3 ${
            isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#080f20] border-[#182c54]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">SheetSQL Guide & Documentation</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  v2.5
                </span>
              </div>
              <p className={`text-xs ${isBright ? 'text-slate-500' : 'text-slate-400'}`}>
                Complete user guide for BI Schema, Data Mart, Forecasting, Duplicate Checker & SQL Studio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isBright
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
            }`}
            title="Close Documentation"
            aria-label="Close Documentation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Tab Switcher */}
        <div
          className={`flex items-center gap-1.5 px-4 sm:px-6 py-2.5 border-b shrink-0 text-xs overflow-x-auto ${
            isBright ? 'bg-slate-100/70 border-slate-200' : 'bg-[#070e1c] border-[#182c54]'
          }`}
        >
          <button
            onClick={() => setActiveTab('features')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'features'
                ? 'bg-blue-600 text-white shadow-sm'
                : isBright
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Feature & Menu Guide</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'features' ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              10
            </span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'docs'
                ? 'bg-blue-600 text-white shadow-sm'
                : isBright
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Core Principles</span>
          </button>

          <button
            onClick={() => setActiveTab('syntax')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'syntax'
                ? 'bg-blue-600 text-white shadow-sm'
                : isBright
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL Syntax Reference</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? 'bg-blue-600 text-white shadow-sm'
                : isBright
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#122347]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* TAB 1: ALL FEATURE & MENU GUIDES */}
          {activeTab === 'features' && (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Search & Feature Navigation List */}
              <div
                className={`w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0 ${
                  isBright ? 'bg-slate-50/70 border-slate-200' : 'bg-[#070e1c] border-[#182c54]'
                }`}
              >
                {/* Search Bar */}
                <div className="p-3 border-b border-inherit">
                  <div
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                      isBright
                        ? 'bg-white border-slate-300 text-slate-800'
                        : 'bg-[#0c162e] border-[#1d3361] text-slate-200'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search menu or feature..."
                      className="bg-transparent border-none outline-none w-full placeholder:text-slate-400"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Feature List (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredFeatures.map((item) => {
                    const isSelected = activeFeature?.id === item.id;
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedFeatureId(item.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition cursor-pointer text-xs group ${
                          isSelected
                            ? isBright
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                              : 'bg-blue-600/20 text-white border border-blue-500/40 shadow-xs'
                            : isBright
                            ? 'text-slate-700 hover:bg-slate-100/80 border border-transparent'
                            : 'text-slate-300 hover:bg-[#101e3b] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? isBright
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-blue-600 text-white border-blue-500'
                                : isBright
                                ? 'bg-white border-slate-200 text-slate-600'
                                : 'bg-[#0d1a38] border-[#1e3868] ' + item.iconColor
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.title}</div>
                            <div
                              className={`text-[10px] truncate ${
                                isBright ? 'text-slate-400' : 'text-slate-400'
                              }`}
                            >
                              {item.badge}
                            </div>
                          </div>
                        </div>

                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                            isSelected
                              ? 'text-blue-500 translate-x-0.5'
                              : 'text-slate-400 opacity-40 group-hover:opacity-100'
                          }`}
                        />
                      </button>
                    );
                  })}

                  {filteredFeatures.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No feature found matching &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Feature Detailed Guide */}
              <div
                className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${
                  isBright ? 'bg-white' : 'bg-[#050a14]'
                }`}
              >
                {activeFeature && (
                  <div className="space-y-6 max-w-3xl">
                    {/* Feature Title Banner */}
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#091329] border-[#182c54]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                            isBright
                              ? 'bg-white border-slate-200 ' + activeFeature.iconColor
                              : 'bg-[#0d1b3b] border-[#1f3a6e] ' + activeFeature.iconColor
                          }`}
                        >
                          {React.createElement(activeFeature.icon, { className: 'w-6 h-6' })}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-bold">{activeFeature.title}</h3>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${activeFeature.badgeColor}`}
                            >
                              {activeFeature.badge}
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isBright ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            {activeFeature.summary}
                          </p>
                        </div>
                      </div>

                      {/* Quick Jump Action Button */}
                      {activeFeature.viewTab && onNavigateToView && (
                        <button
                          onClick={() => {
                            onNavigateToView(activeFeature.viewTab!);
                            onClose();
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-sm cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                        >
                          <span>Open in App</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Section 1: Key Capabilities */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Key Capabilities</span>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {activeFeature.capabilities.map((cap, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                              isBright
                                ? 'bg-slate-50/70 border-slate-200 text-slate-700'
                                : 'bg-[#0b1429] border-[#182c54] text-slate-200'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <span className="leading-relaxed">{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 2: Step-by-Step Guide */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>How to Use (Step-by-Step)</span>
                      </h4>
                      <div className="space-y-2">
                        {activeFeature.steps.map((st, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                              isBright
                                ? 'bg-white border-slate-200 text-slate-700'
                                : 'bg-[#0c162e] border-[#182c54] text-slate-300'
                            }`}
                          >
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                              {idx + 1}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {st.title}
                              </div>
                              <div
                                className={`leading-relaxed ${
                                  isBright ? 'text-slate-600' : 'text-slate-400'
                                }`}
                              >
                                {st.desc}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Pro Tip */}
                    <div
                      className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                        isBright
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold uppercase tracking-wider text-[10px] text-amber-500 mb-0.5">
                          Pro Tip & Best Practice
                        </div>
                        <div className="leading-relaxed">{activeFeature.proTip}</div>
                      </div>
                    </div>

                    {/* Section 4: Example / Code Snippet */}
                    {activeFeature.exampleSnippet && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Sample Syntax / Workflow</span>
                        </h4>
                        <div
                          className={`p-3.5 rounded-xl border font-mono text-[11px] overflow-x-auto leading-relaxed ${
                            isBright
                              ? 'bg-slate-900 text-slate-100 border-slate-800'
                              : 'bg-[#070e1c] text-slate-200 border-[#182c54]'
                          }`}
                        >
                          <pre>{activeFeature.exampleSnippet}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CORE PRINCIPLES (How it works) */}
          {activeTab === 'docs' && (
            <div
              className={`flex-1 overflow-y-auto p-6 space-y-6 text-xs ${
                isBright ? 'bg-white text-slate-700' : 'bg-[#050a14] text-slate-300'
              }`}
            >
              <div className="max-w-3xl space-y-5">
                <div
                  className={`p-4 rounded-xl border ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <h3 className="text-sm font-bold text-blue-500 mb-1.5">1. Header Mapping Rule</h3>
                  <p className="leading-relaxed">
                    The <span className="font-semibold text-blue-400">first row of every Excel worksheet or CSV</span> is always treated as the column header. Header titles are automatically cleaned and normalized into ANSI SQL identifiers (for example: <code className="font-mono px-1 py-0.5 rounded bg-blue-500/10">Unit Price ($)</code> becomes <code className="font-mono px-1 py-0.5 rounded bg-blue-500/10">unit_price_usd</code>).
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <h3 className="text-sm font-bold text-emerald-500 mb-1.5">2. Multi-Sheet Workbooks as Relational Tables</h3>
                  <p className="leading-relaxed">
                    When an Excel workbook contains multiple tabs (e.g. <code className="font-mono px-1 py-0.5 rounded bg-emerald-500/10">Orders</code> and <code className="font-mono px-1 py-0.5 rounded bg-emerald-500/10">Customers</code>), each worksheet is loaded as an independent SQL table in browser memory. You can perform full <code className="font-mono font-bold text-emerald-400">INNER JOIN</code>, <code className="font-mono font-bold text-emerald-400">LEFT JOIN</code>, subqueries, and cross-sheet unions without any database server!
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <h3 className="text-sm font-bold text-purple-500 mb-1.5">3. 100% Client-Side Privacy (Zero Server Storage)</h3>
                  <p className="leading-relaxed">
                    All file parsing, SQL execution, ERD layout rendering, and chart aggregations run locally inside your browser memory (WebAssembly & JavaScript). Your sensitive financial spreadsheets, patient records, or business logs <span className="font-semibold text-purple-400">never leave your computer</span>.
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <h3 className="text-sm font-bold text-amber-500 mb-1.5">4. Dual Export: Formatted Excel & SQL Insert Script</h3>
                  <p className="leading-relaxed">
                    SheetSQL enables you to export both the raw aggregated query results and ready-to-run SQL DDL & INSERT scripts bundled into a single Excel workbook with dedicated sheets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SQL SYNTAX REFERENCE */}
          {activeTab === 'syntax' && (
            <div
              className={`flex-1 overflow-y-auto p-6 space-y-5 text-xs ${
                isBright ? 'bg-white text-slate-700' : 'bg-[#050a14] text-slate-300'
              }`}
            >
              <div className="max-w-3xl space-y-4">
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <div className="font-bold text-blue-500 font-mono text-xs">
                    1. Filtering & Grouped Aggregations
                  </div>
                  <pre
                    className={`font-mono text-[11px] p-3 rounded-lg border leading-relaxed overflow-x-auto ${
                      isBright
                        ? 'bg-slate-900 text-slate-100 border-slate-800'
                        : 'bg-[#070e1c] text-slate-300 border-[#162544]'
                    }`}
                  >
{highlightSql(`SELECT 
  category, 
  COUNT(*) AS total_items, 
  ROUND(AVG(price), 2) AS avg_price 
FROM products 
WHERE stock > 0 
GROUP BY category 
HAVING COUNT(*) > 1 
ORDER BY avg_price DESC;`, ['products'], ['category', 'price', 'stock'], theme)}
                  </pre>
                </div>

                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <div className="font-bold text-emerald-500 font-mono text-xs">
                    2. Cross-Sheet Multi-Table Relational JOIN
                  </div>
                  <pre
                    className={`font-mono text-[11px] p-3 rounded-lg border leading-relaxed overflow-x-auto ${
                      isBright
                        ? 'bg-slate-900 text-slate-100 border-slate-800'
                        : 'bg-[#070e1c] text-slate-300 border-[#162544]'
                    }`}
                  >
{highlightSql(`SELECT 
  o.order_id, 
  c.customer_name, 
  o.units_sold * p.unit_price AS total_usd
FROM sales_orders AS o
INNER JOIN product_catalog AS p ON o.product_id = p.product_id
INNER JOIN customers AS c ON o.customer_id = c.id
WHERE o.order_date >= '2026-01-01';`, ['sales_orders', 'product_catalog', 'customers'], [], theme)}
                  </pre>
                </div>

                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <div className="font-bold text-purple-500 font-mono text-xs">
                    3. Conditional Logic (CASE WHEN ... THEN ... ELSE ... END)
                  </div>
                  <pre
                    className={`font-mono text-[11px] p-3 rounded-lg border leading-relaxed overflow-x-auto ${
                      isBright
                        ? 'bg-slate-900 text-slate-100 border-slate-800'
                        : 'bg-[#070e1c] text-slate-300 border-[#162544]'
                    }`}
                  >
{highlightSql(`SELECT 
  product_name,
  stock_level,
  CASE 
    WHEN stock_level <= 10 THEN 'LOW INVENTORY'
    WHEN stock_level <= 50 THEN 'HEALTHY'
    ELSE 'OVERSTOCKED'
  END AS inventory_health_status
FROM product_catalog;`, ['product_catalog'], ['product_name', 'stock_level'], theme)}
                  </pre>
                </div>

                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                  }`}
                >
                  <div className="font-bold text-amber-500 font-mono text-xs">
                    4. Window Function (Deduplication / Ranking)
                  </div>
                  <pre
                    className={`font-mono text-[11px] p-3 rounded-lg border leading-relaxed overflow-x-auto ${
                      isBright
                        ? 'bg-slate-900 text-slate-100 border-slate-800'
                        : 'bg-[#070e1c] text-slate-300 border-[#162544]'
                    }`}
                  >
{highlightSql(`SELECT * FROM (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY email 
      ORDER BY signup_date DESC
    ) AS ranking
  FROM users
) ranked
WHERE ranking = 1;`, ['users'], ['email', 'signup_date'], theme)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KEYBOARD SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div
              className={`flex-1 overflow-y-auto p-6 space-y-4 text-xs ${
                isBright ? 'bg-white text-slate-700' : 'bg-[#050a14] text-slate-300'
              }`}
            >
              <div className="max-w-3xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Execute Current Query</span>
                    <div className="flex gap-1 font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Ctrl
                      </kbd>
                      <span>+</span>
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Enter
                      </kbd>
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Trigger Auto-Suggest</span>
                    <div className="flex gap-1 font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Ctrl
                      </kbd>
                      <span>+</span>
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Space
                      </kbd>
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Accept Suggestion</span>
                    <div className="flex gap-1 font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Tab
                      </kbd>
                      <span className="text-slate-400">or</span>
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Enter
                      </kbd>
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Navigate Suggestions</span>
                    <div className="flex gap-1 font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        ↑
                      </kbd>
                      <span>/</span>
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        ↓
                      </kbd>
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Dismiss Suggestions</span>
                    <div className="font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Esc
                      </kbd>
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      isBright ? 'bg-slate-50 border-slate-200' : 'bg-[#0b1429] border-[#182c54]'
                    }`}
                  >
                    <span className="font-medium">Indent SQL Query</span>
                    <div className="font-mono text-[11px]">
                      <kbd
                        className={`px-2 py-1 rounded border font-bold ${
                          isBright
                            ? 'bg-white border-slate-300 text-slate-800'
                            : 'bg-[#0f1d3b] border-[#1e3868] text-slate-200'
                        }`}
                      >
                        Tab (2 spaces)
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
