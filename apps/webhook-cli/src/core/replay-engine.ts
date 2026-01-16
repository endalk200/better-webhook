import { existsSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type {
  CapturedWebhook,
  CaptureFile,
  ReplayOptions,
  WebhookExecutionResult,
  HeaderEntry,
  WebhookTemplate,
} from "../types/index.js";
import { executeWebhook } from "./executor.js";

export class ReplayEngine {
  private capturesDir: string;

  constructor(capturesDir?: string) {
    this.capturesDir =
      capturesDir || join(homedir(), ".better-webhook", "captures");
  }

  /**
   * Get the captures directory
   */
  getCapturesDir(): string {
    return this.capturesDir;
  }

  /**
   * List all captured webhooks
   */
  listCaptures(limit = 100): CaptureFile[] {
    if (!existsSync(this.capturesDir)) {
      return [];
    }

    const files = readdirSync(this.capturesDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, limit);

    const captures: CaptureFile[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(this.capturesDir, file), "utf-8");
        const capture = JSON.parse(content) as CapturedWebhook;
        captures.push({ file, capture });
      } catch {
        // Skip invalid files
      }
    }

    return captures;
  }

  /**
   * Get a specific capture by ID or partial filename
   */
  getCapture(captureId: string): CaptureFile | null {
    const captures = this.listCaptures(1000);

    // Try exact ID match first
    let found = captures.find((c) => c.capture.id === captureId);
    if (found) return found;

    // Try partial filename match
    found = captures.find((c) => c.file.includes(captureId));
    if (found) return found;

    // Try partial ID match
    found = captures.find((c) => c.capture.id.startsWith(captureId));
    return found || null;
  }

  /**
   * Replay a captured webhook
   */
  async replay(
    captureId: string,
    options: ReplayOptions,
  ): Promise<WebhookExecutionResult> {
    const captureFile = this.getCapture(captureId);
    if (!captureFile) {
      throw new Error(`Capture not found: ${captureId}`);
    }

    const { capture } = captureFile;

    // Build headers - keep all original headers exactly as captured
    const headers: HeaderEntry[] = [];

    // Skip internal/connection headers that shouldn't be replayed
    const skipHeaders = [
      "host",
      "content-length",
      "connection",
      "accept-encoding",
    ];

    for (const [key, value] of Object.entries(capture.headers)) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        const headerValue = Array.isArray(value) ? value.join(", ") : value;
        if (headerValue) {
          headers.push({ key, value: headerValue });
        }
      }
    }

    // Add or override with custom headers
    if (options.headers) {
      for (const h of options.headers) {
        const existingIdx = headers.findIndex(
          (eh) => eh.key.toLowerCase() === h.key.toLowerCase(),
        );
        if (existingIdx >= 0) {
          headers[existingIdx] = h;
        } else {
          headers.push(h);
        }
      }
    }

    // Prepare body
    const body = capture.rawBody || capture.body;

    // Execute the webhook
    return executeWebhook({
      url: options.targetUrl,
      method: options.method || capture.method,
      headers,
      body,
    });
  }

  /**
   * Convert a capture to a template
   */
  captureToTemplate(
    captureId: string,
    options?: { url?: string; event?: string },
  ): WebhookTemplate {
    const captureFile = this.getCapture(captureId);
    if (!captureFile) {
      throw new Error(`Capture not found: ${captureId}`);
    }

    const { capture } = captureFile;

    // Filter out internal/signature headers
    const skipHeaders = [
      "host",
      "content-length",
      "connection",
      "accept-encoding",
      "stripe-signature",
      "x-hub-signature-256",
      "x-hub-signature",
      "x-shopify-hmac-sha256",
      "x-twilio-signature",
      "x-slack-signature",
      "svix-signature",
      "linear-signature",
    ];

    const headers: HeaderEntry[] = [];
    for (const [key, value] of Object.entries(capture.headers)) {
      if (!skipHeaders.includes(key.toLowerCase())) {
        const headerValue = Array.isArray(value) ? value.join(", ") : value;
        if (headerValue) {
          headers.push({ key, value: headerValue });
        }
      }
    }

    // Parse body
    let body: unknown;
    if (capture.body) {
      body = capture.body;
    } else if (capture.rawBody) {
      try {
        body = JSON.parse(capture.rawBody);
      } catch {
        body = capture.rawBody;
      }
    }

    // Detect event from headers/body if not provided
    const event = options?.event || this.detectEvent(capture);

    return {
      url: options?.url || `http://localhost:3000${capture.path}`,
      method: capture.method,
      headers,
      body,
      provider: capture.provider,
      event,
      description: `Captured ${capture.provider || "webhook"} at ${capture.timestamp}`,
    };
  }

  /**
   * Detect event type from captured webhook headers/body
   */
  private detectEvent(capture: CapturedWebhook): string | undefined {
    const headers = capture.headers;

    // GitHub: x-github-event header
    const githubEvent = headers["x-github-event"];
    if (githubEvent) {
      return Array.isArray(githubEvent) ? githubEvent[0] : githubEvent;
    }

    // Stripe: event type in body
    if (capture.provider === "stripe" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.type === "string") {
        return body.type;
      }
    }

    // Slack: event type in body
    if (capture.provider === "slack" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.type === "string") {
        return body.type;
      }
      const event = body.event as Record<string, unknown> | undefined;
      if (event && typeof event.type === "string") {
        return event.type;
      }
    }

    // Linear: event type in body
    if (capture.provider === "linear" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.type === "string") {
        return body.type;
      }
    }

    // Clerk/Svix: event type in body
    if (capture.provider === "clerk" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.type === "string") {
        return body.type;
      }
    }

    // Ragie: event type in body
    if (capture.provider === "ragie" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.event_type === "string") {
        return body.event_type;
      }
    }

    // Shopify: x-shopify-topic header
    const shopifyTopic = headers["x-shopify-topic"];
    if (shopifyTopic) {
      return Array.isArray(shopifyTopic) ? shopifyTopic[0] : shopifyTopic;
    }

    // SendGrid: Check for common event types in body
    if (capture.provider === "sendgrid" && Array.isArray(capture.body)) {
      const firstEvent = capture.body[0] as Record<string, unknown> | undefined;
      if (firstEvent && typeof firstEvent.event === "string") {
        return firstEvent.event;
      }
    }

    // Discord: Check for event type in body
    if (capture.provider === "discord" && capture.body) {
      const body = capture.body as Record<string, unknown>;
      if (typeof body.type === "number") {
        return `type_${body.type}`;
      }
    }

    // Fallback: Try common event field patterns for unknown providers
    if (capture.body && typeof capture.body === "object") {
      const body = capture.body as Record<string, unknown>;
      // Common patterns: type, event_type, event, action
      if (typeof body.type === "string") {
        return body.type;
      }
      if (typeof body.event_type === "string") {
        return body.event_type;
      }
      if (typeof body.event === "string") {
        return body.event;
      }
      if (typeof body.action === "string") {
        return body.action;
      }
    }

    return undefined;
  }

  /**
   * Get a summary of a capture
   */
  getCaptureSummary(captureId: string): string {
    const captureFile = this.getCapture(captureId);
    if (!captureFile) {
      return "Capture not found";
    }

    const { capture } = captureFile;
    const lines: string[] = [];

    lines.push(`ID: ${capture.id}`);
    lines.push(`Timestamp: ${new Date(capture.timestamp).toLocaleString()}`);
    lines.push(`Method: ${capture.method}`);
    lines.push(`Path: ${capture.path}`);

    if (capture.provider) {
      lines.push(`Provider: ${capture.provider}`);
    }

    lines.push(`Content-Type: ${capture.contentType || "unknown"}`);
    lines.push(`Body Size: ${capture.contentLength || 0} bytes`);

    const headerCount = Object.keys(capture.headers).length;
    lines.push(`Headers: ${headerCount}`);

    return lines.join("\n");
  }

  /**
   * Search captures
   */
  searchCaptures(query: string): CaptureFile[] {
    const queryLower = query.toLowerCase();
    const captures = this.listCaptures(1000);

    return captures.filter((c) => {
      const { capture } = c;
      return (
        capture.id.toLowerCase().includes(queryLower) ||
        capture.path.toLowerCase().includes(queryLower) ||
        capture.method.toLowerCase().includes(queryLower) ||
        capture.provider?.toLowerCase().includes(queryLower) ||
        c.file.toLowerCase().includes(queryLower)
      );
    });
  }

  /**
   * Get captures by provider
   */
  getCapturesByProvider(provider: string): CaptureFile[] {
    const captures = this.listCaptures(1000);
    return captures.filter((c) => c.capture.provider === provider);
  }

  /**
   * Delete a specific capture by ID
   * @returns true if deleted, false if not found
   */
  deleteCapture(captureId: string): boolean {
    const captureFile = this.getCapture(captureId);
    if (!captureFile) {
      return false;
    }

    try {
      unlinkSync(join(this.capturesDir, captureFile.file));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all captures
   * @returns Number of captures deleted
   */
  deleteAllCaptures(): number {
    if (!existsSync(this.capturesDir)) {
      return 0;
    }

    const files = readdirSync(this.capturesDir).filter((f) =>
      f.endsWith(".json"),
    );
    let deleted = 0;

    for (const file of files) {
      try {
        unlinkSync(join(this.capturesDir, file));
        deleted++;
      } catch {
        // Skip files that couldn't be deleted
      }
    }

    return deleted;
  }
}

// Singleton instance
let instance: ReplayEngine | null = null;

export function getReplayEngine(capturesDir?: string): ReplayEngine {
  if (!instance) {
    instance = new ReplayEngine(capturesDir);
  }
  return instance;
}
