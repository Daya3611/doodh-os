import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, orderBy, where, getDoc, Timestamp
} from 'firebase/firestore';
import { InventoryItem, InventoryItemFormData, InventoryVariant, VariantDraftRow, StockAdjustment, InventoryLog, InventorySettings } from '@/types';
import { offlineDb, OfflineInventoryItem } from '@/lib/offlineDb';
import { toSafeNumber } from '@/utils/format';

// Default seeded masters
const DEFAULT_CATEGORIES = ['Cattle Feed', 'Medicines', 'Equipment', 'Milking Accessories', 'Cleaners / Disinfectants', 'Others'];
const DEFAULT_BRANDS = ['DoodhOS', 'Godrej Vetfeed', 'Kanak', 'Kapila', 'Himalaya', 'Generic'];
const DEFAULT_UNITS = ['Piece', 'KG', 'Gram', 'Litre', 'ML', 'Bag', 'Packet', 'Box', 'Bottle', 'Can'];

/** Normalizes an InventoryItem ensuring default 3-tier unit properties are present */
function normalizeItem(item: any): InventoryItem {
  const stockUnit = item.stockUnit || item.baseUnit || 'KG';
  const defaultPurchaseUnit = item.defaultPurchaseUnit || item.purchaseUnit || `50 ${stockUnit} Bag`;
  const purchaseMultiplier = toSafeNumber(item.purchaseMultiplier) || 1;
  const purchasePrice = toSafeNumber(item.purchasePrice);
  const averageCostPerBaseUnit = purchaseMultiplier > 0 ? Number((purchasePrice / purchaseMultiplier).toFixed(4)) : 0;
  const stockInBaseUnit = item.stockInBaseUnit !== undefined ? item.stockInBaseUnit : (item.currentStock || item.stock || 0);

  return {
    ...item,
    baseUnit: stockUnit,
    stockUnit,
    defaultPurchaseUnit,
    purchaseMultiplier,
    purchasePrice,
    averageCostPerBaseUnit,
    stockInBaseUnit,
  };
}

/** Ensures all numeric fields on a variant are proper numbers.
 *  Purchase cost is ALWAYS auto-calculated from item purchasePrice / purchaseMultiplier.
 *  If pricingMode === 'auto', sellingPrice is auto-calculated using profitMargin.
 */
function normalizeVariant(v: any, itemPurchasePrice = 0, itemPurchaseMultiplier = 1): InventoryVariant {
  const multiplier = toSafeNumber(v.multiplier || v.packageSize || v.conversionValue || v.conversionQty) || 1;
  const name = v.name || v.variantName || v.conversionUnit || v.unit || 'Loose';

  // Variant purchase cost is ALWAYS auto-calculated: multiplier * (itemPurchasePrice / itemPurchaseMultiplier)
  const unitCost = itemPurchaseMultiplier > 0 ? (itemPurchasePrice / itemPurchaseMultiplier) : 0;
  const purchasePrice = Number((multiplier * unitCost).toFixed(2));

  const pricingMode = v.pricingMode === 'auto' ? 'auto' : 'manual';
  const profitMargin = toSafeNumber(v.profitMargin || 0);

  let sellingPrice = toSafeNumber(v.sellingPrice !== undefined ? v.sellingPrice : v.sellingPricePerVariant);
  if (pricingMode === 'auto') {
    sellingPrice = Number((purchasePrice * (1 + profitMargin / 100)).toFixed(2));
  }

  return {
    id: v.id,
    itemId: v.itemId,
    name,
    multiplier,
    packageSize: multiplier,
    purchasePrice,
    pricingMode,
    profitMargin,
    sellingPrice,
    barcode: v.barcode || '',
    sku: v.sku || '',
    isDefault: v.isDefault === true || v.purchaseAllowed !== false,
    isActive: v.isActive !== false && v.status !== 'inactive',
    createdAt: v.createdAt || new Date()
  };
}

export const inventoryService = {
  getCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'inventory_items'),

  getVariantCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'inventory_variants'),

  getAdjustmentCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'stock_adjustments'),

  getLogCollectionRef: (centerId: string) =>
    collection(db, 'centers', centerId, 'inventory_logs'),

  getAll: async (centerId: string): Promise<InventoryItem[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(inventoryService.getCollectionRef(centerId), orderBy('name', 'asc')));
        const cloudItems = snap.docs.map(d => normalizeItem({ id: d.id, ...d.data() }));

        const syncTime = Date.now();
        for (const item of cloudItems) {
          await offlineDb.inventoryItems.put({
            ...item,
            createdAt: (item.createdAt as any).toDate ? (item.createdAt as any).toDate() : new Date(item.createdAt as any),
            updatedAt: (item.updatedAt as any).toDate ? (item.updatedAt as any).toDate() : new Date(item.updatedAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudItems;
      } catch (err) {
        console.warn("Failed to fetch inventory online, using local cache:", err);
      }
    }

    const local = await offlineDb.inventoryItems
      .where('centerId').equals(centerId)
      .and(i => i.isDeleted !== 1)
      .toArray();
    return local.map(normalizeItem).sort((a, b) => a.name.localeCompare(b.name));
  },

  add: async (centerId: string, data: InventoryItemFormData): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const itemData = normalizeItem({
      ...data,
      stockInBaseUnit: data.stockInBaseUnit || 0
    });

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
        await setDoc(ref, {
          ...itemData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await offlineDb.inventoryItems.put({
          ...itemData,
          id: itemId,
          centerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        return itemId;
      } catch (err) {
        console.warn("Failed to add inventory item online, falling back to offline write:", err);
      }
    }

    // Offline Save
    await offlineDb.inventoryItems.put({
      ...itemData,
      id: itemId,
      centerId,
      createdAt: new Date(),
      updatedAt: new Date(),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    return itemId;
  },

  update: async (centerId: string, itemId: string, data: Partial<InventoryItemFormData>): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const local = await offlineDb.inventoryItems.get(itemId);
    if (!local) throw new Error('Item not found');

    const normalized = normalizeItem({
      ...local,
      ...data
    });

    const updatedLocal: OfflineInventoryItem = {
      ...local,
      ...normalized,
      centerId,
      updatedAt: new Date(),
      localUpdatedAt: Date.now(),
      pendingSync: 0,
      isDeleted: local.isDeleted || 0,
    };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
        await setDoc(ref, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await offlineDb.inventoryItems.put(updatedLocal);
        return;
      } catch (err) {
        console.warn("Failed to update inventory item online, writing offline:", err);
      }
    }

    // Offline Update
    await offlineDb.inventoryItems.put({
      ...updatedLocal,
      pendingSync: 1,
    });
  },

  delete: async (centerId: string, itemId: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    if (isOnline) {
      try {
        await deleteDoc(doc(inventoryService.getCollectionRef(centerId), itemId));
        await offlineDb.inventoryItems.delete(itemId);

        // Also delete associated variants
        const vars = await offlineDb.inventoryVariants.where('itemId').equals(itemId).toArray();
        for (const v of vars) {
          await deleteDoc(doc(inventoryService.getVariantCollectionRef(centerId), v.id));
          await offlineDb.inventoryVariants.delete(v.id);
        }
        return;
      } catch (err) {
        console.warn("Failed to delete inventory item online, marking deleted offline:", err);
      }
    }

    const local = await offlineDb.inventoryItems.get(itemId);
    if (local) {
      await offlineDb.inventoryItems.put({
        ...local,
        isDeleted: 1,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
      // Mark variants deleted or delete them locally
      const vars = await offlineDb.inventoryVariants.where('itemId').equals(itemId).toArray();
      for (const v of vars) {
        await offlineDb.inventoryVariants.delete(v.id);
      }
    }
  },

  // Variants Management
  getVariants: async (centerId: string, itemId: string): Promise<InventoryVariant[]> => {
    let item: InventoryItem | undefined;
    try {
      const localItem = await offlineDb.inventoryItems.get(itemId);
      if (localItem) item = normalizeItem(localItem);
    } catch { }

    const itemPrice = item?.purchasePrice || 0;
    const itemMult = item?.purchaseMultiplier || 1;

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const q = query(inventoryService.getVariantCollectionRef(centerId), where('itemId', '==', itemId));
        const snap = await getDocs(q);
        const cloudVars = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryVariant));

        const syncTime = Date.now();
        for (const v of cloudVars) {
          await offlineDb.inventoryVariants.put({
            ...v,
            createdAt: (v.createdAt as any).toDate ? (v.createdAt as any).toDate() : new Date(v.createdAt as any),
            centerId,
            localUpdatedAt: syncTime
          });
        }
        return cloudVars.map(v => normalizeVariant(v, itemPrice, itemMult));
      } catch (err) {
        console.warn("Failed to fetch variants online, using local cache:", err);
      }
    }

    const local = await offlineDb.inventoryVariants
      .where('itemId').equals(itemId)
      .and(v => v.centerId === centerId)
      .toArray();
    return local.map(v => normalizeVariant(v, itemPrice, itemMult));
  },

  addVariant: async (centerId: string, variant: Omit<InventoryVariant, 'createdAt' | 'id'> & { id?: string }): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const variantId = variant.id || `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const variantData = {
      ...variant,
      id: variantId,
      createdAt: new Date(),
    };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getVariantCollectionRef(centerId), variantId);
        await setDoc(ref, {
          ...variantData,
          createdAt: serverTimestamp(),
        });

        await offlineDb.inventoryVariants.put({
          ...variantData,
          centerId,
          localUpdatedAt: Date.now()
        });
        return variantId;
      } catch (err) {
        console.warn("Failed to add variant online, writing offline:", err);
      }
    }

    await offlineDb.inventoryVariants.put({
      ...variantData,
      centerId,
      localUpdatedAt: Date.now()
    });

    // Mark parent item as pending sync to ensure variants upload on next sync cycle
    const parent = await offlineDb.inventoryItems.get(variant.itemId);
    if (parent) {
      await offlineDb.inventoryItems.put({
        ...parent,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
    }

    return variantId;
  },

  updateVariant: async (centerId: string, variantId: string, data: Partial<Omit<InventoryVariant, 'id' | 'itemId' | 'createdAt'>>): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const local = await offlineDb.inventoryVariants.get(variantId);
    if (!local) throw new Error('Variant not found');

    const updatedLocal = { ...local, ...data, localUpdatedAt: Date.now() };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getVariantCollectionRef(centerId), variantId);
        await setDoc(ref, data, { merge: true });

        await offlineDb.inventoryVariants.put(updatedLocal);
        return;
      } catch (err) {
        console.warn("Failed to update variant online, writing offline:", err);
      }
    }

    await offlineDb.inventoryVariants.put(updatedLocal);

    const parent = await offlineDb.inventoryItems.get(local.itemId);
    if (parent) {
      await offlineDb.inventoryItems.put({
        ...parent,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
    }
  },

  deleteVariant: async (centerId: string, variantId: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const local = await offlineDb.inventoryVariants.get(variantId);
    if (!local) return;

    if (isOnline) {
      try {
        await deleteDoc(doc(inventoryService.getVariantCollectionRef(centerId), variantId));
        await offlineDb.inventoryVariants.delete(variantId);
        return;
      } catch (err) {
        console.warn("Failed to delete variant online, deleting locally:", err);
      }
    }

    await offlineDb.inventoryVariants.delete(variantId);
    const parent = await offlineDb.inventoryItems.get(local.itemId);
    if (parent) {
      await offlineDb.inventoryItems.put({
        ...parent,
        pendingSync: 1,
        localUpdatedAt: Date.now()
      });
    }
  },

  saveItemWithVariants: async (
    centerId: string,
    itemData: InventoryItemFormData,
    variants: VariantDraftRow[],
    existingItemId?: string
  ): Promise<string> => {
    let itemId = existingItemId;

    if (itemId) {
      // Update item master
      await inventoryService.update(centerId, itemId, itemData);

      // Fetch existing variants
      const existingVariants = await inventoryService.getVariants(centerId, itemId);
      const keepVariantIds = new Set(variants.filter(v => v.id).map(v => v.id as string));

      // Delete removed variants
      for (const ev of existingVariants) {
        if (!keepVariantIds.has(ev.id)) {
          await inventoryService.deleteVariant(centerId, ev.id);
        }
      }

      // Add or update passed variants
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const mult = Number(v.multiplier || v.packageSize || 1);
        if (v.id && existingVariants.some(ev => ev.id === v.id)) {
          await inventoryService.updateVariant(centerId, v.id, {
            name: v.name,
            multiplier: mult,
            packageSize: mult,
            purchasePrice: v.purchasePrice,
            pricingMode: v.pricingMode || 'manual',
            profitMargin: v.profitMargin || 0,
            sellingPrice: v.sellingPrice,
            barcode: v.barcode,
            sku: v.sku,
            isDefault: v.isDefault,
            isActive: v.isActive,
          });
        } else {
          await inventoryService.addVariant(centerId, {
            id: v.id || `var-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
            itemId,
            name: v.name,
            multiplier: mult,
            packageSize: mult,
            purchasePrice: v.purchasePrice,
            pricingMode: v.pricingMode || 'manual',
            profitMargin: v.profitMargin || 0,
            sellingPrice: v.sellingPrice,
            barcode: v.barcode || '',
            sku: v.sku || itemData.sku,
            isDefault: v.isDefault,
            isActive: v.isActive,
          });
        }
      }
    } else {
      // Add new item
      const isOnline = typeof window !== 'undefined' && navigator.onLine;
      itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newItem = {
        ...itemData,
        stockUnit: itemData.stockUnit || itemData.baseUnit,
        stockInBaseUnit: itemData.stockInBaseUnit || 0
      };

      if (isOnline) {
        try {
          const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
          await setDoc(ref, {
            ...newItem,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await offlineDb.inventoryItems.put({
            id: itemId,
            ...newItem,
            centerId,
            createdAt: new Date(),
            updatedAt: new Date(),
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
        } catch (err) {
          console.warn("Failed to save item online, writing offline:", err);
          await offlineDb.inventoryItems.put({
            id: itemId,
            ...newItem,
            centerId,
            createdAt: new Date(),
            updatedAt: new Date(),
            pendingSync: 1,
            isDeleted: 0,
            localUpdatedAt: Date.now()
          });
        }
      } else {
        await offlineDb.inventoryItems.put({
          id: itemId,
          ...newItem,
          centerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          pendingSync: 1,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });
      }

      // Add all variants for the new item
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const mult = Number(v.multiplier || v.packageSize || 1);
        await inventoryService.addVariant(centerId, {
          id: v.id || `var-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          itemId,
          name: v.name,
          multiplier: mult,
          packageSize: mult,
          purchasePrice: v.purchasePrice,
          pricingMode: v.pricingMode || 'manual',
          profitMargin: v.profitMargin || 0,
          sellingPrice: v.sellingPrice,
          barcode: v.barcode || '',
          sku: v.sku || itemData.sku,
          isDefault: v.isDefault,
          isActive: v.isActive,
        });
      }
    }

    return itemId;
  },

  // Stock Adjustments
  addAdjustment: async (
    centerId: string,
    data: Omit<StockAdjustment, 'id' | 'createdAt' | 'createdBy'>,
    createdBy: string
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const adjId = `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate new stocks
    const localVariant = await offlineDb.inventoryVariants.get(data.variantId);
    const localItem = await offlineDb.inventoryItems.get(data.itemId);

    const prevItemStock = localItem?.stockInBaseUnit || 0;
    const packageSize = localVariant?.packageSize || 1;
    const convertedQty = data.quantity * packageSize;
    const newItemStock = prevItemStock + convertedQty;

    const adjustmentData = {
      ...data,
      packageSizeSnapshot: packageSize,
      id: adjId,
      createdBy,
      createdAt: new Date(),
    };

    const auditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId: data.itemId,
      itemName: data.itemName,
      variantId: data.variantId,
      variantName: data.variantName,
      prevStock: prevItemStock,
      newStock: newItemStock,
      quantity: convertedQty, // Base quantity logged
      actionType: 'adjustment' as const,
      referenceId: adjId,
      reason: `Stock Adjustment: ${data.reason.replace('_', ' ')}. ${data.notes || ''} (${data.quantity} ${data.variantName} = ${convertedQty} ${localItem?.baseUnit || 'KG'})`,
      createdBy,
      createdAt: new Date(),
      centerId
    };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getAdjustmentCollectionRef(centerId), adjId);
        await setDoc(ref, {
          ...adjustmentData,
          createdAt: serverTimestamp(),
        });

        // Update parent item stock online
        await setDoc(doc(db, 'centers', centerId, 'inventory_items', data.itemId), { stockInBaseUnit: newItemStock }, { merge: true });

        // Add audit log online
        const logRef = doc(inventoryService.getLogCollectionRef(centerId), auditLog.id);
        const { centerId: _, ...logUpload } = auditLog;
        await setDoc(logRef, {
          ...logUpload,
          createdAt: serverTimestamp()
        });

        // Write locally
        await offlineDb.stockAdjustments.put({
          ...adjustmentData,
          centerId,
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        await offlineDb.inventoryItems.update(data.itemId, { stockInBaseUnit: newItemStock });

        await offlineDb.inventoryLogs.put({
          ...auditLog,
          pendingSync: 0,
          localUpdatedAt: Date.now()
        });

        return adjId;
      } catch (err) {
        console.warn("Failed to write adjustment online, writing offline:", err);
      }
    }

    // Offline Save
    await offlineDb.stockAdjustments.put({
      ...adjustmentData,
      centerId,
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    await offlineDb.inventoryItems.update(data.itemId, { stockInBaseUnit: newItemStock });

    await offlineDb.inventoryLogs.put({
      ...auditLog,
      pendingSync: 1,
      localUpdatedAt: Date.now()
    });

    return adjId;
  },

  /**
   * Returns true if any purchase, sale, or stock adjustment has ever used this variant.
   * Used to lock the packageSize field on the edit variant form — changing it retroactively
   * would corrupt the base-unit conversion on all historical transactions.
   */
  variantHasTransactions: async (centerId: string, variantId: string): Promise<boolean> => {
    // Check IndexedDB (offline-first; these tables have variantId indexed)
    const purchaseCount = await offlineDb.purchaseItems
      .where('variantId').equals(variantId)
      .and(p => p.centerId === centerId)
      .count();
    if (purchaseCount > 0) return true;

    const salesCount = await offlineDb.salesItems
      .where('variantId').equals(variantId)
      .and(s => s.centerId === centerId)
      .count();
    if (salesCount > 0) return true;

    const adjCount = await offlineDb.stockAdjustments
      .where('variantId').equals(variantId)
      .and(a => a.centerId === centerId && a.isDeleted !== 1)
      .count();
    return adjCount > 0;
  },

  /**
   * Promotes one variant to isDefault = true and demotes all sibling variants.
   * Writes to both Firestore (when online) and IndexedDB.
   */
  setDefaultVariant: async (centerId: string, variantId: string, itemId: string): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const siblings = await offlineDb.inventoryVariants.where('itemId').equals(itemId).toArray();

    for (const v of siblings) {
      const shouldBeDefault = v.id === variantId;
      if (v.isDefault === shouldBeDefault) continue; // already correct, skip write

      const updated = { ...v, isDefault: shouldBeDefault, localUpdatedAt: Date.now() };
      await offlineDb.inventoryVariants.put(updated);

      if (isOnline) {
        try {
          const ref = doc(inventoryService.getVariantCollectionRef(centerId), v.id);
          await setDoc(ref, { isDefault: shouldBeDefault }, { merge: true });
        } catch (err) {
          console.warn(`Failed to sync isDefault for variant ${v.id}:`, err);
        }
      }
    }
  },

  getAdjustments: async (centerId: string): Promise<StockAdjustment[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(inventoryService.getAdjustmentCollectionRef(centerId), orderBy('createdAt', 'desc')));
        const cloudAdjs = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockAdjustment));

        const syncTime = Date.now();
        for (const a of cloudAdjs) {
          await offlineDb.stockAdjustments.put({
            ...a,
            createdAt: (a.createdAt as any).toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as any),
            centerId,
            pendingSync: 0,
            isDeleted: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudAdjs;
      } catch (err) {
        console.warn("Failed to fetch adjustments online, using cache:", err);
      }
    }

    const local = await offlineDb.stockAdjustments
      .where('centerId').equals(centerId)
      .and(a => a.isDeleted !== 1)
      .toArray();

    return local.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  },

  getLogs: async (centerId: string): Promise<InventoryLog[]> => {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDocs(query(inventoryService.getLogCollectionRef(centerId), orderBy('createdAt', 'desc')));
        const cloudLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog));

        const syncTime = Date.now();
        for (const l of cloudLogs) {
          await offlineDb.inventoryLogs.put({
            ...l,
            createdAt: (l.createdAt as any).toDate ? (l.createdAt as any).toDate() : new Date(l.createdAt as any),
            centerId,
            pendingSync: 0,
            localUpdatedAt: syncTime
          });
        }
        return cloudLogs;
      } catch (err) {
        console.warn("Failed to fetch logs online, using cache:", err);
      }
    }

    const local = await offlineDb.inventoryLogs
      .where('centerId').equals(centerId)
      .toArray();

    return local.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
  },

  // Settings & Masters
  getInventorySettings: async (centerId: string): Promise<InventorySettings & { categories: string[], brands: string[], units: string[] }> => {
    const defaultData = {
      enableNegativeStock: false,
      autoGenerateSku: true,
      autoBarcode: true,
      gstEnabled: true,
      lowStockThreshold: 10,
      categories: DEFAULT_CATEGORIES,
      brands: DEFAULT_BRANDS,
      units: DEFAULT_UNITS
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const snap = await getDoc(doc(db, 'centers', centerId, 'settings', 'inventory'));
        if (snap.exists()) {
          const cloudSettings = snap.data() as any;
          const merged = { ...defaultData, ...cloudSettings };

          await offlineDb.inventorySettings.put({
            ...merged,
            centerId,
            localUpdatedAt: Date.now()
          });
          return merged;
        }
      } catch (err) {
        console.warn("Failed to fetch settings online, using local cache:", err);
      }
    }

    const local = await offlineDb.inventorySettings.get(centerId);
    if (local) {
      return {
        enableNegativeStock: local.enableNegativeStock ?? false,
        autoGenerateSku: local.autoGenerateSku ?? true,
        autoBarcode: local.autoBarcode ?? true,
        gstEnabled: local.gstEnabled ?? true,
        lowStockThreshold: local.lowStockThreshold ?? 10,
        categories: local.categories || DEFAULT_CATEGORIES,
        brands: local.brands || DEFAULT_BRANDS,
        units: local.units || DEFAULT_UNITS
      } as any;
    }

    return defaultData;
  },

  saveInventorySettings: async (centerId: string, settings: Partial<InventorySettings & { categories: string[], brands: string[], units: string[] }>): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const current = await inventoryService.getInventorySettings(centerId);
    const updated = { ...current, ...settings };

    if (isOnline) {
      try {
        await setDoc(doc(db, 'centers', centerId, 'settings', 'inventory'), updated, { merge: true });
        await offlineDb.inventorySettings.put({
          ...updated,
          centerId,
          localUpdatedAt: Date.now()
        });
        return;
      } catch (err) {
        console.warn("Failed to save settings online, writing offline:", err);
      }
    }

    await offlineDb.inventorySettings.put({
      ...updated,
      centerId,
      localUpdatedAt: Date.now()
    });
  },

  migrateVariantStocks: async (centerId: string) => {
    // 1. Back up current inventory items and variants to localStorage
    try {
      const allItems = await offlineDb.inventoryItems.where('centerId').equals(centerId).toArray();
      const allVars = await offlineDb.inventoryVariants.toArray();
      localStorage.setItem('doodhos_inventory_backup_v1', JSON.stringify({ items: allItems, variants: allVars }));
      console.log("Backup of V1 inventory completed successfully in localStorage.");
    } catch (e) {
      console.error("Failed to create backup in localStorage:", e);
    }

    // 2. Consolidate stock and normalize variant schema
    const items = await offlineDb.inventoryItems.where('centerId').equals(centerId).toArray();
    for (const item of items) {
      const variants = await offlineDb.inventoryVariants.where('itemId').equals(item.id).toArray();
      let totalStockInBaseUnit = 0;

      for (const v of variants) {
        const stock = (v as any).currentStock || (v as any).stock || 0;
        if (stock > 0) {
          const packageSize = v.packageSize || (v as any).conversionValue || (v as any).conversionQty || 1;
          totalStockInBaseUnit += (stock * packageSize);
        }
      }

      const prevStock = item.stockInBaseUnit !== undefined ? item.stockInBaseUnit : ((item as any).currentStock || (item as any).stock || 0);
      const newTotalStock = prevStock + totalStockInBaseUnit;

      // Update parent item stock and clean up old fields
      const updatedItem: any = {
        ...item,
        stockInBaseUnit: newTotalStock
      };
      delete updatedItem.currentStock;
      delete updatedItem.stock;
      delete updatedItem.price;
      delete updatedItem.defaultPurchasePrice;
      delete updatedItem.defaultSellingPrice;

      await offlineDb.inventoryItems.put(updatedItem);

      if (typeof window !== 'undefined' && navigator.onLine) {
        try {
          const itemRef = doc(db, 'centers', centerId, 'inventory_items', item.id);
          // Overwrite Firestore document
          await setDoc(itemRef, updatedItem);
        } catch (e) {
          console.error("Failed to sync migrated stock for item", item.id, e);
        }
      }

      // Migrate variants schema
      for (const v of variants) {
        const normalized = normalizeVariant(v);
        const updatedVar: any = {
          ...normalized
        };
        delete updatedVar.conversionValue;
        delete updatedVar.conversionUnit;
        delete updatedVar.conversionQty;
        delete updatedVar.status;
        delete updatedVar.purchaseAllowed;
        delete updatedVar.sellingAllowed;
        delete updatedVar.purchasePricePerBaseUnit;
        delete updatedVar.sellingPricePerBaseUnit;
        delete updatedVar.unit;
        delete updatedVar.baseUnit;

        await offlineDb.inventoryVariants.put(updatedVar);

        if (typeof window !== 'undefined' && navigator.onLine) {
          try {
            const varRef = doc(db, 'centers', centerId, 'inventory_variants', v.id);
            await setDoc(varRef, updatedVar);
          } catch (e) {
            console.error("Failed to sync migrated variant", v.id, e);
          }
        }
      }
    }
    console.log("Migration to V2 inventory schema completed successfully.");
  }
};
