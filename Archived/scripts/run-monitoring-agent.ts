import "dotenv/config";
import { MonitoringAgent } from "../src/agents/monitoring-agent";

/**
 * CLI Entry Point for Monitoring Agent
 * Real-time monitoring and anomaly detection
 *
 * Usage:
 * npm run agent:monitor "Watch live calls and alert on failures"
 * npm run agent:monitor "Analyze transcript quality for last 10 calls"
 * npm run agent:monitor "Detect anomalies in system performance"
 * npm run agent:monitor "Generate health report for last 24 hours"
 */

async function main() {
  // Get task from command line arguments
  const task = process.argv.slice(2).join(" ");

  if (!task) {
    console.log("\n" + "=".repeat(70));
    console.log("MONITORING AGENT - Real-time Call Monitoring");
    console.log("=".repeat(70));
    console.log("\nUsage: npm run agent:monitor \"<your monitoring task>\"");
    console.log("\nExamples:");
    console.log(
      '  npm run agent:monitor "Watch all live calls and alert on failures"'
    );
    console.log(
      '  npm run agent:monitor "Analyze transcript quality for active calls"'
    );
    console.log(
      '  npm run agent:monitor "Detect anomalies in call patterns and performance"'
    );
    console.log(
      '  npm run agent:monitor "Get current performance metrics and health status"'
    );
    console.log(
      '  npm run agent:monitor "Generate comprehensive monitoring report for last 24 hours"'
    );
    console.log("\nMonitoring Features:");
    console.log("  - Watch live calls in real-time");
    console.log("  - Analyze transcript quality");
    console.log("  - Detect anomalies and failures");
    console.log("  - Track performance metrics");
    console.log("  - Generate alerts for critical issues");
    console.log("  - Provide trend analysis and reports");
    console.log("\nThe agent will:");
    console.log("  1. Connect to live monitoring systems");
    console.log("  2. Watch active calls and metrics");
    console.log("  3. Analyze data for issues");
    console.log("  4. Generate alerts on anomalies");
    console.log("  5. Provide insights and recommendations");
    console.log("\nNo manual monitoring needed - fully autonomous!\n");
    return;
  }

  // Validate Groq API key
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error(
      "\n❌ Error: GROQ_API_KEY environment variable is not set"
    );
    console.error("\nSetup Groq (FREE) in 2 minutes:");
    console.error("  1. Visit: https://console.groq.com/keys");
    console.error("  2. Create a free account and get an API key");
    console.error("  3. Set it: export GROQ_API_KEY=your_key_here");
    console.error("  4. Try again: npm run agent:monitor \"<your task>\"");
    console.error("\nCost: FREE");
    console.error("Speed: Very fast (~100 tokens/second)\n");
    process.exit(1);
  }

  try {
    // Initialize and run the monitoring agent
    const agent = new MonitoringAgent(groqApiKey);
    await agent.monitor(task);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
