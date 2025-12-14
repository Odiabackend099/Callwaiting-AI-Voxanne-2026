/**
 * Sanitize user input to prevent template injection attacks
 * Removes dangerous characters that could execute code in templates
 */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return '';

  return name
    .replace(/[<>{}$]/g, '')  // Remove template/HTML chars
    .replace(/\$\{.*?\}/g, '')  // Remove ${} expressions
    .replace(/`/g, '')  // Remove backticks
    .replace(/\\/g, '')  // Remove backslashes
    .substring(0, 100)  // Limit length
    .trim();
}

/**
 * Mask phone number for logging (shows last 4 digits only)
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  if (phone.length <= 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Sanitize all fields in an object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeName(value) as any;
    } else {
      sanitized[key as keyof T] = value;
    }
  }
  return sanitized;
}
