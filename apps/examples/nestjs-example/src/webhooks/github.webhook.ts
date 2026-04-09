import type { Response } from "express";
import { github } from "@better-webhook/github";
import { issues, pull_request, push } from "@better-webhook/github/events";
import { toNestJS } from "@better-webhook/nestjs";
import type { RawBodyRequest } from "./types.js";
import { toNestRequest, writeNestResult } from "./types.js";

const githubWebhook = github()
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

const handleGitHub = toNestJS(githubWebhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
  onSuccess: (eventType) => {
    console.log("GitHub webhook processed", { eventType });
  },
});

export const githubInfo = {
  status: "ok",
  endpoint: "/webhooks/github",
  supportedEvents: ["push", "pull_request", "issues"],
};

export async function githubHandler(
  req: RawBodyRequest,
  res: Response,
): Promise<void> {
  const result = await handleGitHub(toNestRequest(req));
  writeNestResult(res, result);
}
