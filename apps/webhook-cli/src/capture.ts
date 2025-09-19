import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export interface CapturedWebhook {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body: any;
  rawBody: string;
  query: Record<string, string | string[]>;
}

export class WebhookCaptureServer {
  private server: ReturnType<typeof createServer> | null = null;
  private capturesDir: string;

  constructor(capturesDir: string) {
    this.capturesDir = capturesDir;
    // Ensure captures directory exists
    if (!existsSync(capturesDir)) {
      mkdirSync(capturesDir, { recursive: true });
    }
  }

  start(startPort: number = 3001, maxAttempts: number = 20): Promise<number> {
    return new Promise((resolve, reject) => {
      // Normalize starting port
      if (!Number.isInteger(startPort) || startPort < 0 || startPort > 65535) {
        startPort = 3001;
      }

      let attempt = 0;
      const tryListen = (portToTry: number) => {
        this.server = createServer(
          async (req: IncomingMessage, res: ServerResponse) => {
            try {
              await this.handleRequest(req, res);
            } catch (error) {
              console.error("Error handling request:", error);
              res.statusCode = 500;
              res.end("Internal Server Error");
            }
          },
        );

        const onError = (err: any) => {
          this.server?.off("error", onError);
          this.server?.off("listening", onListening);
          if (err && err.code === "EADDRINUSE") {
            attempt += 1;
            if (startPort === 0) {
              // If port 0 was requested, let Node choose a free port once; do not retry
              reject(new Error("Failed to bind to an ephemeral port."));
              return;
            }
            if (attempt >= maxAttempts) {
              reject(
                new Error(
                  `All ${maxAttempts} port attempts starting at ${startPort} are in use.`,
                ),
              );
              return;
            }
            const nextPort = startPort + attempt;
            tryListen(nextPort);
          } else {
            reject(err);
          }
        };

        const onListening = () => {
          this.server?.off("error", onError);
          this.server?.off("listening", onListening);
          const address = this.server?.address() as any;
          const actualPort = address?.port ?? portToTry;
          console.log(
            `🎣 Webhook capture server running on http://localhost:${actualPort}`,
          );
          console.log(
            `📁 Captured webhooks will be saved to: ${this.capturesDir}`,
          );
          console.log(
            "💡 Send webhooks to any path on this server to capture them",
          );
          console.log("⏹️  Press Ctrl+C to stop the server");
          resolve(actualPort);
        };

        this.server.on("error", onError);
        this.server.on("listening", onListening);
        this.server.listen(portToTry);
      };

      // If port is 0, let the OS pick a free port
      tryListen(startPort === 0 ? 0 : startPort);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log("📴 Webhook capture server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = this.generateId();

    // Parse URL and query parameters
    const url = req.url || "/";
    const urlParts = new URL(url, `http://${req.headers.host || "localhost"}`);
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
    req.on("data", (chunk) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      req.on("end", () => resolve());
    });

    const rawBody = Buffer.concat(chunks).toString("utf8");
    let parsedBody: any;

    // Try to parse body as JSON
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // If not JSON, keep as string
      parsedBody = rawBody || null;
    }

    // Create captured webhook object
    const captured: CapturedWebhook = {
      id,
      timestamp,
      method: req.method || "GET",
      url: urlParts.pathname,
      headers: req.headers as Record<string, string | string[]>,
      body: parsedBody,
      rawBody,
      query,
    };

    // Save to file
    const filename = `${timestamp.replace(/[:.]/g, "-")}_${id}.json`;
    const filepath = join(this.capturesDir, filename);

    try {
      writeFileSync(filepath, JSON.stringify(captured, null, 2));
      console.log(
        `📦 Captured ${req.method} ${urlParts.pathname} -> ${filename}`,
      );
    } catch (error) {
      console.error(`❌ Failed to save capture: ${error}`);
    }

    // Send response
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        {
          message: "Webhook captured successfully",
          id,
          timestamp,
          file: filename,
        },
        null,
        2,
      ),
    );
  }

  private generateId(): string {
    try {
      return randomUUID();
    } catch {
      // Fallback, extremely unlikely path
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}
