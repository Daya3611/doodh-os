import { db } from '@/firebase/config';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, Timestamp, runTransaction, writeBatch
} from 'firebase/firestore';
import { z } from 'zod';
import { recalculateAndSyncFarmerBalance } from '@/lib/balance';
import { LedgerEntry } from '@/types';

export const paymentSchema = z.object({
  farmerId: z.string().min(1),
  farmerName: z.string().min(1),
  amount: z.number().min(0.01, 'Amount must be positive'),
  paymentMethod: z.enum(['cash', 'upi', 'bank']),
  notes: z.string().optional(),
  paymentDate: z.date().optional(),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

export interface Payment extends PaymentFormData {
  id: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

export const paymentService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'payments'),

  getAll: async (centerId: string): Promise<Payment[]> => {
    const q = query(
      paymentService.getCollectionRef(centerId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
  },

  getByFarmer: async (centerId: string, farmerId: string): Promise<Payment[]> => {
    const q = query(
      paymentService.getCollectionRef(centerId),
      where('farmerId', '==', farmerId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
    return results.sort((a, b) => {
      const timeA = (a.createdAt as any)?.toMillis?.() || new Date(a.createdAt as any || 0).getTime();
      const timeB = (b.createdAt as any)?.toMillis?.() || new Date(b.createdAt as any || 0).getTime();
      return timeB - timeA;
    });
  },

  add: async (centerId: string, data: PaymentFormData, createdBy: string): Promise<string> => {
    const newId = await runTransaction(db, async (tx) => {
      // 1. Get the farmer to update balance
      const farmerRef = doc(db, 'centers', centerId, 'farmers', data.farmerId);
      const farmerDoc = await tx.get(farmerRef);
      if (!farmerDoc.exists()) throw new Error('Farmer not found');
      
      const currentBalance = farmerDoc.data().balance || 0;
      const newBalance = currentBalance - data.amount; // Debit decreases balance

      // 2. Create the payment document
      const ref = doc(paymentService.getCollectionRef(centerId));
      tx.set(ref, {
        ...data,
        paymentDate: data.paymentDate ?? new Date(),
        createdBy,
        createdAt: serverTimestamp(),
      });

      // 3. Create the ledger entry
      const ledgerRef = doc(collection(db, 'centers', centerId, 'ledger'));
      tx.set(ledgerRef, {
        farmerId: data.farmerId,
        transactionType: 'payment',
        description: `Payment Received - ${data.paymentMethod}`,
        credit: 0,
        debit: data.amount,
        balance: newBalance,
        referenceId: ref.id,
        createdAt: serverTimestamp(),
      });

      // 4. Update farmer balance
      tx.update(farmerRef, { balance: newBalance });

      return ref.id;
    });

    // Recalculate running balances and update farmer document
    await recalculateAndSyncFarmerBalance(centerId, data.farmerId);

    return newId;
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    // 1. Get the payment to know how much to reverse
    const pmtRef = doc(paymentService.getCollectionRef(centerId), id);
    const pmtDoc = await getDoc(pmtRef);
    if (!pmtDoc.exists()) throw new Error('Payment not found');
    
    const pmtData = pmtDoc.data() as Payment;
    const farmerId = pmtData.farmerId;

    // Get the corresponding ledger entry referencing this payment
    const ledgerCollectionRef = collection(db, 'centers', centerId, 'ledger');
    const ledgerQuery = query(ledgerCollectionRef, where('farmerId', '==', farmerId));
    const ledgerSnap = await getDocs(ledgerQuery);

    const batch = writeBatch(db);

    // Delete the payment document
    batch.delete(pmtRef);

    // Delete the corresponding ledger entry
    ledgerSnap.docs.forEach(docSnap => {
      const entry = docSnap.data() as LedgerEntry;
      if (entry.referenceId === id && entry.transactionType === 'payment') {
        batch.delete(docSnap.ref);
      }
    });

    await batch.commit();

    // Recalculate running balances and update farmer document
    await recalculateAndSyncFarmerBalance(centerId, farmerId);
  },
};
