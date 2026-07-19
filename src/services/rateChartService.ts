import { db } from '@/firebase/config';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { RateChart, RateChartFormData, RateChartEntry, AnimalType } from '@/types';
import { offlineDb } from '@/lib/offlineDb';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export interface RateLookupResult {
  rate: number;
  matchedFat: number;
  matchedSnf: number;
  isNearestApplied: boolean;
}

function findNearestSorted(arr: number[], target: number): number {
  if (arr.length === 0) return target;
  if (target <= arr[0]) return arr[0];
  if (target >= arr[arr.length - 1]) return arr[arr.length - 1];

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) {
      return arr[mid];
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const valLeft = arr[left];
  const valRight = arr[right];
  if (Math.abs(valLeft - target) < Math.abs(valRight - target)) {
    return valLeft;
  } else {
    return valRight;
  }
}

export function lookupRateInEntries(entries: RateChartEntry[], enteredFat: number, enteredSnf: number): RateLookupResult {
  if (entries.length === 0) {
    return { rate: 0, matchedFat: enteredFat, matchedSnf: enteredSnf, isNearestApplied: false };
  }

  // 1. Load all available unique FAT values, sorted ascending
  const uniqueFats = Array.from(new Set(entries.map(e => e.fat))).sort((a, b) => a - b);
  
  if (uniqueFats.length === 0) {
    return { rate: 0, matchedFat: enteredFat, matchedSnf: enteredSnf, isNearestApplied: false };
  }

  // 2. Find the nearest FAT value
  const matchedFat = findNearestSorted(uniqueFats, enteredFat);

  // 3. Filter entries for the matched FAT value
  const fatEntries = entries.filter(e => e.fat === matchedFat);
  if (fatEntries.length === 0) {
    return { rate: 0, matchedFat, matchedSnf: enteredSnf, isNearestApplied: true };
  }

  // 4. Load all available unique SNF values for this FAT, sorted ascending
  const uniqueSnfs = Array.from(new Set(fatEntries.map(e => e.snf))).sort((a, b) => a - b);
  
  if (uniqueSnfs.length === 0) {
    return { rate: 0, matchedFat, matchedSnf: enteredSnf, isNearestApplied: true };
  }

  // 5. Find the nearest SNF value
  const matchedSnf = findNearestSorted(uniqueSnfs, enteredSnf);

  // 6. Find the rate entry matching matchedFat and matchedSnf
  const finalEntry = fatEntries.find(e => e.snf === matchedSnf);
  const rate = finalEntry ? finalEntry.rate : 0;

  // Nearest is applied if the matched FAT/SNF doesn't match the entered values exactly
  const isNearestApplied = Math.abs(matchedFat - enteredFat) > 0.01 || Math.abs(matchedSnf - enteredSnf) > 0.01;

  return {
    rate,
    matchedFat,
    matchedSnf,
    isNearestApplied
  };
}

export const rateChartService = {
  getCollectionRef: (centerId: string) => collection(db, 'centers', centerId, 'rateCharts'),
  getEntriesRef: (centerId: string, chartId: string) => collection(db, 'centers', centerId, 'rateCharts', chartId, 'rateChartEntries'),
  
  getAll: async (centerId: string): Promise<RateChart[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(rateChartService.getCollectionRef(centerId));
        const snapshot = await getDocs(q);
        const charts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
        
        for (const c of charts) {
          await offlineDb.rateCharts.put({
            ...c,
            centerId,
            localUpdatedAt: Date.now()
          });
        }
        return charts;
      } catch (err) {
        console.warn("Failed to fetch rate charts online, using local cache:", err);
      }
    }

    return await offlineDb.rateCharts.where('centerId').equals(centerId).toArray();
  },

  getById: async (centerId: string, chartId: string): Promise<RateChart | null> => {
    const docRef = doc(rateChartService.getCollectionRef(centerId), chartId);
    const docSnap = await getDocs(query(rateChartService.getCollectionRef(centerId), where('__name__', '==', chartId)));
    if (docSnap.empty) return null;
    return { id: docSnap.docs[0].id, ...docSnap.docs[0].data() } as RateChart;
  },

  syncRateChartStatuses: async (centerId: string): Promise<void> => {
    // Lazy evaluation to transition upcoming -> active -> expired
    const charts = await rateChartService.getAll(centerId);
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayEnd = endOfDay(subDays(now, 1));

    const batch = writeBatch(db);
    let hasUpdates = false;

    for (const animal of ['cow', 'buffalo'] as AnimalType[]) {
      const animalCharts = charts.filter(c => c.animal === animal);
      
      const upcomingCharts = animalCharts.filter(c => c.status === 'upcoming');
      const activeChart = animalCharts.find(c => c.status === 'active');
      const chartsToActivate = upcomingCharts.filter(c => {
        if (!c.effectiveFrom) return false;
        const effectiveFrom = c.effectiveFrom instanceof Timestamp ? c.effectiveFrom.toDate() : new Date(c.effectiveFrom);
        return effectiveFrom <= now;
      }).sort((a, b) => {
        const da = a.effectiveFrom instanceof Timestamp ? a.effectiveFrom.toDate() : new Date(a.effectiveFrom as any);
        const db = b.effectiveFrom instanceof Timestamp ? b.effectiveFrom.toDate() : new Date(b.effectiveFrom as any);
        return da.getTime() - db.getTime();
      });

      if (chartsToActivate.length > 0) {
        // The last one is the most current one to activate
        const chartToActivate = chartsToActivate[chartsToActivate.length - 1];
        
        // Expire the currently active chart
        if (activeChart) {
          const activeRef = doc(rateChartService.getCollectionRef(centerId), activeChart.id);
          batch.update(activeRef, {
            status: 'expired',
            effectiveUntil: Timestamp.fromDate(yesterdayEnd),
            updatedAt: serverTimestamp()
          });
          hasUpdates = true;
        }

        // Activate the new chart
        const newActiveRef = doc(rateChartService.getCollectionRef(centerId), chartToActivate.id);
        batch.update(newActiveRef, {
          status: 'active',
          effectiveUntil: null,
          updatedAt: serverTimestamp()
        });
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      await batch.commit();
    }
  },

  lookupRate: async (
    centerId: string,
    animal: AnimalType,
    fat: number,
    snf: number,
    date: Date = new Date()
  ): Promise<RateLookupResult> => {
    // 1. Fetch charts (either from local database or online sync)
    let allCharts = await offlineDb.rateCharts
      .where('centerId').equals(centerId)
      .and(c => c.animal === animal)
      .toArray();

    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (allCharts.length === 0 && isOnline) {
      try {
        await rateChartService.syncRateChartStatuses(centerId);
        const q = query(
          rateChartService.getCollectionRef(centerId),
          where('animal', '==', animal)
        );
        const snapshot = await getDocs(q);
        const cloudCharts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
        
        const now = Date.now();
        allCharts = cloudCharts.map(c => ({
          ...c,
          centerId,
          localUpdatedAt: now
        }));
        
        for (const c of allCharts) {
          await offlineDb.rateCharts.put(c);
        }
      } catch (err) {
        console.warn("Failed to fetch rate charts for lookup:", err);
      }
    }

    // Find the matching chart
    let matchingChart = allCharts.find(c => {
      if (!c.effectiveFrom) return c.status === 'active';
      const from = c.effectiveFrom instanceof Timestamp ? c.effectiveFrom.toDate() : new Date(c.effectiveFrom as any);
      const until = c.effectiveUntil
        ? (c.effectiveUntil instanceof Timestamp ? c.effectiveUntil.toDate() : new Date(c.effectiveUntil as any))
        : null;
      return date >= from && (until === null || date <= until);
    });

    if (!matchingChart) {
      matchingChart = allCharts.find(c => c.status === 'active');
    }

    if (!matchingChart) {
      return { rate: 0, matchedFat: fat, matchedSnf: snf, isNearestApplied: false };
    }

    // 2. Fetch chart entries
    let entries = await offlineDb.rateChartEntries
      .where('rateChartId').equals(matchingChart.id)
      .toArray();

    if (entries.length === 0 && isOnline) {
      try {
        const allEntriesSnap = await getDocs(rateChartService.getEntriesRef(centerId, matchingChart.id));
        const cloudEntries = allEntriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as RateChartEntry));
        
        const now = Date.now();
        entries = cloudEntries.map(e => ({
          ...e,
          centerId,
          localUpdatedAt: now
        }));

        for (const e of entries) {
          await offlineDb.rateChartEntries.put(e);
        }
      } catch (err) {
        console.warn("Failed to fetch rate entries for lookup:", err);
      }
    }

    // 3. Apply lookup algorithm
    return lookupRateInEntries(entries, fat, snf);
  },

  getRate: async (
    centerId: string,
    animal: AnimalType,
    fat: number,
    snf: number,
    date: Date = new Date()
  ): Promise<number> => {
    const result = await rateChartService.lookupRate(centerId, animal, fat, snf, date);
    return result.rate;
  },

  getEntries: async (centerId: string, chartId: string): Promise<RateChartEntry[]> => {
    const snapshot = await getDocs(rateChartService.getEntriesRef(centerId, chartId));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChartEntry));
  },

  add: async (
    centerId: string, 
    chartData: RateChartFormData, 
    entriesData: { fat: number; snf: number; rate: number }[],
    createdBy: string
  ): Promise<string> => {
    const newDocRef = doc(rateChartService.getCollectionRef(centerId));
    
    await setDoc(newDocRef, {
      ...chartData,
      totalEntries: entriesData.length,
      effectiveUntil: null, // "Current"
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const chartId = newDocRef.id;

    const CHUNK_SIZE = 500;
    for (let i = 0; i < entriesData.length; i += CHUNK_SIZE) {
      const chunk = entriesData.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach(entry => {
        const entryRef = doc(rateChartService.getEntriesRef(centerId, chartId));
        batch.set(entryRef, {
          rateChartId: chartId,
          fat: entry.fat,
          snf: entry.snf,
          rate: entry.rate,
          createdAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    }

    return chartId;
  },

  update: async (centerId: string, id: string, data: Partial<RateChartFormData>): Promise<void> => {
    const docRef = doc(rateChartService.getCollectionRef(centerId), id);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  delete: async (centerId: string, chartId: string): Promise<void> => {
    const entriesSnapshot = await getDocs(rateChartService.getEntriesRef(centerId, chartId));
    const CHUNK_SIZE = 500;
    for (let i = 0; i < entriesSnapshot.docs.length; i += CHUNK_SIZE) {
      const chunk = entriesSnapshot.docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    
    const docRef = doc(rateChartService.getCollectionRef(centerId), chartId);
    await deleteDoc(docRef);
  },

  activateChart: async (centerId: string, chartId: string, animal: AnimalType): Promise<void> => {
    const batch = writeBatch(db);
    
    const activeQuery = query(
      rateChartService.getCollectionRef(centerId),
      where('animal', '==', animal)
    );
    const activeSnapshot = await getDocs(activeQuery);
    
    const now = new Date();
    const yesterdayEnd = endOfDay(subDays(now, 1));

    activeSnapshot.docs.forEach(d => {
      if (d.data().status === 'active' && d.id !== chartId) {
        batch.update(d.ref, { 
          status: 'expired', 
          effectiveUntil: Timestamp.fromDate(yesterdayEnd),
          updatedAt: serverTimestamp() 
        });
      }
    });

    const newActiveRef = doc(rateChartService.getCollectionRef(centerId), chartId);
    batch.update(newActiveRef, { 
      status: 'active',
      effectiveUntil: null,
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }
};
