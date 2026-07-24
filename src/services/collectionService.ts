import { db } from '@/firebase/config';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, Timestamp,
  runTransaction, writeBatch
} from 'firebase/firestore';
import { Collection, CollectionFormData, LedgerEntry } from '@/types';
import { recalculateAndSyncFarmerBalance, calculateFarmerBalance } from '@/lib/balance';
import { offlineDb } from '@/lib/offlineDb';

export const collectionService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'collections'),

  /** Returns all collections ordered by most recent first */
  getAll: async (centerId: string): Promise<Collection[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          collectionService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const cloudCols = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Collection));

        // Cache in background
        const syncTime = Date.now();
        for (const c of cloudCols) {
          await offlineDb.collections.put({
            ...c,
            createdAt: (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudCols;
      } catch (err) {
        console.warn("Failed to fetch collections online, using local cache:", err);
      }
    }

    // Load from IndexedDB if offline or on error
    const localCols = await offlineDb.collections
      .where('centerId').equals(centerId)
      .and(c => c.isDeleted !== 1)
      .toArray();

    // Sort by createdAt descending
    return localCols.sort((a, b) => {
      const timeA = new Date(a.createdAt as any).getTime();
      const timeB = new Date(b.createdAt as any).getTime();
      return timeB - timeA;
    });
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
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          collectionService.getCollectionRef(centerId),
          where('farmerId', '==', farmerId)
        );
        const snapshot = await getDocs(q);
        const cloudCols = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Collection));

        // Update IndexedDB cache
        const syncTime = Date.now();
        for (const c of cloudCols) {
          await offlineDb.collections.put({
            ...c,
            createdAt: (c.createdAt as any).toDate ? (c.createdAt as any).toDate() : new Date(c.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudCols.sort((a, b) => {
          const timeA = (a.createdAt as any)?.toMillis?.() || new Date(a.createdAt as any).getTime();
          const timeB = (b.createdAt as any)?.toMillis?.() || new Date(b.createdAt as any).getTime();
          return timeB - timeA;
        });
      } catch (err) {
        console.warn("Failed to fetch collections by farmer online, using local cache:", err);
      }
    }

    const localCols = await offlineDb.collections
      .where('farmerId').equals(farmerId)
      .and(c => c.centerId === centerId && c.isDeleted !== 1)
      .toArray();

    return localCols.sort((a, b) => {
      const timeA = new Date(a.createdAt as any).getTime();
      const timeB = new Date(b.createdAt as any).getTime();
      return timeB - timeA;
    });
  },

  add: async (
    centerId: string,
    data: CollectionFormData,
    createdBy: string
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        const newId = await runTransaction(db, async (tx) => {
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

        // Sync local IndexedDB for this collection & ledger entry
        const syncTime = Date.now();
        await offlineDb.collections.put({
          id: newId,
          ...data,
          createdBy,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        // Fetch new balance to update local farmer cached balance
        await recalculateAndSyncFarmerBalance(centerId, data.farmerId);

        return newId;
      } catch (err) {
        console.warn("Online collection add failed, falling back to offline write:", err);
      }
    }

    // Offline mode or online write failed
    const newId = `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localTime = Date.now();

    // 1. Fetch farmer from local cache to get current balance
    const farmer = await offlineDb.farmers.get(data.farmerId);
    if (!farmer) throw new Error('Farmer not found in local cache');
    const currentBalance = farmer.balance || 0;
    const newBalance = currentBalance + data.totalAmount;

    // 2. Write collection to IndexedDB
    await offlineDb.collections.put({
      id: newId,
      ...data,
      createdBy,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    // 3. Write ledger entry to IndexedDB
    await offlineDb.ledger.put({
      id: ledgerId,
      farmerId: data.farmerId,
      transactionType: 'milk_collection',
      description: `Milk Collection - ${data.shift} (Offline)`,
      credit: data.totalAmount,
      debit: 0,
      balance: newBalance,
      referenceId: newId,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    // 4. Update local farmer cached balance
    await offlineDb.farmers.update(data.farmerId, { balance: newBalance });

    return newId;
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    // 1. Find farmer ID from local or cloud collection
    let farmerId: string | null = null;
    const localCol = await offlineDb.collections.get(id);
    if (localCol) {
      farmerId = localCol.farmerId;
    } else if (isOnline) {
      const colRef = doc(collectionService.getCollectionRef(centerId), id);
      const colDoc = await getDoc(colRef);
      if (colDoc.exists()) {
        farmerId = colDoc.data().farmerId;
      }
    }
    if (!farmerId) throw new Error('Collection not found');

    if (isOnline) {
      try {
        const colRef = doc(collectionService.getCollectionRef(centerId), id);

        // Find ledger entries to delete
        const ledgerCollectionRef = collection(db, 'centers', centerId, 'ledger');
        const ledgerQuery = query(ledgerCollectionRef, where('farmerId', '==', farmerId));
        const ledgerSnap = await getDocs(ledgerQuery);

        const batch = writeBatch(db);
        batch.delete(colRef);

        ledgerSnap.docs.forEach(docSnap => {
          const entry = docSnap.data() as LedgerEntry;
          if (entry.referenceId === id && entry.transactionType === 'milk_collection') {
            batch.delete(docSnap.ref);
          }
        });

        await batch.commit();

        // Sync local IndexedDB
        await offlineDb.collections.delete(id);
        const localLedgers = await offlineDb.ledger
          .where('referenceId').equals(id)
          .toArray();
        for (const ll of localLedgers) {
          await offlineDb.ledger.delete(ll.id);
        }

        // Recalculate
        await recalculateAndSyncFarmerBalance(centerId, farmerId);
        return;
      } catch (err) {
        console.warn("Online collection delete failed, falling back to offline write:", err);
      }
    }

    // Offline mode / online delete failed
    if (id.startsWith('col-')) {
      // Local-only collection: delete completely
      await offlineDb.collections.delete(id);
      const localLedgers = await offlineDb.ledger
        .where('referenceId').equals(id)
        .toArray();
      for (const ll of localLedgers) {
        await offlineDb.ledger.delete(ll.id);
      }
    } else {
      // Soft-delete synced collection
      await offlineDb.collections.update(id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      const localLedgers = await offlineDb.ledger
        .where('referenceId').equals(id)
        .toArray();
      for (const ll of localLedgers) {
        await offlineDb.ledger.update(ll.id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      }
    }

    // Recalculate local balance for farmer
    const allFarmerLedger = await offlineDb.ledger
      .where('farmerId').equals(farmerId)
      .and(l => l.centerId === centerId && l.isDeleted !== 1)
      .toArray();

    const { balance } = calculateFarmerBalance(allFarmerLedger);
    await offlineDb.farmers.update(farmerId, { balance });
  },
};
