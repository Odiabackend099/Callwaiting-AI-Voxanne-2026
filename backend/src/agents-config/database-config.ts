import Anthropic from "@anthropic-ai/sdk";

export interface DatabaseAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Anthropic.Tool[];
}

/**
 * Creates the database agent configuration
 * This agent is specialized in autonomous database operations
 */
export function createDatabaseConfig(): DatabaseAgentConfig {
  return {
    name: "database-agent",
    description:
      "Autonomous database agent for executing queries, migrations, and data operations on Supabase",
    systemPrompt: `You are an autonomous database agent specialized in managing Supabase data operations for the CALL WAITING AI LTD Voice AI platform.

**Your Core Responsibilities:**
1. Execute safe SQL queries (SELECT, INSERT, UPDATE) with validation
2. Manage schema modifications and migrations
3. Verify data integrity, consistency, and relationships
4. Provide detailed summaries of affected data
5. Identify and flag risky operations before execution

**Operation Process:**
1. **Safety Check**: validate table names, WHERE clauses, and potential impact
2. **Query Formulation**: construct precise SQL for the requested operation
3. **Pre-Execution Verification**: check schema/constraints if modifying data
4. **Execution**: run the query with proper error handling
5. **Impact Analysis**: report rows affected and data state changes
6. **Recovery Plan**: suggest rollback steps if applicable

**Critical Tables:**
- **integrations**: API credentials (never expose secrets)
- **leads**: Customer PII (handle with privacy)
- **campaigns**: Logic definitions
- **call_logs**: Historical records
- **call_transcripts**: Voice data

**Quality Standards:**
- **Safe**: ALWAYS use WHERE clauses on UPDATE/DELETE
- **Precise**: select specific columns rather than SELECT * when possible
- **Verification**: ALWAYS show the data that will be changed before changing it
- **Context**: explain WHY a query is being run and what it does

**Output Format:**
Provide your results in this structure:
## 📊 Operation Summary
[What was done]

## 📝 Query Executed
\`\`\`sql
[SQL Code]
\`\`\`

## 📉 Results
[Data or impact summary]

## ✅ Verification
[Confirmation of success]

**Edge Cases:**
- If query affects 0 rows: verify permissions and WHERE clause logic
- If constraints fail: check foreign keys and unique constraints
- If table unlikely exists: check schema for correct name
- If operation is high-risk (e.g., DELETE without WHERE): REFUSE TO EXECUTE`,
    tools: [
      {
        name: "execute_query",
        description:
          "Execute a database query (SELECT, INSERT, UPDATE, DELETE)",
        input_schema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description:
                "SQL query to execute (can be SELECT, INSERT, UPDATE, DELETE)",
            },
            operation_type: {
              type: "string",
              enum: ["select", "insert", "update", "delete"],
              description: "Type of database operation",
            },
            context: {
              type: "string",
              description: "Why you're executing this query",
            },
          },
          required: ["query", "operation_type", "context"],
        },
      },
      {
        name: "check_schema",
        description: "Check database schema and table structure",
        input_schema: {
          type: "object" as const,
          properties: {
            table: {
              type: "string",
              description:
                "Table name to check schema for (or 'all' for all tables)",
            },
            context: {
              type: "string",
              description: "Why you need schema information",
            },
          },
          required: ["table", "context"],
        },
      },
      {
        name: "verify_data",
        description: "Verify data integrity and consistency",
        input_schema: {
          type: "object" as const,
          properties: {
            check_type: {
              type: "string",
              enum: [
                "missing_keys",
                "null_values",
                "duplicates",
                "referential",
                "custom",
              ],
              description: "Type of data integrity check",
            },
            table: {
              type: "string",
              description: "Table to verify",
            },
            context: {
              type: "string",
              description: "What you're checking and why",
            },
          },
          required: ["check_type", "table", "context"],
        },
      },
      {
        name: "batch_operation",
        description: "Execute multiple database operations in sequence",
        input_schema: {
          type: "object" as const,
          properties: {
            operations: {
              type: "array",
              description: "Array of operations to execute",
              items: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "SQL query",
                  },
                  operation_type: {
                    type: "string",
                    enum: ["select", "insert", "update", "delete"],
                  },
                  description: {
                    type: "string",
                    description: "What this operation does",
                  },
                },
              },
            },
            context: {
              type: "string",
              description: "Overall context for the batch",
            },
          },
          required: ["operations", "context"],
        },
      },
    ],
  };
}
