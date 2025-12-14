import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Allowlist of safe diagnostic commands
 * Only these commands are allowed for execution via the diagnostic agent
 */
const ALLOWED_COMMANDS = [
  "ps",
  "lsof",
  "grep",
  "tail",
  "head",
  "cat",
  "curl",
  "curl --silent",
  "curl -v",
  "npm run",
  "npm list",
  "npm install",
  "git log",
  "git status",
  "git diff",
  "docker ps",
  "docker logs",
  "systemctl status",
  "date",
  "env",
  "whoami",
  "pwd",
  "ls",
  "find",
  "wc",
  "sort",
];

const PROJECT_ROOT = "/Users/mac/Desktop/voxanne-dashboard/backend";

/**
 * Validates if a command is safe to execute
 */
function isCommandAllowed(command: string): boolean {
  const lowerCommand = command.toLowerCase().trim();
  return ALLOWED_COMMANDS.some((allowed) =>
    lowerCommand.startsWith(allowed)
  );
}

/**
 * Executes a bash command safely with validation and restrictions
 * Used by diagnostic agent to gather system information
 *
 * @param command - Bash command to execute (must be in allowlist)
 * @param context - What you're trying to diagnose with this command
 * @returns Command output or error message
 */
export async function executeBashCommand(
  command: string,
  context: string
): Promise<string> {
  // Validate command is safe
  if (!isCommandAllowed(command)) {
    return (
      `Command not allowed for safety reasons: ${command}\n\n` +
      `Allowed commands: ${ALLOWED_COMMANDS.join(", ")}\n\n` +
      `Context: ${context}`
    );
  }

  try {
    // Execute in backend directory with safety limits
    const { stdout, stderr } = await execAsync(command, {
      cwd: PROJECT_ROOT,
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      shell: "/bin/bash",
    });

    // Return output
    const output =
      stdout.trim() || stderr.trim()
        ? `${stdout}${stderr ? `\n--- STDERR ---\n${stderr}` : ""}`
        : "(command completed with no output)";

    return `Command executed successfully:\n\n${output}`;
  } catch (error: any) {
    // Return error details for debugging
    const errorMessage =
      error.message || "Unknown error";
    const stderr = error.stderr || "";
    const stdout = error.stdout || "";

    return (
      `Command execution failed: ${errorMessage}\n\n` +
      (stdout ? `Stdout:\n${stdout}\n\n` : "") +
      (stderr ? `Stderr:\n${stderr}` : "")
    );
  }
}
