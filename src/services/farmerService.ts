import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, runTransaction, orderBy,
} from 'firebase/firestore';
import { Farmer, FarmerFormData } from '@/types';

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
    const q = query(
      farmerService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Farmer));
  },

  getById: async (centerId: string, farmerId: string): Promise<Farmer | null> => {
    const snapshot = await getDocs(
      query(farmerService.getCollectionRef(centerId))
    );
    const found = snapshot.docs.find(d => d.id === farmerId);
    return found ? ({ id: found.id, ...found.data() } as Farmer) : null;
  },

  add: async (centerId: string, data: FarmerFormData): Promise<string> => {
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
