import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { Collection, CollectionFormData } from '@/types';

export const collectionService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'collections'),

  /** Returns all collections ordered by most recent first */
  getAll: async (centerId: string): Promise<Collection[]> => {
    const q = query(
      collectionService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Collection));
  },

  /** Returns today's collections (client-side date filter for simplicity) */
  getToday: async (centerId: string): Promise<Collection[]> => {
    const all = await collectionService.getAll(centerId);
    const todayStr = new Date().toDateString();
    return all.filter(c => {
      if (!c.createdAt) return false;
      const d = (c.createdAt as any).toDate
        ? (c.createdAt as any).toDate()
        : new Date(c.createdAt as any);
      return d.toDateString() === todayStr;
    });
  },

  /** Returns collections for a specific farmer */
  getByFarmer: async (centerId: string, farmerId: string): Promise<Collection[]> => {
    const q = query(
      collectionService.getCollectionRef(centerId),
      where('farmerId', '==', farmerId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Collection));
  },

  add: async (
    centerId: string,
    data: CollectionFormData,
    createdBy: string
  ): Promise<string> => {
    return await runTransaction(db, async (tx) => {
      // 1. Get the farmer to update balance
      const farmerRef = doc(db, 'centers', centerId, 'farmers', data.farmerId);
      const farmerDoc = await tx.get(farmerRef);
      if (!farmerDoc.exists()) throw new Error('Farmer not found');
      
      const currentBalance = farmerDoc.data().balance || 0;
      const newBalance = currentBalance + data.totalAmount; // Credit increases balance

      // 2. Create the collection document
      const newDocRef = doc(collectionService.getCollectionRef(centerId));
      tx.set(newDocRef, {
        ...data,
        createdBy,
        createdAt: serverTimestamp(),
      });

      // 3. Create the ledger entry
      const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
      tx.set(ledgerRef, {
        farmerId: data.farmerId,
        transactionType: 'milk_collection',
        description: `Milk Collection - ${data.shift}`,
        credit: data.totalAmount,
        debit: 0,
        balance: newBalance,
        referenceId: newDocRef.id,
        createdAt: serverTimestamp(),
      });

      // 4. Update farmer balance
      tx.update(farmerRef, { balance: newBalance });

      return newDocRef.id;
    });
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    await runTransaction(db, async (tx) => {
      // 1. Get the collection to know how much to reverse
      const colRef = doc(collectionService.getCollectionRef(centerId), id);
      const colDoc = await tx.get(colRef);
      if (!colDoc.exists()) throw new Error('Collection not found');
      
      const colData = colDoc.data() as CollectionFormData;
      
      // 2. Get the farmer
      const farmerRef = doc(db, 'centers', centerId, 'farmers', colData.farmerId);
      const farmerDoc = await tx.get(farmerRef);
      
      if (farmerDoc.exists()) {
        const currentBalance = farmerDoc.data().balance || 0;
        const newBalance = currentBalance - colData.totalAmount; // Reverse credit
        
        // 3. Create adjusting ledger entry
        const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
        tx.set(ledgerRef, {
          farmerId: colData.farmerId,
          transactionType: 'adjustment',
          description: `Deleted Collection ${id}`,
          credit: 0,
          debit: colData.totalAmount, // Debiting what was previously credited
          balance: newBalance,
          referenceId: id,
          createdAt: serverTimestamp(),
        });
        
        // 4. Update farmer balance
        tx.update(farmerRef, { balance: newBalance });
      }

      // 5. Delete the collection
      tx.delete(colRef);
    });
  },
};
