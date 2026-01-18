/**
 * Date Normalizer Service
 *
 * Converts natural language dates ("next Tuesday", "tomorrow at 2pm")
 * into ISO-formatted dates (YYYY-MM-DD) that backend expects.
 *
 * This prevents the "jittery AI" problem where voice models might send
 * unparseable date strings that break the booking flow.
 */

import * as chrono from 'chrono-node';
import { log } from './logger';

/**
 * Normalize appointment date input
 *
 * Handles:
 * - Already formatted dates: "2026-01-20" → pass through
 * - Natural language: "next Tuesday" → parse to ISO date
 * - Relative dates: "tomorrow" → calculate from today
 * - Various formats: "January 20" → "2026-01-20"
 *
 * @param dateInput - User-provided date (any format)
 * @param referenceDate - Date to calculate relative dates from (defaults to today)
 * @returns ISO date string (YYYY-MM-DD)
 * @throws Error if date cannot be parsed or is in the past
 */
export function normalizeDate(
  dateInput: string,
  referenceDate: Date = new Date()
): string {
  if (!dateInput) {
    throw new Error('Date input is required');
  }

  const trimmed = dateInput.trim();

  // Check if already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed + 'T00:00:00Z');
    validateDateNotPast(parsed);
    return trimmed;
  }

  // Try to parse natural language date
  try {
    const results = chrono.parse(trimmed, referenceDate, { forwardDate: true });

    if (results.length === 0) {
      throw new Error(`Could not parse date: "${trimmed}"`);
    }

    const parsedDate = results[0].start.date();
    validateDateNotPast(parsedDate);

    return formatDateToISO(parsedDate);
  } catch (error: any) {
    throw new Error(`Date parsing failed for "${trimmed}": ${error.message}`);
  }
}

/**
 * Normalize appointment time input
 *
 * Handles:
 * - Already formatted times: "14:30" → pass through
 * - Natural language: "2pm", "two-thirty", "14:30" → normalize to HH:MM
 * - Edge cases: "noon", "midnight"
 *
 * @param timeInput - User-provided time (any format)
 * @returns Normalized time string (HH:MM in 24-hour format)
 * @throws Error if time is invalid
 */
export function normalizeTime(timeInput: string): string {
  if (!timeInput) {
    throw new Error('Time input is required');
  }

  const trimmed = timeInput.trim().toLowerCase();

  // Check if already in HH:MM format
  if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
    return trimmed;
  }

  // Handle special cases
  if (trimmed === 'noon' || trimmed === '12pm') return '12:00';
  if (trimmed === 'midnight') return '00:00';

  // Parse time from natural language
  try {
    const timeResult = chrono.parse(`${trimmed}`, new Date(), {
      forwardDate: true
    });

    if (timeResult.length === 0) {
      throw new Error(`Could not parse time: "${trimmed}"`);
    }

    const timeDate = timeResult[0].start.date();
    return formatTimeToHHMM(timeDate);
  } catch (error: any) {
    throw new Error(`Time parsing failed for "${trimmed}": ${error.message}`);
  }
}

/**
 * Normalize combined date and time
 *
 * Handles full datetime expressions like:
 * - "next Tuesday at 2pm"
 * - "tomorrow at 14:30"
 * - "January 20th at 3:00 PM"
 *
 * @param dateTimeInput - User-provided datetime expression
 * @returns Object with normalized date and time
 */
export function normalizeDateTime(
  dateTimeInput: string
): { date: string; time: string } {
  if (!dateTimeInput) {
    throw new Error('DateTime input is required');
  }

  try {
    const results = chrono.parse(dateTimeInput, new Date(), {
      forwardDate: true
    });

    if (results.length === 0) {
      throw new Error(`Could not parse datetime: "${dateTimeInput}"`);
    }

    const parsedDate = results[0].start.date();
    validateDateNotPast(parsedDate);

    return {
      date: formatDateToISO(parsedDate),
      time: formatTimeToHHMM(parsedDate)
    };
  } catch (error: any) {
    throw new Error(
      `DateTime parsing failed for "${dateTimeInput}": ${error.message}`
    );
  }
}

/**
 * Validate that a date is not in the past
 * @throws Error if date is in the past
 */
function validateDateNotPast(date: Date): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    throw new Error(
      `Date ${date.toISOString().split('T')[0]} is in the past`
    );
  }
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to 24-hour time string (HH:MM)
 */
function formatTimeToHHMM(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Test/debug helper - parse various date formats
 */
export function testDateParsing(inputs: string[]): void {
  console.log('\n=== DATE NORMALIZATION TEST ===\n');

  inputs.forEach(input => {
    try {
      const normalized = normalizeDate(input);
      console.log(`✅ "${input}" → ${normalized}`);
    } catch (error: any) {
      console.log(`❌ "${input}" → ERROR: ${error.message}`);
    }
  });

  console.log('\n');
}

/**
 * Test/debug helper - parse various time formats
 */
export function testTimeParsing(inputs: string[]): void {
  console.log('\n=== TIME NORMALIZATION TEST ===\n');

  inputs.forEach(input => {
    try {
      const normalized = normalizeTime(input);
      console.log(`✅ "${input}" → ${normalized}`);
    } catch (error: any) {
      console.log(`❌ "${input}" → ERROR: ${error.message}`);
    }
  });

  console.log('\n');
}
