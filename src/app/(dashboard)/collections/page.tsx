'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { collectionService } from '@/services/collectionService';
import { Collection } from '@/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, MoreHorizontal, Trash, Printer, Milk, Download, Filter, ChevronDown } from 'lucide-react';
import { format, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const cardStyle = {
  background: '#FFFFFF', borderRadius: '20px',
  border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
};

export default function CollectionsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [animalFilter, setAnimalFilter] = useState<'all' | 'cow' | 'buffalo'>('all');
  const [dateFilter, setDateFilter] = useState('');   // YYYY-MM-DD string
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const data = await collectionService.getAll(centerId);
      setCollections(data);
    } catch { toast.error('Failed to load collections'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Delete this collection?')) return;
    try {
      await collectionService.delete(centerId, id);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  // Filters
  const filtered = collections.filter(c => {
    const matchSearch =
      c.farmerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.farmerId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchShift = shiftFilter === 'all' || c.shift === shiftFilter;
    const matchAnimal = animalFilter === 'all' || c.animalType === animalFilter;
    let matchDate = true;
    if (dateFilter && c.createdAt) {
      const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
      matchDate = format(d, 'yyyy-MM-dd') === dateFilter;
    }
    return matchSearch && matchShift && matchAnimal && matchDate;
  });

  const totalLiters = filtered.reduce((s, c) => s + c.liters, 0);
  const totalAmt = filtered.reduce((s, c) => s + c.totalAmount, 0);
  const morningCount = filtered.filter(c => c.shift === 'morning').length;
  const eveningCount = filtered.filter(c => c.shift === 'evening').length;

  return (
    <div className="space-y-5">
      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 text-[13px] rounded-xl outline-none border border-[#ECECEC] bg-white text-[#555]"
            style={{ cursor: 'pointer' }}
          />
          {/* Shift filter */}
          <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]" style={{ background: '#F7F7F7' }}>
            {(['all', 'morning', 'evening'] as const).map(t => (
              <button key={t} onClick={() => setShiftFilter(t)}
                className="px-3 py-2 text-[12px] font-semibold capitalize transition-all"
                style={{ background: shiftFilter === t ? '#FF6B00' : 'transparent', color: shiftFilter === t ? '#FFF' : '#777', borderRadius: '10px' }}>
                {t === 'all' ? 'All Shifts' : t}
              </button>
            ))}
          </div>
          {/* Animal filter */}
          <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]" style={{ background: '#F7F7F7' }}>
            {(['all', 'cow', 'buffalo'] as const).map(t => (
              <button key={t} onClick={() => setAnimalFilter(t)}
                className="px-3 py-2 text-[12px] font-semibold capitalize transition-all"
                style={{ background: animalFilter === t ? '#FF6B00' : 'transparent', color: animalFilter === t ? '#FFF' : '#777', borderRadius: '10px' }}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          {(dateFilter || shiftFilter !== 'all' || animalFilter !== 'all') && (
            <button
              onClick={() => { setDateFilter(''); setShiftFilter('all'); setAnimalFilter('all'); }}
              className="px-3 py-2 text-[12px] font-semibold text-red-500 rounded-xl border border-red-200 bg-red-50"
            >
              Clear Filters
            </button>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={() => router.push('/collections/new')}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
        >
          <Plus size={17} /> New Collection
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Liters', value: `${totalLiters.toFixed(1)} L`, color: '#FF6B00' },
          { label: 'Total Amount', value: `₹${totalAmt.toFixed(0)}`, color: '#22C55E' },
          { label: 'Morning', value: `${morningCount} entries`, color: '#F59E0B' },
          { label: 'Evening', value: `${eveningCount} entries`, color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
            <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0] flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder="Search by farmer name or ID..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold border border-[#ECECEC] text-[#555]">
            <Download size={14} /> Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Date / Time', 'Farmer', 'Shift', 'Liters', 'FAT / SNF', 'Rate', 'Total', ''].map(col => (
                  <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: j === 1 ? '120px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                        <Milk size={26} style={{ color: '#FF6B00' }} />
                      </div>
                      <div className="text-[15px] font-semibold text-[#111111]">No collections found</div>
                      <div className="text-[13px] text-[#777777]">Try adjusting your filters</div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {filtered.map((col, i) => {
                    let dateStr = 'N/A', timeStr = '';
                    if (col.createdAt) {
                      const d = (col.createdAt as any).toDate ? (col.createdAt as any).toDate() : new Date(col.createdAt as any);
                      dateStr = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'dd MMM');
                      timeStr = format(d, 'hh:mm a');
                    }
                    return (
                      <motion.tr key={col.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-medium text-[#111111]">{dateStr}</div>
                          <div className="text-[11px] text-[#AAAAAA]">{timeStr}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-semibold text-[#111111]">{col.farmerName}</div>
                          <div className="text-[11px] font-mono text-[#AAAAAA]">{col.farmerId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg capitalize"
                            style={col.shift === 'morning' ? { background: '#FEF9C3', color: '#CA8A04' } : { background: '#EDE9FE', color: '#7C3AED' }}>
                            {col.shift}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[14px] font-bold text-[#111111]">{col.liters.toFixed(1)}</td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] text-[#111111] flex items-center gap-1.5">
                            <span>{(col.enteredFat ?? col.fat).toFixed(1)}</span>
                            {col.isNearestRateApplied && (
                              <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-orange-100 text-orange-600 uppercase border border-orange-200" title="Nearest rate applied">
                                Nearest
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#AAAAAA]">{(col.enteredSnf ?? col.snf).toFixed(1)}</div>
                          {col.isNearestRateApplied && col.matchedFat !== undefined && col.matchedSnf !== undefined && (
                            <div className="text-[9px] text-[#FF6B00] font-semibold mt-1">
                              Used: {col.matchedFat.toFixed(1)} / {col.matchedSnf.toFixed(1)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">₹{col.rate.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[15px] font-bold" style={{ color: '#FF6B00' }}>₹{col.totalAmount.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger >
                              <button className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity outline-none" style={{ background: '#F0F0F0' }}>
                                <MoreHorizontal size={14} style={{ color: '#555' }} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl">
                              <DropdownMenuLabel className="text-[11px] text-[#AAAAAA] uppercase tracking-wider">Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer">
                                <Printer size={14} /> Print Receipt
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[13px] gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => handleDelete(col.id)}>
                                <Trash size={14} /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-[#F0F0F0] flex justify-between items-center">
            <span className="text-[12px] text-[#AAAAAA]">{filtered.length} of {collections.length} records</span>
            <span className="text-[13px] font-semibold text-[#111111]">Total: <span style={{ color: '#FF6B00' }}>₹{totalAmt.toFixed(2)}</span></span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
