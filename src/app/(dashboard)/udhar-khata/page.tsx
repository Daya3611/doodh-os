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
import {
  Search, User, AlertTriangle, ArrowDownRight, Wallet, CheckCircle, X,
  Phone, MessageSquare, History, Download, Sparkles, Filter, ChevronRight,
  DollarSign, Send, ArrowUpRight, ShieldAlert, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #ECECEC',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

export default function UdharKhataPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [debtors, setDebtors] = useState<{ farmer: Farmer; balance: number }[]>([]);
  const [search, setSearch] = useState('');
  const [debtFilter, setDebtFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'amount-desc' | 'amount-asc' | 'name'>('amount-desc');
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<{ farmer: Farmer; balance: number } | null>(null);
  
  // Ledger History Modal States
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerFarmer, setLedgerFarmer] = useState<Farmer | null>(null);
  const [farmerLedgers, setFarmerLedgers] = useState<LedgerEntry[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // Recovery Form states
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
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
    setPaymentMethod('cash');
    setRecoveryNotes('Udhar Recovery Payment');
    setShowRecoveryModal(true);
  };

  const handleOpenLedger = async (farmer: Farmer) => {
    setLedgerFarmer(farmer);
    setShowLedgerModal(true);
    setIsLedgerLoading(true);
    try {
      if (!centerId) return;
      const entries = await ledgerService.getByFarmer(centerId, farmer.id);
      setFarmerLedgers(entries);
    } catch {
      toast.error('Failed to load farmer ledger history');
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleSendWhatsAppReminder = (debtor: typeof debtors[0]) => {
    const mobile = debtor.farmer.mobile?.replace(/\D/g, '');
    if (!mobile) {
      toast.error('Farmer mobile number not available');
      return;
    }
    const amount = Math.abs(debtor.balance).toFixed(2);
    const msg = encodeURIComponent(
      `Namaste ${debtor.farmer.name} ji,\nYour outstanding credit balance at ${(profile as any)?.centerName || profile?.name || 'Milk Collection Center'} is ₹${amount}. Kindly clear your pending payment at your earliest convenience. Thank you!`
    );
    window.open(`https://wa.me/${mobile.length === 10 ? '91' + mobile : mobile}?text=${msg}`, '_blank');
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !selectedDebtor || !profile) return;
    const amt = parseFloat(recoveryAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid positive recovery amount');
      return;
    }

    setIsSubmitting(true);
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const farmerId = selectedDebtor.farmer.id;
    const referenceId = `rec-${Date.now()}`;
    const desc = `Udhar Recovery (${paymentMethod.toUpperCase()}) - ${recoveryNotes || 'Payment Received'}`;

    try {
      if (isOnline) {
        await runTransaction(db, async (tx) => {
          const farmerRef = doc(db, 'centers', centerId, 'farmers', farmerId);
          const farmerDoc = await tx.get(farmerRef);
          if (!farmerDoc.exists()) throw new Error('Farmer doc not found');

          const currentBalance = farmerDoc.data().balance || 0;
          const newBalance = currentBalance + amt;

          const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
          tx.set(ledgerRef, {
            farmerId,
            transactionType: 'credit_adjustment',
            description: desc,
            credit: amt,
            debit: 0,
            balance: newBalance,
            referenceId,
            createdAt: serverTimestamp()
          });

          tx.update(farmerRef, { balance: newBalance });
        });

        const syncTime = Date.now();
        await offlineDb.ledger.put({
          id: `led-${Date.now()}`,
          farmerId,
          transactionType: 'credit_adjustment',
          description: desc,
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
        const localTime = Date.now();
        const newBalance = selectedDebtor.balance + amt;

        await offlineDb.ledger.put({
          id: `led-${Date.now()}`,
          farmerId,
          transactionType: 'credit_adjustment',
          description: `${desc} (Offline)`,
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

      toast.success(`Recorded ₹${amt} recovery from ${selectedDebtor.farmer.name}`);
      setShowRecoveryModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to save recovery payment:', err);
      toast.error('Failed to save recovery payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & Sort Logic
  const filtered = debtors.filter(d => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      d.farmer.name.toLowerCase().includes(searchLower) ||
      d.farmer.id.toLowerCase().includes(searchLower) ||
      (d.farmer.mobile && d.farmer.mobile.includes(searchLower)) ||
      (d.farmer.village && d.farmer.village.toLowerCase().includes(searchLower));

    const owes = Math.abs(d.balance);
    let matchDebt = true;
    if (debtFilter === 'high') matchDebt = owes >= 5000;
    else if (debtFilter === 'mid') matchDebt = owes >= 1000 && owes < 5000;
    else if (debtFilter === 'low') matchDebt = owes < 1000;

    return matchSearch && matchDebt;
  }).sort((a, b) => {
    if (sortBy === 'amount-desc') return Math.abs(b.balance) - Math.abs(a.balance);
    if (sortBy === 'amount-asc') return Math.abs(a.balance) - Math.abs(b.balance);
    return a.farmer.name.localeCompare(b.farmer.name);
  });

  const totalOutstanding = debtors.reduce((sum, d) => sum + Math.abs(d.balance), 0);
  const avgDebt = debtors.length > 0 ? totalOutstanding / debtors.length : 0;
  const highestDebtor = debtors.length > 0
    ? [...debtors].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))[0]
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* ERP Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#1F2937] to-[#111827] p-6 rounded-3xl text-white shadow-xl border border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-[#FF6B00] text-white tracking-wider">
              Udhar Khata Master
            </span>
            <span className="text-[12px] text-gray-400 font-medium">Real-time Outstanding Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Farmer Credit & Recovery Management</h1>
          <p className="text-xs text-gray-300 mt-1 max-w-2xl">
            Track farmer advances, manage credit accounts, record cash/UPI recoveries, and auto-sync ledger balances across your dairy center.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const text = `Udhar Khata Report (${new Date().toLocaleDateString()})\nTotal Outstanding: ₹${totalOutstanding.toFixed(2)}\nActive Debtors: ${debtors.length}`;
              navigator.clipboard.writeText(text);
              toast.success('Summary copied to clipboard!');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-[13px] backdrop-blur-md transition-all border border-white/10"
          >
            <Download size={15} /> Export Summary
          </button>
        </div>
      </div>

      {/* Modern KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Credit Outstanding */}
        <div className="bg-gradient-to-br from-red-500/10 via-white to-red-50/30 border border-red-200/80 p-5 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-600">Total Outstanding</span>
            <div className="w-9 h-9 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-600">
              <ArrowDownRight size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 tracking-tight">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11.5px] text-gray-500 font-semibold mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
            Across {debtors.length} active farmer accounts
          </div>
        </div>

        {/* Card 2: Active Debtors Count */}
        <div className="bg-gradient-to-br from-orange-500/10 via-white to-orange-50/30 border border-orange-200/80 p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B00]">Active Debtors</span>
            <div className="w-9 h-9 rounded-2xl bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00]">
              <User size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            {debtors.length} <span className="text-xs font-semibold text-gray-500">Farmers</span>
          </div>
          <div className="text-[11.5px] text-gray-500 font-semibold mt-2">
            Total registered: {farmers.length} farmers
          </div>
        </div>

        {/* Card 3: Average Debt Per Farmer */}
        <div className="bg-gradient-to-br from-blue-500/10 via-white to-blue-50/30 border border-blue-200/80 p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">Average Debt / Farmer</span>
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 tracking-tight">
            ₹{avgDebt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11.5px] text-gray-500 font-semibold mt-2">
            Mean credit exposure per debtor
          </div>
        </div>

        {/* Card 4: Top Debtor Warning */}
        <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-50/30 border border-amber-200/80 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Top Debtor Alert</span>
            <div className="w-8 h-8 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <ShieldAlert size={16} />
            </div>
          </div>
          {highestDebtor ? (
            <div>
              <div className="text-[15px] font-bold text-gray-900 truncate">{highestDebtor.farmer.name}</div>
              <div className="text-xs font-black text-red-600">
                Owes ₹{Math.abs(highestDebtor.balance).toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 font-semibold">No pending debt</div>
          )}
          <div className="text-[11px] text-gray-500 font-medium">Highest single credit balance</div>
        </div>
      </div>

      {/* Main Content Card: Search, Filter & Debtor Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-5 border-b border-[#ECECEC] flex flex-wrap items-center justify-between gap-4 bg-white">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by farmer name, code (F001), phone, or village..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F8F9FA] border border-[#ECECEC] rounded-2xl text-[13px] font-semibold text-gray-900 outline-none focus:border-[#FF6B00] transition-colors"
            />
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-2xl border border-gray-200 text-xs font-bold text-gray-700">
              <button
                onClick={() => setDebtFilter('all')}
                className={`px-3 py-1.5 rounded-xl transition-all ${debtFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'}`}
              >
                All ({debtors.length})
              </button>
              <button
                onClick={() => setDebtFilter('high')}
                className={`px-3 py-1.5 rounded-xl transition-all ${debtFilter === 'high' ? 'bg-red-500 text-white shadow-sm' : 'hover:text-gray-900'}`}
              >
                High (&gt;₹5k)
              </button>
              <button
                onClick={() => setDebtFilter('mid')}
                className={`px-3 py-1.5 rounded-xl transition-all ${debtFilter === 'mid' ? 'bg-amber-500 text-white shadow-sm' : 'hover:text-gray-900'}`}
              >
                Mid (₹1k-5k)
              </button>
              <button
                onClick={() => setDebtFilter('low')}
                className={`px-3 py-1.5 rounded-xl transition-all ${debtFilter === 'low' ? 'bg-blue-500 text-white shadow-sm' : 'hover:text-gray-900'}`}
              >
                Low (&lt;₹1k)
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-[#F8F9FA] border border-[#ECECEC] rounded-2xl text-xs font-bold text-gray-800 outline-none"
            >
              <option value="amount-desc">Sort: Debt (High → Low)</option>
              <option value="amount-asc">Sort: Debt (Low → High)</option>
              <option value="name">Sort: Farmer Name</option>
            </select>
          </div>
        </div>

        {/* Debtor Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#ECECEC]">
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Farmer Details</th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Contact & Village</th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400">Animal</th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 text-right">Owes Amount</th>
                <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-wider text-gray-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-6 bg-gray-100 rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100">
                        <CheckCircle size={32} />
                      </div>
                      <div className="text-base font-bold text-gray-900">No Outstanding Debts Found</div>
                      <p className="text-xs text-gray-500 text-center">
                        All farmer credit balances are clean or match your search criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((d, i) => {
                  const owes = Math.abs(d.balance);
                  const isHighDebt = owes >= 5000;
                  const isMidDebt = owes >= 1000 && owes < 5000;

                  return (
                    <motion.tr
                      key={d.farmer.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-gray-50/80 transition-colors group"
                    >
                      {/* Farmer Name & Code */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
                            {d.farmer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-gray-900 group-hover:text-[#FF6B00] transition-colors">
                              {d.farmer.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                                {d.farmer.id}
                              </span>
                              {d.farmer.aadhaarNumber && (
                                <span className="text-[10px] text-gray-400">
                                  Aadhaar Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Village */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                            <Phone size={13} className="text-gray-400" />
                            <span>{d.farmer.mobile || 'No Mobile Registered'}</span>
                          </div>
                          <div className="text-[11px] font-medium text-gray-500">
                            Village: <b className="text-gray-700">{d.farmer.village || 'N/A'}</b>
                          </div>
                        </div>
                      </td>

                      {/* Animal Type */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                          d.farmer.animalType === 'cow'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.farmer.animalType === 'cow' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                          {d.farmer.animalType || 'cow'}
                        </span>
                      </td>

                      {/* Owes Amount */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className="text-lg font-black text-red-600 tracking-tight">
                            ₹{owes.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md mt-0.5 ${
                            isHighDebt ? 'bg-red-100 text-red-700 border border-red-200' :
                            isMidDebt ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {isHighDebt ? 'High Priority' : isMidDebt ? 'Medium Risk' : 'Standard'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenRecovery(d)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            <DollarSign size={14} /> Record Recovery
                          </button>

                          <button
                            onClick={() => handleSendWhatsAppReminder(d)}
                            title="Send WhatsApp Reminder"
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors border border-emerald-200 cursor-pointer"
                          >
                            <MessageSquare size={15} />
                          </button>

                          <button
                            onClick={() => handleOpenLedger(d.farmer)}
                            title="View Full Ledger History"
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors border border-gray-200 cursor-pointer"
                          >
                            <History size={15} />
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

      {/* RECORD RECOVERY MODAL */}
      <AnimatePresence>
        {showRecoveryModal && selectedDebtor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowRecoveryModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden border border-[#ECECEC] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-[#ECECEC] flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Credit Recovery
                    </span>
                    <span className="text-xs text-gray-300">Farmer: {selectedDebtor.farmer.name} ({selectedDebtor.farmer.id})</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-0.5">Record Outstanding Recovery</h3>
                </div>
                <button onClick={() => setShowRecoveryModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                  <X size={16} className="text-white" />
                </button>
              </div>

              <form onSubmit={handleRecoverySubmit} className="p-6 space-y-5">
                {/* Outstanding Summary Badge */}
                <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-red-700 uppercase tracking-wider">Current Outstanding Debt</div>
                      <div className="text-xs text-gray-600">Mobile: {selectedDebtor.farmer.mobile || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="text-xl font-black text-red-600">
                    ₹{Math.abs(selectedDebtor.balance).toFixed(2)}
                  </div>
                </div>

                {/* Amount Field + Preset Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recovery Amount (₹) *</label>
                    <span className="text-xs text-gray-500 font-semibold">Quick Presets:</span>
                  </div>

                  <input
                    type="number"
                    required
                    step="any"
                    value={recoveryAmount}
                    onChange={e => setRecoveryAmount(e.target.value)}
                    className="w-full px-4 py-3 text-2xl font-black rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 outline-none focus:border-emerald-500 transition-colors mb-2"
                    placeholder="0"
                  />

                  {/* Presets */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryAmount(Math.abs(selectedDebtor.balance).toFixed(0))}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-colors"
                    >
                      Full (₹{Math.abs(selectedDebtor.balance).toFixed(0)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryAmount((Math.abs(selectedDebtor.balance) / 2).toFixed(0))}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-colors"
                    >
                      50% (₹{(Math.abs(selectedDebtor.balance) / 2).toFixed(0)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryAmount('1000')}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-colors"
                    >
                      ₹1,000
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryAmount('500')}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 transition-colors"
                    >
                      ₹500
                    </button>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 block">Payment Method *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <DollarSign size={14} /> Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'upi'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Sparkles size={14} /> UPI / QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('bank')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        paymentMethod === 'bank'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <CreditCard size={14} /> Bank Transfer
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 block">Recovery Notes / Receipt Remarks</label>
                  <input
                    type="text"
                    value={recoveryNotes}
                    onChange={e => setRecoveryNotes(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-medium rounded-xl bg-gray-50 border border-gray-200 text-gray-900 outline-none focus:border-emerald-500"
                    placeholder="e.g. Received cash payment at collection desk"
                  />
                </div>

                {/* Submit Controls */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="flex-1 py-3 rounded-2xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={15} /> Save Recovery Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FARMER LEDGER HISTORY MODAL */}
      <AnimatePresence>
        {showLedgerModal && ledgerFarmer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowLedgerModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-[#ECECEC] shadow-2xl max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-[#ECECEC] flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <div className="text-[10px] font-extrabold uppercase text-[#FF6B00] tracking-wider">Farmer Passbook & Ledger</div>
                  <h3 className="text-lg font-bold text-white mt-0.5">{ledgerFarmer.name} ({ledgerFarmer.id})</h3>
                  <div className="text-xs text-gray-400">Mobile: {ledgerFarmer.mobile || 'N/A'} | Village: {ledgerFarmer.village || 'N/A'}</div>
                </div>
                <button onClick={() => setShowLedgerModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors">
                  <X size={16} className="text-white" />
                </button>
              </div>

              {/* Ledger Entries List */}
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                {isLedgerLoading ? (
                  <div className="py-12 text-center text-xs text-gray-400 font-semibold animate-pulse">
                    Loading ledger statement...
                  </div>
                ) : farmerLedgers.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400 font-semibold">
                    No ledger transactions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {farmerLedgers.map((entry, idx) => (
                      <div key={entry.id || idx} className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-gray-900">{entry.description || entry.transactionType}</div>
                          <div className="text-[11px] text-gray-500">
                            {entry.createdAt ? ((entry.createdAt as any).toDate ? (entry.createdAt as any).toDate().toLocaleDateString() : new Date((entry.createdAt as any).seconds ? (entry.createdAt as any).seconds * 1000 : (entry.createdAt as any)).toLocaleDateString()) : 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          {entry.credit > 0 && <div className="font-bold text-emerald-600">+₹{entry.credit.toFixed(2)} (Credit)</div>}
                          {entry.debit > 0 && <div className="font-bold text-red-600">-₹{entry.debit.toFixed(2)} (Debit)</div>}
                          <div className="text-[11px] text-gray-500 font-semibold">Bal: ₹{entry.balance.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
