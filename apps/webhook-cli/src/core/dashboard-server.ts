import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import path from "path";
import { existsSync, readFileSync } from "fs";
import {
  createDashboardApiRouter,
  type DashboardApiOptions,
} from "./dashboard-api.js";
import { CaptureServer } from "./capture-server.js";
import { ReplayEngine } from "./replay-engine.js";
import { TemplateManager } from "./template-manager.js";
import type { WebSocketMessage } from "../types/index.js";

// Type declarations for Bun runtime (only available in standalone binary)
declare const Bun:
  | {
      file: (path: string) => {
        arrayBuffer: () => Promise<ArrayBuffer>;
        text: () => Promise<string>;
        exists: () => Promise<boolean>;
      };
    }
  | undefined;

// Build-time flag for standalone binary mode (set via --define)
declare const STANDALONE_BINARY: boolean | undefined;

// Extend globalThis to include embedded dashboard files (set by binary wrapper)
declare global {
  // eslint-disable-next-line no-var
  var embeddedDashboardFiles: Record<string, string> | undefined;
}

/**
 * Check if running as a standalone Bun-compiled binary with embedded files.
 */
function isStandaloneBinary(): boolean {
  // Check build-time flag
  if (typeof STANDALONE_BINARY !== "undefined" && STANDALONE_BINARY) {
    return true;
  }
  // Fallback: check if embedded files are available at runtime
  if (
    typeof globalThis.embeddedDashboardFiles !== "undefined" &&
    globalThis.embeddedDashboardFiles
  ) {
    return true;
  }
  return false;
}

/**
 * Get MIME type based on file extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Create Express middleware to serve dashboard from Bun embedded files.
 * Uses the file paths imported with { type: "file" } attribute.
 */
function createEmbeddedDashboardMiddleware(): {
  staticMiddleware: express.RequestHandler;
  spaFallback: express.RequestHandler;
} {
  // Build a map of serve paths to embedded file paths
  const filePathMap = new Map<string, string>();
  let indexHtmlPath: string | null = null;

  if (typeof globalThis.embeddedDashboardFiles !== "undefined") {
    for (const [key, filePath] of Object.entries(
      globalThis.embeddedDashboardFiles,
    )) {
      // key is like "dashboard/index.html", we want to serve at "/index.html"
      const servePath = "/" + key.replace(/^dashboard\//, "");
      filePathMap.set(servePath, filePath);
      if (servePath === "/index.html") {
        indexHtmlPath = filePath;
      }
    }
  }

  const staticMiddleware: express.RequestHandler = async (req, res, next) => {
    if (!Bun) {
      return next();
    }

    const requestPath = req.path === "/" ? "/index.html" : req.path;
    const filePath = filePathMap.get(requestPath);

    if (filePath) {
      try {
        const file = Bun.file(filePath);
        const content = await file.arrayBuffer();
        res.setHeader("Content-Type", getMimeType(requestPath));
        res.setHeader("Content-Length", content.byteLength);
        res.send(Buffer.from(content));
      } catch (err) {
        console.error(`Failed to serve embedded file ${requestPath}:`, err);
        next();
      }
    } else {
      next();
    }
  };

  const spaFallback: express.RequestHandler = async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      return next();
    }

    if (!Bun || !indexHtmlPath) {
      return next();
    }

    try {
      const file = Bun.file(indexHtmlPath);
      const content = await file.arrayBuffer();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Length", content.byteLength);
      res.send(Buffer.from(content));
    } catch {
      next();
    }
  };

  return { staticMiddleware, spaFallback };
}

function resolveRuntimeDir(): string {
  // In bundled CJS output, __dirname points to dist/.
  // eslint-disable-next-line no-undef
  if (typeof __dirname !== "undefined") {
    // eslint-disable-next-line no-undef
    return __dirname;
  }

  // In ESM/dev execution, resolve from the entry script location.
  const entryPath = process.argv[1];
  if (entryPath) {
    return path.dirname(path.resolve(entryPath));
  }

  return process.cwd();
}

function resolveDashboardDistDir(runtimeDir: string): {
  distDir: string;
  indexHtml: string;
} {
  // When running from a published/bundled CLI, runtimeDir is typically:
  //   .../node_modules/@better-webhook/cli/dist
  // and dashboard assets are at:
  //   .../node_modules/@better-webhook/cli/dist/dashboard
  //
  // When running from source via tsx, runtimeDir is typically:
  //   .../apps/webhook-cli/src/core
  // and we can serve either:
  //   .../apps/webhook-cli/dist/dashboard (if CLI was built), OR
  //   .../apps/dashboard/dist (if dashboard was built)
  const candidates = [
    // Bundled CLI: dist/index.js -> dist/dashboard
    path.resolve(runtimeDir, "dashboard"),
    // Legacy/unbundled: dist/core -> dist/dashboard
    path.resolve(runtimeDir, "..", "dashboard"),
    // Dev from src -> dist/dashboard
    path.resolve(runtimeDir, "..", "dist", "dashboard"),
    // Dev from src/core -> dist/dashboard
    path.resolve(runtimeDir, "..", "..", "dist", "dashboard"),
    // Dev from src -> apps/dashboard/dist
    path.resolve(runtimeDir, "..", "..", "dashboard", "dist"),
    // Dev from src/core -> apps/dashboard/dist
    path.resolve(runtimeDir, "..", "..", "..", "dashboard", "dist"),
  ];

  for (const distDir of candidates) {
    const indexHtml = path.join(distDir, "index.html");
    if (existsSync(indexHtml)) {
      return { distDir, indexHtml };
    }
  }

  const details = candidates.map((p) => `- ${p}`).join("\n");
  throw new Error(
    `Dashboard UI build output not found.\n` +
      `Looked in:\n${details}\n\n` +
      `Build it with:\n` +
      `- pnpm --filter @better-webhook/dashboard build\n` +
      `- pnpm --filter @better-webhook/cli build\n`,
  );
}

export interface DashboardServerOptions extends DashboardApiOptions {
  host?: string;
  port?: number;
  captureHost?: string;
  capturePort?: number;
  /**
   * Start the capture server in-process (default: true).
   */
  startCapture?: boolean;
}

export async function startDashboardServer(
  options: DashboardServerOptions = {},
): Promise<{
  app: express.Express;
  server: Server;
  url: string;
  capture?: { server: CaptureServer; url: string };
}> {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const clients = new Set<WebSocket>();
  const broadcast = (message: WebSocketMessage) => {
    const data = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  };

  app.use(
    "/api",
    createDashboardApiRouter({
      capturesDir: options.capturesDir,
      templatesBaseDir: options.templatesBaseDir,
      broadcast,
    }),
  );

  const host = options.host || "localhost";
  const port = options.port ?? 4000;

  // Serve the bundled dashboard UI.
  // When running as a standalone binary, serve from Bun.embeddedFiles.
  // Otherwise, serve from the filesystem.
  if (isStandaloneBinary()) {
    const { staticMiddleware, spaFallback } =
      createEmbeddedDashboardMiddleware();
    app.use(staticMiddleware);
    app.get("*", spaFallback);
  } else {
    const runtimeDir = resolveRuntimeDir();
    const { distDir: dashboardDistDir, indexHtml: dashboardIndexHtml } =
      resolveDashboardDistDir(runtimeDir);

    app.use(express.static(dashboardDistDir));

    // SPA fallback (keep after /api)
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/health") return next();
      res.sendFile(dashboardIndexHtml, (err) => {
        if (err) next();
      });
    });
  }

  const server = createServer(app);

  // Dashboard WebSocket endpoint: ws://host:port/ws
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", async (ws) => {
    clients.add(ws);

    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));

    // Send initial state snapshot
    const replayEngine = new ReplayEngine(options.capturesDir);
    const templateManager = new TemplateManager(options.templatesBaseDir);

    const captures = replayEngine.listCaptures(200);
    ws.send(
      JSON.stringify({
        type: "captures_updated",
        payload: { captures, count: captures.length },
      } satisfies WebSocketMessage),
    );

    const local = templateManager.listLocalTemplates();
    let remote: any[] = [];
    try {
      // Prefer freshest remote index for the dashboard snapshot.
      // If offline/unavailable, TemplateManager will fall back to stale cache.
      const index = await templateManager.fetchRemoteIndex(true);
      const localIds = new Set(local.map((t) => t.id));
      remote = index.templates.map((metadata) => ({
        metadata,
        isDownloaded: localIds.has(metadata.id),
      }));
    } catch {
      remote = [];
    }

    ws.send(
      JSON.stringify({
        type: "templates_updated",
        payload: { local, remote },
      } satisfies WebSocketMessage),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on("error", reject);
  });

  const url = `http://${host}:${port}`;

  // Start capture server in-process (dedicated port)
  let capture:
    | {
        server: CaptureServer;
        url: string;
      }
    | undefined;

  const shouldStartCapture = options.startCapture !== false;
  if (shouldStartCapture) {
    const captureHost = options.captureHost || "0.0.0.0";
    const capturePort = options.capturePort ?? 3001;
    const captureServer = new CaptureServer({
      capturesDir: options.capturesDir,
      enableWebSocket: false,
      onCapture: ({ file, capture }) => {
        broadcast({
          type: "capture",
          payload: { file, capture },
        });
      },
    });

    const actualPort = await captureServer.start(capturePort, captureHost);
    capture = {
      server: captureServer,
      url: `http://${captureHost === "0.0.0.0" ? "localhost" : captureHost}:${actualPort}`,
    };
  }

  return { app, server, url, capture };
}
