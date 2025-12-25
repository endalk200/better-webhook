import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
  type Server,
} from "http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { homedir } from "os";
import type {
  CapturedWebhook,
  CaptureFile,
  WebhookProvider,
  WebSocketMessage,
} from "../types/index.js";

export class CaptureServer {
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private capturesDir: string;
  private clients: Set<WebSocket> = new Set();
  private captureCount = 0;

  constructor(capturesDir?: string) {
    this.capturesDir =
      capturesDir || join(homedir(), ".better-webhook", "captures");

    // Ensure captures directory exists
    if (!existsSync(this.capturesDir)) {
      mkdirSync(this.capturesDir, { recursive: true });
    }
  }

  /**
   * Get the captures directory path
   */
  getCapturesDir(): string {
    return this.capturesDir;
  }

  /**
   * Start the capture server
   */
  async start(port = 3001, host = "0.0.0.0"): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      // Create WebSocket server on the same port
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on("connection", (ws) => {
        this.clients.add(ws);
        console.log("📡 Dashboard connected via WebSocket");

        ws.on("close", () => {
          this.clients.delete(ws);
          console.log("📡 Dashboard disconnected");
        });

        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
          this.clients.delete(ws);
        });

        // Send current state on connection
        this.sendToClient(ws, {
          type: "captures_updated",
          payload: {
            captures: this.listCaptures(),
            count: this.captureCount,
          },
        });
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server.listen(port, host, () => {
        const address = this.server?.address();
        const actualPort =
          typeof address === "object" ? address?.port || port : port;
        console.log(`\n🎣 Webhook Capture Server`);
        console.log(
          `   Listening on http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}`,
        );
        console.log(`   📁 Captures saved to: ${this.capturesDir}`);
        console.log(`   💡 Send webhooks to any path to capture them`);
        console.log(`   🌐 WebSocket available for real-time updates`);
        console.log(`   ⏹️  Press Ctrl+C to stop\n`);
        resolve(actualPort);
      });
    });
  }

  /**
   * Stop the capture server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      for (const client of this.clients) {
        client.close();
      }
      this.clients.clear();

      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      if (this.server) {
        this.server.close(() => {
          console.log("\n🛑 Capture server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Skip WebSocket upgrade requests
    if (req.headers.upgrade?.toLowerCase() === "websocket") {
      return;
    }

    const timestamp = new Date().toISOString();
    const id = randomUUID();

    // Parse URL
    const url = req.url || "/";
    const urlParts = new URL(url, `http://${req.headers.host || "localhost"}`);

    // Parse query parameters
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of urlParts.searchParams.entries()) {
      if (query[key]) {
        if (Array.isArray(query[key])) {
          (query[key] as string[]).push(value);
        } else {
          query[key] = [query[key] as string, value];
        }
      } else {
        query[key] = value;
      }
    }

    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

    // Parse body
    let body: unknown = null;
    const contentType = req.headers["content-type"] || "";

    if (rawBody) {
      if (contentType.includes("application/json")) {
        try {
          body = JSON.parse(rawBody);
        } catch {
          body = rawBody;
        }
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        body = Object.fromEntries(new URLSearchParams(rawBody));
      } else {
        body = rawBody;
      }
    }

    // Detect provider from headers
    const provider = this.detectProvider(req.headers);

    // Create captured webhook object
    const captured: CapturedWebhook = {
      id,
      timestamp,
      method: (req.method || "GET") as CapturedWebhook["method"],
      url,
      path: urlParts.pathname,
      headers: req.headers as Record<string, string | string[]>,
      body,
      rawBody,
      query,
      provider,
      contentType: contentType || undefined,
      contentLength: rawBody.length,
    };

    // Save to file
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date
      .toISOString()
      .split("T")[1]
      ?.replace(/[:.]/g, "-")
      .slice(0, 8);
    const filename = `${dateStr}_${timeStr}_${id.slice(0, 8)}.json`;
    const filepath = join(this.capturesDir, filename);

    try {
      writeFileSync(filepath, JSON.stringify(captured, null, 2));
      this.captureCount++;

      const providerStr = provider ? ` [${provider}]` : "";
      console.log(
        `📦 ${req.method} ${urlParts.pathname}${providerStr} -> ${filename}`,
      );

      // Broadcast to connected clients
      this.broadcast({
        type: "capture",
        payload: {
          file: filename,
          capture: captured,
        },
      });
    } catch (error) {
      console.error(`❌ Failed to save capture:`, error);
    }

    // Send response
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Capture-Id", id);
    res.end(
      JSON.stringify({
        success: true,
        message: "Webhook captured successfully",
        id,
        timestamp,
        file: filename,
      }),
    );
  }

  /**
   * Detect webhook provider from headers
   */
  private detectProvider(
    headers: Record<string, string | string[] | undefined>,
  ): WebhookProvider | undefined {
    // Stripe
    if (headers["stripe-signature"]) {
      return "stripe";
    }

    // GitHub
    if (headers["x-github-event"] || headers["x-hub-signature-256"]) {
      return "github";
    }

    // Shopify
    if (headers["x-shopify-hmac-sha256"] || headers["x-shopify-topic"]) {
      return "shopify";
    }

    // Twilio
    if (headers["x-twilio-signature"]) {
      return "twilio";
    }

    // SendGrid
    if (headers["x-twilio-email-event-webhook-signature"]) {
      return "sendgrid";
    }

    // Slack
    if (headers["x-slack-signature"]) {
      return "slack";
    }

    // Discord
    if (headers["x-signature-ed25519"]) {
      return "discord";
    }

    // Linear
    if (headers["linear-signature"]) {
      return "linear";
    }

    // Clerk (Svix)
    if (headers["svix-signature"]) {
      return "clerk";
    }

    return undefined;
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(data);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: WebSocket, message: WebSocketMessage): void {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
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
   * Get a specific capture by ID
   */
  getCapture(captureId: string): CaptureFile | null {
    const captures = this.listCaptures(1000);
    return (
      captures.find(
        (c) => c.capture.id === captureId || c.file.includes(captureId),
      ) || null
    );
  }

  /**
   * Delete a capture
   */
  deleteCapture(captureId: string): boolean {
    const capture = this.getCapture(captureId);
    if (!capture) {
      return false;
    }

    try {
      const fs = require("fs");
      fs.unlinkSync(join(this.capturesDir, capture.file));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
let instance: CaptureServer | null = null;

export function getCaptureServer(capturesDir?: string): CaptureServer {
  if (!instance) {
    instance = new CaptureServer(capturesDir);
  }
  return instance;
}
