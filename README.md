# SheetSQL Compiler

**SheetSQL Compiler** is a client-side SQL analytics, data modeling, BI engineering, and time-series forecasting web application. Run SQL directly against spreadsheets (Excel `.xlsx` and CSV) right inside the browser with zero database setup required.

---

## 🚀 Key Features

- **SQL Studio**: Execute ANSI-style SQL queries on in-memory tables powered by AlaSQL. Features syntax highlighting, query history, quick code snippets, and instant result export.
- **Data Modeler (ERD)**: Interactive Entity-Relationship Diagram generator with automatic key detection, visual schema exploration, and drag-and-drop join builder.
- **Schema & Data Comparator**: Side-by-side table schema comparisons and row diffing to spot structural discrepancies between files or versions.
- **Duplicate Checker**: Deep duplicate analysis across single or composite keys with one-click deduplication and clean table export.
- **Visualizer Studio**: Drag-and-drop business intelligence charting tool for bar, line, area, and pie charts with aggregate measures.
- **BI Schema & SCD Builder**: Transform flat transaction spreadsheets into dimensional Star Schemas with Slowly Changing Dimensions (SCD Type 1 & Type 2), Surrogate Key generators, and DDL/DML export.
- **Data Mart OLAP**: Construct analytical data marts and multi-dimensional cubes with dimension hierarchies and measure aggregations.
- **Forecasting Studio**: Predictive time-series modeling with 6 forecasting methods (Auto Best Fit, Holt's Linear Trend, Holt-Winters Seasonality, Linear Regression OLS, Simple Moving Average, Exponential Smoothing), 80%/95% confidence cones, and diagnostics (MAPE, RMSE, MAE, R²).

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (Dark Mode & Bright Mode support)
- **SQL Engine**: AlaSQL (100% in-browser SQL execution)
- **File Parsing**: SheetJS (`xlsx`), JSZip, PapaParse
- **Icons**: Lucide React

---

## 💻 Getting Started

### Prerequisites

- Node.js (v18+) or Bun / pnpm / yarn

### Installation & Development

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd SheetSQL-Compiler
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   # or
   bun run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📄 License

MIT / Apache-2.0
