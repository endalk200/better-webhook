import express from "express";
import { github } from "@better-webhook/github";
import { toExpress } from "@better-webhook/express";

const app = express();
const PORT = process.env.PORT || 3001;

// Create a GitHub webhook handler
const webhook = github()
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

// Mount the webhook handler
// Note: express.raw() is required to get the raw body for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook, {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    onSuccess: (eventType) => {
      console.log(`✅ Successfully processed ${eventType} event`);
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
   
   Webhook endpoint: http://localhost:${PORT}/webhooks/github
   Health check:     http://localhost:${PORT}/health

   To test with ngrok:
   1. ngrok http ${PORT}
   2. Configure GitHub webhook with the ngrok URL + /webhooks/github
   3. Set GITHUB_WEBHOOK_SECRET environment variable

   Or test locally with curl:
   curl -X POST http://localhost:${PORT}/webhooks/github \\
     -H "Content-Type: application/json" \\
     -H "X-GitHub-Event: push" \\
     -H "X-GitHub-Delivery: test-123" \\
     -d '{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
  `);
});
