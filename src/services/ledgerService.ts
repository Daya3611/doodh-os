import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, runTransaction,
} from 'firebase/firestore';
import { LedgerEntry } from '@/types';

export const ledgerService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'ledger'),

  /** Get all ledger entries for a specific farmer */
  getByFarmer: async (centerId: string, farmerId: string): Promise<LedgerEntry[]> => {
    const q = query(
      ledgerService.getCollectionRef(centerId),
      where('farmerId', '==', farmerId)
    );
    const snap = await getDocs(q);
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
    // Sort in JS to avoid needing a composite index
    return entries.sort((a, b) => {
      const timeA = (a.createdAt as any)?.toMillis?.() || 0;
      const timeB = (b.createdAt as any)?.toMillis?.() || 0;
      return timeB - timeA;
    });
  },

  /** Get all ledger entries for the center */
  getAll: async (centerId: string): Promise<LedgerEntry[]> => {
    const q = query(
      ledgerService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
  },
  
  // Note: We don't usually add/delete ledger entries directly.
  // They are created via transactions in collectionService, paymentService, purchaseService.
};
