'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { rateChartService } from '@/services/rateChartService';
import { RateChart } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import RateChartTable from './components/RateChartTable';
import ImportTab from './components/ImportTab'; // We can adapt this to act as an import view

export default function MilkRateCenterPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [charts, setCharts] = useState<RateChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const loadCharts = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      // Sync statuses first to ensure lazy evaluation is applied
      await rateChartService.syncRateChartStatuses(centerId);
      
      const data = await rateChartService.getAll(centerId);
      // Sort by creation date descending
      data.sort((a, b) => {
        const da = (a.createdAt as any)?.toDate?.() || new Date(a.createdAt as any);
        const db = (b.createdAt as any)?.toDate?.() || new Date(b.createdAt as any);
        return db.getTime() - da.getTime();
      });
      setCharts(data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load rate charts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCharts();
  }, [centerId]);

  const handleActivate = async (chart: RateChart) => {
    if (!centerId || chart.status === 'active') return;
    if (!confirm(`Are you sure you want to activate "${chart.version}" immediately? This will expire the currently active ${chart.animal} chart.`)) return;

    try {
      await rateChartService.activateChart(centerId, chart.id, chart.animal);
      toast.success(`${chart.version} activated successfully`);
      loadCharts();
    } catch {
      toast.error('Failed to activate chart');
    }
  };

  const handleDelete = async (chart: RateChart) => {
    if (!centerId) return;
    if (chart.status === 'active') {
      toast.error('Cannot delete an active chart. Activate another one first.');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${chart.version}"? This action cannot be undone.`)) return;

    try {
      await rateChartService.delete(centerId, chart.id);
      toast.success('Chart deleted');
      loadCharts();
    } catch {
      toast.error('Failed to delete chart');
    }
  };

  const handleDuplicate = (chart: RateChart) => {
    toast.info('Duplicate feature coming soon!');
    // Todo: open import/create with prepopulated entries
  };

  const activeCowCharts = charts.filter(c => c.animal === 'cow' && c.status === 'active');
  const activeBuffaloCharts = charts.filter(c => c.animal === 'buffalo' && c.status === 'active');
  const hasMultipleActive = activeCowCharts.length > 1 || activeBuffaloCharts.length > 1;

  if (isImporting) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-[#111111]">Import Rate Chart</h1>
            <p className="text-[14px] text-[#777777] mt-1">Upload an Excel or CSV file to create a new rate matrix</p>
          </div>
          <button 
            onClick={() => setIsImporting(false)}
            className="px-4 py-2 text-sm font-medium border border-[#E0E0E0] rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        <ImportTab 
          onImportSuccess={() => {
            setIsImporting(false);
            loadCharts();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#111111]">Milk Rate Center</h1>
          <p className="text-[14px] text-[#777777] mt-1">Manage FAT x SNF rate charts and versions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsImporting(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E0E0E0] text-[#444] text-[13px] font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Upload size={16} /> Import Excel
          </button>
          <button 
            onClick={() => toast.info('Manual creation coming soon!')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F97316] text-white text-[13px] font-semibold rounded-xl hover:bg-[#EA580C] transition-colors shadow-sm"
          >
            <Plus size={16} /> Create Manual
          </button>
        </div>
      </div>

      {hasMultipleActive && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertTriangle size={20} />
          <div className="text-[13px] font-medium">
            Warning: Multiple active charts detected for the same animal type. This could cause calculation errors. Please ensure only one chart is active per animal.
          </div>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key="table"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <div className="animate-pulse bg-white h-[400px] rounded-2xl border border-[#ECECEC]"></div>
          ) : (
            <RateChartTable 
              charts={charts} 
              onActivate={handleActivate}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
