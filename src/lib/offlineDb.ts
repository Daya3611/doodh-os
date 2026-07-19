import Dexie, { type Table } from 'dexie';
import { 
  Collection, RateChart, RateChartEntry, Farmer, LedgerEntry,
  InventoryItem, InventoryVariant, Supplier, PurchaseEntry, PurchaseEntryItem,
  SalesEntry, SalesEntryItem, StockAdjustment, SupplierPayment, InventoryLog,
  InventorySettings, Payment, Deduction, AccountsEntry
} from '@/types';

export interface OfflinePayment extends Payment {
  centerId: string;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number; // 0 = no, 1 = pending deletion sync
  localUpdatedAt: number; // timestamp ms
}

export interface OfflineCollection extends Collection {
  centerId: string;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number; // 0 = no, 1 = pending deletion sync
  localUpdatedAt: number; // timestamp ms
}

export interface OfflineFarmer extends Farmer {
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineRateChart extends RateChart {
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineRateChartEntry extends RateChartEntry {
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineLedgerEntry extends LedgerEntry {
  centerId: string;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number; // 0 = no, 1 = pending deletion sync
  localUpdatedAt: number; // timestamp ms
}

export interface OfflineDeduction extends Deduction {
  centerId: string;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflineAccountsEntry extends AccountsEntry {
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflineDispatch {
  id: string;
  dispatchDate: Date;
  shift: 'morning' | 'evening';
  tankerNumber: string;
  driverName?: string;
  liters: number;
  fat: number;
  snf: number;
  plantLiters?: number;
  plantFat?: number;
  plantSnf?: number;
  lossLiters?: number;
  lossFat?: number;
  lossSnf?: number;
  status: 'dispatched' | 'received';
  notes?: string;
  centerId: string;
  createdBy: string;
  createdAt: Date;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number;
  localUpdatedAt: number;
}



export interface OfflineInventoryItem extends InventoryItem {
  centerId: string;
  pendingSync: number; // 0 = synced, 1 = pending
  isDeleted: number; // 0 = no, 1 = pending deletion sync
  localUpdatedAt: number;
}

export interface OfflineInventoryVariant extends InventoryVariant {
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineSupplier extends Supplier {
  centerId: string;
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflinePurchaseEntry extends PurchaseEntry {
  centerId: string;
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflinePurchaseItem extends PurchaseEntryItem {
  id: string; // unique item id
  purchaseEntryId: string;
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineSalesEntry extends SalesEntry {
  centerId: string;
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflineSalesItem extends SalesEntryItem {
  id: string;
  salesEntryId: string;
  centerId: string;
  localUpdatedAt: number;
}

export interface OfflineStockAdjustment extends StockAdjustment {
  centerId: string;
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflineSupplierPayment extends SupplierPayment {
  centerId: string;
  pendingSync: number;
  isDeleted: number;
  localUpdatedAt: number;
}

export interface OfflineInventoryLog extends InventoryLog {
  centerId: string;
  pendingSync: number;
  localUpdatedAt: number;
}

export interface OfflineInventorySettings extends InventorySettings {
  centerId: string;
  categories?: string[];
  brands?: string[];
  units?: string[];
  localUpdatedAt: number;
}

export interface SyncConflict {
  id: string; // collection/record ID
  type: 'collection' | 'inventory_item' | 'purchase_entry' | 'sales_entry' | 'supplier' | 'stock_adjustment';
  localData: any;
  cloudData: any;
  createdAt: number;
}

class DoodhOSOfflineDB extends Dexie {
  collections!: Table<OfflineCollection, string>;
  farmers!: Table<OfflineFarmer, string>;
  rateCharts!: Table<OfflineRateChart, string>;
  rateChartEntries!: Table<OfflineRateChartEntry, string>;
  ledger!: Table<OfflineLedgerEntry, string>;
  deductions!: Table<OfflineDeduction, string>;
  dispatches!: Table<OfflineDispatch, string>;
  payments!: Table<OfflinePayment, string>;
  accounts!: Table<OfflineAccountsEntry, string>;
  conflicts!: Table<SyncConflict, string>;

  // New Inventory Tables
  inventoryItems!: Table<OfflineInventoryItem, string>;
  inventoryVariants!: Table<OfflineInventoryVariant, string>;
  suppliers!: Table<OfflineSupplier, string>;
  purchaseEntries!: Table<OfflinePurchaseEntry, string>;
  purchaseItems!: Table<OfflinePurchaseItem, string>;
  salesEntries!: Table<OfflineSalesEntry, string>;
  salesItems!: Table<OfflineSalesItem, string>;
  stockAdjustments!: Table<OfflineStockAdjustment, string>;
  supplierPayments!: Table<OfflineSupplierPayment, string>;
  inventoryLogs!: Table<OfflineInventoryLog, string>;
  inventorySettings!: Table<OfflineInventorySettings, string>;

  constructor() {
    super('DoodhOSOfflineDB');
    this.version(8).stores({
      collections: 'id, farmerId, centerId, pendingSync, isDeleted, localUpdatedAt',
      farmers: 'id, name, centerId, localUpdatedAt',
      rateCharts: 'id, animal, status, centerId, localUpdatedAt',
      rateChartEntries: 'id, rateChartId, centerId, localUpdatedAt',
      ledger: 'id, farmerId, centerId, referenceId, pendingSync, isDeleted, localUpdatedAt',
      deductions: 'id, farmerId, centerId, pendingSync, isDeleted, localUpdatedAt, fromDate, toDate',
      dispatches: 'id, shift, status, centerId, pendingSync, isDeleted, localUpdatedAt',
      payments: 'id, farmerId, centerId, pendingSync, isDeleted, localUpdatedAt',
      accounts: 'id, farmerId, centerId, voucherNo, pendingSync, isDeleted, localUpdatedAt',
      conflicts: 'id, type, createdAt',

      // Inventory Stores
      inventoryItems: 'id, name, category, brand, centerId, sku, barcode, status, pendingSync, isDeleted, localUpdatedAt',
      inventoryVariants: 'id, itemId, centerId, sku, barcode, localUpdatedAt',
      suppliers: 'id, name, mobile, centerId, pendingSync, isDeleted, localUpdatedAt',
      purchaseEntries: 'id, purchaseNumber, supplierId, centerId, pendingSync, isDeleted, localUpdatedAt',
      purchaseItems: 'id, purchaseEntryId, itemId, variantId, centerId, localUpdatedAt',
      salesEntries: 'id, invoiceNumber, farmerId, centerId, pendingSync, isDeleted, localUpdatedAt',
      salesItems: 'id, salesEntryId, itemId, variantId, centerId, localUpdatedAt',
      stockAdjustments: 'id, itemId, variantId, centerId, pendingSync, isDeleted, localUpdatedAt',
      supplierPayments: 'id, supplierId, centerId, pendingSync, isDeleted, localUpdatedAt',
      inventoryLogs: 'id, itemId, variantId, centerId, pendingSync, localUpdatedAt',
      inventorySettings: 'centerId, localUpdatedAt'
    });
  }
}

export const offlineDb = new DoodhOSOfflineDB();
