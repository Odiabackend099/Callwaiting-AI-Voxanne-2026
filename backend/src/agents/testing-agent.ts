import Groq from "groq-sdk";
import {
  TestingAgentConfig,
  createTestingConfig,
} from "../agents-config/testing-config";
import {
  runTestScenario,
  simulateWebhook,
  validateApiResponse,
  createTestData,
  generateTestReport,
  cleanupTestData,
} from "../agent-tools/testing-tool";

/**
 * Testing Agent using Groq API (Free!)
 * Executes autonomous end-to-end tests and validations
 * Simulates webhooks and validates API responses
 */
export class TestingAgent {
  private client: Groq;
  private config: TestingAgentConfig;
  private messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 15;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
    this.config = createTestingConfig();
  }

  /**
   * Execute test scenarios autonomously
   * Runs tests, validates results, generates reports
   */
  async test(task: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("TESTING AGENT - VOXANNE VOICE AI (Groq-Powered)");
    console.log("=".repeat(70));
    console.log(`Task: ${task}\n`);

    // Initial user message with the task (system instructions embedded)
    const initialPrompt = `${this.config.systemPrompt}

User Task: ${task}

Please execute this testing operation:

Your responsibilities:
1. Understand the test scenario
2. Create necessary test data
3. Execute the test end-to-end
4. Simulate webhooks if needed
5. Validate API responses
6. Generate detailed test report
7. Cleanup test data if needed

Be autonomous in your execution - use the tools directly to accomplish the task.
Show all test steps and results clearly.`;

    this.messages.push({
      role: "user",
      content: initialPrompt,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(`\n[Test Step ${this.iterationCount}/${this.maxIterations}]`);
      console.log("-".repeat(70));

      try {
        // Call Groq with chat completion
        const response = await this.client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 2048,
          messages: this.messages as any,
          temperature: 0.7,
        });

        const assistantMessage = response.choices[0]?.message?.content || "";

        // Add assistant response to message history
        this.messages.push({
          role: "assistant",
          content: assistantMessage,
        });

        // Print the assistant's response
        if (assistantMessage) {
          console.log(`\n${assistantMessage}`);
        }

        // Parse response for tool requests
        const toolRequest = this.parseToolRequest(assistantMessage);

        if (toolRequest) {
          console.log(`\n🔧 Using Tool: ${toolRequest.tool}`);

          // Execute the tool
          const toolResult = await this.executeTool(
            toolRequest.tool,
            toolRequest.params
          );

          // Print result (truncate if very large)
          const previewLength = 500;
          const preview =
            toolResult.length > previewLength
              ? toolResult.substring(0, previewLength) +
                `\n... (${toolResult.length - previewLength} more characters)`
              : toolResult;

          console.log(`\n📊 Result:\n${preview}`);

          // Add tool result to messages
          this.messages.push({
            role: "user",
            content: `Tool result:\n${toolResult}`,
          });
        } else {
          // No tool request, check if testing is complete
          if (
            assistantMessage.toLowerCase().includes("complete") ||
            assistantMessage.toLowerCase().includes("testing complete") ||
            assistantMessage.toLowerCase().includes("finished")
          ) {
            continueLoop = false;
          } else {
            // Continue with testing
            this.messages.push({
              role: "user",
              content:
                "Continue executing the tests. Use tools to run scenarios, create data, or generate reports.",
            });
          }
        }
      } catch (error: any) {
        console.error(`\n❌ Error in testing agent: ${error.message}`);
        continueLoop = false;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("TESTING COMPLETE");
    console.log("=".repeat(70));
    console.log(
      `Completed ${this.iterationCount} test steps${
        this.iterationCount >= this.maxIterations
          ? " (max iterations reached)"
          : ""
      }`
    );
    console.log();
  }

  /**
   * Parses the assistant response to detect tool requests
   */
  private parseToolRequest(
    response: string
  ): { tool: string; params: Record<string, any> } | null {
    // Look for [RUN_TEST_SCENARIO: ...] pattern
    const testMatch = response.match(
      /\[RUN_TEST_SCENARIO:\s*scenario\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (testMatch) {
      return {
        tool: "run_test_scenario",
        params: {
          scenario_name: testMatch[1].trim(),
          test_config: {},
          context: testMatch[2].trim(),
        },
      };
    }

    // Look for [SIMULATE_WEBHOOK: ...] pattern
    const webhookMatch = response.match(
      /\[SIMULATE_WEBHOOK:\s*type\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (webhookMatch) {
      return {
        tool: "simulate_webhook",
        params: {
          webhook_type: webhookMatch[1].trim(),
          payload: {},
          context: webhookMatch[2].trim(),
        },
      };
    }

    // Look for [VALIDATE_API: ...] pattern
    const apiMatch = response.match(
      /\[VALIDATE_API:\s*endpoint\s*=\s*(.+?),\s*method\s*=\s*(.+?),\s*status\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (apiMatch) {
      return {
        tool: "validate_api_response",
        params: {
          endpoint: apiMatch[1].trim(),
          method: apiMatch[2].trim(),
          request_data: {},
          expected_status: parseInt(apiMatch[3].trim()),
          context: apiMatch[4].trim(),
        },
      };
    }

    // Look for [CREATE_TEST_DATA: ...] pattern
    const dataMatch = response.match(
      /\[CREATE_TEST_DATA:\s*type\s*=\s*(.+?),\s*count\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (dataMatch) {
      return {
        tool: "create_test_data",
        params: {
          data_type: dataMatch[1].trim(),
          count: parseInt(dataMatch[2].trim()),
          config: {},
          context: dataMatch[3].trim(),
        },
      };
    }

    // Look for [GENERATE_REPORT: ...] pattern
    const reportMatch = response.match(
      /\[GENERATE_REPORT:\s*test_name\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (reportMatch) {
      return {
        tool: "generate_test_report",
        params: {
          test_name: reportMatch[1].trim(),
          results: [],
          context: reportMatch[2].trim(),
        },
      };
    }

    // Look for [CLEANUP_TEST_DATA: ...] pattern
    const cleanupMatch = response.match(
      /\[CLEANUP_TEST_DATA:\s*type\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (cleanupMatch) {
      return {
        tool: "cleanup_test_data",
        params: {
          data_type: cleanupMatch[1].trim(),
          filter: { created_by: "testing_agent" },
          context: cleanupMatch[2].trim(),
        },
      };
    }

    return null;
  }

  /**
   * Executes a tool and returns the result
   */
  private async executeTool(
    toolName: string,
    params: Record<string, any>
  ): Promise<string> {
    try {
      switch (toolName) {
        case "run_test_scenario":
          return await runTestScenario(
            params.scenario_name,
            params.test_config,
            params.context
          );

        case "simulate_webhook":
          return await simulateWebhook(
            params.webhook_type,
            params.payload,
            params.context
          );

        case "validate_api_response":
          return await validateApiResponse(
            params.endpoint,
            params.method,
            params.request_data,
            params.expected_status,
            params.context
          );

        case "create_test_data":
          return await createTestData(
            params.data_type,
            params.count,
            params.config,
            params.context
          );

        case "generate_test_report":
          return await generateTestReport(
            params.test_name,
            params.results,
            params.context
          );

        case "cleanup_test_data":
          return await cleanupTestData(
            params.data_type,
            params.filter,
            params.context
          );

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error: any) {
      return `Tool execution error (${toolName}): ${error.message}`;
    }
  }
}
