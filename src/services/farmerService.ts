import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, runTransaction, orderBy,
} from 'firebase/firestore';
import { Farmer, FarmerFormData } from '@/types';
import { offlineDb } from '@/lib/offlineDb';

/**
 * Generates next sequential farmer ID (F001, F002, ...) using a Firestore
 * transaction to prevent duplicates when multiple staff create farmers simultaneously.
 */
async function generateFarmerId(centerId: string): Promise<string> {
  const centerRef = doc(db, 'centers', centerId);
  const countersDocRef = doc(db, 'centers', centerId, 'settings', 'counters');

  return await runTransaction(db, async (tx) => {
    const countersDoc = await tx.get(countersDocRef);
    const currentCount: number = countersDoc.exists()
      ? (countersDoc.data().farmerCounter ?? 0)
      : 0;
    const nextCount = currentCount + 1;

    // Pad to 3 digits minimum (F001 → F999 → F1000+)
    const paddedId = `F${String(nextCount).padStart(3, '0')}`;

    // Atomically update the counter
    if (countersDoc.exists()) {
      tx.update(countersDocRef, { farmerCounter: nextCount });
    } else {
      tx.set(countersDocRef, { farmerCounter: nextCount });
    }

    return paddedId;
  });
}

export const farmerService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'farmers'),

  getAll: async (centerId: string): Promise<Farmer[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          farmerService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const cloudFarmers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Farmer));

        // Cache in background
        const syncTime = Date.now();
        for (const f of cloudFarmers) {
          await offlineDb.farmers.put({
            ...f,
            centerId,
            localUpdatedAt: syncTime
          });
        }
        return cloudFarmers;
      } catch (err) {
        console.warn("Failed to fetch farmers online, using local cache:", err);
      }
    }

    // Load from IndexedDB
    return await offlineDb.farmers.where('centerId').equals(centerId).toArray();
  },

  getById: async (centerId: string, farmerId: string): Promise<Farmer | null> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snapshot = await getDocs(
          query(farmerService.getCollectionRef(centerId))
        );
        const found = snapshot.docs.find(d => d.id === farmerId);
        if (found) {
          const f = { id: found.id, ...found.data() } as Farmer;
          await offlineDb.farmers.put({
            ...f,
            centerId,
            localUpdatedAt: Date.now()
          });
          return f;
        }
      } catch (err) {
        console.warn("Failed to fetch farmer by ID online, using local cache:", err);
      }
    }

    const local = await offlineDb.farmers.get(farmerId);
    return local || null;
  },

  add: async (centerId: string, data: FarmerFormData): Promise<string> => {
    // Dynamically import to avoid circular dependencies if any
    const { subscriptionService } = await import('@/services/subscriptionService');
    const usage = await subscriptionService.checkFarmerLimit(centerId);
    if (!usage.allowed) {
      throw new Error(`Plan limit reached! You can only add up to ${usage.limit} farmers. Please upgrade your plan.`);
    }

    const farmerId = await generateFarmerId(centerId);
    // Use the generated readable ID as the Firestore document ID
    const docRef = doc(farmerService.getCollectionRef(centerId), farmerId);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
    });
    return farmerId;
  },

  update: async (
    centerId: string,
    farmerId: string,
    data: Partial<FarmerFormData>
  ): Promise<void> => {
    const docRef = doc(farmerService.getCollectionRef(centerId), farmerId);
    await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  delete: async (centerId: string, farmerId: string): Promise<void> => {
    // NOTE: Per spec, deleted farmers do NOT reuse old IDs (counter is never decremented)
    const docRef = doc(farmerService.getCollectionRef(centerId), farmerId);
    await deleteDoc(docRef);
  },
};
