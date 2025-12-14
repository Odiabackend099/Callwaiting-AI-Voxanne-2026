import "dotenv/config";
import { DiagnosticAgent } from "../src/agents/diagnostic-agent";

/**
 * CLI Entry Point for Diagnostic Agent
 * Usage: npx ts-node scripts/run-diagnostic-agent.ts "issue description"
 */
async function main() {
  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "❌ Missing ANTHROPIC_API_KEY environment variable"
    );
    console.error("   Please set: export ANTHROPIC_API_KEY=your_api_key");
    process.exit(1);
  }

  // Get issue description from command line arguments
  const issue = process.argv.slice(2).join(" ");

  // Show help if no issue provided
  if (!issue) {
    console.log(
      `
Diagnostic Agent for Voxanne Voice AI Backend

Usage: npm run agent:diagnostic "issue description"

Examples:
  npm run agent:diagnostic "Getting 500 errors on POST /api/calls/start"
  npm run agent:diagnostic "Cannot connect to Supabase database"
  npm run agent:diagnostic "WebSocket connection failures to /ws/live-calls"
  npm run agent:diagnostic "Vapi 401 Unauthorized when making calls"
  npm run agent:diagnostic "Backend crashes on startup"

The diagnostic agent will:
1. Check system health
2. Review error logs
3. Query the database for configuration issues
4. Test API endpoints
5. Provide root cause analysis and remediation steps

For best results, be specific about:
- What is failing (endpoint, feature, action)
- When it started failing (always, after change, intermittent)
- What you've already tried

Environment Variables Required:
  ANTHROPIC_API_KEY      - Your Claude API key
  SUPABASE_URL           - Supabase project URL
  SUPABASE_SERVICE_KEY   - Supabase service role key
`
    );
    process.exit(1);
  }

  // Create and run agent
  try {
    const agent = new DiagnosticAgent(apiKey);
    await agent.diagnose(issue);
  } catch (error: any) {
    console.error(`\n❌ Agent error: ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
