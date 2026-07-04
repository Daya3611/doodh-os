'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { rateChartService } from '@/services/rateChartService';
import { RateChart, RateChartEntry } from '@/types';
import { Search, ZoomIn, ZoomOut, ArrowLeft, Download, Printer, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function RateChartDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const resolvedParams = use(params);
  const chartId = resolvedParams.id;

  const [chart, setChart] = useState<RateChart | null>(null);
  const [entries, setEntries] = useState<RateChartEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [zoom, setZoom] = useState(1);
  const [searchFat, setSearchFat] = useState('');
  const [searchSnf, setSearchSnf] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!centerId || !chartId) return;
      setIsLoading(true);
      try {
        const [c, e] = await Promise.all([
          rateChartService.getById(centerId, chartId),
          rateChartService.getEntries(centerId, chartId)
        ]);
        if (c) setChart(c);
        if (e) setEntries(e);
      } catch (err) {
        toast.error('Failed to load rate chart details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [centerId, chartId]);

  const { fats, snfs, rateMatrix, minFat, maxFat, minSnf, maxSnf } = useMemo(() => {
    if (!entries.length) {
      return { fats: [], snfs: [], rateMatrix: {}, minFat: 0, maxFat: 0, minSnf: 0, maxSnf: 0 };
    }
    
    const fatSet = new Set<number>();
    const snfSet = new Set<number>();
    const matrix: Record<string, number> = {};
    
    let minF = entries[0].fat, maxF = entries[0].fat;
    let minS = entries[0].snf, maxS = entries[0].snf;

    entries.forEach(e => {
      fatSet.add(e.fat);
      snfSet.add(e.snf);
      matrix[`${e.fat.toFixed(2)}_${e.snf.toFixed(2)}`] = e.rate;
      
      if (e.fat < minF) minF = e.fat;
      if (e.fat > maxF) maxF = e.fat;
      if (e.snf < minS) minS = e.snf;
      if (e.snf > maxS) maxS = e.snf;
    });

    return {
      fats: Array.from(fatSet).sort((a,b) => a-b),
      snfs: Array.from(snfSet).sort((a,b) => a-b),
      rateMatrix: matrix,
      minFat: minF,
      maxFat: maxF,
      minSnf: minS,
      maxSnf: maxS,
    };
  }, [entries]);

  const filteredFats = searchFat ? fats.filter(f => f.toString().includes(searchFat)) : fats;
  const filteredSnfs = searchSnf ? snfs.filter(s => s.toString().includes(searchSnf)) : snfs;

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    if (!chart) return;
    const data = JSON.stringify({ chart, entries }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chart.version}-rates.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[600px]">
        <div className="w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <h2 className="text-[20px] font-bold text-[#111] mb-2">Rate Chart Not Found</h2>
        <button onClick={() => router.back()} className="text-[#F97316] hover:underline text-[14px]">
          Go back
        </button>
      </div>
    );
  }

  const effectiveFrom = chart.effectiveFrom ? ((chart.effectiveFrom as any)?.toDate?.() || new Date(chart.effectiveFrom as any)) : null;
  const effectiveUntil = chart.effectiveUntil ? ((chart.effectiveUntil as any).toDate?.() || new Date(chart.effectiveUntil as any)) : null;

  let statusStyle = '';
  switch (chart.status) {
    case 'active': statusStyle = 'bg-green-100 text-green-700'; break;
    case 'upcoming': statusStyle = 'bg-blue-100 text-blue-700'; break;
    case 'expired': statusStyle = 'bg-gray-100 text-gray-700'; break;
    case 'draft': statusStyle = 'bg-orange-100 text-orange-700'; break;
    case 'archived': statusStyle = 'bg-red-100 text-red-700'; break;
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white border border-[#ECECEC] rounded-lg hover:bg-slate-50 transition-colors">
            <ArrowLeft size={18} className="text-[#555]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-[#111111]">{chart.version}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wide ${statusStyle}`}>
                {chart.status === 'active' && <CheckCircle2 size={12}/>}
                {chart.status}
              </span>
              <span className={`text-[12px] font-bold px-2.5 py-1 rounded-md capitalize ${
                chart.animal === 'cow' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {chart.animal}
              </span>
            </div>
            <p className="text-[13px] text-[#777777] mt-1.5 font-medium">
              Effective: <span className="text-[#333]">{effectiveFrom ? format(effectiveFrom, 'dd MMM yyyy') : 'Legacy'}</span> to <span className="text-[#333]">{effectiveUntil ? format(effectiveUntil, 'dd MMM yyyy') : 'Current'}</span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 print:hidden">
          <button 
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E0E0E0] text-[#444] text-[13px] font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={16} /> JSON
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E0E0E0] text-[#444] text-[13px] font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Main Matrix Card */}
      <div className="bg-white rounded-2xl border border-[#ECECEC] shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col h-[calc(100vh-180px)] min-h-[600px]">
        
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-[#ECECEC] flex flex-wrap items-center justify-between gap-4 bg-[#FAFAFA] print:hidden">
          <div className="text-[13px] font-medium text-[#555]">
            <span className="text-[#111] font-bold">{entries.length}</span> entries • 
            FAT: <span className="text-[#111] font-bold">{minFat.toFixed(1)} - {maxFat.toFixed(1)}</span> • 
            SNF: <span className="text-[#111] font-bold">{minSnf.toFixed(1)} - {maxSnf.toFixed(1)}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
              <input 
                type="number" step="0.1" placeholder="Search FAT..."
                value={searchFat} onChange={e => setSearchFat(e.target.value)}
                className="pl-8 pr-3 py-2 text-[12px] bg-white border border-[#ECECEC] rounded-lg outline-none focus:border-[#F97316] transition-colors w-32"
              />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
              <input 
                type="number" step="0.1" placeholder="Search SNF..."
                value={searchSnf} onChange={e => setSearchSnf(e.target.value)}
                className="pl-8 pr-3 py-2 text-[12px] bg-white border border-[#ECECEC] rounded-lg outline-none focus:border-[#F97316] transition-colors w-32"
              />
            </div>
            
            <div className="flex items-center bg-white border border-[#ECECEC] rounded-lg overflow-hidden ml-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-[#F7F7F7] text-[#555] transition-colors">
                <ZoomOut size={16} />
              </button>
              <span className="text-[11px] font-medium px-2 text-[#555] w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-[#F7F7F7] text-[#555] transition-colors">
                <ZoomIn size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-auto bg-[#F9F9F9] relative custom-scrollbar p-6 print:p-0 print:bg-white">
          <motion.div 
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: 'min-content' }}
            className="bg-white rounded-xl shadow-sm border border-[#ECECEC] overflow-hidden print:border-none print:shadow-none"
          >
            <table className="w-full text-center" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {/* Top-Left Corner */}
                  <th className="sticky top-0 left-0 z-30 bg-[#F3F4F6] border-b border-r border-[#E5E7EB] p-2 min-w-[80px] print:static">
                    <div className="text-[10px] font-bold text-[#6B7280] flex justify-between px-1">
                      <span>FAT ↓</span>
                      <span>SNF →</span>
                    </div>
                  </th>
                  
                  {/* SNF Column Headers */}
                  {filteredSnfs.map(s => (
                    <th key={s} className="sticky top-0 z-20 bg-[#F9FAFB] border-b border-r border-[#E5E7EB] px-4 py-2 min-w-[70px] print:static">
                      <span className="text-[13px] font-bold text-[#111]">{s.toFixed(1)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFats.map(f => (
                  <tr key={f} className="hover:bg-[#FDF8F4] transition-colors">
                    {/* FAT Row Header */}
                    <td className="sticky left-0 z-10 bg-[#F9FAFB] border-b border-r border-[#E5E7EB] font-bold text-[13px] text-[#111] p-2 print:static">
                      {f.toFixed(1)}
                    </td>
                    
                    {/* Rate Cells */}
                    {filteredSnfs.map(s => {
                      const rate = rateMatrix[`${f.toFixed(2)}_${s.toFixed(2)}`] || 0;
                      return (
                        <td key={`${f}_${s}`} className="border-b border-r border-[#E5E7EB] p-2 text-[13px] text-[#4B5563] font-medium">
                          {rate > 0 ? (
                            <span className={rate > 0 ? 'text-[#F97316]' : ''}>{rate.toFixed(2)}</span>
                          ) : (
                            <span className="text-[#D1D5DB]">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredFats.length === 0 || filteredSnfs.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#999]">No match for search filter</div>
            ) : null}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
