import "dotenv/config";
import { DiagnosticAgentGroq } from "../src/agents/diagnostic-agent-groq";

/**
 * CLI Entry Point for Diagnostic Agent using Groq API
 * FREE API - No credits needed!
 * Usage: npx ts-node scripts/run-diagnostic-agent-groq.ts "issue description"
 */
async function main() {
  // Get API key from environment
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error(
      `
❌ Missing GROQ_API_KEY environment variable

Get a FREE Groq API key (5 minutes):
1. Visit https://console.groq.com/keys
2. Sign up (free account)
3. Create an API key
4. Copy it and run:

export GROQ_API_KEY=your_key_here

Then try again:
npm run agent:diagnostic:groq "describe your issue"
`
    );
    process.exit(1);
  }

  // Get issue description from command line arguments
  const issue = process.argv.slice(2).join(" ");

  // Show help if no issue provided
  if (!issue) {
    console.log(
      `
Diagnostic Agent for Voxanne Voice AI (Powered by Groq - FREE!)

Usage: npm run agent:diagnostic:groq "issue description"

Examples:
  npm run agent:diagnostic:groq "Getting 500 errors on POST /api/calls/start"
  npm run agent:diagnostic:groq "Cannot connect to Supabase database"
  npm run agent:diagnostic:groq "WebSocket connection failures"
  npm run agent:diagnostic:groq "Vapi 401 Unauthorized when making calls"

This agent uses Groq's FREE API (no credits needed!):
- Model: Mixtral-8x7b-32768 (Fast and capable)
- Cost: FREE
- Speed: ~100 tokens/sec

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
  GROQ_API_KEY           - Your FREE Groq API key (get from https://console.groq.com/keys)
  SUPABASE_URL           - Supabase project URL (already configured)
  SUPABASE_SERVICE_KEY   - Supabase service role key (already configured)
`
    );
    process.exit(1);
  }

  // Create and run agent
  try {
    console.log(
      "🚀 Starting Diagnostic Agent with Groq (Free API)...\n"
    );
    const agent = new DiagnosticAgentGroq(apiKey);
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
