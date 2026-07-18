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
  version: z.string().min(1, "Version is required"),
  animal: z.enum(['cow', 'buffalo']),
  status: z.enum(['active', 'draft', 'archived', 'upcoming', 'expired']),
  description: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().nullable().optional(),
  totalEntries: z.number().optional(),
});

export type RateChartFormData = z.infer<typeof rateChartSchema>;

export interface RateChart extends Omit<RateChartFormData, 'effectiveFrom' | 'effectiveUntil'> {
  id: string;
  effectiveFrom: Timestamp | Date;
  effectiveUntil: Timestamp | Date | null;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// Rate Chart Entry
export interface RateChartEntry {
  id: string;
  rateChartId: string;
  fat: number;
  snf: number;
  rate: number;
  createdAt: Timestamp | Date;
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
export type TransactionType = 'milk_collection' | 'payment' | 'purchase' | 'advance' | 'adjustment' | 'deduction' | 'credit_adjustment' | 'debit_adjustment';

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
export * from './inventory';

// Printer Settings
export const printerSettingsSchema = z.object({
  printerType: z.enum(['58mm', '80mm', 'a4']),
  printerName: z.string().optional(),
  autoPrint: z.boolean().default(false),
  copies: z.number().min(1).max(5).default(1),
  printLogo: z.boolean().default(false),
  printQrCode: z.boolean().default(false),
  printBalance: z.boolean().default(true),
  footerMessage: z.string().optional(),
  fontSize: z.string().optional(),
  characterDensity: z.string().optional(),
  leftMargin: z.number().optional(),
  topMargin: z.number().optional(),
});

export type PrinterSettingsFormData = z.infer<typeof printerSettingsSchema>;

export interface PrinterSettings extends PrinterSettingsFormData {
  id: string;
  updatedAt: Timestamp | Date;
}
