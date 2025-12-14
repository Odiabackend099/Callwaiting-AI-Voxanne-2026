import "dotenv/config";
import { TestingAgent } from "../src/agents/testing-agent";

/**
 * CLI Entry Point for Testing Agent
 * Autonomous test execution and validation
 *
 * Usage:
 * npm run agent:test "Run end-to-end call flow test"
 * npm run agent:test "Test webhook event handling"
 * npm run agent:test "Validate all API endpoints"
 * npm run agent:test "Run lead qualification test scenario"
 */

async function main() {
  // Get task from command line arguments
  const task = process.argv.slice(2).join(" ");

  if (!task) {
    console.log("\n" + "=".repeat(70));
    console.log("TESTING AGENT - Autonomous Test Execution");
    console.log("=".repeat(70));
    console.log("\nUsage: npm run agent:test \"<your testing task>\"");
    console.log("\nExamples:");
    console.log('  npm run agent:test "Run end-to-end call flow test"');
    console.log(
      '  npm run agent:test "Test webhook event handling for call.started, call.ended"'
    );
    console.log('  npm run agent:test "Validate all critical API endpoints"');
    console.log(
      '  npm run agent:test "Run lead qualification test scenario with 5 test leads"'
    );
    console.log(
      '  npm run agent:test "Test error handling for invalid requests"'
    );
    console.log("\nTest Scenarios Available:");
    console.log("  - call_initiation: Test calling leads");
    console.log("  - webhook_handling: Test webhook event processing");
    console.log("  - lead_qualification: Test lead qualification flow");
    console.log("  - error_handling: Test error responses");
    console.log("\nThe agent will:");
    console.log("  1. Create necessary test data");
    console.log("  2. Execute test scenarios end-to-end");
    console.log("  3. Simulate webhooks and validate responses");
    console.log("  4. Generate detailed test report");
    console.log("  5. Clean up test data");
    console.log("\nNo manual test execution needed - the agent runs tests autonomously!\n");
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
    console.error("  4. Try again: npm run agent:test \"<your task>\"");
    console.error("\nCost: FREE");
    console.error("Speed: Very fast (~100 tokens/second)\n");
    process.exit(1);
  }

  try {
    // Initialize and run the testing agent
    const agent = new TestingAgent(groqApiKey);
    await agent.test(task);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
