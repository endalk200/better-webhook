import express from "express";
import { github } from "@better-webhook/github";
import { ragie } from "@better-webhook/ragie";
import { toExpress } from "@better-webhook/express";

const app = express();
const PORT = process.env.PORT || 3001;

// Create a GitHub webhook handler
const githubWebhook = github()
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
      `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`
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

// Create a Ragie webhook handler
const ragieWebhook = ragie()
  .event("document_status_updated", async (payload, context) => {
    console.log("📄 Document status updated!");
    console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
    console.log(`   Document ID: ${payload.document_id}`);
    console.log(`   Status: ${payload.status}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event("connection_sync_finished", async (payload, context) => {
    console.log("✅ Connection sync finished!");
    console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
    console.log(`   Connection ID: ${payload.connection_id}`);
    console.log(`   Sync ID: ${payload.sync_id}`);
    console.log(`   Partition: ${payload.partition}`);
  })
  .event("entity_extracted", async (payload, context) => {
    console.log("🔍 Entity extraction completed!");
    console.log(`   Delivery ID: ${context.headers["x-ragie-delivery"]}`);
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
  })
);

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  toExpress(ragieWebhook, {
    secret: process.env.RAGIE_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed Ragie ${eventType} event`);
    },
  })
);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 Express webhook server running!
   
   Webhook endpoints:
   - GitHub: http://localhost:${PORT}/webhooks/github
   - Ragie:  http://localhost:${PORT}/webhooks/ragie
   
   Health check: http://localhost:${PORT}/health

   Environment variables:
   - GITHUB_WEBHOOK_SECRET (for GitHub webhooks)
   - RAGIE_WEBHOOK_SECRET (for Ragie webhooks)

   To test with ngrok:
   1. ngrok http ${PORT}
   2. Configure webhooks with the ngrok URL + /webhooks/[provider]
  `);
});
