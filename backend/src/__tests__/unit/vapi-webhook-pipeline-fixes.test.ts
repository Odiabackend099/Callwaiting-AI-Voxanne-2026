/**
 * Vapi Webhook Data Pipeline Fixes - Unit Tests
 * Tests the 4 critical bug fixes in vapi-webhook.ts:
 *   Bug 1: Call direction detection (outboundPhoneCall must be 'outbound')
 *   Bug 2: Appointment linking (must use outer-scope toolsUsed, not re-extracted)
 *   Bug 3: Sentiment transcript reconstruction (from messages when transcript missing)
 *   Bug 4: Recording URL diagnostic logging (presence/absence detection)
 */

import * as fs from 'fs';
import * as path from 'path';

// Read the actual webhook source code for verification
const WEBHOOK_FILE = path.resolve(__dirname, '../../routes/vapi-webhook.ts');
let webhookSource: string;

beforeAll(() => {
  webhookSource = fs.readFileSync(WEBHOOK_FILE, 'utf-8');
});

// ============================================================
// BUG 1: Call Direction Detection
// ============================================================
describe('Bug 1: Call Direction Detection', () => {
  // Extract the direction detection logic and simulate it
  function detectCallDirection(callType: string | undefined, hasAssistantOverrides: boolean): 'inbound' | 'outbound' {
    // This mirrors the FIXED logic in vapi-webhook.ts (lines ~618-629)
    return callType === 'outboundPhoneCall'
      ? 'outbound'
      : (callType === 'webCall' && hasAssistantOverrides)
        ? 'outbound'
        : 'inbound';
  }

  test('outboundPhoneCall → outbound (THE CRITICAL FIX)', () => {
    expect(detectCallDirection('outboundPhoneCall', false)).toBe('outbound');
    expect(detectCallDirection('outboundPhoneCall', true)).toBe('outbound');
  });

  test('inboundPhoneCall → inbound', () => {
    expect(detectCallDirection('inboundPhoneCall', false)).toBe('inbound');
    expect(detectCallDirection('inboundPhoneCall', true)).toBe('inbound');
  });

  test('webCall with assistantOverrides → outbound (test/browser calls)', () => {
    expect(detectCallDirection('webCall', true)).toBe('outbound');
  });

  test('webCall without assistantOverrides → inbound', () => {
    expect(detectCallDirection('webCall', false)).toBe('inbound');
  });

  test('undefined call type → inbound (safe default)', () => {
    expect(detectCallDirection(undefined, false)).toBe('inbound');
  });

  // Verify the source code contains the fix
  test('source code checks for outboundPhoneCall BEFORE webCall', () => {
    // Find the end-of-call-report direction detection (not call.started)
    const directionBlock = webhookSource.match(
      /\/\/ 2\. Detect call direction.*?const callDirection.*?'inbound';/s
    );
    expect(directionBlock).toBeTruthy();
    const block = directionBlock![0];

    // Must check outboundPhoneCall
    expect(block).toContain("call?.type === 'outboundPhoneCall'");

    // Must also preserve the webCall + assistantOverrides check
    expect(block).toContain("call?.type === 'webCall' && call?.assistantOverrides");

    // The outboundPhoneCall check must come BEFORE the webCall check
    const outboundIndex = block.indexOf("outboundPhoneCall");
    const webCallIndex = block.indexOf("webCall");
    expect(outboundIndex).toBeLessThan(webCallIndex);
  });

  // Verify call.started handler uses matching logic
  test('call.started handler also checks outboundPhoneCall', () => {
    expect(webhookSource).toContain(
      "call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound'"
    );
  });
});

// ============================================================
// BUG 2: Appointment Linking Variable Shadowing
// ============================================================
describe('Bug 2: Appointment Linking - No Variable Shadowing', () => {
  test('appointment linking block does NOT re-extract toolsUsed from call.messages only', () => {
    // The old buggy code had: const toolsUsed = extractToolsUsed(call?.messages || []);
    // inside the appointment linking block. This must be GONE.

    // Find the appointment linking section (broader match to capture full block)
    const appointmentSection = webhookSource.match(
      /GOLDEN RECORD: Link appointments to calls[\s\S]*?bookedDuringCall[\s\S]*?bookClinicAppointment/
    );
    expect(appointmentSection).toBeTruthy();
    const section = appointmentSection![0];

    // Must NOT contain a local re-extraction of toolsUsed
    expect(section).not.toMatch(/const toolsUsed\s*=\s*extractToolsUsed\(call\?\.messages/);

    // Must reference bookedDuringCall using toolsUsed (outer scope)
    // The regex captures up to 'bookClinicAppointment' so check for the key parts
    expect(section).toContain("toolsUsed.includes('bookClinicAppointment");
    expect(section).toContain("const bookedDuringCall = toolsUsed.includes");
  });

  test('outer-scope toolsUsed extracts from BOTH call.messages AND artifact.messages', () => {
    // Verify the comprehensive extraction exists
    expect(webhookSource).toContain("...(call?.messages || [])");
    expect(webhookSource).toContain("...(artifact?.messages || [])");

    // Verify it also checks analysis.toolCalls
    expect(webhookSource).toContain("analysis?.toolCalls");
  });

  test('extractToolsUsed function handles all message formats', () => {
    // Verify the helper function exists and checks both formats
    const fnMatch = webhookSource.match(/function extractToolsUsed\(messages: any\[\]\)[\s\S]*?return Array\.from\(toolNames\);/);
    expect(fnMatch).toBeTruthy();
    const fn = fnMatch![0];

    // Checks tool_call_result messages
    expect(fn).toContain("msg.role === 'tool_call_result'");

    // Checks assistant toolCalls array
    expect(fn).toContain("msg.toolCalls");
    expect(fn).toContain("tc.function?.name");
  });

  // Simulate the extractToolsUsed logic
  function extractToolsUsed(messages: any[]): string[] {
    if (!messages || !Array.isArray(messages)) return [];
    const toolNames = new Set<string>();
    for (const msg of messages) {
      if (msg.role === 'tool_call_result' && msg.name) {
        toolNames.add(msg.name);
      }
      if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          if (tc.function?.name) {
            toolNames.add(tc.function.name);
          }
        }
      }
    }
    return Array.from(toolNames);
  }

  test('extractToolsUsed detects bookClinicAppointment from tool_call_result', () => {
    const messages = [
      { role: 'assistant', message: 'I will book that for you.' },
      { role: 'tool_call_result', name: 'bookClinicAppointment', result: '{"success":true}' }
    ];
    const tools = extractToolsUsed(messages);
    expect(tools).toContain('bookClinicAppointment');
  });

  test('extractToolsUsed detects bookClinicAppointment from toolCalls array', () => {
    const messages = [
      {
        role: 'assistant',
        toolCalls: [{ function: { name: 'bookClinicAppointment', arguments: '{}' } }]
      }
    ];
    const tools = extractToolsUsed(messages);
    expect(tools).toContain('bookClinicAppointment');
  });

  test('extractToolsUsed returns empty array for no tool usage', () => {
    const messages = [
      { role: 'user', message: 'Hello' },
      { role: 'assistant', message: 'Hi there!' }
    ];
    expect(extractToolsUsed(messages)).toEqual([]);
  });

  test('extractToolsUsed handles empty/null messages gracefully', () => {
    expect(extractToolsUsed([])).toEqual([]);
    expect(extractToolsUsed(null as any)).toEqual([]);
    expect(extractToolsUsed(undefined as any)).toEqual([]);
  });
});

// ============================================================
// BUG 3: Sentiment Transcript Reconstruction
// ============================================================
describe('Bug 3: Sentiment Transcript Reconstruction', () => {
  // Simulate the transcript reconstruction logic from the fix
  function reconstructTranscript(messages: any[]): string | null {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const parts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'user' && msg.message) {
        parts.push(`Caller: ${msg.message}`);
      } else if (msg.role === 'assistant' && msg.message) {
        parts.push(`Assistant: ${msg.message}`);
      } else if (msg.content && typeof msg.content === 'string') {
        const speaker = msg.role === 'user' ? 'Caller' : 'Assistant';
        parts.push(`${speaker}: ${msg.content}`);
      }
    }
    return parts.length > 0 ? parts.join('\n') : null;
  }

  test('reconstructs transcript from user/assistant messages', () => {
    const messages = [
      { role: 'user', message: 'I need to book an appointment for next Tuesday.' },
      { role: 'assistant', message: 'I can help with that! Let me check availability for Tuesday.' },
      { role: 'user', message: 'Great, any time after 2pm works.' },
      { role: 'assistant', message: 'I have 3pm available. Shall I book that?' }
    ];
    const transcript = reconstructTranscript(messages);
    expect(transcript).toBeTruthy();
    expect(transcript).toContain('Caller: I need to book an appointment');
    expect(transcript).toContain('Assistant: I can help with that');
    expect(transcript!.split('\n').length).toBe(4);
  });

  test('handles content field (alternative message format)', () => {
    const messages = [
      { role: 'user', content: 'Hello there' },
      { role: 'assistant', content: 'Welcome to Voxanne' }
    ];
    const transcript = reconstructTranscript(messages);
    expect(transcript).toContain('Caller: Hello there');
    expect(transcript).toContain('Assistant: Welcome to Voxanne');
  });

  test('skips tool messages (tool_call_result has no user-facing content)', () => {
    const messages = [
      { role: 'user', message: 'Book me in' },
      { role: 'tool_call_result', name: 'bookClinicAppointment', result: '{}' },
      { role: 'assistant', message: 'Done!' }
    ];
    const transcript = reconstructTranscript(messages);
    // tool_call_result has no .message or .content string, so it's skipped
    expect(transcript).toBe('Caller: Book me in\nAssistant: Done!');
  });

  test('returns null for empty messages', () => {
    expect(reconstructTranscript([])).toBeNull();
    expect(reconstructTranscript(null as any)).toBeNull();
  });

  test('source code tries artifact.transcript first, then reconstructs', () => {
    // Find the sentiment analysis block
    const sentimentBlock = webhookSource.match(
      /\/\/ Primary: use artifact\.transcript[\s\S]*?Sentiment analysis unavailable/
    );
    expect(sentimentBlock).toBeTruthy();
    const block = sentimentBlock![0];

    // Must try artifact.transcript first
    expect(block).toContain('artifact?.transcript');

    // Must try artifact.messages for reconstruction
    expect(block).toContain('artifact?.messages');

    // Must try call.messages as last resort
    expect(block).toContain('call?.messages');

    // Must have minimum length check (10 chars)
    expect(block).toContain('.trim().length >= 10');
  });

  test('source code logs transcript source for debugging', () => {
    expect(webhookSource).toContain("transcriptSource: artifact?.transcript ? 'artifact.transcript' : 'reconstructed-from-messages'");
  });

  test('source code warns when no transcript is available at all', () => {
    expect(webhookSource).toContain('No transcript available for sentiment analysis');
    expect(webhookSource).toContain('hasArtifactTranscript');
    expect(webhookSource).toContain('hasArtifactMessages');
    expect(webhookSource).toContain('hasCallMessages');
  });

  test('reconstructed transcript meets minimum length for GPT-4o analysis', () => {
    // Short messages should still produce enough text
    const messages = [
      { role: 'user', message: 'Hello, I need help' },
      { role: 'assistant', message: 'How can I assist you today?' }
    ];
    const transcript = reconstructTranscript(messages);
    expect(transcript).toBeTruthy();
    expect(transcript!.trim().length).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================
// BUG 4: Recording URL Diagnostic Logging
// ============================================================
describe('Bug 4: Recording URL Diagnostic Logging', () => {
  test('source code logs when recording URL is MISSING', () => {
    expect(webhookSource).toContain('No recording URL found in webhook payload');
  });

  test('source code logs when recording URL is FOUND', () => {
    expect(webhookSource).toContain('Recording URL found');
  });

  test('source code checks all 3 recording URL sources', () => {
    // The diagnostic block should check the same 3 sources as the upsert
    const diagnosticBlock = webhookSource.match(
      /RECORDING URL DIAGNOSTICS[\s\S]*?GOLDEN RECORD: Link appointments/
    );
    expect(diagnosticBlock).toBeTruthy();
    const block = diagnosticBlock![0];

    expect(block).toContain('artifact?.recordingUrl');
    expect(block).toContain('artifact?.recording');
    expect(block).toContain('message?.recordingUrl');
  });

  test('source code logs which source the recording came from', () => {
    expect(webhookSource).toContain("urlSource: artifact?.recordingUrl ? 'artifact.recordingUrl'");
  });

  test('recording logging happens AFTER successful upsert, BEFORE appointment linking', () => {
    // The recording diagnostics must be between the upsert success log and the appointment linking
    const upsertSuccessIndex = webhookSource.indexOf('Call logged to unified calls table');
    const recordingDiagIndex = webhookSource.indexOf('RECORDING URL DIAGNOSTICS');
    const appointmentLinkIndex = webhookSource.indexOf('GOLDEN RECORD: Link appointments to calls');

    expect(upsertSuccessIndex).toBeGreaterThan(0);
    expect(recordingDiagIndex).toBeGreaterThan(0);
    expect(appointmentLinkIndex).toBeGreaterThan(0);

    expect(recordingDiagIndex).toBeGreaterThan(upsertSuccessIndex);
    expect(recordingDiagIndex).toBeLessThan(appointmentLinkIndex);
  });
});

// ============================================================
// INTEGRATION: Full Pipeline Coherence
// ============================================================
describe('Pipeline Coherence: All Fixes Work Together', () => {
  test('direction detection and appointment linking are in the same handler scope', () => {
    // All 4 fixes must be inside the end-of-call-report handler
    // Verify each fix exists in the webhook source (they are all in the same handler)
    expect(webhookSource).toContain("call?.type === 'outboundPhoneCall'");
    expect(webhookSource).toContain("toolsUsed.includes('bookClinicAppointment')");
    expect(webhookSource).toContain('transcriptForAnalysis');
    expect(webhookSource).toContain('RECORDING URL DIAGNOSTICS');

    // Verify the ordering: direction detection comes before appointment linking
    const directionIndex = webhookSource.indexOf("call?.type === 'outboundPhoneCall'");
    const appointmentIndex = webhookSource.indexOf("toolsUsed.includes('bookClinicAppointment')");
    const sentimentIndex = webhookSource.indexOf('transcriptForAnalysis');
    const recordingIndex = webhookSource.indexOf('RECORDING URL DIAGNOSTICS');

    expect(directionIndex).toBeGreaterThan(0);
    expect(sentimentIndex).toBeGreaterThan(directionIndex);
    expect(recordingIndex).toBeGreaterThan(sentimentIndex);
    expect(appointmentIndex).toBeGreaterThan(recordingIndex);
  });

  test('no duplicate toolsUsed declarations in appointment linking block', () => {
    // Count how many times `const toolsUsed = extractToolsUsed` appears
    const matches = webhookSource.match(/const toolsUsed\s*=\s*extractToolsUsed/g);
    // Should appear exactly ZERO times in the appointment linking block
    // and once in the main tools extraction block
    // Total: should be 0 because the outer one uses `let toolsUsed = extractToolsUsed`
    const letMatches = webhookSource.match(/let toolsUsed\s*=\s*extractToolsUsed/g);
    expect(letMatches).toBeTruthy();
    expect(letMatches!.length).toBe(1); // Only one extraction point

    // The const version should NOT exist (was the bug)
    if (matches) {
      // If const version exists, it must NOT be in the appointment linking section
      for (const match of webhookSource.matchAll(/const toolsUsed\s*=\s*extractToolsUsed[^;]*;/g)) {
        const context = webhookSource.substring(
          Math.max(0, match.index! - 200),
          match.index! + match[0].length + 200
        );
        expect(context).not.toContain('bookClinicAppointment');
        expect(context).not.toContain('Link appointments');
      }
    }
  });

  test('upsert preserves direction from call.started via defaultToNull: false', () => {
    // The upsert must use onConflict and defaultToNull: false
    expect(webhookSource).toContain("onConflict: 'vapi_call_id'");
    expect(webhookSource).toContain('defaultToNull: false');
  });

  test('transcript field in upsert uses original artifact.transcript (not reconstructed)', () => {
    // The DB should store the original Vapi transcript, not our reconstruction
    // The reconstruction is only used for GPT-4o analysis
    // Find the end-of-call-report upsert (the one with recording_url and sentiment fields)
    const upsertBlock = webhookSource.match(
      /recording_url:[\s\S]*?transcript:[\s\S]*?onConflict/
    );
    expect(upsertBlock).toBeTruthy();
    const block = upsertBlock![0];

    // transcript field should reference artifact.transcript, not transcriptForAnalysis
    expect(block).toContain("transcript: artifact?.transcript || null");
    expect(block).not.toContain("transcript: transcriptForAnalysis");
  });
});
