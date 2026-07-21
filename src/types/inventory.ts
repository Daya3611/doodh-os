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
export const inventoryItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().min(1, 'Brand is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  gst: z.number().min(0, 'GST must be positive').max(100, 'GST cannot exceed 100%'),
  baseUnit: z.string().min(1, 'Base unit is required'),
  minimumStock: z.number().min(0, 'Minimum stock must be positive'),
  stockInBaseUnit: z.number().default(0),
  maximumStock: z.number().min(0, 'Maximum stock must be positive'),
  status: z.enum(['active', 'inactive']).default('active'),
  image: z.string().optional(),
});

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

export interface InventoryItem extends InventoryItemFormData {
  id: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// 2. Variants
/**
 * InventoryVariant — Packaging Definition Only
 *
 * ⚠️  INVARIANT: This type MUST NEVER contain any stock field.
 *
 * Forbidden fields:
 *   stock, currentStock, availableStock, quantity, remaining
 *
 * Available stock is ALWAYS derived at runtime:
 *   availablePackages = Math.floor(item.stockInBaseUnit / variant.packageSize)
 *
 * Allowed fields: packageSize, purchasePrice, sellingPrice, barcode, sku, name,
 *                 itemId, isDefault, isActive, createdAt
 *
 * Rationale: Stock belongs exclusively to InventoryItem.stockInBaseUnit (base unit).
 *            Variants are purely packaging multipliers. Storing stock per-variant
 *            causes double-counting, sync errors, and breaks the conversion formula.
 */

export interface InventoryVariant {
  id: string;
  itemId: string;
  name: string;          // e.g., "Bag", "Box", "Carton", "Loose"
  packageSize: number;   // Conversion multiplier, e.g. 50 (50 KG per Bag)
  purchasePrice: number;   // Price per variant pack, e.g., 1500
  sellingPrice: number;    // Selling price per variant pack, e.g., 2000
  barcode: string;
  sku: string;
  isDefault: boolean;
  isActive: boolean;
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
  quantity: number; // Purchase quantity in package units (e.g. 20 Bags)
  packageSizeSnapshot: number; // packageSize at transaction time (e.g. 50)
  purchaseRate: number; // Purchase price per variant package (e.g. 1500)
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
  quantity: number; // Sales quantity in package units
  packageSizeSnapshot: number; // packageSize at transaction time
  sellingPrice: number; // Selling price per variant package
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
  quantity: number; // positive for addition, negative for deduction (in packages)
  packageSizeSnapshot: number;
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
