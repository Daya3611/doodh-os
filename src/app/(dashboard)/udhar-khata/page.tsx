'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { farmerService } from '@/services/farmerService';
import { ledgerService } from '@/services/ledgerService';
import { db } from '@/firebase/config';
import { collection, doc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { recalculateAndSyncFarmerBalance, calculateFarmerBalance } from '@/lib/balance';
import { offlineDb } from '@/lib/offlineDb';
import { Farmer, LedgerEntry } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, User, AlertTriangle, ArrowDownRight, Wallet, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };

export default function UdharKhataPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [debtors, setDebtors] = useState<{ farmer: Farmer; balance: number }[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<{ farmer: Farmer; balance: number } | null>(null);

  // Form states
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [allFarmers, allLedgers] = await Promise.all([
        farmerService.getAll(centerId),
        ledgerService.getAll(centerId)
      ]);

      const ledgerMap = new Map<string, LedgerEntry[]>();
      allLedgers.forEach(l => {
        if (!ledgerMap.has(l.farmerId)) ledgerMap.set(l.farmerId, []);
        ledgerMap.get(l.farmerId)!.push(l);
      });

      const debtorList: { farmer: Farmer; balance: number }[] = [];
      allFarmers.forEach(f => {
        const txs = ledgerMap.get(f.id) || [];
        const { balance } = calculateFarmerBalance(txs);
        if (balance < -0.01) {
          debtorList.push({ farmer: f, balance });
        }
      });

      setFarmers(allFarmers);
      setDebtors(debtorList);
    } catch (err) {
      console.error('Failed to load Udhar Khata data:', err);
      toast.error('Failed to load outstanding credits');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [centerId]);

  const handleOpenRecovery = (debtor: typeof debtors[0]) => {
    setSelectedDebtor(debtor);
    setRecoveryAmount(Math.abs(debtor.balance).toFixed(0));
    setShowRecoveryModal(true);
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !selectedDebtor || !profile) return;
    const amt = parseFloat(recoveryAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setIsSubmitting(true);
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const farmerId = selectedDebtor.farmer.id;
    const referenceId = `rec-${Date.now()}`;

    try {
      if (isOnline) {
        await runTransaction(db, async (tx) => {
          const farmerRef = doc(db, 'centers', centerId, 'farmers', farmerId);
          const farmerDoc = await tx.get(farmerRef);
          if (!farmerDoc.exists()) throw new Error('Farmer not found');

          const currentBalance = farmerDoc.data().balance || 0;
          const newBalance = currentBalance + amt; // Credit adjustment increases balance (closer to 0)

          const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
          tx.set(ledgerRef, {
            farmerId,
            transactionType: 'credit_adjustment',
            description: `Udhar Recovery - ${recoveryNotes || 'Cash Paid'}`,
            credit: amt,
            debit: 0,
            balance: newBalance,
            referenceId,
            createdAt: serverTimestamp()
          });

          tx.update(farmerRef, { balance: newBalance });
        });

        // Sync local IndexedDB in background
        const syncTime = Date.now();
        await offlineDb.ledger.put({
          id: `led-${Date.now()}`,
          farmerId,
          transactionType: 'credit_adjustment',
          description: `Udhar Recovery - ${recoveryNotes || 'Cash Paid'}`,
          credit: amt,
          debit: 0,
          balance: selectedDebtor.balance + amt,
          referenceId,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        await recalculateAndSyncFarmerBalance(centerId, farmerId);
      } else {
        // Offline recovery
        const localTime = Date.now();
        const newBalance = selectedDebtor.balance + amt;

        await offlineDb.ledger.put({
          id: `led-${Date.now()}`,
          farmerId,
          transactionType: 'credit_adjustment',
          description: `Udhar Recovery - ${recoveryNotes || 'Cash Paid'} (Offline)`,
          credit: amt,
          debit: 0,
          balance: newBalance,
          referenceId,
          createdAt: new Date(localTime),
          centerId,
          pendingSync: 1,
          isDeleted: 0,
          localUpdatedAt: localTime
        });

        await offlineDb.farmers.update(farmerId, { balance: newBalance });
      }

      toast.success(`Recorded recovery of ₹${amt} from ${selectedDebtor.farmer.name}`);
      setShowRecoveryModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save recovery payment:', err);
      toast.error('Failed to save recovery');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = debtors.filter(
    d =>
      d.farmer.name.toLowerCase().includes(search.toLowerCase()) ||
      d.farmer.id.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = debtors.reduce((sum, d) => sum + Math.abs(d.balance), 0);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowDownRight size={20} className="text-red-500" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-red-500 leading-none mb-1">
            ₹{totalOutstanding.toFixed(0)}
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">Total Credit Outstanding</div>
        </div>

        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3E8] flex items-center justify-center">
              <User size={20} style={{ color: '#FF6B00' }} />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#111111] leading-none mb-1">
            {debtors.length}
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">Active Debtors (Farmers)</div>
        </div>

        <div style={{ ...cardStyle, padding: '24px' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Wallet size={20} className="text-green-500" />
            </div>
          </div>
          <div className="text-[28px] font-bold text-green-600 leading-none mb-1">
            {navigator.onLine ? '🟢 Ready' : '🔴 Offline Cache'}
          </div>
          <div className="text-[12px] text-[#777777] mt-2 font-medium">System Status</div>
        </div>
      </div>

      {/* Debtors List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input
              className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder="Search debtor farmer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="text-[12px] font-semibold text-[#888]">
            Udhar Khata registers all farmers who owe payment adjustments to the dairy.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                {['Farmer', 'Phone', 'Village', 'Animal', 'Owes Amount', ''].map(col => (
                  <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#AAAAAA]">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded-full animate-pulse bg-gray-100" style={{ width: j === 0 ? '120px' : '70px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-500">
                        <CheckCircle size={26} />
                      </div>
                      <div className="text-[15px] font-semibold text-[#111111]">Great! No outstanding credits.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d, i) => (
                  <motion.tr
                    key={d.farmer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: '1px solid #F7F7F7' }}
                    className="group hover:bg-[#FAFAFA] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-[14px] font-semibold text-[#111111]">{d.farmer.name}</div>
                      <div className="text-[11px] font-mono text-[#AAAAAA]">{d.farmer.id}</div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[#555]">{d.farmer.mobile || '—'}</td>
                    <td className="px-6 py-4 text-[13px] text-[#555]">{d.farmer.village || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-[12px] font-medium px-2 py-0.5 rounded-full" style={{
                        background: d.farmer.animalType === 'cow' ? '#DBEAFE' : '#EDE9FE',
                        color: d.farmer.animalType === 'cow' ? '#2563EB' : '#7C3AED'
                      }}>
                        {d.farmer.animalType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[16px] font-bold text-red-500">
                      ₹{Math.abs(d.balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenRecovery(d)}
                        className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Record Recovery
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Recovery Modal */}
      <AnimatePresence>
        {showRecoveryModal && selectedDebtor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowRecoveryModal(false)}>
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
                  <h3 className="text-[17px] font-bold text-[#111111]">Record Recovery Payment</h3>
                  <p className="text-[12px] text-[#777] mt-0.5">Adjust credit for {selectedDebtor.farmer.name}</p>
                </div>
                <button onClick={() => setShowRecoveryModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} className="text-[#555]" />
                </button>
              </div>

              <form onSubmit={handleRecoverySubmit} className="p-6 space-y-4">
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <AlertTriangle className="text-red-500 flex-shrink-0" size={20} />
                  <div className="text-[13px] text-red-700 font-medium">
                    Farmer currently owes: <span className="font-bold">₹{Math.abs(selectedDebtor.balance).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Amount Recovered (₹)</label>
                  <input
                    type="number"
                    value={recoveryAmount}
                    onChange={e => setRecoveryAmount(e.target.value)}
                    className="w-full px-4 py-3 text-[18px] font-bold rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Notes / Adjustment Details</label>
                  <input
                    type="text"
                    value={recoveryNotes}
                    onChange={e => setRecoveryNotes(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. cash settlement, payment recovery"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowRecoveryModal(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555] cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white bg-green-600 cursor-pointer" style={{ boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
                    Save Adjustments
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
