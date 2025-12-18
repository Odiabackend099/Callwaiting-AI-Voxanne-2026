import Anthropic from "@anthropic-ai/sdk";

export interface DeploymentAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

/**
 * Creates the deployment agent configuration
 * This agent is specialized in safe, autonomous deployment operations
 */
export function createDeploymentConfig(): DeploymentAgentConfig {
  return {
    name: "deployment-agent",
    description:
      "Autonomous deployment agent for Render deployments, environment management, and health verification",
    systemPrompt: `You are an autonomous deployment agent specialized in safe, autonomous deployment operations for the Call Waiting AI Voice AI platform.

**Your Core Responsibilities:**
1. Deploy backend and frontend services to Render
2. Manage environment variables safely across stages
3. Verify deployment health via automated checks
4. Execute rollbacks immediately upon failure
5. Generate comprehensive deployment reports

**Deployment Workflow:**
1. **Pre-Flight**: verify git status, tests, and current environment health
2. **Snapshot**: backup current configuration and environment variables
3. **Execution**: trigger deployment via Render API or git push
4. **Monitoring**: watch build logs and deployment events
5. **Verification**: check /health endpoint and critical API paths
6. **Sign-off**: confirm stability (after 5 min monitoring) or rollback

**Critical Checkpoints:**
- **Database**: ensure migrations are compatible
- **Secrets**: verify all required env vars are present
- **Connectivity**: check Redis/Vapi/Twilio integrations
- **Capacity**: verify Render instance limits

**Quality Standards:**
- **Zero Downtime**: aim for seamless transitions
- **Immutable**: never change code directly on server
- **Auditable**: log every action, variable change, and deployment
- **Reversible**: always have a valid rollback target

**Output Format:**
Provide your results in this structure:
## 🚀 Deployment: [Env]
[Context]

## 📋 Steps Executed
1. [Step] -> ✅/❌
2. [Step] -> ✅/❌

## 🩺 Health Check
- API: [Status]
- Database: [Status]

## 📝 Result
[SUCCESS/FAILURE]

**Edge Cases:**
- If build fails: analyze logs and report specific compile error
- If health check fails: immediate rollback + alert
- If database migration fails: rollback migration + app`,
    tools: [
      {
        name: "check_deployment_status",
        description: "Check current deployment status and health",
        input_schema: {
          type: "object" as const,
          properties: {
            environment: {
              type: "string",
              enum: ["development", "staging", "production"],
              description: "Deployment environment to check",
            },
            context: {
              type: "string",
              description: "Why you're checking deployment status",
            },
          },
          required: ["environment", "context"],
        },
      },
      {
        name: "manage_env_variables",
        description: "Manage environment variables safely",
        input_schema: {
          type: "object" as const,
          properties: {
            action: {
              type: "string",
              enum: ["list", "get", "set", "delete"],
              description: "Action to perform",
            },
            variables: {
              type: "object",
              description: "Environment variables (for set action)",
            },
            context: {
              type: "string",
              description: "Why you're modifying environment variables",
            },
          },
          required: ["action", "context"],
        },
      },
      {
        name: "deploy_to_render",
        description: "Deploy application to Render",
        input_schema: {
          type: "object" as const,
          properties: {
            environment: {
              type: "string",
              enum: ["staging", "production"],
              description: "Target deployment environment",
            },
            version: {
              type: "string",
              description: "Version/tag to deploy (defaults to latest)",
            },
            context: {
              type: "string",
              description: "Reason for deployment",
            },
          },
          required: ["environment", "context"],
        },
      },
      {
        name: "verify_health",
        description: "Verify deployment health and critical endpoints",
        input_schema: {
          type: "object" as const,
          properties: {
            environment: {
              type: "string",
              enum: ["development", "staging", "production"],
              description: "Environment to verify",
            },
            checks: {
              type: "array",
              description: "Specific health checks to run",
              items: { type: "string" },
            },
            context: {
              type: "string",
              description: "Why you're verifying health",
            },
          },
          required: ["environment", "context"],
        },
      },
      {
        name: "rollback_deployment",
        description: "Rollback to previous deployment version",
        input_schema: {
          type: "object" as const,
          properties: {
            environment: {
              type: "string",
              enum: ["staging", "production"],
              description: "Environment to rollback",
            },
            reason: {
              type: "string",
              description: "Reason for rollback",
            },
            context: {
              type: "string",
              description: "What issues triggered the rollback",
            },
          },
          required: ["environment", "reason", "context"],
        },
      },
      {
        name: "generate_deployment_report",
        description: "Generate deployment report with status and metrics",
        input_schema: {
          type: "object" as const,
          properties: {
            deployment_type: {
              type: "string",
              enum: ["full", "partial", "hotfix"],
              description: "Type of deployment",
            },
            status: {
              type: "string",
              enum: ["success", "partial", "failed"],
              description: "Overall deployment status",
            },
            context: {
              type: "string",
              description: "Deployment context and changes",
            },
          },
          required: ["deployment_type", "status", "context"],
        },
      },
    ],
  };
}
