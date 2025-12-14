import "dotenv/config";
import { DeploymentAgent } from "../src/agents/deployment-agent";

/**
 * CLI Entry Point for Deployment Agent
 * Autonomous deployment management and verification
 *
 * Usage:
 * npm run agent:deploy "Deploy to production"
 * npm run agent:deploy "Check deployment health"
 * npm run agent:deploy "Rollback to previous version"
 * npm run agent:deploy "Update VAPI_API_KEY in staging"
 */

async function main() {
  // Get task from command line arguments
  const task = process.argv.slice(2).join(" ");

  if (!task) {
    console.log("\n" + "=".repeat(70));
    console.log("DEPLOYMENT AGENT - Safe Production Deployments");
    console.log("=".repeat(70));
    console.log("\nUsage: npm run agent:deploy \"<your deployment task>\"");
    console.log("\nExamples:");
    console.log('  npm run agent:deploy "Deploy to production"');
    console.log('  npm run agent:deploy "Deploy to staging and verify health"');
    console.log(
      '  npm run agent:deploy "Check deployment status for production"'
    );
    console.log(
      '  npm run agent:deploy "Update VAPI_API_KEY in staging environment"'
    );
    console.log(
      '  npm run agent:deploy "Rollback production due to errors in call initiation"'
    );
    console.log('\n  npm run agent:deploy "Full deployment with health verification"');
    console.log("\nDeployment Tasks:");
    console.log("  - Deploy to staging: Pre-production testing");
    console.log("  - Deploy to production: Live deployment");
    console.log("  - Check status: Verify current deployment");
    console.log("  - Verify health: Run health checks");
    console.log("  - Manage env vars: Update environment variables");
    console.log("  - Rollback: Revert to previous version");
    console.log("\nThe agent will:");
    console.log("  1. Check current deployment status");
    console.log("  2. Verify all prerequisites");
    console.log("  3. Execute deployment steps");
    console.log("  4. Run post-deploy health checks");
    console.log("  5. Generate deployment report");
    console.log("\nNo manual deployment steps needed - fully autonomous!\n");
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
    console.error("  4. Try again: npm run agent:deploy \"<your task>\"");
    console.error("\nCost: FREE");
    console.error("Speed: Very fast (~100 tokens/second)\n");
    process.exit(1);
  }

  try {
    // Initialize and run the deployment agent
    const agent = new DeploymentAgent(groqApiKey);
    await agent.deploy(task);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
