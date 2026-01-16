
import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { calendarSlotService } from '../services/calendar-slot-service';
import { smsComplianceService } from '../services/sms-compliance-service';
import { log } from '../services/logger';
import { AtomicBookingService } from '../services/atomic-booking-service';
import { BookingConfirmationService } from '../services/booking-confirmation-service';

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
            const { data, error } = await supabase
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
    return req.body.toolCall?.arguments || req.body;
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

        log.info('VapiTools', 'Checking availability', {
            resolvedTenantId,
            date,
            serviceType,
            source: tenantId ? 'direct' : 'phone_lookup'
        });

        const slots = await calendarSlotService.checkAvailability(resolvedTenantId, date, serviceType);

        // CRITICAL: Return structured response for GPT-4o parsing
        // The toolResult.content must be JSON that the model can parse
        const toolContent = JSON.stringify({
            success: true,
            date: date,
            availableSlots: slots,
            slotCount: slots.length,
            message: slots.length > 0
                ? `Found ${slots.length} available times on ${date}`
                : `No availability on ${date}`
        });

        // Vapi webhook response format
        return res.json({
            toolResult: {
                content: toolContent
            },
            // Optional: Add natural language that Vapi can speak
            speech: slots.length > 0
                ? `Great! I found ${slots.length} available times on ${date}. Here are your options: ${slots.slice(0, 3).join(', ')}.`
                : `I'm sorry, but I don't see any openings on ${date}. Would another day work for you?`
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

export default router;
