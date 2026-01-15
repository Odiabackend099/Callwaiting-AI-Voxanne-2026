/**
 * Atomic Slot Locking System
 * 
 * Prevents double-booking through SELECT FOR UPDATE pessimistic locking.
 * Guarantees that exactly one concurrent request will successfully claim a slot.
 * Other concurrent requests receive 409 Conflict with next available options.
 */

import { createClient } from "@supabase/supabase-js";

interface SlotClaim {
  success: boolean;
  slot_id: string;
  claimed_at: string;
  status: number;
  message: string;
  next_available?: {
    slot_id: string;
    time: string;
    duration_minutes: number;
  }[];
}

interface AtomicLockOptions {
  hold_duration_minutes?: number;
  max_retries?: number;
  retry_delay_ms?: number;
}

/**
 * Claim an appointment slot atomically
 * 
 * Uses database-level SELECT FOR UPDATE to ensure:
 * - Only ONE concurrent request succeeds
 * - Others immediately get 409 Conflict
 * - No race conditions possible
 * 
 * @param supabase - Supabase client
 * @param slot_id - Unique slot identifier
 * @param contact_id - Contact/patient ID
 * @param clinic_id - Clinic/organization ID
 * @param options - Configuration options
 * @returns SlotClaim result with status code
 */
export async function claimSlotAtomic(
  supabase: ReturnType<typeof createClient>,
  slot_id: string,
  contact_id: string,
  clinic_id: string,
  options: AtomicLockOptions = {}
): Promise<SlotClaim> {
  const {
    hold_duration_minutes = 15,
    max_retries = 3,
    retry_delay_ms = 100,
  } = options;

  let lastError: Error | null = null;

  // Retry logic for transient failures
  for (let attempt = 0; attempt < max_retries; attempt++) {
    try {
      // Call Supabase RPC with SELECT FOR UPDATE
      const { data, error } = await supabase.rpc(
        "claim_slot_atomic",
        {
          p_slot_id: slot_id,
          p_contact_id: contact_id,
          p_clinic_id: clinic_id,
          p_hold_duration_minutes: hold_duration_minutes,
        },
        {
          // Force use of specific schema
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (error) {
        lastError = error;

        // Check if this is a conflict (someone else claimed it)
        if (
          error.message.includes("409") ||
          error.message.includes("Conflict") ||
          error.code === "409"
        ) {
          // Get next available slots for pivot response
          const nextAvailable = await getNextAvailableSlots(
            supabase,
            clinic_id,
            5
          );

          return {
            success: false,
            slot_id,
            claimed_at: new Date().toISOString(),
            status: 409,
            message:
              "Slot was just claimed by another patient. Here are your next available options.",
            next_available: nextAvailable,
          };
        }

        // For other errors, retry with exponential backoff
        if (attempt < max_retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retry_delay_ms * Math.pow(2, attempt))
          );
          continue;
        }

        throw error;
      }

      // Success: slot claimed
      if (data) {
        return {
          success: true,
          slot_id: data.slot_id || slot_id,
          claimed_at: data.claimed_at || new Date().toISOString(),
          status: 200,
          message: `Slot claimed successfully. Hold expires in ${hold_duration_minutes} minutes.`,
        };
      }

      throw new Error("No data returned from claim_slot_atomic RPC");
    } catch (err) {
      lastError = err as Error;

      if (attempt === max_retries - 1) {
        break;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, retry_delay_ms * Math.pow(2, attempt))
      );
    }
  }

  // All retries exhausted
  return {
    success: false,
    slot_id,
    claimed_at: new Date().toISOString(),
    status: 503,
    message: `Failed to claim slot after ${max_retries} attempts: ${lastError?.message || "Unknown error"}`,
  };
}

/**
 * Get next available appointment slots for pivot response
 * 
 * Returns alternative slots when primary slot is unavailable
 * Helps Vapi agent provide immediate alternatives
 * 
 * @param supabase - Supabase client
 * @param clinic_id - Clinic/organization ID
 * @param limit - Maximum number of slots to return
 * @returns Array of available slots
 */
async function getNextAvailableSlots(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  limit: number = 5
) {
  try {
    const { data, error } = await supabase
      .from("availability_slots")
      .select(
        "slot_id, start_time, duration_minutes, provider_id, service_type"
      )
      .eq("clinic_id", clinic_id)
      .eq("is_available", true)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching next available slots:", error);
      return [];
    }

    return (
      data?.map((slot) => ({
        slot_id: slot.slot_id,
        time: new Date(slot.start_time).toLocaleString("en-US", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        duration_minutes: slot.duration_minutes,
      })) || []
    );
  } catch (err) {
    console.error("Failed to fetch next available slots:", err);
    return [];
  }
}

/**
 * Release a claimed slot (e.g., after booking confirmed or timeout)
 * 
 * @param supabase - Supabase client
 * @param slot_id - Slot identifier
 * @param clinic_id - Clinic ID
 * @returns Success status
 */
export async function releaseSlot(
  supabase: ReturnType<typeof createClient>,
  slot_id: string,
  clinic_id: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.rpc("release_slot_lock", {
      p_slot_id: slot_id,
      p_clinic_id: clinic_id,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Slot lock released successfully" };
  } catch (err) {
    return { success: false, message: `Failed to release slot: ${err}` };
  }
}

/**
 * Check if a slot is currently held
 * 
 * @param supabase - Supabase client
 * @param slot_id - Slot identifier
 * @returns Hold status and holder info
 */
export async function getSlotHoldStatus(
  supabase: ReturnType<typeof createClient>,
  slot_id: string
): Promise<{
  is_held: boolean;
  held_by?: string;
  held_until?: string;
  can_claim: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("appointment_holds")
      .select("contact_id, expires_at")
      .eq("slot_id", slot_id)
      .eq("status", "active")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw error;
    }

    if (!data) {
      return { is_held: false, can_claim: true };
    }

    const expiresAt = new Date(data.expires_at);
    const isExpired = expiresAt < new Date();

    return {
      is_held: !isExpired,
      held_by: data.contact_id,
      held_until: data.expires_at,
      can_claim: isExpired,
    };
  } catch (err) {
    console.error("Error checking slot hold status:", err);
    return { is_held: false, can_claim: true };
  }
}

/**
 * Batch release slots (cleanup after timeout)
 * Called by Supabase Edge Function scheduled job
 * 
 * @param supabase - Supabase client
 * @returns Number of slots released
 */
export async function releaseExpiredSlots(
  supabase: ReturnType<typeof createClient>
): Promise<{ released_count: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("release_expired_slot_holds", {
      p_now: new Date().toISOString(),
    });

    if (error) {
      return { released_count: 0, error: error.message };
    }

    return {
      released_count: data?.released_count || 0,
    };
  } catch (err) {
    return {
      released_count: 0,
      error: `Failed to release expired slots: ${err}`,
    };
  }
}
