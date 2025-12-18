import Anthropic from "@anthropic-ai/sdk";

export interface MonitoringAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

/**
 * Creates the monitoring agent configuration
 * This agent is specialized in real-time monitoring and anomaly detection
 */
export function createMonitoringConfig(): MonitoringAgentConfig {
  return {
    name: "monitoring-agent",
    description:
      "Real-time monitoring agent for live calls, transcription analysis, and anomaly detection",
    systemPrompt: `You are a real-time monitoring agent specialized in operational intelligence for the CALL WAITING AI LTD Voice AI platform.

**Your Core Responsibilities:**
1. Monitor live call streams and system health
2. Analyze transcription quality and sentiment
3. Detect anomalies (spikes/failures/latency)
4. Generate actionable alerts with severity levels
5. Provide performance optimization recommendations

**Detection Strategy:**
1. **Streaming Analysis**: real-time processing of WebSocket events
2. **Threshold Monitoring**: check metrics against defined SLAs
3. **Pattern Recognition**: identify trends (e.g., error rate climbing)
4. **Correlation**: link db latency to API timeouts
5. **Alerting**: notify channels based on severity (Info/Warn/Crit)

**Key Metrics:**
- **Voice**: Latency < 500ms, Transcription Confidence > 0.9
- **System**: API 500s < 0.1%, DB Response < 100ms
- **Business**: Call Connect Rate > 80%, Lead Conversion > 15%

**Alert Levels:**
- **INFO**: Routine events (deploy success, daily summary)
- **WARNING**: Approaching limits (latency spikes, 4xx errors)
- **CRITICAL**: Service disruption (DB down, Auth failing, >10% call fail)

**Quality Standards:**
- **Signal-to-Noise**: avoid alert fatigue; only actionable alerts
- **Context-Rich**: alerts must include WHY it triggered and current value
- **Proactive**: warn before the system crashes (e.g., disk 90% full)
- **Holistic**: monitor application, database, and third-party APIs

**Output Format:**
Provide your findings in this structure:
## 📡 Monitoring Report
[Time Period]

## 🚨 Active Alerts
1. [Severity] [Title] - [Description]

## 📈 Key Metrics
- Call Success: [%]
- Avg Latency: [ms]

## 🧠 Insights
[Analysis of patterns]

## ⚡ Recommendations
1. [Actionable step]

**Edge Cases:**
- If telemetry stops: alert on "Monitoring System Failure"
- If false positives high: adjust thresholds dynamically
- If spike detected: auto-scale or rate limit recommendation`,
    tools: [
      {
        name: "watch_live_calls",
        description: "Watch and monitor active calls in real-time",
        input_schema: {
          type: "object" as const,
          properties: {
            filter: {
              type: "object",
              description: "Filter active calls (by campaign, status, etc.)",
            },
            duration_seconds: {
              type: "number",
              description: "How long to monitor (0 = continuous)",
            },
            context: {
              type: "string",
              description: "Why you're monitoring",
            },
          },
          required: ["context"],
        },
      },
      {
        name: "analyze_transcript",
        description: "Analyze call transcript for quality and insights",
        input_schema: {
          type: "object" as const,
          properties: {
            call_id: {
              type: "string",
              description: "Call ID to analyze",
            },
            metrics: {
              type: "array",
              description:
                "Metrics to analyze (clarity, sentiment, engagement, etc.)",
              items: { type: "string" },
            },
            context: {
              type: "string",
              description: "Why you're analyzing this call",
            },
          },
          required: ["call_id", "context"],
        },
      },
      {
        name: "detect_anomalies",
        description:
          "Detect anomalies in call patterns and system performance",
        input_schema: {
          type: "object" as const,
          properties: {
            time_window_minutes: {
              type: "number",
              description: "Time window to analyze (default 60)",
            },
            sensitivity: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Anomaly detection sensitivity",
            },
            context: {
              type: "string",
              description: "What you're looking for",
            },
          },
          required: ["context"],
        },
      },
      {
        name: "get_performance_metrics",
        description: "Get current performance metrics and statistics",
        input_schema: {
          type: "object" as const,
          properties: {
            metric_type: {
              type: "string",
              enum: [
                "call_stats",
                "latency",
                "success_rate",
                "resource_usage",
                "all",
              ],
              description: "Type of metrics to retrieve",
            },
            time_range_minutes: {
              type: "number",
              description: "Time range for metrics (default 60)",
            },
            context: {
              type: "string",
              description: "What metrics you need",
            },
          },
          required: ["metric_type", "context"],
        },
      },
      {
        name: "generate_alert",
        description: "Generate alert for critical issues",
        input_schema: {
          type: "object" as const,
          properties: {
            severity: {
              type: "string",
              enum: ["info", "warning", "critical"],
              description: "Alert severity level",
            },
            title: {
              type: "string",
              description: "Alert title",
            },
            description: {
              type: "string",
              description: "Detailed description",
            },
            context: {
              type: "string",
              description: "Context and recommended actions",
            },
          },
          required: ["severity", "title", "description", "context"],
        },
      },
      {
        name: "generate_monitoring_report",
        description: "Generate comprehensive monitoring report",
        input_schema: {
          type: "object" as const,
          properties: {
            time_period: {
              type: "string",
              enum: ["1hour", "4hours", "24hours", "7days"],
              description: "Time period for report",
            },
            include_alerts: {
              type: "boolean",
              description: "Include alert history",
            },
            context: {
              type: "string",
              description: "Report context",
            },
          },
          required: ["time_period", "context"],
        },
      },
    ],
  };
}
