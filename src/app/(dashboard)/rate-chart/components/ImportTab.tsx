'use client';

import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { rateChartService } from '@/services/rateChartService';
import { RateChartFormData } from '@/types';
import { motion } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { startOfDay, format } from 'date-fns';

interface ImportTabProps {
  onImportSuccess: () => void;
}

interface ParsedEntry {
  fat: number;
  snf: number;
  rate: number;
}

export default function ImportTab({ onImportSuccess }: ImportTabProps) {
  const { profile, user } = useAuthStore();
  const centerId = profile?.centerId;

  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<ParsedEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Metadata for the new chart
  const [chartName, setChartName] = useState('');
  const [animalType, setAnimalType] = useState<'cow' | 'buffalo'>('cow');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    setFile(selected);
    setError(null);
    setEntries(null);
    
    if (!chartName) {
      setChartName(selected.name.replace('.xlsx', '').replace('.xls', ''));
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to array of arrays
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        
        if (data.length < 2) {
          throw new Error("Invalid Excel format. Sheet is empty.");
        }

        const snfs = data[0].slice(1).map((val: any) => parseFloat(val));
        if (snfs.some(isNaN)) throw new Error("Invalid SNF headers in the first row.");
        
        const newEntries: ParsedEntry[] = [];
        const seen = new Set<string>();
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const fat = parseFloat(row[0]);
          if (isNaN(fat)) continue; // skip invalid rows
          
          for (let j = 1; j < row.length; j++) {
            const snf = snfs[j-1];
            const rateStr = row[j];
            
            // Reject empty or non-numeric cells
            if (rateStr === undefined || rateStr === null || rateStr === '') {
              throw new Error(`Empty rate found at FAT ${fat}, SNF ${snf}`);
            }
            const rate = parseFloat(rateStr);
            if (isNaN(rate)) {
              throw new Error(`Invalid non-numeric rate '${rateStr}' found at FAT ${fat}, SNF ${snf}`);
            }

            const key = `${fat.toFixed(2)}_${snf.toFixed(2)}`;
            if (seen.has(key)) {
              throw new Error(`Duplicate combination found for FAT ${fat}, SNF ${snf}`);
            }
            seen.add(key);

            newEntries.push({ fat, snf, rate });
          }
        }

        if (newEntries.length === 0) {
          throw new Error("Could not extract any rate values.");
        }

        setEntries(newEntries);

      } catch (err: any) {
        setError(err.message || "Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(selected);
  };

  const handleImport = async () => {
    if (!centerId) return;
    const createdBy = user?.uid || profile?.uid || 'unknown';

    if (!entries || !chartName || !effectiveFrom) {
      toast.error('Missing required fields');
      return;
    }

    const effectiveDate = new Date(effectiveFrom);
    const today = startOfDay(new Date());

    let statusToSave: 'draft' | 'active' | 'upcoming' = 'draft';

    if (effectiveDate > today) {
      statusToSave = 'upcoming';
    } else {
      const wantActive = confirm("Effective From is today or in the past. Do you want to activate this chart immediately? (Clicking Cancel will save it as a Draft)");
      statusToSave = wantActive ? 'active' : 'draft';
    }

    setIsUploading(true);
    try {
      const chartData: any = {
        version: chartName,
        animal: animalType,
        status: statusToSave,
        effectiveFrom: effectiveDate,
      };

      const chartId = await rateChartService.add(centerId, chartData, entries, createdBy);
      
      if (statusToSave === 'active') {
        await rateChartService.activateChart(centerId, chartId, animalType);
        toast.success(`Chart imported and activated successfully!`);
      } else {
        toast.success(`Chart saved as ${statusToSave}.`);
      }
      
      onImportSuccess();

    } catch (err: any) {
      toast.error(err.message || 'Failed to import chart to database');
    } finally {
      setIsUploading(false);
    }
  };

  // Derive stats for preview
  const fats = entries ? entries.map(e => e.fat) : [];
  const snfs = entries ? entries.map(e => e.snf) : [];
  const minFat = entries ? Math.min(...fats) : 0;
  const maxFat = entries ? Math.max(...fats) : 0;
  const minSnf = entries ? Math.min(...snfs) : 0;
  const maxSnf = entries ? Math.max(...snfs) : 0;
  const total = entries ? entries.length : 0;
  const previewRows = entries ? entries.slice(0, 20) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Upload Area */}
      {!entries && (
        <div 
          className="border-2 border-dashed border-[#DDDDDD] rounded-2xl bg-white p-16 flex flex-col items-center justify-center text-center transition-colors hover:border-[#F97316] hover:bg-[#FFF9F5] cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
            <UploadCloud size={32} className="text-[#F97316]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#111111] mb-2">Drag & Drop Excel File</h3>
          <p className="text-[14px] text-[#777777] mb-6 max-w-sm">
            Upload your milk rate chart in .xls or .xlsx format. Ensure the first row contains SNF values and the first column contains FAT values.
          </p>
          <button className="px-6 py-2.5 bg-[#F97316] text-white font-semibold rounded-xl text-[13px] shadow-[0_2px_8px_rgba(249,115,22,0.3)]">
            Browse Files
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex gap-3 text-red-700">
          <AlertCircle size={20} />
          <div>
            <div className="font-bold text-[14px]">Validation Error</div>
            <div className="text-[13px] mt-1">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Preview Area */}
      {entries && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#ECECEC] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4 border-b border-[#F0F0F0] pb-6 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#111]">{file?.name}</h3>
              <p className="text-[13px] text-[#777] flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 size={14} className="text-[#16A34A]"/> Validation passed for {total} rates
              </p>
            </div>
            <button onClick={() => { setEntries(null); setFile(null); }} className="ml-auto px-4 py-2 text-[13px] font-semibold text-[#555] bg-[#F3F4F6] rounded-xl hover:bg-[#E5E7EB] transition-colors">
              Change File
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-[#777] uppercase tracking-wider mb-2 block">Version Name</label>
                <input 
                  type="text" 
                  value={chartName} 
                  onChange={e => setChartName(e.target.value)}
                  className="w-full px-4 py-2.5 text-[14px] bg-[#F7F7F7] border border-[#ECECEC] rounded-xl outline-none focus:border-[#F97316] transition-colors"
                  placeholder="e.g. CM 21 Feb 2026"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777] uppercase tracking-wider mb-2 block">Animal Type</label>
                <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                  {(['cow', 'buffalo'] as const).map(a => (
                    <button key={a} onClick={() => setAnimalType(a)} className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all" style={{ background: animalType === a ? '#F97316' : '#F7F7F7', color: animalType === a ? '#FFF' : '#777' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777] uppercase tracking-wider mb-2 block">Effective From</label>
                <input 
                  type="date" 
                  value={effectiveFrom} 
                  onChange={e => setEffectiveFrom(e.target.value)}
                  className="w-full px-4 py-2.5 text-[14px] bg-[#F7F7F7] border border-[#ECECEC] rounded-xl outline-none focus:border-[#F97316] transition-colors"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-[#777] uppercase tracking-wider mb-2 block">Data Summary</label>
                <div className="bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] p-4 text-[13px]">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#555]">FAT Range</span>
                    <span className="font-semibold text-[#111]">{minFat.toFixed(1)} to {maxFat.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#555]">SNF Range</span>
                    <span className="font-semibold text-[#111]">{minSnf.toFixed(1)} to {maxSnf.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#555]">Total Records (Rows)</span>
                    <span className="font-semibold text-[#111]">{total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-[13px] font-bold text-[#111] mb-3">Import Preview (First 20 records)</h4>
            <div className="border border-[#ECECEC] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#FAFAFA] border-b border-[#ECECEC]">
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-bold text-[#777] uppercase tracking-wider">FAT</th>
                    <th className="px-4 py-2 text-[11px] font-bold text-[#777] uppercase tracking-wider">SNF</th>
                    <th className="px-4 py-2 text-[11px] font-bold text-[#777] uppercase tracking-wider">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2 text-[13px] font-medium">{row.fat.toFixed(1)}</td>
                      <td className="px-4 py-2 text-[13px] font-medium">{row.snf.toFixed(1)}</td>
                      <td className="px-4 py-2 text-[13px] font-bold text-[#F97316]">₹{row.rate.toFixed(2)}</td>
                    </tr>
                  ))}
                  {total > 20 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-[12px] text-center text-[#777] bg-[#FAFAFA] italic">
                        + {total - 20} more records...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-[#F0F0F0]">
            <button 
              onClick={() => { setEntries(null); setFile(null); }}
              className="px-6 py-2.5 text-[14px] font-semibold text-[#555] bg-white border border-[#ECECEC] rounded-xl hover:bg-[#FAFAFA] transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleImport}
              disabled={isUploading || !chartName || !effectiveFrom}
              className="px-8 py-2.5 text-[14px] font-bold text-white rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#F97316', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}
            >
              {isUploading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : null}
              {isUploading ? 'Importing...' : 'Confirm Import'}
            </button>
          </div>
        </motion.div>
      )}

    </div>
  );
}
