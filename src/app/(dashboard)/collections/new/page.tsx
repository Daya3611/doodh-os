'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { collectionService } from '@/services/collectionService';
import { farmerService } from '@/services/farmerService';
import { rateChartService } from '@/services/rateChartService';
import { Farmer, Collection } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Printer, AlertTriangle, Edit3, RefreshCw, Layers, X, ShieldAlert, Eye, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { ThermalReceipt } from '@/components/receipt/ThermalReceipt';
import { A4Receipt } from '@/components/receipt/A4Receipt';
import { printerService } from '@/services/printerService';
import { settingsService, GeneralSettings } from '@/services/settingsService';
import { PrinterSettingsFormData } from '@/types';

const schema = z.object({
  farmerId: z.string().min(1, 'Farmer ID required'),
  animalType: z.enum(['cow', 'buffalo']),
  shift: z.enum(['morning', 'evening']),
  liters: z.string().min(1, 'Required').refine(v => parseFloat(v) > 0, 'Must be > 0'),
  fat: z.string().min(1, 'Required').refine(v => parseFloat(v) > 0, 'Must be > 0'),
  snf: z.string().min(1, 'Required').refine(v => parseFloat(v) > 0, 'Must be > 0'),
  clr: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function useFieldRefs() {
  const refs: Record<string, React.RefObject<HTMLInputElement | null>> = {
    farmerId: useRef<HTMLInputElement>(null),
    liters: useRef<HTMLInputElement>(null),
    fat: useRef<HTMLInputElement>(null),
    snf: useRef<HTMLInputElement>(null),
  };
  return refs;
}

export default function NewCollectionPage() {
  const { profile } = useAuthStore();
  const centerId = profile?.centerId;
  const userRole = (profile?.role || 'STAFF') as string;
  const canOverride = userRole === 'MASTER_ADMIN' || userRole === 'OWNER' || userRole === 'admin' || userRole === 'manager';
  const refs = useFieldRefs();

  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [currentFarmer, setCurrentFarmer] = useState<Farmer | null>(null);
  const [rate, setRate] = useState(0);
  const [matchedFat, setMatchedFat] = useState<number | null>(null);
  const [matchedSnf, setMatchedSnf] = useState<number | null>(null);
  const [isNearestApplied, setIsNearestApplied] = useState(false);
  const [recentCollections, setRecentCollections] = useState<Collection[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedCollection, setLastSavedCollection] = useState<Collection | null>(null);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettingsFormData | null>(null);
  const [generalSettings, setGeneralSettings] = useState<Partial<GeneralSettings>>({});

  // Duplicate Check Engine States
  const [existingCollection, setExistingCollection] = useState<Collection | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showOverrideConfirmModal, setShowOverrideConfirmModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const printSpecificCollection = (c: Collection) => {
    setLastSavedCollection(c);
    setTimeout(() => {
      handlePrint();
    }, 100);
  };

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      farmerId: '',
      animalType: 'cow',
      shift: new Date().getHours() < 12 ? 'morning' : 'evening',
      liters: '', fat: '', snf: '',
    },
  });

  const values = watch();
  const numFat = parseFloat(values.fat) || 0;
  const numSnf = parseFloat(values.snf) || 0;
  const numLiters = parseFloat(values.liters) || 0;
  const totalAmount = rate * numLiters;
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (centerId) {
      farmerService.getAll(centerId).then(setFarmers);
      loadRecent();
      printerService.getSettings(centerId).then(data => {
        setPrinterSettings(data || printerService.getDefaultSettings());
      });
      settingsService.getSettings(centerId).then(data => {
        setGeneralSettings(data || {});
      });
    }
  }, [centerId]);

  const loadRecent = async () => {
    if (!centerId) return;
    const data = await collectionService.getToday(centerId);
    setRecentCollections(data.slice(0, 6));
  };

  // Farmer lookup by ID
  useEffect(() => {
    if (values.farmerId) {
      const found = farmers.find(
        f => f.id.toLowerCase() === values.farmerId.toLowerCase()
      );
      setCurrentFarmer(found || null);
      if (found && values.animalType !== found.animalType) {
        setValue('animalType', found.animalType as 'cow' | 'buffalo');
      }
    } else {
      setCurrentFarmer(null);
    }
  }, [values.farmerId, farmers]);

  // Live Duplicate Checker
  const checkDuplicate = useCallback(async () => {
    if (centerId && values.farmerId && values.animalType) {
      const existing = await collectionService.checkDuplicateCollection(
        centerId,
        values.farmerId.trim(),
        todayDateStr,
        values.shift,
        values.animalType
      );
      setExistingCollection(existing);
    } else {
      setExistingCollection(null);
    }
  }, [centerId, values.farmerId, values.shift, values.animalType, todayDateStr]);

  useEffect(() => {
    checkDuplicate();
  }, [checkDuplicate]);

  // Live rate lookup
  useEffect(() => {
    const fetchRate = async () => {
      if (centerId && numFat > 0 && numSnf > 0) {
        const res = await rateChartService.lookupRate(centerId, values.animalType, numFat, numSnf);
        setRate(res.rate || 0);
        setMatchedFat(res.matchedFat);
        setMatchedSnf(res.matchedSnf);
        setIsNearestApplied(res.isNearestApplied);
      } else {
        setRate(0);
        setMatchedFat(null);
        setMatchedSnf(null);
        setIsNearestApplied(false);
      }
    };
    fetchRate();
  }, [centerId, values.animalType, numFat, numSnf]);

  // Keyboard Navigation & Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent, nextField: string | null) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextField && refs[nextField]?.current) {
        refs[nextField].current?.focus();
        refs[nextField].current?.select();
      }
    }
  };

  // Global Keyboard listener for F2 (Edit), F3 (Override), Esc (Cancel)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showDuplicateModal) {
        if (e.key === 'F2') {
          e.preventDefault();
          handleEditExisting();
        } else if (e.key === 'F3') {
          e.preventDefault();
          if (canOverride) handleTriggerOverride();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowDuplicateModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showDuplicateModal, canOverride, existingCollection]);

  // Action Handlers for Duplicate Resolution
  const handleEditExisting = () => {
    if (!existingCollection) return;
    setValue('farmerId', existingCollection.farmerId);
    setValue('animalType', existingCollection.animalType);
    setValue('shift', existingCollection.shift);
    setValue('liters', existingCollection.liters.toString());
    setValue('fat', (existingCollection.enteredFat ?? existingCollection.fat).toString());
    setValue('snf', (existingCollection.enteredSnf ?? existingCollection.snf).toString());
    setShowDuplicateModal(false);
    toast.info(`Loaded ${existingCollection.farmerName}'s record for editing.`);
    refs.liters.current?.focus();
  };

  const handleTriggerOverride = () => {
    if (!canOverride) {
      toast.error('Permission denied: Only Managers/Admins can override existing collections');
      return;
    }
    setShowDuplicateModal(false);
    setShowOverrideConfirmModal(true);
  };

  const handleExecuteOverride = async () => {
    if (!centerId || !existingCollection || !pendingFormData || !profile) return;
    setIsSubmitting(true);
    try {
      const newData = {
        farmerId: currentFarmer?.id || pendingFormData.farmerId,
        farmerName: currentFarmer?.name || 'Unknown',
        animalType: pendingFormData.animalType,
        shift: pendingFormData.shift,
        liters: parseFloat(pendingFormData.liters),
        fat: isNearestApplied && matchedFat !== null ? matchedFat : parseFloat(pendingFormData.fat),
        snf: isNearestApplied && matchedSnf !== null ? matchedSnf : parseFloat(pendingFormData.snf),
        clr: parseFloat(pendingFormData.clr || '0') || undefined,
        rate,
        totalAmount,
        enteredFat: parseFloat(pendingFormData.fat),
        enteredSnf: parseFloat(pendingFormData.snf),
        matchedFat: matchedFat ?? undefined,
        matchedSnf: matchedSnf ?? undefined,
        isNearestRateApplied: isNearestApplied,
      };

      await collectionService.overrideCollection(
        centerId,
        existingCollection.id,
        newData,
        { userId: profile.uid || 'unknown', userName: profile.name || 'Operator', userRole }
      );

      toast.success(`Overridden existing collection for ${currentFarmer?.name}`);
      setShowOverrideConfirmModal(false);
      setExistingCollection(null);
      setPendingFormData(null);
      resetFormAndFocus();
      loadRecent();
    } catch (err) {
      console.error('Failed to override collection:', err);
      toast.error('Failed to override collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!centerId || !existingCollection || !pendingFormData || !profile) return;
    setIsSubmitting(true);
    try {
      const addedLiters = parseFloat(pendingFormData.liters);
      const newFat = parseFloat(pendingFormData.fat);
      const newSnf = parseFloat(pendingFormData.snf);

      await collectionService.mergeCollection(
        centerId,
        existingCollection,
        addedLiters,
        newFat,
        newSnf,
        rate,
        totalAmount,
        { userId: profile.uid || 'unknown', userName: profile.name || 'Operator', userRole }
      );

      toast.success(`Merged ${addedLiters} L into ${existingCollection.farmerName}'s collection.`);
      setShowDuplicateModal(false);
      setExistingCollection(null);
      setPendingFormData(null);
      resetFormAndFocus();
      loadRecent();
    } catch (err) {
      console.error('Failed to merge collection:', err);
      toast.error('Failed to merge collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormAndFocus = () => {
    reset({
      farmerId: '',
      animalType: 'cow',
      shift: new Date().getHours() < 12 ? 'morning' : 'evening',
      liters: '',
      fat: '',
      snf: '',
      clr: '',
    });
    setCurrentFarmer(null);
    setRate(0);
    setMatchedFat(null);
    setMatchedSnf(null);
    setIsNearestApplied(false);
    setExistingCollection(null);
    setPendingFormData(null);

    // Force clear DOM input elements directly to ensure instant visual reset
    if (refs.farmerId.current) refs.farmerId.current.value = '';
    if (refs.liters.current) refs.liters.current.value = '';
    if (refs.fat.current) refs.fat.current.value = '';
    if (refs.snf.current) refs.snf.current.value = '';

    setTimeout(() => {
      refs.farmerId.current?.focus();
    }, 50);
  };

  const onSubmit = async (data: FormData) => {
    if (!centerId || !profile) { toast.error('Setup incomplete'); return; }
    if (!currentFarmer) { toast.error('Invalid Farmer ID'); refs.farmerId.current?.focus(); return; }
    if (rate <= 0) { toast.error('No rate found for this FAT/SNF. Check Rate Chart.'); return; }

    setPendingFormData(data);

    // If duplicate exists, interrupt and display warning modal!
    if (existingCollection) {
      setShowDuplicateModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveFat = isNearestApplied && matchedFat !== null ? matchedFat : numFat;
      const effectiveSnf = isNearestApplied && matchedSnf !== null ? matchedSnf : numSnf;

      const colData = {
        farmerId: currentFarmer.id,
        farmerName: currentFarmer.name,
        animalType: data.animalType,
        shift: data.shift,
        liters: numLiters,
        fat: effectiveFat,
        snf: effectiveSnf,
        clr: parseFloat(data.clr || '0') || undefined,
        rate,
        totalAmount,
        enteredFat: numFat,
        enteredSnf: numSnf,
        matchedFat: matchedFat ?? undefined,
        matchedSnf: matchedSnf ?? undefined,
        isNearestRateApplied: isNearestApplied,
      };

      const newId = await collectionService.add(centerId, colData, profile.name || 'Operator');
      const fullSavedRecord: Collection = { id: newId, ...colData, createdBy: profile.name || 'Operator', createdAt: new Date() as any };

      setSavedCount(prev => prev + 1);
      setLastSavedCollection(fullSavedRecord);
      toast.success(`Saved! ₹${totalAmount.toFixed(2)} credited to ${currentFarmer.name}`);

      if (printerSettings?.autoPrint) {
        printSpecificCollection(fullSavedRecord);
      }

      resetFormAndFocus();
      loadRecent();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const is = (err: any) => ({
    background: '#F7F7F7',
    border: err ? '1.5px solid #EF4444' : '1.5px solid #ECECEC',
    color: '#111111',
  });
  const fc = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#FF6B00'; e.target.select(); };
  const bc = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#ECECEC'; checkDuplicate(); };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Session counter */}
      {savedCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-green-50 border border-green-200 text-green-700 text-[13px] font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{savedCount} collection{savedCount > 1 ? 's' : ''} saved this session</span>
          </div>
          {lastSavedCollection && (
            <button onClick={() => printSpecificCollection(lastSavedCollection)} className="flex items-center gap-1 text-[12px] font-bold underline">
              <Printer size={13} /> Print Last Receipt
            </button>
          )}
        </motion.div>
      )}

      {/* INTELLIGENT DUPLICATE WARNING BANNER */}
      <AnimatePresence>
        {existingCollection && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="overflow-hidden rounded-3xl border shadow-lg"
            style={{ borderColor: '#F59E0B', boxShadow: '0 4px 24px rgba(245,158,11,0.18)' }}
          >
            {/* Top accent strip */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)' }} />

            <div className="p-5" style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 60%, #FFF7ED 100%)' }}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', color: '#fff' }}>
                    <AlertTriangle size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-black text-gray-900">Duplicate Collection Detected</span>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                        style={{ background: 'linear-gradient(90deg, #F59E0B, #EF4444)' }}>
                        {existingCollection.shift} • {existingCollection.animalType}
                      </span>
                    </div>
                    <p className="text-[12px] text-amber-800 font-medium">
                      A <b>{existingCollection.shift}</b> shift <b>{existingCollection.animalType}</b> milk collection has already been recorded for <b>{existingCollection.farmerName}</b> today.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExistingCollection(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-amber-200/60 text-amber-700 transition-all shrink-0 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Existing record stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                {[
                  { label: 'Farmer', value: `${existingCollection.farmerName} (${existingCollection.farmerId})` },
                  { label: 'Animal', value: existingCollection.animalType.toUpperCase() },
                  { label: 'Liters', value: `${existingCollection.liters} L` },
                  { label: 'Rate / L', value: `₹${existingCollection.rate.toFixed(2)}` },
                  { label: 'Total Amount', value: `₹${existingCollection.totalAmount.toFixed(2)}`, highlight: true },
                ].map(item => (
                  <div key={item.label} className="px-3 py-2.5 bg-white/80 rounded-2xl border border-amber-200/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 mb-0.5">{item.label}</div>
                    <div className={`text-[13px] font-black ${item.highlight ? 'text-orange-600' : 'text-gray-900'} truncate`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowViewModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-white/70 hover:bg-amber-100 text-amber-900 text-[12px] font-bold transition-all cursor-pointer"
                >
                  <Eye size={13} /> View Record
                </button>
                <button
                  type="button"
                  onClick={handleEditExisting}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[12px] font-bold transition-all cursor-pointer shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
                >
                  <Edit3 size={13} /> Edit Existing
                  <kbd className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] font-mono">F2</kbd>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMerge}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[12px] font-bold transition-all cursor-pointer shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  <Layers size={13} /> Merge Quantities
                </button>
                {canOverride && (
                  <button
                    type="button"
                    onClick={handleTriggerOverride}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[12px] font-bold transition-all cursor-pointer shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                  >
                    <RefreshCw size={13} /> Override Record
                    <kbd className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-md text-[10px] font-mono">F3</kbd>
                  </button>
                )}
                <div className="ml-auto text-[11px] text-amber-700/70 font-medium hidden sm:block">
                  Press <kbd className="px-1.5 py-0.5 bg-amber-200 rounded text-[10px] font-mono">Esc</kbd> to dismiss
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Main Entry Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#FFF', borderRadius: '20px', border: '1px solid #ECECEC', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '28px' }}
          className="md:col-span-3"
        >
          <h2 className="text-[17px] font-bold text-[#111111] mb-1">Collection Entry</h2>
          <p className="text-[12px] text-[#AAAAAA] mb-6">Press Enter to move to next field</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Shift + Animal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Shift</label>
                <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                  {(['morning', 'evening'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setValue('shift', s)}
                      className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all cursor-pointer"
                      style={{ background: values.shift === s ? '#FF6B00' : '#F7F7F7', color: values.shift === s ? '#FFF' : '#777' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Animal</label>
                <div className="flex rounded-xl overflow-hidden border border-[#ECECEC]">
                  {(['cow', 'buffalo'] as const).map(a => (
                    <button key={a} type="button" onClick={() => setValue('animalType', a)}
                      className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all cursor-pointer"
                      style={{ background: values.animalType === a ? '#FF6B00' : '#F7F7F7', color: values.animalType === a ? '#FFF' : '#777' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Farmer ID — LARGE */}
            <div>
              <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">Farmer ID</label>
              <input
                {...register('farmerId')}
                ref={(e) => {
                  register('farmerId').ref(e);
                  (refs.farmerId as any).current = e;
                }}
                id="farmerId-input"
                list="farmer-list"
                autoFocus
                autoComplete="off"
                className="w-full px-4 text-[28px] font-bold h-16 rounded-xl outline-none transition-all tracking-widest uppercase"
                style={is({})}
                placeholder="F001"
                onFocus={fc} onBlur={bc}
                onKeyDown={e => handleKeyDown(e, 'liters')}
              />
              <datalist id="farmer-list">
                {farmers.filter(f => f.active).map(f => (
                  <option key={f.id} value={f.id}>{f.name} - {f.village}</option>
                ))}
              </datalist>
              <div className="h-6 mt-1.5">
                {currentFarmer ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} style={{ color: '#22C55E' }} />
                    <span className="text-[13px] font-semibold" style={{ color: '#22C55E' }}>{currentFarmer.name}</span>
                    <span className="text-[12px] text-[#AAAAAA]">— {currentFarmer.village} · {currentFarmer.animalType}</span>
                  </motion.div>
                ) : values.farmerId ? (
                  <span className="text-[12px] text-red-500">Farmer not found. Check ID.</span>
                ) : (
                  <span className="text-[12px] text-[#BBBBBB]">Enter farmer ID to auto-fill details</span>
                )}
              </div>
            </div>

            {/* Liters, FAT, SNF */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { label: 'Liters', key: 'liters', next: 'fat', placeholder: '0.0' },
                { label: 'FAT', key: 'fat', next: 'snf', placeholder: '0.0' },
                { label: 'SNF', key: 'snf', next: null, placeholder: '0.0' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="text-[12px] font-semibold text-[#777777] uppercase tracking-wider mb-2 block">{f.label}</label>
                  <input
                    type="number" step="0.1"
                    {...register(f.key as any)}
                    ref={(e) => {
                      register(f.key as any).ref(e);
                      (refs[f.key] as any).current = e;
                    }}
                    className="w-full px-3 py-3 text-[20px] font-bold rounded-xl outline-none transition-all text-center"
                    style={is({})}
                    placeholder={f.placeholder}
                    onFocus={fc} onBlur={bc}
                    onKeyDown={e => handleKeyDown(e, f.next)}
                  />
                  {(errors as any)[f.key] && (
                    <p className="text-[10px] text-red-500 mt-1">{(errors as any)[f.key]?.message}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 text-[15px] font-bold text-white transition-all cursor-pointer"
                style={{ background: '#FF6B00', borderRadius: '16px', boxShadow: '0 4px 14px rgba(255,107,0,0.35)' }}
              >
                {isSubmitting ? 'Saving...' : 'Save Collection ↵'}
              </motion.button>

              {lastSavedCollection && (
                <button
                  type="button"
                  onClick={() => printSpecificCollection(lastSavedCollection)}
                  className="px-4 py-3.5 border border-[#ECECEC] rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-[13px] font-semibold text-[#555] cursor-pointer"
                  title="Print receipt for the last saved collection"
                >
                  <Printer size={16} />
                  <span>Print Receipt</span>
                </button>
              )}
            </div>
          </form>
        </motion.div>

        {/* Live Calculation Display Panel */}
        <div className="md:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="p-6 rounded-3xl text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #FF8800 100%)', boxShadow: '0 4px 16px rgba(255,107,0,0.3)' }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-orange-200 mb-4">Live Calculation</div>

            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between border-b border-white/20 pb-2">
                <span className="text-orange-150 font-medium">Farmer</span>
                <span className="font-bold">{currentFarmer ? currentFarmer.name : '—'}</span>
              </div>
              <div className="flex justify-between border-b border-white/20 pb-2">
                <span className="text-orange-150 font-medium">Animal</span>
                <span className="font-bold capitalize">{values.animalType}</span>
              </div>
              <div className="flex justify-between border-b border-white/20 pb-2">
                <span className="text-orange-150 font-medium">Liters</span>
                <span className="font-bold">{numLiters > 0 ? `${numLiters} L` : '—'}</span>
              </div>
              <div className="flex justify-between border-b border-white/20 pb-2">
                <span className="text-orange-150 font-medium">Entered FAT / SNF</span>
                <span className="font-bold">{numFat > 0 || numSnf > 0 ? `${numFat} / ${numSnf}` : '—'}</span>
              </div>

              {isNearestApplied && matchedFat !== null && matchedSnf !== null && (
                <div className="flex justify-between border-b border-white/20 pb-2 text-yellow-200">
                  <span className="font-medium">Matched FAT / SNF</span>
                  <span className="font-bold">{matchedFat} / {matchedSnf}</span>
                </div>
              )}

              <div className="flex justify-between border-b border-white/20 pb-2">
                <span className="text-orange-150 font-medium">Rate / L</span>
                <span className="font-bold">{rate > 0 ? `₹${rate.toFixed(2)}` : '—'}</span>
              </div>
            </div>

            <div className="mt-5 pt-3">
              <div className="text-[11px] font-medium text-orange-150 uppercase">Total Amount</div>
              <div className="text-[38px] font-black tracking-tight leading-none mt-1">
                ₹{totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}
              </div>
            </div>

            {isNearestApplied && (
              <div className="mt-3 inline-block px-2.5 py-1 rounded-lg bg-black/20 text-[10px] font-bold text-yellow-200 uppercase tracking-wider border border-white/10">
                Nearest Rate Applied
              </div>
            )}
          </motion.div>

          {/* Today's Entries Sidebar */}
          <div style={{ background: '#FFF', borderRadius: '20px', border: '1px solid #ECECEC', padding: '20px' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-bold text-[#111111]">Today's Entries</div>
              <span className="text-[12px] font-bold text-[#FF6B00] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">{recentCollections.length}</span>
            </div>

            {recentCollections.length === 0 ? (
              <p className="text-[12px] text-[#AAAAAA] py-4 text-center">No collections today yet</p>
            ) : (
              <div className="space-y-2">
                {recentCollections.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all text-[12px] group">
                    <div>
                      <div className="font-bold text-[#111111]">{c.farmerName}</div>
                      <div className="text-[#AAAAAA]">{c.farmerId} · {c.liters}L · {c.shift}</div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="font-bold text-[#FF6B00]">₹{c.totalAmount.toFixed(0)}</div>
                        <button
                          type="button"
                          onClick={() => printSpecificCollection(c)}
                          className="text-[10px] text-gray-400 hover:text-[#FF6B00] flex items-center justify-end gap-0.5 ml-auto"
                        >
                          <Printer size={10} /> Print
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1. DUPLICATE WARNING MODAL (ERP DIALOG) */}
      <AnimatePresence>
        {showDuplicateModal && existingCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowDuplicateModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-xl overflow-hidden border border-[#ECECEC] shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between text-white" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EA580C 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white">⚠ Collection Already Exists</h3>
                    <p className="text-xs text-orange-100">A collection record has already been saved for this farmer today.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowDuplicateModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Farmer & Shift Context */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-gray-400 font-bold uppercase text-[10px]">Farmer</div>
                    <div className="font-extrabold text-gray-900">{existingCollection.farmerName}</div>
                    <div className="text-gray-500 font-mono text-[11px]">{existingCollection.farmerId}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 font-bold uppercase text-[10px]">Date</div>
                    <div className="font-extrabold text-gray-900">{todayDateStr}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 font-bold uppercase text-[10px]">Shift</div>
                    <div className="font-extrabold text-amber-700 capitalize">{existingCollection.shift}</div>
                  </div>
                </div>

                {/* Existing Snapshot Grid */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Existing Record Snapshot</span>
                    <span className="text-[10px] text-amber-700 font-normal">Recorded today</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-xl border border-amber-200/60">
                      <div className="text-[10px] text-gray-400 font-bold">Liters</div>
                      <div className="font-black text-gray-900">{existingCollection.liters} L</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-amber-200/60">
                      <div className="text-[10px] text-gray-400 font-bold">FAT / SNF</div>
                      <div className="font-black text-gray-900">{existingCollection.enteredFat ?? existingCollection.fat} / {existingCollection.enteredSnf ?? existingCollection.snf}</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-amber-200/60">
                      <div className="text-[10px] text-gray-400 font-bold">Rate / L</div>
                      <div className="font-black text-gray-900">₹{existingCollection.rate.toFixed(2)}</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-amber-200/60">
                      <div className="text-[10px] text-gray-400 font-bold">Total</div>
                      <div className="font-black text-amber-600">₹{existingCollection.totalAmount.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between px-1">
                    <span>Created By: <b>{existingCollection.createdBy || 'Operator'}</b></span>
                    <span>Action Audit: Enforced</span>
                  </div>
                </div>

                <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">Choose what you want to do:</div>

                {/* 4 Clear Choice Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleEditExisting}
                    className="p-3.5 bg-white border-2 border-blue-500 hover:bg-blue-50 text-blue-700 rounded-2xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Edit3 size={16} />
                      <span>Edit Existing</span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-mono text-[10px]">F2</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canOverride}
                    onClick={handleTriggerOverride}
                    className={`p-3.5 border-2 rounded-2xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs ${canOverride
                      ? 'bg-white border-red-500 hover:bg-red-50 text-red-700'
                      : 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                      }`}
                    title={!canOverride ? 'Manager / Admin permission required' : ''}
                  >
                    <div className="flex items-center gap-2">
                      <RefreshCw size={16} />
                      <span>Override Record</span>
                    </div>
                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md font-mono text-[10px]">F3</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteMerge}
                    className="p-3.5 bg-white border-2 border-emerald-500 hover:bg-emerald-50 text-emerald-700 rounded-2xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={16} />
                      <span>Merge Quantities</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px]">
                      +{numLiters} L
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(false)}
                    className="p-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                  >
                    <span>Cancel</span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-md font-mono text-[10px]">Esc</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. OVERRIDE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {showOverrideConfirmModal && existingCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowOverrideConfirmModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-red-200 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">Replace Existing Collection?</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    This action will permanently replace {existingCollection.farmerName}'s current record of <b>{existingCollection.liters} L</b> with the new entry of <b>{numLiters} L</b>.
                  </p>
                </div>

                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-800 text-left font-medium">
                  • Reverses previous farmer ledger credit (₹{existingCollection.totalAmount.toFixed(2)})<br />
                  • Credits new collection total (₹{totalAmount.toFixed(2)})<br />
                  • Creates a permanent audit entry under <b>audit_logs</b>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOverrideConfirmModal(false)}
                    className="flex-1 py-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                    style={{ background: '#F3F4F6', color: '#374151', border: '1.5px solid #D1D5DB' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteOverride}
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)', color: '#FFFFFF' }}
                  >
                    {isSubmitting ? 'Replacing...' : 'Replace Record'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. VIEW RECORD SNAPSHOT MODAL */}
      <AnimatePresence>
        {showViewModal && existingCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowViewModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-gray-200 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-900 text-white">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-[#FF6B00]" />
                  <h3 className="text-base font-bold text-white">Existing Collection View</h3>
                </div>
                <button onClick={() => setShowViewModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20">
                  <X size={16} className="text-white" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs text-gray-800">
                <div className="p-3 bg-gray-50 rounded-2xl space-y-1.5 border border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Farmer:</span>
                    <span className="font-bold">{existingCollection.farmerName} ({existingCollection.farmerId})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Shift:</span>
                    <span className="font-bold capitalize">{existingCollection.shift}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Animal:</span>
                    <span className="font-bold capitalize">{existingCollection.animalType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Liters:</span>
                    <span className="font-bold">{existingCollection.liters} L</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">FAT / SNF:</span>
                    <span className="font-bold">{existingCollection.enteredFat ?? existingCollection.fat} / {existingCollection.enteredSnf ?? existingCollection.snf}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Rate / L:</span>
                    <span className="font-bold">₹{existingCollection.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-900 font-extrabold">Total Amount:</span>
                    <span className="font-black text-[#FF6B00] text-sm">₹{existingCollection.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleEditExisting}
                    className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs"
                  >
                    Edit Record
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowViewModal(false)}
                    className="py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden print container */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden' }}>
        {lastSavedCollection && printerSettings && (
          <div ref={receiptRef}>
            {Array.from({ length: printerSettings.copies || 1 }).map((_, i) => (
              <div key={i} style={{ marginBottom: (printerSettings.printerType === 'a4' && i > 0) ? '20px' : '0', pageBreakBefore: (printerSettings.printerType === 'a4' && i > 0) ? 'always' : 'auto' }}>
                {printerSettings.printerType === 'a4' ? (
                  <A4Receipt
                    collection={lastSavedCollection}
                    farmer={farmers.find(f => f.id === lastSavedCollection.farmerId) || null}
                    settings={printerSettings}
                    centerName={generalSettings.centerName || `${profile?.name}'s Center`}
                    centerVillage={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                  />
                ) : (
                  <ThermalReceipt
                    collection={lastSavedCollection}
                    farmer={farmers.find(f => f.id === lastSavedCollection.farmerId) || null}
                    settings={printerSettings}
                    centerName={generalSettings.centerName || `${profile?.name}'s Center`}
                    centerVillage={generalSettings.address || ''}
                    centerPhone={generalSettings.phone || ''}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
