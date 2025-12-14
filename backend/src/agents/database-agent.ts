import Groq from "groq-sdk";
import {
  DatabaseAgentConfig,
  createDatabaseConfig,
} from "../agents-config/database-config";
import {
  executeQuery,
  checkSchema,
  verifyData,
  batchOperation,
} from "../agent-tools/supabase-tool";

/**
 * Database Agent using Groq API (Free!)
 * Executes autonomous database operations on Supabase
 * Assists other agents with their database needs
 */
export class DatabaseAgent {
  private client: Groq;
  private config: DatabaseAgentConfig;
  private messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 15;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
    this.config = createDatabaseConfig();
  }

  /**
   * Execute database operations based on a task description
   * Runs autonomously without asking for manual command execution
   */
  async execute(task: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("DATABASE AGENT - VOXANNE VOICE AI (Groq-Powered)");
    console.log("=".repeat(70));
    console.log(`Task: ${task}\n`);

    // Initial user message with the task (system instructions embedded)
    const initialPrompt = `${this.config.systemPrompt}

User Task: ${task}

Please execute this database operation:

Your responsibilities:
1. Understand the requested database operation
2. Build appropriate SQL queries if needed
3. Execute the operation using available tools
4. Return detailed results and status
5. Provide verification and next steps

Be autonomous in your execution - use the tools directly to accomplish the task.
Show all queries and results clearly.`;

    this.messages.push({
      role: "user",
      content: initialPrompt,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(`\n[Database Operation ${this.iterationCount}/${this.maxIterations}]`);
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
          // No tool request, check if operation is complete
          if (
            assistantMessage.toLowerCase().includes("complete") ||
            assistantMessage.toLowerCase().includes("operation complete") ||
            assistantMessage.toLowerCase().includes("finished")
          ) {
            continueLoop = false;
          } else {
            // Continue the operation
            this.messages.push({
              role: "user",
              content:
                "Continue executing the database operation. Use tools to complete the task or provide status.",
            });
          }
        }
      } catch (error: any) {
        console.error(`\n❌ Error in database agent: ${error.message}`);
        continueLoop = false;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("DATABASE OPERATION COMPLETE");
    console.log("=".repeat(70));
    console.log(
      `Completed ${this.iterationCount} operation steps${
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
    // Look for [EXECUTE_QUERY: ...] pattern
    const executeMatch = response.match(
      /\[EXECUTE_QUERY:\s*query\s*=\s*(.+?),\s*type\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (executeMatch) {
      return {
        tool: "execute_query",
        params: {
          query: executeMatch[1].trim(),
          operation_type: executeMatch[2].trim(),
          context: executeMatch[3].trim(),
        },
      };
    }

    // Look for [CHECK_SCHEMA: ...] pattern
    const schemaMatch = response.match(
      /\[CHECK_SCHEMA:\s*table\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (schemaMatch) {
      return {
        tool: "check_schema",
        params: {
          table: schemaMatch[1].trim(),
          context: schemaMatch[2].trim(),
        },
      };
    }

    // Look for [VERIFY_DATA: ...] pattern
    const verifyMatch = response.match(
      /\[VERIFY_DATA:\s*check_type\s*=\s*(.+?),\s*table\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (verifyMatch) {
      return {
        tool: "verify_data",
        params: {
          check_type: verifyMatch[1].trim(),
          table: verifyMatch[2].trim(),
          context: verifyMatch[3].trim(),
        },
      };
    }

    // Look for [BATCH_OPERATION: ...] pattern
    const batchMatch = response.match(
      /\[BATCH_OPERATION:\s*operations\s*=\s*\[(.*?)\],\s*context\s*=\s*(.+?)\]/is
    );
    if (batchMatch) {
      try {
        const operationsJson = `[${batchMatch[1]}]`;
        const operations = JSON.parse(operationsJson);
        return {
          tool: "batch_operation",
          params: {
            operations: operations,
            context: batchMatch[2].trim(),
          },
        };
      } catch {
        // If JSON parsing fails, continue
      }
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
        case "execute_query":
          return await executeQuery(
            params.query,
            params.operation_type,
            params.context
          );

        case "check_schema":
          return await checkSchema(params.table, params.context);

        case "verify_data":
          return await verifyData(
            params.check_type,
            params.table,
            params.context
          );

        case "batch_operation":
          return await batchOperation(params.operations, params.context);

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error: any) {
      return `Tool execution error (${toolName}): ${error.message}`;
    }
  }
}
