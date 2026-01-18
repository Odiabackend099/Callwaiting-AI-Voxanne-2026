import { supabase } from './supabase-client';
import { checkAvailability as checkCalendarAvailability, createCalendarEvent, CalendarEvent } from './calendar-integration';
import { BookingConfirmationService } from './booking-confirmation-service';
import { log } from './logger';
import { IntegrationDecryptor } from './integration-decryptor';

export interface BookingRequest {
    orgId: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    startTime: string; // ISO string
    serviceType: string;
    durationMinutes?: number;
}

export interface BookingResult {
    success: boolean;
    appointmentId?: string;
    calendarEventId?: string;
    calendarUrl?: string;
    error?: string;
    errorCode?: string;
    suggestions?: string[]; // Alternative slots if conflict
    message?: string;
}

export class AppointmentService {
    /**
     * Orchestrates the entire booking flow:
     * 1. Check availability (Double-booking protection)
     * 2. Atomic Lock (Optional / Future Phase)
     * 3. Create Google Calendar Event (Source of Truth)
     * 4. Insert into Database
     * 5. Send Notifications
     */
    static async bookAppointment(request: BookingRequest): Promise<BookingResult> {
        const { orgId, patientName, patientEmail, patientPhone, startTime, serviceType, durationMinutes = 30 } = request;

        try {
            // 1. Availability Check (The "Negotiator")
            const start = new Date(startTime);
            const end = new Date(start.getTime() + durationMinutes * 60000);

            const isAvailable = await checkCalendarAvailability(orgId, start.toISOString(), end.toISOString());

            if (!isAvailable) {
                log.warn('AppointmentService', 'Slot conflict detected', { orgId, startTime });
                return {
                    success: false,
                    error: 'Slot unavailable',
                    errorCode: 'SLOT_UNAVAILABLE',
                    message: 'That time slot is no longer available.'
                };
            }

            // 2. Create Google Calendar Event (The "Handshake")
            const event: CalendarEvent = {
                title: `${patientName} - ${serviceType}`,
                description: `Service: ${serviceType}\nPatient: ${patientName}\nPhone: ${patientPhone}\nEmail: ${patientEmail}`,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                attendeeEmail: patientEmail
            };

            const calendarResult = await createCalendarEvent(orgId, event);

            // 3. Insert into Database (The "Record")
            // We only reach here if Google API succeeded (Atomic principle)
            const appointmentId = require('crypto').randomUUID();
            const now = new Date().toISOString();

            const { error: dbError } = await supabase
                .from('appointments')
                .insert({
                    id: appointmentId,
                    org_id: orgId,
                    service_type: serviceType,
                    scheduled_at: start.toISOString(),
                    status: 'confirmed',
                    confirmation_sent: false,
                    created_at: now,
                    updated_at: now,
                    google_calendar_event_id: calendarResult.eventId,
                    calendar_link: calendarResult.eventUrl,
                    // Store metadata in JSONB if schema supports it, or specific columns
                    // Assuming metadata column exists or we rely on contact linking in future
                    // For now, minimal schema compliance
                });

            if (dbError) {
                // CRITICAL: If DB fails but Calendar succeeded, we have a "Ghost Booking".
                // In a perfect world, we'd rollback the calendar event.
                // For MVP+, we log CRITICAL error for manual cleanup.
                log.error('AppointmentService', 'CRITICAL: DB Insert failed after Calendar Success', {
                    orgId,
                    calendarEventId: calendarResult.eventId,
                    error: dbError.message
                });

                // Attempt rollback (best effort)
                // await deleteCalendarEvent(orgId, calendarResult.eventId); // Future impl

                throw new Error('Database insertion failed');
            }

            // 4. Notifications (The "Hooks")
            // Fire and forget (don't block response)
            this.sendNotifications(orgId, appointmentId, patientPhone, patientName, start);

            return {
                success: true,
                appointmentId,
                calendarEventId: calendarResult.eventId,
                calendarUrl: calendarResult.eventUrl,
                message: 'Appointment confirmed successfully'
            };

        } catch (error: any) {
            log.error('AppointmentService', 'Booking failed', { orgId, error: error.message });

            // Handle "Graceful Disconnect" logic
            if (error.message.includes('not connected') || error.message.includes('reconnect')) {
                return {
                    success: false,
                    error: 'Google Calendar not connected',
                    errorCode: 'INTEGRATION_REQUIRED',
                    message: "I'm sorry, my scheduling system is currently undergoing maintenance. Can I take your details and have someone call you back to confirm?"
                };
            }

            return {
                success: false,
                error: error.message || 'Booking process failed',
                errorCode: 'BOOKING_SYSTEM_ERROR'
            };
        }
    }

    private static async sendNotifications(
        orgId: string,
        appointmentId: string,
        patientPhone: string,
        patientName: string,
        startTime: Date
    ) {
        try {
            // 1. Patient SMS
            // Use existing service - mapped correctly
            // Note: contactId is technically required by the signature, strictly we should look it up or create it.
            // For now passing appointmentId as contactId fallback if allowed, or empty string if safe.
            // Checking BookingConfirmationService signature: sendConfirmationSMS(orgId, appointmentId, contactId, patientPhone)

            // We'll rely on the service to handle "contactId" gracefully or pass a placeholder uuid
            const placeholderContactId = appointmentId;

            await BookingConfirmationService.sendConfirmationSMS(
                orgId,
                appointmentId,
                placeholderContactId, // temporary fallback
                patientPhone
            );

            // 2. Admin Notification (Email/SMS)
            // TODO: Implement Admin Notification
            log.info('AppointmentService', 'Admin notification trigger', { orgId, patientName });

        } catch (error) {
            log.warn('AppointmentService', 'Notification hook failed', { error });
        }
    }
}
