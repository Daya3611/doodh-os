import { create } from 'zustand';
import { offlineDb, SyncConflict } from '@/lib/offlineDb';
import { syncEngine } from '@/lib/syncEngine';

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  conflicts: SyncConflict[];
  setOnline: (online: boolean) => void;
  updatePendingCount: (centerId: string) => Promise<number>;
  loadConflicts: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'cloud', centerId: string) => Promise<void>;
  syncNow: (centerId: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isOnline: true,
  pendingCount: 0,
  syncStatus: 'idle',
  conflicts: [],

  setOnline: (online) => {
    set({ isOnline: online });
  },

  updatePendingCount: async (centerId) => {
    const colCount = await offlineDb.collections
      .where('centerId').equals(centerId)
      .and(c => c.pendingSync === 1)
      .count();

    const ledgerCount = await offlineDb.ledger
      .where('centerId').equals(centerId)
      .and(l => l.pendingSync === 1)
      .count();

    const itemCount = await offlineDb.inventoryItems
      .where('centerId').equals(centerId)
      .and(i => i.pendingSync === 1)
      .count();

    const supplierCount = await offlineDb.suppliers
      .where('centerId').equals(centerId)
      .and(s => s.pendingSync === 1)
      .count();

    const purchaseCount = await offlineDb.purchaseEntries
      .where('centerId').equals(centerId)
      .and(p => p.pendingSync === 1)
      .count();

    const saleCount = await offlineDb.salesEntries
      .where('centerId').equals(centerId)
      .and(s => s.pendingSync === 1)
      .count();

    const adjCount = await offlineDb.stockAdjustments
      .where('centerId').equals(centerId)
      .and(a => a.pendingSync === 1)
      .count();

    const paymentCount = await offlineDb.supplierPayments
      .where('centerId').equals(centerId)
      .and(p => p.pendingSync === 1)
      .count();

    const total = colCount + ledgerCount + itemCount + supplierCount + purchaseCount + saleCount + adjCount + paymentCount;
    set({ pendingCount: total });
    return total;
  },

  loadConflicts: async () => {
    const conflictsList = await offlineDb.conflicts.toArray();
    set({ conflicts: conflictsList });
  },

  resolveConflict: async (conflictId, resolution, centerId) => {
    try {
      set({ syncStatus: 'syncing' });
      await syncEngine.resolveConflict(conflictId, resolution, centerId);
      await get().loadConflicts();
      await get().updatePendingCount(centerId);
      set({ syncStatus: 'synced' });
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      set({ syncStatus: 'error' });
    }
  },

  syncNow: async (centerId) => {
    if (!get().isOnline) return;
    try {
      set({ syncStatus: 'syncing' });
      await syncEngine.runSync(centerId);
      await get().updatePendingCount(centerId);
      await get().loadConflicts();
      set({ syncStatus: 'synced' });
    } catch (err) {
      console.error('Synchronization failed:', err);
      set({ syncStatus: 'error' });
    }
  }
}));
