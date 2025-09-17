import { readFileSync } from "fs";
import { join } from "path";
import { CapturedWebhook } from "./capture.js";
import { executeWebhook } from "./http.js";
import { WebhookDefinition } from "./schema.js";
import { listJsonFiles } from "./utils/index.js";

export interface ReplayOptions {
  url?: string;
  method?: string;
  headers?: Array<{ key: string; value: string }>;
}

export class WebhookReplayer {
  constructor(private capturesDir: string) {}

  /**
   * List all captured webhooks
   */
  listCaptured(): Array<{ file: string; capture: CapturedWebhook }> {
    try {
      const files = listJsonFiles(this.capturesDir).sort().reverse();

      return files.map((file) => ({
        file,
        capture: this.loadCapture(join(this.capturesDir, file)),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Load a specific captured webhook by filename or ID
   */
  loadCapture(filePathOrId: string): CapturedWebhook {
    let filepath: string;

    if (filePathOrId.includes("/") || filePathOrId.endsWith(".json")) {
      filepath = filePathOrId;
    } else {
      // Try to find by ID
      const files = listJsonFiles(this.capturesDir).filter((f) =>
        f.includes(filePathOrId)
      );
      if (files.length === 0) {
        throw new Error(`No capture found with ID: ${filePathOrId}`);
      }
      if (files.length > 1) {
        throw new Error(
          `Multiple captures found with ID ${filePathOrId}: ${files.join(", ")}`
        );
      }
      filepath = join(this.capturesDir, files[0]!);
    }

    try {
      const content = readFileSync(filepath, "utf8");
      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(
        `Failed to load capture from ${filepath}: ${error.message}`
      );
    }
  }

  /**
   * Replay a captured webhook to a target URL
   */
  async replay(
    captureId: string,
    targetUrl: string,
    options: ReplayOptions = {}
  ) {
    const capture = this.loadCapture(captureId);

    // Convert captured webhook to WebhookDefinition format
    const webhookDef: WebhookDefinition = {
      url: options.url || targetUrl,
      method: (options.method || capture.method) as any,
      headers: options.headers || this.convertHeaders(capture.headers),
      body: capture.body,
    };

    console.log(`🔄 Replaying webhook ${capture.id} (${capture.timestamp})`);
    console.log(`   Method: ${webhookDef.method}`);
    console.log(`   URL: ${webhookDef.url}`);
    console.log(`   Original: ${capture.method} ${capture.url}`);

    try {
      const result = await executeWebhook(webhookDef);
      return result;
    } catch (error: any) {
      throw new Error(`Replay failed: ${error.message}`);
    }
  }

  /**
   * Convert captured webhook to template format
   */
  captureToTemplate(
    captureId: string,
    templateUrl?: string
  ): WebhookDefinition {
    const capture = this.loadCapture(captureId);

    return {
      url: templateUrl || "http://localhost:3000/webhook",
      method: capture.method as any,
      headers: this.convertHeaders(capture.headers),
      body: capture.body,
    };
  }

  /**
   * Convert captured headers to template format
   */
  private convertHeaders(
    headers: Record<string, string | string[]>
  ): Array<{ key: string; value: string }> {
    const result: Array<{ key: string; value: string }> = [];

    for (const [key, value] of Object.entries(headers)) {
      // Skip certain headers that shouldn't be replayed
      const skipHeaders = [
        "host",
        "content-length",
        "connection",
        "accept-encoding",
        "user-agent",
        "x-forwarded-for",
        "x-forwarded-proto",
      ];

      if (skipHeaders.includes(key.toLowerCase())) {
        continue;
      }

      if (Array.isArray(value)) {
        // For array values, create separate entries or join them
        if (value.length === 1) {
          result.push({ key, value: value[0]! });
        } else {
          result.push({ key, value: value.join(", ") });
        }
      } else {
        result.push({ key, value });
      }
    }

    return result;
  }

  /**
   * Get summary information about a capture
   */
  getCaptureSummary(captureId: string): string {
    const capture = this.loadCapture(captureId);
    const date = new Date(capture.timestamp);
    const bodySize = capture.rawBody ? capture.rawBody.length : 0;
    const headerCount = Object.keys(capture.headers).length;

    return [
      `ID: ${capture.id}`,
      `Date: ${date.toLocaleString()}`,
      `Method: ${capture.method}`,
      `Path: ${capture.url}`,
      `Headers: ${headerCount}`,
      `Body Size: ${bodySize} bytes`,
      `Query Params: ${Object.keys(capture.query).length}`,
    ].join("\n");
  }
}
