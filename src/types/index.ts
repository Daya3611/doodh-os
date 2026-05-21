import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export type AnimalType = 'cow' | 'buffalo';

// Farmer
export const farmerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  village: z.string().min(2, "Village name is required"),
  animalType: z.enum(['cow', 'buffalo']),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  active: z.boolean().default(true),
  balance: z.number().default(0), // New field for running balance
});

export type FarmerFormData = z.infer<typeof farmerSchema>;

export interface Farmer extends FarmerFormData {
  id: string;
  createdAt: Timestamp | Date;
}

// Rate Chart
export const rateChartSchema = z.object({
  animalType: z.enum(['cow', 'buffalo']),
  fat: z.number().min(1, "FAT must be greater than 0"),
  snf: z.number().min(1, "SNF must be greater than 0"),
  rate: z.number().min(0, "Rate must be positive"),
});

export type RateChartFormData = z.infer<typeof rateChartSchema>;

export interface RateChart extends RateChartFormData {
  id: string;
  effectiveFrom: Timestamp | Date;
}

// Collection
export const collectionSchema = z.object({
  farmerId: z.string().min(1, "Farmer is required"),
  farmerName: z.string().min(1, "Farmer name is required"),
  animalType: z.enum(['cow', 'buffalo']),
  shift: z.enum(['morning', 'evening']),
  liters: z.number().min(0.1, "Liters must be greater than 0"),
  fat: z.number().min(1, "FAT must be greater than 0"),
  snf: z.number().min(1, "SNF must be greater than 0"),
  clr: z.number().optional(),
  rate: z.number().min(0),
  totalAmount: z.number().min(0),
});

export type CollectionFormData = z.infer<typeof collectionSchema>;

export interface Collection extends CollectionFormData {
  id: string;
  createdBy: string;
  createdAt: Timestamp | Date;
}

// Ledger & Accounts
export type TransactionType = 'milk_collection' | 'payment' | 'purchase' | 'advance' | 'adjustment';

export interface LedgerEntry {
  id: string;
  farmerId: string;
  transactionType: TransactionType;
  description: string;
  credit: number;
  debit: number;
  balance: number;
  referenceId: string;
  createdAt: Timestamp | Date;
}

// Inventory & Purchases
export const inventorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.number().min(0, "Price must be positive"),
  stock: z.number().min(0, "Stock cannot be negative"),
  unit: z.string().min(1, "Unit is required"),
});

export type InventoryFormData = z.infer<typeof inventorySchema>;

export interface InventoryItem extends InventoryFormData {
  id: string;
  createdAt: Timestamp | Date;
}

export interface PurchaseItem {
  productId: string;
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
