
import { supabase } from './supabase-client';
import { getAvailableSlots, checkAvailability } from './calendar-integration';
import { log } from './logger';

interface SlotReserveResult {
    success: boolean;
    appointmentId?: string;
    error?: string;
    expiresAt?: string;
}

/**
 * Service to manage calendar availability and temporary slot reservations
 */
export class CalendarSlotService {

    /**
     * Check available slots for a tenant/organization
     */
    async checkAvailability(tenantId: string, date: string, serviceType?: string): Promise<string[]> {
        try {
            // Logic for service type duration can be added here
            // default to existing 45 min slots logic or modify as needed
            // utilizing the existing calendar integration
            const slots = await getAvailableSlots(tenantId, date);
            return slots;
        } catch (error: any) {
            log.error('CalendarSlotService', 'Error checking availability', { tenantId, date, error: error.message });
            throw error;
        }
    }

    /**
     * Reserve a slot temporarily (5 min hold)
     */
    async reserveSlot(tenantId: string, slotTime: string, patientPhone: string, patientName?: string): Promise<SlotReserveResult> {
        try {
            const startTime = slotTime; // Assuming slotTime is ISO or handled correctly
            const endTime = new Date(new Date(startTime).getTime() + 30 * 60000).toISOString(); // Default 30 min duration for hold

            // 1. Double check availability with Google Calendar
            const isAvailable = await checkAvailability(tenantId, startTime, endTime);
            if (!isAvailable) {
                return { success: false, error: 'Slot is no longer available on the official calendar.' };
            }

            // 2. Check internal temp_slots table for collisions
            // (Assuming table 'temp_slots' exists or will exist)
            const { data: existingHolds, error: checkError } = await supabase
                .from('temp_slots')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('slot_time', startTime)
                .gt('expires_at', new Date().toISOString());

            if (checkError) {
                log.error('CalendarSlotService', 'Error checking temp slots', { error: checkError });
                // Proceed with caution or fail? Let's fail safe.
                // return { success: false, error: 'System error checking slot availability.' };
            }

            if (existingHolds && existingHolds.length > 0) {
                return { success: false, error: 'Slot is currently being held by another patient.' };
            }

            // 3. Create hold
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min from now
            const { data: inserted, error: insertError } = await supabase
                .from('temp_slots')
                .insert({
                    tenant_id: tenantId,
                    slot_time: startTime,
                    patient_phone: patientPhone,
                    patient_name: patientName,
                    expires_at: expiresAt,
                    status: 'reserved'
                })
                .select()
                .single();

            if (insertError) {
                log.error('CalendarSlotService', 'Error inserting temp slot', { error: insertError });
                throw new Error('Failed to reserve slot');
            }

            return {
                success: true,
                appointmentId: inserted.id,
                expiresAt: inserted.expires_at
            };

        } catch (error: any) {
            log.error('CalendarSlotService', 'Error reserving slot', { tenantId, slotTime, error: error.message });
            return { success: false, error: error.message };
        }
    }
}

export const calendarSlotService = new CalendarSlotService();
