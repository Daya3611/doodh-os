import { db } from '@/firebase/config';
import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, 
  query, where, serverTimestamp, orderBy, writeBatch, runTransaction, Timestamp 
} from 'firebase/firestore';
import { recalculateAndSyncFarmerBalance, calculateFarmerBalance } from '@/lib/balance';
import { offlineDb, OfflineDeduction } from '@/lib/offlineDb';
import { LedgerEntry, DeductionFormData, Deduction, AccountsEntry } from '@/types';
import { format } from 'date-fns';

function toJsDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (typeof dateVal.toDate === 'function') {
    return dateVal.toDate();
  }
  return new Date(dateVal);
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
          const deductionDateVal = d.deductionDate ? ((d.deductionDate as any).toDate ? (d.deductionDate as any).toDate() : new Date(d.deductionDate as any)) : new Date();
          const fromDateVal = d.fromDate ? ((d.fromDate as any).toDate ? (d.fromDate as any).toDate() : new Date(d.fromDate as any)) : deductionDateVal;
          const toDateVal = d.toDate ? ((d.toDate as any).toDate ? (d.toDate as any).toDate() : new Date(d.toDate as any)) : deductionDateVal;
          const entryDateVal = d.entryDate ? ((d.entryDate as any).toDate ? (d.entryDate as any).toDate() : new Date(d.entryDate as any)) : deductionDateVal;
          const createdAtVal = d.createdAt ? ((d.createdAt as any).toDate ? (d.createdAt as any).toDate() : new Date(d.createdAt as any)) : new Date();
          const voucherNoVal = d.voucherNo || `VOC-DED-MIG-${d.id.slice(-6)}`;

          await offlineDb.deductions.put({
            ...d,
            deductionDate: deductionDateVal,
            fromDate: fromDateVal,
            toDate: toDateVal,
            entryDate: entryDateVal,
            createdAt: createdAtVal,
            voucherNo: voucherNoVal,
            deductionType: d.deductionType || 'other',
            paymentStatus: d.paymentStatus || 'pending',
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
      } catch (err) {
        console.warn("Failed to get deductions online, using local cache:", err);
      }
    }

    const localDeds = await offlineDb.deductions
      .where('centerId').equals(centerId)
      .and(d => d.isDeleted !== 1)
      .toArray();

    // Auto-migrate legacy records for backward compatibility
    for (const d of localDeds) {
      if (!d.fromDate || !d.toDate || !d.voucherNo) {
        const defaultDate = toJsDate(d.deductionDate || d.createdAt);
        const fromDate = d.fromDate ? toJsDate(d.fromDate) : defaultDate;
        const toDate = d.toDate ? toJsDate(d.toDate) : defaultDate;
        const entryDate = d.entryDate ? toJsDate(d.entryDate) : defaultDate;
        const voucherNo = d.voucherNo || `VOC-DED-MIG-${d.id.slice(-6)}`;

        await offlineDb.deductions.update(d.id, {
          fromDate,
          toDate,
          entryDate,
          voucherNo,
          deductionType: d.deductionType || 'other',
          paymentStatus: d.paymentStatus || 'pending'
        });

        // Seed missing local accounts entry
        const accExists = await offlineDb.accounts.where('voucherNo').equals(voucherNo).count();
        if (accExists === 0) {
          await offlineDb.accounts.put({
            id: `acc-mig-${d.id}`,
            voucherNo,
            farmerId: d.farmerId,
            farmerName: d.farmerName,
            transactionType: 'deduction',
            reason: d.reason,
            amount: d.amount,
            fromDate,
            toDate,
            entryDate,
            createdBy: d.createdBy || 'unknown',
            createdAt: d.createdAt || new Date(),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
        }

        // Fix properties in reference so it maps correctly in memory
        d.fromDate = fromDate;
        d.toDate = toDate;
        d.entryDate = entryDate;
        d.voucherNo = voucherNo;
        d.deductionType = d.deductionType || 'other';
        d.paymentStatus = d.paymentStatus || 'pending';
      }
    }

    return localDeds.sort((a, b) => {
      return toJsDate(b.createdAt).getTime() - toJsDate(a.createdAt).getTime();
    });
  },

  getByFarmer: async (centerId: string, farmerId: string): Promise<OfflineDeduction[]> => {
    const all = await deductionService.getAll(centerId);
    return all.filter(d => d.farmerId === farmerId);
  },

  add: async (centerId: string, data: DeductionFormData, createdBy: string): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const voucherNo = `VOC-DED-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const fromDateObj = new Date(data.fromDate);
    const toDateObj = new Date(data.toDate);
    const entryDateObj = data.entryDate ? new Date(data.entryDate) : new Date();
    const formattedPeriod = `${format(fromDateObj, 'dd MMM')} → ${format(toDateObj, 'dd MMM yyyy')}`;

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
            voucherNo,
            fromDate: Timestamp.fromDate(fromDateObj),
            toDate: Timestamp.fromDate(toDateObj),
            entryDate: Timestamp.fromDate(entryDateObj),
            deductionDate: Timestamp.fromDate(entryDateObj), // keep for backward compatibility
            paymentStatus: 'pending',
            createdBy,
            createdAt: serverTimestamp(),
          });

          // 2.5 Create accounts entry
          const accRef = doc(collection(db, 'centers', centerId, 'accounts'));
          tx.set(accRef, {
            voucherNo,
            farmerId: data.farmerId,
            farmerName: data.farmerName,
            transactionType: 'deduction',
            reason: data.reason,
            amount: data.amount,
            fromDate: Timestamp.fromDate(fromDateObj),
            toDate: Timestamp.fromDate(toDateObj),
            entryDate: Timestamp.fromDate(entryDateObj),
            createdBy,
            createdAt: serverTimestamp(),
          });

          // 3. Create ledger entry
          const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
          tx.set(ledgerRef, {
            farmerId: data.farmerId,
            transactionType: 'deduction',
            description: `Deduction - ${data.reason.replace(/_/g, ' ')}`,
            credit: 0,
            debit: data.amount,
            balance: newBalance,
            referenceId: dedRef.id,
            paymentPeriod: formattedPeriod,
            createdAt: serverTimestamp(),
          });

          // 4. Update farmer balance
          tx.update(farmerRef, { balance: newBalance });

          return { dedId: dedRef.id, accId: accRef.id, ledgerId: ledgerRef.id, newBalance };
        });

        // Sync local cache
        const syncTime = Date.now();
        await offlineDb.deductions.put({
          id: newId.dedId,
          ...data,
          voucherNo,
          fromDate: fromDateObj,
          toDate: toDateObj,
          entryDate: entryDateObj,
          deductionDate: entryDateObj,
          paymentStatus: 'pending',
          createdBy,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        await offlineDb.accounts.put({
          id: newId.accId,
          voucherNo,
          farmerId: data.farmerId,
          farmerName: data.farmerName,
          transactionType: 'deduction',
          reason: data.reason,
          amount: data.amount,
          fromDate: fromDateObj,
          toDate: toDateObj,
          entryDate: entryDateObj,
          createdBy,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        await offlineDb.ledger.put({
          id: newId.ledgerId,
          farmerId: data.farmerId,
          transactionType: 'deduction',
          description: `Deduction - ${data.reason.replace(/_/g, ' ')}`,
          credit: 0,
          debit: data.amount,
          balance: newId.newBalance, // Will recalculate anyway
          referenceId: newId.dedId,
          paymentPeriod: formattedPeriod,
          createdAt: new Date(),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: syncTime
        });

        await recalculateAndSyncFarmerBalance(centerId, data.farmerId);
        return newId.dedId;
      } catch (err) {
        console.warn("Online deduction add failed, falling back to offline write:", err);
      }
    }

    // Offline write
    const newId = `ded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const accId = `acc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localTime = Date.now();

    const farmer = await offlineDb.farmers.get(data.farmerId);
    if (!farmer) throw new Error('Farmer not found in cache');
    const currentBalance = farmer.balance || 0;
    const newBalance = currentBalance - data.amount;

    await offlineDb.deductions.put({
      id: newId,
      ...data,
      voucherNo,
      fromDate: fromDateObj,
      toDate: toDateObj,
      entryDate: entryDateObj,
      deductionDate: entryDateObj,
      paymentStatus: 'pending',
      createdBy,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    await offlineDb.accounts.put({
      id: accId,
      voucherNo,
      farmerId: data.farmerId,
      farmerName: data.farmerName,
      transactionType: 'deduction',
      reason: data.reason,
      amount: data.amount,
      fromDate: fromDateObj,
      toDate: toDateObj,
      entryDate: entryDateObj,
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
      description: `Deduction - ${data.reason.replace(/_/g, ' ')} (Offline)`,
      credit: 0,
      debit: data.amount,
      balance: newBalance,
      referenceId: newId,
      paymentPeriod: formattedPeriod,
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

        // Delete accounts entry in firebase
        if (localDed?.voucherNo) {
          const accSnap = await getDocs(query(collection(db, 'centers', centerId, 'accounts'), where('voucherNo', '==', localDed.voucherNo)));
          accSnap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
        }

        await batch.commit();

        await offlineDb.deductions.delete(id);
        const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
        for (const l of localLedgers) {
          await offlineDb.ledger.delete(l.id);
        }

        if (localDed?.voucherNo) {
          const localAccs = await offlineDb.accounts.where('voucherNo').equals(localDed.voucherNo).toArray();
          for (const a of localAccs) {
            await offlineDb.accounts.delete(a.id);
          }
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
      if (localDed?.voucherNo) {
        const localAccs = await offlineDb.accounts.where('voucherNo').equals(localDed.voucherNo).toArray();
        for (const a of localAccs) {
          await offlineDb.accounts.delete(a.id);
        }
      }
    } else {
      await offlineDb.deductions.update(id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
      for (const l of localLedgers) {
        await offlineDb.ledger.update(l.id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      }
      if (localDed?.voucherNo) {
        const localAccs = await offlineDb.accounts.where('voucherNo').equals(localDed.voucherNo).toArray();
        for (const a of localAccs) {
          await offlineDb.accounts.update(a.id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
        }
      }
    }

    // Recalculate local balance
    const ledgers = await offlineDb.ledger.where('farmerId').equals(farmerId).and(l => l.centerId === centerId && l.isDeleted !== 1).toArray();
    const { balance } = calculateFarmerBalance(ledgers);
    await offlineDb.farmers.update(farmerId, { balance });
  }
};
