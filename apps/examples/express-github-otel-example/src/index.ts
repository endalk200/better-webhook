import express from "express";
import { stopTelemetry, startTelemetry } from "./telemetry.js";
import { githubHandler } from "./webhooks/github.js";

const app = express();
const port = Number(process.env.PORT ?? "3004");

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubHandler,
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}, shutting down telemetry example`);
  await stopTelemetry();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void (async () => {
  await startTelemetry();

  app.listen(port, () => {
    console.log(
      `Express GitHub OpenTelemetry example listening on http://localhost:${port}`,
    );
    console.log("Endpoints:");
    console.log(`- POST http://localhost:${port}/webhooks/github`);
    console.log(`- GET  http://localhost:${port}/health`);
    console.log("Required env vars:");
    console.log("- GITHUB_WEBHOOK_SECRET");
  });
})();
