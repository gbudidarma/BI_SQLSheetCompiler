import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Terminal,
  GitBranch,
  GitCompare,
  BookOpen,
  CopyCheck,
  PieChart,
  Sun,
  Moon,
  Menu,
  X,
  History,
  Code2,
  Keyboard,
  HelpCircle,
  Split,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MoreHorizontal,
  Instagram,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { isProUnlocked } from '../utils/licenseManager';

export type AppViewTab =
  | 'studio'
  | 'modeler'
  | 'comparator'
  | 'duplicates'
  | 'visualizer'
  | 'bi_schema'
  | 'data_mart'
  | 'forecasting';

interface TopBarProps {
  activeView: AppViewTab;
  onChangeView: (view: AppViewTab) => void;
  onOpenUpload: () => void;
  onOpenDocs: () => void;
  onOpenSyntax: () => void;
  onOpenShortcuts: () => void;
  onOpenHistory: () => void;
  onOpenProModal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onChangeView,
  onOpenUpload,
  onOpenDocs,
  onOpenSyntax,
  onOpenShortcuts,
  onOpenHistory,
  onOpenProModal,
}) => {
  const { theme, setTheme } = useTheme();
  const [isPro, setIsPro] = useState(isProUnlocked());

  useEffect(() => {
    const handleLicenseChange = () => {
      setIsPro(isProUnlocked());
    };
    window.addEventListener('sheetsql:license-changed', handleLicenseChange);
    return () => window.removeEventListener('sheetsql:license-changed', handleLicenseChange);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Close More menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moreMenuOpen]);

  // Handle horizontal mouse wheel scrolling across tabs
  const handleNavWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (navScrollRef.current) {
      if (e.deltaY !== 0) {
        navScrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const scrollAmount = 220;
      navScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-5 py-2 sm:py-2.5 bg-[#0b1329] border-b border-[#182747] shrink-0 z-30 shadow-md">
        {/* Zone 1: Brand title & Desktop View Switcher */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/40">
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 font-sans leading-none">
                SheetSQL
              </span>
              <span className="text-[10px] text-blue-400 font-mono hidden sm:inline leading-tight">
                Compiler
              </span>
            </div>
          </div>

          {/* Primary View Navigation Switcher (Desktop: md+) with Left/Right scroll controls */}
          <div className="hidden md:flex items-center min-w-0 flex-1 relative group/nav">
            <button
              type="button"
              onClick={() => scrollNav('left')}
              className="flex items-center justify-center w-6 h-6 mr-1 rounded-md bg-[#0e1b38] hover:bg-[#182f5e] text-slate-400 hover:text-white border border-[#1d3361] shrink-0 cursor-pointer shadow-xs transition"
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              ref={navScrollRef}
              onWheel={handleNavWheel}
              className="flex items-center gap-1 p-1 bg-[#070e1c] rounded-lg border border-[#162544] text-xs overflow-x-auto scrollbar-none select-none max-w-full"
              style={{ scrollBehavior: 'smooth' }}
            >
              <button
                onClick={() => onChangeView('studio')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'studio'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>SQL Studio</span>
              </button>

              <button
                onClick={() => onChangeView('modeler')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'modeler'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Data Modeler</span>
                <span className="text-[10px] bg-blue-400/20 text-blue-300 px-1.5 py-0.2 rounded font-normal hidden lg:inline">
                  ERD
                </span>
              </button>

              <button
                onClick={() => onChangeView('comparator')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'comparator'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Compare</span>
              </button>

              <button
                onClick={() => onChangeView('duplicates')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'duplicates'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CopyCheck className="w-3.5 h-3.5" />
                <span>Duplicate Checker</span>
              </button>

              <button
                onClick={() => onChangeView('visualizer')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'visualizer'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PieChart className="w-3.5 h-3.5 text-pink-400" />
                <span>Visualizer</span>
                <span className="text-[10px] bg-pink-400/20 text-pink-300 px-1.5 py-0.2 rounded font-normal hidden lg:inline">
                  BI
                </span>
              </button>

              <button
                onClick={() => onChangeView('bi_schema')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'bi_schema'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Split className="w-3.5 h-3.5 text-emerald-400" />
                <span>BI Schema</span>
                <span className="text-[10px] bg-emerald-400/20 text-emerald-300 px-1.5 py-0.2 rounded font-normal hidden lg:inline">
                  SCD
                </span>
              </button>

              <button
                onClick={() => onChangeView('data_mart')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'data_mart'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Data Mart</span>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-1.5 py-0.2 rounded font-normal hidden lg:inline">
                  OLAP
                </span>
              </button>

              {/* NEW TAB: Forecasting */}
              <button
                onClick={() => onChangeView('forecasting')}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeView === 'forecasting'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                <span>Forecasting</span>
                <span className="text-[10px] bg-violet-400/20 text-violet-300 px-1.5 py-0.2 rounded font-normal hidden lg:inline">
                  ML/Stat
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => scrollNav('right')}
              className="flex items-center justify-center w-6 h-6 ml-1 rounded-md bg-[#0e1b38] hover:bg-[#182f5e] text-slate-400 hover:text-white border border-[#1d3361] shrink-0 cursor-pointer shadow-xs transition"
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Zone 2: "More" Menu dropdown for Documentation, Syntax Reference, Shortcuts, History */}
        <div ref={moreMenuRef} className="relative hidden md:block shrink-0">
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border shadow-xs ${
              moreMenuOpen
                ? 'bg-[#14264d] border-blue-500/50 text-white ring-2 ring-blue-500/20'
                : 'text-slate-300 hover:text-white bg-[#0e1b38] hover:bg-[#14264d] border-[#1d3361]'
            }`}
            title="More Options (Documentation, Syntax Reference, Shortcuts, History)"
            aria-expanded={moreMenuOpen}
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>More</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${moreMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* More Menu Dropdown Popover */}
          {moreMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0c162e] border border-[#1b315e] p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#162544] mb-1">
                Help & Reference
              </div>

              <button
                onClick={() => {
                  onOpenDocs();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#14264d] transition cursor-pointer text-left group"
              >
                <div className="w-6 h-6 rounded-md bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Documentation</div>
                  <div className="text-[10px] text-slate-400">Guides, features & tutorials</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenSyntax();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#14264d] transition cursor-pointer text-left group"
              >
                <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Syntax Reference</div>
                  <div className="text-[10px] text-slate-400">SQL keywords, joins & agg</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onOpenShortcuts();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#14264d] transition cursor-pointer text-left group"
              >
                <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Keyboard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Shortcuts</div>
                  <div className="text-[10px] text-slate-400">Hotkeys & quick execution</div>
                </div>
              </button>

              <div className="my-1 border-t border-[#162544]" />

              <button
                onClick={() => {
                  onOpenHistory();
                  setMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:text-white hover:bg-[#14264d] transition cursor-pointer text-left group"
              >
                <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-hover:scale-105 transition-transform">
                  <History className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">History</div>
                  <div className="text-[10px] text-slate-400">Past executed queries</div>
                </div>
              </button>

              <div className="my-1 border-t border-[#162544]" />

              {/* Creator Credit in More Menu */}
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>© {new Date().getFullYear()}</span>
                <a
                  href="https://instagram.com/gbudidarma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <Instagram className="w-3 h-3" />
                  <span>@gbudidarma</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Zone 3: Dark/Bright Theme Select & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Ko-fi Support Button (visible in header across mobile and desktop) */}
          <a
            href="https://ko-fi.com/V7V2JM8S4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center hover:opacity-85 active:scale-95 transition-all shrink-0"
            title="Buy Me a Coffee at ko-fi.com"
          >
            <img
              src="https://storage.ko-fi.com/cdn/kofi5.png?v=6"
              alt="Buy Me a Coffee at ko-fi.com"
              className="h-6.5 sm:h-8 object-contain"
            />
          </a>

          {/* Pro Unlimited Tables Button / Badge */}
          {onOpenProModal && (
            <button
              type="button"
              onClick={onOpenProModal}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs ${
                isPro
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'
                  : 'bg-gradient-to-r from-pink-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white'
              }`}
              title={isPro ? 'SheetSQL Pro Active (Unlimited Tables)' : 'Unlock Unlimited Tables with SheetSQL Pro ($5)'}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isPro ? 'fill-current' : 'text-amber-300'}`} />
              <span className="hidden sm:inline">{isPro ? 'PRO (Unlimited)' : 'Unlock Unlimited'}</span>
              <span className="sm:hidden">PRO</span>
            </button>
          )}

          {/* Dark Mode and Bright Mode Selector */}
          <div
            role="group"
            aria-label="Theme mode selection"
            className="flex items-center p-0.5 bg-[#070e1c] rounded-lg border border-[#162544] text-xs shadow-inner"
          >
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
                theme === 'dark'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Dark Mode"
              aria-pressed={theme === 'dark'}
            >
              <Moon className="w-3.5 h-3.5 text-blue-200" />
              <span className="font-medium hidden sm:inline">Dark</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme('bright')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
                theme === 'bright'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Switch to Bright Mode"
              aria-pressed={theme === 'bright'}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-medium hidden sm:inline">Bright</span>
            </button>
          </div>

          {/* Primary Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 active:bg-blue-700 transition shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
            title="Upload Excel or CSV file"
          >
            <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Upload</span>
            <span className="hidden sm:inline">Excel</span>
          </button>

          {/* Mobile Menu Hamburger button (hidden on desktop lg+) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex lg:hidden items-center justify-center p-1.5 text-slate-300 hover:text-white bg-[#0e1b38] border border-[#1b315e] rounded-lg transition cursor-pointer"
            title="Menu & Resources"
            aria-label="Toggle resources menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0c162e] border-b border-[#1b315e] p-3 shadow-2xl z-40 animate-in slide-in-from-top duration-150">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => {
                onOpenDocs();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#070e1c] hover:bg-[#122347] border border-[#162544] text-slate-200 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-400" />
              <div className="text-left">
                <div className="font-semibold">Docs</div>
                <div className="text-[10px] text-slate-400">Guides & features</div>
              </div>
            </button>

            <button
              onClick={() => {
                onOpenSyntax();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#070e1c] hover:bg-[#122347] border border-[#162544] text-slate-200 cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="font-semibold">Syntax</div>
                <div className="text-[10px] text-slate-400">SQL reference</div>
              </div>
            </button>

            <button
              onClick={() => {
                onOpenShortcuts();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#070e1c] hover:bg-[#122347] border border-[#162544] text-slate-200 cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <div className="font-semibold">Shortcuts</div>
                <div className="text-[10px] text-slate-400">Hotkeys</div>
              </div>
            </button>

            <button
              onClick={() => {
                onOpenHistory();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-[#070e1c] hover:bg-[#122347] border border-[#162544] text-slate-200 cursor-pointer"
            >
              <History className="w-4 h-4 text-purple-400" />
              <div className="text-left">
                <div className="font-semibold">History</div>
                <div className="text-[10px] text-slate-400">Past queries</div>
              </div>
            </button>
          </div>

          {/* Quick View Switcher inside drawer for rapid access */}
          <div className="mt-2.5 pt-2 border-t border-[#162544] flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-medium text-slate-400">Active View:</span>
            <span className="font-semibold text-blue-400 uppercase tracking-wider text-[11px] bg-blue-950/70 border border-blue-800/60 px-2 py-0.5 rounded">
              {activeView === 'studio' ? 'SQL Studio' : activeView === 'modeler' ? 'Data Modeler' : activeView === 'comparator' ? 'Comparator' : activeView === 'duplicates' ? 'Duplicate Checker' : activeView === 'visualizer' ? 'Visualizer' : 'BI Schema'}
            </span>
          </div>

          {/* Ko-fi Support Link in Mobile Drawer */}
          <div className="mt-2.5 pt-2 border-t border-[#162544] flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Support Creator:</span>
            <a
              href="https://ko-fi.com/V7V2JM8S4"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-85 transition-opacity inline-flex items-center"
              title="Buy Me a Coffee at ko-fi.com"
            >
              <img
                src="https://storage.ko-fi.com/cdn/kofi5.png?v=6"
                alt="Buy Me a Coffee at ko-fi.com"
                className="h-7 object-contain"
              />
            </a>
          </div>

          {/* Copyright & Instagram Footer */}
          <div className="mt-2.5 pt-2 border-t border-[#162544] flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <span>© {new Date().getFullYear()}</span>
              <a
                href="https://instagram.com/gbudidarma"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-400 hover:text-pink-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                <Instagram className="w-3 h-3" />
                <span>@gbudidarma</span>
              </a>
            </div>
            <span>All rights reserved.</span>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * MobileBottomNav:
 * Dedicated mobile thumb navigation bar rendered at the bottom of the viewport
 * on screens < 768px (md breakpoint).
 */
export const MobileBottomNav: React.FC<{
  activeView: AppViewTab;
  onChangeView: (view: AppViewTab) => void;
}> = ({ activeView, onChangeView }) => {
  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="shrink-0 z-40 bg-[#0b1329] border-t border-[#182747] md:hidden pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-[0_-4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div className="flex items-center gap-0.5 h-14 px-1 overflow-x-auto scrollbar-none">
        {/* Tab 1: SQL Studio */}
        <button
          type="button"
          onClick={() => onChangeView('studio')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'studio'
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="SQL Studio Editor & Results"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'studio' ? 'bg-blue-600/20 text-blue-400 shadow-xs' : ''
            }`}
          >
            <Terminal className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Studio</span>
          {activeView === 'studio' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Tab 2: Data Modeler */}
        <button
          type="button"
          onClick={() => onChangeView('modeler')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'modeler'
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Visual Schema ERD & Joins"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'modeler' ? 'bg-blue-600/20 text-blue-400 shadow-xs' : ''
            }`}
          >
            <GitBranch className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Modeler</span>
          {activeView === 'modeler' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Tab 3: Compare */}
        <button
          type="button"
          onClick={() => onChangeView('comparator')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'comparator'
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Compare Schemas & Row Data Diff"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'comparator' ? 'bg-blue-600/20 text-blue-400 shadow-xs' : ''
            }`}
          >
            <GitCompare className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Compare</span>
          {activeView === 'comparator' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Tab 4: Duplicate Checker */}
        <button
          type="button"
          onClick={() => onChangeView('duplicates')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'duplicates'
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Detect Duplicate Rows & Uniqueness"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'duplicates' ? 'bg-blue-600/20 text-blue-400 shadow-xs' : ''
            }`}
          >
            <CopyCheck className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Duplicates</span>
          {activeView === 'duplicates' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Tab 5: Visualizer */}
        <button
          type="button"
          onClick={() => onChangeView('visualizer')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'visualizer'
              ? 'text-pink-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Drag & Drop BI Charts & Pivots"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'visualizer' ? 'bg-pink-600/20 text-pink-400 shadow-xs' : ''
            }`}
          >
            <PieChart className="w-4 h-4 text-pink-400" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Visualizer</span>
          {activeView === 'visualizer' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-pink-400" />
          )}
        </button>

        {/* Tab 6: BI Schema */}
        <button
          type="button"
          onClick={() => onChangeView('bi_schema')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'bi_schema'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="CSV Star Schema & SCD Builder"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'bi_schema' ? 'bg-emerald-600/20 text-emerald-400 shadow-xs' : ''
            }`}
          >
            <Split className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">BI Schema</span>
          {activeView === 'bi_schema' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-400" />
          )}
        </button>

        {/* Tab 7: Data Mart */}
        <button
          type="button"
          onClick={() => onChangeView('data_mart')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'data_mart'
              ? 'text-cyan-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Data Mart BI & Cube Builder"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'data_mart' ? 'bg-cyan-600/20 text-cyan-400 shadow-xs' : ''
            }`}
          >
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Data Mart</span>
          {activeView === 'data_mart' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-cyan-400" />
          )}
        </button>

        {/* Tab 8: Forecasting */}
        <button
          type="button"
          onClick={() => onChangeView('forecasting')}
          className={`min-w-[62px] flex-1 py-1 px-1 flex flex-col items-center justify-center transition cursor-pointer select-none relative shrink-0 ${
            activeView === 'forecasting'
              ? 'text-violet-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Time Series Forecasting & Trends"
        >
          <div
            className={`p-1 rounded-md transition ${
              activeView === 'forecasting' ? 'bg-violet-600/20 text-violet-400 shadow-xs' : ''
            }`}
          >
            <TrendingUp className="w-4 h-4 text-violet-400" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 font-medium">Forecast</span>
          {activeView === 'forecasting' && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-violet-400" />
          )}
        </button>
      </div>
    </nav>
  );
};
