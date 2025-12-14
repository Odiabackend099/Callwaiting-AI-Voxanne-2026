import Groq from "groq-sdk";
import {
  DeploymentAgentConfig,
  createDeploymentConfig,
} from "../agents-config/deployment-config";
import {
  checkDeploymentStatus,
  manageEnvVariables,
  deployToRender,
  verifyHealth,
  rollbackDeployment,
  generateDeploymentReport,
} from "../agent-tools/deployment-tool";

/**
 * Deployment Agent using Groq API (Free!)
 * Executes safe, autonomous deployment operations
 * Manages Render deployments and environment variables
 */
export class DeploymentAgent {
  private client: Groq;
  private config: DeploymentAgentConfig;
  private messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 15;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
    this.config = createDeploymentConfig();
  }

  /**
   * Execute deployment operations autonomously
   * Manages Render deployments, environment variables, health verification
   */
  async deploy(task: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("DEPLOYMENT AGENT - VOXANNE VOICE AI (Groq-Powered)");
    console.log("=".repeat(70));
    console.log(`Task: ${task}\n`);

    // Initial user message with the task (system instructions embedded)
    const initialPrompt = `${this.config.systemPrompt}

User Task: ${task}

Please execute this deployment operation:

Your responsibilities:
1. Understand the deployment requirement
2. Verify current deployment status
3. Check all critical prerequisites
4. Execute the deployment safely
5. Verify health post-deployment
6. Generate deployment report
7. Suggest monitoring steps

Be autonomous in your execution - use the tools directly to accomplish the task.
Show all deployment steps and results clearly.`;

    this.messages.push({
      role: "user",
      content: initialPrompt,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(
        `\n[Deployment Step ${this.iterationCount}/${this.maxIterations}]`
      );
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
          // No tool request, check if deployment is complete
          if (
            assistantMessage.toLowerCase().includes("complete") ||
            assistantMessage.toLowerCase().includes("deployment complete") ||
            assistantMessage.toLowerCase().includes("finished")
          ) {
            continueLoop = false;
          } else {
            // Continue with deployment
            this.messages.push({
              role: "user",
              content:
                "Continue executing the deployment. Use tools to check status, deploy, verify health, or generate reports.",
            });
          }
        }
      } catch (error: any) {
        console.error(`\n❌ Error in deployment agent: ${error.message}`);
        continueLoop = false;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("DEPLOYMENT COMPLETE");
    console.log("=".repeat(70));
    console.log(
      `Completed ${this.iterationCount} deployment steps${
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
    // Look for [CHECK_DEPLOYMENT_STATUS: ...] pattern
    const statusMatch = response.match(
      /\[CHECK_DEPLOYMENT_STATUS:\s*environment\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (statusMatch) {
      return {
        tool: "check_deployment_status",
        params: {
          environment: statusMatch[1].trim(),
          context: statusMatch[2].trim(),
        },
      };
    }

    // Look for [MANAGE_ENV_VARIABLES: ...] pattern
    const envMatch = response.match(
      /\[MANAGE_ENV_VARIABLES:\s*action\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (envMatch) {
      return {
        tool: "manage_env_variables",
        params: {
          action: envMatch[1].trim(),
          variables: {},
          context: envMatch[2].trim(),
        },
      };
    }

    // Look for [DEPLOY_TO_RENDER: ...] pattern
    const deployMatch = response.match(
      /\[DEPLOY_TO_RENDER:\s*environment\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (deployMatch) {
      return {
        tool: "deploy_to_render",
        params: {
          environment: deployMatch[1].trim(),
          version: undefined,
          context: deployMatch[2].trim(),
        },
      };
    }

    // Look for [VERIFY_HEALTH: ...] pattern
    const healthMatch = response.match(
      /\[VERIFY_HEALTH:\s*environment\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (healthMatch) {
      return {
        tool: "verify_health",
        params: {
          environment: healthMatch[1].trim(),
          checks: undefined,
          context: healthMatch[2].trim(),
        },
      };
    }

    // Look for [ROLLBACK_DEPLOYMENT: ...] pattern
    const rollbackMatch = response.match(
      /\[ROLLBACK_DEPLOYMENT:\s*environment\s*=\s*(.+?),\s*reason\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (rollbackMatch) {
      return {
        tool: "rollback_deployment",
        params: {
          environment: rollbackMatch[1].trim(),
          reason: rollbackMatch[2].trim(),
          context: rollbackMatch[3].trim(),
        },
      };
    }

    // Look for [GENERATE_DEPLOYMENT_REPORT: ...] pattern
    const reportMatch = response.match(
      /\[GENERATE_DEPLOYMENT_REPORT:\s*type\s*=\s*(.+?),\s*status\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/is
    );
    if (reportMatch) {
      return {
        tool: "generate_deployment_report",
        params: {
          deployment_type: reportMatch[1].trim(),
          status: reportMatch[2].trim(),
          context: reportMatch[3].trim(),
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
        case "check_deployment_status":
          return await checkDeploymentStatus(
            params.environment,
            params.context
          );

        case "manage_env_variables":
          return await manageEnvVariables(
            params.action,
            params.variables,
            params.context
          );

        case "deploy_to_render":
          return await deployToRender(
            params.environment,
            params.version,
            params.context
          );

        case "verify_health":
          return await verifyHealth(
            params.environment,
            params.checks,
            params.context
          );

        case "rollback_deployment":
          return await rollbackDeployment(
            params.environment,
            params.reason,
            params.context
          );

        case "generate_deployment_report":
          return await generateDeploymentReport(
            params.deployment_type,
            params.status,
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
