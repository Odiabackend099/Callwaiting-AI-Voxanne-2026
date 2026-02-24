/**
 * vapi-sync.ts — Proxy module for ensureAssistantSynced
 *
 * This file re-exports `ensureAssistantSynced` from the founder-console-v2 route
 * using a lazy require to avoid the circular dependency that would occur at
 * module load time:
 *   founder-console-v2 → agent-config-transaction → vapi-sync → founder-console-v2
 *
 * By deferring the require() to inside the function body, Node.js resolves it
 * at call time (when both modules are fully loaded), not at startup.
 */

export async function ensureAssistantSynced(
  agentId: string,
  vapiApiKey: string,
  importedPhoneNumberId?: string
): Promise<{ assistantId: string; toolsSynced: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../routes/founder-console-v2') as {
    ensureAssistantSynced: (
      agentId: string,
      vapiApiKey: string,
      importedPhoneNumberId?: string
    ) => Promise<{ assistantId: string; toolsSynced: boolean }>;
  };
  return route.ensureAssistantSynced(agentId, vapiApiKey, importedPhoneNumberId);
}
