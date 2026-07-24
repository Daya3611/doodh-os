import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, orderBy, getDoc, Timestamp
} from 'firebase/firestore';
import { PurchaseEntry, PurchaseEntryItem } from '@/types';
import { offlineDb } from '@/lib/offlineDb';
import { recalculateAndSyncFarmerBalance } from '@/lib/balance';
import { toSafeNumber } from '@/utils/format';

/** Normalizes all numeric fields on a purchase entry and its items so .toFixed() never crashes. */
function normalizePurchaseEntry(p: PurchaseEntry): PurchaseEntry {
  return {
    ...p,
    total: toSafeNumber(p.total),
    gstTotal: toSafeNumber(p.gstTotal),
    discount: toSafeNumber(p.discount),
    transport: toSafeNumber(p.transport),
    grandTotal: toSafeNumber(p.grandTotal),
    paidAmount: toSafeNumber(p.paidAmount),
    items: (p.items || []).map((item): PurchaseEntryItem => ({
      ...item,
      quantity: toSafeNumber(item.quantity),
      purchaseRate: toSafeNumber(item.purchaseRate),
      gstPercent: toSafeNumber(item.gstPercent),
      gstAmount: toSafeNumber(item.gstAmount),
      discount: toSafeNumber(item.discount),
      total: toSafeNumber(item.total),
    })),
  };
}

export const purchaseService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'purchase_entries'),

  getItemCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'purchase_items'),

  getAll: async (centerId: string): Promise<PurchaseEntry[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(purchaseService.getCollectionRef(centerId), orderBy('createdAt', 'desc')));
        const cloudPurchases = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseEntry));

        // Cache in background
        const syncTime = Date.now();
        for (const p of cloudPurchases) {
          await offlineDb.purchaseEntries.put({
            ...p,
            date: (p.date as any).toDate ? (p.date as any).toDate() : new Date(p.date as any),
            createdAt: (p.createdAt as any).toDate ? (p.createdAt as any).toDate() : new Date(p.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudPurchases.map(normalizePurchaseEntry);
      } catch (err) {
        console.warn("Failed to fetch purchases online, using local cache:", err);
      }
    }

    const local = await offlineDb.purchaseEntries
      .where('centerId').equals(centerId)
      .and(p => p.isDeleted !== 1)
      .toArray();
    return local
      .map(normalizePurchaseEntry)
      .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  },

  add: async (
    centerId: string,
    data: Omit<PurchaseEntry, 'id' | 'purchaseNumber' | 'createdAt' | 'createdBy'>,
    createdBy: string
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const purchaseNumber = `PUR-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    // Prepare purchase document data
    const purchaseEntryData: PurchaseEntry = {
      ...data,
      id: purchaseId,
      purchaseNumber,
      createdBy,
      date: new Date(data.date as any),
      createdAt: new Date(),
    };

    // Accumulate base item stocks (since multiple items can be in the same bill)
    const itemStocks: Record<string, number> = {};
    for (const item of data.items) {
      if (itemStocks[item.itemId] === undefined) {
        const localItem = await offlineDb.inventoryItems.get(item.itemId);
        itemStocks[item.itemId] = localItem?.stockInBaseUnit || 0;
      }
      const localVariant = await offlineDb.inventoryVariants.get(item.variantId);
      const packageSize = localVariant?.multiplier || localVariant?.packageSize || item.packageSizeSnapshot || 1;
      const convertedQty = item.quantity * packageSize;
      itemStocks[item.itemId] += convertedQty;
    }

    const stockUpdates: Array<{ itemId: string, newItemStock: number }> = [];
    const auditLogs: any[] = [];

    for (const item of data.items) {
      const localVariant = await offlineDb.inventoryVariants.get(item.variantId);
      const localItem = await offlineDb.inventoryItems.get(item.itemId);

      const prevItemStock = localItem?.stockInBaseUnit || 0;
      const packageSize = localVariant?.multiplier || localVariant?.packageSize || item.packageSizeSnapshot || 1;
      const convertedQty = item.quantity * packageSize;
      const finalItemStock = itemStocks[item.itemId];

      stockUpdates.push({
        itemId: item.itemId,
        newItemStock: finalItemStock
      });

      // Save package size snapshot to the transaction record
      item.packageSizeSnapshot = packageSize;

      auditLogs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemId: item.itemId,
        itemName: item.itemName,
        variantId: item.variantId,
        variantName: item.variantName,
        prevStock: prevItemStock,
        newStock: finalItemStock,
        quantity: convertedQty, // Base unit quantity logged
        actionType: 'purchase',
        referenceId: purchaseId,
        reason: `Purchase Entry ${purchaseNumber} (${item.quantity} ${item.variantName} = ${convertedQty} ${localItem?.baseUnit || 'KG'})`,
        createdBy,
        createdAt: new Date(),
        centerId
      });
    }

    // Determine outstanding amount to add to supplier
    // Outstanding amount is what is NOT paid immediately
    const outstanding = data.grandTotal - (data.paidAmount || 0);

    let supplierUpdate: { supplierId: string, newPending: number } | null = null;
    if (outstanding > 0 && data.paymentMode === 'outstanding') {
      const supplier = await offlineDb.suppliers.get(data.supplierId);
      if (supplier) {
        supplierUpdate = {
          supplierId: data.supplierId,
          newPending: (supplier.pendingAmount || 0) + outstanding
        };
      }
    }

    // Farmer ledger integration (if we purchased from a farmer on ledger credit)
    let farmerUpdate: { farmerId: string, newBalance: number } | null = null;
    let ledgerEntry: any = null;

    if (data.paymentMode === 'farmer_ledger') {
      // In this case, supplierId is actually the farmerId
      const farmer = await offlineDb.farmers.get(data.supplierId);
      if (farmer) {
        const prevBalance = farmer.balance || 0;
        const newBalance = prevBalance + data.grandTotal; // Credit increases balance (we owe the farmer for milk/materials)

        farmerUpdate = {
          farmerId: data.supplierId,
          newBalance
        };

        const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        ledgerEntry = {
          id: ledgerId,
          farmerId: data.supplierId,
          transactionType: 'milk_collection', // Treat as collection credit
          description: `Inventory Sale credit - Purchase #${purchaseNumber}`,
          credit: data.grandTotal,
          debit: 0,
          balance: newBalance,
          referenceId: purchaseId,
          createdAt: new Date(),
          centerId
        };
      }
    }

    if (isOnline) {
      try {
        // Write purchase entry
        const entryRef = doc(purchaseService.getCollectionRef(centerId), purchaseId);
        await setDoc(entryRef, {
          ...purchaseEntryData,
          date: Timestamp.fromDate(purchaseEntryData.date as Date),
          createdAt: serverTimestamp()
        });

        // Write purchase items
        for (const item of data.items) {
          const itemRef = doc(purchaseService.getItemCollectionRef(centerId));
          await setDoc(itemRef, {
            ...item,
            purchaseEntryId: purchaseId,
            createdAt: serverTimestamp()
          });
        }

        // Update Stock levels in Firestore
        for (const update of stockUpdates) {
          const itemDocRef = doc(db, 'centers', centerId, 'inventory_items', update.itemId);
          await setDoc(itemDocRef, { stockInBaseUnit: update.newItemStock }, { merge: true });
        }

        // Write Audit Logs in Firestore
        for (const log of auditLogs) {
          const logRef = doc(db, 'centers', centerId, 'inventory_logs', log.id);
          const { centerId: _, pendingSync: __, ...logUpload } = log;
          await setDoc(logRef, {
            ...logUpload,
            createdAt: serverTimestamp()
          });
        }

        // Write Supplier pending outstanding in Firestore
        if (supplierUpdate) {
          const supRef = doc(db, 'centers', centerId, 'suppliers', supplierUpdate.supplierId);
          await setDoc(supRef, { pendingAmount: supplierUpdate.newPending }, { merge: true });
        }

        // Write Farmer ledger if farmer_ledger
        if (farmerUpdate && ledgerEntry) {
          const farmerDocRef = doc(db, 'centers', centerId, 'farmers', farmerUpdate.farmerId);
          await setDoc(farmerDocRef, { balance: farmerUpdate.newBalance }, { merge: true });

          const ledRef = doc(db, 'centers', centerId, 'ledger', ledgerEntry.id);
          const { centerId: _, pendingSync: __, ...ledUpload } = ledgerEntry;
          await setDoc(ledRef, {
            ...ledUpload,
            createdAt: serverTimestamp()
          });

          await recalculateAndSyncFarmerBalance(centerId, farmerUpdate.farmerId);
        }

        // Cache locally in Dexie
        await offlineDb.purchaseEntries.put({
          ...purchaseEntryData,
          centerId,
          createdAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        for (const item of data.items) {
          await offlineDb.purchaseItems.put({
            id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...item,
            purchaseEntryId: purchaseId,
            centerId,
            localUpdatedAt: Date.now()
          });
        }

        for (const update of stockUpdates) {
          await offlineDb.inventoryItems.update(update.itemId, { stockInBaseUnit: update.newItemStock });
        }

        for (const log of auditLogs) {
          await offlineDb.inventoryLogs.put({
            ...log,
            pendingSync: 0,
            localUpdatedAt: Date.now()
          });
        }

        if (supplierUpdate) {
          const s = await offlineDb.suppliers.get(supplierUpdate.supplierId);
          if (s) {
            await offlineDb.suppliers.put({
              ...s,
              pendingAmount: supplierUpdate.newPending,
              localUpdatedAt: Date.now()
            });
          }
        }

        if (farmerUpdate && ledgerEntry) {
          await offlineDb.farmers.update(farmerUpdate.farmerId, { balance: farmerUpdate.newBalance });
          await offlineDb.ledger.put({
            ...ledgerEntry,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
        }

        return purchaseId;
      } catch (err) {
        console.warn("Failed to complete purchase online, falling back to offline write:", err);
      }
    }

    // Offline Save
    await offlineDb.purchaseEntries.put({
      ...purchaseEntryData,
      centerId,
      createdAt: new Date(),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    for (const item of data.items) {
      await offlineDb.purchaseItems.put({
        id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...item,
        purchaseEntryId: purchaseId,
        centerId,
        localUpdatedAt: Date.now()
      });
    }

    for (const update of stockUpdates) {
      await offlineDb.inventoryItems.update(update.itemId, { stockInBaseUnit: update.newItemStock });
    }

    for (const log of auditLogs) {
      await offlineDb.inventoryLogs.put({
        ...log,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
    }

    if (supplierUpdate) {
      const s = await offlineDb.suppliers.get(supplierUpdate.supplierId);
      if (s) {
        await offlineDb.suppliers.put({
          ...s,
          pendingAmount: supplierUpdate.newPending,
          pendingSync: 1,
          localUpdatedAt: Date.now()
        });
      }
    }

    if (farmerUpdate && ledgerEntry) {
      await offlineDb.farmers.update(farmerUpdate.farmerId, { balance: farmerUpdate.newBalance });
      await offlineDb.ledger.put({
        ...ledgerEntry,
        pendingSync: 1,
        isDeleted: 0,
        localUpdatedAt: Date.now()
      });
    }

    return purchaseId;
  },

  getItemsByPurchase: async (centerId: string, purchaseId: string): Promise<PurchaseEntryItem[]> => {
    const localItems = await offlineDb.purchaseItems
      .where('purchaseEntryId').equals(purchaseId)
      .and(pi => pi.centerId === centerId)
      .toArray();

    return localItems;
  },

  delete: async (centerId: string, id: string): Promise<void> => {
    // Soft delete locally and let sync engine handle it
    const local = await offlineDb.purchaseEntries.get(id);
    if (local) {
      // 1. Revert stock changes
      const pItems = await purchaseService.getItemsByPurchase(centerId, id);
      for (const item of pItems) {
        const localItem = await offlineDb.inventoryItems.get(item.itemId);

        if (localItem) {
          const packageSize = item.packageSizeSnapshot || 1;
          const convertedQty = item.quantity * packageSize;
          const newParentStock = (localItem.stockInBaseUnit || 0) - convertedQty;

          // Update parent item stock and mark it for sync
          await offlineDb.inventoryItems.put({
            ...localItem,
            stockInBaseUnit: newParentStock,
            pendingSync: 1,
            localUpdatedAt: Date.now()
          });
        }
      }

      // 2. Revert Supplier Outstanding balance if applicable
      const outstanding = local.grandTotal - (local.paidAmount || 0);
      if (outstanding > 0 && local.paymentMode === 'outstanding') {
        const supplier = await offlineDb.suppliers.get(local.supplierId);
        if (supplier) {
          await offlineDb.suppliers.update(local.supplierId, {
            pendingAmount: (supplier.pendingAmount || 0) - outstanding
          });
        }
      }

      // 3. Revert Farmer balance & ledger if applicable
      if (local.paymentMode === 'farmer_ledger') {
        const farmer = await offlineDb.farmers.get(local.supplierId);
        if (farmer) {
          const newBal = (farmer.balance || 0) - local.grandTotal;
          await offlineDb.farmers.update(local.supplierId, { balance: newBal });
          // delete ledger entries for this referenceId
          const ledgerEntries = await offlineDb.ledger.where('referenceId').equals(id).toArray();
          for (const le of ledgerEntries) {
            await offlineDb.ledger.update(le.id, { isDeleted: 1, pendingSync: 1 });
          }
        }
      }

      // 4. Mark purchase deleted
      await offlineDb.purchaseEntries.put({
        ...local,
        isDeleted: 1,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
    }
  }
};
