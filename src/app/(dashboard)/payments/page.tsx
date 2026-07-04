'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { paymentService, Payment, PaymentFormData } from '@/services/paymentService';
import { farmerService } from '@/services/farmerService';
import { collectionService } from '@/services/collectionService';
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
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
      const [p, f] = await Promise.all([paymentService.getAll(centerId), farmerService.getAll(centerId)]);
      setPayments(p);
      setFarmers(f);
    } catch { toast.error('Failed to load data'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { load(); }, [centerId]);

  return (
    <Suspense fallback={null}>
      <PaymentsPageContent
        centerId={centerId} profile={profile} payments={payments} farmers={farmers}
        isLoading={isLoading} showForm={showForm} setShowForm={setShowForm}
        selectedFarmer={selectedFarmer} setSelectedFarmer={setSelectedFarmer}
        pendingBalance={pendingBalance} setPendingBalance={setPendingBalance}
        register={register} handleSubmit={handleSubmit} watch={watch} setValue={setValue} reset={reset} errors={errors}
        farmerIdVal={farmerIdVal} load={load} search={search} setSearch={setSearch} methodVal={methodVal}
      />
    </Suspense>
  );
}

function PaymentsPageContent({
  centerId, profile, payments, farmers, isLoading, showForm, setShowForm,
  selectedFarmer, setSelectedFarmer, pendingBalance, setPendingBalance,
  register, handleSubmit, watch, setValue, reset, errors, farmerIdVal, load, search, setSearch, methodVal
}: any) {
  const searchParams = useSearchParams();

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
      // Calculate pending: total collection amount minus total payments
      if (centerId) {
        Promise.all([
          collectionService.getByFarmer(centerId, farmer.id),
          paymentService.getByFarmer(centerId, farmer.id),
        ]).then(([cols, pays]) => {
          const totalEarned = cols.reduce((s, c) => s + c.totalAmount, 0);
          const totalPaid = pays.reduce((s, p) => s + p.amount, 0);
          setPendingBalance(totalEarned - totalPaid);
        });
      }
    } else {
      setPendingBalance(null);
    }
  }, [farmerIdVal, farmers, centerId]);

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

  const filtered = payments.filter((p: Payment) =>
    p.farmerName.toLowerCase().includes(search.toLowerCase()) ||
    p.farmerId.toLowerCase().includes(search.toLowerCase())
  );
  const totalPaid = payments.filter((p: Payment) => p.paymentMethod).reduce((s: number, p: Payment) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-end">
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white"
          style={{ background: '#FF6B00', borderRadius: '14px', boxShadow: '0 2px 8px rgba(255,107,0,0.3)' }}
        >
          <Plus size={17} /> Record Payment
        </motion.button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Paid', value: `₹${totalPaid.toLocaleString()}`, color: '#22C55E' },
          { label: 'Transactions', value: `${payments.length}`, color: '#FF6B00' },
          { label: 'Farmers Paid', value: `${new Set(payments.map((p: any) => p.farmerId)).size}`, color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
            <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
            <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0]">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder="Search farmer..." value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }} />
          </div>
        </div>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#F0F0F0' }}>
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
                  <button type="submit" className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white" style={{ background: '#FF6B00', boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}>
                    Save Payment
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
