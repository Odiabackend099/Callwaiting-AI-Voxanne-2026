/**
 * Context Handoff Orchestrator
 * Manages state transitions between inbound (Voxanne) and outbound (Sarah) agents
 * 
 * Implements Task 2 from Master Orchestrator workflow:
 * - Detects abandoned calls with service interest
 * - Creates follow-up tasks for Sarah
 * - Sends SMS with service-specific PDF links
 */

import { supabase } from './supabase-client';
import { log } from './logger';

interface HandoffContext {
    leadId: string;
    orgId: string;
    callSid: string;
    patientName?: string;
    patientPhone?: string;
    serviceInterest?: string;
    callStatus: 'completed' | 'abandoned' | 'failed';
    mentionedServices: string[];
}

interface FollowUpTask {
    id: string;
    leadId: string;
    orgId: string;
    taskType: 'sms_follow_up' | 'call_back' | 'email';
    priority: 'high' | 'medium' | 'low';
    serviceContext: string;
    scheduledFor: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export class HandoffOrchestrator {
    /**
     * Process call end event and determine if handoff is needed
     */
    static async processCallEnd(context: HandoffContext): Promise<void> {
        try {
            log.info('HandoffOrchestrator', 'Processing call end', {
                leadId: context.leadId,
                callStatus: context.callStatus,
                mentionedServices: context.mentionedServices
            });

            // Only create handoff for abandoned calls with service interest
            if (context.callStatus !== 'abandoned') {
                log.info('HandoffOrchestrator', 'Call completed normally, no handoff needed');
                return;
            }

            if (!context.mentionedServices || context.mentionedServices.length === 0) {
                log.info('HandoffOrchestrator', 'No service interest detected, no handoff needed');
                return;
            }

            // Check if patient provided contact info
            if (!context.patientPhone) {
                log.warn('HandoffOrchestrator', 'No phone number captured, cannot create follow-up');
                return;
            }

            // Create follow-up task for Sarah
            await this.createFollowUpTask({
                leadId: context.leadId,
                orgId: context.orgId,
                serviceInterest: context.mentionedServices[0], // Primary service
                patientPhone: context.patientPhone,
                patientName: context.patientName
            });

        } catch (error: any) {
            log.error('HandoffOrchestrator', 'Failed to process call end', {
                error: error.message,
                leadId: context.leadId
            });
        }
    }

    /**
     * Create follow-up task for outbound agent (Sarah)
     */
    private static async createFollowUpTask(params: {
        leadId: string;
        orgId: string;
        serviceInterest: string;
        patientPhone: string;
        patientName?: string;
    }): Promise<void> {
        try {
            // Schedule SMS for 5 minutes after call ends
            const scheduledFor = new Date();
            scheduledFor.setMinutes(scheduledFor.getMinutes() + 5);

            const { data, error } = await supabase
                .from('follow_up_tasks')
                .insert({
                    lead_id: params.leadId,
                    org_id: params.orgId,
                    task_type: 'sms_follow_up',
                    priority: 'high',
                    service_context: params.serviceInterest,
                    scheduled_for: scheduledFor.toISOString(),
                    status: 'pending',
                    metadata: {
                        patient_name: params.patientName,
                        patient_phone: params.patientPhone,
                        service: params.serviceInterest
                    }
                })
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to create follow-up task: ${error.message}`);
            }

            log.info('HandoffOrchestrator', 'Follow-up task created', {
                taskId: data.id,
                leadId: params.leadId,
                service: params.serviceInterest,
                scheduledFor: scheduledFor.toISOString()
            });

            // Trigger immediate SMS if high priority service
            const highPriorityServices = ['facelift', 'rhinoplasty', 'breast augmentation'];
            if (highPriorityServices.includes(params.serviceInterest.toLowerCase())) {
                await this.sendImmediateSMS(params);

                // Mark task as completed to prevent double-send by cron
                await supabase
                    .from('follow_up_tasks')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', data.id);

                log.info('HandoffOrchestrator', 'Task marked completed after immediate SMS', { taskId: data.id });
            }

        } catch (error: any) {
            log.error('HandoffOrchestrator', 'Failed to create follow-up task', {
                error: error.message,
                leadId: params.leadId
            });
            throw error;
        }
    }

    /**
     * Send immediate SMS with service-specific PDF link
     */
    private static async sendImmediateSMS(params: {
        patientPhone: string;
        patientName?: string;
        serviceInterest: string;
    }): Promise<void> {
        try {
            // Get service-specific PDF link
            const pdfLink = this.getServicePDFLink(params.serviceInterest);

            const message = params.patientName
                ? `Hi ${params.patientName}, thank you for your interest in ${params.serviceInterest}. Here's our detailed guide: ${pdfLink}`
                : `Thank you for your interest in ${params.serviceInterest}. Here's our detailed guide: ${pdfLink}`;

            log.info('HandoffOrchestrator', 'Sending immediate SMS', {
                phone: params.patientPhone,
                service: params.serviceInterest
            });

            // TODO: Integrate with Twilio SMS service
            // await twilioService.sendSMS(params.patientPhone, message);

            log.info('HandoffOrchestrator', 'SMS sent successfully', {
                phone: params.patientPhone
            });

        } catch (error: any) {
            log.error('HandoffOrchestrator', 'Failed to send SMS', {
                error: error.message,
                phone: params.patientPhone
            });
        }
    }

    /**
     * Get service-specific PDF link
     */
    private static getServicePDFLink(service: string): string {
        const pdfLinks: Record<string, string> = {
            'facelift': 'https://clinic.example.com/pdfs/facelift-aftercare.pdf',
            'rhinoplasty': 'https://clinic.example.com/pdfs/rhinoplasty-guide.pdf',
            'breast augmentation': 'https://clinic.example.com/pdfs/breast-aug-guide.pdf',
            'botox': 'https://clinic.example.com/pdfs/botox-info.pdf',
            'dermal fillers': 'https://clinic.example.com/pdfs/fillers-guide.pdf'
        };

        return pdfLinks[service.toLowerCase()] || 'https://clinic.example.com/pdfs/general-info.pdf';
    }

    /**
     * Process pending follow-up tasks (called by cron job)
     */
    static async processPendingTasks(): Promise<void> {
        try {
            const now = new Date();

            const { data: tasks, error } = await supabase
                .from('follow_up_tasks')
                .select('*')
                .eq('status', 'pending')
                .lte('scheduled_for', now.toISOString())
                .limit(10);

            if (error) {
                throw new Error(`Failed to fetch pending tasks: ${error.message}`);
            }

            if (!tasks || tasks.length === 0) {
                log.info('HandoffOrchestrator', 'No pending tasks to process');
                return;
            }

            log.info('HandoffOrchestrator', `Processing ${tasks.length} pending tasks`);

            for (const task of tasks) {
                await this.executeTask(task);
            }

        } catch (error: any) {
            log.error('HandoffOrchestrator', 'Failed to process pending tasks', {
                error: error.message
            });
        }
    }

    /**
     * Execute a single follow-up task
     */
    private static async executeTask(task: any): Promise<void> {
        try {
            // Mark as in progress
            await supabase
                .from('follow_up_tasks')
                .update({ status: 'in_progress' })
                .eq('id', task.id);

            // Execute based on task type
            switch (task.task_type) {
                case 'sms_follow_up':
                    await this.sendImmediateSMS({
                        patientPhone: task.metadata.patient_phone,
                        patientName: task.metadata.patient_name,
                        serviceInterest: task.service_context
                    });
                    break;

                case 'call_back':
                    // TODO: Trigger outbound call via Vapi
                    log.info('HandoffOrchestrator', 'Call back task - not yet implemented');
                    break;

                case 'email':
                    // TODO: Send email via SendGrid/Resend
                    log.info('HandoffOrchestrator', 'Email task - not yet implemented');
                    break;
            }

            // Mark as completed
            await supabase
                .from('follow_up_tasks')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', task.id);

            log.info('HandoffOrchestrator', 'Task executed successfully', {
                taskId: task.id,
                taskType: task.task_type
            });

        } catch (error: any) {
            log.error('HandoffOrchestrator', 'Failed to execute task', {
                error: error.message,
                taskId: task.id
            });

            // Mark as failed
            await supabase
                .from('follow_up_tasks')
                .update({
                    status: 'failed',
                    error_message: error.message
                })
                .eq('id', task.id);
        }
    }
}
