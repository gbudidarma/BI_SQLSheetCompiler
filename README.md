# SheetSQL Compiler (BI_SQLSheetCompiler)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-gbudidarma.github.io%2FBI__SQLSheetCompiler-2563eb?style=for-the-badge&logo=github)](https://gbudidarma.github.io/BI_SQLSheetCompiler/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-success?style=for-the-badge)](https://gbudidarma.github.io/BI_SQLSheetCompiler/)
<a href='https://ko-fi.com/V7V2JM8S4' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

🌐 **Live Demo Website:** [https://gbudidarma.github.io/BI_SQLSheetCompiler/](https://gbudidarma.github.io/BI_SQLSheetCompiler/)

**SheetSQL Compiler** is a client-side SQL analytics, data modeling, BI engineering, and time-series forecasting web application. Run SQL directly against spreadsheets (Excel `.xlsx` and CSV) and connect to cloud data warehouses right inside your browser with zero database installation required.

---

## 🚀 Key Features

- **Unified Enterprise Database Hub**: Connect to **PostgreSQL**, **AWS Cloud** (Athena, Redshift, S3, RDS/Aurora), **Snowflake**, **Google BigQuery**, and **MCP Servers** (e.g. `https://mcp.coros.com/mcp`) all in 1 unified "Database" menu. Includes automated table introspection, real-time connection latency measurement, and instant in-browser demo datasets.
- **Zero-Bridge & Direct Cloud Execution**: Connect directly from your browser to Neon Serverless PostgreSQL, Supabase PostgREST, Amazon S3 Presigned URLs, Snowflake SQL API, and Google BigQuery REST API without requiring a local bridge server.
- **Offline Direct SQL & CSV Paste Ingester**: Copy and paste table data or SQL DDL/INSERT statements exported from any database tool (DBeaver, pgAdmin, Snowflake Snowsight, BigQuery Studio, DataGrip) directly into in-memory AlaSQL with zero network setup.
- **Cross-Database SQL Analytics**: Query and join tables across Snowflake, BigQuery, AWS, PostgreSQL, and local Excel/CSV spreadsheets simultaneously in memory using standard ANSI SQL.
- **SQL Studio**: Execute ANSI-style SQL queries on in-memory tables powered by AlaSQL. Features syntax highlighting, query history, quick code snippets, intelligent auto-suggest, and instant result export.
- **Data Modeler (ERD)**: Interactive Entity-Relationship Diagram generator with automatic key detection, visual schema exploration, and drag-and-drop join builder.
- **Schema & Data Comparator**: Side-by-side table schema comparisons and row diffing to spot structural discrepancies between files, databases, or versions.
- **Duplicate Checker**: Deep duplicate analysis across single or composite keys with one-click deduplication and clean table export.
- **Visualizer Studio**: Drag-and-drop business intelligence charting tool for bar, line, area, and pie charts with aggregate measures.
- **BI Schema & SCD Builder**: Transform flat transaction spreadsheets into dimensional Star Schemas with Slowly Changing Dimensions (SCD Type 1 & Type 2), Surrogate Key generators, and DDL/DML export.
- **Data Mart OLAP**: Construct analytical data marts and multi-dimensional cubes with dimension hierarchies and measure aggregations.
- **Forecasting Studio**: Predictive time-series modeling with 6 forecasting methods (Auto Best Fit, Holt's Linear Trend, Holt-Winters Seasonality, Linear Regression OLS, Simple Moving Average, Exponential Smoothing), 80%/95% confidence cones, and diagnostics (MAPE, RMSE, MAE, R²).

---

## 🔌 Supported Database & Cloud Connectors

All data sources are accessible in one unified **"Database"** menu in the SQL Schema sidebar:

| Provider | Supported Services / Engines | Execution Modes (Zero Bridge Supported) |
| :--- | :--- | :--- |
| **PostgreSQL** 🐘 | Localhost, Docker, Neon, Supabase, Azure, AWS RDS, GCP Cloud SQL | **⚡ Direct Neon HTTP API**, **⚡ Supabase REST**, **📋 SQL/CSV Paste**, Cloud Gateway, Local Bridge, Demo Profile |
| **AWS Cloud** ☁️ | **Amazon Athena** (S3 Data Lake), **Amazon Redshift** (Data Warehouse), **Amazon S3** (Buckets & Presigned URLs), **Amazon RDS / Aurora** | **⚡ Direct S3 Presigned Fetch**, **📋 SQL/CSV Paste**, Cloud Gateway, Local Bridge, Demo Profile |
| **Snowflake** ❄️ | Snowflake Data Cloud (Warehouses, Databases, Schemas, Roles) | **⚡ Direct SQL REST API v2**, **📋 SQL/CSV Paste**, Cloud Gateway, Local Bridge, Demo Profile |
| **Google BigQuery** 🔍 | Petabyte-scale analytics, GA4 clickstream exports, multi-region datasets | **⚡ Direct Google Cloud REST API v2**, **📋 SQL/CSV Paste**, Cloud Gateway, Local Bridge, Demo Profile |
| **MCP Server** 🤖 | Remote & Local **Model Context Protocol** servers (e.g. **COROS Wearables** at `https://mcp.coros.com/mcp`) | **⚡ Direct MCP HTTP JSON-RPC 2.0**, Bearer Token, COROS Wearables Demo Profile |

### 💡 Cross-Warehouse SQL Example
Query across cloud data warehouses and local spreadsheets in a single query:

```sql
SELECT 
  s.order_id,
  s.order_date,
  s.total_amount,
  b.campaign,
  b.bounce_rate_pct,
  e.customer_name,
  e.loyalty_tier
FROM snowflake_orders_fact s
JOIN bigquery_traffic_sources b ON s.store_id = b.source
JOIN excel_customers e ON s.customer_id = e.customer_id
WHERE s.total_amount > 1000
ORDER BY s.total_amount DESC;
```

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (Default Dark Mode & Bright Mode support)
- **SQL Engine**: AlaSQL (100% in-browser SQL execution)
- **Database Bridge**: Zero-dependency Node.js bridge server (`http`/`https` with Chrome Private Network Access headers)
- **File Parsing**: SheetJS (`xlsx`), JSZip, PapaParse
- **Icons**: Lucide React
- **Deployment**: GitHub Pages via GitHub Actions (Bun)

---

## 💻 Getting Started

### Prerequisites

- Node.js (v18+) or [Bun](https://bun.sh/)

### Installation & Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gbudidarma/BI_SQLSheetCompiler.git
   cd BI_SQLSheetCompiler
   ```

2. **Install dependencies:**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Start the development server:**
   ```bash
   bun run dev
   # or
   npm run dev
   ```

4. **(Optional) Start the local Database Bridge:**
   To connect to real PostgreSQL databases, AWS endpoints, Snowflake, or BigQuery without browser socket limitations:
   ```bash
   npm run bridge
   ```

5. **Build for production:**
   ```bash
   bun run build
   # or
   npm run build
   ```

---

## 👤 Author

Created by **[@gbudidarma](https://instagram.com/gbudidarma)**.

---

## ☕ Support

If you like this project or find it useful, consider supporting its development:

<a href='https://ko-fi.com/V7V2JM8S4' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

---

## 📄 License

MIT / Apache-2.0
