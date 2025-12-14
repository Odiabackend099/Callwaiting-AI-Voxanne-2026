import axios, { AxiosError } from "axios";

/**
 * List of allowed endpoint patterns
 * Only these patterns are allowed for health checking
 */
const ALLOWED_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "render.com",
  "internal",
  "voxanne-dashboard",
];

/**
 * Validates if an endpoint is safe to check
 */
function isEndpointAllowed(endpoint: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => endpoint.includes(pattern));
}

/**
 * Checks the health of an API endpoint
 * Used to verify connectivity and basic functionality
 *
 * @param endpoint - API endpoint URL to check
 * @param timeout - Timeout in seconds (default 5)
 * @returns Health check results or error message
 */
export async function checkApiHealth(
  endpoint: string,
  timeout: number = 5
): Promise<string> {
  // Validate endpoint is safe
  if (!isEndpointAllowed(endpoint)) {
    return (
      `Endpoint check not allowed for security reasons: ${endpoint}\n\n` +
      `Only internal endpoints allowed:\n` +
      `  - localhost and 127.0.0.1\n` +
      `  - render.com domains\n` +
      `  - Internal service addresses`
    );
  }

  try {
    // Make health check request with timeout
    const response = await axios.get(endpoint, {
      timeout: timeout * 1000,
      validateStatus: () => true, // Don't throw on any status code
      maxRedirects: 5,
    });

    // Parse response
    const statusCode = response.status;
    const statusText = response.statusText;
    const contentType = response.headers["content-type"] || "unknown";
    const contentLength = response.headers["content-length"] || "unknown";

    // Format body for output (truncate if large)
    let bodyText = "";
    if (response.data) {
      if (typeof response.data === "object") {
        bodyText = JSON.stringify(response.data, null, 2);
      } else {
        bodyText = response.data.toString();
      }
      if (bodyText.length > 500) {
        bodyText = bodyText.substring(0, 500) + "\n... (truncated)";
      }
    }

    // Determine health status
    const isHealthy = statusCode >= 200 && statusCode < 300;
    const healthStatus = isHealthy ? "✓ HEALTHY" : "✗ UNHEALTHY";

    return (
      `${healthStatus}\n\n` +
      `Endpoint: ${endpoint}\n` +
      `Status: ${statusCode} ${statusText}\n` +
      `Content-Type: ${contentType}\n` +
      `Content-Length: ${contentLength}\n` +
      (bodyText ? `\nBody:\n${bodyText}` : "")
    );
  } catch (error: any) {
    const axiosError = error as AxiosError;

    if (error.code === "ECONNREFUSED") {
      return (
        `✗ UNHEALTHY - Connection refused\n\n` +
        `Endpoint: ${endpoint}\n` +
        `Error: Cannot connect to the endpoint. The server may be down.\n` +
        `Suggestion: Check if the backend is running with 'npm run dev'`
      );
    }

    if (error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
      return (
        `✗ UNHEALTHY - ${error.code}\n\n` +
        `Endpoint: ${endpoint}\n` +
        `Error: ${error.message}`
      );
    }

    return (
      `✗ UNHEALTHY - Health check failed\n\n` +
      `Endpoint: ${endpoint}\n` +
      `Error: ${error.message}`
    );
  }
}
