import express from "express";
import { githubHandler } from "./webhooks/github.js";
import { ragieHandler } from "./webhooks/ragie.js";
import { recallHandler } from "./webhooks/recall.js";
import { stripeHandler } from "./webhooks/stripe.js";

const app = express();
const port = Number(process.env.PORT ?? "3001");

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  githubHandler,
);

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  ragieHandler,
);

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeHandler,
);

app.post(
  "/webhooks/recall",
  express.raw({ type: "application/json" }),
  recallHandler,
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Express example listening on http://localhost:${port}`);
  console.log("Endpoints:");
  console.log(`- POST http://localhost:${port}/webhooks/github`);
  console.log(`- POST http://localhost:${port}/webhooks/ragie`);
  console.log(`- POST http://localhost:${port}/webhooks/stripe`);
  console.log(`- POST http://localhost:${port}/webhooks/recall`);
  console.log(`- GET  http://localhost:${port}/health`);
  console.log("Required env vars:");
  console.log("- GITHUB_WEBHOOK_SECRET");
  console.log("- RAGIE_WEBHOOK_SECRET");
  console.log("- STRIPE_WEBHOOK_SECRET");
  console.log("- RECALL_WEBHOOK_SECRET");
});
