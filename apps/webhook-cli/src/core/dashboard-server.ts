import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import {
  createDashboardApiRouter,
  type DashboardApiOptions,
} from "./dashboard-api.js";
import { CaptureServer } from "./capture-server.js";
import { ReplayEngine } from "./replay-engine.js";
import { TemplateManager } from "./template-manager.js";
import type { WebSocketMessage } from "../types/index.js";

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
    // Dev from src/core -> dist/dashboard
    path.resolve(runtimeDir, "..", "..", "dist", "dashboard"),
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
  // Prefer CJS `__dirname`, but fall back to ESM `import.meta.url`,
  // while keeping esbuild happy for CJS output.
  // eslint-disable-next-line no-undef
  const runtimeDir =
    typeof __dirname !== "undefined"
      ? // eslint-disable-next-line no-undef
        __dirname
      : path.dirname(fileURLToPath(import.meta.url));
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
