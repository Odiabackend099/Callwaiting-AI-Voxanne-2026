import { execSync } from "child_process";
import { existsSync } from "fs";

/**
 * Map of log types to their file paths
 * Only these logs can be read for security
 */
const LOG_PATHS: Record<string, string> = {
  app: "/Users/mac/Desktop/voxanne-dashboard/backend/logs/app.log",
  backend:
    "/Users/mac/Desktop/voxanne-dashboard/backend/logs/backend.log",
  error:
    "/Users/mac/Desktop/voxanne-dashboard/backend/logs/error.log",
  nginx: "/var/log/nginx/error.log",
  system: "/var/log/system.log",
  database:
    "/Users/mac/Desktop/voxanne-dashboard/backend/logs/db.log",
};

/**
 * Reads and analyzes error logs
 * Supports filtering and limiting output
 *
 * @param logType - Type of log to read (app, nginx, system, database)
 * @param lines - Number of recent lines to read (default 50)
 * @param filter - Optional grep filter pattern
 * @returns Log contents or error message
 */
export async function readErrorLogs(
  logType: string,
  lines: number = 50,
  filter?: string
): Promise<string> {
  try {
    // Validate log type
    const logPath = LOG_PATHS[logType];
    if (!logPath) {
      return (
        `Invalid log type: ${logType}\n\n` +
        `Available log types: ${Object.keys(LOG_PATHS).join(", ")}`
      );
    }

    // Check if log file exists
    if (!existsSync(logPath)) {
      return (
        `Log file not found: ${logPath}\n\n` +
        `This log type may not have been created yet. ` +
        `Check if the application is running and generating logs.`
      );
    }

    // Limit lines to reasonable amount
    const maxLines = Math.min(lines, 500);

    // Build grep filter if provided
    let cmd = `tail -n ${maxLines} "${logPath}"`;
    if (filter) {
      cmd += ` | grep "${filter}"`;
    }

    // Execute command with timeout
    try {
      const output = execSync(cmd, {
        timeout: 5000, // 5 second timeout
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
      });

      // Return formatted output
      const lineCount = output.split("\n").filter((l) => l.trim()).length;
      return (
        `Last ${Math.min(maxLines, lineCount)} lines from ${logType} logs:\n\n` +
        output
      );
    } catch (execError: any) {
      // Handle case where grep returns no matches
      if (
        execError.code === 1 &&
        execError.stderr === "" &&
        filter
      ) {
        return (
          `No log lines found matching filter: "${filter}"\n\n` +
          `Try searching without a filter or use a different pattern.`
        );
      }
      throw execError;
    }
  } catch (error: any) {
    return (
      `Error reading logs: ${error.message}\n\n` +
      `Log type: ${logType}\n` +
      `Path attempted: ${LOG_PATHS[logType] || "unknown"}`
    );
  }
}

/**
 * Analyzes logs for common error patterns
 *
 * @param logContents - Raw log contents to analyze
 * @returns Analysis summary with recommendations
 */
export function analyzeLogs(logContents: string): string {
  const lines = logContents.split("\n");
  const errors: string[] = [];
  const warnings: string[] = [];
  const timeouts: string[] = [];
  const authErrors: string[] = [];

  for (const line of lines) {
    if (
      line.includes("ERROR") ||
      line.includes("error") ||
      line.includes("failed") ||
      line.includes("Failed")
    ) {
      errors.push(line.trim());
    }
    if (line.includes("WARN") || line.includes("warn")) {
      warnings.push(line.trim());
    }
    if (
      line.includes("timeout") ||
      line.includes("Timeout") ||
      line.includes("TIMEOUT")
    ) {
      timeouts.push(line.trim());
    }
    if (
      line.includes("401") ||
      line.includes("403") ||
      line.includes("unauthorized") ||
      line.includes("Unauthorized")
    ) {
      authErrors.push(line.trim());
    }
  }

  // Build analysis
  let analysis = "## Log Analysis Summary\n\n";

  if (errors.length > 0) {
    analysis += `### Errors (${errors.length} found)\n`;
    analysis += errors.slice(0, 5).join("\n");
    if (errors.length > 5) {
      analysis += `\n... and ${errors.length - 5} more\n`;
    }
    analysis += "\n";
  }

  if (authErrors.length > 0) {
    analysis += `### Authentication/Authorization Issues (${authErrors.length} found)\n`;
    analysis += authErrors.slice(0, 3).join("\n");
    if (authErrors.length > 3) {
      analysis += `\n... and ${authErrors.length - 3} more\n`;
    }
    analysis += "\n";
  }

  if (timeouts.length > 0) {
    analysis += `### Timeouts (${timeouts.length} found)\n`;
    analysis += timeouts.slice(0, 3).join("\n");
    if (timeouts.length > 3) {
      analysis += `\n... and ${timeouts.length - 3} more\n`;
    }
    analysis += "\n";
  }

  if (warnings.length > 0) {
    analysis += `### Warnings (${warnings.length} found)\n`;
    analysis += warnings.slice(0, 3).join("\n");
    if (warnings.length > 3) {
      analysis += `\n... and ${warnings.length - 3} more\n`;
    }
    analysis += "\n";
  }

  if (errors.length === 0 && authErrors.length === 0 && timeouts.length === 0) {
    analysis += "No obvious errors, authentication issues, or timeouts detected.\n";
  }

  return analysis;
}
