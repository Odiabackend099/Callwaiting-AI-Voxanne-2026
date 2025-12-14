import { z } from 'zod';

export const agentConfigSchema = z.object({
  vapi: z.object({
    publicKey: z.string().min(1),
    secretKey: z.string().min(1)
  }).passthrough(),
  twilio: z.object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1)
  }).passthrough(),
  testing: z.object({
    testDestinationNumber: z.string().min(1).optional()
  }).passthrough().optional()
}).passthrough();

// Partial updates supported - all fields optional, but at least one required
export const agentBehaviorSchema = z.object({
  systemPrompt: z.string().min(1).optional(),
  firstMessage: z.string().min(1).optional(),
  voiceId: z.string().min(1).optional(),
  maxDurationSeconds: z.number().int().min(60).optional()
}).refine(
  (data) => data.systemPrompt || data.firstMessage || data.voiceId || data.maxDurationSeconds !== undefined,
  { message: 'At least one field must be provided' }
);

export const agentTestCallSchema = z.object({
  testDestinationNumber: z.string().min(1).optional()
}).passthrough();

// Schema for call creation request
export const createCallSchema = z.object({
    leadId: z.string().uuid()
});

export type AgentConfigRequest = z.infer<typeof agentConfigSchema>;
export type AgentBehaviorRequest = z.infer<typeof agentBehaviorSchema>;
export type AgentTestCallRequest = z.infer<typeof agentTestCallSchema>;
export type CreateCallRequest = z.infer<typeof createCallSchema>;
