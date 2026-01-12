/**
 * OTP (One-Time Password) Utilities
 * Generates and validates 4/6 digit codes for appointment verification
 */

/**
 * Generate a random OTP code
 * @param length - Number of digits (default 4)
 * @returns Random numeric string of specified length
 */
export function generateOTP(length: number = 4): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  return code.toString().padStart(length, '0');
}

/**
 * Validate OTP format
 * @param otp - The OTP code to validate
 * @param expectedLength - Expected length (default 4)
 * @returns true if valid numeric format
 */
export function validateOTPFormat(otp: string, expectedLength: number = 4): boolean {
  const cleaned = otp.replace(/\D/g, '');
  return cleaned.length === expectedLength;
}

/**
 * Clean OTP input (remove spaces, special chars, extract digits)
 * @param input - Raw user input
 * @returns Cleaned numeric string
 */
export function cleanOTPInput(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Compare two OTP codes
 * @param provided - User-provided code
 * @param stored - Stored/expected code
 * @returns true if codes match
 */
export function compareOTP(provided: string, stored: string): boolean {
  const cleanProvided = provided.replace(/\D/g, '');
  const cleanStored = stored.replace(/\D/g, '');
  
  // Prevent timing attacks with constant-time comparison
  if (cleanProvided.length !== cleanStored.length) {
    return false;
  }
  
  let mismatch = 0;
  for (let i = 0; i < cleanProvided.length; i++) {
    mismatch += (cleanProvided[i] === cleanStored[i] ? 0 : 1);
  }
  
  return mismatch === 0;
}

export default {
  generateOTP,
  validateOTPFormat,
  cleanOTPInput,
  compareOTP
};
