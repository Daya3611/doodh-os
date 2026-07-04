import { db } from '@/firebase/config';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { RateChart, RateChartFormData, RateChartEntry, AnimalType } from '@/types';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const rateChartService = {
  getCollectionRef: (centerId: string) => collection(db, 'centers', centerId, 'rateCharts'),
  getEntriesRef: (centerId: string, chartId: string) => collection(db, 'centers', centerId, 'rateCharts', chartId, 'rateChartEntries'),
  
  getAll: async (centerId: string): Promise<RateChart[]> => {
    const q = query(rateChartService.getCollectionRef(centerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
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

  getRate: async (centerId: string, animal: AnimalType, fat: number, snf: number, date: Date = new Date()): Promise<number> => {
    // Ensure statuses are synced before evaluating
    await rateChartService.syncRateChartStatuses(centerId);

    const q = query(
      rateChartService.getCollectionRef(centerId),
      where('animal', '==', animal)
    );
    const snapshot = await getDocs(q);
    const allCharts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
    
    // Find matching chart
    // A chart is matching if it was active on the specified date.
    let matchingChart = allCharts.find(c => {
      if (!c.effectiveFrom) return c.status === 'active'; // Legacy chart fallback
      const from = c.effectiveFrom instanceof Timestamp ? c.effectiveFrom.toDate() : new Date(c.effectiveFrom);
      const until = c.effectiveUntil ? (c.effectiveUntil instanceof Timestamp ? c.effectiveUntil.toDate() : new Date(c.effectiveUntil)) : null;
      
      return date >= from && (until === null || date <= until);
    });

    if (!matchingChart) {
      // Fallback to currently active
      matchingChart = allCharts.find(c => c.status === 'active');
    }

    if (!matchingChart) return 0;
    
    const chartId = matchingChart.id;
    // Use range query for 'fat' to avoid floating point strict equality issues in Firestore
    const entriesQuery = query(
      rateChartService.getEntriesRef(centerId, chartId),
      where('fat', '>=', fat - 0.001),
      where('fat', '<=', fat + 0.001)
    );
    const entrySnapshot = await getDocs(entriesQuery);
    
    // Filter for 'snf' manually to avoid needing a composite index and to handle float precision
    const match = entrySnapshot.docs.find(d => Math.abs(d.data().snf - snf) < 0.001);
    
    if (!match) return 0;
    return match.data().rate || 0;
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
