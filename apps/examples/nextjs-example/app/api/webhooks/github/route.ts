import { github } from "@better-webhook/github";
import { toNextJS } from "@better-webhook/nextjs";

// Create a GitHub webhook handler
const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
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
  .onVerificationFailed(async (reason, headers) => {
    console.error("🔐 Verification failed:", reason);
    console.log("Headers: ", headers);
    console.log("Received signature header: ", headers["x-hub-signature-256"]);
    console.log("Note: The secret should not include the 'sha256=' prefix");
  });

// Export the POST handler
export const POST = toNextJS(webhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log(`✅ Successfully processed ${eventType} event`);
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
