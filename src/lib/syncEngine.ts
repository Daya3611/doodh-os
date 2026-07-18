import { db } from '@/firebase/config';
import { 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { offlineDb, OfflineCollection, OfflineLedgerEntry, OfflineFarmer, OfflineRateChart, OfflineRateChartEntry } from './offlineDb';
import { recalculateAndSyncFarmerBalance } from './balance';
import { Collection, Farmer, LedgerEntry, RateChart, RateChartEntry } from '@/types';

// Helper to get last sync time
function getLastSyncTime(centerId: string): number {
  if (typeof window === 'undefined') return 0;
  const time = localStorage.getItem(`doodhos_last_sync_time_${centerId}`);
  return time ? parseInt(time, 10) : 0;
}

// Helper to set last sync time
function setLastSyncTime(centerId: string, time: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`doodhos_last_sync_time_${centerId}`, time.toString());
}

export const syncEngine = {
  /**
   * Upload all local pending changes to Firebase Firestore.
   */
  uploadPending: async (centerId: string): Promise<void> => {
    // 1. Upload pending Collections
    const pendingCols = await offlineDb.collections
      .where('centerId').equals(centerId)
      .and(c => c.pendingSync === 1)
      .toArray();

    for (const localCol of pendingCols) {
      const colRef = firestoreDoc(db, 'centers', centerId, 'collections', localCol.id);
      
      if (localCol.isDeleted === 1) {
        // Handle deletion sync
        await deleteDoc(colRef);
        await offlineDb.collections.delete(localCol.id);
        continue;
      }

      // Check for conflict
      const docSnap = await getDoc(colRef);
      if (docSnap.exists()) {
        const cloudData = docSnap.data() as Collection;
        const cloudCreatedAt = (cloudData.createdAt as any)?.toMillis?.() || new Date(cloudData.createdAt as any).getTime();
        
        // If the cloud was modified after our last sync, and it differs from local, conflict!
        const lastSync = getLastSyncTime(centerId);
        if (cloudCreatedAt > lastSync && (cloudData.liters !== localCol.liters || cloudData.fat !== localCol.fat || cloudData.snf !== localCol.snf)) {
          // Record conflict
          await offlineDb.conflicts.put({
            id: localCol.id,
            type: 'collection',
            localData: localCol,
            cloudData: { ...cloudData, id: docSnap.id },
            createdAt: Date.now()
          });
          continue; // Skip uploading this one until resolved
        }
      }

      // Upload to Firestore
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = localCol;
      // Convert dates to Timestamp for Firebase compatibility
      const fbData = {
        ...uploadData,
        createdAt: localCol.createdAt ? Timestamp.fromDate(new Date(localCol.createdAt as any)) : new Date()
      };
      await setDoc(colRef, fbData);
      
      // Update local state to synced
      await offlineDb.collections.update(localCol.id, { pendingSync: 0 });
    }

    // 2. Upload pending Ledger entries
    const pendingLedger = await offlineDb.ledger
      .where('centerId').equals(centerId)
      .and(l => l.pendingSync === 1)
      .toArray();

    for (const localLedger of pendingLedger) {
      const ledgerRef = firestoreDoc(db, 'centers', centerId, 'ledger', localLedger.id);

      if (localLedger.isDeleted === 1) {
        await deleteDoc(ledgerRef);
        await offlineDb.ledger.delete(localLedger.id);
        continue;
      }

      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = localLedger;
      const fbData = {
        ...uploadData,
        createdAt: localLedger.createdAt ? Timestamp.fromDate(new Date(localLedger.createdAt as any)) : new Date()
      };
      await setDoc(ledgerRef, fbData);
      await offlineDb.ledger.update(localLedger.id, { pendingSync: 0 });
    }

    // 3. Upload pending Deductions
    const pendingDeds = await offlineDb.deductions
      .where('centerId').equals(centerId)
      .and(d => d.pendingSync === 1)
      .toArray();

    for (const localDed of pendingDeds) {
      const dedRef = firestoreDoc(db, 'centers', centerId, 'deductions', localDed.id);

      if (localDed.isDeleted === 1) {
        await deleteDoc(dedRef);
        await offlineDb.deductions.delete(localDed.id);
        continue;
      }

      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = localDed;
      const fbData = {
        ...uploadData,
        deductionDate: localDed.deductionDate ? Timestamp.fromDate(new Date(localDed.deductionDate as any)) : new Date(),
        createdAt: localDed.createdAt ? Timestamp.fromDate(new Date(localDed.createdAt as any)) : new Date()
      };
      await setDoc(dedRef, fbData);
      await offlineDb.deductions.update(localDed.id, { pendingSync: 0 });
    }

    // 4. Upload pending Dispatches
    const pendingDisps = await offlineDb.dispatches
      .where('centerId').equals(centerId)
      .and(d => d.pendingSync === 1)
      .toArray();

    for (const localDisp of pendingDisps) {
      const dispRef = firestoreDoc(db, 'centers', centerId, 'dispatches', localDisp.id);

      if (localDisp.isDeleted === 1) {
        await deleteDoc(dispRef);
        await offlineDb.dispatches.delete(localDisp.id);
        continue;
      }

      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = localDisp;
      const fbData = {
        ...uploadData,
        dispatchDate: localDisp.dispatchDate ? Timestamp.fromDate(new Date(localDisp.dispatchDate as any)) : new Date(),
        createdAt: localDisp.createdAt ? Timestamp.fromDate(new Date(localDisp.createdAt as any)) : new Date()
      };
      await setDoc(dispRef, fbData);
      await offlineDb.dispatches.update(localDisp.id, { pendingSync: 0 });
    }

    // 5. Upload pending Inventory Items
    const pendingItems = await offlineDb.inventoryItems
      .where('centerId').equals(centerId)
      .and(i => i.pendingSync === 1)
      .toArray();
    for (const item of pendingItems) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'inventory_items', item.id);
      if (item.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.inventoryItems.delete(item.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = item;
      await setDoc(docRef, {
        ...uploadData,
        createdAt: item.createdAt ? Timestamp.fromDate(new Date(item.createdAt as any)) : new Date(),
        updatedAt: item.updatedAt ? Timestamp.fromDate(new Date(item.updatedAt as any)) : new Date()
      });
      await offlineDb.inventoryItems.update(item.id, { pendingSync: 0 });

      // Also upload variants for this item
      const itemVariants = await offlineDb.inventoryVariants
        .where('itemId').equals(item.id)
        .toArray();
      for (const v of itemVariants) {
        const vRef = firestoreDoc(db, 'centers', centerId, 'inventory_variants', v.id);
        const { localUpdatedAt: _, ...vData } = v;
        await setDoc(vRef, {
          ...vData,
          createdAt: v.createdAt ? Timestamp.fromDate(new Date(v.createdAt as any)) : new Date()
        });
      }
    }

    // 6. Upload pending Suppliers
    const pendingSuppliers = await offlineDb.suppliers
      .where('centerId').equals(centerId)
      .and(s => s.pendingSync === 1)
      .toArray();
    for (const supplier of pendingSuppliers) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'suppliers', supplier.id);
      if (supplier.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.suppliers.delete(supplier.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = supplier;
      await setDoc(docRef, {
        ...uploadData,
        createdAt: supplier.createdAt ? Timestamp.fromDate(new Date(supplier.createdAt as any)) : new Date()
      });
      await offlineDb.suppliers.update(supplier.id, { pendingSync: 0 });
    }

    // 7. Upload pending Purchase Entries
    const pendingPurchases = await offlineDb.purchaseEntries
      .where('centerId').equals(centerId)
      .and(p => p.pendingSync === 1)
      .toArray();
    for (const purchase of pendingPurchases) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'purchase_entries', purchase.id);
      if (purchase.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.purchaseEntries.delete(purchase.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = purchase;
      await setDoc(docRef, {
        ...uploadData,
        date: purchase.date ? Timestamp.fromDate(new Date(purchase.date as any)) : new Date(),
        createdAt: purchase.createdAt ? Timestamp.fromDate(new Date(purchase.createdAt as any)) : new Date()
      });

      // Also upload associated purchase items
      const pItems = await offlineDb.purchaseItems
        .where('purchaseEntryId').equals(purchase.id)
        .toArray();
      for (const pi of pItems) {
        const piRef = firestoreDoc(db, 'centers', centerId, 'purchase_items', pi.id);
        const { localUpdatedAt: _, ...piData } = pi;
        await setDoc(piRef, piData);
      }

      await offlineDb.purchaseEntries.update(purchase.id, { pendingSync: 0 });
    }

    // 8. Upload pending Sales Entries
    const pendingSales = await offlineDb.salesEntries
      .where('centerId').equals(centerId)
      .and(s => s.pendingSync === 1)
      .toArray();
    for (const sale of pendingSales) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'sales_entries', sale.id);
      if (sale.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.salesEntries.delete(sale.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = sale;
      await setDoc(docRef, {
        ...uploadData,
        date: sale.date ? Timestamp.fromDate(new Date(sale.date as any)) : new Date(),
        createdAt: sale.createdAt ? Timestamp.fromDate(new Date(sale.createdAt as any)) : new Date()
      });

      // Also upload associated sales items
      const sItems = await offlineDb.salesItems
        .where('salesEntryId').equals(sale.id)
        .toArray();
      for (const si of sItems) {
        const siRef = firestoreDoc(db, 'centers', centerId, 'sales_items', si.id);
        const { localUpdatedAt: _, ...siData } = si;
        await setDoc(siRef, siData);
      }

      await offlineDb.salesEntries.update(sale.id, { pendingSync: 0 });
    }

    // 9. Upload pending Stock Adjustments
    const pendingAdjs = await offlineDb.stockAdjustments
      .where('centerId').equals(centerId)
      .and(a => a.pendingSync === 1)
      .toArray();
    for (const adj of pendingAdjs) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'stock_adjustments', adj.id);
      if (adj.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.stockAdjustments.delete(adj.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = adj;
      await setDoc(docRef, {
        ...uploadData,
        createdAt: adj.createdAt ? Timestamp.fromDate(new Date(adj.createdAt as any)) : new Date()
      });
      await offlineDb.stockAdjustments.update(adj.id, { pendingSync: 0 });
    }

    // 10. Upload pending Supplier Payments
    const pendingPayments = await offlineDb.supplierPayments
      .where('centerId').equals(centerId)
      .and(p => p.pendingSync === 1)
      .toArray();
    for (const p of pendingPayments) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'supplier_payments', p.id);
      if (p.isDeleted === 1) {
        await deleteDoc(docRef);
        await offlineDb.supplierPayments.delete(p.id);
        continue;
      }
      const { pendingSync, isDeleted, localUpdatedAt, ...uploadData } = p;
      await setDoc(docRef, {
        ...uploadData,
        paymentDate: p.paymentDate ? Timestamp.fromDate(new Date(p.paymentDate as any)) : new Date(),
        createdAt: p.createdAt ? Timestamp.fromDate(new Date(p.createdAt as any)) : new Date()
      });
      await offlineDb.supplierPayments.update(p.id, { pendingSync: 0 });
    }

    // 11. Upload pending Inventory Logs
    const pendingLogs = await offlineDb.inventoryLogs
      .where('centerId').equals(centerId)
      .and(l => l.pendingSync === 1)
      .toArray();
    for (const log of pendingLogs) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'inventory_logs', log.id);
      const { pendingSync, localUpdatedAt, ...uploadData } = log;
      await setDoc(docRef, {
        ...uploadData,
        createdAt: log.createdAt ? Timestamp.fromDate(new Date(log.createdAt as any)) : new Date()
      });
      await offlineDb.inventoryLogs.update(log.id, { pendingSync: 0 });
    }

    // 12. Upload Inventory Settings
    const settings = await offlineDb.inventorySettings.get(centerId);
    if (settings) {
      const docRef = firestoreDoc(db, 'centers', centerId, 'settings', 'inventory');
      const { localUpdatedAt, ...uploadData } = settings;
      await setDoc(docRef, uploadData);
    }
  },

  /**
   * Download updates from Firebase Firestore to local IndexedDB cache.
   */
  downloadUpdates: async (centerId: string): Promise<void> => {
    const lastSync = getLastSyncTime(centerId);
    const syncTime = Date.now();

    // 1. Download Farmers
    const farmersSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'farmers'));
    const farmersList = farmersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Farmer));
    for (const f of farmersList) {
      await offlineDb.farmers.put({
        ...f,
        centerId,
        localUpdatedAt: syncTime
      });
    }

    // 2. Download Rate Charts
    const chartsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'rateCharts'));
    const chartsList = chartsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChart));
    for (const c of chartsList) {
      await offlineDb.rateCharts.put({
        ...c,
        centerId,
        localUpdatedAt: syncTime
      });

      // Download Rate Chart Entries for each chart
      const entriesSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'rateCharts', c.id, 'rateChartEntries'));
      const entriesList = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RateChartEntry));
      for (const entry of entriesList) {
        await offlineDb.rateChartEntries.put({
          ...entry,
          centerId,
          localUpdatedAt: syncTime
        });
      }
    }

    // 3. Download Collections updated since last sync
    const colSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'collections'));
    const collectionsList = colSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
    for (const c of collectionsList) {
      const local = await offlineDb.collections.get(c.id);
      
      // If locally modified and pending sync, detect conflict
      if (local && local.pendingSync === 1) {
        if (local.liters !== c.liters || local.fat !== c.fat || local.snf !== c.snf) {
          await offlineDb.conflicts.put({
            id: c.id,
            type: 'collection',
            localData: local,
            cloudData: c,
            createdAt: Date.now()
          });
          continue;
        }
      }

      // Convert Firebase timestamp to Date if applicable
      const createdAtDate = (c.createdAt as any)?.toDate?.() || new Date(c.createdAt as any);

      await offlineDb.collections.put({
        ...c,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 4. Download Ledger entries updated since last sync
    const ledgerSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'ledger'));
    const ledgerList = ledgerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
    for (const l of ledgerList) {
      const createdAtDate = (l.createdAt as any)?.toDate?.() || new Date(l.createdAt as any);

      await offlineDb.ledger.put({
        ...l,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 5. Download Deductions
    const dedSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'deductions'));
    const deductionsList = dedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const d of deductionsList) {
      const deductionDateVal = (d.deductionDate as any)?.toDate?.() || new Date(d.deductionDate as any);
      const createdAtDate = (d.createdAt as any)?.toDate?.() || new Date(d.createdAt as any);

      await offlineDb.deductions.put({
        ...d,
        deductionDate: deductionDateVal,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 6. Download Dispatches
    const dispSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'dispatches'));
    const dispatchList = dispSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const d of dispatchList) {
      const dispatchDateVal = (d.dispatchDate as any)?.toDate?.() || new Date(d.dispatchDate as any);
      const createdAtDate = (d.createdAt as any)?.toDate?.() || new Date(d.createdAt as any);

      await offlineDb.dispatches.put({
        ...d,
        dispatchDate: dispatchDateVal,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 7. Download Inventory Items
    const itemsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'inventory_items'));
    const itemsList = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const item of itemsList) {
      const createdAtDate = (item.createdAt as any)?.toDate?.() || new Date(item.createdAt as any);
      const updatedAtDate = (item.updatedAt as any)?.toDate?.() || new Date(item.updatedAt as any);
      await offlineDb.inventoryItems.put({
        ...item,
        createdAt: createdAtDate,
        updatedAt: updatedAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 8. Download Inventory Variants
    const variantsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'inventory_variants'));
    const variantsList = variantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const v of variantsList) {
      const createdAtDate = (v.createdAt as any)?.toDate?.() || new Date(v.createdAt as any);
      await offlineDb.inventoryVariants.put({
        ...v,
        createdAt: createdAtDate,
        centerId,
        localUpdatedAt: syncTime
      });
    }

    // 9. Download Suppliers
    const suppliersSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'suppliers'));
    const suppliersList = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const s of suppliersList) {
      const createdAtDate = (s.createdAt as any)?.toDate?.() || new Date(s.createdAt as any);
      await offlineDb.suppliers.put({
        ...s,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 10. Download Purchase Entries & Items
    const purchasesSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'purchase_entries'));
    const purchasesList = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const p of purchasesList) {
      const dateDate = (p.date as any)?.toDate?.() || new Date(p.date as any);
      const createdAtDate = (p.createdAt as any)?.toDate?.() || new Date(p.createdAt as any);
      await offlineDb.purchaseEntries.put({
        ...p,
        date: dateDate,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    const pItemsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'purchase_items'));
    const pItemsList = pItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const pi of pItemsList) {
      await offlineDb.purchaseItems.put({
        ...pi,
        centerId,
        localUpdatedAt: syncTime
      });
    }

    // 11. Download Sales Entries & Items
    const salesSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'sales_entries'));
    const salesList = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const s of salesList) {
      const dateDate = (s.date as any)?.toDate?.() || new Date(s.date as any);
      const createdAtDate = (s.createdAt as any)?.toDate?.() || new Date(s.createdAt as any);
      await offlineDb.salesEntries.put({
        ...s,
        date: dateDate,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    const sItemsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'sales_items'));
    const sItemsList = sItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const si of sItemsList) {
      await offlineDb.salesItems.put({
        ...si,
        centerId,
        localUpdatedAt: syncTime
      });
    }

    // 12. Download Stock Adjustments
    const adjsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'stock_adjustments'));
    const adjsList = adjsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const a of adjsList) {
      const createdAtDate = (a.createdAt as any)?.toDate?.() || new Date(a.createdAt as any);
      await offlineDb.stockAdjustments.put({
        ...a,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 13. Download Supplier Payments
    const paymentsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'supplier_payments'));
    const paymentsList = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const p of paymentsList) {
      const paymentDateVal = (p.paymentDate as any)?.toDate?.() || new Date(p.paymentDate as any);
      const createdAtDate = (p.createdAt as any)?.toDate?.() || new Date(p.createdAt as any);
      await offlineDb.supplierPayments.put({
        ...p,
        paymentDate: paymentDateVal,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: syncTime
      });
    }

    // 14. Download Inventory Logs
    const logsSnap = await getDocs(firestoreCollection(db, 'centers', centerId, 'inventory_logs'));
    const logsList = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    for (const log of logsList) {
      const createdAtDate = (log.createdAt as any)?.toDate?.() || new Date(log.createdAt as any);
      await offlineDb.inventoryLogs.put({
        ...log,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        localUpdatedAt: syncTime
      });
    }

    // 15. Download Inventory Settings
    const settingsSnap = await getDoc(firestoreDoc(db, 'centers', centerId, 'settings', 'inventory'));
    if (settingsSnap.exists()) {
      await offlineDb.inventorySettings.put({
        ...settingsSnap.data() as any,
        centerId,
        localUpdatedAt: syncTime
      });
    }

    setLastSyncTime(centerId, syncTime);
  },

  /**
   * Resolves a conflict by keeping either local or cloud data.
   */
  resolveConflict: async (conflictId: string, resolution: 'local' | 'cloud', centerId: string): Promise<void> => {
    const conflict = await offlineDb.conflicts.get(conflictId);
    if (!conflict) return;

    if (resolution === 'local') {
      // Keep local: Mark local collection as pending sync so it uploads on next sync cycle
      await offlineDb.collections.update(conflictId, { pendingSync: 1 });
    } else {
      // Keep cloud: Overwrite local IndexedDB with cloud data and set pendingSync = 0
      const c = conflict.cloudData;
      const createdAtDate = (c.createdAt as any)?.toDate?.() || new Date(c.createdAt as any);

      await offlineDb.collections.put({
        ...c,
        createdAt: createdAtDate,
        centerId,
        pendingSync: 0,
        isDeleted: 0,
        localUpdatedAt: Date.now()
      });

      // Recalculate farmer running balance to ensure local consistency
      await recalculateAndSyncFarmerBalance(centerId, c.farmerId);
    }

    // Delete conflict log
    await offlineDb.conflicts.delete(conflictId);
  },

  /**
   * Run full synchronization cycle (Upload -> Download).
   */
  runSync: async (centerId: string): Promise<void> => {
    // 1. Upload local modifications
    await syncEngine.uploadPending(centerId);
    
    // 2. Download cloud updates
    await syncEngine.downloadUpdates(centerId);

    // 3. Recalculate balances for all farmers to ensure perfect consistency
    const farmers = await offlineDb.farmers.where('centerId').equals(centerId).toArray();
    for (const f of farmers) {
      await recalculateAndSyncFarmerBalance(centerId, f.id);
    }
  }
};
