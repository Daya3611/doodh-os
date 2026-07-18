import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

// Status enum
export type ItemStatus = 'active' | 'inactive';

// Predefined Units
export const PREDEFINED_UNITS = [
  'Piece',
  'KG',
  'Gram',
  'Litre',
  'ML',
  'Bag',
  'Packet',
  'Box',
  'Bottle',
  'Can'
] as const;

// 1. Item Master Schema
// NOTE: defaultPurchasePrice / defaultSellingPrice are kept for backward-compatibility with old
// records but are NO LONGER required. All pricing is managed at the variant level.
export const inventoryItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().min(1, 'Brand is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  // Legacy price fields — optional; prefer variant-level pricing
  defaultPurchasePrice: z.number().min(0).optional().default(0),
  defaultSellingPrice: z.number().min(0).optional().default(0),
  gst: z.number().min(0, 'GST must be positive').max(100, 'GST cannot exceed 100%'),
  unit: z.string().min(1, 'Base unit is required'),
  minimumStock: z.number().min(0, 'Minimum stock must be positive'),
  currentStock: z.number().default(0),
  maximumStock: z.number().min(0, 'Maximum stock must be positive'),
  status: z.enum(['active', 'inactive']).default('active'),
  image: z.string().optional(),
});

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

export interface InventoryItem extends InventoryItemFormData {
  id: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  price: number; // Legacy compatibility
  stock: number; // Legacy compatibility
}

// 2. Variants
export interface InventoryVariant {
  id: string;
  itemId: string;
  name: string;          // e.g., "50 KG Bag", "1 L"
  unit: string;          // Variant's own unit, e.g., "Bag"
  conversionQty: number; // How many base units 1 of this variant equals, e.g., 50
  baseUnit: string;      // Item's base unit, e.g., "KG"
  purchasePrice: number; // Price for 1 unit of this variant
  sellingPrice: number;  // Selling price for 1 unit of this variant
  currentStock: number;  // Stock expressed in variant units (derived from base stock)
  barcode: string;
  sku: string;
  status: 'active' | 'inactive';
  /** If false, this variant will NOT appear in the Purchases screen */
  purchaseAllowed: boolean;
  /** If false, this variant will NOT appear in the Sales screen */
  sellingAllowed: boolean;
  createdAt: Timestamp | Date;
}

// 3. Suppliers
export const supplierSchema = z.object({
  name: z.string().min(2, 'Supplier name is required'),
  mobile: z.string().min(10, 'Mobile must be at least 10 digits'),
  gst: z.string().optional(),
  address: z.string().optional(),
  pendingAmount: z.number().default(0),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;

export interface Supplier extends SupplierFormData {
  id: string;
  createdAt: Timestamp | Date;
}

// 4. Purchase Entry
export interface PurchaseEntryItem {
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  quantity: number;
  purchaseRate: number;
  gstPercent: number;
  gstAmount: number;
  discount: number;
  total: number;
}

export interface PurchaseEntry {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  date: Timestamp | Date;
  items: PurchaseEntryItem[];
  total: number;
  gstTotal: number;
  discount: number;
  transport: number;
  grandTotal: number;
  paymentMode: 'cash' | 'upi' | 'bank' | 'outstanding' | 'farmer_ledger';
  paymentStatus: 'paid' | 'partially_paid' | 'pending';
  paidAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// 5. Sales Entry
export interface SalesEntryItem {
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  quantity: number;
  sellingPrice: number;
  gstPercent: number;
  gstAmount: number;
  discount: number;
  total: number;
}

export interface SalesEntry {
  id: string;
  invoiceNumber: string;
  farmerId?: string; // If registered farmer
  customerName: string; // Farmer name or guest customer name
  date: Timestamp | Date;
  items: SalesEntryItem[];
  total: number;
  gstTotal: number;
  discount: number;
  grandTotal: number;
  paymentMode: 'cash' | 'upi' | 'bank' | 'farmer_ledger';
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// 6. Stock Adjustment
export interface StockAdjustment {
  id: string;
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  quantity: number; // positive for addition, negative for deduction
  reason: 'damage' | 'expired' | 'lost' | 'manual_correction' | 'opening_balance' | 'other';
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// 7. Supplier Payments
export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'bank';
  notes?: string;
  paymentDate: Timestamp | Date;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// 8. Audit Logs (inventory_logs)
export interface InventoryLog {
  id: string;
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  prevStock: number;
  newStock: number;
  quantity: number;
  actionType: 'purchase' | 'sale' | 'adjustment' | 'manual';
  referenceId: string; // Purchase ID, Sales ID, or Adjustment ID
  reason: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// 9. Inventory Settings
export interface InventorySettings {
  enableNegativeStock: boolean;
  autoGenerateSku: boolean;
  autoBarcode: boolean;
  gstEnabled: boolean;
  lowStockThreshold: number; // in items count
}

// Legacy Compatibility Models
export interface PurchaseItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  farmerId: string;
  farmerName: string;
  items: PurchaseItem[];
  total: number;
  createdAt: Timestamp | Date;
  createdBy: string;
}
