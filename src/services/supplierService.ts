import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, orderBy, where, getDoc, Timestamp
} from 'firebase/firestore';
import { Supplier, SupplierFormData, SupplierPayment } from '@/types';
import { offlineDb } from '@/lib/offlineDb';
import { formatCurrency } from '@/utils/format';

export const supplierService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'suppliers'),

  getPaymentCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'supplier_payments'),

  getAll: async (centerId: string): Promise<Supplier[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(supplierService.getCollectionRef(centerId), orderBy('name', 'asc')));
        const cloudSuppliers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));

        // Cache in background
        const syncTime = Date.now();
        for (const s of cloudSuppliers) {
          await offlineDb.suppliers.put({
            ...s,
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudSuppliers;
      } catch (err) {
        console.warn("Failed to fetch suppliers online, using local cache:", err);
      }
    }

    // Offline fallback
    const local = await offlineDb.suppliers
      .where('centerId').equals(centerId)
      .and(s => s.isDeleted !== 1)
      .toArray();
    return local.sort((a, b) => a.name.localeCompare(b.name));
  },

  getById: async (centerId: string, id: string): Promise<Supplier | null> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(supplierService.getCollectionRef(centerId), id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const s = { id: snap.id, ...snap.data() } as Supplier;
          await offlineDb.suppliers.put({
            ...s,
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
          return s;
        }
      } catch (err) {
        console.warn("Failed to fetch supplier by ID online:", err);
      }
    }
    const local = await offlineDb.suppliers.get(id);
    return local || null;
  },

  add: async (centerId: string, data: SupplierFormData): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const newId = `sup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const supplierData = {
      ...data,
      pendingAmount: data.pendingAmount || 0,
    };

    if (isOnline) {
      try {
        const ref = doc(supplierService.getCollectionRef(centerId), newId);
        await setDoc(ref, {
          ...supplierData,
          createdAt: serverTimestamp(),
        });

        await offlineDb.suppliers.put({
          id: newId,
          ...supplierData,
          centerId,
          createdAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now(),
        });

        return newId;
      } catch (err) {
        console.warn("Failed to add supplier online, writing offline:", err);
      }
    }

    // Offline save
    await offlineDb.suppliers.put({
      id: newId,
      ...supplierData,
      centerId,
      createdAt: new Date(),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now(),
    });

    return newId;
  },

  update: async (centerId: string, id: string, data: Partial<SupplierFormData>): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const local = await offlineDb.suppliers.get(id);
    if (!local) throw new Error('Supplier not found');

    const updatedLocal = { ...local, ...data, localUpdatedAt: Date.now() };

    if (isOnline) {
      try {
        const ref = doc(supplierService.getCollectionRef(centerId), id);
        await setDoc(ref, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await offlineDb.suppliers.put({
          ...updatedLocal,
          pendingSync: 0,
        });
        return;
      } catch (err) {
        console.warn("Failed to update supplier online, writing offline:", err);
      }
    }

    // Offline save
    await offlineDb.suppliers.put({
      ...updatedLocal,
      pendingSync: 1,
    });
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        await deleteDoc(doc(supplierService.getCollectionRef(centerId), id));
        await offlineDb.suppliers.delete(id);
        return;
      } catch (err) {
        console.warn("Failed to delete supplier online, marking deleted offline:", err);
      }
    }

    // Offline mark deleted
    const local = await offlineDb.suppliers.get(id);
    if (local) {
      await offlineDb.suppliers.put({
        ...local,
        isDeleted: 1,
        pendingSync: 1,
        localUpdatedAt: Date.now(),
      });
    }
  },

  // Supplier Payments
  recordPayment: async (
    centerId: string,
    supplierId: string,
    amount: number,
    paymentMethod: 'cash' | 'upi' | 'bank',
    notes = '',
    createdBy = 'user'
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const paymentId = `spay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 1. Fetch supplier from cache to recalculate outstanding
    const supplier = await offlineDb.suppliers.get(supplierId);
    if (!supplier) throw new Error('Supplier not found');

    const newPending = (supplier.pendingAmount || 0) - amount;

    const paymentData = {
      id: paymentId,
      supplierId,
      supplierName: supplier.name,
      amount,
      paymentMethod,
      notes,
      paymentDate: new Date(),
      createdBy,
      createdAt: new Date(),
    };

    if (isOnline) {
      try {
        // Record payment in Firestore
        const payRef = doc(supplierService.getPaymentCollectionRef(centerId), paymentId);
        await setDoc(payRef, {
          ...paymentData,
          paymentDate: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        // Update supplier balance in Firestore
        const supRef = doc(supplierService.getCollectionRef(centerId), supplierId);
        await setDoc(supRef, { pendingAmount: newPending }, { merge: true });

        // Save locally
        await offlineDb.supplierPayments.put({
          ...paymentData,
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        await offlineDb.suppliers.put({
          ...supplier,
          pendingAmount: newPending,
          pendingSync: 0,
          localUpdatedAt: Date.now()
        });

        return paymentId;
      } catch (err) {
        console.warn("Failed to record payment online, writing offline:", err);
      }
    }

    // Offline save
    await offlineDb.supplierPayments.put({
      ...paymentData,
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    await offlineDb.suppliers.put({
      ...supplier,
      pendingAmount: newPending,
      pendingSync: 1,
      localUpdatedAt: Date.now()
    });

    return paymentId;
  },

  getPayments: async (centerId: string, supplierId: string): Promise<SupplierPayment[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(
          supplierService.getPaymentCollectionRef(centerId),
          where('supplierId', '==', supplierId),
          orderBy('paymentDate', 'desc')
        );
        const snap = await getDocs(q);
        const cloudPayments = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierPayment));

        const syncTime = Date.now();
        for (const p of cloudPayments) {
          await offlineDb.supplierPayments.put({
            ...p,
            paymentDate: (p.paymentDate as any).toDate ? (p.paymentDate as any).toDate() : new Date(p.paymentDate as any),
            createdAt: (p.createdAt as any).toDate ? (p.createdAt as any).toDate() : new Date(p.createdAt as any),
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

    const local = await offlineDb.supplierPayments
      .where('supplierId').equals(supplierId)
      .and(p => p.centerId === centerId && p.isDeleted !== 1)
      .toArray();

    return local.sort((a, b) => new Date(b.paymentDate as any).getTime() - new Date(a.paymentDate as any).getTime());
  },

  // Chronological Supplier Ledger (Combines purchases and payments)
  getLedger: async (centerId: string, supplierId: string): Promise<any[]> => {
    // 1. Fetch supplier purchases
    const purchases = await offlineDb.purchaseEntries
      .where('supplierId').equals(supplierId)
      .and(p => p.centerId === centerId && p.isDeleted !== 1)
      .toArray();

    // 2. Fetch supplier payments
    const payments = await supplierService.getPayments(centerId, supplierId);

    // 3. Combine ledger entries
    const ledger: any[] = [];

    purchases.forEach(p => {
      ledger.push({
        id: p.id,
        type: 'purchase',
        referenceNumber: p.purchaseNumber,
        date: p.date,
        description: `Purchase Entry - Total ₹${formatCurrency(p.grandTotal)} (${p.paymentMode})`,
        debit: 0, // In supplier ledger, purchase increases outstanding (credit to supplier)
        credit: p.grandTotal,
        paymentMode: p.paymentMode
      });
    });

    payments.forEach(p => {
      ledger.push({
        id: p.id,
        type: 'payment',
        referenceNumber: p.id.split('-')[1] || p.id,
        date: p.paymentDate,
        description: `Payment recorded via ${p.paymentMethod.toUpperCase()}`,
        debit: p.amount, // Payment decreases outstanding (debit from supplier)
        credit: 0,
        paymentMode: p.paymentMethod
      });
    });

    // Sort chronologically ascending
    ledger.sort((a, b) => {
      const timeA = new Date(a.date as any).getTime();
      const timeB = new Date(b.date as any).getTime();
      return timeA - timeB;
    });

    // Compute running balance
    let runningBalance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      runningBalance += entry.credit - entry.debit;
      return {
        ...entry,
        balance: runningBalance
      };
    });

    // Return descending (newest first) for visual tables
    return ledgerWithBalance.reverse();
  }
};
