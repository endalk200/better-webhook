import { github } from "@better-webhook/github";
import { push, pull_request, issues } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";
import {
  createWebhookStats,
  createInMemoryReplayStore,
  type WebhookObserver,
} from "@better-webhook/core";

// Create an in-memory stats collector for observability
const stats = createWebhookStats();
// Core replay protection with built-in in-memory store
const replayStore = createInMemoryReplayStore();

// Custom observer for logging lifecycle events
const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `📥 Webhook received from ${event.provider} (${event.rawBodyBytes} bytes)`,
    );
  },
  onCompleted: (event) => {
    console.log(
      `📊 Request completed: status=${event.status}, duration=${event.durationMs.toFixed(2)}ms`,
    );
  },
  onHandlerFailed: (event) => {
    console.error(
      `💥 Handler ${event.handlerIndex} failed after ${event.handlerDurationMs.toFixed(2)}ms:`,
      event.error.message,
    );
  },
};

// Create a GitHub webhook handler with observability
const webhook = github()
  // Add observers for metrics and logging
  .observe(stats.observer)
  .observe(loggingObserver)
  .withReplayProtection({
    store: replayStore,
  })
  .event(push, async (payload, context) => {
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
  .event(pull_request, async (payload, context) => {
    console.log("🔀 Pull request event received!");
    console.log(`   Delivery ID: ${context.headers["x-github-delivery"]}`);
    console.log(`   Action: ${payload.action}`);
    console.log(
      `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`,
    );
    console.log(`   State: ${payload.pull_request.state}`);
  })
  .event(issues, async (payload, context) => {
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
  .onVerificationFailed(async (reason, headers) => {
    console.error("🔐 Verification failed:", reason);
    console.log("Headers: ", headers);
    console.log("Received signature header: ", headers["x-hub-signature-256"]);
  });

// Export the POST handler
export const POST = toNextJS(webhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed ${eventType} event`);
    // Log current stats
    const snapshot = stats.snapshot();
    console.log(
      `📈 Stats: ${snapshot.totalRequests} total, ${snapshot.successCount} success, avg ${snapshot.avgDurationMs.toFixed(2)}ms`,
    );
  },
});

// Optionally handle other methods
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      endpoint: "/api/webhooks/github",
      supportedEvents: ["push", "pull_request", "issues"],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
