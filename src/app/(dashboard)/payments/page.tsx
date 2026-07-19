'use client';

import { useState, useEffect, Suspense, useRef, forwardRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { paymentService } from '@/services/paymentService';
import { farmerService } from '@/services/farmerService';
import { collectionService } from '@/services/collectionService';
import { ledgerService } from '@/services/ledgerService';
import { deductionService } from '@/services/deductionService';
import { settingsService, GeneralSettings } from '@/services/settingsService';
import { calculateFarmerBalance } from '@/lib/balance';
import { Farmer, Collection, Payment, PaymentFormData, paymentSchema } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, Printer, Trash2, CreditCard, Banknote, Smartphone, Wallet, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';

const cardStyle = { background: '#FFFFFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const methodMeta: Record<string, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  cash: { label: 'Cash', icon: Banknote, bg: '#DCFCE7', color: '#16A34A' },
  upi: { label: 'UPI', icon: Smartphone, bg: '#DBEAFE', color: '#2563EB' },
  bank: { label: 'Bank Transfer', icon: CreditCard, bg: '#EDE9FE', color: '#7C3AED' },
};

const DEDUCTION_REASONS = [
  { value: 'milk_spoiled', label: 'Milk Spoiled', type: 'penalty' },
  { value: 'milk_rejected', label: 'Milk Rejected', type: 'penalty' },
  { value: 'low_fat_penalty', label: 'Low FAT Penalty', type: 'penalty' },
  { value: 'low_snf_penalty', label: 'Low SNF Penalty', type: 'penalty' },
  { value: 'advance_recovery', label: 'Advance Recovery', type: 'recovery' },
  { value: 'feed_purchase', label: 'Feed Purchase', type: 'purchase' },
  { value: 'medicine', label: 'Medicine', type: 'purchase' },
  { value: 'transport', label: 'Transport', type: 'adjustment' },
  { value: 'equipment_damage', label: 'Equipment Damage', type: 'penalty' },
  { value: 'loan_recovery', label: 'Loan Recovery', type: 'recovery' },
  { value: 'rate_adjustment', label: 'Rate Adjustment', type: 'adjustment' },
  { value: 'other', label: 'Other', type: 'other' }
];

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

  // Print States
  const [printPayment, setPrintPayment] = useState<Payment | null>(null);
  const [printDeduction, setPrintDeduction] = useState<any | null>(null);
  const [generalSettings, setGeneralSettings] = useState<Partial<GeneralSettings>>({});

  const load = async () => {
    if (!centerId) return;
    setIsLoading(true);
    try {
      const [p, d, f, s] = await Promise.all([
        paymentService.getAll(centerId),
        deductionService.getAll(centerId),
        farmerService.getAll(centerId),
        settingsService.getSettings(centerId)
      ]);
      setPayments(p);
      setDeductions(d);
      setFarmers(f);
      setGeneralSettings(s || {});
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
        load={load} search={search} setSearch={setSearch}
        printPayment={printPayment} setPrintPayment={setPrintPayment}
        printDeduction={printDeduction} setPrintDeduction={setPrintDeduction}
        generalSettings={generalSettings}
      />
    </Suspense>
  );
}

function PaymentsPageContent({
  centerId, profile, payments, deductions, farmers, isLoading, showForm, setShowForm,
  showDeductionForm, setShowDeductionForm, load, search, setSearch,
  printPayment, setPrintPayment, printDeduction, setPrintDeduction, generalSettings
}: any) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'payments' | 'deductions'>('payments');

  // Filter States for dashboard lists
  const [filterType, setFilterType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'fy' | 'all' | 'custom'>('all');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 9), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Deduction Form States
  const [dedFarmerId, setDedFarmerId] = useState('');
  const [dedFarmerName, setDedFarmerName] = useState('');
  const [dedAmount, setDedAmount] = useState('');
  const [dedReason, setDedReason] = useState<string>('feed_purchase');
  const [dedNotes, setDedNotes] = useState('');
  const [dedFromDate, setDedFromDate] = useState(format(subDays(new Date(), 9), 'yyyy-MM-dd'));
  const [dedToDate, setDedToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dedEntryDate, setDedEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dedFarmerBalance, setDedFarmerBalance] = useState<number | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  // Deduction Filters
  const [dedFilterReason, setDedFilterReason] = useState('all');
  const [dedFilterStatus, setDedFilterStatus] = useState('all');
  const [dedPeriodStart, setDedPeriodStart] = useState('');
  const [dedPeriodEnd, setDedPeriodEnd] = useState('');

  // Redesigned Custom Range Payment Form States
  const [step, setStep] = useState<1 | 2>(1);
  const [formFarmerId, setFormFarmerId] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [formFromDate, setFormFromDate] = useState(format(subDays(new Date(), 9), 'yyyy-MM-dd'));
  const [formToDate, setFormToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formBonus, setFormBonus] = useState<number | string>(0);
  const [formAdvanceRecovery, setFormAdvanceRecovery] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank'>('cash');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentDate, setFormPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References for react-to-print
  const printThermalRef = useRef<HTMLDivElement>(null);
  const printA4Ref = useRef<HTMLDivElement>(null);
  const printDedThermalRef = useRef<HTMLDivElement>(null);
  const printDedA4Ref = useRef<HTMLDivElement>(null);

  const handlePrintThermal = useReactToPrint({ contentRef: printThermalRef });
  const handlePrintA4 = useReactToPrint({ contentRef: printA4Ref });
  const handlePrintDedThermal = useReactToPrint({ contentRef: printDedThermalRef });
  const handlePrintDedA4 = useReactToPrint({ contentRef: printDedA4Ref });

  // Read URL params to auto-open form for specific farmer
  useEffect(() => {
    const prefillFarmer = searchParams.get('farmerId');
    if (prefillFarmer) {
      setFormFarmerId(prefillFarmer);
      setShowForm(true);
    }
  }, [searchParams]);

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

  // Look up Farmer object on Step 1
  useEffect(() => {
    const farmer = farmers.find((f: Farmer) => f.id.toLowerCase() === formFarmerId?.toLowerCase());
    setSelectedFarmer(farmer || null);
  }, [formFarmerId, farmers]);

  const handleCalculateSummary = async () => {
    if (!centerId) return;
    if (!selectedFarmer) {
      toast.error('Please specify a valid Farmer ID');
      return;
    }
    setLoadingSummary(true);
    try {
      const [cols, deds, ledgers] = await Promise.all([
        collectionService.getByFarmer(centerId, selectedFarmer.id),
        deductionService.getByFarmer(centerId, selectedFarmer.id),
        ledgerService.getByFarmer(centerId, selectedFarmer.id)
      ]);

      const start = new Date(formFromDate + 'T00:00:00');
      const end = new Date(formToDate + 'T23:59:59');

      // Filter collections in range
      const rangeCols = cols.filter(c => {
        const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
        return d >= start && d <= end;
      });

      // Split paid vs unpaid
      const unpaidCols = rangeCols.filter(c => !c.paymentId);
      const paidCols = rangeCols.filter(c => c.paymentId);

      // Filter deductions in range
      const rangeDeductions = deds.filter(d => {
        if (d.isDeleted === 1 || d.paymentId || d.paymentStatus === 'paid') return false;
        const dFrom = new Date(d.fromDate);
        const dTo = new Date(d.toDate);
        return dFrom >= start && dTo <= end;
      });

      // Calculate collection aggregates
      const totalDays = unpaidCols.length;
      const totalLiters = unpaidCols.reduce((sum, c) => sum + c.liters, 0);
      const cowLiters = unpaidCols.filter(c => c.animalType === 'cow').reduce((sum, c) => sum + c.liters, 0);
      const buffaloLiters = unpaidCols.filter(c => c.animalType === 'buffalo').reduce((sum, c) => sum + c.liters, 0);
      const milkAmount = unpaidCols.reduce((sum, c) => sum + c.totalAmount, 0);

      // FAT / SNF Weighted averages
      const totalFatLiters = unpaidCols.reduce((sum, c) => sum + (c.fat * c.liters), 0);
      const totalSnfLiters = unpaidCols.reduce((sum, c) => sum + (c.snf * c.liters), 0);
      const avgFat = totalLiters > 0 ? (totalFatLiters / totalLiters) : 0;
      const avgSnf = totalLiters > 0 ? (totalSnfLiters / totalLiters) : 0;

      const deductionsAmount = rangeDeductions.reduce((sum, d) => sum + d.amount, 0);

      // Ledger starting balance before From Date
      const priorLedgers = ledgers.filter(entry => {
        const entryDate = (entry.createdAt as any).toDate ? (entry.createdAt as any).toDate() : new Date(entry.createdAt as any);
        return entryDate < start;
      });

      let startingBalance = 0;
      if (priorLedgers.length > 0) {
        const sorted = [...priorLedgers].sort((a, b) => {
          const timeA = new Date(a.createdAt as any).getTime();
          const timeB = new Date(b.createdAt as any).getTime();
          return timeA - timeB;
        });
        startingBalance = sorted[sorted.length - 1].balance;
      }

      // Split starting balance
      let previousBalance = 0;
      let outstandingAdvance = 0;
      if (startingBalance >= 0) {
        previousBalance = startingBalance;
      } else {
        outstandingAdvance = Math.abs(startingBalance);
      }

      setSummaryData({
        unpaidCols,
        paidCols,
        rangeDeductions,
        totalDays,
        totalLiters,
        cowLiters,
        buffaloLiters,
        avgFat,
        avgSnf,
        milkAmount,
        deductionsAmount,
        startingBalance,
        previousBalance,
        outstandingAdvance
      });

      setFormBonus(0);
      setFormNotes(`Payment period ${format(start, 'dd MMM')} to ${format(end, 'dd MMM yyyy')}`);

      // Auto recovery: fill max up to outstanding advance or Net earnings
      const netEarnings = milkAmount + previousBalance - deductionsAmount;
      const suggestedRecovery = Math.max(0, Math.min(outstandingAdvance, netEarnings));
      setFormAdvanceRecovery(parseFloat(suggestedRecovery.toFixed(2)));

      setStep(2);
    } catch (err) {
      toast.error('Failed to calculate payment summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSavePayment = async () => {
    if (!centerId || !profile || !summaryData || !selectedFarmer) return;
    setIsSubmitting(true);

    const bonusVal = parseFloat(formBonus as string) || 0;
    const recoveryVal = parseFloat(formAdvanceRecovery as string) || 0;
    const netPayable = summaryData.milkAmount + bonusVal + summaryData.previousBalance - summaryData.deductionsAmount - recoveryVal;
    const roundedNetPayable = parseFloat(netPayable.toFixed(2));

    try {
      const paymentData: PaymentFormData = {
        farmerId: selectedFarmer.id,
        farmerName: selectedFarmer.name,
        amount: roundedNetPayable,
        paymentMethod,
        notes: formNotes,
        paymentDate: new Date(formPaymentDate + 'T12:00:00'),
        fromDate: new Date(formFromDate + 'T00:00:00'),
        toDate: new Date(formToDate + 'T23:59:59'),
        totalDays: summaryData.totalDays,
        totalLiters: summaryData.totalLiters,
        cowLiters: summaryData.cowLiters,
        buffaloLiters: summaryData.buffaloLiters,
        avgFat: parseFloat(summaryData.avgFat.toFixed(2)),
        avgSnf: parseFloat(summaryData.avgSnf.toFixed(2)),
        milkAmount: summaryData.milkAmount,
        deductionsAmount: summaryData.deductionsAmount,
        previousBalance: summaryData.previousBalance,
        bonus: bonusVal,
        advanceRecovery: recoveryVal,
        netPayable: roundedNetPayable
      };

      const savedId = await paymentService.add(centerId, paymentData, profile.uid || 'unknown');
      toast.success(`Payment of ₹${roundedNetPayable} recorded`);
      
      // Auto pre-populate print template
      setPrintPayment({
        id: savedId,
        ...paymentData,
        createdAt: new Date()
      });

      setShowForm(false);
      // reset states
      setStep(1);
      setFormFarmerId('');
      setSelectedFarmer(null);
      setSummaryData(null);
      setFormPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      load();
    } catch {
      toast.error('Failed to save payment record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!centerId || !confirm('Delete this payment and unlock its collections?')) return;
    try { await paymentService.delete(centerId, id); toast.success('Payment deleted successfully'); load(); }
    catch { toast.error('Failed to delete payment'); }
  };

  const handleAddDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId || !profile) return;
    if (!dedFarmerId) { toast.error('Please specify farmer'); return; }
    const amt = parseFloat(dedAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Please enter valid amount'); return; }

    if (new Date(dedToDate) < new Date(dedFromDate)) {
      toast.error('To Date cannot be before From Date');
      return;
    }

    try {
      const matchedReason = DEDUCTION_REASONS.find(r => r.value === dedReason);
      const deductionType = (matchedReason?.type || 'other') as any;

      await deductionService.add(centerId, {
        farmerId: dedFarmerId.toUpperCase(),
        farmerName: dedFarmerName,
        amount: amt,
        deductionType,
        reason: dedReason as any,
        notes: dedNotes,
        fromDate: new Date(dedFromDate + 'T00:00:00'),
        toDate: new Date(dedToDate + 'T23:59:59'),
        entryDate: new Date(dedEntryDate + 'T12:00:00')
      }, profile.uid || 'unknown');

      toast.success(`Deduction of ₹${amt} recorded`);
      setShowDeductionForm(false);
      setDedFarmerId('');
      setDedFarmerName('');
      setDedAmount('');
      setDedReason('feed_purchase');
      setDedNotes('');
      setDedFromDate(format(subDays(new Date(), 9), 'yyyy-MM-dd'));
      setDedToDate(format(new Date(), 'yyyy-MM-dd'));
      setDedEntryDate(format(new Date(), 'yyyy-MM-dd'));
      setDedFarmerBalance(null);
      setOverlapWarning(null);
      load();
    } catch { toast.error('Failed to save deduction'); }
  };

  const handleDeleteDeduction = async (id: string) => {
    if (!centerId || !confirm('Delete this deduction?')) return;
    try { await deductionService.delete(centerId, id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  // Check overlaps in real-time
  useEffect(() => {
    if (!dedFarmerId || !dedReason || !dedFromDate || !dedToDate) {
      setOverlapWarning(null);
      return;
    }
    const fromTime = new Date(dedFromDate + 'T00:00:00').getTime();
    const toTime = new Date(dedToDate + 'T23:59:59').getTime();
    if (toTime < fromTime) {
      setOverlapWarning(null);
      return;
    }
    
    const farmerDeds = deductions.filter(
      (d: any) => d.farmerId.toUpperCase() === dedFarmerId.toUpperCase() && d.reason === dedReason && d.isDeleted !== 1
    );
    
    const overlapping = farmerDeds.find((d: any) => {
      const dFrom = new Date(d.fromDate).getTime();
      const dTo = new Date(d.toDate).getTime();
      return (fromTime <= dTo && toTime >= dFrom);
    });
    
    if (overlapping) {
      setOverlapWarning(
        `Warning: Overlaps with existing '${DEDUCTION_REASONS.find(r => r.value === dedReason)?.label}' deduction of ₹${overlapping.amount} for period (${format(new Date(overlapping.fromDate), 'dd MMM yyyy')} to ${format(new Date(overlapping.toDate), 'dd MMM yyyy')})`
      );
    } else {
      setOverlapWarning(null);
    }
  }, [dedFarmerId, dedReason, dedFromDate, dedToDate, deductions]);

  // Date Filter logic
  const getFilterDates = () => {
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();

    if (filterType === 'today') {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (filterType === 'yesterday') {
      const yesterday = subDays(now, 1);
      startDate = startOfDay(yesterday);
      endDate = endOfDay(yesterday);
    } else if (filterType === 'week') {
      startDate = startOfDay(subDays(now, 6));
      endDate = endOfDay(now);
    } else if (filterType === 'month') {
      startDate = startOfDay(subDays(now, 29));
      endDate = endOfDay(now);
    } else if (filterType === 'fy') {
      const currentYear = now.getFullYear();
      const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
      startDate = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      endDate = endOfDay(now);
    } else if (filterType === 'custom') {
      startDate = startOfDay(new Date(customStart));
      endDate = endOfDay(new Date(customEnd));
    }
    return { startDate, endDate };
  };

  const { startDate, endDate } = getFilterDates();

  const filtered = payments.filter((p: Payment) => {
    const matchesSearch = p.farmerName.toLowerCase().includes(search.toLowerCase()) ||
      p.farmerId.toLowerCase().includes(search.toLowerCase());
    const pDate = p.createdAt ? ((p.createdAt as any).toDate ? (p.createdAt as any).toDate() : new Date(p.createdAt as any)) : new Date();
    const matchesDate = pDate >= startDate && pDate <= endDate;
    return matchesSearch && matchesDate;
  });

  const filteredDeductions = deductions.filter((d: any) => {
    const matchesSearch = d.farmerName.toLowerCase().includes(search.toLowerCase()) ||
      d.farmerId.toLowerCase().includes(search.toLowerCase()) ||
      (d.voucherNo || '').toLowerCase().includes(search.toLowerCase());
      
    const matchesReason = dedFilterReason === 'all' || d.reason === dedFilterReason;
    
    const matchesStatus = dedFilterStatus === 'all' || 
      (dedFilterStatus === 'paid' && (d.paymentId || d.paymentStatus === 'paid')) ||
      (dedFilterStatus === 'pending' && (!d.paymentId && d.paymentStatus !== 'paid'));

    const dDate = d.entryDate ? new Date(d.entryDate) : d.deductionDate ? new Date(d.deductionDate) : new Date(d.createdAt);
    const matchesGlobalDate = dDate >= startDate && dDate <= endDate;

    let matchesPeriod = true;
    if (dedPeriodStart) {
      const pStart = new Date(dedPeriodStart + 'T00:00:00');
      const dFrom = new Date(d.fromDate);
      matchesPeriod = matchesPeriod && dFrom >= pStart;
    }
    if (dedPeriodEnd) {
      const pEnd = new Date(dedPeriodEnd + 'T23:59:59');
      const dTo = new Date(d.toDate);
      matchesPeriod = matchesPeriod && dTo <= pEnd;
    }
    
    return matchesSearch && matchesReason && matchesStatus && matchesGlobalDate && matchesPeriod;
  });

  const totalPaid = filtered.reduce((s: number, p: Payment) => s + p.amount, 0);
  const totalDeducted = filteredDeductions.reduce((s: number, d: any) => s + d.amount, 0);

  // Compute live step 2 sums
  const bonusVal = parseFloat(formBonus as string) || 0;
  const recoveryVal = parseFloat(formAdvanceRecovery as string) || 0;
  const liveNetPayable = summaryData ? (summaryData.milkAmount + bonusVal + summaryData.previousBalance - summaryData.deductionsAmount - recoveryVal) : 0;

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
              onClick={() => { setStep(1); setSummaryData(null); setShowForm(true); }}
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

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#ECECEC] rounded-2xl shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'Last 30 Days' },
            { id: 'fy', label: 'Financial Year' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id as any)}
              className="px-3.5 py-1.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer border"
              style={{
                background: filterType === opt.id ? '#FF6B00' : 'transparent',
                color: filterType === opt.id ? '#FFFFFF' : '#666666',
                borderColor: filterType === opt.id ? '#FF6B00' : '#ECECEC',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filterType === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#444] outline-none"
            />
            <span className="text-[12px] text-[#777]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 border border-[#ECECEC] rounded-xl text-[13px] font-semibold text-[#444] outline-none"
            />
          </div>
        )}
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {activeTab === 'payments' ? (
          [
            { label: 'Total Paid (Filtered)', value: `₹${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#22C55E' },
            { label: 'Transactions', value: `${filtered.length}`, color: '#FF6B00' },
            { label: 'Farmers Paid', value: `${new Set(filtered.map((p: any) => p.farmerId)).size}`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
              <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))
        ) : (
          [
            { label: 'Total Deducted (Filtered)', value: `₹${totalDeducted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#EF4444' },
            { label: 'Deductions Count', value: `${filteredDeductions.length}`, color: '#FF6B00' },
            { label: 'Farmers Adjusted', value: `${new Set(filteredDeductions.map((d: any) => d.farmerId)).size}`, color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding: '20px' }}>
              <div className="text-[12px] text-[#777777] mb-1">{s.label}</div>
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))
        )}
      </div>

      {/* History Lists */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={cardStyle} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBBBBB]" />
            <input className="w-full pl-9 pr-4 py-2.5 text-[13px] rounded-xl outline-none transition-all"
              style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
              placeholder={activeTab === 'payments' ? "Search payment..." : "Search deduction..."}
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = '#FF6B00'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#ECECEC'; }} />
          </div>

          {activeTab === 'deductions' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Reason Filter */}
              <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-xl border border-[#ECECEC]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason:</span>
                <select
                  value={dedFilterReason}
                  onChange={e => setDedFilterReason(e.target.value)}
                  className="bg-transparent text-[12px] font-semibold outline-none border-none pr-1.5 text-slate-700 cursor-pointer"
                >
                  <option value="all">All Reasons</option>
                  {DEDUCTION_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-[#F7F7F7] px-3 py-1.5 rounded-xl border border-[#ECECEC]">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status:</span>
                <select
                  value={dedFilterStatus}
                  onChange={e => setDedFilterStatus(e.target.value)}
                  className="bg-transparent text-[12px] font-semibold outline-none border-none pr-1.5 text-slate-700 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Payment Period Filters */}
              <div className="flex items-center gap-2 bg-[#F7F7F7] px-3 py-1 rounded-xl border border-[#ECECEC] text-[12px] font-semibold text-slate-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period:</span>
                <input
                  type="date"
                  value={dedPeriodStart}
                  onChange={e => setDedPeriodStart(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] cursor-pointer"
                />
                <span className="text-gray-400 font-normal">to</span>
                <input
                  type="date"
                  value={dedPeriodEnd}
                  onChange={e => setDedPeriodEnd(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] cursor-pointer"
                />
                {(dedPeriodStart || dedPeriodEnd) && (
                  <button
                    onClick={() => { setDedPeriodStart(''); setDedPeriodEnd(''); }}
                    className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {activeTab === 'payments' ? (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  {['Farmer', 'Period', 'Milk Summary', 'Adjustments', 'Net Paid', ''].map(col => (
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
                        <div className="text-[15px] font-semibold text-[#111111]">No payments found</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p: Payment, i: number) => {
                    const m = methodMeta[p.paymentMethod] || { label: p.paymentMethod, icon: CreditCard, bg: '#F1F5F9', color: '#475569' };
                    const Icon = m.icon;
                    
                    const fDate = p.fromDate ? ((p.fromDate as any).toDate ? (p.fromDate as any).toDate() : new Date(p.fromDate as any)) : null;
                    const tDate = p.toDate ? ((p.toDate as any).toDate ? (p.toDate as any).toDate() : new Date(p.toDate as any)) : null;
                    const periodStr = (fDate && tDate) ? `${format(fDate, 'dd MMM')} - ${format(tDate, 'dd MMM yy')}` : '—';
                    
                    return (
                      <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-semibold text-[#111111]">{p.farmerName}</div>
                          <div className="text-[11px] font-mono text-[#AAAAAA]">{p.farmerId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-medium text-[#444]">{periodStr}</div>
                          <div className="text-[11px] text-[#999]">{p.totalDays || 0} Days</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[13px] font-semibold text-[#333]">{(p.totalLiters || 0).toFixed(1)} L</div>
                          <div className="text-[11px] text-[#888] font-mono">F:{(p.avgFat || 0).toFixed(1)} S:{(p.avgSnf || 0).toFixed(1)}</div>
                        </td>
                        <td className="px-6 py-4 text-[12px] text-[#666]">
                          {(p.deductionsAmount || 0) > 0 && <div className="text-red-500">Ded: -₹{p.deductionsAmount}</div>}
                          {(p.advanceRecovery || 0) > 0 && <div className="text-amber-600">Rec: -₹{p.advanceRecovery}</div>}
                          {(p.bonus || 0) > 0 && <div className="text-green-600">Bon: +₹{p.bonus}</div>}
                          {!((p.deductionsAmount || 0) > 0 || (p.advanceRecovery || 0) > 0 || (p.bonus || 0) > 0) && <span className="text-[#999]">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[16px] font-bold" style={{ color: '#FF6B00' }}>₹{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <span className="flex items-center gap-1 text-[10px] w-fit px-1.5 py-0.5 rounded font-semibold mt-0.5" style={{ background: m.bg, color: m.color }}>
                            <Icon size={10} /> {m.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setPrintPayment(p)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 cursor-pointer bg-white" title="Print Statement">
                              <Printer size={13} style={{ color: '#555' }} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 cursor-pointer" title="Delete Payment">
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
                  {['Voucher No', 'Farmer', 'Reason', 'Amount', 'Payment Period', 'From Date', 'To Date', 'Entry Date', 'Status', ''].map(col => (
                    <th key={col} className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#AAAAAA' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F7F7F7' }}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 rounded-full animate-pulse" style={{ background: '#F0F0F0', width: '60px' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredDeductions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16">
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
                    const fromDateStr = d.fromDate ? format(new Date(d.fromDate), 'dd/MM/yyyy') : '—';
                    const toDateStr = d.toDate ? format(new Date(d.toDate), 'dd/MM/yyyy') : '—';
                    const entryDateStr = d.entryDate ? format(new Date(d.entryDate), 'dd/MM/yyyy') : d.deductionDate ? format(new Date(d.deductionDate), 'dd/MM/yyyy') : '—';
                    
                    const fromDateObj = d.fromDate ? new Date(d.fromDate) : new Date();
                    const toDateObj = d.toDate ? new Date(d.toDate) : new Date();
                    const paymentPeriodStr = `${format(fromDateObj, 'dd MMM')} → ${format(toDateObj, 'dd MMM yy')}`;

                    const isPaid = d.paymentId || d.paymentStatus === 'paid';

                    return (
                      <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: '1px solid #F7F7F7' }} className="group hover:bg-[#FAFAFA] transition-colors text-[13px]">
                        <td className="px-6 py-4 font-mono font-bold text-slate-600">{d.voucherNo || '—'}</td>
                        <td className="px-6 py-4">
                          <div className="text-[14px] font-semibold text-[#111111]">{d.farmerName}</div>
                          <div className="text-[11px] font-mono text-[#AAAAAA]">{d.farmerId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="capitalize text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100">
                            {d.reason.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[15px] font-bold text-red-500">₹{d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 font-semibold text-slate-700">{paymentPeriodStr}</td>
                        <td className="px-6 py-4 text-slate-500">{fromDateStr}</td>
                        <td className="px-6 py-4 text-slate-500">{toDateStr}</td>
                        <td className="px-6 py-4 text-slate-500">{entryDateStr}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setPrintDeduction(d)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-slate-200 cursor-pointer bg-white" title="Print Slip">
                              <Printer size={13} style={{ color: '#555' }} />
                            </button>
                            <button
                              onClick={() => handleDeleteDeduction(d.id)}
                              disabled={isPaid}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                                isPaid ? 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 border border-red-200'
                              }`}
                              title={isPaid ? "Cannot delete paid deduction" : "Delete"}
                            >
                              <Trash2 size={13} className={isPaid ? "text-gray-300" : "text-red-500"} />
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

      {/* Redesigned Multi-Step Payment Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto"
              style={{ background: '#FFFFFF', border: '1px solid #ECECEC', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center justify-between mb-5 border-b pb-3">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111111]">Record Farmer Payment</h3>
                  <p className="text-[12px] text-gray-400 font-medium">Step {step} of 2</p>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>

              {step === 1 ? (
                /* Step 1: Selection */
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#777777] uppercase tracking-wider mb-2 block">Select Farmer</label>
                    <input
                      value={formFarmerId}
                      onChange={e => setFormFarmerId(e.target.value)}
                      list="pay-farmer-list"
                      autoComplete="off"
                      placeholder="Enter Farmer ID or Search..."
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none transition-all uppercase"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                    <datalist id="pay-farmer-list">
                      {farmers.map((f: Farmer) => (
                        <option key={f.id} value={f.id}>{f.name} - {f.village} ({f.animalType})</option>
                      ))}
                    </datalist>

                    <div className="mt-2 min-h-6">
                      {selectedFarmer ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-green-600">{selectedFarmer.name}</span>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-100 rounded">
                            {selectedFarmer.animalType}
                          </span>
                          <span className="text-[12px] text-gray-500">· Village: {selectedFarmer.village}</span>
                        </div>
                      ) : formFarmerId ? (
                        <span className="text-[12px] text-red-500">Farmer not found in records.</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[#777777] uppercase tracking-wider mb-2 block">From Date</label>
                      <input
                        type="date"
                        value={formFromDate}
                        onChange={e => setFormFromDate(e.target.value)}
                        className="w-full px-4 py-3 text-[13px] rounded-xl outline-none"
                        style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#777777] uppercase tracking-wider mb-2 block">To Date</label>
                      <input
                        type="date"
                        value={formToDate}
                        onChange={e => setFormToDate(e.target.value)}
                        className="w-full px-4 py-3 text-[13px] rounded-xl outline-none"
                        style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCalculateSummary}
                    disabled={!selectedFarmer || loadingSummary}
                    className="w-full py-3.5 mt-2 rounded-xl text-[14px] font-bold text-white cursor-pointer flex justify-center items-center gap-2"
                    style={{
                      background: selectedFarmer ? '#FF6B00' : '#CCCCCC',
                      boxShadow: selectedFarmer ? '0 4px 14px rgba(255,107,0,0.35)' : 'none'
                    }}
                  >
                    {loadingSummary ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" /> Calculating aggregates...
                      </>
                    ) : 'Next: Calculate Summary'}
                  </button>
                </div>
              ) : (
                /* Step 2: Live calculations and save */
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Farmer Account</div>
                      <div className="text-[14px] font-bold text-slate-800">{selectedFarmer?.name} ({selectedFarmer?.id})</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Period</div>
                      <div className="text-[12px] font-semibold text-slate-700">
                        {format(new Date(formFromDate), 'dd MMM')} to {format(new Date(formToDate), 'dd MMM yy')}
                      </div>
                    </div>
                  </div>

                  {/* Warning banner for double-payment check */}
                  {summaryData?.paidCols.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div className="text-[11px] text-amber-800 leading-normal">
                        <strong>Already Paid Excluded:</strong> {summaryData.paidCols.length} collections in this period have already been paid and are skipped from totals.
                      </div>
                    </div>
                  )}

                  {/* Aggregates Section */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border rounded-xl bg-[#FAFAFA]">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Collections</div>
                      <div className="text-[16px] font-bold text-slate-800 mt-1">{summaryData?.totalDays} Days / {summaryData?.totalLiters.toFixed(1)} L</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">Cow: {summaryData?.cowLiters.toFixed(1)}L | Buff: {summaryData?.buffaloLiters.toFixed(1)}L</div>
                    </div>
                    <div className="p-3 border rounded-xl bg-[#FAFAFA]">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Weighted Average</div>
                      <div className="text-[16px] font-bold text-slate-800 mt-1">FAT: {summaryData?.avgFat.toFixed(1)}%</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">SNF: {summaryData?.avgSnf.toFixed(1)}%</div>
                    </div>
                  </div>

                  {/* Manual Deductions Summary */}
                  {summaryData?.rangeDeductions.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl p-3 bg-red-50/20">
                      <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Manual Deductions in range</div>
                      <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                        {summaryData.rangeDeductions.map((d: any) => (
                          <div key={d.id} className="flex justify-between items-center text-[12px] font-medium">
                            <span className="text-slate-600 truncate max-w-[200px]">
                              • <span className="capitalize">{d.reason.replace('_', ' ')}</span> {d.notes ? `(${d.notes})` : ''}
                            </span>
                            <span className="text-red-500 font-semibold font-mono">₹{d.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 bg-slate-50 p-2.5 rounded-xl border border-dashed text-center">
                      No manual deductions registered in this period.
                    </div>
                  )}

                  {/* Ledger Starting Balances */}
                  <div className="grid grid-cols-2 gap-3 text-[12px] bg-slate-50 p-3 rounded-2xl border">
                    <div>
                      <span className="text-slate-500">Prev period A/C balance:</span>
                      <div className="font-bold mt-0.5 text-slate-700">₹{summaryData?.previousBalance.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Outstanding Advances:</span>
                      <div className="font-bold mt-0.5 text-amber-600">₹{summaryData?.outstandingAdvance.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Inputs and Live Net Math */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Add Bonus (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formBonus}
                          onChange={e => setFormBonus(e.target.value)}
                          className="w-full px-3 py-2 text-[13px] rounded-lg outline-none border"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Recover Advance (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          max={summaryData?.outstandingAdvance}
                          value={formAdvanceRecovery}
                          onChange={e => setFormAdvanceRecovery(e.target.value)}
                          className="w-full px-3 py-2 text-[13px] rounded-lg outline-none border"
                          placeholder="0.00"
                        />
                        {summaryData?.outstandingAdvance > 0 && (
                          <span className="text-[9px] text-[#999] mt-0.5 block">Max recovery: ₹{summaryData?.outstandingAdvance}</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl mt-1 space-y-2 text-[13px] font-medium text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Milk value:</span>
                        <span>₹{summaryData?.milkAmount.toFixed(2)}</span>
                      </div>
                      {bonusVal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bonus:</span>
                          <span className="text-green-600">+₹{bonusVal.toFixed(2)}</span>
                        </div>
                      )}
                      {summaryData?.previousBalance > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Prev Balance:</span>
                          <span className="text-green-600">+₹{summaryData?.previousBalance.toFixed(2)}</span>
                        </div>
                      )}
                      {summaryData?.deductionsAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Period Deductions:</span>
                          <span className="text-red-500">-₹{summaryData?.deductionsAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {recoveryVal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Advance Recovery:</span>
                          <span className="text-red-500">-₹{recoveryVal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-bold text-[16px] text-emerald-800">
                        <span>Net Paid:</span>
                        <span>₹{liveNetPayable.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-2 block">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(methodMeta) as [string, typeof methodMeta[string]][]).map(([key, m]) => {
                        const Icon = m.icon;
                        return (
                          <button key={key} type="button" onClick={() => setPaymentMethod(key as any)}
                            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer"
                            style={{
                              background: paymentMethod === key ? m.bg : '#F7F7F7',
                              borderColor: paymentMethod === key ? m.color : '#ECECEC',
                              color: paymentMethod === key ? m.color : '#777',
                            }}>
                            <Icon size={14} /> {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Notes (optional)</label>
                    <input
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                      placeholder="Enter notes..."
                    />
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">Payment Date</label>
                    <input
                      type="date"
                      value={formPaymentDate}
                      onChange={e => setFormPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
                      style={{ background: '#FFFFFF', color: '#111111' }}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#ECECEC] text-[#555] cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSavePayment}
                      disabled={isSubmitting || liveNetPayable <= 0}
                      className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white cursor-pointer"
                      style={{
                        background: liveNetPayable > 0 ? '#22C55E' : '#CCCCCC',
                        boxShadow: liveNetPayable > 0 ? '0 4px 14px rgba(34,197,94,0.35)' : 'none'
                      }}
                    >
                      {isSubmitting ? 'Saving...' : 'Save Payment'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Receipt Modal */}
      <AnimatePresence>
        {printPayment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setPrintPayment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xl rounded-3xl p-6 bg-white border border-[#ECECEC] shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b pb-3 mb-5">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111111]">Print Payment Receipt</h3>
                  <p className="text-[12px] text-gray-400">Choose layout format to print statement</p>
                </div>
                <button onClick={() => setPrintPayment(null)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>

              {/* Action Print Buttons */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handlePrintThermal()}
                  className="flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-[#FF6B00] hover:bg-[#FFF8F3] transition-all cursor-pointer font-bold text-[#FF6B00] text-[14px]"
                >
                  <Printer size={18} /> Print Thermal (3-inch)
                </button>
                <button
                  onClick={() => handlePrintA4()}
                  className="flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-slate-700 hover:bg-slate-50 transition-all cursor-pointer font-bold text-slate-700 text-[14px]"
                >
                  <Printer size={18} /> Print A4 Statement
                </button>
              </div>

              {/* Previews containers */}
              <div className="border border-slate-100 rounded-2xl bg-slate-50 p-4 max-h-[50vh] overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Statement Preview</div>
                <div className="flex justify-center border bg-white p-3 rounded-lg overflow-x-auto shadow-sm">
                  {/* Thermal wrapper preview */}
                  <PaymentThermalReceipt
                    payment={printPayment}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                    farmerName={printPayment.farmerName}
                  />
                </div>
              </div>

              {/* Hidden Prints Area */}
              <div style={{ display: 'none' }}>
                <div ref={printThermalRef}>
                  <PaymentThermalReceipt
                    payment={printPayment}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                    farmerName={printPayment.farmerName}
                  />
                </div>
                <div ref={printA4Ref}>
                  <PaymentA4Receipt
                    payment={printPayment}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                    farmerName={printPayment.farmerName}
                    ownerName={generalSettings.ownerName || ''}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Deduction Receipt Modal */}
      <AnimatePresence>
        {printDeduction && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setPrintDeduction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xl rounded-3xl p-6 bg-white border border-[#ECECEC] shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b pb-3 mb-5">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111111]">Print Deduction Slip</h3>
                  <p className="text-[12px] text-gray-400">Choose layout format to print deduction slip</p>
                </div>
                <button onClick={() => setPrintDeduction(null)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 cursor-pointer">
                  <X size={15} style={{ color: '#555' }} />
                </button>
              </div>

              {/* Action Print Buttons */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => handlePrintDedThermal()}
                  className="flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-[#FF6B00] hover:bg-[#FFF8F3] transition-all cursor-pointer font-bold text-[#FF6B00] text-[14px]"
                >
                  <Printer size={18} /> Print Thermal (3-inch)
                </button>
                <button
                  onClick={() => handlePrintDedA4()}
                  className="flex items-center justify-center gap-2.5 py-4 rounded-2xl border-2 border-dashed border-slate-700 hover:bg-slate-50 transition-all cursor-pointer font-bold text-slate-700 text-[14px]"
                >
                  <Printer size={18} /> Print A4 Receipt
                </button>
              </div>

              {/* Previews containers */}
              <div className="border border-slate-100 rounded-2xl bg-slate-50 p-4 max-h-[50vh] overflow-y-auto">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Slip Preview</div>
                <div className="flex justify-center border bg-white p-3 rounded-lg overflow-x-auto shadow-sm">
                  <DeductionThermalReceipt
                    deduction={printDeduction}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                  />
                </div>
              </div>

              {/* Hidden Prints Area */}
              <div style={{ display: 'none' }}>
                <div ref={printDedThermalRef}>
                  <DeductionThermalReceipt
                    deduction={printDeduction}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                  />
                </div>
                <div ref={printDedA4Ref}>
                  <DeductionA4Receipt
                    deduction={printDeduction}
                    centerName={generalSettings.centerName || `${profile?.name || 'DoodhOS'}'s Center`}
                    centerAddress={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                    ownerName={generalSettings.ownerName || ''}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Record Deduction Modal */}
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
                    onChange={e => setDedReason(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                  >
                    {DEDUCTION_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label} ({r.type})</option>
                    ))}
                  </select>
                </div>

                {/* Period Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">From Date</label>
                    <input
                      type="date"
                      value={dedFromDate}
                      onChange={e => setDedFromDate(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">To Date</label>
                    <input
                      type="date"
                      value={dedToDate}
                      onChange={e => setDedToDate(e.target.value)}
                      className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                      style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    />
                  </div>
                </div>

                {/* Entry Date */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Entry Date</label>
                  <input
                    type="date"
                    value={dedEntryDate}
                    onChange={e => setDedEntryDate(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Notes (optional)</label>
                  <input
                    value={dedNotes}
                    onChange={e => setDedNotes(e.target.value)}
                    className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                    style={{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }}
                    placeholder="e.g. transport cost"
                  />
                </div>

                {/* Overlap Warning */}
                {overlapWarning && (
                  <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px] leading-relaxed">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>{overlapWarning}</span>
                  </div>
                )}

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

const PaymentThermalReceipt = forwardRef<HTMLDivElement, { payment: Payment; centerName: string; centerAddress: string; centerPhone: string; farmerName: string }>(({ payment, centerName, centerAddress, centerPhone, farmerName }, ref) => {
  const pDate = payment.paymentDate ? ((payment.paymentDate as any).toDate ? (payment.paymentDate as any).toDate() : new Date(payment.paymentDate as any)) : new Date();
  const fDate = payment.fromDate ? ((payment.fromDate as any).toDate ? (payment.fromDate as any).toDate() : new Date(payment.fromDate as any)) : new Date();
  const tDate = payment.toDate ? ((payment.toDate as any).toDate ? (payment.toDate as any).toDate() : new Date(payment.toDate as any)) : new Date();

  return (
    <div ref={ref} className="w-[80mm] p-4 bg-white text-black font-mono text-[12px] leading-relaxed select-none">
      <div className="text-center font-bold text-[14px] uppercase">{centerName}</div>
      {centerAddress && <div className="text-center text-[10px]">{centerAddress}</div>}
      {centerPhone && <div className="text-center text-[10px] mb-2">Ph: {centerPhone}</div>}
      <div className="border-b border-dashed border-black my-2" />
      <div className="text-center font-bold uppercase mb-2">Payment Receipt</div>
      <div><strong>Farmer:</strong> {farmerName} ({payment.farmerId})</div>
      <div><strong>Period:</strong> {format(fDate, 'dd/MM/yyyy')} - {format(tDate, 'dd/MM/yyyy')}</div>
      <div><strong>Date:</strong> {format(pDate, 'dd/MM/yyyy hh:mm a')}</div>
      <div className="border-b border-dashed border-black my-2" />
      <div className="grid grid-cols-2 gap-y-0.5">
        <div>Total Days:</div><div className="text-right">{payment.totalDays || 0}</div>
        <div>Total Liters:</div><div className="text-right">{(payment.totalLiters || 0).toFixed(1)} L</div>
        <div className="text-[10px] text-gray-500 pl-2">Cow Liters:</div><div className="text-right text-[10px] text-gray-500">{(payment.cowLiters || 0).toFixed(1)} L</div>
        <div className="text-[10px] text-gray-500 pl-2">Buffalo Liters:</div><div className="text-right text-[10px] text-gray-500">{(payment.buffaloLiters || 0).toFixed(1)} L</div>
        <div>Avg FAT / SNF:</div><div className="text-right">{(payment.avgFat || 0).toFixed(1)}% / {(payment.avgSnf || 0).toFixed(1)}%</div>
      </div>
      <div className="border-b border-dashed border-black my-2" />
      <div className="grid grid-cols-2 gap-y-1">
        <div>Milk Amount:</div><div className="text-right">₹{(payment.milkAmount || 0).toFixed(2)}</div>
        {(payment.bonus || 0) > 0 && (
          <><div>Bonus (+):</div><div className="text-right">₹{parseFloat(payment.bonus as any).toFixed(2)}</div></>
        )}
        {(payment.previousBalance || 0) > 0 && (
          <><div>Prev Balance (+):</div><div className="text-right">₹{parseFloat(payment.previousBalance as any).toFixed(2)}</div></>
        )}
        {(payment.deductionsAmount || 0) > 0 && (
          <><div>Deductions (-):</div><div className="text-right">₹{parseFloat(payment.deductionsAmount as any).toFixed(2)}</div></>
        )}
        {(payment.advanceRecovery || 0) > 0 && (
          <><div>Adv Recovery (-):</div><div className="text-right">₹{parseFloat(payment.advanceRecovery as any).toFixed(2)}</div></>
        )}
      </div>
      <div className="border-b border-dashed border-black my-2" />
      <div className="grid grid-cols-2 font-bold text-[13px]">
        <div>Net Paid:</div><div className="text-right">₹{(payment.amount || 0).toFixed(2)}</div>
      </div>
      <div><strong>Method:</strong> <span className="uppercase">{payment.paymentMethod}</span></div>
      {payment.notes && <div className="text-[10px] mt-1 italic">Note: {payment.notes}</div>}
      <div className="border-b border-dashed border-black my-2" />
      <div className="text-center text-[10px] mt-4 font-bold">Thank You! DoodhOS</div>
    </div>
  );
});
PaymentThermalReceipt.displayName = 'PaymentThermalReceipt';

const PaymentA4Receipt = forwardRef<HTMLDivElement, { payment: Payment; centerName: string; centerAddress: string; centerPhone: string; farmerName: string; ownerName: string }>(({ payment, centerName, centerAddress, centerPhone, farmerName, ownerName }, ref) => {
  const pDate = payment.paymentDate ? ((payment.paymentDate as any).toDate ? (payment.paymentDate as any).toDate() : new Date(payment.paymentDate as any)) : new Date();
  const fDate = payment.fromDate ? ((payment.fromDate as any).toDate ? (payment.fromDate as any).toDate() : new Date(payment.fromDate as any)) : new Date();
  const tDate = payment.toDate ? ((payment.toDate as any).toDate ? (payment.toDate as any).toDate() : new Date(payment.toDate as any)) : new Date();

  return (
    <div ref={ref} className="w-[210mm] min-h-[297mm] p-10 bg-white text-black text-[13px] leading-relaxed relative font-sans select-none">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-8">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-800">{centerName}</h1>
          {centerAddress && <p className="text-slate-500 mt-1">{centerAddress}</p>}
          {centerPhone && <p className="text-slate-500">Ph: {centerPhone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase text-slate-400 tracking-wider">Payment Statement</h2>
          <p className="text-slate-500 mt-1">Date: {format(pDate, 'dd MMM yyyy')}</p>
          <p className="text-slate-500">Ref ID: {payment.id}</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-10 mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">Farmer Details</h3>
          <p className="font-bold text-slate-800 text-[15px]">{farmerName}</p>
          <p className="text-slate-600 font-mono mt-0.5">Farmer ID: {payment.farmerId}</p>
        </div>
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">Statement details</h3>
          <p className="text-slate-700"><strong>Billing Period:</strong> {format(fDate, 'dd MMM yyyy')} to {format(tDate, 'dd MMM yyyy')}</p>
          <p className="text-slate-700"><strong>Payment Method:</strong> <span className="uppercase font-semibold">{payment.paymentMethod}</span></p>
        </div>
      </div>

      {/* Collections Aggregates Table */}
      <div className="mb-8">
        <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-3">Milk Collection Summary</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider font-bold">
              <th className="px-4 py-3 rounded-l-lg">Total Days</th>
              <th className="px-4 py-3">Total Liters</th>
              <th className="px-4 py-3">Cow Liters</th>
              <th className="px-4 py-3">Buff Liters</th>
              <th className="px-4 py-3">Avg FAT</th>
              <th className="px-4 py-3">Avg SNF</th>
              <th className="px-4 py-3 rounded-r-lg text-right">Milk Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-semibold">{payment.totalDays || 0}</td>
              <td className="px-4 py-3 font-semibold">{(payment.totalLiters || 0).toFixed(1)} L</td>
              <td className="px-4 py-3 text-slate-600">{(payment.cowLiters || 0).toFixed(1)} L</td>
              <td className="px-4 py-3 text-slate-600">{(payment.buffaloLiters || 0).toFixed(1)} L</td>
              <td className="px-4 py-3 text-slate-600">{(payment.avgFat || 0).toFixed(1)}%</td>
              <td className="px-4 py-3 text-slate-600">{(payment.avgSnf || 0).toFixed(1)}%</td>
              <td className="px-4 py-3 font-bold text-right">₹{(payment.milkAmount || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Reconciliation Table */}
      <div className="grid grid-cols-5 gap-8 mb-16">
        <div className="col-span-3 border border-slate-100 rounded-2xl p-5 bg-slate-50/30">
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-3">Reconciliation Notes</h3>
          <ul className="space-y-1 text-slate-600 text-[12px]">
            <li>• Earnings are calculated based on registered rates in center rate charts.</li>
            <li>• Deductions include spoiled milk charges, rate difference adjustments, or feed sales.</li>
            <li>• Advances are recovered from the net payable amount as configured.</li>
            {payment.notes && <li className="mt-3 text-slate-800 font-medium">Note: {payment.notes}</li>}
          </ul>
        </div>
        <div className="col-span-2 border border-slate-200 rounded-2xl p-5 shadow-sm bg-white space-y-3">
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100 pb-2">Financial Breakdown</h3>
          <div className="flex justify-between text-slate-600">
            <span>Milk Amount:</span>
            <span className="font-semibold text-slate-800">₹{(payment.milkAmount || 0).toFixed(2)}</span>
          </div>
          {(payment.bonus || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Bonus Amount (+):</span>
              <span className="font-semibold text-green-600">₹{parseFloat(payment.bonus as any).toFixed(2)}</span>
            </div>
          )}
          {(payment.previousBalance || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Previous Balance (+):</span>
              <span className="font-semibold text-green-600">₹{parseFloat(payment.previousBalance as any).toFixed(2)}</span>
            </div>
          )}
          {(payment.deductionsAmount || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Deductions Amount (-):</span>
              <span className="font-semibold text-red-500">₹{parseFloat(payment.deductionsAmount as any).toFixed(2)}</span>
            </div>
          )}
          {(payment.advanceRecovery || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Advance Recovery (-):</span>
              <span className="font-semibold text-red-500">₹{parseFloat(payment.advanceRecovery as any).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-[15px] text-slate-900">
            <span>Net Paid Amount:</span>
            <span className="text-emerald-600 font-bold">₹{(payment.amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="absolute bottom-16 left-10 right-10 flex justify-between">
        <div className="text-center w-40 border-t border-slate-300 pt-2">
          <p className="font-semibold text-slate-700 text-[12px]">{farmerName}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Farmer Signature</p>
        </div>
        <div className="text-center w-40 border-t border-slate-300 pt-2">
          <p className="font-semibold text-slate-700 text-[12px]">{ownerName || 'Operator'}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
});
PaymentA4Receipt.displayName = 'PaymentA4Receipt';

export const DeductionThermalReceipt = forwardRef<HTMLDivElement, { deduction: any; centerName: string; centerAddress: string; centerPhone: string }>(({ deduction, centerName, centerAddress, centerPhone }, ref) => {
  if (!deduction) return null;
  const fromDate = deduction.fromDate ? new Date(deduction.fromDate) : new Date();
  const toDate = deduction.toDate ? new Date(deduction.toDate) : new Date();
  const entryDate = deduction.entryDate ? new Date(deduction.entryDate) : new Date();
  const period = `${format(fromDate, 'dd/MM/yyyy')} - ${format(toDate, 'yyyy-MM-dd')}`;

  return (
    <div ref={ref} className="w-[80mm] p-4 bg-white text-black font-mono text-[12px] leading-relaxed select-none">
      <div className="text-center font-bold text-[14px] uppercase">{centerName}</div>
      {centerAddress && <div className="text-center text-[10px]">{centerAddress}</div>}
      {centerPhone && <div className="text-center text-[10px] mb-2 font-mono">Ph: {centerPhone}</div>}
      <div className="border-b border-dashed border-black my-2" />
      <div className="text-center font-bold uppercase mb-2">Deduction Slip</div>
      <div><strong>Voucher No:</strong> {deduction.voucherNo || '—'}</div>
      <div><strong>Farmer:</strong> {deduction.farmerName} ({deduction.farmerId})</div>
      <div><strong>Reason:</strong> <span className="capitalize">{deduction.reason?.replace(/_/g, ' ')}</span></div>
      <div><strong>Period:</strong> {format(fromDate, 'dd MMM yy')} → {format(toDate, 'dd MMM yy')}</div>
      <div><strong>Entry Date:</strong> {format(entryDate, 'dd/MM/yyyy')}</div>
      <div className="border-b border-dashed border-black my-2" />
      <div className="grid grid-cols-2 font-bold text-[13px] my-2">
        <div>Amount:</div><div className="text-right">₹{deduction.amount?.toFixed(2)}</div>
      </div>
      {deduction.notes && <div className="text-[10px] mt-2 italic">Note: {deduction.notes}</div>}
      <div className="border-b border-dashed border-black my-2" />
      <div className="text-center text-[10px] mt-4 font-bold">Thank You! DoodhOS</div>
    </div>
  );
});
DeductionThermalReceipt.displayName = 'DeductionThermalReceipt';

export const DeductionA4Receipt = forwardRef<HTMLDivElement, { deduction: any; centerName: string; centerAddress: string; centerPhone: string; ownerName: string }>(({ deduction, centerName, centerAddress, centerPhone, ownerName }, ref) => {
  if (!deduction) return null;
  const fromDate = deduction.fromDate ? new Date(deduction.fromDate) : new Date();
  const toDate = deduction.toDate ? new Date(deduction.toDate) : new Date();
  const entryDate = deduction.entryDate ? new Date(deduction.entryDate) : new Date();

  return (
    <div ref={ref} className="w-[210mm] p-10 bg-white text-black text-[13px] leading-relaxed relative font-sans select-none border border-slate-200 rounded-lg">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-800">{centerName}</h1>
          {centerAddress && <p className="text-slate-500 mt-1">{centerAddress}</p>}
          {centerPhone && <p className="text-slate-500 font-mono">Ph: {centerPhone}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase text-red-500 tracking-wider">Deduction Slip</h2>
          <p className="text-slate-500 mt-1 font-mono">Voucher No: {deduction.voucherNo || '—'}</p>
          <p className="text-slate-500">Date: {format(entryDate, 'dd MMM yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">Farmer Info</h3>
          <p className="font-bold text-slate-800 text-[15px]">{deduction.farmerName}</p>
          <p className="text-slate-600 font-mono mt-0.5">Farmer ID: {deduction.farmerId}</p>
        </div>
        <div>
          <h3 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">Deduction Period</h3>
          <p className="text-slate-700"><strong>From:</strong> {format(fromDate, 'dd MMM yyyy')}</p>
          <p className="text-slate-700"><strong>To:</strong> {format(toDate, 'dd MMM yyyy')}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider font-bold">
            <th className="px-4 py-3 rounded-l-lg">Deduction Category</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3 rounded-r-lg text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 font-medium">
            <td className="px-4 py-4 capitalize text-slate-700">{deduction.deductionType || 'Penalty'}</td>
            <td className="px-4 py-4 capitalize text-slate-700">{deduction.reason?.replace(/_/g, ' ')}</td>
            <td className="px-4 py-4 text-slate-500 italic">{deduction.notes || '—'}</td>
            <td className="px-4 py-4 text-right font-bold text-red-500 text-[16px]">₹{deduction.amount?.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-between items-end mt-12">
        <div className="text-center w-40 border-t border-slate-300 pt-2">
          <p className="font-semibold text-slate-700 text-[12px]">{deduction.farmerName}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Farmer Signature</p>
        </div>
        <div className="text-center w-40 border-t border-slate-300 pt-2">
          <p className="font-semibold text-slate-700 text-[12px]">{ownerName || 'Operator'}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
});
DeductionA4Receipt.displayName = 'DeductionA4Receipt';
