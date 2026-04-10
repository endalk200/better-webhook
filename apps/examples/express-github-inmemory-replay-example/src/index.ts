import express from "express";
import { githubHandler } from "./webhooks/github.js";

const app = express();
const portValue = process.env.PORT ?? "3003";
const port = Number(portValue);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError(
    `PORT must be an integer between 1 and 65535. Received: ${portValue}`,
  );
}

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubHandler,
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(
    `Express GitHub in-memory replay example listening on http://localhost:${port}`,
  );
  console.log("Endpoints:");
  console.log(`- POST http://localhost:${port}/webhooks/github`);
  console.log(`- GET  http://localhost:${port}/health`);
  console.log("Required env vars:");
  console.log("- GITHUB_WEBHOOK_SECRET");
});
