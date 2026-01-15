import { google, calendar_v3 } from 'googleapis';
import { supabase } from '../services/supabase-client';
import { decrypt, encrypt } from './encryption';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Get and refresh tokens if needed
 * @param orgId - Organization ID
 * @returns Object with access_token and calendar client
 */
export async function getCalendarClient(
  orgId: string
): Promise<{ accessToken: string; calendar: calendar_v3.Calendar }> {
  // Fetch calendar connection from database
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('access_token, refresh_token, token_expiry')
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    throw new Error(`No calendar connection found for org ${orgId}`);
  }

  let accessToken = decrypt(data.access_token);
  let refreshToken = decrypt(data.refresh_token);
  let tokenExpiry = new Date(data.token_expiry);

  // Check if token is expired or expiring soon (within 5 minutes)
  const now = new Date();
  const expiringThreshold = new Date(now.getTime() + 5 * 60 * 1000);

  if (tokenExpiry < expiringThreshold) {
    console.log(`Token expired for org ${orgId}, refreshing...`);

    try {
      // Refresh the token
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to get new access token');
      }

      accessToken = credentials.access_token;

      // Update token expiry
      if (credentials.expiry_date) {
        tokenExpiry = new Date(credentials.expiry_date);
      }

      // Update database with new encrypted token
      const encryptedAccessToken = encrypt(accessToken);
      await supabase
        .from('calendar_connections')
        .update({
          access_token: encryptedAccessToken,
          token_expiry: tokenExpiry,
          updated_at: new Date(),
        })
        .eq('org_id', orgId);

      console.log(`Token refreshed successfully for org ${orgId}`);
    } catch (refreshError) {
      console.error('Error refreshing token:', refreshError);
      throw new Error('Failed to refresh calendar access token');
    }
  }

  // Create and return calendar client with valid token
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  return {
    accessToken,
    calendar,
  };
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
    const { calendar } = await getCalendarClient(orgId);

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
    const { calendar } = await getCalendarClient(orgId);

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

    // Log the booking
    await supabase.from('appointment_bookings').insert({
      org_id: orgId,
      patient_name: event.patientName,
      patient_email: event.patientEmail,
      patient_phone: event.patientPhone,
      appointment_start: event.start,
      appointment_end: event.end,
      procedure_type: event.procedureType,
      notes: event.notes,
      google_event_id: response.data.id,
    });

    return {
      eventId: response.data.id,
      htmlLink: response.data.htmlLink || '',
    };
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
    const { calendar } = await getCalendarClient(orgId);

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
    const slots: string[] = [];
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
          slots.push(currentSlotStart.toISOString());
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

    return slots;
  } catch (error) {
    console.error('Error getting available slots:', error);
    throw new Error('Failed to get available slots');
  }
}
