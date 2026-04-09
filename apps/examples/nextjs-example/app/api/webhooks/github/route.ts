import { github } from "@better-webhook/github";
import { issues, pull_request, push } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload, context) => {
    console.log("GitHub push received", {
      deliveryId: context.deliveryId,
      repository: payload.repository.full_name,
      branch: payload.ref,
      commits: payload.commits.length,
    });
  })
  .event(pull_request, async (payload, context) => {
    console.log("GitHub pull request received", {
      deliveryId: context.deliveryId,
      action: payload.action,
      number: payload.pull_request.number,
      title: payload.pull_request.title,
    });
  })
  .event(issues, async (payload, context) => {
    console.log("GitHub issue received", {
      deliveryId: context.deliveryId,
      action: payload.action,
      number: payload.issue.number,
      title: payload.issue.title,
    });
  })
  .onError(async (error, context) => {
    console.error("GitHub webhook error", {
      eventType: context.eventType,
      message: error.message,
    });
  })
  .onVerificationFailed(async (reason) => {
    console.error("GitHub verification failed", { reason });
  });

export const POST = toNextJS(webhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log("GitHub webhook processed", { eventType });
  },
});

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
