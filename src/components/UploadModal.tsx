import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import { TableSchema } from '../types';
import { SAMPLE_DATASETS } from '../utils/sampleData';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTablesLoaded: (newTables: { schema: TableSchema; rows: Record<string, any>[] }[]) => void;
  onLoadSample: (datasetId: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onTablesLoaded,
  onLoadSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | File[]) => {
    if (!files.length) return;
    setIsProcessing(true);
    setError(null);

    try {
      const allParsed: { schema: TableSchema; rows: Record<string, any>[] }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['xlsx', 'xls', 'csv', 'tsv'].includes(ext || '')) {
          throw new Error(`Unsupported file type: .${ext}. Please upload .xlsx, .xls, or .csv files.`);
        }

        const tablesFromFile = await parseExcelFile(file);
        if (tablesFromFile.length === 0) {
          throw new Error(`No queryable sheet data found in ${file.name}.`);
        }
        allParsed.push(...tablesFromFile);
      }

      onTablesLoaded(allParsed);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err?.message || 'Failed to parse file. Please verify it is a valid Excel or CSV document.');
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-[#0b1429] border border-[#1b315e] rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl shadow-blue-950/50 space-y-4 sm:space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/80 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Upload Spreadsheet</h2>
              <p className="text-xs text-slate-400">Load Excel or CSV files directly into the SQL engine (row 1 is header)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#122347] rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
            isDragging
              ? 'border-blue-500 bg-blue-950/30'
              : 'border-[#1b315e] hover:border-blue-500/70 bg-[#070e1c] hover:bg-[#091224]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
            }}
          />

          <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <p className="text-sm font-medium text-slate-200">
            {isProcessing ? 'Processing spreadsheet...' : 'Drop your Excel (.xlsx, .xls) or .csv file here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            or <span className="text-blue-400 underline font-medium">browse files</span> from your computer
          </p>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-slate-400 bg-[#0b162f] px-3 py-1.5 rounded-full border border-[#1b315e]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>First row is strictly parsed as SQL column headers</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Sample Selector */}
        <div className="pt-2 border-t border-[#182c54]">
          <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span>Or start with pre-loaded demo workbooks:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_DATASETS.map((ds) => (
              <button
                key={ds.id}
                onClick={() => {
                  onLoadSample(ds.id);
                  onClose();
                }}
                className="p-2.5 text-left rounded-lg bg-[#070e1c] hover:bg-[#0f1d3b] border border-[#182c54] transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-200 group-hover:text-blue-300">
                  <span>{ds.title}</span>
                  <Sparkles className="w-3 h-3 text-slate-400 group-hover:text-blue-400" />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  {ds.badge}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
