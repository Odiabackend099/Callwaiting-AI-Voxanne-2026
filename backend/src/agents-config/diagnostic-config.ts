import Anthropic from "@anthropic-ai/sdk";

export interface DiagnosticAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

/**
 * Creates the diagnostic agent configuration
 * This agent is specialized in troubleshooting backend issues
 */
export function createDiagnosticConfig(): DiagnosticAgentConfig {
  return {
    name: "diagnostic-agent",
    description:
      "Troubleshoots backend issues including 500 errors, API connectivity, and database problems",
    systemPrompt: `You are an expert diagnostic agent specialized in troubleshooting backend issues for the Call Waiting AI Voice AI platform.

**Your Core Responsibilities:**
1. Analyze error logs and stack traces to identify root causes
2. Check API connectivity and endpoint health to pinpoint failures
3. Query the database to verify data integrity and configuration
4. Run safe diagnostic commands to inspecting system state
5. Provide actionable remediation steps with verification instructions

**Analysis Process:**
1. **Symptom Analysis**: detailed understanding of what is failing, when, and how
2. **Health Check**: verify status of critical endpoints (/health, /api/*, /ws/*)
3. **Log Investigation**: analyze application, system, and database logs for errors
4. **State Verification**: query database to confirm expected configuration (API keys, user state)
5. **Root Cause Isolation**: synthezise findings to potential causes
6. **Remediation Plan**: specific steps to fix the issue
7. **Verification**: how to confirm the fix works

**Critical Checkpoints:**
- **Auth**: Vapi API keys, Supabase credentials, JWT tokens
- **Connectivity**: WebSocket ports, database connections, external APIs
- **Data**: Agent configuration, lead records, call logs
- **Resources**: Memory usage, disk space, process status

**Quality Standards:**
- **Evidence-Based**: always back conclusions with log snippets or test results
- **Specific**: avoid vague suggestions; give exact commands or code changes
- **Safe**: never suggest destructive commands (rm -rf, DROP TABLE) without extreme caution
- **Complete**: handled both the immediate fix and prevention of recurrence

**Output Format:**
Provide your diagnosis in this structure:
## 🔍 Diagnosis
[Summary of findings]

## 🚨 Root Cause
[Detailed explanation of what caused the issue]

## 🛠️ Remediation Steps
1. [Step 1]
2. [Step 2]

## ✅ Verification
[How to text that it is fixed]

**Edge Cases:**
- If logs are empty: check if logging is enabled or if the service is running
- If database is unreachable: check network/VPN and credentials
- If issue is intermittent: suggest monitoring or stress testing
- If root cause is unclear: provide hypothesis and further diagnostic steps`,
    tools: [
      {
        name: "bash_execute",
        description: "Execute bash commands safely for diagnostics",
        input_schema: {
          type: "object" as const,
          properties: {
            command: {
              type: "string",
              description:
                "Bash command to execute (read-only diagnostic commands only)",
            },
            context: {
              type: "string",
              description: "What you're trying to diagnose with this command",
            },
          },
          required: ["command", "context"],
        },
      },
      {
        name: "query_database",
        description:
          "Query the database for debugging information (read-only)",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description: "Description of what you want to query",
            },
            table: {
              type: "string",
              enum: [
                "integrations",
                "agents",
                "leads",
                "call_logs",
                "call_tracking",
                "campaigns",
                "webhooks",
                "call_transcripts",
              ],
              description: "Database table to query",
            },
            filters: {
              type: "object",
              description: "Filter conditions (e.g., {provider: 'vapi'})",
            },
          },
          required: ["query", "table"],
        },
      },
      {
        name: "check_api_health",
        description:
          "Check health and connectivity of API endpoints",
        input_schema: {
          type: "object" as const,
          properties: {
            endpoint: {
              type: "string",
              description:
                "API endpoint to check (localhost, render.com, or internal domains)",
            },
            context: {
              type: "string",
              description: "What you're checking and why",
            },
            timeout: {
              type: "number",
              description: "Timeout in seconds (default 5)",
            },
          },
          required: ["endpoint", "context"],
        },
      },
      {
        name: "read_error_logs",
        description: "Read and analyze error logs",
        input_schema: {
          type: "object" as const,
          properties: {
            logType: {
              type: "string",
              enum: ["app", "backend", "error", "nginx", "system", "database"],
              description: "Type of log to read",
            },
            lines: {
              type: "number",
              description: "Number of recent lines to read (default 50, max 500)",
            },
            filter: {
              type: "string",
              description:
                "Optional grep filter pattern (e.g., 'error', '500', 'timeout')",
            },
            context: {
              type: "string",
              description: "What you're looking for in the logs",
            },
          },
          required: ["logType", "context"],
        },
      },
    ],
  };
}
