import "dotenv/config";
import { DatabaseAgent } from "../src/agents/database-agent";

/**
 * CLI Entry Point for Database Agent
 * Autonomous database operations on Supabase
 *
 * Usage:
 * npm run agent:database "Get all leads with status='active'"
 * npm run agent:database "Update vapi_api_key in integrations table"
 * npm run agent:database "Check schema for call_logs table"
 * npm run agent:database "Verify data integrity in leads table"
 */

async function main() {
  // Get task from command line arguments
  const task = process.argv.slice(2).join(" ");

  if (!task) {
    console.log("\n" + "=".repeat(70));
    console.log("DATABASE AGENT - Autonomous Supabase Operations");
    console.log("=".repeat(70));
    console.log("\nUsage: npm run agent:database \"<your database task>\"");
    console.log("\nExamples:");
    console.log(
      '  npm run agent:database "Get all leads with status=active"'
    );
    console.log(
      '  npm run agent:database "Update vapi_api_key in integrations"'
    );
    console.log(
      '  npm run agent:database "Check schema for call_logs table"'
    );
    console.log(
      '  npm run agent:database "Verify data integrity in leads table"'
    );
    console.log(
      "\nSpecial operations:"
    );
    console.log(
      '  npm run agent:database "Run batch: [operation1, operation2, ...]"'
    );
    console.log(
      '  npm run agent:database "Check all table schemas"'
    );
    console.log("\nThe agent will:");
    console.log("  1. Understand your database task");
    console.log("  2. Execute necessary database operations");
    console.log("  3. Return detailed results");
    console.log("  4. Provide verification and next steps");
    console.log("\nNo manual command execution needed - the agent runs autonomously!\n");
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
    console.error("  4. Try again: npm run agent:database \"<your task>\"");
    console.error("\nCost: FREE");
    console.error("Speed: Very fast (~100 tokens/second)\n");
    process.exit(1);
  }

  try {
    // Initialize and run the database agent
    const agent = new DatabaseAgent(groqApiKey);
    await agent.execute(task);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
