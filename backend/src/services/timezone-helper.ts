/**
 * Timezone Helper Service
 * Utilities for handling timezone conversions for appointment reminders and messages
 *
 * Supports IANA timezone identifiers (e.g., 'America/New_York', 'Europe/London')
 */

/**
 * Format date to local time string for a given timezone
 * @param date - Date object to format
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @param locale - Optional locale for formatting (default: 'en-US')
 * @returns Formatted time string
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  locale: string = 'en-US'
): { date: string; time: string; dateTime: string } {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const partMap = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

    const dateStr = `${partMap.month} ${partMap.day}, ${partMap.year}`;
    const timeStr = `${partMap.hour}:${partMap.minute}`;
    const dateTimeStr = `${dateStr} at ${timeStr}`;

    return {
      date: dateStr,
      time: timeStr,
      dateTime: dateTimeStr
    };
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    console.warn(`Invalid timezone: ${timezone}, falling back to UTC`, error);
    const date_str = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const time_str = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      date: date_str,
      time: time_str,
      dateTime: `${date_str} at ${time_str} UTC`
    };
  }
}

/**
 * Get user's timezone from org settings, with fallback
 * @param orgTimezone - Timezone from org settings (may be null/undefined)
 * @returns IANA timezone identifier or default fallback
 */
export function getOrgTimezone(orgTimezone?: string | null): string {
  // List of common timezones
  const COMMON_TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Australia/Melbourne',
    'UTC'
  ];

  if (orgTimezone && COMMON_TIMEZONES.includes(orgTimezone)) {
    return orgTimezone;
  }

  // Fallback to UTC if timezone not provided or invalid
  return 'UTC';
}

/**
 * Create appointment reminder message with timezone-aware formatting
 * @param appointmentDate - Appointment scheduled date
 * @param serviceName - Service type/name
 * @param timezone - IANA timezone identifier
 * @returns Formatted reminder message
 */
export function createAppointmentReminderMessage(
  appointmentDate: Date,
  serviceName: string,
  timezone: string
): string {
  const { dateTime } = formatDateInTimezone(appointmentDate, timezone);
  return `Appointment reminder: You have an appointment on ${dateTime} for ${serviceName}.`;
}

/**
 * Create appointment email subject with timezone info
 * @param appointmentDate - Appointment scheduled date
 * @param timezone - IANA timezone identifier
 * @returns Subject line for email
 */
export function createAppointmentEmailSubject(
  appointmentDate: Date,
  timezone: string
): string {
  const { date, time } = formatDateInTimezone(appointmentDate, timezone);
  return `Appointment Reminder - ${date} at ${time} (${timezone.split('/')[1] || timezone})`;
}

/**
 * Validate if a string is a valid IANA timezone
 * @param timezone - Timezone string to validate
 * @returns true if valid IANA timezone, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Try to format a date with the timezone
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (e) {
    return false;
  }
}
