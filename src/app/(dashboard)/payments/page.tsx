'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { paymentService, Payment, PaymentFormData } from '@/services/paymentService';
import { farmerService } from '@/services/farmerService';
import { collectionService } from '@/services/collectionService';
import { ledgerService } from '@/services/ledgerService';
import { deductionService } from '@/services/deductionService';
import { calculateFarmerBalance } from '@/lib/balance';
import { Farmer, Collection } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paymentSchema } from '@/services/paymentService';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, Printer, Trash2, CreditCard, Banknote, Smartphone, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const methodMeta: Record<string, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  cash: { label: 'Cash', icon: Banknote, bg: '#DCFCE7', color: '#16A34A' },
  upi: { label: 'UPI', icon: Smartphone, bg: '#DBEAFE', color: '#2563EB' },
  bank: { label: 'Bank Transfer', icon: CreditCard, bg: '#EDE9FE', color: '#7C3AED' },
};

export default function PaymentsPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [pendingBalance, setPendingBalance] = useState<number | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { farmerId: '', farmerName: '', amount: 0, paymentMethod: 'cash', notes: '' },
  });
  const farmerIdVal = watch('farmerId');
  const methodVal = watch('paymentMethod');

  const load = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [p, d, f] = await Promise.all([
        paymentService.getAll(centerId),
        deductionService.getAll(centerId),
        farmerService.getAll(centerId)
      ]);
      setPayments(p);
      setDeductions(d);
      setFarmers(f);
    } catch { toast.error('Failed to load data'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  return (
    <Suspense fallback={null}>
      <PaymentsPageContent
        centerId={centerId} profile={profile} payments={payments} deductions={deductions} farmers={farmers}
        isLoading={isLoading} showForm={showForm} setShowForm={setShowForm}
        showDeductionForm={showDeductionForm} setShowDeductionForm={setShowDeductionForm}
        selectedFarmer={selectedFarmer} setSelectedFarmer={setSelectedFarmer}
        pendingBalance={pendingBalance} setPendingBalance={setPendingBalance}
        register={register} handleSubmit={handleSubmit} watch={watch} setValue={setValue} reset={reset} errors={errors}
        farmerIdVal={farmerIdVal} load={load} search={search} setSearch={setSearch} methodVal={methodVal}
      />
    </Suspense>
  );
}

function PaymentsPageContent({
  centerId, profile, payments, deductions, farmers, isLoading, showForm, setShowForm,
  showDeductionForm, setShowDeductionForm,
  selectedFarmer, setSelectedFarmer, pendingBalance, setPendingBalance,
  register, handleSubmit, watch, setValue, reset, errors, farmerIdVal, load, search, setSearch, methodVal
}: any) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'payments' | 'deductions'>('payments');

  // Deduction Form States
  const [dedFarmerId, setDedFarmerId] = useState('');
  const [dedFarmerName, setDedFarmerName] = useState('');
  const [dedAmount, setDedAmount] = useState('');
  const [dedReason, setDedReason] = useState<'spoiled_milk' | 'rate_difference' | 'advance' | 'penalty' | 'other'>('advance');
  const [dedNotes, setDedNotes] = useState('');
  const [dedFarmerBalance, setDedFarmerBalance] = useState<number | null>(null);

  // Read URL params to auto-open form for specific farmer
  useEffect(() => {
    const prefillFarmer = searchParams.get('farmerId');
    if (prefillFarmer) {
      setValue('farmerId', prefillFarmer);
      setShowForm(true);
    }
  }, [searchParams, setValue]);

  // Auto-fill farmer name + calc pending balance when farmer selected
  useEffect(() => {
    const farmer = farmers.find((f: Farmer) => f.id.toLowerCase() === farmerIdVal?.toLowerCase());
    setSelectedFarmer(farmer || null);
    if (farmer) {
      setValue('farmerName', farmer.name);
      // Calculate pending balance using calculateFarmerBalance from ledger entries
      if (centerId) {
        ledgerService.getByFarmer(centerId, farmer.id).then((transactions) => {
          const { balance } = calculateFarmerBalance(transactions);
          setPendingBalance(balance);
        });
      }
    } else {
      setPendingBalance(null);
    }
  }, [farmerIdVal, farmers, centerId]);

  // Handle deduction farmer balance prefill
  useEffect(() => {
    const farmer = farmers.find((f: Farmer) => f.id.toLowerCase() === dedFarmerId?.toLowerCase());
    if (farmer) {
      setDedFarmerName(farmer.name);
      if (centerId) {
        ledgerService.getByFarmer(centerId, farmer.id).then((transactions) => {
          const { balance } = calculateFarmerBalance(transactions);
          setDedFarmerBalance(balance);
        });
      }
    } else {
      setDedFarmerName('');
      setDedFarmerBalance(null);
    }
  }, [dedFarmerId, farmers, centerId]);

  const onSubmit = async (data: PaymentFormData) => {
    if (!centerId || !profile) return;
    try {
      await paymentService.add(centerId, data, profile.uid || 'unknown');
      toast.success(`Payment of ₹${data.amount} recorded`);
      setShowForm(false);
      reset();
      setSelectedFarmer(null);
      setPendingBalance(null);
      load();
    } catch { toast.error('Failed to record payment'); }
  };

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Delete this payment?')) return;
    try { await paymentService.delete(centerId, id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleAddDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !profile) return;
    if (!dedFarmerId) { toast.error('Please specify farmer'); return; }
    const amt = parseFloat(dedAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Please enter valid amount'); return; }

    try {
      await deductionService.add(centerId, {
        farmerId: dedFarmerId.toUpperCase(),
        farmerName: dedFarmerName,
        amount: amt,
        reason: dedReason,
        notes: dedNotes
      }, profile.uid || 'unknown');
      toast.success(`Deduction of ₹${amt} recorded`);
      setShowDeductionForm(false);
      setDedFarmerId('');
      setDedFarmerName('');
      setDedAmount('');
      setDedReason('advance');
      setDedNotes('');
      setDedFarmerBalance(null);
      load();
    } catch { toast.error('Failed to save deduction'); }
  };

  const handleDeleteDeduction = async (id: string) => {
    if (!centerId || !confirm('Delete this deduction?')) return;
    try { await deductionService.delete(centerId, id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const filtered = payments.filter((p: Payment) =>
    p.farmerName.toLowerCase().includes(search.toLowerCase()) ||
    p.farmerId.toLowerCase().includes(search.toLowerCase())
  );
  const totalPaid = payments.filter((p: Payment) => p.paymentMethod).reduce((s: number, p: Payment) => s + p.amount, 0);

  const filteredDeductions = deductions.filter((d: any) =>
    d.farmerName.toLowerCase().includes(search.toLowerCase()) ||
    d.farmerId.toLowerCase().includes(search.toLowerCase())
  );
  const totalDeducted = deductions.reduce((s: number, d: any) => s + d.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header Tabs & Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#ECECEC] pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('payments')}
            className="px-4 py-2 text-[14px] font-bold border-b-2 transition-all cursor-pointer"
            style={{
              borderColor: activeTab === 'payments' ? '#FF6B00' : 'transparent',
              color: activeTab === 'payments' ? '#FF6B00' : '#888888',
            }}
          >
            Payments List
          </button>
          <button
            onClick={() => setActiveTab('deductions')}
            className="px-4 py-2 text-[14px] font-bold border-b-2 transition-all cursor-pointer"
            style={{
              borderColor: activeTab === 'deductions' ? '#FF6B00' : 'transparent',
              color: activeTab === 'deductions' ? '#FF6B00' : '#888888',
            }}
          >
            Deductions List
          </button>
        </div>

        <div>
          {activeTab === 'payments' ? (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer"
              style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
            >
              <Plus size={17} /> Record Payment
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowDeductionForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white cursor-pointer animate-fade-in"
              style={{ background: '#EF4444', borderRadius: '14px', boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}
            >
              <Plus size={17} /> Record Deduction
            </motion.button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {activeTab === 'payments' ? (
          [
            { label: 'Total Paid', value: `₹${totalPaid.toLocaleString()}`, color: '#22C55E' },
            { label: 'Transactions', value: `${payments.length}`, color: '#FF6B00' },
            { label: 'Farmers Paid', value: `${new Set(payments.map((p: any) => p.farmerId)).size}`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
              <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))
        ) : (
          [
            { label: 'Total Deducted', value: `₹${totalDeducted.toLocaleString()}`, color: '#EF4444' },
            { label: 'Deductions Count', value: `${deductions.length}`, color: '#FF6B00' },
            { label: 'Farmers Adjusted', value: `${new Set(deductions.map((d: any) => d.farmerId)).size}`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
              <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))
        )}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0]">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder={activeTab === 'payments' ? "Search payment..." : "Search deduction..."}
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }} />
          </div>
        </div>
        
        {activeTab === 'payments' ? (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  {['Farmer', 'Date', 'Method', 'Notes', 'Amount', ''].map(col => (
                    <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: j === 0 ? '120px' : '70px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#FFF3E8' }}>
                          <Wallet size={26} style={{ color: '#FF6B00' }} />
                        </div>
                        <div className="text-[15px] font-semibold text-[#111111]">No payments yet</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p: Payment, i: number) => {
                    const m = methodMeta[p.paymentMethod];
                    const Icon = m.icon;
                    let dateStr = 'N/A';
                    if (p.createdAt) {
                      const d = (p.createdAt as any).toDate ? (p.createdAt as any).toDate() : new Date(p.createdAt as any);
                      dateStr = format(d, 'dd MMM yyyy');
                    }
                    return (
                      <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-semibold text-[#111111]">{p.farmerName}</div>
                          <div className="text-[11px] font-mono text-[#AAAAAA]">{p.farmerId}</div>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">{dateStr}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-[12px] font-medium w-fit px-2.5 py-1 rounded-lg" style={{ background: m.bg, color: m.color }}>
                            <Icon size={13} /> {m.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#777]">{p.notes || '—'}</td>
                        <td className="px-6 py-4 text-[16px] font-bold" style={{ color: '#FF6B00' }}>₹{p.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200" style={{ background: '#F9F9F9' }}>
                              <Printer size={13} style={{ color: '#555' }} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FEE2E2' }}>
                              <Trash2 size={13} style={{ color: '#DC2626' }} />
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  {['Farmer', 'Date', 'Reason', 'Notes', 'Amount', ''].map(col => (
                    <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: j === 0 ? '120px' : '70px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredDeductions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-50">
                          <Wallet size={26} className="text-red-500" />
                        </div>
                        <div className="text-[15px] font-semibold text-[#111111]">No deductions recorded yet</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDeductions.map((d: any, i: number) => {
                    let dateStr = 'N/A';
                    if (d.deductionDate) {
                      dateStr = format(new Date(d.deductionDate), 'dd MMM yyyy');
                    }
                    return (
                      <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-semibold text-[#111111]">{d.farmerName}</div>
                          <div className="text-[11px] font-mono text-[#AAAAAA]">{d.farmerId}</div>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#555]">{dateStr}</td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-[12px] font-medium px-2.5 py-1 rounded-lg bg-red-100 text-red-600">
                            {d.reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-[#777]">{d.notes || '—'}</td>
                        <td className="px-6 py-4 text-[16px] font-bold text-red-500">₹{d.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDeleteDeduction(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-100 cursor-pointer">
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
        )}
      </motion.div>

      {/* Add Payment Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#FFFFFF', border: '1px solid #ECECEC', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-[17px] font-bold text-[#111111]">Record Payment</div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#F0F0F0' }}>
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Farmer Select */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Farmer ID</label>
                  <input
                    {...register('farmerId')}
                    list="farmer-list"
                    autoComplete="off"
                    placeholder="Enter Farmer ID..."
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all uppercase"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
                  />
                  <datalist id="farmer-list">
                    {farmers.map((f: Farmer) => (
                      <option key={f.id} value={f.id}>{f.name} - {f.village}</option>
                    ))}
                  </datalist>
                  {errors.farmerId && <p className="text-[11px] text-red-500 mt-1">{errors.farmerId.message}</p>}

                  <div className="h-6 mt-2">
                    {selectedFarmer ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold" style={{ color: '#22C55E' }}>{selectedFarmer.name}</span>
                        {pendingBalance !== null && (
                          <>
                            <span className="text-[12px] text-[#777]">· A/C balance:</span>
                            <span className="text-[13px] font-bold" style={{ color: pendingBalance > 0 ? '#EF4444' : '#22C55E' }}>
                              {pendingBalance > 0 ? '+' : ''}₹{pendingBalance.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    ) : farmerIdVal ? (
                      <span className="text-[12px] text-red-500">Farmer not found. Check ID.</span>
                    ) : null}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Amount (₹)</label>
                  <input type="number" step="1" {...register('amount', { valueAsNumber: true })}
                    className="w-full px-4 py-3 text-[18px] font-bold rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="0"
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }}
                  />
                  {errors.amount && <p className="text-[11px] text-red-500 mt-1">{errors.amount.message}</p>}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(methodMeta) as [string, typeof methodMeta[string]][]).map(([key, m]) => {
                      const Icon = m.icon;
                      return (
                        <button key={key} type="button" onClick={() => setValue('paymentMethod', key as any)}
                          className="flex flex-col items-center gap-1 py-3 rounded-xl text-[12px] font-semibold border transition-all"
                          style={{
                            background: methodVal === key ? m.bg : '#F7F7F7',
                            borderColor: methodVal === key ? m.color : '#ECECEC',
                            color: methodVal === key ? m.color : '#777',
                          }}>
                          <Icon size={16} /> {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Notes (optional)</label>
                  <input {...register('notes')} className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. May 1st week payment"
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555]">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white cursor-pointer" style={{ background: '#FF6B00', boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}>
                    Save Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Deduction Modal */}
      <AnimatePresence>
        {showDeductionForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 cursor-pointer"
            onClick={() => setShowDeductionForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6 cursor-default"
              style={{ background: '#FFFFFF', border: '1px solid #ECECEC', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="text-[17px] font-bold text-[#111111]">Record Deduction</div>
                <button onClick={() => setShowDeductionForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100">
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>

              <form onSubmit={handleAddDeduction} className="space-y-4">
                {/* Farmer ID */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Farmer ID</label>
                  <input
                    value={dedFarmerId}
                    onChange={e => setDedFarmerId(e.target.value)}
                    list="ded-farmer-list"
                    autoComplete="off"
                    placeholder="Enter Farmer ID..."
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all uppercase"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                  />
                  <datalist id="ded-farmer-list">
                    {farmers.map((f: Farmer) => (
                      <option key={f.id} value={f.id}>{f.name} - {f.village}</option>
                    ))}
                  </datalist>

                  <div className="h-6 mt-2">
                    {dedFarmerName ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#22C55E]">{dedFarmerName}</span>
                        {dedFarmerBalance !== null && (
                          <>
                            <span className="text-[12px] text-[#777]">· A/C balance:</span>
                            <span className="text-[13px] font-bold" style={{ color: dedFarmerBalance > 0 ? '#EF4444' : '#22C55E' }}>
                              {dedFarmerBalance > 0 ? '+' : ''}₹{dedFarmerBalance.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    ) : dedFarmerId ? (
                      <span className="text-[12px] text-red-500">Farmer not found. Check ID.</span>
                    ) : null}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Deduction Amount (₹)</label>
                  <input
                    type="number"
                    value={dedAmount}
                    onChange={e => setDedAmount(e.target.value)}
                    className="w-full px-4 py-3 text-[18px] font-bold rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="0"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Deduction Reason</label>
                  <select
                    value={dedReason}
                    onChange={e => setDedReason(e.target.value as any)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                  >
                    <option value="spoiled_milk">Spoiled Milk</option>
                    <option value="rate_difference">Rate Difference</option>
                    <option value="advance">Advance</option>
                    <option value="penalty">Penalty</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Notes (optional)</label>
                  <input
                    value={dedNotes}
                    onChange={e => setDedNotes(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. advance deduction"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowDeductionForm(false)} className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555]">Cancel</button>
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white bg-red-500 cursor-pointer" style={{ boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}>
                    Save Deduction
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
