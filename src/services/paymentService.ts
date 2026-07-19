import { db } from '@/firebase/config';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, Timestamp, runTransaction, writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns';
import { recalculateAndSyncFarmerBalance, calculateFarmerBalance } from '@/lib/balance';
import { LedgerEntry, Payment, PaymentFormData } from '@/types';
import { offlineDb } from '@/lib/offlineDb';

export const paymentService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'payments'),

  getAll: async (centerId: string): Promise<Payment[]> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        const q = query(
          paymentService.getCollectionRef(centerId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const cloudPayments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));

        // Cache in IndexedDB
        const syncTime = Date.now();
        for (const p of cloudPayments) {
          await offlineDb.payments.put({
            ...p,
            paymentDate: p.paymentDate ? ((p.paymentDate as any).toDate ? (p.paymentDate as any).toDate() : new Date(p.paymentDate as any)) : new Date(),
            fromDate: p.fromDate ? ((p.fromDate as any).toDate ? (p.fromDate as any).toDate() : new Date(p.fromDate as any)) : new Date(),
            toDate: p.toDate ? ((p.toDate as any).toDate ? (p.toDate as any).toDate() : new Date(p.toDate as any)) : new Date(),
            createdAt: p.createdAt ? ((p.createdAt as any).toDate ? (p.createdAt as any).toDate() : new Date(p.createdAt as any)) : new Date(),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudPayments;
      } catch (err) {
        console.warn("Failed to fetch payments online, using local cache:", err);
      }
    }

    const localPayments = await offlineDb.payments
      .where('centerId').equals(centerId)
      .and(p => p.isDeleted !== 1)
      .toArray();

    return localPayments.sort((a, b) => {
      const timeA = new Date(a.createdAt as any).getTime();
      const timeB = new Date(b.createdAt as any).getTime();
      return timeB - timeA;
    });
  },

  getByFarmer: async (centerId: string, farmerId: string): Promise<Payment[]> => {
    const all = await paymentService.getAll(centerId);
    return all.filter(p => p.farmerId.toLowerCase() === farmerId.toLowerCase());
  },

  add: async (centerId: string, data: PaymentFormData, createdBy: string): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localTime = Date.now();

    if (isOnline) {
      try {
        await runTransaction(db, async (tx) => {
          // 1. Get the farmer to update balance
          const farmerRef = doc(db, 'centers', centerId, 'farmers', data.farmerId);
          const farmerDoc = await tx.get(farmerRef);
          if (!farmerDoc.exists()) throw new Error('Farmer not found');
          
          const currentBalance = farmerDoc.data().balance || 0;
          const newBalance = currentBalance + (data.bonus || 0) - data.amount;

          // 2. Fetch collections of this farmer within the date range that are not paid yet
          const colQuery = query(
            collection(db, 'centers', centerId, 'collections'),
            where('farmerId', '==', data.farmerId),
            where('createdAt', '>=', Timestamp.fromDate(new Date(data.fromDate))),
            where('createdAt', '<=', Timestamp.fromDate(new Date(data.toDate)))
          );
          const colSnap = await getDocs(colQuery);
          const colDocsToUpdate = colSnap.docs.filter(doc => {
            const d = doc.data();
            return !d.paymentId && d.paymentStatus !== 'paid';
          });

          // 2.5 Fetch deductions of this farmer within the date range that are not paid yet
          const dedQuery = query(
            collection(db, 'centers', centerId, 'deductions'),
            where('farmerId', '==', data.farmerId),
            where('fromDate', '>=', Timestamp.fromDate(new Date(data.fromDate))),
            where('toDate', '<=', Timestamp.fromDate(new Date(data.toDate)))
          );
          const dedSnap = await getDocs(dedQuery);
          const dedDocsToUpdate = dedSnap.docs.filter(doc => {
            const d = doc.data();
            return !d.paymentId && d.paymentStatus !== 'paid' && d.isDeleted !== 1;
          });

          // 3. Create the payment document
          const ref = doc(paymentService.getCollectionRef(centerId), paymentId);
          tx.set(ref, {
            ...data,
            id: paymentId,
            paymentDate: data.paymentDate ?? new Date(),
            fromDate: Timestamp.fromDate(new Date(data.fromDate)),
            toDate: Timestamp.fromDate(new Date(data.toDate)),
            createdBy,
            createdAt: serverTimestamp(),
          });

          // 4. Create the ledger entry
          const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'), ledgerId);
          tx.set(ledgerRef, {
            farmerId: data.farmerId,
            transactionType: 'payment',
            description: `Payment for ${format(new Date(data.fromDate), 'dd MMM')} - ${format(new Date(data.toDate), 'dd MMM')}${data.bonus > 0 ? ` (with Bonus: ₹${data.bonus})` : ''}`,
            credit: data.bonus || 0,
            debit: data.amount,
            balance: newBalance,
            referenceId: paymentId,
            createdAt: serverTimestamp(),
          });

          // 5. Mark collections as paid
          for (const doc of colDocsToUpdate) {
            tx.update(doc.ref, {
              paymentId,
              paymentStatus: 'paid'
            });
          }

          // 5.5 Mark deductions as paid
          for (const doc of dedDocsToUpdate) {
            tx.update(doc.ref, {
              paymentId,
              paymentStatus: 'paid'
            });
          }

          // 6. Update farmer balance
          tx.update(farmerRef, { balance: newBalance });
        });

        // Cache locally after successful online write
        await offlineDb.payments.put({
          id: paymentId,
          ...data,
          paymentDate: data.paymentDate ?? new Date(),
          fromDate: new Date(data.fromDate),
          toDate: new Date(data.toDate),
          createdBy,
          createdAt: new Date(localTime),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: localTime
        });

        // Update local collections
        const localCols = await offlineDb.collections
          .where('farmerId').equals(data.farmerId)
          .toArray();
        const startMs = new Date(data.fromDate).getTime();
        const endMs = new Date(data.toDate).getTime();

        for (const c of localCols) {
          const cTime = new Date(c.createdAt as any).getTime();
          if (cTime >= startMs && cTime <= endMs && !c.paymentId) {
            await offlineDb.collections.update(c.id, {
              paymentId,
              paymentStatus: 'paid',
              localUpdatedAt: localTime
            });
          }
        }

        // Update local deductions
        const localDeds = await offlineDb.deductions
          .where('farmerId').equals(data.farmerId)
          .toArray();
        for (const d of localDeds) {
          const dFrom = new Date(d.fromDate).getTime();
          const dTo = new Date(d.toDate).getTime();
          if (dFrom >= startMs && dTo <= endMs && !d.paymentId && d.isDeleted !== 1) {
            await offlineDb.deductions.update(d.id, {
              paymentId,
              paymentStatus: 'paid',
              localUpdatedAt: localTime
            });
          }
        }

        // Cache ledger entry locally
        await offlineDb.ledger.put({
          id: ledgerId,
          farmerId: data.farmerId,
          transactionType: 'payment',
          description: `Payment for ${format(new Date(data.fromDate), 'dd MMM')} - ${format(new Date(data.toDate), 'dd MMM')}${data.bonus > 0 ? ` (with Bonus: ₹${data.bonus})` : ''}`,
          credit: data.bonus || 0,
          debit: data.amount,
          balance: 0,
          referenceId: paymentId,
          createdAt: new Date(localTime),
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: localTime
        });

        await recalculateAndSyncFarmerBalance(centerId, data.farmerId);
        return paymentId;
      } catch (err) {
        console.warn("Online payment add failed, falling back to offline write:", err);
      }
    }

    // Offline mode
    const farmer = await offlineDb.farmers.get(data.farmerId);
    if (!farmer) throw new Error('Farmer not found');
    const currentBalance = farmer.balance || 0;
    const newBalance = currentBalance + (data.bonus || 0) - data.amount;

    await offlineDb.payments.put({
      id: paymentId,
      ...data,
      paymentDate: data.paymentDate ?? new Date(),
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
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
      transactionType: 'payment',
      description: `Payment for ${format(new Date(data.fromDate), 'dd MMM')} - ${format(new Date(data.toDate), 'dd MMM')}${data.bonus > 0 ? ` (with Bonus: ₹${data.bonus})` : ''} (Offline)`,
      credit: data.bonus || 0,
      debit: data.amount,
      balance: newBalance,
      referenceId: paymentId,
      createdAt: new Date(localTime),
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: localTime
    });

    // Update local collections
    const localCols = await offlineDb.collections
      .where('farmerId').equals(data.farmerId)
      .toArray();
    const startMs = new Date(data.fromDate).getTime();
    const endMs = new Date(data.toDate).getTime();

    for (const c of localCols) {
      const cTime = new Date(c.createdAt as any).getTime();
      if (cTime >= startMs && cTime <= endMs && !c.paymentId) {
        await offlineDb.collections.update(c.id, {
          paymentId,
          paymentStatus: 'paid',
          pendingSync: 1,
          localUpdatedAt: localTime
        });
      }
    }

    // Update local deductions
    const localDeds = await offlineDb.deductions
      .where('farmerId').equals(data.farmerId)
      .toArray();
    for (const d of localDeds) {
      const dFrom = new Date(d.fromDate).getTime();
      const dTo = new Date(d.toDate).getTime();
      if (dFrom >= startMs && dTo <= endMs && !d.paymentId && d.isDeleted !== 1) {
        await offlineDb.deductions.update(d.id, {
          paymentId,
          paymentStatus: 'paid',
          pendingSync: 1,
          localUpdatedAt: localTime
        });
      }
    }

    await offlineDb.farmers.update(data.farmerId, { balance: newBalance });
    return paymentId;
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    let farmerId: string | null = null;
    let paymentData: Payment | null = null;
    const localPay = await offlineDb.payments.get(id);
    if (localPay) {
      farmerId = localPay.farmerId;
      paymentData = localPay;
    } else if (isOnline) {
      const docSnap = await getDoc(doc(paymentService.getCollectionRef(centerId), id));
      if (docSnap.exists()) {
        farmerId = docSnap.data().farmerId;
        paymentData = { id: docSnap.id, ...docSnap.data() } as Payment;
      }
    }
    if (!farmerId || !paymentData) throw new Error('Payment not found');

    if (isOnline) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(paymentService.getCollectionRef(centerId), id));

        // Find ledger entries to delete
        const ledgerSnap = await getDocs(
          query(collection(db, 'centers', centerId, 'ledger'), where('farmerId', '==', farmerId))
        );
        ledgerSnap.docs.forEach(docSnap => {
          const entry = docSnap.data() as LedgerEntry;
          if (entry.referenceId === id && entry.transactionType === 'payment') {
            batch.delete(docSnap.ref);
          }
        });

        // Find collections to unlock
        const collectionsSnap = await getDocs(
          query(collection(db, 'centers', centerId, 'collections'), where('paymentId', '==', id))
        );
        collectionsSnap.docs.forEach(docSnap => {
          batch.update(docSnap.ref, {
            paymentId: null,
            paymentStatus: undefined
          });
        });

        // Find deductions to unlock
        const deductionsSnap = await getDocs(
          query(collection(db, 'centers', centerId, 'deductions'), where('paymentId', '==', id))
        );
        deductionsSnap.docs.forEach(docSnap => {
          batch.update(docSnap.ref, {
            paymentId: null,
            paymentStatus: 'pending'
          });
        });

        await batch.commit();

        // Local cache delete
        await offlineDb.payments.delete(id);
        const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
        for (const l of localLedgers) {
          await offlineDb.ledger.delete(l.id);
        }

        const localCols = await offlineDb.collections.where('paymentId').equals(id).toArray();
        for (const c of localCols) {
          await offlineDb.collections.update(c.id, {
            paymentId: null,
            paymentStatus: undefined,
            localUpdatedAt: Date.now()
          });
        }

        const localDeds = await offlineDb.deductions.where('paymentId').equals(id).toArray();
        for (const d of localDeds) {
          await offlineDb.deductions.update(d.id, {
            paymentId: null,
            paymentStatus: 'pending',
            localUpdatedAt: Date.now()
          });
        }

        await recalculateAndSyncFarmerBalance(centerId, farmerId);
        return;
      } catch (err) {
        console.warn("Online delete failed, falling back to offline write:", err);
      }
    }

    // Offline / fallback delete
    if (id.startsWith('pay-')) {
      await offlineDb.payments.delete(id);
      const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
      for (const l of localLedgers) {
        await offlineDb.ledger.delete(l.id);
      }
      const localCols = await offlineDb.collections.where('paymentId').equals(id).toArray();
      for (const c of localCols) {
        await offlineDb.collections.update(c.id, {
          paymentId: null,
          paymentStatus: undefined,
          localUpdatedAt: Date.now()
        });
      }
      const localDeds = await offlineDb.deductions.where('paymentId').equals(id).toArray();
      for (const d of localDeds) {
        await offlineDb.deductions.update(d.id, {
          paymentId: null,
          paymentStatus: 'pending',
          localUpdatedAt: Date.now()
        });
      }
    } else {
      await offlineDb.payments.update(id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      const localLedgers = await offlineDb.ledger.where('referenceId').equals(id).toArray();
      for (const l of localLedgers) {
        await offlineDb.ledger.update(l.id, { isDeleted: 1, pendingSync: 1, localUpdatedAt: Date.now() });
      }
      const localCols = await offlineDb.collections.where('paymentId').equals(id).toArray();
      for (const c of localCols) {
        await offlineDb.collections.update(c.id, {
          paymentId: null,
          paymentStatus: undefined,
          pendingSync: 1,
          localUpdatedAt: Date.now()
        });
      }
      const localDeds = await offlineDb.deductions.where('paymentId').equals(id).toArray();
      for (const d of localDeds) {
        await offlineDb.deductions.update(d.id, {
          paymentId: null,
          paymentStatus: 'pending',
          pendingSync: 1,
          localUpdatedAt: Date.now()
        });
      }
    }

    // Recalculate local balance
    const ledgers = await offlineDb.ledger.where('farmerId').equals(farmerId).and(l => l.centerId === centerId && l.isDeleted !== 1).toArray();
    const { balance } = calculateFarmerBalance(ledgers);
    await offlineDb.farmers.update(farmerId, { balance });
  }
};
