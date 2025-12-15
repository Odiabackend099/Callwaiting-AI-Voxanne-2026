import Groq from "groq-sdk";
import {
  MonitoringAgentConfig,
  createMonitoringConfig,
} from "../agents-config/monitoring-config";
import {
  watchLiveCalls,
  analyzeTranscript,
  detectAnomalies,
  getPerformanceMetrics,
  generateAlert,
  generateMonitoringReport,
} from "../agent-tools/monitoring-tool";

/**
 * Monitoring Agent using Groq API (Free!)
 * Real-time monitoring of live calls and system performance
 * Detects anomalies and generates alerts
 */
export class MonitoringAgent {
  private client: Groq;
  private config: MonitoringAgentConfig;
  private messages: Groq.Chat.ChatCompletionMessageParam[] = [];
  private iterationCount: number = 0;
  private maxIterations: number = 15;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
    this.config = createMonitoringConfig();
  }

  /**
   * Execute monitoring tasks autonomously
   * Watches live calls, detects anomalies, generates alerts and reports
   */
  async monitor(task: string): Promise<void> {
    // Print header
    console.log("\n" + "=".repeat(70));
    console.log("MONITORING AGENT - VOXANNE VOICE AI (Groq-Powered)");
    console.log("=".repeat(70));
    console.log(`Task: ${task}\n`);

    // Initial user message with the task (system instructions embedded)
    const initialPrompt = `${this.config.systemPrompt}

User Task: ${task}

Please execute this monitoring operation:

Your responsibilities:
1. Connect to live monitoring systems
2. Watch active calls and operations
3. Analyze performance metrics
4. Detect anomalies
5. Generate alerts for critical issues
6. Provide trend analysis
7. Generate comprehensive reports

Be autonomous in your execution - use the tools directly to accomplish the task.
Show all monitoring data and insights clearly.`;

    this.messages.push({
      role: "user",
      content: initialPrompt,
    });

    // Agentic loop
    let continueLoop = true;
    while (continueLoop && this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      console.log(
        `\n[Monitoring Step ${this.iterationCount}/${this.maxIterations}]`
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
          // No tool request, check if monitoring is complete
          if (
            assistantMessage.toLowerCase().includes("complete") ||
            assistantMessage.toLowerCase().includes("monitoring complete") ||
            assistantMessage.toLowerCase().includes("finished")
          ) {
            continueLoop = false;
          } else {
            // Continue with monitoring
            this.messages.push({
              role: "user",
              content:
                "Continue monitoring. Use tools to watch calls, analyze transcripts, detect anomalies, or generate reports.",
            });
          }
        }
      } catch (error: any) {
        console.error(`\n❌ Error in monitoring agent: ${error.message}`);
        continueLoop = false;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("MONITORING COMPLETE");
    console.log("=".repeat(70));
    console.log(
      `Completed ${this.iterationCount} monitoring steps${
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
    // Look for [WATCH_LIVE_CALLS: ...] pattern
    const watchMatch = response.match(
      /\[WATCH_LIVE_CALLS:\s*context\s*=\s*(.+?)\]/i
    );
    if (watchMatch) {
      return {
        tool: "watch_live_calls",
        params: {
          filter: {},
          duration_seconds: 0,
          context: watchMatch[1].trim(),
        },
      };
    }

    // Look for [ANALYZE_TRANSCRIPT: ...] pattern
    const analyzeMatch = response.match(
      /\[ANALYZE_TRANSCRIPT:\s*call_id\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (analyzeMatch) {
      return {
        tool: "analyze_transcript",
        params: {
          call_id: analyzeMatch[1].trim(),
          metrics: [],
          context: analyzeMatch[2].trim(),
        },
      };
    }

    // Look for [DETECT_ANOMALIES: ...] pattern
    const anomalyMatch = response.match(
      /\[DETECT_ANOMALIES:\s*sensitivity\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (anomalyMatch) {
      return {
        tool: "detect_anomalies",
        params: {
          time_window_minutes: 60,
          sensitivity: anomalyMatch[1].trim(),
          context: anomalyMatch[2].trim(),
        },
      };
    }

    // Look for [GET_PERFORMANCE_METRICS: ...] pattern
    const metricsMatch = response.match(
      /\[GET_PERFORMANCE_METRICS:\s*type\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (metricsMatch) {
      return {
        tool: "get_performance_metrics",
        params: {
          metric_type: metricsMatch[1].trim(),
          time_range_minutes: 60,
          context: metricsMatch[2].trim(),
        },
      };
    }

    // Look for [GENERATE_ALERT: ...] pattern
    const alertMatch = response.match(
      /\[GENERATE_ALERT:\s*severity\s*=\s*(.+?),\s*title\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (alertMatch) {
      return {
        tool: "generate_alert",
        params: {
          severity: alertMatch[1].trim(),
          title: alertMatch[2].trim(),
          description: "Alert generated by monitoring agent",
          context: alertMatch[3].trim(),
        },
      };
    }

    // Look for [GENERATE_MONITORING_REPORT: ...] pattern
    const reportMatch = response.match(
      /\[GENERATE_MONITORING_REPORT:\s*period\s*=\s*(.+?),\s*context\s*=\s*(.+?)\]/i
    );
    if (reportMatch) {
      return {
        tool: "generate_monitoring_report",
        params: {
          time_period: reportMatch[1].trim(),
          include_alerts: true,
          context: reportMatch[2].trim(),
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
        case "watch_live_calls":
          return await watchLiveCalls(
            params.filter,
            params.duration_seconds,
            params.context
          );

        case "analyze_transcript":
          return await analyzeTranscript(
            params.call_id,
            params.metrics,
            params.context
          );

        case "detect_anomalies":
          return await detectAnomalies(
            params.time_window_minutes,
            params.sensitivity,
            params.context
          );

        case "get_performance_metrics":
          return await getPerformanceMetrics(
            params.metric_type,
            params.time_range_minutes,
            params.context
          );

        case "generate_alert":
          return await generateAlert(
            params.severity,
            params.title,
            params.description,
            params.context
          );

        case "generate_monitoring_report":
          return await generateMonitoringReport(
            params.time_period,
            params.include_alerts,
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
