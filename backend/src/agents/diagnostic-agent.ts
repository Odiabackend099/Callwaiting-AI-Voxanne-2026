import Anthropic from "@anthropic-ai/sdk";
import {
  DiagnosticAgentConfig,
  createDiagnosticConfig,
} from "../agents-config/diagnostic-config";
import { executeBashCommand } from "../agent-tools/bash-executor";
import { queryDatabase } from "../agent-tools/database-query-tool";
import { checkApiHealth } from "../agent-tools/api-client-tool";
import { readErrorLogs, analyzeLogs } from "../agent-tools/log-analyzer-tool";

/**
 * Diagnostic Agent - Troubleshoots backend issues
 * Uses Claude Opus 4.5 with specialized tools for debugging
 */
export class DiagnosticAgent {
  private client: Anthropic;
  private config: DiagnosticAgentConfig;
  private messages: Anthropic.MessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 10;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.config = createDiagnosticConfig();
  }

  /**
   * Starts diagnostic investigation for an issue
   * Runs an agentic loop until resolution or max iterations
   */
  async diagnose(issue: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("DIAGNOSTIC AGENT - VOXANNE VOICE AI");
    console.log("=".repeat(70));
    console.log(`Issue: ${issue}\n`);

    // Initial user message with the issue
    this.messages.push({
      role: "user",
      content: `Please diagnose and help resolve the following issue:

**Issue**: ${issue}

Use your available tools to:
1. Gather relevant information about the system state
2. Identify the root cause
3. Provide specific remediation steps
4. Suggest verification steps

Be thorough but efficient. Show your work.`,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(`\n[Diagnostic Step ${this.iterationCount}/${this.maxIterations}]`);
      console.log("-".repeat(70));

      try {
        // Call Claude with tools
        const response = await this.client.messages.create({
          model: "claude-opus-4-5-20251101",
          max_tokens: 4096,
          system: this.config.systemPrompt,
          tools: this.config.tools,
          messages: this.messages,
        });

        // Add assistant response to message history
        this.messages.push({
          role: "assistant",
          content: response.content,
        });

        // Process response content
        let hasToolUse = false;

        for (const block of response.content) {
          if (block.type === "text") {
            console.log(`\n${block.text}`);
          } else if (block.type === "tool_use") {
            hasToolUse = true;
            console.log(`\n🔧 Using Tool: ${block.name}`);

            // Execute the tool and get result
            const toolResult = await this.executeTool(
              block.name,
              block.input as Record<string, any>
            );

            // Print first 500 chars of result for UX
            const previewLength = 500;
            const preview =
              toolResult.length > previewLength
                ? toolResult.substring(0, previewLength) +
                  `\n... (${toolResult.length - previewLength} more characters)`
                : toolResult;

            console.log(`\n📊 Result:\n${preview}`);

            // Add tool result to messages for next iteration
            this.messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: toolResult,
                },
              ],
            });
          }
        }

        // Check if we should continue
        if (!hasToolUse || response.stop_reason === "end_turn") {
          continueLoop = false;
        }
      } catch (error: any) {
        console.error(`\n❌ Error in diagnostic loop: ${error.message}`);
        continueLoop = false;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("DIAGNOSIS COMPLETE");
    console.log("=".repeat(70));
    console.log(
      `Completed ${this.iterationCount} diagnostic steps${
        this.iterationCount >= this.maxIterations
          ? " (max iterations reached)"
          : ""
      }`
    );
    console.log();
  }

  /**
   * Executes a tool and returns the result
   * Routes to appropriate tool handler based on tool name
   */
  private async executeTool(
    toolName: string,
    input: Record<string, any>
  ): Promise<string> {
    try {
      switch (toolName) {
        case "bash_execute":
          return await executeBashCommand(input.command, input.context);

        case "query_database":
          return await queryDatabase(
            input.query,
            input.table,
            input.filters
          );

        case "check_api_health":
          return await checkApiHealth(
            input.endpoint,
            input.timeout || 5
          );

        case "read_error_logs": {
          const logs = await readErrorLogs(
            input.logType,
            input.lines || 50,
            input.filter
          );
          const analysis = analyzeLogs(logs);
          return logs + "\n\n" + analysis;
        }

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error: any) {
      return `Tool execution error (${toolName}): ${error.message}`;
    }
  }
}
