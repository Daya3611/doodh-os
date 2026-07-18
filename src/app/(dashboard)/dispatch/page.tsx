'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { dispatchService, DispatchFormData, ReceiptFormData } from '@/services/dispatchService';
import { OfflineDispatch } from '@/lib/offlineDb';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Truck, Search, Eye, Edit3, Trash2, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };

export default function DispatchPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [dispatches, setDispatches] = useState<OfflineDispatch[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<OfflineDispatch | null>(null);

  // Dispatch Form States
  const [tankerNumber, setTankerNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [liters, setLiters] = useState('');
  const [fat, setFat] = useState('');
  const [snf, setSnf] = useState('');
  const [shift, setShift] = useState<'morning' | 'evening'>('morning');
  const [notes, setNotes] = useState('');

  // Receipt Form States
  const [plantLiters, setPlantLiters] = useState('');
  const [plantFat, setPlantFat] = useState('');
  const [plantSnf, setPlantSnf] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const data = await dispatchService.getAll(centerId);
      setDispatches(data);
    } catch {
      toast.error('Failed to load dispatches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleAddDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !profile) return;
    if (!tankerNumber) { toast.error('Tanker number is required'); return; }
    const lts = parseFloat(liters);
    const ft = parseFloat(fat);
    const sf = parseFloat(snf);
    if (isNaN(lts) || lts <= 0) { toast.error('Please enter valid liters'); return; }
    if (isNaN(ft) || ft < 0) { toast.error('Please enter valid fat'); return; }
    if (isNaN(sf) || sf < 0) { toast.error('Please enter valid snf'); return; }

    try {
      await dispatchService.add(centerId, {
        tankerNumber,
        driverName,
        liters: lts,
        fat: ft,
        snf: sf,
        shift,
        notes
      }, profile.uid || 'unknown');

      toast.success(`Tanker ${tankerNumber} dispatched successfully`);
      setShowDispatchModal(false);
      // Reset
      setTankerNumber('');
      setDriverName('');
      setLiters('');
      setFat('');
      setSnf('');
      setShift('morning');
      setNotes('');
      loadData();
    } catch {
      toast.error('Failed to add dispatch');
    }
  };

  const handleOpenReceipt = (disp: OfflineDispatch) => {
    setSelectedDispatch(disp);
    setPlantLiters(disp.liters.toString());
    setPlantFat(disp.fat.toString());
    setPlantSnf(disp.snf.toString());
    setReceiptNotes('');
    setShowReceiptModal(true);
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !selectedDispatch) return;
    const plLts = parseFloat(plantLiters);
    const plFt = parseFloat(plantFat);
    const plSf = parseFloat(plantSnf);
    if (isNaN(plLts) || plLts <= 0) { toast.error('Please enter valid plant receipt liters'); return; }
    if (isNaN(plFt) || plFt < 0) { toast.error('Please enter valid plant receipt fat'); return; }
    if (isNaN(plSf) || plSf < 0) { toast.error('Please enter valid plant receipt snf'); return; }

    try {
      await dispatchService.updateReceipt(centerId, selectedDispatch.id, {
        plantLiters: plLts,
        plantFat: plFt,
        plantSnf: plSf,
        notes: receiptNotes
      });

      toast.success('Tanker receipt confirmed at Plant');
      setShowReceiptModal(false);
      setSelectedDispatch(null);
      loadData();
    } catch {
      toast.error('Failed to confirm receipt');
    }
  };

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Are you sure you want to delete this dispatch record?')) return;
    try {
      await dispatchService.delete(centerId, id);
      toast.success('Dispatch record deleted');
      loadData();
    } catch {
      toast.error('Failed to delete dispatch');
    }
  };

  const filtered = dispatches.filter(d =>
    d.tankerNumber.toLowerCase().includes(search.toLowerCase()) ||
    (d.driverName && d.driverName.toLowerCase().includes(search.toLowerCase()))
  );

  const totalDispatchedLiters = dispatches.reduce((sum, d) => sum + d.liters, 0);
  const totalReceivedLiters = dispatches.filter(d => d.status === 'received').reduce((sum, d) => sum + (d.plantLiters || 0), 0);
  const totalTransitLossLiters = dispatches.reduce((sum, d) => sum + (d.lossLiters || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Truck size={20} className="text-[#FF6B00]" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111111] leading-none mb-1">
            {totalDispatchedLiters.toFixed(1)} L
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">Total Dispatched Milk</div>
        </div>

        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle size={20} className="text-green-500" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-green-600 leading-none mb-1">
            {totalReceivedLiters.toFixed(1)} L
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">Total Confirmed Plant Receipt</div>
        </div>

        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-500" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-red-500 leading-none mb-1">
            {totalTransitLossLiters.toFixed(1)} L
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">Transit Loss (Shrinkage)</div>
        </div>
      </div>

      {/* Dispatches List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder="Search by tanker or driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white bg-[#FF6B00] hover:bg-[#E05E00] rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto"
          >
            <Plus size={17} /> Record Tanker Dispatch
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Date & Shift', 'Tanker Info', 'Dispatch Stats', 'Plant Stats', 'Losses', 'Status', ''].map(col => (
                  <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded-full animate-pulse bg-gray-100" style={{ width: j === 0 ? '120px' : '70px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-[#FF6B00]">
                        <Truck size={26} />
                      </div>
                      <div className="text-[15px] font-semibold text-[#111111]">No tankers dispatched yet</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d, i) => {
                  let dateStr = 'N/A';
                  if (d.dispatchDate) {
                    dateStr = format(new Date(d.dispatchDate), 'dd MMM yyyy');
                  }
                  return (
                    <motion.tr
                      key={d.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: '1px solid #F7F7F7' }}
                      className="group hover:bg-[#FAFAFA] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-semibold text-[#111111]">{dateStr}</div>
                        <div className="text-[11px] capitalize font-medium text-[#FF6B00]">{d.shift} Shift</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[14px] font-bold text-[#111111]">{d.tankerNumber}</div>
                        <div className="text-[11px] text-[#888]">{d.driverName || 'No driver name'}</div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#111]">
                        <div className="font-semibold">{d.liters.toFixed(1)} Liters</div>
                        <div className="text-[11px] text-[#777]">FAT: {d.fat.toFixed(1)}% | SNF: {d.snf.toFixed(1)}%</div>
                      </td>
                      <td className="px-6 py-4 text-[13px] text-[#111]">
                        {d.status === 'received' ? (
                          <>
                            <div className="font-semibold text-green-600">{d.plantLiters?.toFixed(1)} Liters</div>
                            <div className="text-[11px] text-[#777]">FAT: {d.plantFat?.toFixed(1)}% | SNF: {d.plantSnf?.toFixed(1)}%</div>
                          </>
                        ) : (
                          <span className="text-[#888] italic">— Pending —</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[13px]">
                        {d.status === 'received' ? (
                          <div className={d.lossLiters && d.lossLiters > 0 ? "text-red-500 font-semibold" : "text-green-600"}>
                            <div>Lts: -{d.lossLiters?.toFixed(1)} L</div>
                            <div className="text-[11px]">FAT: -{d.lossFat?.toFixed(1)}% | SNF: -{d.lossSnf?.toFixed(1)}%</div>
                          </div>
                        ) : (
                          <span className="text-[#888] italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{
                          background: d.status === 'received' ? '#DCFCE7' : '#FFF3E8',
                          color: d.status === 'received' ? '#16A34A' : '#FF6B00'
                        }}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === 'dispatched' && (
                            <button
                              onClick={() => handleOpenReceipt(d)}
                              className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#FF6B00] bg-[#FFF5EE] hover:bg-[#FFE8D6] cursor-pointer"
                            >
                              Receive at Plant
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 cursor-pointer"
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Dispatch Modal */}
      <AnimatePresence>
        {showDispatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowDispatchModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-[#ECECEC]"
              style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-[#ECECEC] flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111111]">Tanker Dispatch Entry</h3>
                  <p className="text-[12px] text-[#777] mt-0.5">Record bulk dispatched milk to dairy plant</p>
                </div>
                <button onClick={() => setShowDispatchModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} className="text-[#555]" />
                </button>
              </div>

              <form onSubmit={handleAddDispatch} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Tanker Number</label>
                    <input
                      type="text"
                      required
                      value={tankerNumber}
                      onChange={e => setTankerNumber(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      placeholder="e.g. MH12AB1234"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Driver Name</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      placeholder="Driver name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Liters</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={liters}
                      onChange={e => setLiters(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">FAT (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={fat}
                      onChange={e => setFat(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">SNF (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={snf}
                      onChange={e => setSnf(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Shift</label>
                  <select
                    value={shift}
                    onChange={e => setShift(e.target.value as any)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                  </select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Dispatch Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. Tanker dispatch details"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowDispatchModal(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555] cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white bg-[#FF6B00] cursor-pointer" style={{ boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}>
                    Dispatch Tanker
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt confirmation modal */}
      <AnimatePresence>
        {showReceiptModal && selectedDispatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowReceiptModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-[#ECECEC]"
              style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-[#ECECEC] flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111111]">Confirm Plant Receipt</h3>
                  <p className="text-[12px] text-[#777] mt-0.5">Tanker {selectedDispatch.tankerNumber}</p>
                </div>
                <button onClick={() => setShowReceiptModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} className="text-[#555]" />
                </button>
              </div>

              <form onSubmit={handleSaveReceipt} className="p-6 space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <div className="text-[12px] font-semibold text-[#FF6B00] uppercase mb-1">Dispatched figures</div>
                  <div className="text-[14px] font-bold text-slate-800 flex items-center gap-3">
                    <span>{selectedDispatch.liters} L</span>
                    <span>·</span>
                    <span>FAT: {selectedDispatch.fat}%</span>
                    <span>·</span>
                    <span>SNF: {selectedDispatch.snf}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block font-medium">Received Lts</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={plantLiters}
                      onChange={e => setPlantLiters(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block font-medium">Received FAT</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={plantFat}
                      onChange={e => setPlantFat(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block font-medium">Received SNF</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={plantSnf}
                      onChange={e => setPlantSnf(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Receipt Notes / Remarks</label>
                  <input
                    type="text"
                    value={receiptNotes}
                    onChange={e => setReceiptNotes(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. normal transit loss, standard loss"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowReceiptModal(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555] cursor-pointer">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white bg-green-600 cursor-pointer" style={{ boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
                    Confirm Receipt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
