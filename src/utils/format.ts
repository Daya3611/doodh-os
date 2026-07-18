/**
 * Safely formats a numeric value as a currency string with 2 decimal places.
 * Returns "0.00" if the value is undefined, null, NaN, or non-numeric.
 *
 * Use this instead of calling `.toFixed(2)` directly on potentially-undefined fields.
 *
 * @example
 * formatCurrency(123.456)       // "123.46"
 * formatCurrency(undefined)     // "0.00"
 * formatCurrency(null)          // "0.00"
 * formatCurrency(NaN)           // "0.00"
 */
export function formatCurrency(value: number | undefined | null): string {
  return Number(value ?? 0).toFixed(2);
}

/**
 * Safely formats a numeric value with N decimal places.
 * Returns "0.00" (or "0.0" etc.) if the value is undefined, null, or NaN.
 *
 * @example
 * formatNumber(3.14159, 1)    // "3.1"
 * formatNumber(undefined, 2)  // "0.00"
 */
export function formatNumber(
  value: number | undefined | null,
  decimals: number = 2
): string {
  return Number(value ?? 0).toFixed(decimals);
}

/**
 * Safely coerces a value that may come from Firestore/IndexedDB as a string,
 * number, or undefined into a proper number. Returns 0 as fallback.
 */
export function toSafeNumber(value: unknown): number {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}
