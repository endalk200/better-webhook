import { createInMemoryReplayStore } from "@better-webhook/core";
import { toExpress } from "@better-webhook/express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";

const replayStore = createInMemoryReplayStore();

const githubWebhook = github()
  .withReplayProtection({
    store: replayStore,
  })
  .event(push, async (payload, context) => {
    console.log("GitHub push accepted", {
      deliveryId: context.deliveryId,
      repository: payload.repository.full_name,
      branch: payload.ref,
      commits: payload.commits.length,
    });
  })
  .onError(async (error, context) => {
    console.error("GitHub replay example error", {
      deliveryId: context.deliveryId,
      eventType: context.eventType,
      message: error.message,
    });
  })
  .onVerificationFailed(async (reason, headers) => {
    console.error("GitHub verification failed", {
      reason,
      deliveryId: headers["x-github-delivery"],
    });
  });

export const githubHandler = toExpress(githubWebhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  onSuccess: (eventType: string) => {
    console.log("GitHub webhook processed", {
      eventType,
      replayStore: "memory",
    });
  },
});
