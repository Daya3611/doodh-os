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
import { CheckCircle2, Printer } from 'lucide-react';
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

// Input ref helper for keyboard navigation
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

  const receiptRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });
  
  const printSpecificCollection = (c: Collection) => {
    setLastSavedCollection(c);
    // use a short timeout to let state update and render the hidden receipt before printing
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

  // Keyboard Enter navigation between fields
  const handleKeyDown = (e: React.KeyboardEvent, nextField: string | null) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextField && refs[nextField]?.current) {
        refs[nextField].current?.focus();
        refs[nextField].current?.select();
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!centerId || !profile) { toast.error('Setup incomplete'); return; }
    if (!currentFarmer) { toast.error('Invalid Farmer ID'); refs.farmerId.current?.focus(); return; }
    if (rate <= 0) { toast.error('No rate found for this FAT/SNF. Check Rate Chart.'); return; }

    setIsSubmitting(true);
    
    // Duplicate Entry Detection (works completely offline by querying loaded local recent collections)
    const todayStr = new Date().toDateString();
    const isDuplicate = recentCollections.some(c => {
      if (!c.createdAt) return false;
      const d = (c.createdAt as any).toDate
        ? (c.createdAt as any).toDate()
        : new Date(c.createdAt as any);
      return c.farmerId.toLowerCase() === currentFarmer.id.toLowerCase() &&
             c.shift === data.shift &&
             d.toDateString() === todayStr;
    });

    if (isDuplicate) {
      const confirmSave = window.confirm(`Duplicate Entry Detected:\nA collection for ${currentFarmer.name} in the ${data.shift} shift already exists today.\n\nDo you want to save this as a second entry?`);
      if (!confirmSave) {
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const colData = {
        farmerId: currentFarmer.id,
        farmerName: currentFarmer.name,
        animalType: data.animalType,
        shift: data.shift,
        liters: numLiters,
        fat: numFat,
        snf: numSnf,
        rate,
        totalAmount,
        enteredFat: numFat,
        enteredSnf: numSnf,
        matchedFat: matchedFat ?? numFat,
        matchedSnf: matchedSnf ?? numSnf,
        isNearestRateApplied: isNearestApplied,
      };
      
      const newId = await collectionService.add(centerId, colData, profile.uid || 'unknown');

      toast.success(`✓ Saved — ${currentFarmer.name} — ₹${totalAmount.toFixed(2)}`);
      setSavedCount(c => c + 1);
      
      // Save and automatically print the receipt if enabled
      const savedCol = { ...colData, id: newId, createdBy: profile.uid || 'unknown', createdAt: new Date() as any };
      
      if (printerSettings?.autoPrint) {
        printSpecificCollection(savedCol as Collection);
      } else {
        setLastSavedCollection(savedCol as Collection);
      }
      
      loadRecent();

      reset({
        farmerId: '',
        animalType: data.animalType,
        shift: data.shift,
        liters: '', fat: '', snf: '',
      });
      setMatchedFat(null);
      setMatchedSnf(null);
      setIsNearestApplied(false);
      setTimeout(() => refs.farmerId.current?.focus(), 50);
    } catch { toast.error('Failed to save collection'); }
    finally { setIsSubmitting(false); }
  };

  const is = (style: object) => ({ ...{ background: '#F7F7F7', border: '1.5px solid #ECECEC', color: '#111111' }, ...style });
  const fc = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#FF6B00'; };
  const bc = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#ECECEC'; };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {savedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
          <span className="text-[13px] font-semibold text-green-700">{savedCount} collection{savedCount > 1 ? 's' : ''} saved this session</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Entry Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
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
                      className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all"
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
                      className="flex-1 py-2.5 text-[13px] font-semibold capitalize transition-all"
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

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <motion.button
                whileHover={!isSubmitting && !!currentFarmer && rate > 0 ? { scale: 1.01, y: -1 } : {}}
                whileTap={!isSubmitting && !!currentFarmer && rate > 0 ? { scale: 0.99 } : {}}
                type="submit"
                disabled={isSubmitting || !currentFarmer || rate === 0}
                className="w-full sm:w-[70%] py-4 text-[15px] font-bold text-white rounded-xl transition-all"
                style={{
                  background: (isSubmitting || !currentFarmer || rate === 0) ? '#DDDDDD' : '#FF6B00',
                  cursor: (isSubmitting || !currentFarmer || rate === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: (!isSubmitting && !!currentFarmer && rate > 0) ? '0 4px 14px rgba(255,107,0,0.35)' : 'none',
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Collection  ↵'}
              </motion.button>
              
              <button
                type="button"
                disabled={!lastSavedCollection}
                onClick={() => handlePrint()}
                className="w-full sm:w-[30%] py-4 text-[15px] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all border"
                style={{
                  background: '#FFFFFF',
                  borderColor: lastSavedCollection ? '#ECECEC' : '#F7F7F7',
                  color: lastSavedCollection ? '#111111' : '#BBBBBB',
                  cursor: lastSavedCollection ? 'pointer' : 'not-allowed',
                }}
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </form>
        </motion.div>

        {/* Right Panel */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Live Summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="relative overflow-hidden"
            style={{ background: '#FF6B00', borderRadius: '20px', padding: '24px', border: 'none' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#FFF', transform: 'translate(30%,-30%)' }} />
            <div className="relative z-10">
              <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-4">Live Calculation</div>
              <div className="space-y-2.5 mb-4">
                {[
                  { label: 'Farmer', value: currentFarmer?.name || '—' },
                  { label: 'Animal', value: values.animalType || '—', cls: 'capitalize' },
                  { label: 'Liters', value: numLiters > 0 ? `${numLiters.toFixed(1)} L` : '—' },
                  { label: 'Entered FAT / SNF', value: numFat > 0 ? `${numFat.toFixed(1)} / ${numSnf.toFixed(1)}` : '—' },
                  ...(isNearestApplied ? [
                    { label: 'Matched FAT / SNF', value: matchedFat && matchedSnf ? `${matchedFat.toFixed(1)} / ${matchedSnf.toFixed(1)}` : '—' }
                  ] : []),
                  { label: 'Rate / L', value: rate > 0 ? `₹${rate.toFixed(2)}` : 'Not set' },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center">
                    <span className="text-[12px] text-white/70">{r.label}</span>
                    <span className={`text-[13px] font-semibold text-white ${r.cls || ''}`}>{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/20 pt-4">
                <div className="text-[11px] text-white/60 mb-1">Total Amount</div>
                <div className="flex justify-between items-end">
                  <div className="text-[42px] font-extrabold text-white leading-none">
                    ₹{totalAmount.toFixed(2)}
                  </div>
                  {isNearestApplied && (
                    <div className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/30 tracking-wide uppercase animate-pulse">
                      Nearest Rate Applied
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Entries */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ background: '#FFF', borderRadius: '20px', border: '1px solid #ECECEC', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
            className="flex-1"
          >
            <div className="px-4 py-3.5 border-b border-[#F0F0F0] flex items-center justify-between">
              <div className="text-[13px] font-semibold text-[#111111]">Today's Entries</div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#FFF3E8', color: '#FF6B00' }}>
                {recentCollections.length}
              </span>
            </div>
            <AnimatePresence>
              {recentCollections.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#AAAAAA]">No entries yet</div>
              ) : (
                <div className="divide-y divide-[#F7F7F7] overflow-y-auto max-h-64">
                  {recentCollections.map((c, i) => {
                    let timeStr = '';
                    if (c.createdAt) {
                      const d = (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any);
                      timeStr = format(d, 'hh:mm a');
                    }
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between px-4 py-3 hover:bg-[#FAFAFA] transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-[#111111] truncate">{c.farmerName}</div>
                          <div className="text-[10px] text-[#AAAAAA]">{c.farmerId} · {c.fat}F · {c.liters}L · {timeStr}</div>
                        </div>
                        <div className="ml-3 text-right flex-shrink-0">
                          <div className="text-[13px] font-bold" style={{ color: '#FF6B00' }}>₹{c.totalAmount.toFixed(0)}</div>
                          <button onClick={() => printSpecificCollection(c)} className="text-[10px] text-[#AAAAAA] hover:text-[#555] flex items-center gap-0.5 mt-1 ml-auto">
                            <Printer size={10} /> Print
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      
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
