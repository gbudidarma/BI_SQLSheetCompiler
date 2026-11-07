# SheetSQL Compiler (BI_SQLSheetCompiler)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-gbudidarma.github.io%2FBI__SQLSheetCompiler-2563eb?style=for-the-badge&logo=github)](https://gbudidarma.github.io/BI_SQLSheetCompiler/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-success?style=for-the-badge)](https://gbudidarma.github.io/BI_SQLSheetCompiler/)
<a href='https://ko-fi.com/V7V2JM8S4' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

🌐 **Live Demo Website:** [https://gbudidarma.github.io/BI_SQLSheetCompiler/](https://gbudidarma.github.io/BI_SQLSheetCompiler/)

**SheetSQL Compiler** is a client-side SQL analytics, data modeling, BI engineering, and time-series forecasting web application. Run SQL directly against spreadsheets (Excel `.xlsx` and CSV) right inside the browser with zero database setup required.

---

## 🚀 Key Features

- **SQL Studio**: Execute ANSI-style SQL queries on in-memory tables powered by AlaSQL. Features syntax highlighting, query history, quick code snippets, intelligent auto-suggest, and instant result export.
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
- **Styling**: Tailwind CSS (Default Dark Mode & Bright Mode support)
- **SQL Engine**: AlaSQL (100% in-browser SQL execution)
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

4. **Build for production:**
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
