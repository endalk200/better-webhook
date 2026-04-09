import { trace } from "@opentelemetry/api";
import { toExpress } from "@better-webhook/express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";

const githubWebhook = github()
  .instrument(
    createOpenTelemetryInstrumentation({
      includeEventTypeAttribute: true,
    }),
  )
  .event(push, async (payload, contextData) => {
    const tracer = trace.getTracer("express-github-otel-example");

    const span = tracer.startSpan("github.push.handler");
    try {
      span.setAttribute("github.repository", payload.repository.full_name);
      span.setAttribute(
        "github.delivery_id",
        contextData.deliveryId ?? "unknown",
      );

      console.log("GitHub push received", {
        deliveryId: contextData.deliveryId,
        repository: payload.repository.full_name,
        branch: payload.ref,
        commits: payload.commits.length,
      });
    } finally {
      span.end();
    }
  })
  .onError(async (error, contextData) => {
    console.error("GitHub telemetry example error", {
      deliveryId: contextData.deliveryId,
      eventType: contextData.eventType,
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
  onSuccess: (eventType) => {
    console.log("GitHub webhook processed", {
      eventType,
      telemetry: "otel",
    });
  },
});
