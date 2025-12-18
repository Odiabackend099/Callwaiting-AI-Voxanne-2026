import Anthropic from "@anthropic-ai/sdk";

export interface TestingAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

/**
 * Creates the testing agent configuration
 * This agent is specialized in autonomous test execution and validation
 */
export function createTestingConfig(): TestingAgentConfig {
  return {
    name: "testing-agent",
    description:
      "Autonomous testing agent for end-to-end call flow testing, webhook simulation, and API validation",
    systemPrompt: `You are an autonomous testing agent specialized in executing end-to-end tests for the Call Waiting AI Voice AI platform.

**Your Core Responsibilities:**
1. Execute end-to-end call flow scenarios
2. Simulate webhook events for integrated testing
3. Validate API responses, status codes, and headers
4. Verify database state for test integrity
5. Generate comprehensive test execution reports

**Test Lifecycle Process:**
1. **Scoping**: identify the specific test scenario and requirements
2. **Setup**: create isolated test data (leads, campaigns) using unique IDs
3. **Execution**: run the test steps sequentially
4. **Validation**: verify actual vs. expected results at each step
5. **Reporting**: document pass/fail status and performance metrics
6. **Teardown**: clean up all test artifacts strictly

**Test Scenarios:**
- **Outbound Call**: create lead -> start call -> simulate Vapi webhook -> verify log
- **Inbound Verification**: simulate Twilio call -> verify Vapi handoff
- **Lead Qualification**: updated database -> verify webhook trigger
- **Campaign Logic**: trigger campaign -> verify calls queued

**Quality Standards:**
- **Isolation**: tests must never affect production data
- **Determinism**: tests should produce repeatable results
- **Completeness**: validate both happy path and failure modes
- **Clarity**: failure reports must clearly explain WHAT failed and WHY

**Output Format:**
Provide your test results in this structure:
## 🧪 Test: [Name]
[Context]

## 📝 Execution Log
1. [Step] -> ✅/❌
2. [Step] -> ✅/❌

## 📊 Metrics
- Duration: [ms]
- API Status: [code]

## 📋 Verdict
[PASS/FAIL]

**Edge Cases:**
- If API times out: retry once, then fail test
- If data setup fails: abort test and run cleanup
- If cleanup fails: log specific IDs for manual removal`,
    tools: [
      {
        name: "run_test_scenario",
        description: "Execute a complete end-to-end test scenario",
        input_schema: {
          type: "object" as const,
          properties: {
            scenario_name: {
              type: "string",
              description:
                "Name of the test scenario (e.g., 'call_initiation', 'webhook_handling')",
            },
            test_config: {
              type: "object",
              description:
                "Configuration for the test (lead data, campaign settings, etc.)",
            },
            context: {
              type: "string",
              description: "Why you're running this test",
            },
          },
          required: ["scenario_name", "context"],
        },
      },
      {
        name: "simulate_webhook",
        description: "Simulate a webhook event and validate handling",
        input_schema: {
          type: "object" as const,
          properties: {
            webhook_type: {
              type: "string",
              enum: [
                "call.started",
                "call.ended",
                "call.transcribed",
                "call.failed",
                "lead.qualified",
              ],
              description: "Type of webhook event to simulate",
            },
            payload: {
              type: "object",
              description: "Webhook payload data",
            },
            context: {
              type: "string",
              description: "What you're testing and why",
            },
          },
          required: ["webhook_type", "context"],
        },
      },
      {
        name: "validate_api_response",
        description: "Call an API endpoint and validate the response",
        input_schema: {
          type: "object" as const,
          properties: {
            endpoint: {
              type: "string",
              description: "API endpoint to test (e.g., /api/calls/start)",
            },
            method: {
              type: "string",
              enum: ["GET", "POST", "PUT", "DELETE"],
              description: "HTTP method",
            },
            request_data: {
              type: "object",
              description: "Request payload (for POST/PUT)",
            },
            expected_status: {
              type: "number",
              description: "Expected HTTP status code (e.g., 200, 201, 400)",
            },
            context: {
              type: "string",
              description: "What you're validating",
            },
          },
          required: ["endpoint", "method", "expected_status", "context"],
        },
      },
      {
        name: "create_test_data",
        description: "Create test data for testing scenarios",
        input_schema: {
          type: "object" as const,
          properties: {
            data_type: {
              type: "string",
              enum: ["leads", "campaigns", "integrations", "agents"],
              description: "Type of test data to create",
            },
            count: {
              type: "number",
              description: "Number of records to create",
            },
            config: {
              type: "object",
              description: "Configuration for the test data",
            },
            context: {
              type: "string",
              description: "What test data you need and why",
            },
          },
          required: ["data_type", "count", "context"],
        },
      },
      {
        name: "generate_test_report",
        description: "Generate a comprehensive test report",
        input_schema: {
          type: "object" as const,
          properties: {
            test_name: {
              type: "string",
              description: "Name of the test run",
            },
            results: {
              type: "array",
              description: "Array of test results",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["passed", "failed", "skipped"],
                  },
                  duration_ms: { type: "number" },
                  error: { type: "string" },
                },
              },
            },
            context: {
              type: "string",
              description: "Context for the test run",
            },
          },
          required: ["test_name", "results", "context"],
        },
      },
      {
        name: "cleanup_test_data",
        description: "Clean up test data after testing",
        input_schema: {
          type: "object" as const,
          properties: {
            data_type: {
              type: "string",
              enum: ["leads", "campaigns", "integrations", "agents", "all"],
              description: "Type of test data to clean up",
            },
            filter: {
              type: "object",
              description: "Filter to identify test data (e.g., {created_by: 'test_agent'})",
            },
            context: {
              type: "string",
              description: "Why you're cleaning up",
            },
          },
          required: ["data_type", "context"],
        },
      },
    ],
  };
}
