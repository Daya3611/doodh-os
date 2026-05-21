'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { rateChartService } from '@/services/rateChartService';
import { RateChart, rateChartSchema, RateChartFormData } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, BarChart3 } from 'lucide-react';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '20px',
  border: '1px solid #ECECEC',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

const inputClass = `w-full px-4 py-2.5 text-[14px] rounded-xl outline-none transition-all`;
const inputStyle = { background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' };
const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
const onBlur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

export default function RateChartPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [rateCharts, setRateCharts] = useState<RateChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'cow' | 'buffalo'>('all');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<RateChartFormData>({
    resolver: zodResolver(rateChartSchema),
    defaultValues: { animalType: 'cow', fat: 3.5, snf: 8.5, rate: 30 },
  });
  const animalTypeVal = watch('animalType');

  const load = async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const data = await rateChartService.getAll(centerId);
      data.sort((a, b) => {
        if (a.animalType !== b.animalType) return a.animalType.localeCompare(b.animalType);
        if (a.fat !== b.fat) return a.fat - b.fat;
        return a.snf - b.snf;
      });
      setRateCharts(data);
    } catch { toast.error('Failed to load rate charts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  const onSubmit = async (data: RateChartFormData) => {
    if (!centerId) return;
    try {
      if (editingId) {
        await rateChartService.update(centerId, editingId, data);
        toast.success('Rate updated');
      } else {
        await rateChartService.add(centerId, data);
        toast.success('Rate added');
      }
      setShowForm(false);
      setEditingId(null);
      reset({ animalType: 'cow', fat: 3.5, snf: 8.5, rate: 30 });
      load();
    } catch { toast.error('Failed to save'); }
  };

  const handleEdit = (c: RateChart) => {
    setEditingId(c.id);
    reset({ animalType: c.animalType, fat: c.fat, snf: c.snf, rate: c.rate });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Delete this rate entry?')) return;
    try {
      await rateChartService.delete(centerId, id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const displayed = filterType === 'all' ? rateCharts : rateCharts.filter(c => c.animalType === filterType);

  return (
    <div className="space-y-5">
      {/* Header Action Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Filter tabs */}
        <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]" style={{ background: '#F7F7F7' }}>
          {(['all', 'cow', 'buffalo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="px-4 py-2 text-[13px] font-semibold capitalize transition-all"
              style={{
                background: filterType === t ? '#FF6B00' : 'transparent',
                color: filterType === t ? '#FFFFFF' : '#777777',
                borderRadius: '10px',
              }}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditingId(null); reset({ animalType: 'cow', fat: 3.5, snf: 8.5, rate: 30 }); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
        >
          <Plus size={17} />
          Add Rate
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          style={cardStyle} className="lg:col-span-2 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  {['Animal', 'FAT', 'SNF', 'Rate (₹)', ''].map(col => (
                    <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: '60px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                          <BarChart3 size={26} style={{ color: '#FF6B00' }} />
                        </div>
                        <div className="text-[15px] font-semibold text-[#111111]">No rate entries</div>
                        <div className="text-[13px] text-[#777777]">Add your first rate chart entry</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence>
                    {displayed.map((c, i) => (
                      <motion.tr
                        key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }}
                        className="group hover:bg-[#FAFAFA] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span
                            className="text-[12px] font-semibold px-2.5 py-1 rounded-lg capitalize"
                            style={c.animalType === 'cow' ? { background: '#DBEAFE', color: '#2563EB' } : { background: '#EDE9FE', color: '#7C3AED' }}
                          >
                            {c.animalType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[14px] font-medium text-[#111111]">{c.fat.toFixed(1)}</td>
                        <td className="px-6 py-4 text-[14px] font-medium text-[#111111]">{c.snf.toFixed(1)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[16px] font-bold" style={{ color: '#FF6B00' }}>₹{c.rate.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(c)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: '#F0F0F0' }}
                            >
                              <Pencil size={13} style={{ color: '#555' }} />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: '#FEE2E2' }}
                            >
                              <Trash2 size={13} style={{ color: '#DC2626' }} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
          {displayed.length > 0 && (
            <div className="px-6 py-3 border-t border-[#F0F0F0]">
              <span className="text-[12px] text-[#AAAAAA]">{displayed.length} rate entries</span>
            </div>
          )}
        </motion.div>

        {/* Add / Edit Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              style={{ ...cardStyle, padding: '24px', alignSelf: 'start' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-[15px] font-bold text-[#111111]">{editingId ? 'Edit Rate' : 'New Rate Entry'}</div>
                <button onClick={() => setShowForm(false)} className="text-[20px] text-[#AAAAAA] hover:text-[#333] leading-none">×</button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Animal Type */}
                <div>
                  <label className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Animal Type</label>
                  <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                    {(['cow', 'buffalo'] as const).map(a => (
                      <button key={a} type="button" onClick={() => setValue('animalType', a)}
                        className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all"
                        style={{ background: animalTypeVal === a ? '#FF6B00' : '#F7F7F7', color: animalTypeVal === a ? '#FFFFFF' : '#777777' }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">FAT</label>
                  <input type="number" step="0.1" {...register('fat', { valueAsNumber: true })} className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  {errors.fat && <p className="text-[11px] text-red-500 mt-1">{errors.fat.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">SNF</label>
                  <input type="number" step="0.1" {...register('snf', { valueAsNumber: true })} className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  {errors.snf && <p className="text-[11px] text-red-500 mt-1">{errors.snf.message}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Rate (₹ per Liter)</label>
                  <input type="number" step="0.01" {...register('rate', { valueAsNumber: true })} className={inputClass} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                  {errors.rate && <p className="text-[11px] text-red-500 mt-1">{errors.rate.message}</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 text-[13px] font-semibold rounded-xl border border-[#ECECEC] text-[#555] hover:border-[#999] transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="flex-1 py-2.5 text-[13px] font-semibold rounded-xl text-white transition-all"
                    style={{ background: '#FF6B00', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}>
                    {editingId ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
