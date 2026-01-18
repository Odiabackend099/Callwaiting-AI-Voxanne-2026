import { google, calendar_v3 } from 'googleapis';
import { supabase } from '../services/supabase-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { log } from '../services/logger';
import { safeCall, withTokenRefresh } from '../services/safe-call';

let oauth2Client: any = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  return oauth2Client;
}

/**
 * Get and refresh tokens if needed
 * Uses the unified org_credentials table and IntegrationDecryptor
 * @param orgId - Organization ID
 * @returns Object with access_token and calendar client
 */
export async function getCalendarClient(
  orgId: string
): Promise<{ accessToken: string; calendar: calendar_v3.Calendar }> {
  try {
    // Fetch stored Google Calendar credentials using IntegrationDecryptor
    const credentials = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);

    if (!credentials) {
      throw new Error(`No calendar connection found for org ${orgId}`);
    }

    let accessToken = credentials.accessToken;
    let refreshToken = credentials.refreshToken;
    let tokenExpiry = new Date(credentials.expiresAt);

    // Check if token is expired or expiring soon (within 5 minutes)
    const now = new Date();
    const expiringThreshold = new Date(now.getTime() + 5 * 60 * 1000);

    if (tokenExpiry < expiringThreshold) {
      log.info('GoogleCalendar', 'Token expired, refreshing...', { orgId });

      try {
        // Refresh the token
        const client = getOAuth2Client();
        client.setCredentials({
          refresh_token: refreshToken,
        });

        const { credentials: newCredentials } = await client.refreshAccessToken();

        if (!newCredentials.access_token) {
          throw new Error('Failed to get new access token');
        }

        accessToken = newCredentials.access_token;

        // Update token expiry
        if (newCredentials.expiry_date) {
          tokenExpiry = new Date(newCredentials.expiry_date);
        }

        // Update database with new encrypted token
        await IntegrationDecryptor.storeCredentials(orgId, 'google_calendar', {
          accessToken,
          refreshToken,
          expiresAt: tokenExpiry.toISOString()
        });

        log.info('GoogleCalendar', 'Token refreshed successfully', { orgId });
      } catch (refreshError) {
        log.error('GoogleCalendar', 'Error refreshing token', {
          orgId,
          error: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });
        throw new Error('Failed to refresh calendar access token');
      }
    }

    // Create and return calendar client with valid token
    const client = getOAuth2Client();
    client.setCredentials({
      access_token: accessToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });

    return {
      accessToken,
      calendar,
    };
  } catch (error) {
    log.error('GoogleCalendar', 'Failed to get calendar client', {
      orgId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Helper: Execute a calendar API call with 401 retry logic
 * If the API returns 401 (Unauthorized), this will force a token refresh
 * and retry the operation once.
 */
async function executeWithRetryOn401<T>(
  orgId: string,
  operation: (calendar: calendar_v3.Calendar) => Promise<T>,
  retryCount: number = 0
): Promise<T> {
  const maxRetries = 1;

  try {
    const { calendar } = await getCalendarClient(orgId);
    return await operation(calendar);
  } catch (error: any) {
    // Check if this is a 401 Unauthorized error
    const statusCode = error?.response?.status || error?.code;
    const isUnauthorized = statusCode === 401 ||
                          error?.message?.includes('401') ||
                          error?.message?.includes('Unauthorized');

    if (isUnauthorized && retryCount < maxRetries) {
      log.warn('GoogleCalendar', `Received 401, force-refreshing token and retrying`, {
        orgId,
        attempt: retryCount + 1
      });

      try {
        // Force refresh by invalidating and re-fetching credentials
        const credentials = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
        if (credentials?.refreshToken) {
          const client = getOAuth2Client();
          client.setCredentials({
            refresh_token: credentials.refreshToken,
          });

          const { credentials: newCredentials } = await client.refreshAccessToken();
          if (newCredentials.access_token) {
            await IntegrationDecryptor.storeCredentials(orgId, 'google_calendar', {
              accessToken: newCredentials.access_token,
              refreshToken: credentials.refreshToken,
              expiresAt: new Date(newCredentials.expiry_date || Date.now() + 3600000).toISOString()
            });

            log.info('GoogleCalendar', 'Forced token refresh succeeded, retrying operation', { orgId });

            // Retry the operation with fresh token
            return executeWithRetryOn401(orgId, operation, retryCount + 1);
          }
        }
      } catch (refreshError) {
        log.error('GoogleCalendar', 'Failed to recover from 401', {
          orgId,
          refreshError: refreshError instanceof Error ? refreshError.message : String(refreshError)
        });
        // Fall through to throw original error
      }
    }

    // Either not a 401, or retries exhausted
    throw error;
  }
}

/**
 * Check availability for a time slot
 * @param orgId - Organization ID
 * @param startTime - ISO 8601 start time
 * @param endTime - ISO 8601 end time
 * @returns Object with availability info
 */
export async function checkAvailability(
  orgId: string,
  startTime: string,
  endTime: string
): Promise<{
  available: boolean;
  message: string;
  suggestions?: string[];
}> {
  try {
    const result = await executeWithRetryOn401(orgId, async (calendar) => {
      // Query freebusy endpoint
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: 'primary' }],
        },
      });

      const busyTimes = response.data.calendars?.primary?.busy || [];

      if (busyTimes.length === 0) {
        return {
          available: true,
          message: `The requested time slot is available.`,
        };
      }

      return {
        available: false,
        message: `That time slot is already booked. Let me find an available time for you.`,
        suggestions: [], // Can be populated with alternative times
      };
    });

    return result;
  } catch (error) {
    console.error('Error checking availability:', error);
    throw new Error('Failed to check calendar availability');
  }
}

/**
 * Book an appointment on the calendar
 * @param orgId - Organization ID
 * @param event - Event details
 * @returns Created event ID
 */
export async function bookAppointment(
  orgId: string,
  event: {
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
    start: string; // ISO 8601
    end: string; // ISO 8601
    procedureType?: string;
    notes?: string;
  }
): Promise<{ eventId: string; htmlLink: string }> {
  try {
    const result = await executeWithRetryOn401(orgId, async (calendar) => {
      // Create calendar event
      const calendarEvent: calendar_v3.Schema$Event = {
        summary: `${event.procedureType || 'Appointment'} - ${event.patientName}`,
        description: `Patient: ${event.patientName}\nPhone: ${event.patientPhone || 'N/A'}\nNotes: ${event.notes || 'None'}`,
        start: {
          dateTime: event.start,
          timeZone: 'UTC',
        },
        end: {
          dateTime: event.end,
          timeZone: 'UTC',
        },
        attendees: [
          {
            email: event.patientEmail,
            responseStatus: 'needsAction',
          },
        ],
        reminders: {
          useDefault: true,
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: calendarEvent,
        sendUpdates: 'all', // Send calendar invite to patient
      });

      if (!response.data.id) {
        throw new Error('Failed to create calendar event');
      }

      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink || '',
      };
    });

    // Log the booking after successful creation
    await supabase.from('appointment_bookings').insert({
      org_id: orgId,
      patient_name: event.patientName,
      patient_email: event.patientEmail,
      patient_phone: event.patientPhone,
      appointment_start: event.start,
      appointment_end: event.end,
      procedure_type: event.procedureType,
      notes: event.notes,
      google_event_id: result.eventId,
    });

    return result;
  } catch (error) {
    console.error('Error booking appointment:', error);
    throw new Error('Failed to book appointment');
  }
}

/**
 * Get available time slots for a date range
 * @param orgId - Organization ID
 * @param dateStart - Start date (ISO 8601)
 * @param dateEnd - End date (ISO 8601)
 * @param slotDurationMinutes - Duration of each slot (default: 30)
 * @returns Array of available time slots
 */
export async function getAvailableSlots(
  orgId: string,
  dateStart: string,
  dateEnd: string,
  slotDurationMinutes: number = 30
): Promise<string[]> {
  try {
    const slots = await executeWithRetryOn401(orgId, async (calendar) => {
      // Get all events in the date range
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: dateStart,
        timeMax: dateEnd,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      // Find gaps between events
      const resultSlots: string[] = [];
      const startDate = new Date(dateStart);
      const endDate = new Date(dateEnd);

      // Define working hours (9 AM to 5 PM)
      const workingHourStart = 9;
      const workingHourEnd = 17;

      let currentSlotStart = new Date(startDate);
      currentSlotStart.setHours(workingHourStart, 0, 0, 0);

      while (currentSlotStart < endDate) {
        const currentSlotEnd = new Date(
          currentSlotStart.getTime() + slotDurationMinutes * 60 * 1000
        );

        // Check if slot is within working hours
        if (
          currentSlotStart.getHours() >= workingHourStart &&
          currentSlotEnd.getHours() <= workingHourEnd
        ) {
          // Check if slot is free
          const hasConflict = events.some((event) => {
            const eventStart = new Date(event.start?.dateTime || event.start?.date!);
            const eventEnd = new Date(event.end?.dateTime || event.end?.date!);

            return (
              (currentSlotStart >= eventStart && currentSlotStart < eventEnd) ||
              (currentSlotEnd > eventStart && currentSlotEnd <= eventEnd) ||
              (currentSlotStart <= eventStart && currentSlotEnd >= eventEnd)
            );
          });

          if (!hasConflict) {
            resultSlots.push(currentSlotStart.toISOString());
          }
        }

        // Move to next slot
        currentSlotStart = new Date(
          currentSlotStart.getTime() + slotDurationMinutes * 60 * 1000
        );

        // Reset to working hours start for next day
        if (currentSlotStart.getHours() >= workingHourEnd) {
          currentSlotStart.setDate(currentSlotStart.getDate() + 1);
          currentSlotStart.setHours(workingHourStart, 0, 0, 0);
        }
      }

      return resultSlots;
    });

    return slots;
  } catch (error) {
    console.error('Error getting available slots:', error);
    throw new Error('Failed to get available slots');
  }
}
