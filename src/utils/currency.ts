/**
 * Currency Formatting Utilities
 *
 * Provides consistent currency formatting across the application.
 * All amounts stored in database as pence (integer), displayed as pounds (GBP).
 */

/**
 * Format pence (integer) to pounds (GBP currency string)
 *
 * @param pence - Amount in pence (e.g., 388 = £3.88)
 * @returns Formatted currency string (e.g., "£3.88")
 *
 * @example
 * formatPence(388)   // "£3.88"
 * formatPence(2500)  // "£25.00"
 * formatPence(99)    // "£0.99"
 * formatPence(0)     // "£0.00"
 */
export function formatPence(pence: number): string {
  const pounds = pence / 100;

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(pounds);
}

/**
 * Format pence to pounds without currency symbol
 *
 * @param pence - Amount in pence
 * @returns Formatted number string (e.g., "3.88")
 *
 * @example
 * formatPenceToNumber(388)   // "3.88"
 * formatPenceToNumber(2500)  // "25.00"
 */
export function formatPenceToNumber(pence: number): string {
  const pounds = pence / 100;
  return pounds.toFixed(2);
}

/**
 * Parse pounds string to pence integer
 *
 * @param poundsStr - Pounds as string (e.g., "3.88" or "£3.88")
 * @returns Pence as integer (e.g., 388)
 *
 * @example
 * parsePoundsToPence("3.88")   // 388
 * parsePoundsToPence("£25.00") // 2500
 * parsePoundsToPence("0.99")   // 99
 */
export function parsePoundsToPence(poundsStr: string): number {
  // Remove currency symbol and whitespace
  const cleaned = poundsStr.replace(/[£,\s]/g, '');
  const pounds = parseFloat(cleaned);

  if (isNaN(pounds)) {
    throw new Error(`Invalid currency string: ${poundsStr}`);
  }

  return Math.round(pounds * 100);
}
