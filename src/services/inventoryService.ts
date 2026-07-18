import { db } from '@/firebase/config';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query,
  serverTimestamp, orderBy, where, getDoc, Timestamp
} from 'firebase/firestore';
import { InventoryItem, InventoryItemFormData, InventoryVariant, StockAdjustment, InventoryLog, InventorySettings } from '@/types';
import { offlineDb } from '@/lib/offlineDb';
import { toSafeNumber } from '@/utils/format';

// Default seeded masters
const DEFAULT_CATEGORIES = ['Cattle Feed', 'Medicines', 'Equipment', 'Milking Accessories', 'Cleaners / Disinfectants', 'Others'];
const DEFAULT_BRANDS = ['DoodhOS', 'Godrej Vetfeed', 'Kanak', 'Kapila', 'Himalaya', 'Generic'];
const DEFAULT_UNITS = ['Piece', 'KG', 'Gram', 'Litre', 'ML', 'Bag', 'Packet', 'Box', 'Bottle', 'Can'];

/** Ensures all numeric fields on a variant are proper numbers, never undefined.
 *  Also defaults purchaseAllowed/sellingAllowed to true for old records that lack these fields.
 */
function normalizeVariant(v: InventoryVariant): InventoryVariant {
  return {
    ...v,
    purchasePrice: toSafeNumber(v.purchasePrice),
    sellingPrice: toSafeNumber(v.sellingPrice),
    currentStock: toSafeNumber(v.currentStock),
    conversionQty: toSafeNumber(v.conversionQty) || 1,
    // Backward-compat: old records don't have these fields — treat them as allowed
    purchaseAllowed: (v as any).purchaseAllowed !== false,
    sellingAllowed: (v as any).sellingAllowed !== false,
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
        const cloudItems = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            price: data.defaultSellingPrice || 0,
            stock: data.currentStock || 0,
          } as InventoryItem;
        });

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
    return local.map(i => ({
      ...i,
      price: i.defaultSellingPrice || 0,
      stock: i.currentStock || 0,
    })).sort((a, b) => a.name.localeCompare(b.name));
  },

  add: async (centerId: string, data: InventoryItemFormData): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const itemData = {
      ...data,
      currentStock: data.currentStock || 0,
      price: data.defaultSellingPrice || 0,
      stock: data.currentStock || 0,
    };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
        await setDoc(ref, {
          ...itemData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await offlineDb.inventoryItems.put({
          id: itemId,
          ...itemData,
          centerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          pendingSync: 0,
          isDeleted: 0,
          localUpdatedAt: Date.now()
        });

        // Also add a default variant matching the item itself (for simple single-unit items)
        await inventoryService.addVariant(centerId, {
          id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          itemId,
          name: `Standard (${data.unit})`,
          purchasePrice: data.defaultPurchasePrice || 0,
          sellingPrice: data.defaultSellingPrice || 0,
          currentStock: data.currentStock || 0,
          barcode: data.barcode || '',
          sku: data.sku,
          unit: data.unit,
          conversionQty: 1,
          baseUnit: data.unit,
          purchaseAllowed: true,
          sellingAllowed: true,
          status: 'active'
        });

        return itemId;
      } catch (err) {
        console.warn("Failed to add inventory item online, falling back to offline write:", err);
      }
    }

    // Offline Save
    await offlineDb.inventoryItems.put({
      id: itemId,
      ...itemData,
      centerId,
      createdAt: new Date(),
      updatedAt: new Date(),
      pendingSync: 1,
      isDeleted: 0,
      localUpdatedAt: Date.now()
    });

    await inventoryService.addVariant(centerId, {
      id: `var-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemId,
      name: `Standard (${data.unit})`,
      purchasePrice: data.defaultPurchasePrice || 0,
      sellingPrice: data.defaultSellingPrice || 0,
      currentStock: data.currentStock || 0,
      barcode: data.barcode || '',
      sku: data.sku,
      unit: data.unit,
      conversionQty: 1,
      baseUnit: data.unit,
      purchaseAllowed: true,
      sellingAllowed: true,
      status: 'active'
    });

    return itemId;
  },

  update: async (centerId: string, itemId: string, data: Partial<InventoryItemFormData>): Promise<void> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const local = await offlineDb.inventoryItems.get(itemId);
    if (!local) throw new Error('Item not found');

    const updatedLocal = {
      ...local,
      ...data,
      price: data.defaultSellingPrice !== undefined ? data.defaultSellingPrice : local.price,
      stock: data.currentStock !== undefined ? data.currentStock : local.stock,
      updatedAt: new Date(),
      localUpdatedAt: Date.now()
    };

    if (isOnline) {
      try {
        const ref = doc(inventoryService.getCollectionRef(centerId), itemId);
        await setDoc(ref, {
          ...data,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await offlineDb.inventoryItems.put({
          ...updatedLocal,
          pendingSync: 0,
        });
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
        return cloudVars.map(normalizeVariant);
      } catch (err) {
        console.warn("Failed to fetch variants online, using local cache:", err);
      }
    }

    const local = await offlineDb.inventoryVariants
      .where('itemId').equals(itemId)
      .and(v => v.centerId === centerId)
      .toArray();
    return local.map(normalizeVariant);
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

  // Stock Adjustments
  addAdjustment: async (
    centerId: string,
    data: Omit<StockAdjustment, 'id' | 'createdAt' | 'createdBy'>,
    createdBy: string
  ): Promise<string> => {
    const isOnline = typeof window !== 'undefined' && navigator.onLine;
    const adjId = `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const adjustmentData = {
      ...data,
      id: adjId,
      createdBy,
      createdAt: new Date(),
    };

    // Calculate new stocks
    const localVariant = await offlineDb.inventoryVariants.get(data.variantId);
    const localItem = await offlineDb.inventoryItems.get(data.itemId);

    const prevVariantStock = localVariant?.currentStock || 0;
    const prevItemStock = localItem?.currentStock || 0;

    const conversionQty = localVariant?.conversionQty || 1;
    const convertedQty = data.quantity * conversionQty;

    const newItemStock = prevItemStock + convertedQty;
    const newVariantStock = newItemStock / conversionQty;

    // Load all variants belonging to the parent item to update their equivalent stock
    const allVariants = await offlineDb.inventoryVariants.where('itemId').equals(data.itemId).toArray();

    const auditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      itemId: data.itemId,
      itemName: data.itemName,
      variantId: data.variantId,
      variantName: data.variantName,
      prevStock: prevVariantStock,
      newStock: newVariantStock,
      quantity: data.quantity,
      actionType: 'adjustment' as const,
      referenceId: adjId,
      reason: `Stock Adjustment: ${data.reason.replace('_', ' ')}. ${data.notes || ''} (${data.quantity} ${data.variantName} = ${convertedQty} ${localItem?.unit || 'KG'})`,
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
        await setDoc(doc(db, 'centers', centerId, 'inventory_items', data.itemId), { currentStock: newItemStock, stock: newItemStock }, { merge: true });
        
        // Update all variant stocks online
        for (const v of allVariants) {
          const vConversion = v.conversionQty || 1;
          const vNewStock = newItemStock / vConversion;
          await setDoc(doc(db, 'centers', centerId, 'inventory_variants', v.id), { currentStock: vNewStock }, { merge: true });
        }

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

        await offlineDb.inventoryItems.update(data.itemId, { currentStock: newItemStock, stock: newItemStock });
        for (const v of allVariants) {
          const vConversion = v.conversionQty || 1;
          const vNewStock = newItemStock / vConversion;
          await offlineDb.inventoryVariants.update(v.id, { currentStock: vNewStock });
        }
        
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

    await offlineDb.inventoryItems.update(data.itemId, { currentStock: newItemStock, stock: newItemStock });
    for (const v of allVariants) {
      const vConversion = v.conversionQty || 1;
      const vNewStock = newItemStock / vConversion;
      await offlineDb.inventoryVariants.update(v.id, { currentStock: vNewStock });
    }

    await offlineDb.inventoryLogs.put({
      ...auditLog,
      pendingSync: 1,
      localUpdatedAt: Date.now()
    });

    return adjId;
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
  }
};
