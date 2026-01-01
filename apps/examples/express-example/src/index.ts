import express from "express";
import { github } from "@better-webhook/github";
import { ragie } from "@better-webhook/ragie";
import { toExpress } from "@better-webhook/express";
import { createWebhookStats, type WebhookObserver } from "@better-webhook/core";

const app = express();
const PORT = process.env.PORT || 3001;

// Create stats collectors for observability
const githubStats = createWebhookStats();
const ragieStats = createWebhookStats();

// Custom observer for logging webhook lifecycle events
const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `📥 [${event.provider}] Webhook received (${event.rawBodyBytes} bytes)`,
    );
  },
  onCompleted: (event) => {
    const status = event.success ? "✓" : "✗";
    console.log(
      `📊 [${event.provider}] ${status} Completed: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
  onVerificationFailed: (event) => {
    console.warn(`🔐 [${event.provider}] Verification failed: ${event.reason}`);
  },
  onHandlerFailed: (event) => {
    console.error(
      `💥 [${event.provider}] Handler ${event.handlerIndex} failed:`,
      event.error.message,
    );
  },
};

// Create a GitHub webhook handler with observability
const githubWebhook = github()
  .observe(githubStats.observer)
  .observe(loggingObserver)
  .event("push", async (payload, context) => {
    console.log("📦 Push event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Received at: ${context.receivedAt.toISOString()}`);
    console.log(`   Repository: ${payload.repository.full_name}`);
    console.log(`   Branch: ${payload.ref}`);
    console.log(`   Commits: ${payload.commits.length}`);
    payload.commits.forEach((commit) => {
      console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
    });
  })
  .event("pull_request", async (payload, context) => {
    console.log("🔀 Pull request event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Action: ${payload.action}`);
    console.log(
      `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
    );
    console.log(`   State: ${payload.pull_request.state}`);
  })
  .event("issues", async (payload, context) => {
    console.log("🎫 Issue event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Action: ${payload.action}`);
    console.log(`   Issue #${payload.issue.number}: ${payload.issue.title}`);
    console.log(`   State: ${payload.issue.state}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Verification failed:", reason);
  });

// Create a Ragie webhook handler with observability
const ragieWebhook = ragie()
  .observe(ragieStats.observer)
  .observe(loggingObserver)
  .event("document_status_updated", async (payload, context) => {
    console.log("📄 Document status updated!");
    console.log(`   Nonce: ${payload.nonce}`);
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event("connection_sync_finished", async (payload, context) => {
    console.log("✅ Connection sync finished!");
    console.log(`   Nonce: ${payload.nonce}`);
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event("entity_extracted", async (payload, context) => {
    console.log("🔍 Entity extraction completed!");
    console.log(`   Nonce: ${payload.nonce}`);
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Partition: ${payload.partition || "default"}`);
  })
  .onError(async (error, context) => {
    console.error("❌ Ragie webhook error:", error.message);
    console.error("   Event type:", context.eventType);
  })
  .onVerificationFailed(async (reason) => {
    console.error("🔐 Ragie verification failed:", reason);
  });

// Mount the webhook handlers
// Note: express.raw() is required to get the raw body for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(githubWebhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed GitHub ${eventType} event`);
    },
  }),
);

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  toExpress(ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Ragie ${eventType} event`);
    },
  }),
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Stats endpoint - demonstrates observability
app.get("/stats", (_req, res) => {
  res.json({
    github: githubStats.snapshot(),
    ragie: ragieStats.snapshot(),
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 Express webhook server running!
   
   Webhook endpoints:
   - GitHub: http://localhost:${PORT}/webhooks/github
   - Ragie:  http://localhost:${PORT}/webhooks/ragie
   
   Health check: http://localhost:${PORT}/health
   Stats:        http://localhost:${PORT}/stats

   Environment variables:
   - GITHUB_WEBHOOK_SECRET (for GitHub webhooks)
   - RAGIE_WEBHOOK_SECRET (for Ragie webhooks)

   To test with ngrok:
   1. ngrok http ${PORT}
   2. Configure webhooks with the ngrok URL + /webhooks/[provider]
  `);
});
