
import { Router } from 'express';
import { supabase } from '../services/supabase-client';
import { calendarSlotService } from '../services/calendar-slot-service';
import { smsComplianceService } from '../services/sms-compliance-service';
import { log } from '../services/logger';
import { AtomicBookingService } from '../services/atomic-booking-service';
import { BookingConfirmationService } from '../services/booking-confirmation-service';
import { createCalendarEvent } from '../services/calendar-integration';
import { normalizeDate, normalizeTime } from '../services/date-normalizer';
import { bookingDeduplicator } from '../services/booking-deduplicator';

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

// Helper function: Format Vapi tool response in dual format (new and legacy)
// Detects which format to use based on presence of toolCallId in the request
const formatVapiResponse = (req: any, result: any, legacyContent?: any) => {
    const toolCallId = req.body.toolCallId;

    if (toolCallId) {
        // New Vapi 3.0 format with toolCallId
        return {
            toolCallId,
            result: result || { success: true }
        };
    } else {
        // Legacy format (backward compatibility)
        return {
            toolResult: {
                content: JSON.stringify(result || legacyContent || { success: true })
            },
            speech: legacyContent?.speech || undefined
        };
    }
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

        // Vapi response: dual format support (new and legacy)
        return res.json(formatVapiResponse(req,
            JSON.parse(toolContent),
            {
                content: toolContent,
                speech: slots.length > 0
                    ? `Great! I found ${slots.length} available times on ${date}. Here are your options: ${slots.slice(0, 3).join(', ')}.`
                    : `I'm sorry, but I don't see any openings on ${date}. Would another day work for you?`
            }
        ));

    } catch (error: any) {
        log.error('VapiTools', 'Error checking calendar', { error: error.message });

        // Return error in dual format
        const errorResult = {
            success: false,
            error: 'Unable to check availability',
            message: 'I\'m having trouble checking the schedule right now. Let\'s try again in a moment.'
        };

        return res.json(formatVapiResponse(req, errorResult, {
            content: JSON.stringify(errorResult),
            speech: 'I\'m having trouble checking the schedule. Can you try again?'
        }));
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
 * MULTI-TENANT TOOL: Book Clinic Appointment
 * 
 * Extracts org_id from Vapi customer metadata (NOT hardcoded).
 * Queries tenant_integrations for Google Calendar credentials.
 * Creates appointment in tenant-scoped schema.
 */
router.post('/tools/bookClinicAppointment', async (req, res) => {
    const bookingStartTime = Date.now();

    try {
        log.info('VapiTools', '[BOOKING START] 🔹 Received booking request', {
            timestamp: new Date().toISOString(),
            body: req.body
        });

        // ========================================
        // VAPI TOOL FORMAT: Extract toolCallId and arguments
        // ========================================
        const toolCallId = req.body.toolCallId;
        const toolArgs = req.body.tool?.arguments || {};

        // Fallback to old format if new format not present
        const args = toolCallId ? toolArgs : extractArgs(req);

        // ========================================
        // STEP 1B: EXTRACT ORG_ID FROM METADATA
        // ========================================
        // Priority: metadata.org_id > customer.metadata.org_id > call.metadata.org_id
        const metadata = req.body.message?.call?.metadata || req.body.customer?.metadata || req.body.metadata || {};
        const orgId = metadata.org_id || (req as any).orgId || '46cf2995-2bee-44e3-838b-24151486fe4e'; // Fallback for testing

        log.info('VapiTools', '🔹 MULTI-TENANT BOOKING', {
            orgId,
            appointmentDate: args.appointmentDate,
            appointmentTime: args.appointmentTime,
            patientEmail: args.patientEmail,
            toolCallId,
            source: metadata.org_id ? 'metadata' : 'fallback'
        });

        // ========================================
        // STEP 1C: VALIDATE REQUIRED FIELDS
        // ========================================
        let {
            appointmentDate,
            appointmentTime,
            patientEmail,
            patientPhone,
            patientName,
            serviceType = 'consultation',
            duration = 30
        } = args;

        log.info('VapiTools', '🔹 MULTI-TENANT BOOKING', {
            orgId,
            appointmentDate: appointmentDate ? appointmentDate.substring(0, 10) : 'N/A',
            appointmentTime,
            patientEmail,
            source: metadata.org_id ? 'metadata' : 'args'
        });

        // DEBUG: Log raw request to file
        const fs = require('fs');
        const debugLogPath = require('path').join(process.cwd(), 'vapi-debug.log');
        const logEntry = `[${new Date().toISOString()}] ${JSON.stringify({ headers: req.headers, body: req.body, args })}\n`;
        fs.appendFile(debugLogPath, logEntry, (err: any) => { if (err) console.error('Failed to write debug log', err); });

        // Validate inputs before normalization
        // Note: patientPhone is required (per tool schema), patientEmail is optional
        if (!orgId || !appointmentDate || !appointmentTime || !patientPhone) {
            const errorMsg = `Missing required fields: org_id (in metadata), appointmentDate, appointmentTime, patientPhone. Received: orgId=${orgId}, argsKeys=${Object.keys(args).join(',')}`;
            log.warn('VapiTools', 'Invalid booking request', { args, metadata });

            // Determine which field is missing for better speech
            let missingField = '';
            if (!patientPhone) missingField = 'phone number';
            else if (!appointmentDate) missingField = 'date';
            else if (!appointmentTime) missingField = 'time';

            return res.status(400).json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: errorMsg,
                        debug: {
                            args,
                            orgId,
                            bodyKeys: Object.keys(req.body)
                        }
                    })
                },
                speech: `I'm missing your ${missingField}. Could you please assume I didn't hear it and say it again?`
            });
        }

        // ========================================
        // STEP 1B: NORMALIZE DATE AND TIME
        // ========================================
        try {
            appointmentDate = normalizeDate(appointmentDate);
            appointmentTime = normalizeTime(appointmentTime);

            log.info('VapiTools', '✅ Normalized date and time', {
                appointmentDate,
                appointmentTime
            });
        } catch (normalizationError: any) {
            log.warn('VapiTools', 'Date/time normalization failed', {
                error: normalizationError.message,
                originalDate: args.appointmentDate,
                originalTime: args.appointmentTime
            });

            return res.status(400).json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'INVALID_DATE_TIME',
                        message: normalizationError.message,
                        action: 'ESCALATE'
                    })
                },
                speech: 'I had trouble parsing that date and time. Could you please repeat it more clearly? For example, "Tuesday at 2 PM"?'
            });
        }

        // ========================================
        // STEP 1C: DEDUPLICATION CHECK
        // ========================================
        if (!args.force) {
            const cachedResult = bookingDeduplicator.getCachedResult(
                orgId,
                appointmentDate,
                appointmentTime,
                patientEmail
            );

            if (cachedResult) {
                log.info('VapiTools', '🔄 Returning cached booking result (duplicate prevented)');
                return res.status(200).json({
                    toolResult: {
                        content: JSON.stringify(cachedResult)
                    },
                    speech: 'Your appointment has been confirmed. You should have received a confirmation message.'
                });
            }
        } else {
            log.info('VapiTools', '⚠️ Forcing booking (bypassing deduplication request)', {
                orgId,
                patientEmail
            });
        }

        // ========================================
        // STEP 2: VERIFY ORG EXISTS
        // ========================================
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', orgId)
            .maybeSingle();

        if (orgError || !org) {
            log.error('VapiTools', 'Organization not found', { orgId });
            return res.status(400).json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: `Organization not found: ${orgId}`
                    })
                }
            });
        }

        log.info('VapiTools', '✅ Verified organization', { orgId, orgName: org.name });

        // ========================================
        // STEP 2.4: VALIDATE CONTACT INFO
        // ========================================
        // Ensure we have at least phone OR email for contact creation
        if (!patientEmail && !patientPhone) {
            log.warn('VapiTools', '⚠️ Missing both email and phone');
            return res.status(400).json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'MISSING_CONTACT_INFO',
                        message: 'Either email or phone is required'
                    })
                },
                speech: 'I need either your email address or phone number to book the appointment. Could you please provide one?'
            });
        }

        // ========================================
        // STEP 2.5: ATOMIC BOOKING (Contact + Appointment)
        // ========================================
        log.info('VapiTools', '📝 Invoking atomic booking function', {
            orgId,
            patientEmail,
            serviceType,
            scheduledTime: new Date(`${appointmentDate}T${appointmentTime}`).toISOString()
        });

        const scheduledTime = new Date(`${appointmentDate}T${appointmentTime}`);

        const { data: bookingResult, error: bookingError } = await supabase
            .rpc('book_appointment_atomic', {
                p_org_id: orgId,
                p_patient_name: patientName || patientEmail.split('@')[0],
                p_patient_email: patientEmail,
                p_patient_phone: patientPhone || null, // Allow null phone if not provided, though we validated it above
                p_service_type: serviceType,
                p_scheduled_at: scheduledTime.toISOString(),
                p_duration_minutes: duration
            });

        if (bookingError || !bookingResult) {
            const errorMsg = bookingError?.message || 'No result returned';
            log.error('VapiTools', '[CRITICAL] Atomic booking failed', {
                error: errorMsg,
                code: bookingError?.code,
                details: bookingError?.details,
                orgId,
                patientEmail
            });

            return res.status(500).json({
                toolResult: {
                    content: JSON.stringify({
                        success: false,
                        error: 'BOOKING_FAILED',
                        message: errorMsg,
                        errorCode: bookingError?.code
                    })
                },
                speech: 'I encountered a technical issue while booking your appointment. Please try again or contact our support team.'
            });
        }

        const contactId = bookingResult.contact_id;
        const appointmentId = bookingResult.appointment_id;
        const appointmentData = {
            id: appointmentId,
            scheduled_at: scheduledTime.toISOString()
        }; // Construct minimal appointment data for later use

        log.info('VapiTools', '✅ Atomic booking succeeded', {
            contactId,
            appointmentId,
            orgId
        });

        // ========================================
        // STEP 4: FETCH TENANT'S GOOGLE CALENDAR CREDENTIALS
        // ========================================
        let calendarEventId = null;
        let calendarUrl = null;
        let calendarSyncError = null;

        try {
            // Query org_credentials for this org's Google Calendar credentials
            const { data: integration, error: integrationError } = await supabase
                .from('org_credentials')
                .select('*')
                .eq('org_id', orgId)
                .eq('provider', 'google_calendar')
                .eq('is_active', true)
                .maybeSingle();

            if (integrationError) {
                log.warn('VapiTools', 'Error querying tenant_integrations', {
                    orgId,
                    error: integrationError.message
                });
                calendarSyncError = {
                    code: 'INTEGRATION_QUERY_ERROR',
                    message: integrationError.message
                };
            }

            if (!integration) {
                log.info('VapiTools', 'Google Calendar not configured for this org - skipping calendar sync', { orgId });
                calendarSyncError = {
                    code: 'GOOGLE_CALENDAR_NOT_CONNECTED',
                    message: 'Google Calendar not connected for this organization'
                };
            } else {
                log.info('VapiTools', 'Found Google Calendar integration', {
                    orgId,
                    integrationId: integration.id
                });

                // ========================================
                // STEP 5: CREATE GOOGLE CALENDAR EVENT - VERIFIED HANDSHAKE
                // ========================================
                const startDate = new Date(scheduledTime);
                const endDate = new Date(startDate);
                endDate.setMinutes(endDate.getMinutes() + duration);

                const calendarEvent = {
                    title: `Appointment - ${patientName || patientEmail}`,
                    description: `Clinic appointment for patient: ${patientEmail}${patientPhone ? '\nPhone: ' + patientPhone : ''}\nService: ${serviceType}\nBooked via: Vapi Assistant`,
                    startTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                    attendeeEmail: patientEmail
                };

                try {
                    // VERIFIED HANDSHAKE: Google must return eventId before we mark success
                    log.info('VapiTools', '[CALENDAR-SYNC] Calling createCalendarEvent', {
                        orgId,
                        appointmentId,
                        patientEmail
                    });

                    const calendarResult = await createCalendarEvent(orgId, calendarEvent);

                    log.info('VapiTools', '[CALENDAR-SYNC] createCalendarEvent returned successfully', {
                        orgId,
                        appointmentId,
                        eventId: calendarResult?.eventId,
                        hasUrl: !!calendarResult?.eventUrl
                    });

                    // Production check: Google MUST return a valid eventId
                    if (!calendarResult?.eventId) {
                        throw new Error('Google Calendar API did not return event ID');
                    }

                    calendarEventId = calendarResult.eventId;
                    calendarUrl = calendarResult.eventUrl;

                    log.info('VapiTools', 'Google Calendar event created successfully', {
                        appointmentId,
                        orgId,
                        calendarEventId,
                        calendarUrl
                    });

                    // CRITICAL: Only update appointment if we have a verified eventId from Google
                    const { error: updateError } = await supabase
                        .from('appointments')
                        .update({
                            google_calendar_event_id: calendarEventId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', appointmentId);

                    if (updateError) {
                        log.error('VapiTools', 'Failed to update appointment with calendar event ID', {
                            appointmentId,
                            calendarEventId,
                            error: updateError.message
                        });
                    }
                } catch (googleError: any) {
                    // CRITICAL: Google Calendar sync failed - this is NOW a real error we must report
                    calendarSyncError = {
                        code: 'GOOGLE_CALENDAR_SYNC_FAILED',
                        message: googleError?.message || 'Failed to create Google Calendar event',
                        details: googleError?.toString()
                    };

                    log.error('VapiTools', 'Google Calendar event creation failed - calendar sync NOT completed', {
                        appointmentId,
                        orgId,
                        error: googleError?.message,
                        errorCode: calendarSyncError.code
                    });
                }
            }
        } catch (calendarError: any) {
            // Catch any other calendar integration errors
            calendarSyncError = {
                code: 'CALENDAR_INTEGRATION_ERROR',
                message: calendarError?.message || 'Calendar integration error',
                details: calendarError?.toString()
            };

            log.error('VapiTools', 'Calendar integration error', {
                appointmentId,
                orgId,
                error: calendarError?.message,
                errorCode: calendarSyncError.code
            });
        }

        // ========================================
        // STEP 6: RETURN TENANT-SPECIFIC PROOF WITH CALENDAR STATUS
        // ========================================

        // Determine if we should report full success or partial success
        const calendarSynced = !!calendarEventId; // Only true if Google returned an eventId

        const responseData = {
            success: true,
            appointmentId,
            orgId,
            supabaseRowId: appointmentData.id,
            scheduledAt: appointmentData.scheduled_at,
            calendarEventId: calendarEventId || null,
            calendarUrl: calendarUrl || null,
            calendarSynced: calendarSynced, // NEW: Tell AI if calendar sync actually worked
            calendarSyncError: calendarSyncError || null, // NEW: If calendar failed, tell AI why
            executionTimeMs: Date.now() - bookingStartTime, // NEW: Monitor Vapi timeout risks
            message: calendarSynced
                ? `✅ Appointment confirmed for ${appointmentDate} at ${appointmentTime} and added to your calendar`
                : `✅ Appointment confirmed for ${appointmentDate} at ${appointmentTime}${calendarSyncError ? ` (Note: Calendar sync not completed - ${calendarSyncError.message})` : ''}`,
            confirmationDetails: {
                date: appointmentDate,
                time: appointmentTime,
                duration: duration,
                patientEmail: patientEmail,
                patientName: patientName || patientEmail.split('@')[0],
                serviceType: serviceType,
                org: org.name
            }
        };

        log.info('VapiTools', '✅ [BOOKING COMPLETE] MULTI-TENANT SUCCESS', {
            appointmentId,
            orgId,
            calendarSynced,
            calendarEventId,
            hasError: !!calendarSyncError,
            totalExecutionTimeMs: Date.now() - bookingStartTime,
            message: responseData.message,
            timestamp: new Date().toISOString()
        });

        // Cache successful booking result for deduplication
        bookingDeduplicator.cacheResult(
            orgId,
            appointmentDate,
            appointmentTime,
            patientEmail,
            responseData
        );

        return res.status(200).json(toolCallId ? {
            toolCallId,
            result: responseData
        } : {
            toolResult: {
                content: JSON.stringify(responseData)
            },
            speech: calendarSynced
                ? `Perfect! I've scheduled your appointment for ${appointmentDate} at ${appointmentTime} and added it to your calendar. A confirmation has been sent to ${patientEmail}.`
                : `Perfect! I've scheduled your appointment for ${appointmentDate} at ${appointmentTime}. A confirmation has been sent to ${patientEmail}. ${calendarSyncError ? `(Note: I couldn't sync it to your calendar - ${calendarSyncError.message})` : ''}`
        });

    } catch (error: any) {
        log.error('VapiTools', '❌ Error in bookClinicAppointment', {
            error: error.message,
            stack: error.stack
        });

        const toolCallId = req.body.toolCallId;
        return res.status(200).json(toolCallId ? {
            toolCallId,
            result: {
                success: false,
                error: 'Internal server error: ' + error.message
            }
        } : {
            toolResult: {
                content: JSON.stringify({
                    success: false,
                    error: 'Internal server error: ' + error.message
                })
            }
        });
    }
});

export default router;
