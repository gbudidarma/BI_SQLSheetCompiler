import React, { useState } from 'react';
import { X, BookOpen, Code2, Keyboard, HelpCircle } from 'lucide-react';
import { highlightSql } from '../utils/sqlHighlighter';
import { useTheme } from '../context/ThemeContext';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'docs' | 'syntax' | 'shortcuts';
}

export const DocsModal: React.FC<DocsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'docs',
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'docs' | 'syntax' | 'shortcuts'>(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-[#0b1429] border border-[#1b315e] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-blue-950/50 overflow-hidden">
        {/* Header with Navigation */}
        <div className="flex flex-wrap items-center justify-between p-3 sm:p-4 border-b border-[#182c54] shrink-0 bg-[#080f20] gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">SheetSQL Documentation</h2>
              <p className="text-xs text-slate-400">Compiler guide, SQL syntax specifications, and shortcuts</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 py-2 bg-[#070e1c] border-b border-[#182c54] shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'docs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How it Works</span>
          </button>
          <button
            onClick={() => setActiveTab('syntax')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'syntax' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL Syntax Reference</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'shortcuts' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 bg-[#050a14]">
          {activeTab === 'docs' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">1. Header Mapping Rule</h3>
                <p className="text-slate-400 leading-relaxed">
                  As required, the <span className="text-blue-400 font-semibold">first row of every Excel worksheet or CSV is always treated as the column header</span>.
                  Header text is automatically normalized into clean SQL identifiers (e.g. &quot;Unit Price ($)&quot; becomes <code className="text-slate-200 font-mono">unit_price_usd</code>).
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">2. Multi-Sheet Workbooks as Relational Tables</h3>
                <p className="text-slate-400 leading-relaxed">
                  If your Excel workbook contains multiple tabs (e.g. <code className="text-slate-200 font-mono">Orders</code> and <code className="text-slate-200 font-mono">Customers</code>), each worksheet is loaded as its own independent SQL table. You can perform full <code className="text-blue-400 font-mono">INNER JOIN</code>, <code className="text-blue-400 font-mono">LEFT JOIN</code>, and cross-sheet unions!
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">3. Zero-Server Client-Side Execution</h3>
                <p className="text-slate-400 leading-relaxed">
                  All spreadsheet parsing, SQL compilation, query planning, and data visualization happen completely in your browser memory. Your confidential spreadsheet data never leaves your device.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">4. Insert Script & Excel Export</h3>
                <p className="text-slate-400 leading-relaxed">
                  You can generate complete SQL DDL and INSERT scripts from any query result, and even export an Excel file that bundles both the raw result records and the SQL Insert script into separate sheets.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'syntax' && (
            <div className="space-y-4">
              <div className="bg-[#0b1429] p-4 rounded-lg border border-[#182c54] space-y-2">
                <div className="font-semibold text-slate-200 font-mono">Filtering & Aggregation</div>
                <pre className="font-mono text-slate-300 text-[11px] bg-[#070e1c] p-2.5 rounded border border-[#162544] leading-5">
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

              <div className="bg-[#0b1429] p-4 rounded-lg border border-[#182c54] space-y-2">
                <div className="font-semibold text-slate-200 font-mono">Multi-Sheet JOIN</div>
                <pre className="font-mono text-slate-300 text-[11px] bg-[#070e1c] p-2.5 rounded border border-[#162544] leading-5">
{highlightSql(`SELECT 
  o.order_id, 
  c.customer_name, 
  o.units_sold * p.unit_price AS total_usd
FROM sales_orders AS o
INNER JOIN product_catalog AS p ON o.product_id = p.product_id
INNER JOIN customers AS c ON o.customer_id = c.id;`, ['sales_orders', 'product_catalog', 'customers'], [], theme)}
                </pre>
              </div>

              <div className="bg-[#0b1429] p-4 rounded-lg border border-[#182c54] space-y-2">
                <div className="font-semibold text-slate-200 font-mono">Conditional Logic (CASE WHEN)</div>
                <pre className="font-mono text-slate-300 text-[11px] bg-[#070e1c] p-2.5 rounded border border-[#162544] leading-5">
{highlightSql(`SELECT 
  product_name,
  CASE 
    WHEN stock_level <= 10 THEN 'LOW INVENTORY'
    WHEN stock_level <= 50 THEN 'NORMAL'
    ELSE 'SURPLUS'
  END AS inventory_status
FROM product_catalog;`, ['product_catalog'], ['product_name', 'stock_level', 'inventory_status'], theme)}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Trigger Auto-Suggest</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Space</kbd>
                  </div>
                </div>

                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Accept Suggestion</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Tab</kbd>
                    <span className="text-slate-500">or</span>
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Enter</kbd>
                  </div>
                </div>

                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Navigate Suggestions</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">↑</kbd>
                    <span>/</span>
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">↓</kbd>
                  </div>
                </div>

                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Dismiss Suggestions</span>
                  <div className="font-mono text-[11px]">
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Esc</kbd>
                  </div>
                </div>

                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Execute Current Query</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Enter</kbd>
                  </div>
                </div>

                <div className="bg-[#0b1429] p-3.5 rounded-lg border border-[#182c54] flex items-center justify-between">
                  <span className="text-slate-300">Indent Query (2 spaces)</span>
                  <div className="font-mono text-[11px]">
                    <kbd className="px-2.5 py-1 bg-[#0f1d3b] rounded border border-[#1e3868] text-slate-200">Tab</kbd>
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
