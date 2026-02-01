/**
 * Google Calendar Integration Service
 * Handles Google Calendar availability checks and event creation
 * Supports OAuth flow for clinic managers to connect their calendars
 *
 * Uses googleapis library with OAuth2 authentication
 *
 * 2026 Update: Circuit breaker pattern via safeCall for resilience
 */

import { log } from './logger';
import { getCalendarClient } from './google-oauth-service';
import { safeCall } from './safe-call';

// Google Calendar API response types
interface FreeBusyResponse {
  data: {
    calendars?: {
      primary?: {
        busy?: Array<{ start?: string; end?: string }>;
      };
    };
  };
}

interface CalendarEventResponse {
  data: {
    id?: string;
    htmlLink?: string;
    hangoutLink?: string;
  };
}

export interface CalendarEvent {
  title: string;
  description: string;
  startTime: string; // ISO format
  endTime: string; // ISO format
  attendeeEmail: string;
  googleMeetUrl?: string;
}

/**
 * Get available appointment slots for a given date
 * Uses Google Calendar freebusy API to check availability
 * 
 * @param orgId - Organization ID
 * @param date - Date in YYYY-MM-DD format
 * @param timeZone - Timezone (default: 'America/New_York')
 * @returns Array of available time slots (e.g., ['09:00', '10:00', ...])
 * @throws Error if calendar not configured or date invalid
 */
export async function getAvailableSlots(
  orgId: string,
  date: string,
  timeZone: string = 'America/New_York'
): Promise<string[]> {
  try {
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if date is in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      throw new Error('Cannot check availability for past dates');
    }

    // Get authenticated calendar client
    const calendar = await getCalendarClient(orgId);

    // Use freebusy.query to get busy times for the day
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    // Use safeCall for circuit breaker protection
    // CRITICAL: Reduced timeout to fit Vapi's 15-30s webhook window
    // Old: retries: 2, timeoutMs: 10000 = 32-33 seconds total (exceeds Vapi limit)
    // New: retries: 1, timeoutMs: 5000 = ~6 seconds total (fits Vapi window)
    const result = await safeCall(
      'google_calendar_freebusy',
      () => calendar.freebusy.query({
        requestBody: {
          timeMin: new Date(`${startOfDay}`).toISOString(),
          timeMax: new Date(`${endOfDay}`).toISOString(),
          items: [{ id: 'primary' }],
          timeZone
        }
      }),
      { retries: 1, backoffMs: 500, timeoutMs: 5000 }
    );

    if (!result.success) {
      log.error('CalendarIntegration', 'Circuit breaker: freebusy query failed', {
        orgId,
        date,
        circuitOpen: result.circuitOpen,
        error: result.error?.message || result.userMessage
      });
      throw new Error(result.userMessage || 'Google Calendar service temporarily unavailable');
    }

    // Extract busy periods
    const response = result.data as FreeBusyResponse;
    const busyPeriods = response?.data?.calendars?.primary?.busy || [];
    const busyTimes = new Set<string>();

    for (const period of busyPeriods) {
      if (period.start && period.end) {
        const start = new Date(period.start);
        const end = new Date(period.end);

      // Mark 15-minute blocks as busy
      let current = new Date(start);
      while (current < end) {
        const hour = String(current.getHours()).padStart(2, '0');
        const minute = String(current.getMinutes()).padStart(2, '0');
        busyTimes.add(`${hour}:${minute}`);
        current.setMinutes(current.getMinutes() + 15);
        }
      }
    }

    // Generate available slots: 9 AM - 6 PM, 45-minute intervals
    const availableSlots: string[] = [];

    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 45) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

        // Check if slot is free (all 45 minutes)
        let isFree = true;
        const slotStart = new Date(`${date}T${timeStr}:00`);
        const slotEnd = new Date(slotStart.getTime() + 45 * 60 * 1000);

        let check = new Date(slotStart);
        while (check < slotEnd && isFree) {
          const checkHour = String(check.getHours()).padStart(2, '0');
          const checkMin = String(check.getMinutes()).padStart(2, '0');
          if (busyTimes.has(`${checkHour}:${checkMin}`)) {
            isFree = false;
          }
          check.setMinutes(check.getMinutes() + 15);
        }

        if (isFree) {
          availableSlots.push(timeStr);
        }
      }
    }

    log.info('CalendarIntegration', 'Available slots fetched', {
      orgId,
      date,
      timeZone,
      totalSlots: availableSlots.length,
      busyPeriods: busyPeriods.length
    });

    return availableSlots;
  } catch (error: any) {
    log.error('CalendarIntegration', 'Failed to get available slots', {
      orgId,
      date,
      timeZone,
      error: error?.message
    });
    throw error;
  }
}

/**
 * Create a calendar event
 * 
 * @param orgId - Organization ID
 * @param event - Event details
 * @returns Event creation response with event ID and shareable URL
 * @throws Error if calendar not configured or creation fails
 */
export async function createCalendarEvent(
  orgId: string,
  event: CalendarEvent
): Promise<{ eventId: string; eventUrl: string }> {
  try {
    log.info('CalendarIntegration', '[START] createCalendarEvent', { orgId, title: event.title });
    
    // Get authenticated calendar client
    log.info('CalendarIntegration', '[STEP 1] Fetching calendar client', { orgId });
    const calendar = await getCalendarClient(orgId);
    log.info('CalendarIntegration', '[STEP 2] Calendar client ready', { orgId });

    // Parse dates
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);

    log.info('CalendarIntegration', '[STEP 3] Parsed dates, preparing Google API call', {
      orgId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      attendee: event.attendeeEmail
    });

    // Create event using googleapis with circuit breaker protection
    log.info('CalendarIntegration', '[STEP 4] Calling calendar.events.insert with circuit breaker', { orgId });

    const insertResult = await safeCall(
      'google_calendar_insert',
      () => calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
          },
          attendees: [
            {
              email: event.attendeeEmail,
              responseStatus: 'needsAction'
            }
          ],
          conferenceData: event.googleMeetUrl
            ? {
                entryPoints: [
                  {
                    entryPointType: 'video',
                    uri: event.googleMeetUrl
                  }
                ]
              }
            : undefined,
          sendUpdates: 'all' // Send email notifications to attendees
        }
      }),
      { retries: 2, backoffMs: 1000, timeoutMs: 10000 }
    );

    if (!insertResult.success) {
      log.error('CalendarIntegration', '[CIRCUIT BREAKER] Calendar event creation failed', {
        orgId,
        circuitOpen: insertResult.circuitOpen,
        error: insertResult.error?.message || insertResult.userMessage
      });
      throw new Error(insertResult.userMessage || 'Google Calendar service temporarily unavailable');
    }

    const result = insertResult.data as CalendarEventResponse;

    log.info('CalendarIntegration', '[STEP 5] ✅ Calendar event created successfully', {
      orgId,
      eventId: result?.data?.id,
      title: event.title,
      attendee: event.attendeeEmail,
      htmlLink: result?.data?.htmlLink
    });

    const returnValue = {
      eventId: result?.data?.id || '',
      eventUrl: result?.data?.htmlLink || ''
    };
    
    log.info('CalendarIntegration', '[END] createCalendarEvent SUCCESS', {
      orgId,
      eventId: returnValue.eventId
    });

    return returnValue;
  } catch (error: any) {
    log.error('CalendarIntegration', '[CRITICAL ERROR] createCalendarEvent FAILED', {
      orgId,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStatus: error?.status,
      stack: error?.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Check if a specific time slot is available
 * 
 * @param orgId - Organization ID
 * @param startTime - Start time (ISO 8601 format)
 * @param endTime - End time (ISO 8601 format)
 * @param timeZone - Timezone (default: 'America/New_York')
 * @returns boolean - true if available, false if busy
 */
export async function checkAvailability(
  orgId: string,
  startTime: string,
  endTime: string,
  timeZone: string = 'America/New_York'
): Promise<boolean> {
  try {
    // Get authenticated calendar client
    const calendar = await getCalendarClient(orgId);

    // Use safeCall for circuit breaker protection
    const result = await safeCall(
      'google_calendar_freebusy',
      () => calendar.freebusy.query({
        requestBody: {
          timeMin: new Date(startTime).toISOString(),
          timeMax: new Date(endTime).toISOString(),
          items: [{ id: 'primary' }],
          timeZone
        }
      }),
      { retries: 2, backoffMs: 1000, timeoutMs: 10000 }
    );

    if (!result.success) {
      log.error('CalendarIntegration', 'Circuit breaker: availability check failed', {
        orgId,
        startTime,
        endTime,
        circuitOpen: result.circuitOpen,
        error: result.error?.message || result.userMessage
      });
      throw new Error(result.userMessage || 'Google Calendar service temporarily unavailable');
    }

    // Check if there are any busy periods
    const response = result.data as FreeBusyResponse;
    const busyPeriods = response?.data?.calendars?.primary?.busy || [];
    const isAvailable = busyPeriods.length === 0;

    log.info('CalendarIntegration', 'Availability checked', {
      orgId,
      startTime,
      endTime,
      timeZone,
      isAvailable,
      busyPeriods: busyPeriods.length
    });

    return isAvailable;
  } catch (error: any) {
    log.error('CalendarIntegration', 'Failed to check availability', {
      orgId,
      startTime,
      endTime,
      error: error?.message
    });
    throw error;
  }
}
