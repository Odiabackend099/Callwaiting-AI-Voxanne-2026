import Groq from "groq-sdk";
import {
  DiagnosticAgentConfig,
  createDiagnosticConfig,
} from "../agents-config/diagnostic-config";
import { executeBashCommand } from "../agent-tools/bash-executor";
import { queryDatabase } from "../agent-tools/database-query-tool";
import { checkApiHealth } from "../agent-tools/api-client-tool";
import { readErrorLogs, analyzeLogs } from "../agent-tools/log-analyzer-tool";

/**
 * Diagnostic Agent using Groq API (Free!)
 * Uses Mixtral-8x7b for fast, reliable diagnostics
 * No cost, no API credits needed
 */
export class DiagnosticAgentGroq {
  private client: Groq;
  private config: DiagnosticAgentConfig;
  private messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 10;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
    this.config = createDiagnosticConfig();
  }

  /**
   * Starts diagnostic investigation for an issue
   * Uses Groq's Mixtral-8x7b model (FREE!)
   */
  async diagnose(issue: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("DIAGNOSTIC AGENT - VOXANNE VOICE AI (Groq-Powered)");
    console.log("=".repeat(70));
    console.log(`Issue: ${issue}\n`);

    // Initial user message with the issue (with system instructions embedded)
    const initialPrompt = `${this.config.systemPrompt}

User Issue: ${issue}

Please diagnose and help resolve this issue:

Use your diagnostic skills to:
1. Gather relevant information about the system state
2. Identify the root cause
3. Provide specific remediation steps
4. Suggest verification steps

Be thorough but efficient. Show your work.`;

    this.messages.push({
      role: "user",
      content: initialPrompt,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(`\n[Diagnostic Step ${this.iterationCount}/${this.maxIterations}]`);
      console.log("-".repeat(70));

      try {
        // Call Groq with chat completion
        const response = await this.client.chat.completions.create({
          model: "llama-3.3-70b-versatile", // Latest Llama 3.3 model (very capable)
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

        // Parse response for tool requests (manual parsing since Groq doesn't have native tool_calls)
        const toolRequest = this.parseToolRequest(assistantMessage);

        if (toolRequest) {
          console.log(`\n🔧 Using Tool: ${toolRequest.tool}`);

          // Execute the tool
          const toolResult = await this.executeTool(
            toolRequest.tool,
            toolRequest.params
          );

          // Print first 500 chars of result for UX
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
          // No tool request, likely end of diagnosis
          if (
            assistantMessage.toLowerCase().includes("complete") ||
            assistantMessage.toLowerCase().includes("diagnosis complete")
          ) {
            continueLoop = false;
          } else {
            // Ask for next step if still investigating
            this.messages.push({
              role: "user",
              content:
                "Continue the diagnosis. Use tools to gather more information or provide remediation steps.",
            });
          }
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
   * Parses the assistant response to detect tool requests
   * Since Groq doesn't have native tool_calls, we use text-based parsing
   */
  private parseToolRequest(
    response: string
  ): { tool: string; params: Record<string, any> } | null {
    // Look for patterns like [BASH: command] or [QUERY_DB: table, query]
    const bashMatch = response.match(/\[BASH:\s*(.+?)\]/i);
    if (bashMatch) {
      return {
        tool: "bash_execute",
        params: {
          command: bashMatch[1].trim(),
          context: "Diagnostic command",
        },
      };
    }

    const dbMatch = response.match(
      /\[QUERY_DB:\s*table\s*=\s*(.+?),\s*query\s*=\s*(.+?)\]/i
    );
    if (dbMatch) {
      return {
        tool: "query_database",
        params: {
          table: dbMatch[1].trim(),
          query: dbMatch[2].trim(),
        },
      };
    }

    const healthMatch = response.match(/\[CHECK_HEALTH:\s*(.+?)\]/i);
    if (healthMatch) {
      return {
        tool: "check_api_health",
        params: {
          endpoint: healthMatch[1].trim(),
          context: "Health check",
        },
      };
    }

    const logsMatch = response.match(/\[READ_LOGS:\s*(.+?)\]/i);
    if (logsMatch) {
      return {
        tool: "read_error_logs",
        params: {
          logType: logsMatch[1].trim(),
          context: "Log analysis",
          lines: 50,
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
        case "bash_execute":
          return await executeBashCommand(
            params.command,
            params.context
          );

        case "query_database":
          return await queryDatabase(
            params.query,
            params.table,
            params.filters
          );

        case "check_api_health":
          return await checkApiHealth(
            params.endpoint,
            params.timeout || 5
          );

        case "read_error_logs": {
          const logs = await readErrorLogs(
            params.logType,
            params.lines || 50,
            params.filter
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
