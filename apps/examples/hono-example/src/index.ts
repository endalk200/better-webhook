import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { githubHandler } from "./webhooks/github.js";
import { ragieHandler } from "./webhooks/ragie.js";
import { recallHandler } from "./webhooks/recall.js";
import { stripeHandler } from "./webhooks/stripe.js";

const app = new Hono();
const port = Number(process.env.PORT ?? "3004");

app.post("/webhooks/github", githubHandler);
app.post("/webhooks/ragie", ragieHandler);
app.post("/webhooks/stripe", stripeHandler);
app.post("/webhooks/recall", recallHandler);

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Hono example listening on http://localhost:${info.port}`);
    console.log("Endpoints:");
    console.log(`- POST http://localhost:${info.port}/webhooks/github`);
    console.log(`- POST http://localhost:${info.port}/webhooks/ragie`);
    console.log(`- POST http://localhost:${info.port}/webhooks/stripe`);
    console.log(`- POST http://localhost:${info.port}/webhooks/recall`);
    console.log(`- GET  http://localhost:${info.port}/health`);
  },
);
