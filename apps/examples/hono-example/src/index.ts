import { serve } from "@hono/node-server";
import { createWebhookStats, type WebhookObserver } from "@better-webhook/core";
import { github } from "@better-webhook/github";
import { issues, pull_request, push } from "@better-webhook/github/events";
import { toHonoNode } from "@better-webhook/hono";
import { ragie } from "@better-webhook/ragie";
import {
  connection_sync_finished,
  document_status_updated,
  entity_extracted,
} from "@better-webhook/ragie/events";
import { Hono } from "hono";

const app = new Hono();
const port = Number(process.env.PORT ?? "3004");

const githubStats = createWebhookStats();
const ragieStats = createWebhookStats();

const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `[${event.provider}] webhook received (${event.rawBodyBytes} bytes)`,
    );
  },
  onCompleted: (event) => {
    const status = event.success ? "ok" : "failed";
    console.log(
      `[${event.provider}] ${status}: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
  onVerificationFailed: (event) => {
    console.warn(`[${event.provider}] verification failed: ${event.reason}`);
  },
  onHandlerFailed: (event) => {
    console.error(
      `[${event.provider}] handler ${event.handlerIndex} failed:`,
      event.error.message,
    );
  },
};

const githubWebhook = github()
  .observe(githubStats.observer)
  .observe(loggingObserver)
  .event(push, async (payload, context) => {
    console.log("Push event received");
    console.log(`Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`Repository: ${payload.repository.full_name}`);
    console.log(`Branch: ${payload.ref}`);
    console.log(`Commits: ${payload.commits.length}`);
  })
  .event(pull_request, async (payload, context) => {
    console.log("Pull request event received");
    console.log(`Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`Action: ${payload.action}`);
    console.log(
      `PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
    );
  })
  .event(issues, async (payload, context) => {
    console.log("Issue event received");
    console.log(`Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`Action: ${payload.action}`);
    console.log(`Issue #${payload.issue.number}: ${payload.issue.title}`);
  })
  .onError(async (error, context) => {
    console.error("GitHub webhook error:", error.message);
    console.error("Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("GitHub verification failed:", reason);
  });

const ragieWebhook = ragie()
  .observe(ragieStats.observer)
  .observe(loggingObserver)
  .event(document_status_updated, async (payload) => {
    console.log("Document status updated");
    console.log(`Document ID: ${payload.document_id}`);
    console.log(`Status: ${payload.status}`);
    console.log(`Partition: ${payload.partition}`);
  })
  .event(connection_sync_finished, async (payload) => {
    console.log("Connection sync finished");
    console.log(`Connection ID: ${payload.connection_id}`);
    console.log(`Sync ID: ${payload.sync_id}`);
    console.log(`Partition: ${payload.partition}`);
  })
  .event(entity_extracted, async (payload) => {
    console.log("Entity extraction completed");
    console.log(`Document ID: ${payload.document_id}`);
    console.log(`Partition: ${payload.partition ?? "default"}`);
  })
  .onError(async (error, context) => {
    console.error("Ragie webhook error:", error.message);
    console.error("Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("Ragie verification failed:", reason);
  });

app.post(
  "/webhooks/github",
  toHonoNode(githubWebhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`Successfully processed GitHub ${eventType} event`);
    },
  }),
);

app.post(
  "/webhooks/ragie",
  toHonoNode(ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`Successfully processed Ragie ${eventType} event`);
    },
  }),
);

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/stats", (c) => {
  return c.json({
    github: githubStats.snapshot(),
    ragie: ragieStats.snapshot(),
    timestamp: new Date().toISOString(),
  });
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log("Hono webhook server running");
    console.log(`Server: http://localhost:${info.port}`);
    console.log(
      `GitHub endpoint: http://localhost:${info.port}/webhooks/github`,
    );
    console.log(
      `Ragie endpoint:  http://localhost:${info.port}/webhooks/ragie`,
    );
    console.log(`Health check:    http://localhost:${info.port}/health`);
    console.log(`Stats:           http://localhost:${info.port}/stats`);
    console.log("Environment variables:");
    console.log("- GITHUB_WEBHOOK_SECRET");
    console.log("- RAGIE_WEBHOOK_SECRET");
  },
);
