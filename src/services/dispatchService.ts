import { db } from '@/firebase/config';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, writeBatch
} from 'firebase/firestore';
import { offlineDb, OfflineDispatch } from '@/lib/offlineDb';

export interface DispatchFormData {
  dispatchDate?: Date;
  shift: 'morning' | 'evening';
  tankerNumber: string;
  driverName?: string;
  liters: number;
  fat: number;
  snf: number;
  notes?: string;
}

export interface ReceiptFormData {
  plantLiters: number;
  plantFat: number;
  plantSnf: number;
  notes?: string;
}

export const dispatchService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'dispatches'),

  getAll: async (centerId: string): Promise<OfflineDispatch[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          dispatchService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const cloudDispatches = snap.docs.map(doc => {
          const d = doc.data();
          const dispatchDate = d.dispatchDate ? (d.dispatchDate.toDate ? d.dispatchDate.toDate() : new Date(d.dispatchDate)) : new Date();
          const createdAt = d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt)) : new Date();
          return {
            id: doc.id,
            ...d,
            dispatchDate,
            createdAt
          } as OfflineDispatch;
        });

        // Sync to IndexedDB cache
        const syncTime = Date.now();
        for (const d of cloudDispatches) {
          await offlineDb.dispatches.put({
            ...d,
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudDispatches;
      } catch (err) {
        console.warn("Failed to fetch dispatches online, loading from cache:", err);
      }
    }

    const localD = await offlineDb.dispatches
      .where('centerId').equals(centerId)
      .and(d => d.isDeleted !== 1)
      .toArray();

    return localD.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  add: async (centerId: string, data: DispatchFormData, createdBy: string): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        const ref = doc(dispatchService.getCollectionRef(centerId));
        const record = {
          ...data,
          dispatchDate: data.dispatchDate ?? new Date(),
          status: 'dispatched',
          createdBy,
          createdAt: serverTimestamp()
        };
        await setDoc(ref, record);

        await offlineDb.dispatches.put({
          id: ref.id,
          ...data,
          dispatchDate: data.dispatchDate ?? new Date(),
          status: 'dispatched',
          centerId,
          createdBy,
          createdAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        return ref.id;
      } catch (err) {
        console.warn("Failed to add dispatch online, writing offline:", err);
      }
    }

    // Offline write
    const localId = `disp-${Date.now()}`;
    const localTime = Date.now();

    await offlineDb.dispatches.put({
      id: localId,
      ...data,
      dispatchDate: data.dispatchDate ?? new Date(),
      status: 'dispatched',
      centerId,
      createdBy,
      createdAt: new Date(localTime),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    return localId;
  },

  updateReceipt: async (centerId: string, id: string, data: ReceiptFormData): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const dispatch = await offlineDb.dispatches.get(id);
    if (!dispatch) throw new Error('Dispatch record not found');

    const lossLiters = Math.max(0, dispatch.liters - data.plantLiters);
    const lossFat = Math.max(0, dispatch.fat - data.plantFat);
    const lossSnf = Math.max(0, dispatch.snf - data.plantSnf);

    const updatedFields = {
      plantLiters: data.plantLiters,
      plantFat: data.plantFat,
      plantSnf: data.plantSnf,
      lossLiters,
      lossFat,
      lossSnf,
      status: 'received' as const,
      notes: data.notes ?? dispatch.notes
    };

    if (isOnline && !id.startsWith('disp-')) {
      try {
        const ref = doc(dispatchService.getCollectionRef(centerId), id);
        await setDoc(ref, updatedFields, { merge: true });

        await offlineDb.dispatches.update(id, {
          ...updatedFields,
          pendingSync: 0,
          localUpdatedAt: Date.now()
        });
        return;
      } catch (err) {
        console.warn("Online receipt update failed, writing offline:", err);
      }
    }

    // Offline / fallback write
    await offlineDb.dispatches.update(id, {
      ...updatedFields,
      pendingSync: 1,
      localUpdatedAt: Date.now()
    });
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline && !id.startsWith('disp-')) {
      try {
        await deleteDoc(doc(dispatchService.getCollectionRef(centerId), id));
        await offlineDb.dispatches.delete(id);
        return;
      } catch (err) {
        console.warn("Failed to delete dispatch online, deleting offline:", err);
      }
    }

    // Offline write
    if (id.startsWith('disp-')) {
      await offlineDb.dispatches.delete(id);
    } else {
      await offlineDb.dispatches.update(id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
    }
  }
};
