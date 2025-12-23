import { github } from "@better-webhook/github";
import { toNextJS } from "@better-webhook/nextjs";

// Create a GitHub webhook handler
const webhook = github()
  .event("push", async (payload) => {
    console.log("📦 Push event received!");
    console.log(`   Repository: ${payload.repository.full_name}`);
    console.log(`   Branch: ${payload.ref}`);
    console.log(`   Commits: ${payload.commits.length}`);
    payload.commits.forEach((commit) => {
      console.log(`   - ${commit.message} (${commit.id.slice(0, 7)})`);
    });
  })
  .event("pull_request", async (payload) => {
    console.log("🔀 Pull request event received!");
    console.log(`   Action: ${payload.action}`);
    console.log(
      `   PR #${payload.pull_request.number}: ${payload.pull_request.title}`
    );
    console.log(`   State: ${payload.pull_request.state}`);
  })
  .event("issues", async (payload) => {
    console.log("🎫 Issue event received!");
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
    }
  );
}
