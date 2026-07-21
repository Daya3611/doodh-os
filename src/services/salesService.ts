import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, orderBy, getDoc, Timestamp
} from 'firebase/firestore';
import { SalesEntry, SalesEntryItem } from '@/types';
import { offlineDb } from '@/lib/offlineDb';
import { recalculateAndSyncFarmerBalance } from '@/lib/balance';

export const salesService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'sales_entries'),

  getItemCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'sales_items'),

  getAll: async (centerId: string): Promise<SalesEntry[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(salesService.getCollectionRef(centerId), orderBy('createdAt', 'desc')));
        const cloudSales = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesEntry));

        // Cache in background
        const syncTime = Date.now();
        for (const s of cloudSales) {
          await offlineDb.salesEntries.put({
            ...s,
            date: (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any),
            createdAt: (s.createdAt as any).toDate ? (s.createdAt as any).toDate() : new Date(s.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudSales;
      } catch (err) {
        console.warn("Failed to fetch sales online, using local cache:", err);
      }
    }

    // Offline fallback
    const local = await offlineDb.salesEntries
      .where('centerId').equals(centerId)
      .and(s => s.isDeleted !== 1)
      .toArray();
    return local.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  },

  add: async (
    centerId: string,
    data: Omit<SalesEntry, 'id' | 'invoiceNumber' | 'createdAt' | 'createdBy'>,
    createdBy: string
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const salesId = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    // 1. Check settings for negative stock prevention
    let enableNegativeStock = false;
    const localSettings = await offlineDb.inventorySettings.get(centerId);
    if (localSettings) {
      enableNegativeStock = localSettings.enableNegativeStock;
    }

    // 2. Load stock items and variants locally to verify stock and update levels
    for (const item of data.items) {
      const v = await offlineDb.inventoryVariants.get(item.variantId);
      const localItem = await offlineDb.inventoryItems.get(item.itemId);
      if (!v) throw new Error(`Variant not found for item ${item.itemName}`);
      
      const packageSize = v.packageSize || item.packageSizeSnapshot || 1;
      const convertedQty = item.quantity * packageSize;
      const availableStock = localItem?.stockInBaseUnit || 0;
      
      if (!enableNegativeStock && localItem && availableStock < convertedQty) {
        throw new Error(`Insufficient stock for ${item.itemName}. Available: ${availableStock} ${localItem.baseUnit}, Requested: ${convertedQty} ${localItem.baseUnit}`);
      }
    }

    // Prepare complete document data
    const salesEntryData: SalesEntry = {
      ...data,
      id: salesId,
      invoiceNumber,
      createdBy,
      date: new Date(data.date as any),
      createdAt: new Date(),
    };

    // Calculate new stock levels and prepare log records
    // Accumulate base item stocks subtraction
    const itemStocks: Record<string, number> = {};
    for (const item of data.items) {
      if (itemStocks[item.itemId] === undefined) {
        const localItem = await offlineDb.inventoryItems.get(item.itemId);
        itemStocks[item.itemId] = localItem?.stockInBaseUnit || 0;
      }
      const localVariant = await offlineDb.inventoryVariants.get(item.variantId);
      const packageSize = localVariant?.packageSize || item.packageSizeSnapshot || 1;
      const convertedQty = item.quantity * packageSize;
      itemStocks[item.itemId] -= convertedQty;
    }

    const stockUpdates: Array<{ itemId: string, newItemStock: number, prevItemStock: number }> = [];
    const auditLogs: any[] = [];

    for (const item of data.items) {
      const localVariant = await offlineDb.inventoryVariants.get(item.variantId);
      const localItem = await offlineDb.inventoryItems.get(item.itemId);

      if (localVariant && localItem) {
        const prevItemStock = localItem.stockInBaseUnit || 0;
        const packageSize = localVariant.packageSize || item.packageSizeSnapshot || 1;
        const convertedQty = item.quantity * packageSize;
        const finalItemStock = itemStocks[item.itemId];

        stockUpdates.push({
          itemId: item.itemId,
          newItemStock: finalItemStock,
          prevItemStock
        });

        // Store package size snapshot to transaction item
        item.packageSizeSnapshot = packageSize;

        auditLogs.push({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          itemId: item.itemId,
          itemName: item.itemName,
          variantId: item.variantId,
          variantName: item.variantName,
          prevStock: prevItemStock,
          newStock: finalItemStock,
          quantity: -convertedQty, // Base unit quantity logged
          actionType: 'sale',
          referenceId: salesId,
          reason: `Sale Invoice ${invoiceNumber} (${item.quantity} ${item.variantName} = ${convertedQty} ${localItem?.baseUnit || 'KG'})`,
          createdBy,
          createdAt: new Date(),
          centerId
        });
      }
    }

    // If payment mode is farmer_ledger, calculate new farmer balance
    let farmerUpdate: { farmerId: string, prevBalance: number, newBalance: number } | null = null;
    let ledgerEntry: any = null;

    if (data.paymentMode === 'farmer_ledger' && data.farmerId) {
      const farmer = await offlineDb.farmers.get(data.farmerId);
      if (!farmer) throw new Error('Farmer not found');
      
      const prevBalance = farmer.balance || 0;
      const newBalance = prevBalance - data.grandTotal; // Debit decreases balance
      
      farmerUpdate = {
        farmerId: data.farmerId,
        prevBalance,
        newBalance
      };

      const ledgerId = `led-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ledgerEntry = {
        id: ledgerId,
        farmerId: data.farmerId,
        transactionType: 'purchase', // Customer buying goods from center is recorded as purchase/debit transaction in farmer ledger
        description: `Purchased Cattle Feed/Items - Inv #${invoiceNumber}`,
        credit: 0,
        debit: data.grandTotal,
        balance: newBalance,
        referenceId: salesId,
        createdAt: new Date(),
        centerId
      };
    }

    if (isOnline) {
      try {
        // Write sales entry
        const entryRef = doc(salesService.getCollectionRef(centerId), salesId);
        await setDoc(entryRef, {
          ...salesEntryData,
          date: Timestamp.fromDate(salesEntryData.date as Date),
          createdAt: serverTimestamp()
        });

        // Write sales items
        for (const item of data.items) {
          const itemRef = doc(salesService.getItemCollectionRef(centerId));
          await setDoc(itemRef, {
            ...item,
            salesEntryId: salesId,
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

        // Write Farmer balance & ledger in Firestore if farmer_ledger
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

        // Commit to Dexie locally (synced)
        await offlineDb.salesEntries.put({
          ...salesEntryData,
          centerId,
          createdAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        for (const item of data.items) {
          await offlineDb.salesItems.put({
            id: `si-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...item,
            salesEntryId: salesId,
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

        if (farmerUpdate && ledgerEntry) {
          await offlineDb.farmers.update(farmerUpdate.farmerId, { balance: farmerUpdate.newBalance });
          await offlineDb.ledger.put({
            ...ledgerEntry,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
        }

        return salesId;
      } catch (err) {
        console.warn("Failed to complete sales entry online, falling back to offline write:", err);
      }
    }

    // Offline Save
    await offlineDb.salesEntries.put({
      ...salesEntryData,
      centerId,
      createdAt: new Date(),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    for (const item of data.items) {
      await offlineDb.salesItems.put({
        id: `si-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...item,
        salesEntryId: salesId,
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

    if (farmerUpdate && ledgerEntry) {
      await offlineDb.farmers.update(farmerUpdate.farmerId, { balance: farmerUpdate.newBalance });
      await offlineDb.ledger.put({
        ...ledgerEntry,
        pendingSync: 1,
        isDeleted: 0,
        localUpdatedAt: Date.now()
      });
    }

    return salesId;
  },

  getItemsByInvoice: async (centerId: string, invoiceId: string): Promise<SalesEntryItem[]> => {
    // Return sales items associated with the entry
    const localItems = await offlineDb.salesItems
      .where('salesEntryId').equals(invoiceId)
      .and(si => si.centerId === centerId)
      .toArray();

    return localItems;
  }
};
