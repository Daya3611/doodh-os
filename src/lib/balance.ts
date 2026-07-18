import { db } from '@/firebase/config';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { LedgerEntry } from '@/types';

// Helper to convert Firebase Timestamp/Date/String to milliseconds
export function getTimestampMillis(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  if (val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export interface BalanceCalculationResult {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  runningBalances: number[];
  sortedTransactions: LedgerEntry[];
}

/**
 * Calculates correct chronological running balances for a set of transactions.
 * Sorts by date and createdAt ascending.
 */
export function calculateFarmerBalance(transactions: LedgerEntry[]): BalanceCalculationResult {
  // Sort transactions chronologically: older first, newer last
  const sorted = [...transactions].sort((a, b) => {
    const timeA = getTimestampMillis(a.createdAt);
    const timeB = getTimestampMillis(b.createdAt);
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || '').localeCompare(b.id || '');
  });

  let runningBalance = 0;
  let totalCredits = 0;
  let totalDebits = 0;
  const runningBalances: number[] = [];

  for (const tx of sorted) {
    const credit = tx.credit || 0;
    const debit = tx.debit || 0;

    totalCredits += credit;
    totalDebits += debit;

    // Credit (milk collection, positive adjustment) increases balance
    // Debit (payment, sale/purchase, negative adjustment) decreases balance
    runningBalance += credit - debit;
    runningBalances.push(runningBalance);
  }

  return {
    balance: runningBalance,
    totalCredits,
    totalDebits,
    runningBalances,
    sortedTransactions: sorted
  };
}

/**
 * Reads all ledger entries for a farmer, calculates their correct chronological running balances,
 * updates the balance field in each ledger document, and updates the farmer's cached balance.
 */
export async function recalculateAndSyncFarmerBalance(centerId: string, farmerId: string): Promise<number> {
  const ledgerCollectionRef = collection(db, 'centers', centerId, 'ledger');
  const q = query(ledgerCollectionRef, where('farmerId', '==', farmerId));
  const snap = await getDocs(q);
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));

  const result = calculateFarmerBalance(entries);

  const batch = writeBatch(db);

  // Update all ledger entries in Firestore with their correct running balance
  result.sortedTransactions.forEach((entry, index) => {
    const correctBalance = result.runningBalances[index];
    if (entry.balance !== correctBalance) {
      const entryRef = doc(db, 'centers', centerId, 'ledger', entry.id);
      batch.update(entryRef, { balance: correctBalance });
    }
  });

  // Update the farmer document with the final balance
  const farmerRef = doc(db, 'centers', centerId, 'farmers', farmerId);
  batch.update(farmerRef, { balance: result.balance });

  await batch.commit();

  return result.balance;
}
