import { parse, isPast, format, addYears } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * CRITICAL: Normalizes all booking data from Vapi AI input
 * 
 * Handles:
 * - Date hallucinations (AI sends 2024 dates → corrected to 2026)
 * - Phone number formatting (converts to E.164: +1234567890)
 * - Name capitalization (Title Case)
 * - Email normalization (lowercase, trimmed)
 * - Timezone-aware parsing (Fixes 15:00 vs 16:00 shift)
 * 
 * This is the "safety net" for all users/organizations
 */

export interface NormalizedBookingData {
  email: string;
  name: string;
  phone: string; // E.164 format
  scheduledAt: string; // ISO 8601 string (UTC)
}

export function normalizeBookingData(input: any, timezone: string = 'UTC'): NormalizedBookingData {
  // ========== DATE NORMALIZATION ==========
  // AI might send "2024-11-21" or parse "November 21" incorrectly
  // We force this to be in 2026 (current year for this system)

  let parsedDate: Date;

  try {
    // Try parsing the input date
    const dateStr = input.appointmentDate || input.date || input.scheduledAt;
    const timeStr = input.appointmentTime || input.time || '09:00';

    const combinedStr = `${dateStr} ${timeStr}`;

    console.log('normalizeBookingData DEBUG:', { combinedStr, timezone });

    // TIMEZONE FIX: Parse the string AS IF it is in the org's timezone
    // fromZonedTime("2026-01-21 15:00", "Africa/Lagos") -> Returns UTC Date object (14:00Z)
    parsedDate = fromZonedTime(combinedStr, timezone);

    console.log('normalizeBookingData RESULT:', { parsedDate: parsedDate.toISOString() });

    // If parsing failed or resulted in Invalid Date, fallback
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date parse');
    }
  } catch (err) {
    console.warn(`Date parse failed for input: ${JSON.stringify(input)}`, err);
    // Fallback: use tomorrow at 9 AM (in org timezone)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    parsedDate = fromZonedTime(`${tomorrowStr} 09:00`, timezone);
  }

  // CRITICAL: If the parsed date is in the past, it's a hallucination
  // Bump it to the current year (2026) or next year if today already passed
  if (isPast(parsedDate)) {
    const currentYear = new Date().getFullYear(); // Should be 2026
    parsedDate.setFullYear(currentYear);

    // If still in the past after year correction, add 1 year
    if (isPast(parsedDate)) {
      parsedDate = addYears(parsedDate, 1);
    }
  }

  // ========== PHONE NORMALIZATION ==========
  // Convert to E.164 format: +1234567890
  let phone = (input.appointmentPhone || input.patientPhone || input.phone || '').toString();

  // Remove common formatting
  phone = phone.replace(/[\s\-\(\)]/g, '');

  // If it doesn't start with +, assume US and prepend +1
  if (!phone.startsWith('+')) {
    phone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;
  }

  // Ensure it's a valid E.164 (min 10 digits after +)
  if (!/^\+\d{10,15}$/.test(phone)) {
    console.warn(`Invalid phone format after normalization: ${phone}`);
    phone = '+1' + phone.replace(/\D/g, '').slice(-10); // Last resort: extract digits
  }

  // ========== NAME NORMALIZATION ==========
  let name = (input.appointmentName || input.patientName || input.name || 'Guest').toString();

  // Title case: "john smith" → "John Smith"
  name = name
    .trim()
    .replace(/\w\S*/g, (txt: string) =>
      txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );

  // ========== EMAIL NORMALIZATION ==========
  let email = (input.appointmentEmail || input.patientEmail || input.email || '').toString();
  email = email.toLowerCase().trim();

  // If no email, generate a placeholder to avoid NULL in DB
  if (!email || !email.includes('@')) {
    email = `${phone.replace(/\D/g, '')}@clinic.local`;
  }

  // ========== RETURN NORMALIZED DATA ==========
  return {
    email,
    name: name || 'Guest',
    phone,
    scheduledAt: parsedDate.toISOString() // Use native ISO string which is always UTC
  };
}

/**
 * Helper: Format a timestamp for natural speech
 * Used when Sarah needs to say appointment times aloud
 */
export function formatTimeForSpeech(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Helper: Convert array of ISO timestamps to friendly time suggestions
 * Used for alternative slot suggestions in the pivot response
 */
export function formatAlternativeSlots(isoSlots: string[]): string {
  if (!Array.isArray(isoSlots) || isoSlots.length === 0) {
    return 'later today';
  }

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const times = isoSlots.map((iso: string) => {
    try {
      return timeFormatter.format(new Date(iso));
    } catch {
      return 'unknown time';
    }
  });

  // Format like: "2:30 PM, 3:00 PM, or 3:30 PM"
  if (times.length === 1) return times[0];
  if (times.length === 2) return `${times[0]} or ${times[1]}`;

  return times.slice(0, -1).join(', ') + `, or ${times[times.length - 1]}`;
}
