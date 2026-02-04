
import { Router } from 'express';
import { supabase, supabaseService } from '../services/supabase-client';
import { calendarSlotService } from '../services/calendar-slot-service';
import { smsComplianceService } from '../services/sms-compliance-service';
import { log } from '../services/logger';
import { AtomicBookingService } from '../services/atomic-booking-service';
import { BookingConfirmationService } from '../services/booking-confirmation-service';
import { createCalendarEvent } from '../services/calendar-integration';
import { normalizeDate, normalizeTime } from '../services/date-normalizer';
import { bookingDeduplicator } from '../services/booking-deduplicator';
import { normalizeBookingData, formatAlternativeSlots } from '../utils/normalizeBookingData';
import { getRagContext } from '../services/rag-context-provider';
import { validateBookingDate, getDateCorrectionStats } from '../utils/date-validation';

const router = Router();

// Helper function: Resolve tenantId from either direct tenantId or inbound phone number mapping
async function resolveTenantId(tenantId?: string, inboundPhoneNumber?: string): Promise<string | null> {
    // If tenantId is provided, use it directly
    if (tenantId) {
        return tenantId;
    }

    // If inboundPhoneNumber is provided, look up the mapping
    if (inboundPhoneNumber) {
        try {
            const { data, error } = await supabaseService
                .from('phone_number_mapping')
                .select('org_id')
                .eq('inbound_phone_number', inboundPhoneNumber)
                .eq('is_active', true)
                .limit(1)
                .single();

            if (!error && data?.org_id) {
                log.info('VapiTools', 'Resolved phone number to org_id', {
                    inboundPhoneNumber,
                    org_id: data.org_id
                });
                return data.org_id;
            } else {
                log.warn('VapiTools', 'Phone number mapping not found', { inboundPhoneNumber });
                return null;
            }
        } catch (err: any) {
            log.error('VapiTools', 'Error resolving phone number', { error: err.message });
            return null;
        }
    }

    return null;
}

// Middleware to extract arguments regardless of Vapi payload format
const extractArgs = (req: any) => {
    let args: any = {};

    // 0. Handle Vapi 3.0 "toolCalls" (plural) or "toolCallList"
    const toolCalls = req.body.message?.toolCalls || req.body.message?.toolCallList;
    if (toolCalls && toolCalls.length > 0) {
        args = toolCalls[0].function?.arguments || {};
    }
    // 1. Try Vapi "Live Call" nested structure: message.toolCall
    else if (req.body.message?.toolCall) {
        args = req.body.message.toolCall.function?.arguments || req.body.message.toolCall.arguments || {};
    }
    // 2. Try direct structure: toolCall
    else if (req.body.toolCall) {
        args = req.body.toolCall.function?.arguments || req.body.toolCall.arguments || {};
    }
    // 3. Fallback: arguments at root
    else {
        args = req.body.arguments || req.body;
    }

    // Parse JSON string if needed (Vapi sends arguments as string in 3.0)
    if (typeof args === 'string') {
        try {
            return JSON.parse(args);
        } catch (e) {
            console.error('Failed to parse arguments string:', args);
            return {};
        }
    }

    return args;
};

/**
 * CRITICAL: Check Availability Tool
 * 
 * Vapi sends tool call like:
 * {
 *   "toolCall": {
 *     "name": "check_availability",
 *     "arguments": { "tenantId": "...", "date": "2026-01-15", "serviceType": "consultation" }
 *   }
 * }
 * 
 * We MUST return structured response that GPT-4o can parse:
 * {
 *   "toolResult": {
 *     "content": "[JSON string with slots]"
 *   },
 *   "speech": "Optional natural language"
 * }
 * 
 * GPT-4o will observe toolResult.content in the next context turn and use it in conversation.
 */
router.post('/tools/calendar/check', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, date, serviceType } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !date) {
            return res.status(400).json({ error: 'Missing tenantId/inboundPhoneNumber or date parameters' });
        }

        // Validate Google Calendar credentials health before attempting to check availability
        const healthCheck = await IntegrationDecryptor.validateGoogleCalendarHealth(resolvedTenantId);
        if (!healthCheck.healthy) {
            log.error('VapiTools', 'Google Calendar credentials invalid', {
                orgId: resolvedTenantId,
                error: healthCheck.error
            });

            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'calendar_integration_error',
                        message: healthCheck.error || 'Unable to access calendar'
                    })
                },
                speech: 'I\'m having trouble accessing the calendar right now. Let me transfer you to someone who can help you schedule an appointment.'
            });
        }

        log.info('VapiTools', 'Checking availability', {
            resolvedTenantId,
            date,
            serviceType,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        const slots = await calendarSlotService.checkAvailability(resolvedTenantId, date, serviceType);

        // If no slots available, check next 3 days automatically
        let alternativeDays: any[] = [];
        if (slots.length === 0) {
            log.info('VapiTools', 'No slots on requested date, checking next 3 days', { date });

            const requestedDate = new Date(date + 'T00:00:00');

            for (let i = 1; i <= 3; i++) {
                const nextDate = new Date(requestedDate);
                nextDate.setDate(nextDate.getDate() + i);
                const nextDateStr = nextDate.toISOString().split('T')[0];

                try {
                    const nextSlots = await calendarSlotService.checkAvailability(
                        resolvedTenantId,
                        nextDateStr,
                        serviceType
                    );

                    if (nextSlots.length > 0) {
                        alternativeDays.push({
                            date: nextDateStr,
                            slots: nextSlots.slice(0, 3), // First 3 slots only
                            slotCount: nextSlots.length
                        });
                    }
                } catch (err: any) {
                    log.warn('VapiTools', `Failed to check ${nextDateStr}`, { error: err.message });
                }
            }
        }

        // CRITICAL: Return structured response for GPT-4o parsing
        // The toolResult.content must be JSON that the model can parse
        const hasAlternatives = alternativeDays.length > 0;
        const toolContent = JSON.stringify({
            success: true,
            requestedDate: date,
            availableSlots: slots,
            slotCount: slots.length,
            alternatives: alternativeDays,
            message: slots.length > 0
                ? `Found ${slots.length} available times on ${date}`
                : hasAlternatives
                ? `No availability on ${date}. Found ${alternativeDays.length} alternative days with openings.`
                : `No availability on ${date} or the next 3 days.`
        });

        // Generate speech with alternatives
        let speechText = '';
        if (slots.length > 0) {
            speechText = `Great! I found ${slots.length} available times on ${date}. Here are your options: ${slots.slice(0, 3).join(', ')}.`;
        } else if (hasAlternatives) {
            const firstAlt = alternativeDays[0];
            const firstSlots = firstAlt.slots.slice(0, 2).join(' or ');
            speechText = `I'm sorry, but ${date} is fully booked. How about ${firstAlt.date}? I have ${firstSlots} available.`;
        } else {
            speechText = `I'm sorry, but I don't see any openings on ${date} or the next few days. Would you like me to transfer you to someone who can help find a time that works?`;
        }

        // Vapi webhook response format
        return res.json({
            toolResult: {
                content: toolContent
            },
            speech: speechText
        });

    } catch (error: any) {
        log.error('VapiTools', 'Error checking calendar', { error: error.message });

        // Return error in toolResult format so GPT-4o understands
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Unable to check availability',
                    message: 'I\'m having trouble checking the schedule right now. Let\'s try again in a moment.'
                })
            },
            speech: 'I\'m having trouble checking the schedule. Can you try again?'
        });
    }
});

/**
 * CRITICAL: Reserve Slot Tool
 * 
 * Called AFTER patient confirms their preferred time.
 * Holds the slot for 5 minutes to prevent double-booking.
 * 
 * Expected Vapi payload:
 * {
 *   "toolCall": {
 *     "name": "reserve_slot",
 *     "arguments": {
 *       "tenantId": "...",
 *       "slotId": "2026-01-15T14:00:00Z",
 *       "patientPhone": "+1234567890",
 *       "patientName": "John Doe"
 *     }
 *   }
 * }
 * 
 * Returns toolResult.content as JSON for GPT-4o to parse.
 */
router.post('/tools/calendar/reserve', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, slotId, patientPhone, patientName } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !slotId || !patientPhone) {
            return res.status(400).json({ error: 'Missing required reservation parameters' });
        }

        log.info('VapiTools', 'Reserving slot', {
            resolvedTenantId,
            slotId,
            patientPhone,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        const result = await calendarSlotService.reserveSlot(resolvedTenantId, slotId, patientPhone, patientName);

        // Return structured response
        if (!result.success) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: result.error || 'Slot already taken',
                        message: 'That time is no longer available. Let me show you other options.'
                    })
                },
                speech: `I'm sorry, it looks like someone just booked that time. Would you like to see other available times?`
            });
        } else {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        slotId: slotId,
                        patientPhone: patientPhone,
                        patientName: patientName,
                        holdExpiresIn: '5 minutes',
                        message: 'Slot successfully reserved'
                    })
                },
                speech: `Perfect! I've held that appointment for you. Let me send you a confirmation text.`
            });
        }
    } catch (error: any) {
        log.error('VapiTools', 'Error reserving slot', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Reservation failed',
                    message: 'I had trouble reserving that time. Please try again.'
                })
            },
            speech: 'Let me try that again...'
        });
    }
});

/**
 * CRITICAL: Send SMS Reminder Tool
 * 
 * Called AFTER successful slot reservation to send confirmation SMS.
 * Uses 10DLC-compliant message with opt-out language.
 * 
 * Expected Vapi payload:
 * {
 *   "toolCall": {
 *     "name": "send_sms_reminder",
 *     "arguments": {
 *       "tenantId": "...",
 *       "phoneNumber": "+1234567890",
 *       "messageType": "confirmation",
 *       "appointmentId": "..." (optional)
 *     }
 *   }
 * }
 * 
 * Returns toolResult.content as JSON for GPT-4o to parse.
 */
router.post('/tools/sms/send', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, phoneNumber, messageType, appointmentId } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !phoneNumber) {
            return res.status(400).json({ error: 'Missing required SMS parameters' });
        }

        log.info('VapiTools', 'Sending SMS', {
            resolvedTenantId,
            phoneNumber,
            messageType,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        // Build compliant SMS message
        let message = '';
        if (messageType === 'confirmation') {
            message = `Your appointment is confirmed! ${appointmentId ? 'Ref: ' + appointmentId : ''} Reply STOP to unsubscribe.`;
        } else if (messageType === 'otp') {
            const otp = Math.floor(1000 + Math.random() * 9000);
            message = `Your verification code is ${otp}. Reply STOP to unsubscribe.`;
        } else if (messageType === 'reminder') {
            message = `Reminder: You have an upcoming appointment. Reply STOP to unsubscribe.`;
        } else {
            message = `Appointment update. Reply STOP to unsubscribe.`;
        }

        const result = await smsComplianceService.sendCompliantSMS(resolvedTenantId, phoneNumber, message);

        // Return structured response
        if (!result.success) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: result.error || 'SMS delivery failed',
                        message: 'I had trouble sending the confirmation text.'
                    })
                },
                speech: `I'm having trouble sending the text. Let me try once more...`
            });
        } else {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        phoneNumber: phoneNumber,
                        messageType: messageType,
                        deliveryStatus: 'sent',
                        message: 'SMS sent successfully'
                    })
                },
                speech: `Perfect! I've sent a confirmation text to ${phoneNumber}. You're all set!`
            });
        }
    } catch (error: any) {
        log.error('VapiTools', 'Error sending SMS', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'SMS service error',
                    message: 'Unable to send SMS at this moment'
                })
            },
            speech: 'Let me try sending that text again...'
        });
    }
});

/**
 * PHASE 2: RESERVE SLOT ATOMICALLY (Atomic Locking)
 * 
 * Two-phase commit with advisory locking for high-value appointments.
 * Prevents double-booking via PostgreSQL microsecond-level atomicity.
 * 
 * Expected Vapi payload:
 * {
 *   "toolCall": {
 *     "name": "reserve_atomic",
 *     "arguments": {
 *       "tenantId": "...",
 *       "slotId": "2026-01-15T14:00:00Z",
 *       "patientPhone": "+1234567890",
 *       "patientName": "John Doe",
 *       "calendarId": "primary"
 *     }
 *   }
 * }
 * 
 * Returns: JSON with hold_id for OTP verification step
 */
router.post('/tools/booking/reserve-atomic', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, slotId, patientPhone, patientName, calendarId } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !slotId || !patientPhone || !patientName) {
            return res.status(400).json({ error: 'Missing required atomic reservation parameters' });
        }

        log.info('VapiTools', 'Attempting atomic slot reservation', {
            resolvedTenantId,
            slotId,
            patientPhone,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        // Parse slot time
        let slotTime: Date;
        try {
            slotTime = new Date(slotId);
            if (isNaN(slotTime.getTime())) {
                throw new Error('Invalid slot format');
            }
        } catch (err: any) {
            log.error('VapiTools', 'Invalid slot format', { slotId });
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'Invalid slot format',
                        action: 'ESCALATE'
                    })
                },
                speech: 'I encountered a system error. Let me connect you with our team.'
            });
        }

        // Validate slot year (anti time-travel protection)
        const slotYear = slotTime.getFullYear();
        const currentYear = new Date().getFullYear();

        if (slotYear < currentYear) {
            log.warn('VapiTools', '⚠️ Rejecting slot with past year', {
                slotId,
                slotYear,
                currentYear,
                orgId: resolvedTenantId,
                yearDifference: currentYear - slotYear
            });

            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: `Slot year ${slotYear} is in the past. Current year is ${currentYear}.`,
                        action: 'OFFER_ALTERNATIVES'
                    })
                },
                speech: `I notice that slot is from ${slotYear}, but we're currently in ${currentYear}. Let me show you available times for this year.`
            });
        }

        // Call atomic booking function
        const result = await AtomicBookingService.claimSlotAtomic(
            resolvedTenantId,
            calendarId || 'primary',
            slotTime,
            req.body.call?.id || 'unknown_call_sid',
            patientName,
            patientPhone
        );

        if (!result.success) {
            // Slot was taken by another call
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: result.error,
                        action: result.action
                    })
                },
                speech: result.action === 'OFFER_ALTERNATIVES'
                    ? `I'm sorry, that slot just got booked by another patient. Let me show you other available times.`
                    : `I'm having a technical issue. Let me connect you with our team to book this.`
            });
        } else {
            // Slot successfully held - proceed to OTP
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        holdId: result.holdId,
                        patientPhone: patientPhone,
                        patientName: patientName,
                        slotTime: slotTime.toISOString(),
                        message: 'Slot atomically reserved. Proceed to OTP verification.'
                    })
                },
                speech: `Excellent! I've locked that appointment for you at ${slotTime.toLocaleTimeString()}. Now, for security, I'm sending a 4-digit verification code to ${patientPhone}.`
            });
        }
    } catch (error: any) {
        log.error('VapiTools', 'Error in atomic reservation', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Atomic reservation system error',
                    action: 'ESCALATE'
                })
            },
            speech: 'We encountered a system error. Let me transfer you to our team.'
        });
    }
});

/**
 * PHASE 2: VERIFY OTP AND CONFIRM
 * 
 * Patient reads back the 4-digit code from their SMS.
 * On match, converts the hold to a confirmed appointment.
 * 
 * Expected Vapi payload:
 * {
 *   "toolCall": {
 *     "name": "verify_otp",
 *     "arguments": {
 *       "tenantId": "...",
 *       "holdId": "...",
 *       "providedOTP": "4 digit code",
 *       "contactId": "contact_uuid (optional)"
 *     }
 *   }
 * }
 * 
 * Returns: Success with appointment_id or failure with remaining attempts
 */
router.post('/tools/booking/verify-otp', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, holdId, providedOTP, contactId, serviceType } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !holdId || !providedOTP) {
            return res.status(400).json({ error: 'Missing required OTP verification parameters' });
        }

        log.info('VapiTools', 'Verifying OTP for hold', {
            resolvedTenantId,
            holdId,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        // Clean OTP input (remove spaces, extract digits only)
        const cleanedOTP = providedOTP.replace(/\D/g, '').slice(-4);

        if (cleanedOTP.length !== 4) {
            log.warn('VapiTools', 'Invalid OTP format', { provided: providedOTP, cleaned: cleanedOTP });
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'Invalid code format',
                        remainingAttempts: 3
                    })
                },
                speech: 'I need a 4-digit code. Could you read the numbers from your text message again?'
            });
        }

        // Call OTP verification
        const result = await AtomicBookingService.verifyOTPAndConfirm(
            holdId,
            resolvedTenantId,
            contactId || holdId, // Use holdId as fallback contact
            cleanedOTP,
            serviceType || 'consultation'
        );

        if (!result.success) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: result.error,
                        remainingAttempts: result.remainingAttempts
                    })
                },
                speech: result.remainingAttempts === 0
                    ? `I'm connecting you with our team to verify this manually.`
                    : `That code doesn't match. You have ${result.remainingAttempts} more ${result.remainingAttempts === 1 ? 'try' : 'tries'}.`
            });
        } else {
            // OTP verified - appointment confirmed
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        appointmentId: result.appointmentId,
                        holdId: holdId,
                        message: 'OTP verified. Appointment confirmed.'
                    })
                },
                speech: `Perfect! Your appointment is now confirmed. You'll receive a reminder the day before. Is there anything else I can help you with?`
            });
        }
    } catch (error: any) {
        log.error('VapiTools', 'Error in OTP verification', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'OTP verification system error'
                })
            },
            speech: 'We encountered a system error. Let me connect you with our booking team.'
        });
    }
});

// 4. Send Confirmation SMS (after successful OTP verification)
router.post('/tools/booking/send-confirmation', async (req, res) => {
    try {
        const args = extractArgs(req);
        const { tenantId, inboundPhoneNumber, appointmentId, contactId, patientPhone } = args;

        // Resolve tenantId from either direct ID or phone number mapping
        const resolvedTenantId = await resolveTenantId(tenantId, inboundPhoneNumber);

        if (!resolvedTenantId || !appointmentId || !patientPhone) {
            log.warn('VapiTools', 'Missing required confirmation SMS parameters', { appointmentId, patientPhone });
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'Missing required parameters for confirmation SMS'
                    })
                },
                speech: 'I had trouble sending your confirmation. Please save this appointment time: [date/time]'
            });
        }

        log.info('VapiTools', 'Sending confirmation SMS', {
            resolvedTenantId,
            appointmentId,
            patientPhone,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        // Send confirmation SMS
        const result = await BookingConfirmationService.sendConfirmationSMS(
            resolvedTenantId,
            appointmentId,
            contactId || appointmentId,
            patientPhone
        );

        if (!result.success) {
            log.warn('VapiTools', 'Failed to send confirmation SMS', { error: result.error, appointmentId });
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        messageSent: false,
                        error: result.error || 'Failed to send confirmation SMS'
                    })
                },
                speech: 'I was unable to send the confirmation text. Please screenshot or write down your appointment details.'
            });
        }

        log.info('VapiTools', 'Confirmation SMS sent successfully', {
            appointmentId,
            messageId: result.messageId
        });

        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    messageSent: true,
                    messageId: result.messageId,
                    appointmentId,
                    message: 'Confirmation SMS sent to patient'
                })
            },
            speech: 'Perfect! I\'ve sent your confirmation. Check your text messages.'
        });
    } catch (error: any) {
        log.error('VapiTools', 'Error sending confirmation SMS', { error: error.message });
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    messageSent: false,
                    error: 'Confirmation SMS system error'
                })
            },
            speech: 'There was a technical issue sending your confirmation. An admin will follow up shortly.'
        });
    }
});

// 5. Server URL (Temporal Awareness & Context)
router.post('/server', (req, res) => {
    try {
        // Vapi typically sends "message" object.
        // If we are using "context" injection as described in the prompt, it might be in the body.
        const context = req.body.context || req.body.message?.context || {};
        const { currentTime, callDuration, tenantId, customer } = context;

        // Check temporal triggers
        if (callDuration && Number(callDuration) > 540) { // 9min warning

            const phoneNumber = customer?.number || req.body.call?.customer?.number;

            if (phoneNumber && tenantId) {
                log.info('VapiTools', 'Triggering 9min warning', { callDuration, tenantId });
                return res.json({
                    toolCall: {
                        name: 'send_sms_reminder',
                        arguments: {
                            messageType: 'confirmation',
                            tenantId,
                            phoneNumber
                        }
                    },
                    speech: "Perfect! I'll send your confirmation shortly. Looking forward to seeing you!"
                });
            }
        }

        // If no intervention needed, verify we return 200 OK so Vapi proceeds
        return res.status(200).send();
    } catch (error: any) {
        log.error('VapiTools', 'Error in server endpoint', { error: error.message });
        return res.status(500).send();
    }
});

/**
 * BOOK CLINIC APPOINTMENT TOOL
 * Creates an appointment in both Supabase and Google Calendar
 * Uses org_id from metadata to fetch Google Calendar credentials
 * 
 * Vapi sends:
 * {
 *   "toolCall": {
 *     "name": "bookClinicAppointment",
 *     "arguments": {
 *       "appointmentDate": "2026-01-19",
 *       "appointmentTime": "09:00",
 *       "patientEmail": "patient@example.com",
 *       "patientPhone": "555-0123",
 *       "duration": 30
 *     }
 *   },
 *   "customer": {
 *     "metadata": {
 *       "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
 *     }
 *   }
 * }
 */
/**
 * PRODUCTION-HARDENED: Book Clinic Appointment (v2)
 * 
 * CRITICAL UPGRADES:
 * - Uses book_appointment_atomic_v2 RPC for race condition protection
 * - Normalizes 2024→2026 dates via normalizeBookingData()
 * - Handles slot conflicts gracefully with auto-alternative suggestions
 * - Multi-tenant isolation via org_id in customer.metadata
 * - E.164 phone formatting automatic
 * 
 * APPLIES TO: All users, all organizations, all calls
 */
router.post('/tools/bookClinicAppointment', async (req, res) => {
    const bookingStartTime = Date.now();

    try {
        log.info('VapiTools', '[BOOKING START v2] Received request', {
            timestamp: new Date().toISOString()
        });

        // ========================================
        // STEP 1: Extract org_id from Vapi metadata
        // ========================================
        const metadata = req.body.message?.call?.metadata || req.body.customer?.metadata || req.body.metadata || {};
        const orgId = metadata.org_id || (req as any).orgId || '46cf2995-2bee-44e3-838b-24151486fe4e';
        const toolCallId = req.body.toolCallId;
        const rawArgs = req.body.tool?.arguments || extractArgs(req);

        log.info('VapiTools', 'Multi-tenant org extracted', { orgId });

        // ========================================
        // STEP 2: NORMALIZE all booking data
        // This fixes 2024→2026 dates, E.164 phone, name capitalization
        // ========================================
        // STEP 2: Verify org exists & Get Timezone
        // ========================================
        log.info('VapiTools', '🔍 QUERYING ORG', { orgId });

        const { data: org, error: orgError } = await supabaseService
            .from('organizations')
            .select('id, name, timezone')
            .eq('id', orgId)
            .maybeSingle();

        log.info('VapiTools', '📋 ORG QUERY RESULT', {
            orgId,
            orgError: orgError ? JSON.stringify(orgError) : null,
            org: org ? JSON.stringify(org) : null
        });

        if (orgError || !org) {
            log.error('VapiTools', 'Organization not found', { orgId, orgError });
            return res.status(400).json({
                toolCallId,
                result: {
                    success: false,
                    error: 'ORG_NOT_FOUND'
                }
            });
        }

        log.info('VapiTools', '✅ Org verified', { orgName: org.name, timezone: org.timezone });

        // ========================================
        // STEP 3: NORMALIZE all booking data
        // This fixes 2024→2026 dates, E.164 phone, name capitalization
        // NOW TIMEZONE AWARE!
        // ========================================
        let normalizedData;
        try {
            // Pass org.timezone (defaulting to UTC if null)
            normalizedData = normalizeBookingData(rawArgs, org.timezone || 'UTC');
            log.info('VapiTools', '✅ Data normalized successfully', {
                phone: normalizedData.phone,
                dateFixed: rawArgs.appointmentDate ? rawArgs.appointmentDate.substring(0, 4) : 'N/A',
                scheduledAtUTC: normalizedData.scheduledAt,
                orgTimezone: org.timezone || 'UTC'
            });
        } catch (normError: any) {
            log.warn('VapiTools', 'Normalization error', { error: normError.message });
            return res.status(400).json({
                toolCallId,
                result: {
                    success: false,
                    error: 'INVALID_INPUT',
                    message: normError.message
                }
            });
        }

        const { email, name, phone, scheduledAt } = normalizedData;

        // ========================================
        // STEP 3.5: VALIDATE DATE (Anti Time-Travel Protection)
        // Prevents booking in 2024 when it's 2026
        // Auto-corrects past years to current year
        // ========================================
        const appointmentDateISO = normalizedData.appointmentDate || scheduledAt.split('T')[0];
        const dateValidation = validateBookingDate(
            appointmentDateISO,
            org.timezone || 'UTC',
            orgId
        );

        if (!dateValidation.valid) {
            log.error('VapiTools', '❌ Date validation failed', {
                originalDate: appointmentDateISO,
                error: dateValidation.error,
                orgId,
                orgTimezone: org.timezone
            });
            return res.status(400).json({
                toolCallId,
                result: {
                    success: false,
                    error: 'INVALID_DATE',
                    message: dateValidation.error || 'Date validation failed'
                }
            });
        }

        // If date was auto-corrected, update normalizedData
        if (dateValidation.wasAutoCorrected && dateValidation.correctedDate) {
            const originalDate = appointmentDateISO;
            const correctedDate = dateValidation.correctedDate;

            log.warn('VapiTools', '🔧 Date auto-corrected', {
                originalDate,
                correctedDate,
                orgId,
                yearChange: `${originalDate.substring(0, 4)} → ${correctedDate.substring(0, 4)}`
            });

            // Reconstruct scheduledAt with corrected date
            const timePart = scheduledAt.split('T')[1] || '00:00:00';
            normalizedData.scheduledAt = `${correctedDate}T${timePart}`;
            normalizedData.appointmentDate = correctedDate;
        }

        // ========================================
        // STEP 4: Find or create contact for booking
        // Required by book_appointment_with_lock RPC
        // ========================================
        let contactId: string | null = null;

        // Try to find existing contact by phone
        const { data: existingContact, error: contactLookupError } = await supabase
            .from('contacts')
            .select('id')
            .eq('org_id', orgId)
            .eq('phone', phone)
            .maybeSingle();

        if (contactLookupError) {
            log.error('VapiTools', 'Contact lookup error', { error: contactLookupError.message });
        }

        if (existingContact) {
            contactId = existingContact.id;
            log.info('VapiTools', '✅ Found existing contact', { contactId });
        } else {
            // Create new contact
            const { data: newContact, error: contactCreateError } = await supabase
                .from('contacts')
                .insert({
                    org_id: orgId,
                    first_name: name.split(' ')[0] || name,
                    last_name: name.split(' ').slice(1).join(' ') || '',
                    email: email,
                    phone: phone,
                    lead_source: 'vapi_ai_booking',
                })
                .select('id')
                .single();

            if (contactCreateError || !newContact) {
                log.error('VapiTools', 'Contact creation failed', {
                    error: contactCreateError?.message
                });
                return res.status(500).json({
                    toolCallId,
                    result: {
                        success: false,
                        error: 'CONTACT_CREATION_FAILED',
                        message: 'Failed to create customer record'
                    }
                });
            }

            contactId = newContact.id;
            log.info('VapiTools', '✅ Created new contact', { contactId });
        }

        // ========================================
        // STEP 5: Call SAFE book_appointment_with_lock RPC
        // Uses advisory locks to prevent race conditions
        // ========================================
        const rpcParams = {
            p_org_id: orgId,
            p_contact_id: contactId,
            p_scheduled_at: scheduledAt,
            p_duration_minutes: 60,
            p_service_id: null, // Optional - can link to service if available
            p_notes: `Booked via AI - Service: ${rawArgs.serviceType || 'consultation'}`,
            p_metadata: {
                booked_by: 'vapi_ai',
                service_type: rawArgs.serviceType || 'consultation',
                patient_name: name,
                patient_email: email,
                patient_phone: phone,
            },
            p_lock_key: null, // Let RPC generate lock key automatically
        };

        log.info('VapiTools', '🔍 RPC CALL PARAMS (with lock)', {
            orgId: orgId,
            contactId: contactId,
            name: name,
            email: email,
            phone: phone,
            scheduledAt: scheduledAt,
            serviceType: rawArgs.serviceType || 'consultation'
        });

        const { data, error } = await supabase.rpc('book_appointment_with_lock', rpcParams);

        if (error) {
            log.error('VapiTools', 'Booking RPC FAILED', {
                error: error.message,
                errorCode: (error as any).code,
                fullError: JSON.stringify(error)
            });
            return res.status(500).json({
                toolCallId,
                result: { success: false, error: 'BOOKING_FAILED' }
            });
        }

        // Supabase RPC returns array, extract first element
        const bookingResult = Array.isArray(data) && data.length > 0 ? data[0] : data;

        log.info('VapiTools', '📋 RPC RESPONSE ANALYSIS', {
            isArray: Array.isArray(data),
            dataLength: Array.isArray(data) ? data.length : 'not-array',
            rawData: JSON.stringify(data),
            resultKeys: bookingResult ? Object.keys(bookingResult) : 'null',
            success: bookingResult?.success,
            appointmentId: bookingResult?.appointment_id,
            contactId: bookingResult?.contact_id
        });

        log.info('VapiTools', 'RPC response received', {
            isArray: Array.isArray(data),
            dataLength: Array.isArray(data) ? data.length : 'not-array',
            resultKeys: bookingResult ? Object.keys(bookingResult) : 'null',
            scheduledAt: bookingResult?.scheduled_at,
            scheduledAtType: typeof bookingResult?.scheduled_at
        });

        // ========================================
        // STEP 6: Handle response (success or conflict)
        // book_appointment_with_lock returns: { success, appointment_id } or { success: false, error, conflicting_appointment }
        // ========================================
        if (!bookingResult.success) {
            // Check for specific conflict errors
            if (bookingResult.error === 'Time slot is already booked') {
                log.warn('VapiTools', '⚠️ Booking conflict - slot already taken', {
                    error: bookingResult.error,
                    conflictingAppointment: bookingResult.conflicting_appointment
                });
                return res.status(200).json({
                    toolCallId,
                    result: {
                        success: false,
                        error: 'SLOT_UNAVAILABLE',
                        message: 'That time was just booked by another caller',
                        conflicting_appointment: bookingResult.conflicting_appointment
                    }
                });
            } else if (bookingResult.error === 'Slot is currently being booked by another request') {
                log.warn('VapiTools', '⚠️ Booking conflict - slot being locked', {
                    error: bookingResult.error
                });
                return res.status(200).json({
                    toolCallId,
                    result: {
                        success: false,
                        error: 'SLOT_UNAVAILABLE',
                        message: 'That time is currently being booked by another caller. Please try again in a moment.'
                    }
                });
            }

            // Generic booking failure
            log.error('VapiTools', 'Booking failed', { error: bookingResult.error });
            return res.status(200).json({
                toolCallId,
                result: {
                    success: false,
                    error: 'BOOKING_FAILED',
                    message: bookingResult.error || 'Could not create appointment'
                }
            });
        }

        // SUCCESS: Booking created
        if (bookingResult.success) {
            log.info('VapiTools', '✅ Booking succeeded', {
                appointmentId: bookingResult.appointment_id,
                leadId: bookingResult.lead_id
            });

            // ⚡ THE SMS BRIDGE: Hook the orphaned BookingConfirmationService
            // This triggers automatic SMS confirmation using clinic's Twilio credentials
            let smsStatus = 'skipped';
            try {
                const smsResult = await BookingConfirmationService.sendConfirmationSMS(
                    orgId,
                    bookingResult.appointment_id,
                    bookingResult.lead_id,
                    phone
                );
                smsStatus = smsResult.success ? 'sent' : 'failed_but_booked';
                log.info('VapiTools', '📱 SMS Bridge Result', { smsStatus, smsResult });
            } catch (smsError: any) {
                log.warn('VapiTools', '⚠️ SMS Bridge Error (booking still succeeds)', {
                    error: smsError.message
                });
                smsStatus = 'error_but_booked';
            }

            // ⚡ GOOGLE CALENDAR BRIDGE: Create event with rollback capability
            // IMPLEMENTS 2-PHASE COMMIT: If calendar succeeds but DB update fails, delete calendar event
            let calendarEventId: string | null = null;
            try {
                const { createCalendarEvent } = await import('../services/calendar-integration');

                const eventDate = new Date(scheduledAt);
                const endTime = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour duration

                const calendarResult = await createCalendarEvent(orgId, {
                    title: `Botox Consultation: ${name}`,
                    description: `Patient: ${name}\nPhone: ${phone}\nEmail: ${email}\nService: ${rpcParams.p_service_type}`,
                    startTime: eventDate.toISOString(),
                    endTime: endTime.toISOString(),
                    attendeeEmail: email
                });
                
                calendarEventId = calendarResult.eventId;
                log.info('VapiTools', '📅 Google Calendar Event Created', { 
                    appointmentId: bookingResult.appointment_id, 
                    calendarEventId 
                });

                // Persist calendar event ID to appointment record
                try {
                    const { error: updateError } = await supabaseService
                        .from('appointments')
                        .update({ google_calendar_event_id: calendarEventId })
                        .eq('id', bookingResult.appointment_id);

                    if (updateError) {
                        throw new Error(`Failed to persist calendar event ID: ${updateError.message}`);
                    }

                    log.info('VapiTools', '✅ Calendar event ID persisted to appointment', { 
                        appointmentId: bookingResult.appointment_id,
                        calendarEventId 
                    });
                } catch (persistError: any) {
                    // ROLLBACK: Delete the calendar event we just created
                    log.error('VapiTools', '🔄 ROLLBACK: DB persist failed, deleting calendar event', {
                        appointmentId: bookingResult.appointment_id,
                        calendarEventId,
                        error: persistError.message
                    });

                    try {
                        const { deleteCalendarEvent } = await import('../services/calendar-integration');
                        await deleteCalendarEvent(orgId, calendarEventId);
                        log.info('VapiTools', '✅ ROLLBACK COMPLETE: Orphaned calendar event deleted', { calendarEventId });
                    } catch (rollbackError: any) {
                        log.error('VapiTools', '❌ ROLLBACK FAILED: Manual cleanup required', {
                            calendarEventId,
                            orgId,
                            error: rollbackError.message
                        });
                    }

                    throw persistError; // Re-throw to trigger outer catch
                }
            } catch (calError: any) {
                // GRACEFUL DEGRADATION: Log error but DO NOT fail the request
                // If rollback was attempted, it's already logged above
                log.error('VapiTools', '⚠️ Calendar Event Failed', { error: calError.message });
            }

            // Construct success message with Timezone awareness if possible
            // For now, we use the date as provided.
            // TODO: In Phase 2, use date-fns-tz to format this string in org.timezone

            return res.status(200).json({
                toolCallId,
                result: {
                    success: true,
                    appointmentId: bookingResult.appointment_id,
                    smsStatus: smsStatus,
                    message: `✅ Appointment confirmed for ${new Date(scheduledAt).toLocaleDateString()} at ${new Date(scheduledAt).toLocaleTimeString()}`
                }
            });
        }

        // UNEXPECTED: Neither success nor error properly handled
        log.error('VapiTools', 'Unexpected RPC response', { bookingResult });
        return res.status(500).json({
            toolCallId,
            result: {
                success: false,
                error: 'UNEXPECTED_RESPONSE',
                message: 'Booking processing error'
            }
        });

    } catch (error: any) {
        log.error('VapiTools', '❌ Error in bookClinicAppointment v2', {
            error: error.message,
            stack: error.stack
        });

        const toolCallId = req.body.toolCallId;
        return res.status(200).json({
            toolCallId,
            result: {
                success: false,
                error: 'INTERNAL_ERROR',
                message: error.message
            }
        });
    }
});

/**
 * ================================
 * PHASE 1: OPERATIONAL CORE TOOLS
 * ================================
 */

/**
 * 📞 TOOL: transferCall
 *
 * Transfers the caller to a human agent with full context.
 * Implements warm handoff following Split-Brain Rule.
 *
 * Request format:
 * {
 *   "message": {
 *     "toolCalls": [{
 *       "function": {
 *         "arguments": {
 *           "summary": "Customer wants to reschedule their Botox appointment",
 *           "department": "general"
 *         }
 *       }
 *     }],
 *     "call": {
 *       "id": "call-123",
 *       "metadata": { "org_id": "org-uuid" },
 *       "customer": { "number": "+15551234567" }
 *     }
 *   }
 * }
 */
router.post('/tools/transferCall', async (req, res) => {
    try {
        // Extract arguments from Vapi payload
        const toolCalls = req.body.message?.toolCalls || [];
        if (toolCalls.length === 0) {
            log.warn('VapiTools', 'transferCall: No toolCalls found');
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'No tool calls' })
                },
                speech: 'I apologize, but I encountered an error. Let me try again.'
            });
        }

        const args = toolCalls[0]?.function?.arguments || {};
        const { summary, department } = args;

        // Extract org context from call metadata
        const call = req.body.message?.call || {};
        const orgId = call.metadata?.org_id || call.orgId;
        const callId = call.id;
        const customerPhone = call.customer?.number;

        log.info('VapiTools', 'Transfer call requested', {
            orgId,
            callId,
            department,
            summaryPreview: summary?.substring(0, 50)
        });

        if (!orgId) {
            log.error('VapiTools', 'transferCall: No org_id found');
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'Organization context not found' })
                },
                speech: 'I apologize, but I\'m having trouble transferring your call. Could you please call back and ask to speak with a representative directly?'
            });
        }

        // Fetch transfer configuration from integration_settings
        const { data: settings, error: settingsError } = await supabaseService
            .from('integration_settings')
            .select('transfer_phone_number, transfer_sip_uri, transfer_departments')
            .eq('org_id', orgId)
            .maybeSingle();

        if (settingsError || !settings) {
            log.error('VapiTools', 'Failed to fetch transfer settings', {
                orgId,
                error: settingsError?.message
            });

            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'Transfer not configured' })
                },
                speech: 'I apologize, but transfers are not configured for your organization. Could you please call back during business hours and ask to speak with a representative directly?'
            });
        }

        // Determine transfer destination
        let transferDestination: string | null = null;

        // Priority 1: Check department-specific number
        if (settings.transfer_departments && department) {
            const deptNumbers = settings.transfer_departments as Record<string, string>;
            transferDestination = deptNumbers[department] || null;
        }

        // Priority 2: Fall back to default transfer number
        if (!transferDestination) {
            transferDestination = settings.transfer_phone_number || null;
        }

        if (!transferDestination) {
            log.warn('VapiTools', 'No transfer destination configured', { orgId, department });

            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'No transfer number configured' })
                },
                speech: 'I apologize, but there\'s no one available to take your call right now. Can I take a message or have someone call you back?'
            });
        }

        // Log transfer to call_logs (transfer_to, transfer_time, transfer_reason columns exist)
        if (callId) {
            const { error: logError } = await supabaseService
                .from('call_logs')
                .update({
                    transfer_to: transferDestination,
                    transfer_time: new Date().toISOString(),
                    transfer_reason: `${department}: ${summary}`
                })
                .eq('vapi_call_id', callId)
                .eq('org_id', orgId);

            if (logError) {
                log.warn('VapiTools', 'Failed to log transfer to call_logs', {
                    error: logError.message,
                    callId
                });
            }
        }

        // Log to transfer_queue for audit trail (if table exists)
        try {
            await supabaseService
                .from('transfer_queue')
                .insert({
                    org_id: orgId,
                    call_id: callId,
                    to_number: transferDestination,
                    reason: summary,
                    trigger_data: {
                        department,
                        customer_phone: customerPhone,
                        timestamp: new Date().toISOString()
                    },
                    status: 'initiated'
                });
        } catch (queueError: any) {
            log.warn('VapiTools', 'Failed to create transfer queue entry (non-blocking)', {
                error: queueError?.message
            });
            // Continue - queue logging should not block transfer
        }

        log.info('VapiTools', 'Transfer initiated', {
            orgId,
            callId,
            destination: transferDestination,
            department
        });

        // Determine if SIP or PSTN transfer
        const isSipDestination = settings.transfer_sip_uri && transferDestination.startsWith('sip:');

        // Return Vapi transfer object
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    transferTo: transferDestination,
                    department,
                    summary
                })
            },
            // Vapi transfer action
            transfer: {
                destination: isSipDestination
                    ? { type: 'sip', sipUri: transferDestination }
                    : { type: 'number', number: transferDestination },
                // Include context for the receiving agent
                message: `Transfer from AI: ${summary}`
            },
            speech: `I'm transferring you now to our ${department} team. One moment please.`
        });

    } catch (error: any) {
        log.error('VapiTools', 'Error in transferCall', {
            error: error?.message,
            stack: error?.stack
        });

        return res.json({
            toolResult: {
                content: JSON.stringify({ success: false, error: 'Transfer failed' })
            },
            speech: 'I apologize, but I encountered an error while trying to transfer your call. Could you please hold while I try again?'
        });
    }
});

/**
 * ⏹️  TOOL: endCall
 *
 * Gracefully terminates the current call with logging.
 * Used when: conversation complete, time limit reached, or patient requests to end.
 *
 * Request format:
 * {
 *   "message": {
 *     "toolCalls": [{
 *       "function": {
 *         "name": "endCall",
 *         "arguments": { "reason": "completed", "summary": "..." }
 *       }
 *     }],
 *     "call": { "id": "...", "metadata": { "org_id": "..." } }
 *   }
 * }
 */
router.post('/tools/endCall', async (req, res) => {
    try {
        // Extract arguments using the unified extractor
        const args = extractArgs(req);
        const { reason, summary } = args;

        // Extract call context
        const call = req.body.message?.call || {};
        const callId = call.id;
        const orgId = call.metadata?.org_id || call.orgId;

        log.info('VapiTools', '⏹️  endCall invoked', {
            reason,
            summary,
            callId,
            orgId
        });

        // Log to call_logs if call_id available
        if (callId && orgId) {
            const { error: logError } = await supabaseService
                .from('call_logs')
                .update({
                    end_reason: reason,
                    ai_summary: summary,
                    ended_at: new Date().toISOString()
                })
                .eq('vapi_call_id', callId)
                .eq('org_id', orgId);

            if (logError) {
                log.warn('VapiTools', 'Failed to log end reason to call_logs', {
                    error: logError.message,
                    callId
                });
            } else {
                log.info('VapiTools', 'Call end logged successfully', { callId, reason });
            }
        }

        // Return success with endCall flag (tells Vapi to terminate the call)
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    reason,
                    message: summary || 'Call ended successfully'
                })
            },
            endCall: true, // Vapi's flag to terminate call immediately
            speech: reason === 'time_limit'
                ? 'Our time is up. Thank you for calling, and have a great day!'
                : 'Thank you for calling. Have a great day!'
        });

    } catch (error: any) {
        log.error('VapiTools', 'Error in endCall', {
            error: error?.message,
            stack: error?.stack
        });

        // Still end call even if logging fails
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Failed to log call end, but call will still terminate'
                })
            },
            endCall: true,
            speech: 'Thank you for calling. Goodbye!'
        });
    }
});

/**
 * 🔍 TOOL: lookupCaller
 *
 * Searches for existing customer in database.
 * Used when caller claims to be an existing client but identity wasn't auto-detected.
 *
 * Request format:
 * {
 *   "message": {
 *     "toolCalls": [{
 *       "function": {
 *         "arguments": {
 *           "searchKey": "+15551234567",
 *           "searchType": "phone"
 *         }
 *       }
 *     }],
 *     "call": {
 *       "metadata": { "org_id": "org-uuid" }
 *     }
 *   }
 * }
 */
router.post('/tools/lookupCaller', async (req, res) => {
    try {
        // Extract arguments
        const toolCalls = req.body.message?.toolCalls || [];
        if (toolCalls.length === 0) {
            log.warn('VapiTools', 'lookupCaller: No toolCalls found');
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'No tool calls' })
                },
                speech: 'I need a bit more information. Could you provide your phone number or name?'
            });
        }

        const args = toolCalls[0]?.function?.arguments || {};
        const { searchKey, searchType } = args;

        // Extract org context
        const call = req.body.message?.call || {};
        const orgId = call.metadata?.org_id || call.orgId;

        log.info('VapiTools', 'Caller lookup requested', {
            orgId,
            searchType,
            searchKeyPreview: searchKey?.substring(0, 3) + '***'
        });

        if (!orgId || !searchKey || !searchType) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'Missing required parameters' })
                },
                speech: 'I need a bit more information to look you up. Could you provide your phone number or full name?'
            });
        }

        // Build query based on search type
        let query = supabaseService
            .from('contacts')
            .select('id, name, email, phone, lead_status, service_interests, notes, last_contacted_at')
            .eq('org_id', orgId);

        switch (searchType) {
            case 'phone':
                // Normalize phone number for search (remove all non-digits)
                const normalizedPhone = searchKey.replace(/\D/g, '');
                query = query.or(`phone.ilike.%${normalizedPhone}%`);
                break;
            case 'email':
                query = query.ilike('email', `%${searchKey}%`);
                break;
            case 'name':
                query = query.ilike('name', `%${searchKey}%`);
                break;
            default:
                return res.json({
                    toolResult: {
                        content: JSON.stringify({ success: false, error: 'Invalid search type' })
                    },
                    speech: 'I couldn\'t understand the search criteria. Could you try again?'
                });
        }

        const { data: contacts, error } = await query.limit(5);

        if (error) {
            log.error('VapiTools', 'Caller lookup failed', { error: error.message });
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: false, error: 'Database error' })
                },
                speech: 'I\'m having trouble accessing our records right now. Let me help you as a new customer for today.'
            });
        }

        if (!contacts || contacts.length === 0) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({ success: true, found: false, message: 'No matching contact found' })
                },
                speech: 'I don\'t see a record matching that information. That\'s okay, I\'d be happy to help you today. Could you tell me your name?'
            });
        }

        // Single match - return full details
        if (contacts.length === 1) {
            const contact = contacts[0];
            const firstName = contact.name?.split(' ')[0] || 'there';

            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        found: true,
                        contact: {
                            id: contact.id,
                            name: contact.name,
                            email: contact.email,
                            status: contact.lead_status,
                            interests: contact.service_interests,
                            lastContact: contact.last_contacted_at,
                            notes: contact.notes
                        }
                    })
                },
                speech: `Found you, ${firstName}! Great to hear from you again. How can I help you today?`
            });
        }

        // Multiple matches - return list for clarification
        const names = contacts.map(c => c.name).join(', ');
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    found: true,
                    multipleMatches: true,
                    contacts: contacts.map(c => ({
                        id: c.id,
                        name: c.name,
                        phone: c.phone?.slice(-4) // Last 4 digits only for privacy
                    }))
                })
            },
            speech: `I found a few people that might be you: ${names}. Which one is correct?`
        });

    } catch (error: any) {
        log.error('VapiTools', 'Error in lookupCaller', {
            error: error?.message
        });

        return res.json({
            toolResult: {
                content: JSON.stringify({ success: false, error: 'Lookup failed' })
            },
            speech: 'I\'m having trouble with the lookup. Let me help you as if you\'re new for today.'
        });
    }
});

/**
 * 📚 TOOL: getKnowledgeBase
 *
 * Searches the organization's knowledge base for relevant information.
 * Allows the AI to actively query KB during calls for specific questions.
 *
 * Request format:
 * {
 *   "message": {
 *     "toolCalls": [{
 *       "function": {
 *         "name": "getKnowledgeBase",
 *         "arguments": {
 *           "query": "What are your hours?",
 *           "tenantId": "org-uuid" // or inboundPhoneNumber
 *         }
 *       }
 *     }],
 *     "call": {
 *       "metadata": { "org_id": "org-uuid" }
 *     }
 *   }
 * }
 */
router.post('/tools/knowledge-base', async (req, res) => {
    try {
        // Extract arguments using the unified extractor
        const args = extractArgs(req);
        const { query, tenantId, inboundPhoneNumber } = args;

        // Extract org context from call metadata as fallback
        const call = req.body.message?.call || {};
        const metadataOrgId = call.metadata?.org_id || call.orgId;

        // Resolve org_id (priority: tenantId → call metadata → phone lookup)
        let orgId = tenantId || metadataOrgId;

        if (!orgId && inboundPhoneNumber) {
            orgId = await resolveTenantId(undefined, inboundPhoneNumber);
        }

        log.info('VapiTools', '📚 Knowledge base query requested', {
            orgId,
            queryPreview: query?.substring(0, 50),
            hasQuery: !!query
        });

        if (!orgId) {
            log.error('VapiTools', 'getKnowledgeBase: No org_id resolved');
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'Organization context not found',
                        message: 'Unable to search knowledge base without organization context'
                    })
                },
                speech: 'I\'m having trouble accessing our information database. Let me help you another way.'
            });
        }

        if (!query || query.trim().length === 0) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'Empty query',
                        message: 'No search query provided'
                    })
                },
                speech: 'What would you like to know? I can look that up for you.'
            });
        }

        // Call RAG context provider
        const { context, chunkCount, hasContext } = await getRagContext(query, orgId);

        log.info('VapiTools', '📚 Knowledge base search completed', {
            orgId,
            hasContext,
            chunkCount,
            contextLength: context.length
        });

        if (!hasContext) {
            return res.json({
                toolResult: {
                    content: JSON.stringify({
                        success: true,
                        found: false,
                        chunkCount: 0,
                        message: 'No relevant information found in knowledge base for this query'
                    })
                },
                speech: 'I don\'t have specific information about that in my knowledge base. Is there something else I can help you with?'
            });
        }

        // Return successful context retrieval
        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: true,
                    found: true,
                    chunkCount,
                    context,
                    message: `Found ${chunkCount} relevant knowledge base entries`
                })
            },
            speech: '' // No speech - let the AI formulate response based on context
        });

    } catch (error: any) {
        log.error('VapiTools', 'Error in getKnowledgeBase', {
            error: error?.message,
            stack: error?.stack
        });

        return res.json({
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Knowledge base search failed',
                    message: error?.message || 'Unable to search knowledge base'
                })
            },
            speech: 'I\'m having trouble accessing our information right now. Let me try to help you another way.'
        });
    }
});

export default router;
