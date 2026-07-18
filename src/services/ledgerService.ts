import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, runTransaction,
} from 'firebase/firestore';
import { LedgerEntry } from '@/types';
import { offlineDb } from '@/lib/offlineDb';

export const ledgerService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'ledger'),

  /** Get all ledger entries for a specific farmer */
  getByFarmer: async (centerId: string, farmerId: string): Promise<LedgerEntry[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          ledgerService.getCollectionRef(centerId),
          where('farmerId', '==', farmerId)
        );
        const snap = await getDocs(q);
        const cloudEntries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
        
        // Cache in background
        const syncTime = Date.now();
        for (const l of cloudEntries) {
          await offlineDb.ledger.put({
            ...l,
            createdAt: (l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudEntries.sort((a, b) => {
          const timeA = (a.createdAt as any)?.toMillis?.() || 0;
          const timeB = (b.createdAt as any)?.toMillis?.() || 0;
          return timeB - timeA;
        });
      } catch (err) {
        console.warn("Failed to get ledger by farmer online, using local cache:", err);
      }
    }

    const localEntries = await offlineDb.ledger
      .where('farmerId').equals(farmerId)
      .and(l => l.centerId === centerId && l.isDeleted !== 1)
      .toArray();

    return localEntries.sort((a, b) => {
      const timeA = new Date(a.createdAt as any).getTime();
      const timeB = new Date(b.createdAt as any).getTime();
      return timeB - timeA;
    });
  },

  /** Get all ledger entries for the center */
  getAll: async (centerId: string): Promise<LedgerEntry[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          ledgerService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const cloudEntries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));

        // Cache in background
        const syncTime = Date.now();
        for (const l of cloudEntries) {
          await offlineDb.ledger.put({
            ...l,
            createdAt: (l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudEntries;
      } catch (err) {
        console.warn("Failed to get all ledgers online, using local cache:", err);
      }
    }

    const localEntries = await offlineDb.ledger
      .where('centerId').equals(centerId)
      .and(l => l.isDeleted !== 1)
      .toArray();

    return localEntries.sort((a, b) => {
      const timeA = new Date(a.createdAt as any).getTime();
      const timeB = new Date(b.createdAt as any).getTime();
      return timeB - timeA;
    });
  },
  
  // Note: We don't usually add/delete ledger entries directly.
  // They are created via transactions in collectionService, paymentService, purchaseService.
};
