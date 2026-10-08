import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, X, FileText, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { CsvImportSummary } from '@/types';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<CsvImportSummary | void>;
  onDownloadTemplate: () => Promise<void>;
  isUploading?: boolean;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  onDownloadTemplate,
  isUploading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setSummary(null);
      } else {
        alert('Please select a valid CSV file.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setSummary(null);
      } else {
        alert('Please drop a valid CSV file.');
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    const result = await onUpload(selectedFile);
    if (result) {
      setSummary(result);
    }
  };

  const handleTemplateClick = async () => {
    try {
      setIsDownloading(true);
      await onDownloadTemplate();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="glass-panel w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Bulk CSV Inventory Import
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a CSV file to import multiple inventory items simultaneously.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Downloadable Sample Template Notice & Button */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Need a sample CSV format?
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Download our sample CSV template with pre-filled headers and examples.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTemplateClick}
                disabled={isDownloading}
                className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="w-3.5 h-3.5" />
                {isDownloading ? 'Downloading...' : 'Sample Template'}
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-8 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer"
            >
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <Upload className="w-10 h-10 mx-auto text-slate-400 hover:text-emerald-500 transition-colors" />
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      Selected File: {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Click to upload or drag & drop CSV file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Only .csv files are supported</p>
                  </div>
                )}
              </label>
            </div>

            {/* Import Summary Results */}
            {summary && (
              <div className="space-y-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-800 dark:text-slate-200">Import Results</span>
                  <div className="flex gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {summary.imported_count} Passed
                    </span>
                    {summary.failed_count > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {summary.failed_count} Failed
                      </span>
                    )}
                  </div>
                </div>

                {summary.failed_rows.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {summary.failed_rows.map((rowErr) => (
                      <p key={rowErr.row} className="text-[11px] text-rose-600 dark:text-rose-400">
                        • Row {rowErr.row} ({rowErr.product_name}): {rowErr.errors.join(', ')}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFile || isUploading}
                className="btn-accent text-xs py-2 px-5 font-semibold"
              >
                {isUploading ? 'Uploading...' : 'Import CSV Data'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
