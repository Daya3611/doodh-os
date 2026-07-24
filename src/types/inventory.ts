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
  baseUnit: z.string().min(1, 'Base unit is required'), // Stock Unit
  stockUnit: z.string().default('KG'), // 3-Tier ERP Stock Unit
  defaultPurchaseUnit: z.string().default('50 KG Bag'), // Default Purchase Unit (e.g. 50 KG Bag)
  purchaseUnit: z.string().optional(), // Alias for defaultPurchaseUnit
  purchaseMultiplier: z.number().default(1), // Purchase Multiplier (e.g. 50)
  purchasePrice: z.number().default(0), // Single Purchase Price per Purchase Unit
  averageCostPerBaseUnit: z.number().default(0), // Auto-calculated cost per Stock Unit (purchasePrice / purchaseMultiplier)
  minimumStock: z.number().min(0, 'Minimum stock must be positive'),
  stockInBaseUnit: z.number().default(0),
  maximumStock: z.number().min(0, 'Maximum stock must be positive'),
  status: z.enum(['active', 'inactive']).default('active'),
  image: z.string().optional(),
});

export type InventoryItemFormData = z.infer<typeof inventoryItemSchema>;

export interface InventoryItem extends InventoryItemFormData {
  id: string;
  stockUnit: string;
  defaultPurchaseUnit: string;
  purchaseMultiplier: number;
  purchasePrice: number;
  averageCostPerBaseUnit: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// 2. Variants
/**
 * InventoryVariant — Packaging Definition & Auto Pricing Only
 *
 * ⚠️  INVARIANT: This type MUST NEVER contain any stock field.
 *
 * Purchase prices are ALWAYS auto-calculated from item purchasePrice / purchaseMultiplier:
 *   variantPurchaseCost = variant.multiplier * (item.purchasePrice / item.purchaseMultiplier)
 *
 * Selling prices are either:
 *   - Manual: User enters sellingPrice directly
 *   - Auto: sellingPrice = variantPurchaseCost * (1 + profitMargin / 100)
 */

export interface InventoryVariant {
  id: string;
  itemId: string;
  name: string;          // e.g., "50 KG Bag", "25 KG Bag", "1 KG", "500 Gram"
  multiplier: number;    // Conversion multiplier in Stock Units (e.g. 50, 25, 1, 0.5)
  packageSize?: number;  // Legacy alias for multiplier
  purchasePrice: number;   // Auto-calculated read-only purchase cost per variant
  pricingMode: 'manual' | 'auto'; // Manual selling price or Auto profit margin
  profitMargin: number;    // Profit margin percentage (e.g. 20 for 20%)
  sellingPrice: number;    // Selling price per variant pack
  barcode: string;
  sku: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Timestamp | Date;
}

export interface VariantDraftRow {
  id?: string;
  name: string;
  multiplier: number; // Conversion multiplier in Stock Units (e.g., 50, 25, 0.5)
  packageSize?: number; // Legacy compatibility
  purchasePrice: number; // Auto-calculated read-only
  pricingMode: 'manual' | 'auto';
  profitMargin: number; // Percentage, e.g. 20
  sellingPrice: number;
  barcode: string;
  sku: string;
  isDefault: boolean;
  isActive: boolean;
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
