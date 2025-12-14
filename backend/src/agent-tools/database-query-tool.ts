import { createClient } from "@supabase/supabase-js";

/**
 * Allowed tables for read-only queries
 * Only these tables can be queried by the diagnostic agent
 */
const ALLOWED_TABLES = [
  "integrations",
  "agents",
  "leads",
  "call_logs",
  "call_tracking",
  "campaigns",
  "webhooks",
  "call_transcripts",
  "organizations",
];

/**
 * Initialize Supabase client with service role key for admin access
 */
function initializeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
  }

  return createClient(url, key);
}

/**
 * Queries the database for debugging information
 * Only allows SELECT queries on allowed tables
 *
 * @param query - SQL SELECT query (read-only)
 * @param table - Database table to query
 * @param filters - Optional filter conditions
 * @returns Query results or error message
 */
export async function queryDatabase(
  query: string,
  table: string,
  filters?: Record<string, any>
): Promise<string> {
  try {
    // Validate table is allowed
    if (!ALLOWED_TABLES.includes(table)) {
      return (
        `Table ${table} not allowed for security reasons.\n\n` +
        `Allowed tables: ${ALLOWED_TABLES.join(", ")}`
      );
    }

    // Reject write operations
    const upperQuery = query.toUpperCase();
    if (
      upperQuery.includes("INSERT") ||
      upperQuery.includes("UPDATE") ||
      upperQuery.includes("DELETE") ||
      upperQuery.includes("DROP") ||
      upperQuery.includes("ALTER")
    ) {
      return (
        `Write operations not allowed. Only SELECT queries are permitted.\n\n` +
        `You tried: ${query}`
      );
    }

    // Initialize Supabase
    const supabase = initializeSupabase();

    // Build query
    let q = supabase.from(table).select("*");

    // Apply filters if provided
    if (filters && Object.keys(filters).length > 0) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          q = q.is(key, null);
        } else if (Array.isArray(value)) {
          q = q.in(key, value);
        } else {
          q = q.eq(key, value);
        }
      }
    }

    // Limit results for safety
    const { data, error, count } = await q.limit(100);

    if (error) {
      return (
        `Database query error: ${error.message}\n\n` +
        `Query: ${query}\n` +
        `Table: ${table}`
      );
    }

    // Format results
    const rowCount = data?.length || 0;
    const summary = `Query returned ${rowCount} rows${count && count > 100 ? ` (100 of ${count} total)` : ""}`;

    if (rowCount === 0) {
      return summary + "\n\n(No results found)";
    }

    // Return formatted data (truncate if very large)
    const jsonOutput = JSON.stringify(data, null, 2);
    if (jsonOutput.length > 5000) {
      return (
        summary +
        "\n\n" +
        jsonOutput.substring(0, 5000) +
        "\n\n... (truncated, first 50 rows shown)"
      );
    }

    return summary + "\n\n" + jsonOutput;
  } catch (error: any) {
    return (
      `Query execution failed: ${error.message}\n\n` +
      `Query: ${query}\n` +
      `Table: ${table}`
    );
  }
}
