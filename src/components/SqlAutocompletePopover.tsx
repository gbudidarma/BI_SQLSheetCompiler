import React, { useEffect, useRef } from 'react';
import { Table, Columns, KeyRound, FunctionSquare, Sparkles } from 'lucide-react';
import { SqlSuggestion } from '../utils/sqlAutocomplete';

interface SqlAutocompletePopoverProps {
  suggestions: SqlSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: SqlSuggestion) => void;
  position: { top: number; left: number };
  visible: boolean;
}

export const SqlAutocompletePopover: React.FC<SqlAutocompletePopoverProps> = ({
  suggestions,
  activeIndex,
  onSelect,
  position,
  visible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!containerRef.current || activeIndex < 0) return;
    const items = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-suggestion-item]');
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!visible || suggestions.length === 0) return null;

  const getTypeIcon = (type: SqlSuggestion['type']) => {
    switch (type) {
      case 'table':
        return <Table className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'column':
        return <Columns className="w-3.5 h-3.5 text-blue-300 shrink-0" />;
      case 'function':
        return <FunctionSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'keyword':
      default:
        return <KeyRound className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const getTypeBadge = (suggestion: SqlSuggestion) => {
    switch (suggestion.type) {
      case 'table':
        return (
          <span className="text-[10px] font-mono uppercase text-sky-400 bg-sky-950/70 border border-sky-800/50 px-1 py-0.2 rounded">
            table
          </span>
        );
      case 'column':
        return (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase text-blue-300 bg-blue-950/70 border border-blue-800/50 px-1 py-0.2 rounded">
              col
            </span>
            {suggestion.dataType && (
              <span className="text-[9px] font-mono text-slate-400">
                {suggestion.dataType}
              </span>
            )}
          </div>
        );
      case 'function':
        return (
          <span className="text-[10px] font-mono uppercase text-amber-400 bg-amber-950/70 border border-amber-800/50 px-1 py-0.2 rounded">
            func
          </span>
        );
      case 'keyword':
      default:
        return (
          <span className="text-[10px] font-mono uppercase text-blue-400 bg-blue-950/70 border border-blue-800/50 px-1 py-0.2 rounded">
            sql
          </span>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="absolute z-50 w-72 max-h-60 overflow-y-auto bg-[#0a1329]/98 backdrop-blur-md border border-[#1b315e] rounded-lg shadow-2xl shadow-black/70 py-1 flex flex-col font-mono text-xs select-none"
    >
      <div className="px-2.5 py-1 text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider border-b border-[#182c54] flex items-center justify-between bg-[#060b17]/80">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-blue-400" />
          Auto-Suggest
        </span>
        <span className="text-slate-400 lowercase font-normal">tab or enter</span>
      </div>

      <div className="p-1 space-y-0.5">
        {suggestions.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <button
              key={`${item.type}-${item.label}-${index}`}
              data-suggestion-item
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blurring textarea
                onSelect(item);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-blue-600/30 text-white border-l-2 border-blue-400'
                  : 'text-slate-300 hover:bg-[#122347] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {getTypeIcon(item.type)}
                <span className="font-semibold truncate group-hover:text-white">
                  {item.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {getTypeBadge(item)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-2.5 py-1 bg-[#060c18] border-t border-[#182c54] text-[10px] font-sans text-slate-400 flex items-center justify-between">
        <span>Use ↑↓ to navigate</span>
        <span>Esc to dismiss</span>
      </div>
    </div>
  );
};
