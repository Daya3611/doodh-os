import { db } from '@/firebase/config';
import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, 
  query, where, serverTimestamp, orderBy, writeBatch, runTransaction, Timestamp 
} from 'firebase/firestore';
import { recalculateAndSyncFarmerBalance, calculateFarmerBalance } from '@/lib/balance';
import { offlineDb, OfflineDeduction } from '@/lib/offlineDb';
import { LedgerEntry } from '@/types';

export interface DeductionFormData {
  farmerId: string;
  farmerName: string;
  amount: number;
  reason: 'spoiled_milk' | 'rate_difference' | 'advance' | 'penalty' | 'other';
  notes?: string;
  deductionDate?: Date;
}

export const deductionService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'deductions'),

  getAll: async (centerId: string): Promise<OfflineDeduction[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          deductionService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const cloudDeds = snap.docs.map(d => ({ id: d.id, ...d.data() } as OfflineDeduction));

        // Cache in background
        const syncTime = Date.now();
        for (const d of cloudDeds) {
          await offlineDb.deductions.put({
            ...d,
            deductionDate: (d.deductionDate as any).toDate ? (d.deductionDate as any).toDate() : new Date(d.deductionDate as any),
            createdAt: (d.createdAt as any).toDate ? (d.createdAt as any).toDate() : new Date(d.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudDeds;
      } catch (err) {
        console.warn("Failed to get deductions online, using local cache:", err);
      }
    }

    const localDeds = await offlineDb.deductions
      .where('centerId').equals(centerId)
      .and(d => d.isDeleted !== 1)
      .toArray();

    return localDeds.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  getByFarmer: async (centerId: string, farmerId: string): Promise<OfflineDeduction[]> => {
    const all = await deductionService.getAll(centerId);
    return all.filter(d => d.farmerId === farmerId);
  },

  add: async (centerId: string, data: DeductionFormData, createdBy: string): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        const newId = await runTransaction(db, async (tx) => {
          // 1. Get farmer
          const farmerRef = doc(db, 'centers', centerId, 'farmers', data.farmerId);
          const farmerDoc = await tx.get(farmerRef);
          if (!farmerDoc.exists()) throw new Error('Farmer not found');
          
          const currentBalance = farmerDoc.data().balance || 0;
          const newBalance = currentBalance - data.amount; // Debit reduces balance

          // 2. Create deduction document
          const dedRef = doc(deductionService.getCollectionRef(centerId));
          tx.set(dedRef, {
            ...data,
            deductionDate: data.deductionDate ?? new Date(),
            createdBy,
            createdAt: serverTimestamp(),
          });

          // 3. Create ledger entry
          const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
          tx.set(ledgerRef, {
            farmerId: data.farmerId,
            transactionType: 'deduction',
            description: `Deduction - ${data.reason.replace('_', ' ')}`,
            credit: 0,
            debit: data.amount,
            balance: newBalance,
            referenceId: dedRef.id,
            createdAt: serverTimestamp(),
          });

          // 4. Update farmer balance
          tx.update(farmerRef, { balance: newBalance });

          return dedRef.id;
        });

        // Sync local cache
        const syncTime = Date.now();
        await offlineDb.deductions.put({
          id: newId,
          ...data,
          deductionDate: data.deductionDate ?? new Date(),
          createdBy,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        await recalculateAndSyncFarmerBalance(centerId, data.farmerId);
        return newId;
      } catch (err) {
        console.warn("Online deduction add failed, falling back to offline write:", err);
      }
    }

    // Offline write
    const newId = `ded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localTime = Date.now();

    const farmer = await offlineDb.farmers.get(data.farmerId);
    if (!farmer) throw new Error('Farmer not found in cache');
    const currentBalance = farmer.balance || 0;
    const newBalance = currentBalance - data.amount;

    await offlineDb.deductions.put({
      id: newId,
      ...data,
      deductionDate: data.deductionDate ?? new Date(),
      createdBy,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    await offlineDb.ledger.put({
      id: ledgerId,
      farmerId: data.farmerId,
      transactionType: 'deduction',
      description: `Deduction - ${data.reason.replace('_', ' ')} (Offline)`,
      credit: 0,
      debit: data.amount,
      balance: newBalance,
      referenceId: newId,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    await offlineDb.farmers.update(data.farmerId, { balance: newBalance });

    return newId;
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    let farmerId: string | null = null;
    const localDed = await offlineDb.deductions.get(id);
    if (localDed) {
      farmerId = localDed.farmerId;
    } else if (isOnline) {
      const docSnap = await getDoc(doc(deductionService.getCollectionRef(centerId), id));
      if (docSnap.exists()) {
        farmerId = docSnap.data().farmerId;
      }
    }
    if (!farmerId) throw new Error('Deduction not found');

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(deductionService.getCollectionRef(centerId), id));

        const ledgerSnap = await getDocs(query(collection(db, 'centers', centerId, 'ledger'), where('farmerId', '==', farmerId)));
        ledgerSnap.docs.forEach(docSnap => {
          const entry = docSnap.data() as LedgerEntry;
          if (entry.referenceId === id && entry.transactionType === 'deduction') {
            batch.delete(docSnap.ref);
          }
        });

        await batch.commit();

        await offlineDb.deductions.delete(id);
        const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
        for (const l of localLedgers) {
          await offlineDb.ledger.delete(l.id);
        }

        await recalculateAndSyncFarmerBalance(centerId, farmerId);
        return;
      } catch (err) {
        console.warn("Online delete failed, falling back to offline write:", err);
      }
    }

    // Offline / fallback delete
    if (id.startsWith('ded-')) {
      await offlineDb.deductions.delete(id);
      const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
      for (const l of localLedgers) {
        await offlineDb.ledger.delete(l.id);
      }
    } else {
      await offlineDb.deductions.update(id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
      for (const l of localLedgers) {
        await offlineDb.ledger.update(l.id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      }
    }

    // Recalculate local balance
    const ledgers = await offlineDb.ledger.where('farmerId').equals(farmerId).and(l => l.centerId === centerId && l.isDeleted !== 1).toArray();
    const { balance } = calculateFarmerBalance(ledgers);
    await offlineDb.farmers.update(farmerId, { balance });
  }
};
