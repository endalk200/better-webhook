import { request } from "undici";
import type {
  WebhookExecutionOptions,
  WebhookExecutionResult,
  HeaderEntry,
  WebhookTemplate,
  WebhookProvider,
} from "../types/index.js";
import { generateSignature, getProviderHeaders } from "./signature.js";

/**
 * Execute a webhook request
 */
export async function executeWebhook(
  options: WebhookExecutionOptions,
): Promise<WebhookExecutionResult> {
  const startTime = Date.now();

  // Prepare body
  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    bodyStr =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  // Build headers
  const headers: Record<string, string> = {};

  // Add provider-specific headers first
  if (options.provider) {
    const providerHeaders = getProviderHeaders(options.provider);
    for (const h of providerHeaders) {
      headers[h.key] = h.value;
    }
  }

  // Add custom headers (can override provider headers)
  if (options.headers) {
    for (const h of options.headers) {
      headers[h.key] = h.value;
    }
  }

  // Generate signature if secret provided
  if (options.secret && options.provider && bodyStr) {
    const timestampHeader =
      headers["Webhook-Timestamp"] ||
      headers["webhook-timestamp"] ||
      headers["Svix-Timestamp"] ||
      headers["svix-timestamp"] ||
      headers["X-Slack-Request-Timestamp"] ||
      headers["x-slack-request-timestamp"] ||
      headers["X-Twilio-Email-Event-Webhook-Timestamp"] ||
      headers["x-twilio-email-event-webhook-timestamp"];
    const parsedTimestamp = timestampHeader
      ? Number.parseInt(timestampHeader, 10)
      : undefined;
    const timestamp = Number.isFinite(parsedTimestamp)
      ? parsedTimestamp
      : undefined;

    const webhookId =
      headers["Webhook-Id"] ||
      headers["webhook-id"] ||
      headers["Svix-Id"] ||
      headers["svix-id"] ||
      headers["X-GitHub-Delivery"] ||
      headers["x-github-delivery"];

    const sig = generateSignature(options.provider, bodyStr, options.secret, {
      url: options.url,
      timestamp,
      webhookId,
    });
    if (sig) {
      headers[sig.header] = sig.value;
    }
  }

  // Ensure Content-Type is set
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await request(options.url, {
      method: options.method || "POST",
      headers,
      body: bodyStr,
      headersTimeout: options.timeout || 30000,
      bodyTimeout: options.timeout || 30000,
    });

    const bodyText = await response.body.text();
    const duration = Date.now() - startTime;

    // Convert headers
    const responseHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        responseHeaders[key] = value;
      }
    }

    // Try to parse JSON
    let json: unknown;
    try {
      json = JSON.parse(bodyText);
    } catch {
      // Not JSON
    }

    return {
      status: response.statusCode,
      statusText: getStatusText(response.statusCode),
      headers: responseHeaders,
      body: json ?? bodyText,
      bodyText,
      json,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    throw new ExecutionError(error.message, duration);
  }
}

/**
 * Execute a template
 */
export async function executeTemplate(
  template: WebhookTemplate,
  options: {
    url?: string;
    secret?: string;
    headers?: HeaderEntry[];
  } = {},
): Promise<WebhookExecutionResult> {
  const targetUrl = options.url || template.url;
  if (!targetUrl) {
    throw new Error(
      "No target URL specified. Use --url or set url in template.",
    );
  }

  // Merge headers
  const mergedHeaders = [...(template.headers || [])];
  if (options.headers) {
    for (const h of options.headers) {
      const existingIdx = mergedHeaders.findIndex(
        (mh) => mh.key.toLowerCase() === h.key.toLowerCase(),
      );
      if (existingIdx >= 0) {
        mergedHeaders[existingIdx] = h;
      } else {
        mergedHeaders.push(h);
      }
    }
  }

  return executeWebhook({
    url: targetUrl,
    method: template.method,
    headers: mergedHeaders,
    body: template.body,
    secret: options.secret,
    provider: template.provider,
  });
}

/**
 * Custom execution error
 */
export class ExecutionError extends Error {
  duration: number;

  constructor(message: string, duration: number) {
    super(message);
    this.name = "ExecutionError";
    this.duration = duration;
  }
}

/**
 * Get HTTP status text from code
 */
function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  return statusTexts[code] || "Unknown";
}
